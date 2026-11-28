// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Audio panels of #183, #186 and #187, drawn with Canvas 2D like panels.ts:
//   audio-surround  surround star (level per channel along its direction), phase bars per pair,
//                   status line (format, reference, input)
//   audio-field     stereo field per band: 3D area width × frequency × energy, width and
//                   correlation per band, mono compatibility (dsp/stereofield.ts)
//   audio-spl       sound level meter: A/C/Z, F/S, hold, L_eq,T, L_Cpeak (dsp/spl.ts, IEC 61672-1)
//   audio-rta       real-time analyser in 1/1 … 1/48 octave bands (IEC 61260-1) with
//                   falling peaks and named snapshots
// Levels are in dB relative to a full-scale sine (AES17: 0 dBFS); the sound level panels add
// the microphone calibration (`cal`, dB SPL at 0 dBFS).

import type { AudioAnalysis } from './analysis';
import { channelNames, type AudioPanelOptions, type RtaSnapshot } from './panels';
import { BAD, FONT, GRID, GRID_DIM, LABEL, OK, TEXT, WARN, dec, empty, fmt1, say, type Box } from './draw';
import { powerSpectrum } from './dsp/fft';
import { averageSums, bandField, bandSums, monoLossDb, totalCorrelation, type BandSums } from './dsp/stereofield';
import { bandLabel, bandPowers, fractionalOctaveBands, weightingDb, type Band, type Weighting } from './dsp/weighting';
import { SPL_BLOCK_S, SPL_BLOCKS, msDb, peakDb } from './dsp/spl';
import { t } from '../i18n';

type Opts = Required<AudioPanelOptions>;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const signed2 = (r: number | null) => (r === null ? '–' : (r >= 0 ? '+' : '') + dec(r.toFixed(2)).replace('-', '−'));
/** Colour of a correlation value: out of phase red, weak amber, in phase green. */
const corrColour = (r: number | null) => (r === null ? '#6b7078' : r < 0 ? BAD : r < 0.3 ? WARN : OK);
/** Frequency colour of the stereo field: 20 Hz red … 20 kHz violet (#186). */
const hue = (f: number) => Math.max(0, Math.min(280, (280 * Math.log10(Math.max(20, f) / 20)) / 3));

/** Correlation r = Σxy/√(Σx²Σy²) of the last n samples of two channels. */
function correlation(a: AudioAnalysis, c0: number, c1: number, n: number): number | null {
  const x = a.latest(c0, n), y = a.latest(c1, n);
  let xy = 0, xx = 0, yy = 0;
  for (let i = 0; i < n; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; yy += y[i] * y[i]; }
  return xx > 1e-12 && yy > 1e-12 ? xy / Math.sqrt(xx * yy) : null;
}

// ---------------------------------------------------------------- surround star (#183)

/** Channel pairs for the phase bars: front, side, back (by ffmpeg channel id). */
const PAIRS: [string, string][] = [['FL', 'FR'], ['SL', 'SR'], ['BL', 'BR'], ['FLC', 'FRC'], ['TFL', 'TFR']];

export function drawSurround(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Opts, reference: string) {
  const names = channelNames(a, o.labels), n = a.channels;
  // pairs that exist in this stream; unknown layouts: 1/2, 3/4, …
  const ids = a.info.map((c) => c.id);
  let pairs = PAIRS.map(([l, r]) => [ids.indexOf(l), ids.indexOf(r)] as [number, number]).filter(([l, r]) => l >= 0 && r >= 0);
  if (!pairs.length && n >= 2) pairs = Array.from({ length: Math.floor(n / 2) }, (_, i) => [2 * i, 2 * i + 1] as [number, number]);
  const status = 16, barsH = pairs.length * 22 + 6;
  const side = b.w >= 520;
  const barBox: Box = side ? { x: b.x + b.w * 0.62, y: b.y + 24, w: b.w * 0.38 - 12, h: barsH } : { x: b.x + 12, y: b.y + b.h - status - barsH, w: b.w - 24, h: barsH };
  const starArea: Box = side ? { x: b.x, y: b.y, w: b.w * 0.62, h: b.h - status } : { x: b.x, y: b.y, w: b.w, h: b.h - status - barsH };
  const rad = Math.max(20, Math.min(starArea.w, starArea.h) / 2 - 26);
  const cx = starArea.x + starArea.w / 2, cy = starArea.y + starArea.h / 2 + 4;
  const lo = -60;
  const rOf = (db: number) => (Math.max(lo, Math.min(0, db)) - lo) / -lo * rad;
  // directions: layout azimuth (positive = left, BS.2051), LFE straight back, unknown evenly spread
  const unknown = a.info.filter((c) => c.az === null && !c.lfe).length;
  let u = 0;
  const az = a.info.map((c) => (c.lfe ? 180 : c.az ?? (unknown ? 360 * (u++ / unknown) : 0)));
  const pos = (deg: number, r: number) => [cx - Math.sin((deg * Math.PI) / 180) * r, cy - Math.cos((deg * Math.PI) / 180) * r] as const;
  // rings every 12 dB, R 68 alignment level −18 dBFS dashed
  ctx.font = FONT; ctx.lineWidth = 1;
  for (let d = -48; d <= 0; d += 12) {
    ctx.strokeStyle = d === 0 ? GRID : GRID_DIM; ctx.beginPath(); ctx.arc(cx, cy, rOf(d), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(String(d).replace('-', '−'), cx + 3, cy - rOf(d) - 5);
  }
  ctx.strokeStyle = 'rgba(140, 255, 158, 0.55)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(cx, cy, rOf(-18), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  // RMS over 300 ms per channel (dB re full-scale sine)
  const m = Math.min(32768, Math.round(a.fs * 0.3));
  const lv = a.info.map((_, c) => { const x = a.latest(c, m); let s = 0; for (let i = 0; i < m; i++) s += x[i] * x[i]; return msDb(s / m); });
  const order = a.info.map((_, i) => i).sort((p, q) => ((az[q] + 360) % 360) - ((az[p] + 360) % 360));
  // axes
  for (const c of order) {
    const [x, y] = pos(az[c], rad), [lx, ly] = pos(az[c], rad + 14);
    ctx.strokeStyle = a.info[c].lfe ? GRID_DIM : GRID; if (a.info[c].lfe) ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(names[c], lx, ly);
  }
  // energy area between the axes (main channels; LFE as its own spoke)
  const main = order.filter((c) => !a.info[c].lfe);
  if (main.length >= 2) {
    ctx.beginPath();
    main.forEach((c, i) => { const [x, y] = pos(az[c], rOf(lv[c])); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(140, 255, 158, 0.22)'; ctx.fill();
    ctx.strokeStyle = 'rgba(140, 255, 158, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const c of order) {
    const [x, y] = pos(az[c], rOf(lv[c]));
    ctx.fillStyle = lv[c] > -1 ? BAD : a.info[c].lfe ? '#d6a23a' : OK;
    if (a.info[c].lfe) { ctx.lineWidth = 3; ctx.strokeStyle = ctx.fillStyle; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1; }
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(t('audio.sur.scale'), starArea.x + 8, starArea.y + 6);
  // phase bars per pair: −1 (out of phase, red) … +1 (in phase, green)
  const win = Math.min(32768, Math.round((a.fs * o.corrMs) / 1000));
  const corr = pairs.map(([l, r]) => correlation(a, l, r, win));
  say(ctx, [...a.info.map((_, c) => `${names[c]} ${fmt1(lv[c])} dBFS`), ...pairs.map(([l, r], i) => `${names[l]}/${names[r]} ${signed2(corr[i])}`)]);
  pairs.forEach(([l, r], i) => {
    const y = barBox.y + i * 22, x0 = barBox.x + 44, w = barBox.w - 44 - 46;
    if (w < 20) return;
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    g.addColorStop(0, 'rgba(255, 92, 92, 0.45)'); g.addColorStop(0.5, 'rgba(255, 180, 74, 0.35)'); g.addColorStop(0.65, 'rgba(140, 255, 158, 0.25)'); g.addColorStop(1, 'rgba(140, 255, 158, 0.45)');
    ctx.fillStyle = g; ctx.fillRect(x0, y, w, 10);
    ctx.strokeStyle = GRID_DIM; ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, 9);
    ctx.fillStyle = GRID; ctx.fillRect(x0 + w / 2 - 0.5, y - 2, 1, 14);
    const rr = corr[i];
    if (rr !== null) { ctx.fillStyle = corrColour(rr); ctx.fillRect(x0 + ((rr + 1) / 2) * w - 2, y - 3, 4, 16); }
    ctx.font = FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = TEXT;
    ctx.fillText(`${names[l]}/${names[r]}`, x0 - 6, y + 5);
    ctx.textAlign = 'left'; ctx.fillStyle = corrColour(rr); ctx.fillText(signed2(rr), x0 + w + 6, y + 5);
  });
  if (pairs.length) {
    ctx.fillStyle = '#6b7078'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(t('audio.sur.phase', { ms: o.corrMs }), barBox.x + 44, barBox.y + pairs.length * 22);
  }
  // status line: format, reference, input
  const format = `${a.layout || (a.layoutKnown ? t('audio.sur.channels', { n }) : t('audio.sur.discrete', { n }))} · ${dec(String(a.fs / 1000))} kHz`;
  ctx.fillStyle = '#8a9098'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(t('audio.sur.status', { format, ref: reference, input: a.label || '–' }), b.x + 8, b.y + b.h - 3, b.w - 16);
}

// ---------------------------------------------------------------- stereo field (#186)

const FIELD_N = 8192;
const fieldState = new WeakMap<object, { sig: string; bands: Band[]; acc: BandSums | null; frames: number }>();

export function drawField(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Opts, key: object) {
  if (a.channels < 2) { empty(ctx, b.w, b.h, t('audio.ph.needsTwo')); return; }
  if (a.frames < FIELD_N) { empty(ctx, b.w, b.h, t('audio.sp.collecting')); return; }
  const frac = o.fieldFrac === 1 ? 1 : 3, sig = `${frac}:${a.fs}`;
  let st = fieldState.get(key);
  if (!st || st.sig !== sig) { st = { sig, bands: fractionalOctaveBands(frac, 20, Math.min(20000, a.fs / 2.2)), acc: null, frames: 0 }; fieldState.set(key, st); }
  // a new window every 1/4 FFT length of audio; averaged with the correlation time constant
  if (a.frames - st.frames >= FIELD_N / 4 || !st.acc) {
    const s = bandSums(a.latest(0, FIELD_N), a.latest(1, FIELD_N), FIELD_N, a.fs, st.bands);
    if (!st.acc || a.frames < st.frames) st.acc = s;
    else averageSums(st.acc, s, Math.exp(-((a.frames - st.frames) / a.fs) / (o.corrMs / 1000)));
    st.frames = a.frames;
  }
  const bands = st.bands, f = bandField(st.acc!, bands);
  const mono = monoLossDb(st.acc!, bands, a.fs), total = totalCorrelation(st.acc!);
  // worst band with real energy (≥ −60 dB)
  const worst = f.filter((x) => x.corr !== null && x.db > -60).sort((p, q) => p.corr! - q.corr!)[0];
  ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = mono === null ? TEXT : mono > -3.5 ? OK : mono > -6 ? WARN : BAD;
  ctx.font = `600 13px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(t('audio.fld.mono', { db: mono === null ? '–' : Number.isFinite(mono) ? fmt1(mono) : '−∞' }), b.x + 8, b.y + 6);
  ctx.font = FONT; ctx.fillStyle = corrColour(total);
  ctx.fillText(t('audio.fld.total', { r: signed2(total) }), b.x + 170, b.y + 8);
  if (worst && worst.corr! < 0.3) { ctx.fillStyle = corrColour(worst.corr); ctx.fillText(t('audio.fld.worst', { f: bandLabel(worst.fm), r: signed2(worst.corr) }), b.x + 300, b.y + 8, b.w - 308); }
  say(ctx, [t('audio.fld.mono', { db: mono === null ? '–' : Number.isFinite(mono) ? fmt1(mono) : '−∞' }), t('audio.fld.total', { r: signed2(total) }),
    ...(worst ? [t('audio.fld.worst', { f: bandLabel(worst.fm), r: signed2(worst.corr) })] : [])]);
  const area3d: Box = { x: b.x + 8, y: b.y + 24, w: b.w - 16, h: (b.h - 24) * 0.56 };
  const flat: Box = { x: b.x + 40, y: area3d.y + area3d.h + 10, w: b.w - 80, h: b.y + b.h - (area3d.y + area3d.h + 10) - 18 };
  drawField3d(ctx, f, area3d, o.yaw);
  drawFieldFlat(ctx, f, flat);
}

function drawField3d(ctx: CanvasRenderingContext2D, f: ReturnType<typeof bandField>, r: Box, yawDeg: number) {
  const yaw = (yawDeg * Math.PI) / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  // the rotated floor spans |cos|+|sin| in both directions: scale so it stays inside r
  const span = Math.abs(cy) + Math.abs(sy);
  const wS = Math.min(r.w * 0.42, r.h * 1.1) / span, dS = (r.h * 0.22) / span, hS = r.h * 0.5;
  const ox = r.x + r.w / 2, oy = r.y + r.h - dS * span - 4;
  const floor = -80;
  // world x ∈ [−1, 1] (L … R), z ∈ [−1, 1] (low … high frequency, front … back), y ∈ [0, 1] (energy)
  const P = (x: number, z: number, y: number) => {
    const xr = x * cy + z * sy, zr = -x * sy + z * cy;
    return [ox + xr * wS, oy - zr * dS - y * hS] as const;
  };
  // floor frame, centre line, L/R and frequency labels
  ctx.strokeStyle = GRID_DIM; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [x0, z0, x1, z1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) { const p = P(x0, z0, 0), q = P(x1, z1, 0); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
  ctx.stroke();
  ctx.strokeStyle = GRID; ctx.beginPath(); { const p = P(0, -1, 0), q = P(0, 1, 0); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } ctx.stroke();
  ctx.font = FONT; ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  { const p = P(-1.12, -1, 0); ctx.fillText('L', p[0], p[1]); const q = P(1.12, -1, 0); ctx.fillText('R', q[0], q[1]); }
  const zOf = (i: number) => (f.length > 1 ? -1 + (2 * i) / (f.length - 1) : 0);
  f.forEach((x, i) => {
    const l = bandLabel(x.fm);
    if (!['31.5', '100', '1k', '10k'].includes(l) && !(f.length < 12 && ['63', '250', '4k'].includes(l))) return;
    const p = P(1.18, zOf(i), 0); ctx.textAlign = 'left'; ctx.fillText(l, p[0], p[1]);
  });
  // ridges back to front (painter's order along the view depth)
  const order = f.map((_, i) => i).sort((p, q) => zOf(q) * cy - zOf(p) * cy);
  const S = 33;
  for (const i of order) {
    const b = f[i];
    if (b.width === null) continue;
    const hgt = Math.max(0, Math.min(1, (b.db - floor) / -floor)), z = zOf(i);
    const c = b.balance ?? 0, s = 0.06 + 0.94 * b.width;
    const pts: (readonly [number, number])[] = [];
    for (let k = 0; k < S; k++) { const x = -1 + (2 * k) / (S - 1); pts.push(P(x, z, hgt * Math.exp(-(((x - c) / s) ** 2)))); }
    const h = hue(b.fm);
    ctx.beginPath();
    const b0 = P(-1, z, 0), b1 = P(1, z, 0);
    ctx.moveTo(b0[0], b0[1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.lineTo(b1[0], b1[1]); ctx.closePath();
    ctx.fillStyle = `hsla(${h}, 85%, 52%, 0.42)`; ctx.fill();
    ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.strokeStyle = b.corr !== null && b.corr < 0 && b.db > -60 ? BAD : `hsla(${h}, 90%, 65%, 0.95)`; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
  }
}

function drawFieldFlat(ctx: CanvasRenderingContext2D, f: ReturnType<typeof bandField>, r: Box) {
  if (r.h < 30 || !f.length) return;
  const cw = r.w / f.length;
  const yW = (w: number) => r.y + r.h - w * r.h, yC = (c: number) => r.y + ((1 - c) / 2) * r.h;
  ctx.font = FONT; ctx.lineWidth = 1;
  // grid: width 0 / ½ / 1, correlation +1 / 0 / −1 share the same lines
  for (const v of [0, 0.5, 1]) { const y = yW(v); ctx.strokeStyle = v === 0.5 ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(r.x, y + 0.5); ctx.lineTo(r.x + r.w, y + 0.5); ctx.stroke(); }
  ctx.fillStyle = LABEL; ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  ctx.fillText(t('audio.fld.side'), r.x - 4, yW(1)); ctx.fillText(t('audio.fld.mid'), r.x - 4, yW(0));
  ctx.textAlign = 'left';
  ctx.fillText('+1', r.x + r.w + 4, yC(1)); ctx.fillText('0', r.x + r.w + 4, yC(0)); ctx.fillText('−1', r.x + r.w + 4, yC(-1));
  // width bars, faded for quiet bands
  f.forEach((b, i) => {
    if (b.width === null) return;
    const alpha = Math.max(0.15, Math.min(0.85, (b.db + 80) / 60));
    ctx.fillStyle = `hsla(${hue(b.fm)}, 85%, 55%, ${alpha})`;
    ctx.fillRect(r.x + i * cw + cw * 0.15, yW(b.width), cw * 0.7, r.y + r.h - yW(b.width));
  });
  // correlation per band
  ctx.strokeStyle = 'rgba(230, 230, 230, 0.7)'; ctx.beginPath();
  let on = false;
  f.forEach((b, i) => {
    if (b.corr === null) { on = false; return; }
    const x = r.x + (i + 0.5) * cw, y = yC(b.corr);
    if (on) ctx.lineTo(x, y); else { ctx.moveTo(x, y); on = true; }
  });
  ctx.stroke();
  f.forEach((b, i) => { if (b.corr === null) return; ctx.fillStyle = corrColour(b.corr); ctx.beginPath(); ctx.arc(r.x + (i + 0.5) * cw, yC(b.corr), 2.5, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const every = Math.max(1, Math.ceil(30 / cw));
  f.forEach((b, i) => { if (i % every === 0) ctx.fillText(bandLabel(b.fm), r.x + (i + 0.5) * cw, r.y + r.h + 3); });
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#6b7078';
  ctx.fillText(t('audio.fld.legend'), r.x, r.y - 2);
}

// ---------------------------------------------------------------- sound level meter (#187)

interface Hold { sig: string; resetAt: number; seen: number; ms: number; peak: number }
const holds = new WeakMap<object, Hold>();

/** Reset the hold values of a sound level panel (the L_eq keeps running; reset at the source resets it). */
export function resetSplHold(key: object) {
  const h = holds.get(key);
  if (h) { h.resetAt = Date.now(); h.seen = h.resetAt; h.ms = 0; h.peak = 0; }
}

const wName = (w: Weighting) => (w === 'Z' ? 'Z' : w);
const unitOf = (w: Weighting, cal: number) => (cal ? (w === 'Z' ? 'dBZ' : `dB(${w})`) : (w === 'Z' ? 'dBFS' : `dBFS(${w})`));

export function drawSpl(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Opts, key: object) {
  const ch = Math.min(a.channels - 1, Math.max(0, o.ch)), m = a.spl(ch), cal = o.cal, w = o.weight, tw = o.time;
  const sig = `${ch}:${w}:${tw}`;
  let h = holds.get(key);
  if (!h) { h = { sig, resetAt: Date.now(), seen: 0, ms: 0, peak: 0 }; holds.set(key, h); }
  if (h.sig !== sig) { h.sig = sig; h.seen = h.resetAt; h.ms = 0; h.peak = 0; }
  const mx = m.maxSince(w, tw, Math.max(h.seen, h.resetAt)), mc = m.maxSince('C', tw, Math.max(h.seen, h.resetAt));
  h.ms = Math.max(h.ms, mx.ms); h.peak = Math.max(h.peak, mc.peak); h.seen = Math.max(h.seen, m.lastBlock);
  const L = msDb(m.level(w, tw)) + cal, hold = msDb(h.ms) + cal;
  const leqS = o.leqMin * 60, leq = m.leq(w, leqS), leqC = m.leq('C', leqS);
  const pk1 = peakDb(m.maxSince('C', 'F', Date.now() - 1000).peak) + cal, pkMax = peakDb(h.peak) + cal;
  const unit = unitOf(w, cal), unitC = unitOf('C', cal);
  const name = `L${wName(w)}${tw}`;
  const leqName = o.leqMin ? `L${wName(w)}eq,${o.leqMin} min` : `L${wName(w)}eq`;
  // big number
  const big = Math.max(22, Math.min(64, b.h / 5, b.w / 7));
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = FONT; ctx.fillStyle = '#8a9098'; ctx.fillText(`${name} · ${a.names[ch] ?? ch + 1}`, b.x + 10, b.y + 8);
  ctx.font = `600 ${big}px ui-monospace, SFMono-Regular, Menlo, monospace`; ctx.fillStyle = TEXT;
  ctx.fillText(L > cal - 190 ? fmt1(L) : '–', b.x + 10, b.y + 22);
  const numW = ctx.measureText('−188,8').width;
  ctx.font = `400 ${Math.round(big / 2.6)}px ui-monospace, SFMono-Regular, Menlo, monospace`; ctx.fillStyle = LABEL;
  ctx.fillText(unit, b.x + 14 + numW, b.y + 22 + big * 0.5);
  // level bar
  const hi = Math.ceil((cal + 10) / 10) * 10, lo = hi - 100;
  const bar: Box = { x: b.x + 10, y: b.y + 30 + big, w: b.w - 20, h: 12 };
  const xL = (v: number) => bar.x + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * bar.w;
  ctx.fillStyle = '#15181c'; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.fillStyle = '#3f8fd6'; ctx.fillRect(bar.x, bar.y + 1, xL(L) - bar.x, bar.h - 2);
  ctx.fillStyle = '#cfd3d8'; ctx.fillRect(xL(hold) - 1, bar.y - 2, 2, bar.h + 4);
  ctx.font = FONT; ctx.fillStyle = LABEL; ctx.textAlign = 'center';
  for (let v = lo; v <= hi; v += 20) ctx.fillText(String(v).replace('-', '−'), xL(v), bar.y + bar.h + 3);
  // values
  const din = !!cal && w === 'A' && o.leqMin === 30; // DIN 15905-5: L_Aeq over 30 min ≤ 99 dB(A), L_Cpeak ≤ 135 dB(C)
  const rows: [string, string, string?][] = [
    [t('audio.spl.hold'), `${fmt1(hold)} ${unit}`],
    [leqName, `${fmt1(msDb(leq.ms) + cal)} ${unit}${leq.seconds + 1 < leqS ? t('audio.spl.over', { t: clock(leq.seconds) }) : ''}`, din && msDb(leq.ms) + cal > 99 ? BAD : undefined],
    [o.leqMin ? `LCeq,${o.leqMin} min` : 'LCeq', `${fmt1(msDb(leqC.ms) + cal)} ${unitC}`],
    ['LCpeak 1 s', `${fmt1(pk1)} ${unitC}`, cal && pk1 > 135 ? BAD : undefined],
    ['LCpeak max', `${fmt1(pkMax)} ${unitC}`, cal && pkMax > 135 ? BAD : undefined],
    [t('audio.spl.since'), clock(m.count / a.fs)],
  ];
  say(ctx, [`${name} ${fmt1(L)} ${unit}`, ...rows.map(([k, v]) => `${k} ${v}`)]);
  const ry0 = bar.y + bar.h + 20, colW = Math.min(300, b.w - 20);
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textBaseline = 'top';
  rows.forEach(([k, v, c], i) => {
    const y = ry0 + i * 17;
    ctx.fillStyle = '#8a9098'; ctx.textAlign = 'left'; ctx.fillText(k, b.x + 10, y);
    ctx.fillStyle = c ?? TEXT; ctx.textAlign = 'right'; ctx.fillText(v, b.x + 10 + colW, y);
  });
  ctx.font = FONT; ctx.textAlign = 'left'; ctx.fillStyle = cal ? '#6b7078' : WARN;
  ctx.fillText(cal ? t('audio.spl.cal', { db: fmt1(cal) }) : t('audio.spl.uncal'), b.x + 10, ry0 + rows.length * 17 + 4, b.w - 20);
  // history of the time-weighted level (block maxima), last 5 min
  const gy = ry0 + rows.length * 17 + 24, g: Box = { x: b.x + 40, y: gy, w: b.w - 52, h: b.y + b.h - gy - 18 };
  if (g.h < 40 || m.len < 2) return;
  const blocks = Math.min(m.len, Math.round(300 / SPL_BLOCK_S));
  const yG = (v: number) => g.y + g.h - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * g.h;
  for (let v = lo; v <= hi; v += 20) { ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(g.x, yG(v) + 0.5); ctx.lineTo(g.x + g.w, yG(v) + 0.5); ctx.stroke(); ctx.fillStyle = LABEL; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(v).replace('-', '−'), g.x - 4, yG(v)); }
  const ring = tw === 'F' ? m.w[w].bF : m.w[w].bS, total = Math.round(300 / SPL_BLOCK_S);
  ctx.strokeStyle = '#8cff9e'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i < blocks; i++) {
    const j = (m.head - blocks + i + SPL_BLOCKS) % SPL_BLOCKS, x = g.x + ((total - blocks + i) / total) * g.w, y = yG(msDb(ring[j]) + cal);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = LABEL; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(t('audio.spl.history'), g.x + g.w, g.y + g.h + 3);
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- RTA (#187)

interface RtaState { sig: string; bands: Band[]; ms: Float64Array | null; peak: Float64Array | null; frames: number; t: number }
const rtaState = new WeakMap<object, RtaState>();
/** Peak hold falls by this many dB per second (own choice). */
export const PEAK_FALL_DB_S = 6;
/** Colours of the snapshot lines (fixed order). */
export const SNAP_COLOURS = ['#ffd166', '#ef476f', '#06d6a0', '#c77dff', '#4cc9f0', '#f8961e', '#e9ecef', '#90be6d'];

/** Current RTA curve of a panel (Z-weighted, dB re full scale, without calibration) for a snapshot. */
export function rtaCurve(key: object): { f: number[]; db: number[] } | null {
  const s = rtaState.get(key);
  if (!s?.ms) return null;
  return { f: s.bands.map((b) => Math.round(b.fm * 100) / 100), db: Array.from(s.ms, (v) => Math.round(msDb(v / 2) * 10) / 10) };
}

export function drawRta(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Opts, key: object) {
  const ch = Math.min(a.channels - 1, Math.max(0, o.ch)), frac = [1, 3, 6, 12, 24, 48].includes(o.frac) ? o.frac : 3;
  const n = frac >= 12 ? 32768 : 16384, fs = a.fs, fMax = Math.min(20000, fs / 2.2), cal = o.cal, wgt = o.rtaWeight;
  const r: Box = { x: b.x + 44, y: b.y + 22, w: b.w - 56, h: b.h - 46 };
  const xlin = o.xlin, fMin = xlin ? 0 : 20;
  const xF = (f: number) => r.x + (xlin ? f / fMax : Math.log10(Math.max(fMin, f) / fMin) / Math.log10(fMax / fMin)) * r.w;
  const hi = Math.ceil(cal / 10) * 10, lo = hi + Math.min(-40, o.floor);
  const yD = (d: number) => r.y + ((hi - Math.max(lo, Math.min(hi, d))) / (hi - lo)) * r.h;
  ctx.font = FONT; ctx.lineWidth = 1;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let d = hi; d >= lo; d -= 10) { const y = yD(d); ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(r.x, y + 0.5); ctx.lineTo(r.x + r.w, y + 0.5); ctx.stroke(); ctx.fillStyle = LABEL; ctx.fillText(String(d).replace('-', '−'), r.x - 4, y); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ticks = xlin ? [1000, 2000, 5000, 10000, 15000, 20000] : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  for (const f of ticks) { if (f > fMax) continue; const x = xF(f); ctx.strokeStyle = f === 1000 ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(x + 0.5, r.y); ctx.lineTo(x + 0.5, r.y + r.h); ctx.stroke(); ctx.fillStyle = LABEL; ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, r.y + r.h + 4); }
  const unit = cal ? (wgt === 'Z' ? 'dBZ SPL' : `dB(${wgt}) SPL`) : (wgt === 'Z' ? 'dBFS' : `dBFS(${wgt})`);
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${unit} · ${t('audio.rta.banding', { b: frac })} · FFT ${n} · ${a.names[ch] ?? ch + 1}${cal ? '' : t('audio.rta.uncal')}`, b.x + 8, b.y + 5, b.w - 16);
  if (a.frames < n) { empty(ctx, b.w, b.h, t('audio.sp.collecting')); return; }
  const sig = `${frac}:${fs}:${ch}:${n}`;
  let st = rtaState.get(key);
  if (!st || st.sig !== sig) { st = { sig, bands: fractionalOctaveBands(frac, 20, fMax), ms: null, peak: null, frames: 0, t: now() }; rtaState.set(key, st); }
  // new analysis at 20 Hz of audio time; smoothing in the power domain
  if (a.frames - st.frames >= fs / 20 || !st.ms) {
    const p = bandPowers(powerSpectrum(a.latest(ch, n), 0, n), fs, st.bands);
    if (st.ms && o.smooth > 0) for (let i = 0; i < p.length; i++) st.ms[i] = o.smooth * st.ms[i] + (1 - o.smooth) * p[i];
    else st.ms = p;
    st.frames = a.frames;
  }
  const tNow = now(), dt = (tNow - st.t) / 1000; st.t = tNow;
  const disp = (i: number, msLin: number) => 10 * Math.log10(Math.max(1e-20, msLin)) + weightingDb(wgt, st!.bands[i].fm) + cal;
  const vals = Array.from(st.ms!, (v, i) => disp(i, v));
  if (o.peakFall) {
    if (!st.peak) st.peak = Float64Array.from(vals);
    for (let i = 0; i < vals.length; i++) st.peak[i] = Math.max(vals[i], st.peak[i] - PEAK_FALL_DB_S * dt);
  } else st.peak = null;
  const bands = st.bands;
  say(ctx, [`RTA ${t('audio.rta.banding', { b: frac })}`, ...(o.snaps ?? []).map((x) => x.name)]);
  // bars for 1/1 and 1/3 octave, a line for finer banding
  if (frac <= 3) {
    ctx.fillStyle = 'rgba(140, 255, 158, 0.55)';
    bands.forEach((bd, i) => { const x0 = xF(bd.lo) + 1, x1 = xF(bd.hi) - 1; if (x1 > x0) ctx.fillRect(x0, yD(vals[i]), x1 - x0, r.y + r.h - yD(vals[i])); });
  } else {
    ctx.strokeStyle = '#8cff9e'; ctx.lineWidth = 1.3; ctx.beginPath();
    bands.forEach((bd, i) => (i ? ctx.lineTo(xF(bd.fm), yD(vals[i])) : ctx.moveTo(xF(bd.fm), yD(vals[i]))));
    ctx.stroke(); ctx.lineWidth = 1;
  }
  if (st.peak) {
    ctx.fillStyle = '#cfd3d8';
    bands.forEach((bd, i) => { const x0 = frac <= 3 ? xF(bd.lo) + 1 : xF(bd.fm) - 1, x1 = frac <= 3 ? xF(bd.hi) - 1 : xF(bd.fm) + 1; ctx.fillRect(x0, yD(st!.peak![i]) - 0.5, Math.max(1, x1 - x0), 1.5); });
  }
  // snapshots as comparison lines (stored Z-weighted without calibration, so they follow the axis)
  const snaps = (o.snaps ?? []).filter((s) => s.on !== false);
  snaps.forEach((s: RtaSnapshot) => {
    const col = SNAP_COLOURS[(o.snaps ?? []).indexOf(s) % SNAP_COLOURS.length];
    ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.setLineDash([5, 3]); ctx.beginPath();
    s.f.forEach((f, i) => { const v = s.db[i] + weightingDb(wgt, f) + cal, x = xF(f), y = yD(v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  });
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  snaps.forEach((s, i) => { ctx.fillStyle = SNAP_COLOURS[(o.snaps ?? []).indexOf(s) % SNAP_COLOURS.length]; ctx.fillText(`– – ${s.name}`, r.x + r.w - 4, r.y + 4 + i * 13); });
}

/** Number of blocks kept by the sound level meter, as minutes (settings: L_eq periods). */
export const SPL_MAX_MIN = (SPL_BLOCKS * SPL_BLOCK_S) / 60;
