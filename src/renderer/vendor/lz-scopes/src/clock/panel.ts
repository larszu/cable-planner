// Clock / time code panel and the compact picture overlay (issue #28).
//
// Time of day comes from the system clock unless a PTP grandmaster is received and the user
// lets the (software-estimated) PTP offset correct it. Everything that is an assumption or an
// estimate says so on screen.

import type { Source } from '../sources';
import { sourceTimecode } from './source';
import { ptpClient, type PtpStatus } from './ptpClient';
import { LEAP_SOURCE, browserZoneSeconds, leapTableValid, localOffset, ptpToUtc, taiMinusUtc } from './tai';
import {
  RATES, beyondSt2059, emulatedJam, formatTc, framePhase, rateById, tcDiff, timeAddressAt, type JamParams, type Rate, type TimeAddress,
} from './timecode';

export interface ClockOptions {
  /** RATES id */
  rate: string; df: boolean;
  /** Daily Jam on the Local Time scale, "HH:MM" (multiple of 10 min, ST 2059-2 Annex A) */
  jam: string;
  /** take rate, drop frame, local offset and jam from the SM TLV when a grandmaster sends one */
  useSm: boolean;
  /** LTC: source id ('' = off) and channel */
  ltcSource: string; ltcChannel: number;
  /** PTP monitor in the bridge */
  ptp: boolean; delayReq: boolean; iface: string;
  /** correct the displayed time with the PTP offset estimate */
  usePtp: boolean;
  /** ST 2110 RTP check: multicast group and port ('' = off) */
  rtpGroup: string; rtpPort: number;
}

export const CLOCK_DEFAULTS: ClockOptions = {
  rate: '25', df: false, jam: '00:00', useSm: true, ltcSource: '', ltcChannel: 0,
  ptp: false, delayReq: false, iface: '', usePtp: false, rtpGroup: '', rtpPort: 0,
};
export const clockOpts = (o?: Partial<ClockOptions>): ClockOptions => ({ ...CLOCK_DEFAULTS, ...o });

// Hooks set by main.ts (the panel code has no access to the app state).
let lookup: () => Source[] = () => [];
let bridge: () => string = () => '';
export function setClockHooks(sources: () => Source[], bridgeUrl: () => string) { lookup = sources; bridge = bridgeUrl; }

export interface ClockModel {
  /** PTP time (TAI seconds since the SMPTE epoch) */
  t: number; utcMs: number; tai: number; taiSource: string; leapValid: boolean;
  rate: Rate; df: boolean; jam: JamParams; ta: TimeAddress; phase: ReturnType<typeof framePhase>;
  ref: 'system' | 'ptp'; fromSm: boolean;
}

const zoneOffsetAt = (ptp: number) => { const u = ptpToUtc(ptp); return localOffset(u, browserZoneSeconds(u)); };

/** The time of day, time address and frame phase for one clock panel. */
export function clockModel(o: ClockOptions, utcNowMs: number, st: PtpStatus | null): ClockModel {
  const receiving = !!st && st.state === 'receiving';
  const usePtp = o.ptp && o.usePtp && receiving && st!.offsetNs != null;
  const utcMs = usePtp ? utcNowMs - (st!.offsetNs as number) / 1e6 : utcNowMs;
  const gmTai = receiving && st!.gm?.utcOffsetValid ? st!.gm.currentUtcOffset : null;
  const tai = gmTai ?? taiMinusUtc(utcMs);
  const t = utcMs / 1000 + tai;
  const sm = o.ptp && o.useSm && receiving ? st!.sm ?? null : null;
  let rate = rateById(o.rate), df = o.df && rate.dfAllowed, jam: JamParams;
  if (sm) {
    const r = RATES.find((x) => x.num * sm.frameRateDen === x.den * sm.frameRateNum);
    if (r) rate = r;
    df = sm.dropFrame && rate.dfAllowed;
    jam = { currentLocalOffset: sm.currentLocalOffset, timeOfPreviousJam: sm.timeOfPreviousJam, previousJamLocalOffset: sm.previousJamLocalOffset, timeOfNextJam: sm.timeOfNextJam };
  } else {
    const [jh, jm] = o.jam.split(':').map(Number);
    jam = emulatedJam(t, zoneOffsetAt, jh || 0, jm || 0);
  }
  return {
    t, utcMs, tai, taiSource: gmTai !== null ? 'Grandmaster (currentUtcOffset)' : LEAP_SOURCE, leapValid: gmTai !== null || leapTableValid(utcMs),
    rate, df, jam, ta: timeAddressAt(t, rate, df, jam), phase: framePhase(t, rate), ref: usePtp ? 'ptp' : 'system', fromSm: !!sm,
  };
}

const C = { fg: '#e6e6e6', dim: '#8a9099', good: '#7ddc8a', warn: '#ffb840', bad: '#ff6b6b', box: 'rgba(8,9,11,0.78)', accent: '#00dcff' };
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const p2 = (v: number) => String(v).padStart(2, '0');
const hhmm = (localSeconds: number) => { const d = ((localSeconds % 86400) + 86400) % 86400; return `${p2(Math.floor(d / 3600))}:${p2(Math.floor(d / 60) % 60)}`; };
const fmtNs = (ns: number | null | undefined) => {
  if (ns == null || !Number.isFinite(ns)) return '–';
  const a = Math.abs(ns);
  return a >= 1e6 ? `${(ns / 1e6).toFixed(2)} ms` : a >= 1e3 ? `${(ns / 1e3).toFixed(1)} µs` : `${ns.toFixed(0)} ns`;
};
/** Shorten a text to maxW px with an ellipsis (current ctx font). */
function fit(ctx: CanvasRenderingContext2D, s: string, maxW: number) {
  if (maxW <= 0 || ctx.measureText(s).width <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo) + '…';
}
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
const rateText = (r: Rate, df: boolean) => `${r.label} fps ${r.dfAllowed ? (df ? 'DF' : 'NDF') : ''}`.trim();

/** Source time code against the time of day at the source's rate: Δ = source − time of day in frames. */
function sourceDelta(m: ClockModel, ta: TimeAddress, r: Rate) {
  const tod = timeAddressAt(m.t, r, ta.df && r.dfAllowed, m.jam);
  return tcDiff(ta, tod, r);
}

/** LTC of the configured source: latest frame, its Δ against the time of day at its own start. */
function ltcState(o: ClockOptions, m: ClockModel) {
  if (!o.ltcSource) return null;
  const src = lookup().find((s) => s.id === o.ltcSource) ?? null;
  const a = src?.audio ?? null;
  if (!src) return { name: '(Quelle fehlt)', frame: null, note: 'Quelle nicht mehr vorhanden' };
  if (!a) return { name: src.name, frame: null, note: 'Quelle liefert keinen Ton' };
  a.setLtc(Math.min(o.ltcChannel, a.channels - 1));
  const rd = a.ltc!;
  const f = rd.latest();
  if (!f) return { name: src.name, frame: null, note: rd.count ? 'LTC verloren' : `kein LTC erkannt (Kanal ${a.names[Math.min(o.ltcChannel, a.channels - 1)]})` };
  // wall time of the start of bit 0 of this word (audio-path latency not compensated)
  const ageMs = ((rd.position - f.start) / a.fs) * 1000 + (performance.now() - a.ltcAt);
  const nominal = f.fps > 27.5 ? 30 : f.fps > 24.5 ? 25 : 24;
  const r = f.df ? rateById('29.97') : RATES.find((x) => x.nominal === nominal && (Math.abs(x.num / x.den - f.fps) < 0.02)) ?? RATES.find((x) => x.nominal === nominal && x.den === 1)!;
  const ta: TimeAddress = { hh: f.hh, mm: f.mm, ss: f.ss, ff: f.ff, df: f.df };
  const tAt = m.t - ageMs / 1000;
  const delta = tcDiff(ta, timeAddressAt(tAt, r, f.df, m.jam), r);
  return { name: src.name, frame: f, rate: r, ta, delta, note: '' };
}

function ptpWant(o: ClockOptions) {
  const r = rateById(o.rate);
  return { iface: o.iface, delayReq: o.delayReq, rtp: o.rtpGroup && o.rtpPort ? { group: o.rtpGroup, port: o.rtpPort, rateNum: r.num, rateDen: r.den } : null };
}

/** Full clock panel. */
export function drawClockPanel(ctx: CanvasRenderingContext2D, o: ClockOptions, src: Source | null, w: number, h: number) {
  if (o.ptp && bridge()) ptpClient.ensure(bridge(), ptpWant(o));
  const st = o.ptp ? ptpClient.fresh : null;
  const m = clockModel(o, Date.now(), st);
  // measure invisibly, then scale everything down to fit the panel
  ctx.save(); ctx.globalAlpha = 0;
  const need = layoutClock(ctx, o, src, st, m, w, h);
  ctx.restore();
  const s = need > h ? Math.max(0.5, h / need) : 1;
  ctx.save(); ctx.scale(s, s);
  layoutClock(ctx, o, src, st, m, w / s, h / s);
  ctx.restore();
}

/** Draws the panel content at width w; returns the height used. */
function layoutClock(ctx: CanvasRenderingContext2D, o: ClockOptions, src: Source | null, st: PtpStatus | null, m: ClockModel, w: number, h: number): number {
  // wide panels: PTP in a second column
  const twoCol = o.ptp && w >= 900;
  const colW = twoCol ? w / 2 : w;
  const pad = 12;
  let y = pad;
  const big = Math.max(18, Math.min(72, colW / 9.5, h / 7));
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const text = (s: string, x: number, size: number, color = C.fg, weight = '') => {
    ctx.font = `${weight} ${size}px ${MONO}`; ctx.fillStyle = color;
    const t = fit(ctx, s, colW - x - 4); ctx.fillText(t, x, y); return ctx.measureText(t).width;
  };
  const lineH = (size: number) => { y += size * 1.35; };
  const small = Math.max(11, Math.min(13, colW / 40));

  text('TAGESZEIT · Local Time nach SMPTE ST 2059-1', pad, small, C.dim); lineH(small);
  text(formatTc(m.ta), pad, big, C.fg, '600'); lineH(big);
  const refText = m.ref === 'ptp' ? `PTP-korrigiert – Schätzung mit Software-Zeitstempeln (Offset ${fmtNs(st?.offsetNs)})` : 'Systemuhr – keine Referenz';
  text(refText, pad, small + 1, m.ref === 'ptp' ? C.good : C.warn, '600'); lineH(small + 1);
  const jamLocal = m.jam.timeOfNextJam ? hhmm(m.jam.timeOfNextJam + m.jam.currentLocalOffset) : '–';
  text(`${rateText(m.rate, m.df)} · nächster Jam ${jamLocal} · ${m.fromSm ? 'Lokalzeit, Rate und Jam aus SM-TLV' : 'Lokalzeit: Zeitzone des Systems'}`, pad, small, C.dim); lineH(small);
  if (beyondSt2059(m.rate)) { text('> 30 fps: Frame-Zählung 0…' + (m.rate.nominal - 1) + ' nach gängiger Konvention (ST 2059-1 definiert nur bis 30 Hz)', pad, small, C.dim); lineH(small); }
  const utc = new Date(m.utcMs).toISOString().slice(11, 23);
  text(`UTC ${utc} · TAI−UTC ${m.tai} s (${m.taiSource})${m.leapValid ? '' : ' – Tabelle abgelaufen, Schaltsekunde möglich'}`, pad, small, m.leapValid ? C.dim : C.warn); lineH(small);
  text(`PTP-Zeit ${m.t.toFixed(3)} s seit 1970-01-01 TAI · Frame ${m.phase.n}`, pad, small, C.dim); lineH(small);

  // frame phase bar (ST 2059-1 §6.2 alignment)
  const bw = Math.min(w - 2 * pad, 360), bh = Math.max(6, small * 0.7);
  y += 4;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(pad, y, bw, bh);
  ctx.fillStyle = C.accent; ctx.fillRect(pad, y, bw * m.phase.phase, bh);
  y += bh + 4;
  text(`Frame-Phase ${(m.phase.phase * 100).toFixed(0).padStart(3)} % · nächste Ausrichtung in ${((m.phase.next - m.t) * 1000).toFixed(1)} ms`, pad, small, C.dim); lineH(small);
  y += small * 0.6;

  // source time code
  const stc = sourceTimecode(src);
  if (src) {
    if (stc) {
      const d = sourceDelta(m, stc.ta, stc.rate);
      text(`QUELLE ${src.name}`, pad, small, C.dim); lineH(small);
      const wTc = text(stc.text, pad, big * 0.55, stc.stale ? C.dim : C.fg, '600');
      ctx.font = `${small}px ${MONO}`; ctx.fillStyle = C.fg;
      ctx.fillText(fit(ctx, `Δ ${signed(d)} Frames zur Tageszeit (${rateText(stc.rate, stc.ta.df)})`, colW - pad - wTc - 16), pad + wTc + 12, y + big * 0.12);
      lineH(big * 0.55);
      text(`${stc.origin}${stc.stale ? ' · veraltet' : ''} · Übertragungslatenz nicht kompensiert`, pad, small, C.dim); lineH(small);
    } else {
      text(`QUELLE ${src.name}: kein Timecode (weder Bildkopf/SEI noch Datei-Tag; Videodateien im Browser zählen ab 0)`, pad, small, C.dim); lineH(small);
    }
    y += small * 0.4;
  }

  // LTC
  const l = ltcState(o, m);
  if (l) {
    if (l.frame && l.ta && l.rate) {
      text(`LTC ${l.name}`, pad, small, C.dim); lineH(small);
      const wTc = text(formatTc(l.ta), pad, big * 0.55, C.fg, '600');
      ctx.font = `${small}px ${MONO}`; ctx.fillStyle = C.fg;
      ctx.fillText(fit(ctx, `Δ ${signed(l.delta)} Frames · ${l.frame.fps.toFixed(2)} fps${l.frame.reverse ? ' · rückwärts' : ''}`, colW - pad - wTc - 16), pad + wTc + 12, y + big * 0.12);
      lineH(big * 0.55);
      const ub = l.frame.userBits.map((v) => v.toString(16)).join('');
      text(`User-Bits ${ub} · Audio-Latenz nicht kompensiert`, pad, small, C.dim); lineH(small);
    } else { text(`LTC ${l.name}: ${l.note}`, pad, small, C.warn); lineH(small); }
    y += small * 0.4;
  }

  if (!o.ptp) return y + pad;
  if (twoCol) return Math.max(y, drawPtp(ctx, st, colW + pad, pad, colW - pad, small)) + pad;
  return drawPtp(ctx, st, pad, y, w, small) + pad;
}

function drawPtp(ctx: CanvasRenderingContext2D, st: PtpStatus | null, x: number, y0: number, w: number, size: number): number {
  let y = y0;
  const put = (s: string, color = C.fg, xx = x) => { ctx.font = `${size}px ${MONO}`; ctx.fillStyle = color; ctx.fillText(fit(ctx, s, x + w - xx - 4), xx, y); };
  const nl = () => { y += size * 1.4; };
  put('PTP (passiv, IEEE 1588 / SMPTE ST 2059-2)', C.dim); nl();
  const conn = ptpClient.conn;
  if (!st) { put(conn === 'connecting' ? 'Verbinde mit der Bridge …' : 'Bridge nicht erreichbar – PTP-Monitor läuft in der Node-Bridge (npm start / Desktop-App)', C.warn); return y + size * 1.4; }
  if (st.error) { put(st.error, C.bad); nl(); }
  const state: Record<string, [string, string]> = {
    none: ['kein PTP empfangen', C.warn], error: ['PTP-Monitor nicht aktiv', C.bad], receiving: ['PTP empfangen', C.good],
    announce: ['nur Announce, keine Sync', C.warn], 'sync-only': ['Sync ohne Announce', C.warn], stale: ['PTP verloren', C.bad],
  };
  const [label, col] = state[st.state] ?? [st.state, C.warn];
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + size * 0.45, y + size * 0.55, size * 0.4, 0, Math.PI * 2); ctx.fill();
  put(`${label}${st.domain !== undefined ? ` · Domain ${st.domain}` : ''}${st.domains.length > 1 ? ` (gesehen: ${st.domains.join(', ')})` : ''}`, col, x + size * 1.3); nl();
  if (st.state === 'none') { put('Ports 319/320 offen, Multicast 224.0.1.129 abonniert – im Netz sendet kein Grandmaster.', C.dim); return y + size * 1.4; }
  const rows: [string, string, string?][] = [];
  const g = st.gm;
  if (g) {
    rows.push(['Grandmaster', `${g.identity}${g.address ? ` (${g.address})` : ''}`]);
    rows.push(['clockClass / Acc.', `${g.clockClass} / 0x${g.clockAccuracy.toString(16)} · Var 0x${g.variance.toString(16)}`]);
    rows.push(['Priority 1 / 2', `${g.priority1} / ${g.priority2} · Steps ${g.stepsRemoved}`]);
    rows.push(['Zeitquelle', `${g.timeSource}${g.ptpTimescale ? ' · PTP-Zeitskala' : ' · ARB-Zeitskala'}${g.timeTraceable ? ' · rückführbar' : ''}`]);
    rows.push(['UTC-Offset', `${g.currentUtcOffset} s${g.utcOffsetValid ? '' : ' (nicht gültig markiert)'}`]);
  }
  if (st.rates) rows.push(['Raten /s', `Announce ${st.rates.announce.toFixed(1)} · Sync ${st.rates.sync.toFixed(1)} · FU ${st.rates.followUp.toFixed(1)} · SM ${st.rates.management.toFixed(1)}${st.twoStep ? ' · two-step' : ''}`]);
  rows.push(['Offset (Schätzung)', `${fmtNs(st.offsetNs)} ± ${fmtNs(st.jitterNs)} · Systemuhr − GM${st.pathDelayIncluded ? ', inkl. Laufzeit' : ''}`, C.warn]);
  rows.push(['Mean Path Delay', st.meanPathDelayNs != null ? `${fmtNs(st.meanPathDelayNs)} (Schätzung, Delay_Req der Bridge)` : st.delayReq ? 'keine Delay_Resp erhalten' : 'nicht gemessen (passiv; ⚙ → Laufzeit messen)']);
  const sm = st.sm;
  if (sm) {
    rows.push(['GM-Lock (SM)', sm.lockingText, sm.gmLockingStatus === 4 ? C.good : C.warn]);
    rows.push(['Lokal-Offset', `${sm.currentLocalOffset} s${sm.daylightSaving.current ? ' · Sommerzeit' : ''}${sm.jumpSeconds ? ` · Sprung ${signed(sm.jumpSeconds)} s bei ${sm.timeOfNextJump}` : ''}`]);
    rows.push(['nächster Jam', sm.timeOfNextJam ? `${hhmm(sm.timeOfNextJam + sm.currentLocalOffset)} Lokalzeit (PTP ${sm.timeOfNextJam})` : 'kein Daily Jam geplant']);
    rows.push(['System-Rate', `${sm.frameRateNum}/${sm.frameRateDen} ${sm.dropFrame ? 'DF' : 'NDF'}${sm.colorFrame ? ' · Color Frame' : ''}`]);
  } else rows.push(['SM-TLV', 'nicht empfangen (Lokal-Offset und Jam aus den Einstellungen)', C.dim]);
  if (st.rtp) {
    const r = st.rtp;
    rows.push(['ST 2110 RTP', r.error ? r.error : `${r.group}:${r.port} · ${r.packets} Pakete · PT ${r.payloadType ?? '–'}`, r.error ? C.bad : C.fg]);
    if (!r.error) rows.push(['RTP-Offset', r.lagMs != null ? `Ankunft − RTP-Zeit ${r.lagMs.toFixed(2)} ms (${r.lagFrames!.toFixed(2)} Frames) · Raster ${r.gridTicks} Ticks · Bezug ${r.ref === 'ptp' ? 'PTP-Schätzung' : 'Systemuhr'}` : 'keine Frames empfangen', r.ref === 'ptp' ? C.fg : C.warn]);
  }
  const kw = Math.min(160, w * 0.3);
  for (const [k, v, c] of rows) { put(k, C.dim); put(v, c ?? C.fg, x + kw); nl(); }
  // offset history (60 s)
  const hist = st.history ?? [];
  const vals = hist.filter((v): v is number => v != null);
  if (vals.length > 1) {
    const hw = Math.min(w - 12, 360), hh = size * 3;
    y += 4;
    const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(1, hi - lo);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.strokeRect(x, y, hw, hh);
    ctx.strokeStyle = C.accent; ctx.beginPath();
    let started = false;
    hist.forEach((v, i) => {
      if (v == null) { started = false; return; }
      const px = x + (i / (hist.length - 1)) * hw, py = y + hh - ((v - lo) / span) * hh;
      if (started) ctx.lineTo(px, py); else { ctx.moveTo(px, py); started = true; }
    });
    ctx.stroke();
    ctx.font = `${size - 1}px ${MONO}`; ctx.fillStyle = C.dim;
    ctx.fillText(`Offset 60 s: ${fmtNs(lo)} … ${fmtNs(hi)}`, x + 4, y + hh + 4);
    y += hh + size * 1.6;
  }
  return y;
}

/** Compact time of day (+ source time code) in the picture panel. */
export function drawClockOverlay(ctx: CanvasRenderingContext2D, o: ClockOptions, src: Source | null, x: number, y: number) {
  const st = o.ptp ? ptpClient.fresh : null;
  const m = clockModel(o, Date.now(), st);
  const stc = sourceTimecode(src);
  const lines: [string, string][] = [[`TOD ${formatTc(m.ta)}`, m.ref === 'ptp' ? 'PTP-Schätzung' : 'Systemuhr – keine Referenz']];
  if (stc) lines.push([`SRC ${stc.text}`, `Δ ${signed(sourceDelta(m, stc.ta, stc.rate))} Fr`]);
  ctx.font = `600 13px ${MONO}`;
  const w1 = Math.max(...lines.map(([a]) => ctx.measureText(a).width));
  ctx.font = `10px ${MONO}`;
  const w2 = Math.max(...lines.map(([, b]) => ctx.measureText(b).width));
  const bw = w1 + w2 + 22, bh = lines.length * 18 + 6;
  ctx.fillStyle = C.box; ctx.fillRect(x - bw, y - bh, bw, bh);
  lines.forEach(([a, b], i) => {
    const ly = y - bh + 4 + i * 18;
    ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.font = `600 13px ${MONO}`; ctx.fillStyle = C.fg; ctx.fillText(a, x - bw + 6, ly);
    ctx.font = `10px ${MONO}`; ctx.fillStyle = i === 0 && m.ref === 'system' ? C.warn : C.dim; ctx.fillText(b, x - bw + w1 + 16, ly + 2);
  });
}
