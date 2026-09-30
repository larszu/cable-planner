// 2D overlays per panel: graticules, labels, histogram, statistics, probe read-outs.

import {
  GAMUTS, SKIN_LINE_DEG, isGamma, SPECTRAL_LOCUS, barTargets, codeValue, gamutConvert, hlgFromNits, isLog, levelText, nitsToSignal, pqEncode,
  sceneToSignal, transferLabel, xyToUv, ycbcr,
  type Colorspace, type GamutId, type Transfer,
} from './color';
import { CIE_VIEW, CIE_VIEW_UV, WAVE_MAX, WAVE_MIN, type Rect } from './renderer';
import type { Source } from './sources';

export type ScopeType = 'picture' | 'wf-luma' | 'wf-color' | 'wf-skin' | 'wf-rgb' | 'parade' | 'yrgb' | 'ycbcr' | 'vector' | 'cie' | 'hist' | 'stats'
  | 'audio-meter' | 'audio-loudness' | 'audio-spectrum' | 'audio-phase';
export type Unit = 'percent' | 'bit8' | 'bit10' | 'nits';

export const SCOPE_LABELS: Record<ScopeType, string> = {
  picture: 'Bild', 'wf-luma': 'Waveform Luma', 'wf-color': 'Waveform Farbe', 'wf-skin': 'Waveform Hauttöne', 'wf-rgb': 'Waveform RGB', parade: 'RGB-Parade', yrgb: 'YRGB-Parade',
  ycbcr: 'YCbCr-Parade', vector: 'Vectorscope', cie: 'CIE-Diagramm', hist: 'Histogramm', stats: 'Messwerte',
  'audio-meter': 'Audio Pegel & Lautheit', 'audio-loudness': 'Audio Lautheitsverlauf', 'audio-spectrum': 'Audio Spektrum', 'audio-phase': 'Audio Goniometer',
};

export const isAudio = (s: ScopeType) => s.startsWith('audio-');

export const isWaveform = (s: ScopeType) => s === 'wf-luma' || s === 'wf-color' || s === 'wf-skin' || s === 'wf-rgb' || s === 'parade' || s === 'yrgb' || s === 'ycbcr';
export const sections = (s: ScopeType) => (s === 'parade' || s === 'ycbcr' ? 3 : s === 'yrgb' ? 4 : 1);

const GRID = 'rgba(210, 190, 120, 0.42)';
const GRID_DIM = 'rgba(210, 190, 120, 0.16)';
const LABEL = 'rgba(230, 215, 170, 0.85)';
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

/** Plot area inside a panel body (CSS px), shared by WebGL and the overlay. */
export function plotRect(scope: ScopeType, w: number, h: number, aspect = 16 / 9): Rect {
  if (isWaveform(scope)) return { x: 44, y: 8, w: Math.max(10, w - 52), h: Math.max(10, h - 16) };
  if (scope === 'vector') {
    const s = Math.max(10, Math.min(w, h) - 16);
    return { x: (w - s) / 2, y: (h - s) / 2, w: s, h: s };
  }
  if (scope === 'cie') {
    const s = Math.max(10, Math.min(w - 36, h - 24));
    return { x: (w - s + 24) / 2, y: (h - s - 16) / 2, w: s, h: s };
  }
  if (scope === 'hist') return { x: 8, y: 8, w: Math.max(10, w - 16), h: Math.max(10, h - 26) };
  if (scope === 'picture') {
    let pw = w, ph = w / aspect;
    if (ph > h) { ph = h; pw = h * aspect; }
    return { x: (w - pw) / 2, y: (h - ph) / 2, w: pw, h: ph };
  }
  return { x: 0, y: 0, w, h };
}

/** Vertical range of a waveform: full, or zoomed into the blacks / the highlights. */
export type WaveRange = [number, number];
export type WaveZoom = 'full' | 'black' | 'white';
export const WAVE_ZOOMS: Record<WaveZoom, WaveRange> = { full: [WAVE_MIN, WAVE_MAX], black: [-0.05, 0.15], white: [0.85, 1.1] };
export const WAVE_ZOOM_LABELS: Record<WaveZoom, string> = { full: 'voll (−7 … 110 %)', black: 'Schwarz-Lupe (−5 … 15 %)', white: 'Lichter-Lupe (85 … 110 %)' };

/** Channels of the multi-trace waveforms, with the instance index the renderer uses. */
export interface WaveChannels { y?: boolean; r?: boolean; g?: boolean; b?: boolean }
const CHANNELS: Partial<Record<ScopeType, { name: string; key: keyof WaveChannels }[]>> = {
  parade: [{ name: 'R', key: 'r' }, { name: 'G', key: 'g' }, { name: 'B', key: 'b' }],
  'wf-rgb': [{ name: 'R', key: 'r' }, { name: 'G', key: 'g' }, { name: 'B', key: 'b' }],
  yrgb: [{ name: 'Y', key: 'y' }, { name: 'R', key: 'r' }, { name: 'G', key: 'g' }, { name: 'B', key: 'b' }],
};
export const channelsOf = (scope: ScopeType) => CHANNELS[scope] ?? [];
/**
 * Section index per trace instance (−1 = hidden) and the number of sections for a scope.
 * Parade/YRGB close up when channels are hidden; the RGB overlay keeps one section.
 */
export function channelLayout(scope: ScopeType, ch: WaveChannels = {}): { sec: number[]; n: number; names: string[] } {
  const list = CHANNELS[scope];
  if (!list) {
    const n = sections(scope);
    return { sec: [0, 1, 2, 3].map((i) => (n === 1 ? 0 : i)), n, names: scope === 'ycbcr' ? ['Y', 'Cb', 'Cr'] : [] };
  }
  const vis = list.map((c) => ch[c.key] !== false);
  if (!vis.some(Boolean)) vis.fill(true);
  if (scope === 'wf-rgb') return { sec: [...vis.map((v) => (v ? 0 : -1)), -1], n: 1, names: [] };
  let k = 0;
  const sec = vis.map((v) => (v ? k++ : -1));
  while (sec.length < 4) sec.push(-1);
  return { sec, n: k, names: list.filter((_, i) => vis[i]).map((c) => c.name) };
}

export function waveTicks(unit: Unit, transfer: Transfer, lw = 1000, range: WaveRange = WAVE_ZOOMS.full): { level: number; label: string; major: boolean }[] {
  const [lo, hi] = range, inRange = (t: { level: number }) => t.level >= lo - 1e-9 && t.level <= hi + 1e-9;
  if (hi - lo < 0.5) {
    // zoomed: fine ticks
    if (unit === 'nits') {
      const cands = isLog(transfer) ? [0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.18, 0.5, 1, 2, 5, 10, 20].map((x) => ({ level: sceneToSignal(x, transfer), label: String(Math.round(x * 1000) / 10), major: x === 0 || x === 1 }))
        : [0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 203, 500, 1000, 2000, 4000, 10000].map((n) => ({ level: nitsToSignal(n, transfer, lw), label: n >= 1000 ? `${n / 1000}k` : String(n), major: n === 0 || n === 100 || n === 203 }));
      return cands.filter(inRange);
    }
    const out = [];
    for (let k = Math.ceil(lo * 100 - 1e-9); k <= Math.floor(hi * 100 + 1e-9); k++) {
      const level = k / 100;
      out.push({ level, label: unit === 'percent' ? String(k) : String(Math.round(codeValue(level, unit === 'bit8' ? 8 : 10))), major: k % 5 === 0 });
    }
    return out;
  }
  if (unit === 'nits' && isLog(transfer)) {
    // scene-referred: reflectance in %, in stops around the 18 % grey card
    return [0, 0.0225, 0.045, 0.09, 0.18, 0.36, 0.72, 1.44, 2.88, 5.76, 11.52]
      .map((x) => ({ level: sceneToSignal(x, transfer), label: String(Math.round(x * 1000) / 10), major: x === 0 || x === 0.18 || x === 1.44 }))
      .filter(inRange);
  }
  if (unit === 'nits') {
    const list = transfer === 'pq' ? [0, 1, 10, 100, 203, 400, 1000, 2000, 4000, 10000]
      : transfer === 'hlg' ? [0, 1, 10, 50, 100, 203, 500, 1000] : [0, 1, 5, 10, 20, 50, 100];
    const hlg = transfer === 'hlg' ? [...new Set([...list.filter((n) => n < lw), lw])] : list;
    return hlg.map((n) => ({ level: nitsToSignal(n, transfer, lw), label: n >= 1000 ? `${n / 1000}k` : String(n), major: [0, 100, 203, 1000, 10000, transfer === 'hlg' ? lw : 0].includes(n) }));
  }
  const out = [];
  for (let i = 0; i <= 10; i++) {
    const level = i / 10;
    const label = unit === 'percent' ? String(i * 10) : String(Math.round(codeValue(level, unit === 'bit8' ? 8 : 10)));
    out.push({ level, label, major: i === 0 || i === 10 || i === 5 });
  }
  return out;
}

export const waveY = (r: Rect, level: number, range: WaveRange = WAVE_ZOOMS.full) => r.y + r.h - ((level - range[0]) / (range[1] - range[0])) * r.h;
/** Signal level at a y position (inverse of waveY). */
export const waveLevel = (r: Rect, y: number, range: WaveRange = WAVE_ZOOMS.full) => range[0] + ((r.y + r.h - y) / r.h) * (range[1] - range[0]);

/** Options of the waveform graticule. */
export interface WaveOpts { lw?: number; r103?: boolean; marks?: boolean; range?: WaveRange; channels?: WaveChannels; names?: boolean }

export interface WaveMark { level: number; label: string; color: string }

/**
 * Reference marks: BT.2408-8 Tab. 1 p9 for HDR (reference white 75 % HLG / 58 % PQ,
 * 18 % grey card 38 %; "A 75%-HLG or 58%-PQ marker on a waveform monitor … will help"),
 * the 18 % grey card of a camera log curve, and the EBU R 103 v3.0 preferred range
 * −5 %/105 % (Tab. 1 p5: 10 bit 20–984) when enabled.
 */
export function waveMarks(transfer: Transfer, o: { r103?: boolean; marks?: boolean } = {}): WaveMark[] {
  const out: WaveMark[] = [];
  if (o.marks !== false) {
    if (transfer === 'hlg') out.push({ level: 0.75, label: 'HLG 75 % Ref.-Weiß', color: 'rgba(255, 214, 90, 0.9)' });
    if (transfer === 'pq') out.push({ level: 0.58, label: 'PQ 58 % Ref.-Weiß', color: 'rgba(255, 214, 90, 0.9)' });
    if (transfer === 'hlg' || transfer === 'pq') out.push({ level: 0.38, label: 'Graukarte 38 %', color: 'rgba(150, 220, 255, 0.85)' });
    if (isLog(transfer)) out.push({ level: sceneToSignal(0.18, transfer), label: `18 % Grau ${transferLabel(transfer)}`, color: 'rgba(150, 220, 255, 0.85)' });
  }
  if (o.r103) {
    out.push({ level: 1.05, label: 'R 103 +105 %', color: 'rgba(255, 90, 90, 0.9)' });
    out.push({ level: -0.05, label: 'R 103 −5 %', color: 'rgba(255, 90, 90, 0.9)' });
  }
  return out;
}

export function drawWaveGraticule(ctx: CanvasRenderingContext2D, scope: ScopeType, r: Rect, unit: Unit, transfer: Transfer, o: WaveOpts = {}) {
  const range = o.range ?? WAVE_ZOOMS.full;
  ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;
  let lastLabel = Infinity;
  for (const t of waveTicks(unit, transfer, o.lw, range)) {
    const y = Math.round(waveY(r, t.level, range)) + 0.5;
    ctx.strokeStyle = t.major ? GRID : GRID_DIM;
    ctx.setLineDash(t.major ? [] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    // ticks run bottom → top; skip labels that would collide with the previous one
    if (lastLabel - y >= 11) { ctx.fillStyle = LABEL; ctx.fillText(t.label, r.x - 5, y); lastLabel = y; }
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  for (const m of waveMarks(transfer, o)) {
    if (m.level < range[0] || m.level > range[1]) continue;
    const y = Math.round(waveY(r, m.level, range)) + 0.5;
    ctx.strokeStyle = m.color; ctx.setLineDash([8, 3]);
    ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    ctx.fillStyle = m.color; ctx.fillText(m.label, r.x + r.w * 0.55, m.level < 0 ? y + 11 : y - 1);
  }
  ctx.setLineDash([]);
  const { n, names } = channelLayout(scope, o.channels);
  ctx.strokeStyle = GRID;
  for (let i = 1; i < n; i++) {
    const x = Math.round(r.x + (r.w * i) / n) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
  }
  if (o.names === false) return;
  const colors: Record<string, string> = { R: '#ff6b6b', G: '#6bff7a', B: '#7b9bff', Y: '#ddd', Cb: '#7b9bff', Cr: '#ff6b6b' };
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  names.forEach((nm, i) => { ctx.fillStyle = colors[nm]; ctx.fillText(nm, r.x + (r.w * i) / n + 4, r.y + 2); });
  if (range !== WAVE_ZOOMS.full && (range[0] !== WAVE_MIN || range[1] !== WAVE_MAX)) {
    ctx.fillStyle = 'rgba(255, 184, 64, 0.95)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(`LUPE ${Math.round(range[0] * 100)} … ${Math.round(range[1] * 100)} %`, r.x + 4, r.y + r.h - 2);
    ctx.textBaseline = 'top';
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'right';
  const nits = isLog(transfer) ? `Szene %` : `cd/m² ${transferLabel(transfer)}${transfer === 'hlg' && (o.lw ?? 1000) !== 1000 ? ` ${o.lw}` : ''}`;
  ctx.fillText(unit === 'nits' ? nits : unit === 'percent' ? '%' : unit === 'bit8' ? '8 bit' : '10 bit', r.x + r.w - 4, r.y + 2);
}

/** Skin-tone luma window of the skin waveform. */
export function drawSkinRange(ctx: CanvasRenderingContext2D, r: Rect, skin: { lo: number; hi: number; tol: number }, range: WaveRange = WAVE_ZOOMS.full) {
  const y0 = waveY(r, skin.hi, range), y1 = waveY(r, skin.lo, range);
  ctx.fillStyle = 'rgba(255, 170, 110, 0.07)'; ctx.fillRect(r.x, y0, r.w, y1 - y0);
  ctx.strokeStyle = 'rgba(255, 170, 110, 0.8)'; ctx.setLineDash([6, 4]);
  for (const y of [y0, y1]) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.font = FONT; ctx.fillStyle = 'rgba(255, 190, 140, 0.95)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(`Hautton ${Math.round(skin.lo * 100)}–${Math.round(skin.hi * 100)} %  ±${skin.tol}°`, r.x + 4, y0 - 2);
}

export function drawWaveProbe(ctx: CanvasRenderingContext2D, scope: ScopeType, r: Rect, src: Source, rgb: [number, number, number], o: WaveOpts = {}) {
  if (!src.probe) return;
  const range = o.range ?? WAVE_ZOOMS.full;
  const { n, sec } = channelLayout(scope, o.channels);
  const fx = src.probe.x / src.width;
  const { y, cb, cr } = ycbcr(rgb[0], rgb[1], rgb[2], src.colorspace);
  const vals: [number, string][] = scope === 'wf-luma' || scope === 'wf-color' || scope === 'wf-skin' ? [[y, '#fff']]
    : scope === 'wf-rgb' || scope === 'parade' ? [[rgb[0], '#ff6b6b'], [rgb[1], '#6bff7a'], [rgb[2], '#7b9bff']]
      : scope === 'yrgb' ? [[y, '#fff'], [rgb[0], '#ff6b6b'], [rgb[1], '#6bff7a'], [rgb[2], '#7b9bff']]
        : [[y, '#fff'], [cb + 0.5, '#7b9bff'], [cr + 0.5, '#ff6b6b']];
  ctx.strokeStyle = 'rgba(0, 220, 255, 0.55)';
  ctx.setLineDash([4, 3]);
  for (let i = 0; i < n; i++) {
    const x = Math.round(r.x + (r.w * (i + fx)) / n) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
  }
  ctx.setLineDash([]);
  vals.forEach(([v, c], i) => {
    const k = sec[i] ?? i;
    if (k < 0) return;
    const x = r.x + (r.w * ((n === 1 ? 0 : k) + fx)) / n, yy = waveY(r, v, range);
    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 7, yy); ctx.lineTo(x + 7, yy); ctx.stroke();
  });
  ctx.lineWidth = 1;
}

export function vectorPoint(r: Rect, cb: number, cr: number, zoom: number) {
  const R = r.w / 2;
  return [r.x + R + cb * 2 * 0.9 * zoom * R, r.y + R - cr * 2 * 0.9 * zoom * R] as const;
}

export interface BarTargetSet { t100: { label: string; cb: number; cr: number }[]; t75: { label: string; cb: number; cr: number }[]; label: string }

export function drawVectorGraticule(ctx: CanvasRenderingContext2D, r: Rect, cs: Colorspace, zoom: number, skinTol = 0, targets?: BarTargetSet) {
  const R = r.w / 2, cx = r.x + R, cy = r.y + R;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.lineWidth = 1; ctx.strokeStyle = GRID;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = GRID_DIM;
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  for (let a = 0; a < 360; a += 10) {
    const rad = (a * Math.PI) / 180, l = a % 30 === 0 ? 0.06 : 0.03;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * R * 0.9, cy - Math.sin(rad) * R * 0.9);
    ctx.lineTo(cx + Math.cos(rad) * R * (0.9 - l), cy - Math.sin(rad) * R * (0.9 - l));
    ctx.stroke();
  }
  // skin-tone line (and the tolerance wedge used by the skin-tone waveform)
  const s = (SKIN_LINE_DEG * Math.PI) / 180;
  if (skinTol > 0) {
    const t = (skinTol * Math.PI) / 180;
    ctx.fillStyle = 'rgba(255, 170, 120, 0.08)';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 0.9, -(s + t), -(s - t)); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 170, 120, 0.5)'; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(s) * R, cy - Math.sin(s) * R); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const t100 = targets?.t100 ?? barTargets(cs, 1), t75 = targets?.t75 ?? barTargets(cs, 0.75);
  const box = Math.max(5, R * 0.05);
  t75.forEach((t, i) => {
    const [x, y] = vectorPoint(r, t.cb, t.cr, zoom);
    const ang = Math.atan2(t.cr, t.cb);
    if (!edgeMarker(ctx, r, x, y, `${t.label} 75`, GRID)) {
      ctx.strokeStyle = GRID;
      ctx.strokeRect(x - box, y - box, box * 2, box * 2);
      // label on the inner side of the 75 % box so it never leaves the plot
      ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.label, x - Math.cos(ang) * box * 2.6, y + Math.sin(ang) * box * 2.6);
    }
    const [x1, y1] = vectorPoint(r, t100[i].cb, t100[i].cr, zoom);
    if (zoom === 1) { ctx.strokeStyle = GRID; ctx.beginPath(); ctx.arc(x1, y1, box * 0.6, 0, Math.PI * 2); ctx.stroke(); }
  });
  ctx.restore();
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(targets?.label ?? `Rec.${cs}`, r.x + 2, r.y + 2);
  if (zoom !== 1) {
    // unmistakable zoom badge: targets outside the view sit as arrows on the rim
    const label = `×${zoom} ZOOM`;
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(255, 184, 64, 0.9)'; ctx.fillRect(r.x + r.w - w - 2, r.y + 2, w, 16);
    ctx.fillStyle = '#111'; ctx.textAlign = 'right'; ctx.fillText(label, r.x + r.w - 7, r.y + 4);
    ctx.font = FONT;
  }
}

/** Target outside the (zoomed) circle: triangle on the rim pointing to it, with label. Returns true if drawn. */
function edgeMarker(ctx: CanvasRenderingContext2D, r: Rect, x: number, y: number, label: string, color: string) {
  const R = r.w / 2, cx = r.x + R, cy = r.y + R;
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  if (d <= R * 0.93) return false;
  const ux = dx / d, uy = dy / d, px = cx + ux * R * 0.9, py = cy + uy * R * 0.9, s = 6;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(px + ux * s, py + uy * s);
  ctx.lineTo(px - uy * s * 0.7, py + ux * s * 0.7);
  ctx.lineTo(px + uy * s * 0.7, py - ux * s * 0.7);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, px - ux * 16, py - uy * 12);
  return true;
}

export interface VectorTarget { name: string; rgb: [number, number, number] }

/**
 * Gamut boundaries (hexagon through 100 % primaries/secondaries of each gamut, expressed
 * in the source's encoding) and user colour-match targets.
 */
export function drawVectorExtras(ctx: CanvasRenderingContext2D, r: Rect, cs: Colorspace, zoom: number, gamuts: ('709' | 'p3' | '2020')[], targets: VectorTarget[], transfer: Transfer, srcGamut: GamutId = cs) {
  const src = GAMUTS[srcGamut];
  const enc = (v: number) => {
    const a = Math.abs(v), sgn = Math.sign(v);
    // log curves: scene-linear 1.0 = diffuse white
    return sgn * (transfer === 'pq' ? pqEncode(a * 203) : transfer === 'hlg' ? hlgFromNits(a * 203) : isLog(transfer) ? sceneToSignal(a, transfer) : Math.pow(a, 1 / 2.4));
  };
  const colors: Record<string, string> = { '709': 'rgba(255,255,255,0.8)', p3: 'rgba(255,200,60,0.85)', '2020': 'rgba(60,220,255,0.85)' };
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.font = FONT;
  gamuts.forEach((g, gi) => {
    const m = gamutConvert(GAMUTS[g], src);
    const corners: [number, number, number][] = [[1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [1, 0, 1]];
    ctx.strokeStyle = colors[g]; ctx.setLineDash(g === '709' ? [] : [5, 3]); ctx.lineWidth = 1.2;
    ctx.beginPath();
    corners.forEach((c, i) => {
      const lin = [0, 1, 2].map((k) => m[k * 3] * c[0] + m[k * 3 + 1] * c[1] + m[k * 3 + 2] * c[2]);
      const [R_, G_, B_] = lin.map(enc);
      const { cb, cr } = ycbcr(R_, G_, B_, cs);
      const [x, y] = vectorPoint(r, cb, cr, zoom);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = colors[g]; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(GAMUTS[g].name, r.x + r.w - 4, r.y + r.h - 4 - gi * 13);
  });
  ctx.restore();
  for (const t of targets) {
    const { cb, cr } = ycbcr(t.rgb[0], t.rgb[1], t.rgb[2], cs);
    const [x, y] = vectorPoint(r, cb, cr, zoom);
    const css = `rgb(${t.rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
    if (edgeMarker(ctx, r, x, y, t.name, css)) continue;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = css; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(t.name, x + 10, y);
  }
}

/** Plot position of a chromaticity; xy is converted to u′v′ when uv is set. */
export function cieToPlot(r: Rect, x: number, y: number, uv = false) {
  const v = uv ? CIE_VIEW_UV : CIE_VIEW;
  if (uv) [x, y] = xyToUv([x, y]);
  return [r.x + ((x - v.x0) / (v.x1 - v.x0)) * r.w, r.y + r.h - ((y - v.y0) / (v.y1 - v.y0)) * r.h] as const;
}

export function drawCieGraticule(ctx: CanvasRenderingContext2D, r: Rect, cs: Colorspace, o: { uv?: boolean; gamut?: GamutId } = {}) {
  const uv = !!o.uv;
  ctx.lineWidth = 1; ctx.font = FONT;
  ctx.strokeStyle = GRID_DIM; ctx.fillStyle = LABEL;
  const every = r.w < 320 ? 2 : 1;
  const view = uv ? CIE_VIEW_UV : CIE_VIEW;
  const grid = (a: number, b: number) => {
    const [x0, y0] = [r.x + ((a - view.x0) / (view.x1 - view.x0)) * r.w, r.y + r.h - ((b - view.y0) / (view.y1 - view.y0)) * r.h];
    return [x0, y0] as const;
  };
  for (let i = 0; i <= (uv ? 6 : 8); i++) {
    const v = i / 10;
    const [x] = grid(v, 0), [, y] = grid(0, v);
    ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke();
    if (i % every) continue;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(v.toFixed(1), x, r.y + r.h + 3);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(v.toFixed(1), r.x - 4, y);
  }
  ctx.beginPath();
  SPECTRAL_LOCUS.forEach(([, x, y], i) => { const [px, py] = cieToPlot(r, x, y, uv); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; ctx.fill();
  ctx.strokeStyle = 'rgba(230, 230, 230, 0.7)'; ctx.stroke();
  ctx.fillStyle = 'rgba(230, 230, 230, 0.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const [nm, x, y] of SPECTRAL_LOCUS) {
    if (![460, 480, 500, 520, 540, 560, 580, 600, 620].includes(nm) || (r.w < 320 && nm % 40 !== 20 && nm !== 460)) continue;
    const [px, py] = cieToPlot(r, x, y, uv);
    ctx.fillText(String(nm), px + (x < 0.3 ? -26 : 5), py);
  }
  const src = o.gamut ?? cs;
  const tri: [GamutId, string][] = [['709', 'rgba(255,255,255,0.75)'], ['p3', 'rgba(255,200,60,0.7)'], ['2020', 'rgba(60,220,255,0.7)']];
  // the source primaries as a fourth triangle when they are none of the three (601, camera gamuts, ACES)
  if (!tri.some(([k]) => k === src)) tri.push([src, 'rgba(255,120,200,0.8)']);
  tri.forEach(([k, c], i) => {
    const g = GAMUTS[k];
    ctx.strokeStyle = c; ctx.setLineDash(k === src ? [] : [4, 3]);
    ctx.beginPath();
    [g.r, g.g, g.b].forEach(([x, y], j) => { const [px, py] = cieToPlot(r, x, y, uv); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath();
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    ctx.beginPath(); [g.r, g.g, g.b].forEach(([x, y], j) => { const [px, py] = cieToPlot(r, x, y, uv); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.closePath(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = c; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    if (uv) { ctx.textBaseline = 'bottom'; ctx.fillText(g.name, r.x + r.w - 4, r.y + r.h - 4 - (tri.length - 1 - i) * 13); } else ctx.fillText(g.name, r.x + r.w - 4, r.y + 4 + i * 13);
  });
  ctx.setLineDash([]);
  const [wx, wy] = cieToPlot(r, 0.3127, 0.329, uv);
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.stroke();
  const sw = GAMUTS[src].white;
  if (Math.abs(sw[0] - 0.3127) > 1e-4 || Math.abs(sw[1] - 0.329) > 1e-4) {
    const [ax, ay] = cieToPlot(r, sw[0], sw[1], uv);
    ctx.strokeStyle = 'rgba(255,120,200,0.9)'; ctx.beginPath(); ctx.arc(ax, ay, 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = uv ? 'bottom' : 'top';
  ctx.fillText(uv ? 'CIE 1976 u′v′' : 'CIE 1931 xy', r.x + 4, uv ? r.y + r.h - 4 : r.y + 4);
}

export function drawHistogram(ctx: CanvasRenderingContext2D, r: Rect, src: Source, mode: 'rgb' | 'luma' | 'split', log: boolean) {
  const st = src.stats;
  ctx.strokeStyle = GRID_DIM; ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = Math.round(r.x + (r.w * i) / 10) + 0.5;
    ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
  }
  ctx.fillStyle = LABEL; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i <= 10; i += 2) ctx.fillText(String(i * 10), r.x + (r.w * i) / 10, r.y + r.h + 4);
  if (!st) return;
  const chans: [number, string][] = mode === 'luma' ? [[3, 'rgba(235,235,235,0.85)']]
    : [[0, 'rgba(255,70,70,0.75)'], [1, 'rgba(70,255,90,0.75)'], [2, 'rgba(80,120,255,0.8)']];
  const rows = mode === 'split' ? 3 : 1;
  const tf = (v: number) => (log ? Math.log1p(v) : v);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  chans.forEach(([c, col], i) => {
    const h = st.hist[c];
    // ignore the extreme bins for scaling so that clipped areas do not flatten the rest
    let max = 1;
    for (let b = 1; b < 255; b++) max = Math.max(max, tf(h[b]));
    const row = rows === 1 ? 0 : i, rh = r.h / rows, base = r.y + rh * (row + 1);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(r.x, base);
    for (let b = 0; b < 256; b++) ctx.lineTo(r.x + ((b + 0.5) / 256) * r.w, base - Math.min(1, tf(h[b]) / max) * (rh - 2));
    ctx.lineTo(r.x + r.w, base); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  ctx.textAlign = 'left'; ctx.fillStyle = LABEL;
  const clip = (a: number[]) => `${(Math.max(...a) * 100).toFixed(2)} %`;
  ctx.fillText(`Clip ▼ ${clip(st.clipLow)}   ▲ ${clip(st.clipHigh)}${log ? '   log' : ''}`, r.x + 4, r.y + 2);
}

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;

export function probeLines(src: Source, rgb: [number, number, number], unit: Unit): string[] {
  const { y, cb, cr } = ycbcr(rgb[0], rgb[1], rgb[2], src.colorspace);
  const bits = unit === 'bit8' ? 8 : 10;
  const fmt = (v: number) => (unit === 'percent' || unit === 'nits' ? (v * 100).toFixed(1) : Math.round(codeValue(v, bits)).toString());
  const lines = [
    `x ${src.probe!.x}  y ${src.probe!.y}`,
    `R ${fmt(rgb[0])}  G ${fmt(rgb[1])}  B ${fmt(rgb[2])}`,
    `Y' ${pct(y)}  Cb ${cb >= 0 ? '+' : ''}${(cb * 100).toFixed(1)}  Cr ${cr >= 0 ? '+' : ''}${(cr * 100).toFixed(1)}`,
  ];
  if (!isGamma(src.transfer) || unit === 'nits') lines.push(`≈ ${levelText(y, src.transfer, src.hlgLw)}`);
  return lines;
}

export function drawTextBox(ctx: CanvasRenderingContext2D, x: number, y: number, lines: string[], align: 'left' | 'right' = 'left') {
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12, h = lines.length * 15 + 8;
  const bx = align === 'right' ? x - w : x;
  ctx.fillStyle = 'rgba(8, 9, 11, 0.78)'; ctx.fillRect(bx, y, w, h);
  ctx.fillStyle = '#e8e8e8'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 6, y + 5 + i * 15));
}

export function statsLines(src: Source, displayFps: number): string[] {
  const st = src.stats, info = src.info;
  const lines = [
    src.name,
    `Status     ${src.status}${src.message ? ` – ${src.message}` : ''}`,
    `Analyse    ${src.width}×${src.height}  ${src.depth} bit`,
  ];
  if (info) {
    lines.push(`Quelle     ${info.sourceWidth}×${info.sourceHeight}  ${info.codec ?? ''} ${info.pixFmt ?? ''}`);
    lines.push(`Metadaten  ${info.matrix}/${info.primaries}/${info.transfer}  ${info.range}`);
  }
  lines.push(`Auswertung Rec.${src.colorspace}  ${transferLabel(src.transfer)}${src.transfer === 'hlg' ? ` (Lw ${src.hlgLw})` : ''}  ${GAMUTS[src.gamut].name}`);
  lines.push(`Frames     ${src.fps} fps Eingang  ${displayFps} fps Anzeige${src.dropped ? `  ${src.dropped} verworfen` : ''}`);
  if (st) {
    const n = (v: number) => (isGamma(src.transfer) ? '' : `  (${levelText(v, src.transfer, src.hlgLw)})`);
    lines.push('');
    lines.push(`Y' min     ${pct(st.yMin)}${n(st.yMin)}`);
    lines.push(`Y' max     ${pct(st.yMax)}${n(st.yMax)}`);
    lines.push(`Y' Mittel  ${pct(st.yAvg)}${n(st.yAvg)}`);
    lines.push(`Clip ▲ RGB ${st.clipHigh.map((v) => (v * 100).toFixed(2)).join(' / ')} %`);
    lines.push(`Clip ▼ RGB ${st.clipLow.map((v) => (v * 100).toFixed(2)).join(' / ')} %`);
  }
  return lines;
}
