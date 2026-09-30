// Audio panels, drawn with Canvas 2D into the panel overlay:
//   audio-meter     sample peak / true peak per channel + M, S, I on the EBU +9/+18 scale
//   audio-loudness  M and S over time with the target band
//   audio-spectrum  FFT spectrum, logarithmic frequency axis, slope, third-octave bands
//   audio-phase     goniometer (M/S, mono vertical) + correlation meter
// Scales after EBU Tech 3341 p6–7: EBU +9 = −18 … +9 LU, EBU +18 = −36 … +18 LU,
// 0 LU = −23 LUFS, one decimal, unit always shown.

import type { AudioAnalysis } from './analysis';
import { spectrumDb, thirdOctaveBands, thirdOctaveCentres, tiltDb } from './dsp/fft';
import { toDb } from './dsp/truepeak';

export interface AudioPanelOptions {
  scale?: 'ebu9' | 'ebu18';
  /** relative scale in LU instead of LUFS */
  rel?: boolean;
  target?: 'r128' | 's1' | 's2';
  /** history span in minutes */
  span?: number;
  fft?: number;
  tilt?: number;
  bands?: boolean;
  chan?: 'mid' | 'l' | 'r' | 'lr';
  floor?: number;
  smooth?: number;
  zoom?: number;
  corrMs?: number;
}

export const AUDIO_DEFAULTS: Required<AudioPanelOptions> = {
  scale: 'ebu9', rel: false, target: 'r128', span: 5, fft: 8192, tilt: 0, bands: false, chan: 'lr', floor: -100, smooth: 0.5, zoom: 0, corrMs: 600,
};

export const TARGET = -23; // LUFS, EBU R 128
export const TARGETS: Record<Required<AudioPanelOptions>['target'], { label: string; hint: string; maxS?: number }> = {
  r128: { label: 'EBU R 128: −23 LUFS, ±1 LU live, ≤ −1 dBTP', hint: 'R 128' },
  s1: { label: 'R 128 s1 (Werbung): −23 LUFS, Max S ≤ −18 LUFS, ≤ −1 dBTP', hint: 'R 128 s1', maxS: -18 },
  s2: { label: 'R 128 s2 (Streaming): −23 LUFS; Ausspielung −20 … −16 LUFS zulässig', hint: 'R 128 s2' },
};
const TP_MAX = -1;
const ALIGN = -18; // EBU R 68

interface Box { x: number; y: number; w: number; h: number }
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
const GRID = 'rgba(210, 190, 120, 0.35)';
const GRID_DIM = 'rgba(210, 190, 120, 0.13)';
const LABEL = 'rgba(230, 215, 170, 0.85)';
const TEXT = '#d6d6d6';
const OK = '#8cff9e', WARN = '#ffb44a', BAD = '#ff5c5c';

export const fmt1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(1).replace('.', ',').replace('-', '−'));
const signed = (v: number) => (v > 0.05 ? `+${fmt1(v)}` : fmt1(v));

function scaleRange(o: Required<AudioPanelOptions>): [number, number] {
  return o.scale === 'ebu18' ? [TARGET - 36, TARGET + 18] : [TARGET - 18, TARGET + 9];
}
/** Loudness value as text: LUFS or LU relative to −23 LUFS. */
export function loudText(v: number, rel: boolean) {
  if (!Number.isFinite(v)) return rel ? '– LU' : '– LUFS';
  return rel ? `${signed(v - TARGET)} LU` : `${fmt1(v)} LUFS`;
}

function empty(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
}

export function drawAudioPanel(ctx: CanvasRenderingContext2D, scope: string, a: AudioAnalysis | null, w: number, h: number, opts: AudioPanelOptions | undefined, emptyText: string, key: object) {
  const o = { ...AUDIO_DEFAULTS, ...opts };
  if (!a) { empty(ctx, w, h, emptyText); return; }
  ctx.save();
  if (scope === 'audio-meter') drawMeter(ctx, a, { x: 0, y: 0, w, h }, o);
  else if (scope === 'audio-loudness') drawHistory(ctx, a, { x: 0, y: 0, w, h }, o);
  else if (scope === 'audio-spectrum') drawSpectrum(ctx, a, { x: 0, y: 0, w, h }, o, key);
  else if (scope === 'audio-phase') drawPhase(ctx, a, { x: 0, y: 0, w, h }, o);
  ctx.restore();
  if (a.stale) {
    ctx.font = FONT; ctx.fillStyle = WARN; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('kein Ton-Eingang', w - 8, 6);
  }
}

// ---------------------------------------------------------------- meter

function drawMeter(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Required<AudioPanelOptions>) {
  const L = a.loud, lv = a.level, n = a.channels;
  const pad = 8, top = 22, bottom = 34;
  const textW = Math.min(220, Math.max(150, b.w * 0.34));
  const avail = b.w - textW - pad * 3;
  const peakW = Math.max(60, Math.min(avail * 0.55, 30 + n * 26));
  const loudW = Math.max(70, avail - peakW);
  const hPlot = b.h - top - bottom;
  // --- peak meters: dBFS −60 … 0
  const pk: Box = { x: b.x + pad + 26, y: b.y + top, w: peakW - 26, h: hPlot };
  const lo = -60, hi = 0;
  const yDb = (d: number) => pk.y + pk.h - ((Math.max(lo, Math.min(hi, d)) - lo) / (hi - lo)) * pk.h;
  ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let d = lo; d <= hi; d += 6) {
    const y = yDb(d);
    ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(pk.x, y + 0.5); ctx.lineTo(pk.x + pk.w, y + 0.5); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(fmt1(d).replace(',0', ''), pk.x - 4, y);
  }
  for (const [d, c, t] of [[ALIGN, OK, '−18'], [TP_MAX, BAD, '−1']] as const) {
    const y = yDb(d);
    ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(pk.x - 2, y + 0.5); ctx.lineTo(pk.x + pk.w, y + 0.5); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = c; ctx.textAlign = 'left'; ctx.fillText(t, pk.x + pk.w + 2, y); ctx.textAlign = 'right';
  }
  const bw = Math.max(4, Math.min(22, (pk.w - 4) / n - 4));
  for (let c = 0; c < n; c++) {
    const x = pk.x + 3 + c * (bw + 4);
    const sp = toDb(lv.peakOver(c, 100)), tp = toDb(lv.truePeakOver(c, 100)), hold = toDb(lv.truePeakOver(c, 3000));
    ctx.fillStyle = '#15181c'; ctx.fillRect(x, pk.y, bw, pk.h);
    // segments by colour: green below −18, amber up to −1, red above
    const seg = (from: number, to: number, col: string) => {
      if (sp <= from) return;
      const y0 = yDb(Math.min(sp, to)), y1 = yDb(from);
      ctx.fillStyle = col; ctx.fillRect(x, y0, bw, y1 - y0);
    };
    seg(lo, ALIGN, '#3fa55a'); seg(ALIGN, TP_MAX, '#d6a23a'); seg(TP_MAX, hi, BAD);
    if (Number.isFinite(tp)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, yDb(tp) - 1, bw, 2); }
    if (Number.isFinite(hold)) { ctx.fillStyle = hold > TP_MAX ? BAD : '#cfd3d8'; ctx.fillRect(x, yDb(hold) - 0.5, bw, 1); }
    ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(a.names[c] ?? String(c + 1), x + bw / 2, pk.y + pk.h + 4);
    const mtp = toDb(lv.maxTP[c]);
    if (bw >= 20 || n === 1) {
      ctx.fillStyle = mtp > TP_MAX ? BAD : TEXT; ctx.textBaseline = 'bottom';
      ctx.fillText(Number.isFinite(mtp) ? fmt1(mtp).replace(/,\d$/, '') : '–', x + bw / 2, pk.y - 4);
    }
    if (lv.clips[c]) { ctx.fillStyle = BAD; ctx.fillRect(x, pk.y - 20, bw, 4); }
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('dBFS', b.x + pad, b.y + b.h - 12);

  // --- loudness bars M, S, I on the EBU scale
  const lb: Box = { x: pk.x + pk.w + 30 + 26, y: b.y + top, w: loudW - 56, h: hPlot };
  const [s0, s1] = scaleRange(o);
  const yL = (v: number) => lb.y + lb.h - ((Math.max(s0, Math.min(s1, v)) - s0) / (s1 - s0)) * lb.h;
  const stepLU = o.scale === 'ebu18' ? 6 : 3;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = s0; v <= s1 + 1e-9; v += stepLU) {
    const y = yL(v);
    ctx.strokeStyle = Math.abs(v - TARGET) < 1e-6 ? GRID : GRID_DIM;
    ctx.beginPath(); ctx.moveTo(lb.x, y + 0.5); ctx.lineTo(lb.x + lb.w, y + 0.5); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(o.rel ? signed(v - TARGET).replace(',0', '') : String(Math.round(v)).replace('-', '−'), lb.x - 4, y);
  }
  // target band ±1 LU
  ctx.fillStyle = 'rgba(140, 255, 158, 0.10)';
  ctx.fillRect(lb.x, yL(TARGET + 1), lb.w, yL(TARGET - 1) - yL(TARGET + 1));
  const maxS = TARGETS[o.target].maxS;
  if (maxS !== undefined) { ctx.strokeStyle = WARN; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(lb.x, yL(maxS) + 0.5); ctx.lineTo(lb.x + lb.w, yL(maxS) + 0.5); ctx.stroke(); ctx.setLineDash([]); }
  const I = L.integrated;
  const bars: [string, number, number][] = [['M', L.momentary, L.maxM], ['S', L.shortTerm, L.maxS], ['I', I, NaN]];
  const gw = lb.w / bars.length;
  bars.forEach(([name, v, mx], i) => {
    const bw2 = Math.min(gw * 0.64, 44), x = lb.x + i * gw + (gw - bw2) / 2;
    ctx.fillStyle = '#15181c'; ctx.fillRect(x, lb.y, bw2, lb.h);
    if (Number.isFinite(v) && v > s0) {
      const col = name === 'I' ? (Math.abs(v - TARGET) <= 1 ? '#3fa55a' : '#d6a23a') : v > TARGET + 1 ? '#d6a23a' : '#3f8fd6';
      ctx.fillStyle = col; ctx.fillRect(x, yL(v), bw2, lb.y + lb.h - yL(v));
    }
    if (Number.isFinite(mx) && mx > s0) { ctx.fillStyle = '#cfd3d8'; ctx.fillRect(x, yL(mx) - 0.5, bw2, 1); }
    ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(name, x + bw2 / 2, lb.y + lb.h + 4);
  });
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${o.scale === 'ebu18' ? 'EBU +18' : 'EBU +9'} · ${o.rel ? 'LU' : 'LUFS'}`, lb.x, b.y + b.h - 12);

  // --- numbers
  const tx = b.x + b.w - textW - pad, ty = b.y + 8;
  const lra = L.lra, secs = L.measuredSeconds, maxTP = toDb(Math.max(...lv.maxTP));
  const rows: [string, string, string?][] = [
    ['M', loudText(L.momentary, o.rel)],
    ['S', loudText(L.shortTerm, o.rel), maxS !== undefined && L.shortTerm > maxS ? WARN : undefined],
    ['I', loudText(I, o.rel) + (L.paused ? ' ⏸' : ''), Number.isFinite(I) ? (Math.abs(I - TARGET) <= 1 ? OK : WARN) : undefined],
    ['LRA', `${fmt1(lra)} LU${lra !== null && secs < 60 ? ' (unstabil)' : ''}`, lra !== null && secs < 60 ? '#8a9098' : undefined],
    ['Max M', loudText(L.maxM, o.rel)],
    ['Max S', loudText(L.maxS, o.rel), maxS !== undefined && L.maxS > maxS ? BAD : undefined],
    ['Max TP', `${fmt1(maxTP)} dBTP`, maxTP > TP_MAX ? BAD : undefined],
    ['PLR', Number.isFinite(I) && Number.isFinite(maxTP) ? `${fmt1(maxTP - I)} dB` : '– dB'],
    ['Zeit', `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}${L.paused ? ' Pause' : ''}`],
  ];
  const clips = lv.clips.reduce((s, c) => s + c, 0);
  if (clips) rows.push(['Clip', `${clips} Samples ≥ 0 dBFS`, BAD]);
  if (a.gaps) rows.push(['Lücken', `${a.gaps} (Ton fehlte)`, WARN]);
  const big = Math.max(12, Math.min(22, b.h / 16));
  ctx.textBaseline = 'top';
  let y = ty;
  rows.forEach(([k, v, col], i) => {
    const size = i < 3 ? big : 11;
    ctx.font = `${i < 3 ? 600 : 400} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillStyle = '#8a9098'; ctx.textAlign = 'left'; ctx.fillText(k, tx, y);
    ctx.fillStyle = col ?? TEXT; ctx.textAlign = 'right'; ctx.fillText(v, tx + textW, y);
    y += size + (i < 3 ? 6 : 4);
  });
  ctx.font = FONT; ctx.fillStyle = '#6b7078'; ctx.textAlign = 'left';
  const lines = [TARGETS[o.target].label, a.label];
  lines.forEach((l, i) => ctx.fillText(l, tx, y + 6 + i * 13, textW));
}

// ---------------------------------------------------------------- loudness history

function drawHistory(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Required<AudioPanelOptions>) {
  const r: Box = { x: b.x + 44, y: b.y + 10, w: b.w - 56, h: b.h - 34 };
  const [s0, s1] = scaleRange(o);
  const yL = (v: number) => r.y + r.h - ((Math.max(s0, Math.min(s1, v)) - s0) / (s1 - s0)) * r.h;
  ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const step = o.scale === 'ebu18' ? 6 : 3;
  for (let v = s0; v <= s1 + 1e-9; v += step) {
    const y = yL(v);
    ctx.strokeStyle = Math.abs(v - TARGET) < 1e-6 ? GRID : GRID_DIM;
    ctx.beginPath(); ctx.moveTo(r.x, y + 0.5); ctx.lineTo(r.x + r.w, y + 0.5); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(o.rel ? signed(v - TARGET).replace(',0', '') : String(Math.round(v)).replace('-', '−'), r.x - 4, y);
  }
  ctx.fillStyle = 'rgba(140, 255, 158, 0.10)';
  ctx.fillRect(r.x, yL(TARGET + 1), r.w, yL(TARGET - 1) - yL(TARGET + 1));
  const maxS = TARGETS[o.target].maxS;
  if (maxS !== undefined) { ctx.strokeStyle = WARN; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(r.x, yL(maxS) + 0.5); ctx.lineTo(r.x + r.w, yL(maxS) + 0.5); ctx.stroke(); ctx.setLineDash([]); }
  const points = Math.round(o.span * 600);
  // time axis
  ctx.textBaseline = 'top';
  const marks = o.span <= 1 ? 6 : o.span <= 5 ? 5 : o.span <= 15 ? 3 : 6;
  for (let i = 0; i <= marks; i++) {
    const x = r.x + (i / marks) * r.w, t = o.span * (1 - i / marks);
    ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(x + 0.5, r.y); ctx.lineTo(x + 0.5, r.y + r.h); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.textAlign = i === 0 ? 'left' : i === marks ? 'right' : 'center';
    ctx.fillText(t === 0 ? 'jetzt' : t >= 1 ? `−${Math.round(t * 10) / 10} min`.replace('.', ',') : `−${Math.round(t * 60)} s`, x, r.y + r.h + 4);
  }
  const line = (vals: Float32Array, color: string, width: number) => {
    const n = vals.length;
    if (!n) return;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    const cols = Math.max(1, Math.floor(r.w));
    let started = false;
    // one min/max pair per pixel column (points may outnumber pixels)
    for (let c = 0; c < cols; c++) {
      const i0 = Math.floor(((c / cols) * points) - (points - n)), i1 = Math.floor((((c + 1) / cols) * points) - (points - n));
      if (i1 <= 0 || i0 >= n) continue;
      let mn = Infinity, mx = -Infinity;
      for (let i = Math.max(0, i0); i < Math.min(n, Math.max(i1, i0 + 1)); i++) { const v = vals[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (!Number.isFinite(mx)) { started = false; continue; }
      const x = r.x + c + 0.5;
      if (!started) { ctx.moveTo(x, yL(mx)); started = true; } else ctx.lineTo(x, yL(mx));
      if (mn !== mx && Number.isFinite(mn)) ctx.lineTo(x, yL(mn));
    }
    ctx.stroke(); ctx.lineWidth = 1;
  };
  line(a.history('m', points), 'rgba(120, 170, 230, 0.55)', 1);
  line(a.history('s', points), '#8cff9e', 1.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = FONT;
  ctx.fillStyle = 'rgba(120, 170, 230, 0.9)'; ctx.fillText(`M ${loudText(a.loud.momentary, o.rel)}`, r.x + 6, r.y + 4);
  ctx.fillStyle = '#8cff9e'; ctx.fillText(`S ${loudText(a.loud.shortTerm, o.rel)}`, r.x + 130, r.y + 4);
  ctx.fillStyle = TEXT; ctx.fillText(`I ${loudText(a.loud.integrated, o.rel)}`, r.x + 254, r.y + 4);
}

// ---------------------------------------------------------------- spectrum

const smoothState = new WeakMap<object, { key: string; lines: Float32Array[] }>();

function drawSpectrum(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Required<AudioPanelOptions>, key: object) {
  const r: Box = { x: b.x + 40, y: b.y + 10, w: b.w - 50, h: b.h - 34 };
  const fs = a.fs, fMin = 20, fMax = Math.min(20000, fs / 2);
  const xF = (f: number) => r.x + (Math.log10(f / fMin) / Math.log10(fMax / fMin)) * r.w;
  const top = 0, bot = o.floor;
  const yD = (d: number) => r.y + ((top - Math.max(bot, Math.min(top, d))) / (top - bot)) * r.h;
  ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let d = top; d >= bot; d -= 10) {
    const y = yD(d);
    ctx.strokeStyle = d === ALIGN + 8 ? GRID_DIM : GRID_DIM; ctx.beginPath(); ctx.moveTo(r.x, y + 0.5); ctx.lineTo(r.x + r.w, y + 0.5); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(String(d).replace('-', '−'), r.x - 4, y);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const f of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
    if (f > fMax) continue;
    const x = xF(f);
    ctx.strokeStyle = f === 1000 ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(x + 0.5, r.y); ctx.lineTo(x + 0.5, r.y + r.h); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(f >= 1000 ? `${f / 1000}k` : String(f), x, r.y + r.h + 4);
  }
  const n = Math.min(o.fft, 32768);
  if (a.frames < n) { empty(ctx, b.w, b.h, 'Sammle Samples …'); return; }
  const chans = o.chan === 'lr' && a.channels >= 2 ? [0, 1] : o.chan === 'r' && a.channels >= 2 ? [1] : o.chan === 'mid' && a.channels >= 2 ? [-1] : [0];
  const colors = chans.length === 2 ? ['rgba(255, 110, 110, 0.9)', 'rgba(110, 200, 255, 0.9)'] : ['#8cff9e'];
  const st = smoothState.get(key);
  const skey = `${n}:${chans.join()}:${o.bands}:${fs}`;
  const prev = st && st.key === skey ? st.lines : null;
  const now: Float32Array[] = [];
  const centres = thirdOctaveCentres(fMin, fMax);
  chans.forEach((c, ci) => {
    let x: Float32Array;
    if (c === -1) { const l = a.latest(0, n), rr = a.latest(1, n); x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (l[i] + rr[i]) / 2; }
    else x = a.latest(c, n);
    let db = spectrumDb(x, 0, n);
    if (o.bands) db = Float32Array.from(thirdOctaveBands(db, fs, centres));
    // smoothing in the power domain
    if (prev?.[ci] && o.smooth > 0) {
      const p = prev[ci];
      for (let i = 0; i < db.length; i++) db[i] = 10 * Math.log10(o.smooth * 10 ** (p[i] / 10) + (1 - o.smooth) * 10 ** (db[i] / 10));
    }
    now.push(db);
    ctx.strokeStyle = colors[ci]; ctx.fillStyle = colors[ci];
    if (o.bands) {
      const bw = (r.w / centres.length) * (chans.length === 2 ? 0.4 : 0.8);
      centres.forEach((f, i) => {
        const v = db[i] + tiltDb(f, o.tilt);
        const x0 = xF(f) - (chans.length === 2 ? (ci === 0 ? bw : 0) : bw / 2);
        ctx.globalAlpha = 0.75; ctx.fillRect(x0, yD(v), bw, r.y + r.h - yD(v)); ctx.globalAlpha = 1;
      });
      return;
    }
    const df = fs / n;
    ctx.lineWidth = 1.2; ctx.beginPath();
    let started = false;
    const cols = Math.floor(r.w);
    for (let px = 0; px < cols; px++) {
      const f0 = fMin * (fMax / fMin) ** (px / cols), f1 = fMin * (fMax / fMin) ** ((px + 1) / cols);
      const k0 = Math.max(1, Math.floor(f0 / df)), k1 = Math.max(k0, Math.min(db.length - 1, Math.floor(f1 / df)));
      let m = -300;
      for (let k = k0; k <= k1; k++) if (db[k] > m) m = db[k];
      const v = m + tiltDb((f0 + f1) / 2, o.tilt);
      const yy = yD(v);
      if (!started) { ctx.moveTo(r.x + px, yy); started = true; } else ctx.lineTo(r.x + px, yy);
    }
    ctx.stroke(); ctx.lineWidth = 1;
  });
  smoothState.set(key, { key: skey, lines: now });
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const chName = chans.length === 2 ? 'L rot, R blau' : chans[0] === -1 ? '(L+R)/2' : a.names[chans[0]];
  ctx.fillText(`dBFS · FFT ${n} · ${fmt1(fs / n)} Hz/Bin${o.tilt ? ` · Neigung ${fmt1(o.tilt)} dB/Okt. um 1 kHz` : ''}${o.bands ? ' · Terzbänder' : ''} · ${chName}`, r.x + 6, r.y + 4);
}

// ---------------------------------------------------------------- goniometer + correlation

function drawPhase(ctx: CanvasRenderingContext2D, a: AudioAnalysis, b: Box, o: Required<AudioPanelOptions>) {
  const barH = 34;
  const size = Math.max(40, Math.min(b.w - 16, b.h - barH - 16));
  const cx = b.x + b.w / 2, cy = b.y + 8 + size / 2, rad = size / 2;
  ctx.strokeStyle = GRID_DIM; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rad / 2, 0, Math.PI * 2); ctx.stroke();
  // axes: M vertical, S horizontal, L and R diagonals
  ctx.strokeStyle = GRID;
  ctx.beginPath(); ctx.moveTo(cx, cy - rad); ctx.lineTo(cx, cy + rad); ctx.moveTo(cx - rad, cy); ctx.lineTo(cx + rad, cy); ctx.stroke();
  ctx.strokeStyle = GRID_DIM; const d = rad * Math.SQRT1_2;
  ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
  ctx.font = FONT; ctx.fillStyle = LABEL; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center'; ctx.fillText('M', cx, cy - rad + 8); ctx.fillText('+S', cx - rad + 10, cy - 8); ctx.fillText('−S', cx + rad - 10, cy - 8);
  ctx.fillText('L', cx - d - 6, cy - d - 6); ctx.fillText('R', cx + d + 6, cy - d - 6);
  if (a.channels < 2) { empty(ctx, b.w, b.h, 'Goniometer braucht zwei Kanäle'); return; }
  const n = Math.min(4096, Math.round(a.fs * 0.05));
  const L = a.latest(0, n), R = a.latest(1, n);
  let zoom = o.zoom;
  if (!zoom) { // auto: fit the loudest sample
    let m = 1e-6;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
    zoom = Math.min(64, 0.9 / m);
  }
  const k = (rad * zoom) / Math.SQRT2;
  ctx.fillStyle = 'rgba(140, 255, 158, 0.55)';
  for (let i = 0; i < n; i++) {
    const x = (L[i] - R[i]) * k, y = (L[i] + R[i]) * k; // L upper left, R upper right, mono vertical
    ctx.fillRect(cx - x - 0.75, cy - y - 0.75, 1.5, 1.5);
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(o.zoom ? `×${o.zoom}` : `auto ×${fmt1(zoom)}`, b.x + 8, b.y + 8);
  const pol = [a.level.polarity(0), a.level.polarity(1)];
  if (pol[0] && pol[1] && pol.every((p) => p !== '?')) ctx.fillText(`Polarität L ${pol[0]}  R ${pol[1]}`, b.x + 8, b.y + 22);
  // correlation bar −1 … +1
  const bar: Box = { x: b.x + 52, y: b.y + b.h - barH + 6, w: b.w - 104, h: 10 };
  ctx.fillStyle = '#15181c'; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.strokeStyle = GRID_DIM; ctx.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.w - 1, bar.h - 1);
  const r = a.level.correlation(o.corrMs);
  ctx.textAlign = 'center'; ctx.fillStyle = LABEL;
  for (const v of [-1, -0.5, 0, 0.5, 1]) ctx.fillText(String(v).replace('-', '−').replace('.', ','), bar.x + ((v + 1) / 2) * bar.w, bar.y + bar.h + 3);
  if (r !== null) {
    const x = bar.x + ((r + 1) / 2) * bar.w, x0 = bar.x + bar.w / 2;
    ctx.fillStyle = r < 0 ? BAD : r < 0.3 ? WARN : OK;
    ctx.fillRect(Math.min(x, x0), bar.y + 1, Math.abs(x - x0), bar.h - 2);
    ctx.fillRect(x - 1, bar.y - 2, 2, bar.h + 4);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = TEXT;
  ctx.fillText(r === null ? '–' : (r >= 0 ? '+' : '') + r.toFixed(2).replace('.', ',').replace('-', '−'), bar.x + bar.w + 4, bar.y + bar.h / 2);
  ctx.textAlign = 'right'; ctx.fillStyle = LABEL;
  ctx.fillText(`${o.corrMs} ms`, bar.x - 4, bar.y + bar.h / 2);
}
