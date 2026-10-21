// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
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
  RATES, beyondSt2059, emulatedJam, formatPairs, formatTc, toPairs, framePhase, rateById, tcDiff, timeAddressAt, type JamParams, type Rate, type TimeAddress,
} from './timecode';
import { t } from '../i18n';
import { bridgeText, ptpLockText } from '../i18n/bridgeMessage';

export interface ClockOptions {
  /** RATES id */
  rate: string; df: boolean;
  /** > 30 Hz: full frame count 0…49/59 (like NLEs) or ST 12-1 frame pairs */
  tcDisplay: 'frames' | 'pairs';
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
  rate: '25', df: false, tcDisplay: 'frames', jam: '00:00', useSm: true, ltcSource: '', ltcChannel: 0,
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
  const ptpT = utcMs / 1000 + tai;
  const sm = o.ptp && o.useSm && receiving ? st!.sm ?? null : null;
  let rate = rateById(o.rate), df = o.df && rate.dfAllowed, jam: JamParams;
  if (sm) {
    const r = RATES.find((x) => x.num * sm.frameRateDen === x.den * sm.frameRateNum);
    if (r) rate = r;
    df = sm.dropFrame && rate.dfAllowed;
    jam = { currentLocalOffset: sm.currentLocalOffset, timeOfPreviousJam: sm.timeOfPreviousJam, previousJamLocalOffset: sm.previousJamLocalOffset, timeOfNextJam: sm.timeOfNextJam };
  } else {
    const [jh, jm] = o.jam.split(':').map(Number);
    jam = emulatedJam(ptpT, zoneOffsetAt, jh || 0, jm || 0);
  }
  return {
    t: ptpT, utcMs, tai, taiSource: gmTai !== null ? 'Grandmaster (currentUtcOffset)' : LEAP_SOURCE.replace(/g\u00fcltig bis/, t('clock.validUntil')), leapValid: gmTai !== null || leapTableValid(utcMs),
    rate, df, jam, ta: timeAddressAt(ptpT, rate, df, jam), phase: framePhase(ptpT, rate), ref: usePtp ? 'ptp' : 'system', fromSm: !!sm,
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
/** Time address as configured (full count or ST 12-1 pairs above 30 Hz). */
const tcText = (ta: TimeAddress, r: Rate, o: ClockOptions) => (o.tcDisplay === 'pairs' && beyondSt2059(r) ? formatPairs(toPairs(ta, r)) : formatTc(ta));
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
  if (!src) return { name: t('clock.ltc.srcMissing'), frame: null, note: t('clock.ltc.srcGone') };
  if (!a) return { name: src.name, frame: null, note: t('clock.ltc.noAudio') };
  a.setLtc(Math.min(o.ltcChannel, a.channels - 1));
  const rd = a.ltc!;
  const f = rd.latest();
  if (!f) return { name: src.name, frame: null, note: rd.count ? t('clock.ltc.lost') : t('clock.ltc.none', { ch: a.names[Math.min(o.ltcChannel, a.channels - 1)] }) };
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
    const fitted = fit(ctx, s, colW - x - 4); ctx.fillText(fitted, x, y); return ctx.measureText(fitted).width;
  };
  const lineH = (size: number) => { y += size * 1.35; };
  const small = Math.max(11, Math.min(13, colW / 40));

  text(t('clock.todTitle'), pad, small, C.dim); lineH(small);
  text(tcText(m.ta, m.rate, o), pad, big, C.fg, '600'); lineH(big);
  const refText = m.ref === 'ptp' ? t('clock.ptpCorrected', { offset: fmtNs(st?.offsetNs) }) : t('clock.systemNoRef');
  text(refText, pad, small + 1, m.ref === 'ptp' ? C.good : C.warn, '600'); lineH(small + 1);
  const jamLocal = m.jam.timeOfNextJam ? hhmm(m.jam.timeOfNextJam + m.jam.currentLocalOffset) : '–';
  text(`${rateText(m.rate, m.df)} · ${t('clock.nextJam', { jam: jamLocal })} · ${m.fromSm ? t('clock.fromSm') : t('clock.systemZone')}`, pad, small, C.dim); lineH(small);
  if (beyondSt2059(m.rate)) {
    text(o.tcDisplay === 'pairs' ? t('clock.pairsNote', { n: m.rate.nominal / 2 - 1 }) : t('clock.countNote', { n: m.rate.nominal - 1 }), pad, small, C.dim); lineH(small);
  }
  const utc = new Date(m.utcMs).toISOString().slice(11, 23);
  text(`UTC ${utc} · TAI−UTC ${m.tai} s (${m.taiSource})${m.leapValid ? '' : t('clock.leapExpired')}`, pad, small, m.leapValid ? C.dim : C.warn); lineH(small);
  text(t('clock.ptpTime', { s: m.t.toFixed(3), n: m.phase.n }), pad, small, C.dim); lineH(small);

  // frame phase bar (ST 2059-1 §6.2 alignment)
  const bw = Math.min(w - 2 * pad, 360), bh = Math.max(6, small * 0.7);
  y += 4;
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(pad, y, bw, bh);
  ctx.fillStyle = C.accent; ctx.fillRect(pad, y, bw * m.phase.phase, bh);
  y += bh + 4;
  text(t('clock.phase', { p: (m.phase.phase * 100).toFixed(0).padStart(3), ms: ((m.phase.next - m.t) * 1000).toFixed(1) }), pad, small, C.dim); lineH(small);
  y += small * 0.6;

  // source time code
  const stc = sourceTimecode(src);
  if (src) {
    if (stc) {
      const d = sourceDelta(m, stc.ta, stc.rate);
      text(t('clock.src', { name: src.name }), pad, small, C.dim); lineH(small);
      const wTc = text(stc.text, pad, big * 0.55, stc.stale ? C.dim : C.fg, '600');
      ctx.font = `${small}px ${MONO}`; ctx.fillStyle = C.fg;
      ctx.fillText(fit(ctx, t('clock.srcDelta', { d: signed(d), rate: rateText(stc.rate, stc.ta.df) }), colW - pad - wTc - 16), pad + wTc + 12, y + big * 0.12);
      lineH(big * 0.55);
      text(`${stc.origin}${stc.stale ? t('clock.stale') : ''} · ${t('clock.latencyNotComp')}`, pad, small, C.dim); lineH(small);
    } else {
      text(t('clock.srcNoTc', { name: src.name }), pad, small, C.dim); lineH(small);
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
      ctx.fillText(fit(ctx, `Δ ${signed(l.delta)} ${t('clock.frames')} · ${l.frame.fps.toFixed(2)} fps${l.frame.reverse ? t('clock.reverse') : ''}`, colW - pad - wTc - 16), pad + wTc + 12, y + big * 0.12);
      lineH(big * 0.55);
      const ub = l.frame.userBits.map((v) => v.toString(16)).join('');
      text(t('clock.userBits', { ub }) + (beyondSt2059(m.rate) ? t('clock.ltcPairs') : ''), pad, small, C.dim); lineH(small);
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
  put(t('clock.ptp.title'), C.dim); nl();
  const conn = ptpClient.conn;
  if (!st && conn === 'denied') {
    put(t('clock.ptp.denied', { origin: location.origin }), C.warn); y += size * 1.4;
    put(t('clock.ptp.allowHint'), C.dim);
    return y + size * 1.4;
  }
  if (!st) { put(conn === 'connecting' ? t('clock.ptp.connecting') : t('clock.ptp.bridgeDown'), C.warn); return y + size * 1.4; }
  if (st.error) { put(bridgeText(st, 'error'), C.bad); nl(); }
  const state: Record<string, [string, string]> = {
    none: [t('clock.ptp.none'), C.warn], error: [t('clock.ptp.inactive'), C.bad], receiving: [t('clock.ptp.receiving'), C.good],
    announce: [t('clock.ptp.announceOnly'), C.warn], 'sync-only': [t('clock.ptp.syncOnly'), C.warn], stale: [t('clock.ptp.lost'), C.bad],
  };
  const [label, col] = state[st.state] ?? [st.state, C.warn];
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + size * 0.45, y + size * 0.55, size * 0.4, 0, Math.PI * 2); ctx.fill();
  put(`${label}${st.domain !== undefined ? ` · Domain ${st.domain}` : ''}${st.domains.length > 1 ? t('clock.ptp.seen', { list: st.domains.join(', ') }) : ''}`, col, x + size * 1.3); nl();
  if (st.state === 'none') { put(t('clock.ptp.noGm'), C.dim); return y + size * 1.4; }
  const rows: [string, string, string?][] = [];
  const g = st.gm;
  if (g) {
    rows.push(['Grandmaster', `${g.identity}${g.address ? ` (${g.address})` : ''}`]);
    rows.push(['clockClass / Acc.', `${g.clockClass} / 0x${g.clockAccuracy.toString(16)} · Var 0x${g.variance.toString(16)}`]);
    rows.push(['Priority 1 / 2', `${g.priority1} / ${g.priority2} · Steps ${g.stepsRemoved}`]);
    rows.push([t('clock.ptp.timeSource'), `${g.timeSource}${g.ptpTimescale ? t('clock.ptp.ptpScale') : t('clock.ptp.arbScale')}${g.timeTraceable ? t('clock.ptp.traceable') : ''}`]);
    rows.push([t('clock.ptp.utcOffset'), `${g.currentUtcOffset} s${g.utcOffsetValid ? '' : t('clock.ptp.notValid')}`]);
  }
  if (st.rates) rows.push([t('clock.ptp.rates'), `Announce ${st.rates.announce.toFixed(1)} · Sync ${st.rates.sync.toFixed(1)} · FU ${st.rates.followUp.toFixed(1)} · SM ${st.rates.management.toFixed(1)}${st.twoStep ? ' · two-step' : ''}`]);
  rows.push([t('clock.ptp.offset'), `${fmtNs(st.offsetNs)} ± ${fmtNs(st.jitterNs)} · ${t('clock.ptp.sysMinusGm')}${st.pathDelayIncluded ? t('clock.ptp.inclDelay') : ''}`, C.warn]);
  rows.push(['Mean Path Delay', st.meanPathDelayNs != null ? t('clock.ptp.mpd', { v: fmtNs(st.meanPathDelayNs) }) : st.delayReq ? t('clock.ptp.noResp') : t('clock.ptp.notMeasured')]);
  const sm = st.sm;
  if (sm) {
    rows.push(['GM-Lock (SM)', ptpLockText(sm.gmLockingStatus, sm.lockingText), sm.gmLockingStatus === 4 ? C.good : C.warn]);
    rows.push([t('clock.ptp.localOffset'), `${sm.currentLocalOffset} s${sm.daylightSaving.current ? t('clock.ptp.dst') : ''}${sm.jumpSeconds ? t('clock.ptp.jump', { s: signed(sm.jumpSeconds), at: sm.timeOfNextJump }) : ''}`]);
    rows.push([t('clock.ptp.nextJam'), sm.timeOfNextJam ? t('clock.ptp.nextJamAt', { local: hhmm(sm.timeOfNextJam + sm.currentLocalOffset), ptp: sm.timeOfNextJam }) : t('clock.ptp.noJam')]);
    rows.push([t('clock.ptp.sysRate'), `${sm.frameRateNum}/${sm.frameRateDen} ${sm.dropFrame ? 'DF' : 'NDF'}${sm.colorFrame ? ' · Color Frame' : ''}`]);
  } else rows.push(['SM-TLV', t('clock.ptp.noSm'), C.dim]);
  if (st.rtp) {
    const r = st.rtp;
    rows.push(['ST 2110 RTP', r.error ? bridgeText(r, 'error') : t('clock.rtp.status', { addr: `${r.group}:${r.port}`, n: r.packets, pt: r.payloadType ?? '–' }), r.error ? C.bad : C.fg]);
    if (!r.error) rows.push([t('clock.rtp.offset'), r.lagMs != null ? t('clock.rtp.lag', { ms: r.lagMs.toFixed(2), fr: r.lagFrames!.toFixed(2), ticks: r.gridTicks ?? '–', ref: r.ref === 'ptp' ? t('clock.ptpEstimate') : t('clock.systemClock') }) : t('clock.rtp.noFrames'), r.ref === 'ptp' ? C.fg : C.warn]);
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
  const lines: [string, string][] = [[`TOD ${tcText(m.ta, m.rate, o)}`, m.ref === 'ptp' ? t('clock.ptpEstimate') : t('clock.systemNoRef')]];
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
