// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light scopes (#11): dock panels for the Opple Light Master. The meter measures ONE value per
// query at one place (6 or 8 filter channels) – there is no image. These views show that value
// the way scopes show a picture: chromaticity with Planckian locus and isotherms, a
// "vectorscope of the light" around a target white, the filter channels, the course over time
// and a measuring grid built from points taken one after another.
// Maths and sources: lightScience.ts, docs/research/opple-light-master.md.

import { SPECTRAL_LOCUS } from '../color';
import { cctDuv } from '../calib/colorimetry';
import { FONT, GRID, GRID_DIM, LABEL } from '../graticule';
import type { Reading } from './photometry';
import { filterBands, peakOf, wavelengthAt } from './spectrum';
import {
  cellKey, compareLights, displayColour, deltaUvPrime, gridStats, isothermXy, lightVector, miredShift, planckXy, seriesStats, suggestGels, xyToUvPrime, type XY,
} from './lightScience';
import { lightStore, type LightStore } from './store';

export type LightScope = 'light-cie' | 'light-vector' | 'light-bands' | 'light-trend' | 'light-map' | 'light-spectrum' | 'light-swatch';
/** order of the light layout (3 per row); 'light-bands' stays available in the scope menu */
export const LIGHT_SCOPES: LightScope[] = ['light-cie', 'light-vector', 'light-swatch', 'light-spectrum', 'light-trend', 'light-map'];
export const LIGHT_LABELS: Record<LightScope, string> = {
  'light-cie': 'Licht: Farbort (CIE)', 'light-vector': 'Licht: Vectorscope', 'light-bands': 'Licht: Filterkanäle',
  'light-trend': 'Licht: Zeitverlauf', 'light-map': 'Licht: Messfeld', 'light-spectrum': 'Licht: Wellenlängen', 'light-swatch': 'Licht: Farbfläche',
};
export const isLight = (s: string): s is LightScope => s.startsWith('light-');

export type LightTarget = 'ref' | 'p3200' | 'p4300' | 'p5600' | 'p6500' | 'd65';
export interface LightPanelOptions {
  /** '' = all devices */
  device: string;
  diagram: '1931' | '1976';
  zoom: 'planck' | 'full';
  target: LightTarget;
  /** vector scale: outer ring in s_uv; 0 = automatic */
  scale: number;
  trend: 'all' | 'lux' | 'cct' | 'duv';
  /** seconds shown in the time course */
  window: number;
  map: 'lux' | 'duv' | 'cct';
  bands: 'abs' | 'ref';
  /** trail length (readings) */
  trail: number;
}
export const DEFAULT_LIGHT: LightPanelOptions = { device: '', diagram: '1976', zoom: 'planck', target: 'p5600', scale: 0, trend: 'all', window: 120, map: 'lux', bands: 'abs', trail: 60 };
export const lightOpts = (o?: Partial<LightPanelOptions>): LightPanelOptions => ({ ...DEFAULT_LIGHT, ...o });

export const TARGET_LABELS: Record<LightTarget, string> = {
  ref: 'Referenzpunkt (Seitenleiste)', p3200: '3200 K Planck', p4300: '4300 K Planck', p5600: '5600 K Planck', p6500: '6500 K Planck', d65: 'D65',
};
const D65: XY = [0.3127, 0.329];

/** Colours of up to four devices (trace green first, like the other scopes). */
const DEVICE_COLOURS = ['#8cff9e', '#00dcff', '#ffb44a', '#ff7ad9'];
const PROBE = '#00dcff';
const REF = '#ffffff';

const de = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',').replace('-', '−') : '–');
const sgn = (v: number, d: number) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace('.', ',') : '–');

/** Redraw key: store version, options, size; the time course also moves with the clock. */
export function lightSignature(scope: LightScope, o: Partial<LightPanelOptions> | undefined, w: number, h: number) {
  const s = lightStore();
  return `L|${scope}|${s.version}|${JSON.stringify(o ?? {})}|${w}x${h}${scope === 'light-trend' ? `|${Math.floor(Date.now() / 1000)}` : ''}`;
}

function deviceColour(s: LightStore, key: string | undefined) {
  const keys = [...new Set([...s.known.map((k) => k.key), ...s.history.map((r) => r.device ?? '')])];
  return DEVICE_COLOURS[Math.max(0, keys.indexOf(key ?? '')) % DEVICE_COLOURS.length];
}

function readingsOf(s: LightStore, o: LightPanelOptions) {
  return o.device ? s.history.filter((r) => r.device === o.device) : s.history;
}

export function targetXy(s: LightStore, t: LightTarget): { xy: XY; name: string } {
  if (t === 'ref') { const p = s.point(s.opts.ref); if (p) return { xy: [p.reading.x, p.reading.y], name: `Referenz „${p.label}“` }; t = 'p5600'; }
  if (t === 'd65') return { xy: D65, name: 'D65' };
  const K = Number(t.slice(1));
  return { xy: planckXy(K), name: `${K} K Planck` };
}

function message(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, sub = '') {
  ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 - (sub ? 8 : 0));
  if (sub) { ctx.font = '11px system-ui'; ctx.fillText(sub, w / 2, h / 2 + 10); }
}

function textBox(ctx: CanvasRenderingContext2D, x: number, y: number, lines: string[], align: 'left' | 'right' = 'left') {
  ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = align;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10, hh = lines.length * 13 + 6;
  const x0 = align === 'left' ? x : x - w;
  ctx.fillStyle = 'rgba(8, 9, 11, 0.72)'; ctx.fillRect(x0, y, w, hh);
  ctx.fillStyle = LABEL;
  lines.forEach((l, i) => ctx.fillText(l, align === 'left' ? x + 5 : x - 5, y + 4 + i * 13));
}

export function drawLightPanel(ctx: CanvasRenderingContext2D, scope: LightScope, po: Partial<LightPanelOptions> | undefined, w: number, h: number) {
  const s = lightStore(), o = lightOpts(po);
  ctx.save();
  ctx.lineWidth = 1; ctx.font = FONT;
  if (scope === 'light-map') drawMap(ctx, s, o, w, h);
  else {
    const list = readingsOf(s, o);
    if (!list.length) message(ctx, w, h, s.connected.length ? 'Warte auf Messwerte …' : 'Kein Light Master verbunden', 'Seitenleiste → Lichtmesser (Opple) → Gerät suchen');
    else if (scope === 'light-cie') drawCie(ctx, s, o, list, w, h);
    else if (scope === 'light-vector') drawVector(ctx, s, o, list, w, h);
    else if (scope === 'light-bands') drawBands(ctx, s, o, list, w, h);
    else if (scope === 'light-spectrum') drawSpectrum(ctx, s, o, list, w, h);
    else if (scope === 'light-swatch') drawSwatch(ctx, s, list, w, h);
    else drawTrend(ctx, s, o, list, w, h);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- chromaticity diagram

interface View { x0: number; x1: number; y0: number; y1: number }
function fitView(v: View, w: number, h: number, pad = { l: 40, r: 10, t: 10, b: 22 }) {
  const aw = w - pad.l - pad.r, ah = h - pad.t - pad.b;
  const k = Math.min(aw / (v.x1 - v.x0), ah / (v.y1 - v.y0));
  const pw = k * (v.x1 - v.x0), ph = k * (v.y1 - v.y0);
  const ox = pad.l + (aw - pw) / 2, oy = pad.t + (ah - ph) / 2;
  return { k, ox, oy, pw, ph, map: (a: number, b: number): [number, number] => [ox + (a - v.x0) * k, oy + ph - (b - v.y0) * k] };
}

function drawCie(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], w: number, h: number) {
  const uv = o.diagram === '1976';
  const conv = (xy: XY): [number, number] => (uv ? xyToUvPrime(xy[0], xy[1]) : xy);
  const view: View = o.zoom === 'full'
    ? (uv ? { x0: -0.02, x1: 0.63, y0: -0.02, y1: 0.61 } : { x0: -0.03, x1: 0.78, y0: -0.03, y1: 0.87 })
    : (uv ? { x0: 0.15, x1: 0.36, y0: 0.40, y1: 0.57 } : { x0: 0.24, x1: 0.60, y0: 0.24, y1: 0.48 });
  const f = fitView(view, w, h);
  const P = (xy: XY) => f.map(...conv(xy));
  ctx.save(); ctx.beginPath(); ctx.rect(f.ox, f.oy, f.pw, f.ph); ctx.clip();
  // grid
  const step = o.zoom === 'full' ? 0.1 : 0.02;
  ctx.strokeStyle = GRID_DIM;
  for (let a = Math.ceil(view.x0 / step) * step; a <= view.x1; a += step) { const [x] = f.map(a, 0); ctx.beginPath(); ctx.moveTo(x, f.oy); ctx.lineTo(x, f.oy + f.ph); ctx.stroke(); }
  for (let b = Math.ceil(view.y0 / step) * step; b <= view.y1; b += step) { const [, y] = f.map(0, b); ctx.beginPath(); ctx.moveTo(f.ox, y); ctx.lineTo(f.ox + f.pw, y); ctx.stroke(); }
  // spectral locus
  ctx.beginPath();
  SPECTRAL_LOCUS.forEach(([, x, y], i) => { const [px, py] = P([x, y]); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,230,230,0.6)'; ctx.stroke();
  // Duv bands ±0.01, ±0.02 (dotted) and the Planckian locus
  const temps: number[] = [];
  for (let T = 1500; T <= 15000; T *= 1.03) temps.push(T);
  for (const d of [-0.02, -0.01, 0.01, 0.02]) {
    ctx.strokeStyle = GRID_DIM; ctx.setLineDash([2, 3]); ctx.beginPath();
    temps.forEach((T, i) => { const [px, py] = P(isothermXy(T, d)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = GRID; ctx.lineWidth = 1.5; ctx.beginPath();
  temps.forEach((T, i) => { const [px, py] = P(planckXy(T)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.stroke(); ctx.lineWidth = 1;
  // isotherms with labels
  const iso = o.zoom === 'full' ? [2000, 3000, 4000, 6500, 10000] : [2000, 2500, 3000, 3200, 4000, 5000, 5600, 6500, 8000, 10000];
  ctx.fillStyle = LABEL; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let prev: [number, number] | null = null;
  for (const T of iso) {
    const [ax, ay] = P(isothermXy(T, -0.02)), [bx, by] = P(isothermXy(T, 0.02));
    ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    if (prev && Math.hypot(ax - prev[0], ay - prev[1]) < 26) continue;
    ctx.fillText(`${T >= 10000 ? `${T / 1000}k` : T}`, ax, ay + 2);
    prev = [ax, ay];
  }
  // D65 and the chosen target
  const tgt = targetXy(s, o.target);
  const [dx, dy] = P(D65);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.stroke();
  drawPoints(ctx, s, o, list, P);
  ctx.restore();
  // axes labels
  ctx.fillStyle = LABEL; ctx.font = FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let a = Math.ceil(view.x0 / step) * step; a <= view.x1 + 1e-9; a += step * (o.zoom === 'full' ? 2 : 2)) { const [x] = f.map(a, 0); ctx.fillText(a.toFixed(2).replace(/0$/, ''), x, f.oy + f.ph + 3); }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let b = Math.ceil(view.y0 / step) * step; b <= view.y1 + 1e-9; b += step * 2) { const [, y] = f.map(0, b); ctx.fillText(b.toFixed(2).replace(/0$/, ''), f.ox - 4, y); }
  const last = list[list.length - 1];
  const [u, v] = xyToUvPrime(last.x, last.y);
  const cd = cctDuv([last.x, last.y]);
  textBox(ctx, f.ox + 4, f.oy + 4, [
    uv ? 'CIE 1976 u′v′' : 'CIE 1931 xy',
    `${s.label(last.device ?? '')}`,
    `x ${de(last.x, 4)}  y ${de(last.y, 4)}`,
    `u′ ${de(u, 4)}  v′ ${de(v, 4)}`,
    `CCT ${de(cd.cct, 0)} K  Duv ${sgn(cd.duv, 4)}`,
    `Δu′v′ zu ${tgt.name}: ${de(deltaUvPrime([last.x, last.y], tgt.xy), 4)}`,
  ]);
  ctx.fillStyle = 'rgba(230,215,170,0.55)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('Planck-Kurve, Isothermen, Duv ±0,01/±0,02 · Filtersensor: Trendmessung', f.ox + f.pw - 4, f.oy + f.ph - 4);
}

/** Trail per device, current value, captured points and the reference. */
function drawPoints(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], P: (xy: XY) => [number, number]) {
  const byDev = new Map<string, Reading[]>();
  for (const r of list.slice(-o.trail * Math.max(1, s.connected.length))) { const k = r.device ?? ''; if (!byDev.has(k)) byDev.set(k, []); byDev.get(k)!.push(r); }
  for (const [k, rs] of byDev) {
    const col = deviceColour(s, k);
    const tail = rs.slice(-o.trail);
    tail.forEach((r, i) => {
      const [px, py] = P([r.x, r.y]);
      ctx.globalAlpha = 0.15 + 0.6 * (i / tail.length);
      ctx.fillStyle = col; ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;
    const c = tail[tail.length - 1];
    const [px, py] = P([c.x, c.y]);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.moveTo(px - 9, py); ctx.lineTo(px + 9, py); ctx.moveTo(px, py - 9); ctx.lineTo(px, py + 9); ctx.stroke();
    ctx.lineWidth = 1;
  }
  ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const p of s.points) {
    const [px, py] = P([p.reading.x, p.reading.y]);
    const isRef = p.id === s.opts.ref;
    ctx.strokeStyle = isRef ? REF : PROBE; ctx.fillStyle = isRef ? REF : PROBE;
    ctx.beginPath(); ctx.rect(px - 3, py - 3, 6, 6); ctx.stroke();
    ctx.fillText(isRef ? `${p.label} (Ref.)` : p.label, px + 6, py);
  }
}

// ---------------------------------------------------------------- vectorscope of the light

function drawVector(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], w: number, h: number) {
  const tgt = targetXy(s, o.target);
  const [un, vn] = xyToUvPrime(tgt.xy[0], tgt.xy[1]);
  const last = list[list.length - 1];
  const vec = lightVector([last.x, last.y], tgt.xy);
  const maxSat = o.scale || Math.max(0.05, ...list.slice(-o.trail).map((r) => lightVector([r.x, r.y], tgt.xy).sat * 1.25), ...s.points.map((p) => lightVector([p.reading.x, p.reading.y], tgt.xy).sat * 1.15));
  const R = Math.max(20, Math.min(w, h) / 2 - 26), cx = w / 2, cy = h / 2;
  const k = R / (maxSat / 13); // px per Δu′v′
  const P = (xy: XY): [number, number] => { const [u, v] = xyToUvPrime(xy[0], xy[1]); return [cx + (u - un) * k, cy - (v - vn) * k]; };
  // rings in s_uv
  const ringStep = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1].find((x) => maxSat / x <= 5) ?? 1;
  ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  for (let r = ringStep; r <= maxSat + 1e-9; r += ringStep) {
    const rp = (r / 13) * k;
    ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.arc(cx, cy, rp, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(`s ${de(r, 2)}`, cx + rp * 0.707 + 2, cy - rp * 0.707);
  }
  ctx.strokeStyle = GRID; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  // hue ticks every 30°
  for (let a = 0; a < 360; a += 30) {
    const t = (a * Math.PI) / 180;
    ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * (R - 6), cy - Math.sin(t) * (R - 6)); ctx.lineTo(cx + Math.cos(t) * R, cy - Math.sin(t) * R); ctx.stroke();
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  // Planckian locus through the view, with Duv ±0.01 guides
  const temps: number[] = [];
  for (let T = 1500; T <= 20000; T *= 1.02) temps.push(T);
  for (const d of [-0.01, 0.01]) {
    ctx.strokeStyle = GRID_DIM; ctx.setLineDash([2, 3]); ctx.beginPath();
    temps.forEach((T, i) => { const [px, py] = P(isothermXy(T, d)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = GRID; ctx.lineWidth = 1.5; ctx.beginPath();
  temps.forEach((T, i) => { const [px, py] = P(planckXy(T)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
  ctx.stroke(); ctx.lineWidth = 1;
  // isotherm ticks with K labels where they fall inside
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  let lastLabel: [number, number] | null = null;
  for (const T of [2000, 2500, 2700, 3000, 3200, 3500, 4000, 4300, 5000, 5600, 6500, 7500, 10000]) {
    const [ax, ay] = P(isothermXy(T, -0.004)), [bx, by] = P(isothermXy(T, 0.004));
    if (Math.hypot(ax - cx, ay - cy) > R) continue;
    ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    // label only where it does not run into the previous one
    if (lastLabel && Math.hypot(ax - lastLabel[0], ay - lastLabel[1]) < 28) continue;
    ctx.fillText(String(T), ax, ay + 1);
    lastLabel = [ax, ay];
  }
  drawPoints(ctx, s, o, list, P);
  ctx.restore();
  // centre
  ctx.strokeStyle = REF; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
  // direction words at their real angles: along the locus (warmer/cooler) and across it (green/magenta)
  const cd = cctDuv(tgt.xy);
  const Tc = cd.inRange ? cd.cct : 5600;
  const dir = (a: XY, b: XY) => { const [ax, ay] = P(a), [bx, by] = P(b); const l = Math.hypot(bx - ax, by - ay) || 1; return [(bx - ax) / l, (by - ay) / l]; };
  const warm = dir(planckXy(Tc), planckXy(Tc * 0.9)), green = dir(isothermXy(Tc, 0), isothermXy(Tc, 0.01));
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const word = (d: number[], sgnv: number, t: string) => ctx.fillText(t, cx + d[0] * sgnv * (R + 14), cy + d[1] * sgnv * (R + 12));
  word(warm, 1, 'wärmer'); word(warm, -1, 'kälter'); word(green, 1, 'grün'); word(green, -1, 'magenta');
  // read-out
  const c = cctDuv([last.x, last.y]);
  const shift = miredShift(c.cct, cd.cct);
  const gel = Math.abs(shift) >= 5 && o.target !== 'd65' ? suggestGels(c.cct, cd.cct, s.opts.gelMaker, 1)[0] : null;
  textBox(ctx, 6, 6, [
    `Mitte: ${tgt.name}`,
    `${s.label(last.device ?? '')}`,
    `Farbton h ${de(vec.hue, 0)}°  Sättigung s ${de(vec.sat, 3)}`,
    `Δu′v′ ${de(vec.sat / 13, 4)}`,
    `CCT ${de(c.cct, 0)} K  Duv ${sgn(c.duv, 4)}`,
    ...(o.target === 'd65' ? [] : [`Mired zum Ziel ${sgn(shift, 0)}${gel ? ` → ${gel.gels.map((g) => g.name).join(' + ')}` : ''}`]),
  ]);
  ctx.fillStyle = 'rgba(230,215,170,0.55)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.font = FONT;
  ctx.fillText('s = 13·Δu′v′ (CIELUV) · Trendmessung', w - 6, h - 4);
}

// ---------------------------------------------------------------- filter channels

const BAND_COLOURS: [number, string][] = [
  [415, '#7a4dff'], [445, '#3d5cff'], [450, '#3d5cff'], [480, '#00a6ff'], [500, '#00d4a0'], [515, '#2fe05a'], [550, '#9be22d'],
  [555, '#b5e32b'], [570, '#e6e02a'], [590, '#ffb02e'], [600, '#ff8a2a'], [630, '#ff4a2a'], [650, '#ff2a2a'], [680, '#c8102e'],
];
const bandColour = (nm: number) => BAND_COLOURS.reduce((a, b) => (Math.abs(b[0] - nm) < Math.abs(a[0] - nm) ? b : a))[1];

function drawBands(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], w: number, h: number) {
  const last = list[list.length - 1];
  const ref = s.point(s.opts.ref)?.reading;
  const useRef = o.bands === 'ref' && ref && ref.model === last.model;
  const n = last.bands.length;
  const pad = { l: 44, r: 10, t: 28, b: 34 };
  const aw = w - pad.l - pad.r, ah = h - pad.t - pad.b;
  const vals = useRef ? last.bands.map((b, i) => (ref!.bands[i] > 0 ? b / ref!.bands[i] : 0)) : last.bands;
  const norm = useRef ? Math.max(2, ...vals) : Math.max(1e-9, ...vals, ...(ref && ref.model === last.model ? ref.bands : []));
  // scale
  ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const ticks = useRef ? [0, 0.5, 1, 1.5, 2].filter((t) => t <= norm) : [0, 0.25, 0.5, 0.75, 1];
  for (const t of ticks) {
    const y = pad.t + ah - (useRef ? t / norm : t) * ah;
    ctx.strokeStyle = t === 1 && useRef ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + aw, y); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.fillText(useRef ? `×${de(t, 1)}` : `${Math.round(t * 100)} %`, pad.l - 4, y);
  }
  const bw = aw / n;
  last.bands.forEach((_, i) => {
    const x = pad.l + i * bw + bw * 0.15, bwi = bw * 0.7;
    const v = vals[i] / norm;
    ctx.fillStyle = bandColour(last.wavelengths[i]); ctx.globalAlpha = 0.85;
    ctx.fillRect(x, pad.t + ah - v * ah, bwi, v * ah);
    ctx.globalAlpha = 1;
    if (!useRef && ref && ref.model === last.model) {
      const rv = ref.bands[i] / norm;
      ctx.strokeStyle = REF; ctx.setLineDash([3, 2]); ctx.strokeRect(x, pad.t + ah - rv * ah, bwi, rv * ah); ctx.setLineDash([]);
    }
    ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(`${last.wavelengths[i]} nm`, x + bwi / 2, pad.t + ah + 4);
    ctx.fillText(useRef ? `×${de(vals[i], 2)}` : de(last.bands[i], last.bands[i] < 10 ? 1 : 0), x + bwi / 2, pad.t + ah + 17);
  });
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`${s.label(last.device ?? '')} · ${n} Filterkanäle (kalibrierte Zählwerte, keine spektrale Leistung)${useRef ? ` · Verhältnis zu „${s.point(s.opts.ref)!.label}“` : ref && ref.model === last.model ? ` · gestrichelt: „${s.point(s.opts.ref)!.label}“` : ''}`, pad.l, 6);
}

// ---------------------------------------------------------------- time course

function drawTrend(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], w: number, h: number) {
  const now = Date.now(), t0 = now - o.window * 1000;
  const recent = list.filter((r) => r.ts >= t0);
  const qs: { key: 'lux' | 'cct' | 'duv'; name: string; unit: string; d: number; get: (r: Reading) => number }[] = [
    { key: 'lux', name: 'Beleuchtungsstärke', unit: 'lx', d: 1, get: (r) => r.lux },
    { key: 'cct', name: 'CCT', unit: 'K', d: 0, get: (r) => cctDuv([r.x, r.y]).cct },
    { key: 'duv', name: 'Duv', unit: '', d: 4, get: (r) => cctDuv([r.x, r.y]).duv },
  ];
  const show = o.trend === 'all' ? qs : qs.filter((q) => q.key === o.trend);
  const pad = { l: 56, r: 10, t: 6, b: 18 };
  const sh = (h - pad.t - pad.b) / show.length;
  const x = (t: number) => pad.l + ((t - t0) / (o.window * 1000)) * (w - pad.l - pad.r);
  const devs = [...new Set(recent.map((r) => r.device ?? ''))];
  show.forEach((q, qi) => {
    const top = pad.t + qi * sh, hh = sh - 8;
    const vals = recent.map(q.get).filter(Number.isFinite);
    let lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
    const minSpan = q.key === 'lux' ? Math.max(1, hi * 0.05) : q.key === 'cct' ? 50 : 0.002;
    if (hi - lo < minSpan) { const m = (hi + lo) / 2; lo = m - minSpan / 2; hi = m + minSpan / 2; }
    const y = (v: number) => top + hh - ((v - lo) / (hi - lo)) * hh;
    ctx.strokeStyle = GRID_DIM;
    for (let i = 0; i <= 4; i++) { const yy = top + (i / 4) * hh; ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); }
    ctx.strokeStyle = GRID; ctx.strokeRect(pad.l, top, w - pad.l - pad.r, hh);
    ctx.fillStyle = LABEL; ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(de(hi, q.d), pad.l - 4, top + 4); ctx.fillText(de(lo, q.d), pad.l - 4, top + hh - 4);
    for (const d of devs) {
      const rs = recent.filter((r) => (r.device ?? '') === d);
      ctx.strokeStyle = deviceColour(s, d); ctx.lineWidth = 1.5; ctx.beginPath();
      let started = false;
      for (const r of rs) { const v = q.get(r); if (!Number.isFinite(v)) continue; if (started) ctx.lineTo(x(r.ts), y(v)); else { ctx.moveTo(x(r.ts), y(v)); started = true; } }
      ctx.stroke(); ctx.lineWidth = 1;
    }
    const st = seriesStats(vals);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = LABEL;
    ctx.fillText(`${q.name}${q.unit ? ` (${q.unit})` : ''} · Mittel ${de(st.mean, q.d)} · σ ${de(st.sd, q.d + 1)}${q.key === 'lux' && Number.isFinite(st.cv) ? ` (${de(st.cv * 100, 1)} %)` : ''} · n ${st.n}`, pad.l + 4, top + 3);
  });
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) { const t = t0 + (i / 4) * o.window * 1000; ctx.fillText(`−${Math.round((now - t) / 1000)} s`, x(t), h - pad.b + 3); }
  if (devs.length > 1) {
    ctx.textAlign = 'right';
    devs.forEach((d, i) => { ctx.fillStyle = deviceColour(s, d); ctx.fillText(s.label(d), w - pad.r - 4, pad.t + 3 + i * 12 + (show.length > 1 ? 0 : 12)); });
  }
}

// ---------------------------------------------------------------- measuring grid

function heat(t: number) {
  // dark → trace green → white (like the other scopes' traces)
  const c = Math.max(0, Math.min(1, t));
  const r = Math.round(20 + c * (c > 0.6 ? 235 : 120)), g = Math.round(24 + c * 231), b = Math.round(28 + c * (c > 0.6 ? 200 : 110));
  return `rgb(${r},${g},${b})`;
}
function diverge(t: number) {
  // 0 = neutral grey, ±1 = amber/cyan
  const c = Math.max(-1, Math.min(1, t));
  return c >= 0 ? `rgb(${Math.round(60 + c * 195)},${Math.round(60 + c * 120)},${Math.round(60 - c * 20)})` : `rgb(${Math.round(60 + c * 40)},${Math.round(60 - c * 160)},${Math.round(60 - c * 195)})`;
}

function drawMap(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, w: number, h: number) {
  const { cols, rows, cursor } = s.opts;
  const cells = s.gridCells();
  const st = gridStats(cells);
  const pad = { l: 26, r: 8, t: 30, b: 8 };
  const cw = (w - pad.l - pad.r) / cols, ch = (h - pad.t - pad.b) / rows;
  const byKey = new Map(cells.map((c) => [cellKey(c.col, c.row), c]));
  const meanCct = st ? cctDuv(st.meanXy).cct : NaN;
  ctx.font = FONT;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = pad.l + c * cw, y = pad.t + r * ch, cell = byKey.get(cellKey(c, r));
    if (cell && st) {
      const k = cellKey(c, r);
      const cct = cctDuv([cell.reading.x, cell.reading.y]).cct;
      ctx.fillStyle = o.map === 'lux' ? heat(st.rel.get(k)! / 100) : o.map === 'duv' ? heat(Math.min(1, st.dUv.get(k)! / 0.01)) : diverge((cct - meanCct) / 500);
      ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      const dark = o.map !== 'cct' && (o.map === 'lux' ? st.rel.get(k)! / 100 : st.dUv.get(k)! / 0.01) > 0.55;
      ctx.fillStyle = dark ? '#0b0c0e' : '#e8e8e8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cd = cctDuv([cell.reading.x, cell.reading.y]);
      const lines = [
        `${de(cell.reading.lux, cell.reading.lux < 10 ? 1 : 0)} lx (${de(st.rel.get(k)!, 0)} %)`,
        `${de(cd.cct, 0)} K · Duv ${sgn(cd.duv, 3)}`,
        `Δu′v′ ${de(st.dUv.get(k)!, 4)}`,
      ];
      const lh = 13, fit = Math.max(1, Math.min(lines.length, Math.floor((ch - 6) / lh)));
      lines.slice(0, fit).forEach((l, i) => ctx.fillText(l, x + cw / 2, y + ch / 2 + (i - (fit - 1) / 2) * lh));
    } else {
      ctx.strokeStyle = GRID_DIM; ctx.strokeRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
    }
    if (c === cursor[0] && r === cursor[1]) { ctx.strokeStyle = PROBE; ctx.lineWidth = 2; ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4); ctx.lineWidth = 1; }
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (let c = 0; c < cols; c++) ctx.fillText(String(c + 1), pad.l + (c + 0.5) * cw, pad.t - 2);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let r = 0; r < rows; r++) ctx.fillText(String.fromCharCode(65 + r), pad.l - 6, pad.t + (r + 0.5) * ch);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const what = { lux: 'Beleuchtungsstärke % vom hellsten Punkt', duv: 'Δu′v′ zum Mittel (Skala 0 … 0,01)', cct: 'CCT zum Mittel (±500 K)' }[o.map];
  ctx.fillText(st
    ? `Messfeld ${cols}×${rows} · ${what} · Gleichmäßigkeit min/max ${de(st.uniformity, 0)} % · max Δu′v′ ${de(st.maxDuv, 4)} · ${cells.length}/${cols * rows} Punkte`
    : `Messfeld ${cols}×${rows}: Punkte nacheinander aufnehmen (Seitenleiste → Lichtmesser → Messfeld). Blauer Rahmen = nächster Punkt.`, 6, 6);
  const a = s.point(s.opts.ref), b = s.point(s.opts.cmp);
  if (a && b && a !== b && h > 160) {
    const cmp = compareLights(a.reading, b.reading, s.opts.gelMaker);
    textBox(ctx, w - 6, h - 6 - 4 * 13 - 6, [
      `Vergleich ${a.label} → ${b.label}`,
      `Δu′v′ ${de(cmp.duv, 4)} · ΔCCT ${sgn(cmp.cctB - cmp.cctA, 0)} K`,
      `Helligkeit ${sgn(cmp.stops, 2)} Blenden`,
      `Mired für B ${sgn(cmp.shift, 0)}${cmp.gels[0] ? ` → ${cmp.gels[0].gels.map((g) => g.name).join(' + ')}` : ''}`,
    ], 'right');
  }
}

// ---------------------------------------------------------------- wavelength monitor

/** Approximate display colour of a wavelength (for drawing only; piecewise linear, own). */
export function wavelengthColour(nm: number, a = 1) {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const c = (v: number) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v * f)), 0.8));
  return `rgba(${c(r)},${c(g)},${c(b)},${a})`;
}

function drawSpectrum(ctx: CanvasRenderingContext2D, s: LightStore, o: LightPanelOptions, list: Reading[], w: number, h: number) {
  const last = [...list].reverse().find((r) => r.spectrum) ?? list[list.length - 1];
  const extraLines = last.cri || last.tlci || last.tm30 ? 2 : 0;
  const pad = { l: 44, r: 12, t: 22 + extraLines * 13, b: 30 };
  const aw = w - pad.l - pad.r, ah = h - pad.t - pad.b;
  const X = (nm: number) => pad.l + ((nm - 380) / 400) * aw, Y = (v: number) => pad.t + ah - v * ah;
  ctx.font = FONT;
  for (let nm = 400; nm <= 780; nm += 50) {
    ctx.strokeStyle = GRID_DIM; ctx.beginPath(); ctx.moveTo(X(nm), pad.t); ctx.lineTo(X(nm), pad.t + ah); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${nm}`, X(nm), pad.t + ah + 6);
  }
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.strokeStyle = t === 0 || t === 1 ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + aw, Y(t)); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(t * 100)} %`, pad.l - 4, Y(t));
  }
  for (let nm = 380; nm < 780; nm += 2) { ctx.fillStyle = wavelengthColour(nm, 0.9); ctx.fillRect(X(nm), pad.t + ah + 1, Math.ceil(X(nm + 2) - X(nm)), 3); }
  ctx.fillStyle = LABEL; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('nm', w - 4, pad.t + ah + 18);
  const refPoint = s.point(s.opts.ref), ref = refPoint?.reading;
  let title: string;
  if (last.spectrum) {
    const sp = last.spectrum, pk = peakOf(sp), max = pk.value || 1;
    for (let i = 0; i < sp.values.length - 1; i++) {
      const x0 = X(wavelengthAt(sp, i)), x1 = X(wavelengthAt(sp, i + 1));
      ctx.fillStyle = wavelengthColour(wavelengthAt(sp, i), 0.55);
      ctx.beginPath(); ctx.moveTo(x0, Y(0)); ctx.lineTo(x0, Y(Math.max(0, sp.values[i]) / max)); ctx.lineTo(x1, Y(Math.max(0, sp.values[i + 1]) / max)); ctx.lineTo(x1, Y(0)); ctx.fill();
    }
    const curve = (sp2: NonNullable<Reading['spectrum']>) => {
      const m2 = Math.max(...sp2.values) || 1;
      ctx.beginPath();
      sp2.values.forEach((v, i) => { const x = X(wavelengthAt(sp2, i)), y = Y(Math.max(0, v) / m2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    };
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1.5; curve(sp); ctx.lineWidth = 1;
    if (ref?.spectrum && ref !== last) { ctx.strokeStyle = REF; ctx.setLineDash([4, 3]); curve(ref.spectrum); ctx.setLineDash([]); }
    title = `${s.label(last.device ?? '')} · Spektrum ${de(sp.start, 0)}–${de(sp.end, 0)} nm, ${sp.values.length} Werte · Spitze ${de(pk.nm, 0)} nm${sp.unit !== 'relativ' ? ` = ${de(pk.value, 3)} ${sp.unit}` : ' (relativ)'}${ref?.spectrum && ref !== last ? ` · gestrichelt: „${refPoint!.label}“` : ''}`;
  } else if (last.bands.length) {
    const fb = filterBands(last.model === 'lm4' ? 'lm4' : 'lm3', last.wavelengths);
    const max = Math.max(1e-9, ...last.bands);
    last.bands.forEach((v, i) => {
      const b = fb[i], x = X(b.nm), y = Y(v / max), col = wavelengthColour(b.nm);
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, Y(0)); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
      if (b.fwhm) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(b.nm - b.fwhm / 2), y); ctx.lineTo(X(b.nm + b.fwhm / 2), y); ctx.stroke(); ctx.lineWidth = 1; }
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`${b.nm}`, x, y - 6);
    });
    title = `${s.label(last.device ?? '')} · ${last.bands.length} Filterkanäle, kein Spektrum · Höhe = kalibrierter Zählwert relativ zum stärksten Kanal${last.model === 'lm4' ? ' · Balken = Halbwertsbreite (AS7341-Datenblatt)' : ' · Filterbreiten des LM3 nicht veröffentlicht'}`;
  } else title = 'Keine Kanal- oder Spektraldaten';
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = FONT;
  ctx.fillText(title, 6, 4);
  if (extraLines) {
    const c = (b: boolean) => (b ? ' (Vorsicht)' : '');
    const l1 = [last.cri ? `CRI Ra ${de(last.cri.ra, 1)} · R9 ${de(last.cri.r9, 1)}${c(last.cri.caution)}` : '', last.tlci ? `TLCI Qa ${de(last.tlci.qa, 1)}${c(last.tlci.caution)}` : '', last.tm30 ? `TM-30-15 Rf ${de(last.tm30.rf, 1)} Rg ${de(last.tm30.rg, 1)}${c(last.tm30.caution)}` : ''].filter(Boolean).join(' · ');
    ctx.fillText(`${l1} – berechnet von ArgyllCMS`, 6, 17);
    if (last.cri?.r.length) ctx.fillText(last.cri.r.map((v, i) => `R${i + 1} ${de(v, 0)}`).join(' '), 6, 30);
  }
  void o;
}

// ---------------------------------------------------------------- colour patch

function drawSwatch(ctx: CanvasRenderingContext2D, s: LightStore, list: Reading[], w: number, h: number) {
  const last = list[list.length - 1];
  const attr = (ctx as CanvasRenderingContext2D & { getContextAttributes?: () => { colorSpace?: string } }).getContextAttributes?.();
  const space = attr?.colorSpace === 'display-p3' ? 'display-p3' : 'srgb';
  const cd = cctDuv([last.x, last.y]);
  const meas = displayColour([last.x, last.y], space);
  const planck = cd.inRange ? displayColour(planckXy(cd.cct), space) : null;
  const pad = 8, top = 8, bottom = 52;
  const pw = w - 2 * pad, ph = Math.max(20, h - top - bottom);
  const split = planck ? pw * 0.72 : pw;
  ctx.fillStyle = meas.css; ctx.fillRect(pad, top, split, ph);
  if (planck) { ctx.fillStyle = planck.css; ctx.fillRect(pad + split + 2, top, pw - split - 2, ph); }
  if (meas.outOfGamut) {
    ctx.save(); ctx.beginPath(); ctx.rect(pad, top, split, ph); ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let x = -ph; x < split; x += 14) { ctx.beginPath(); ctx.moveTo(pad + x, top + ph); ctx.lineTo(pad + x + ph, top); ctx.stroke(); }
    ctx.restore();
  }
  const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  ctx.font = '600 13px system-ui'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = lum(meas.linear.map((v) => Math.max(0, v))) > 0.45 ? '#111' : '#f2f2f2';
  ctx.fillText('gemessen (mit Duv)', pad + 8, top + 8);
  if (planck) { ctx.fillStyle = lum(planck.linear) > 0.45 ? '#111' : '#f2f2f2'; ctx.font = '11px system-ui'; ctx.fillText('Planck, gleiche CCT', pad + split + 8, top + 8); }
  ctx.font = FONT; ctx.fillStyle = LABEL; ctx.textBaseline = 'top';
  ctx.fillText(`${s.label(last.device ?? '')} · CCT ${de(cd.cct, 0)} K · Duv ${sgn(cd.duv, 4)} · x ${de(last.x, 4)} y ${de(last.y, 4)}`, pad, top + ph + 6);
  ctx.fillStyle = meas.outOfGamut ? '#ffb44a' : LABEL;
  ctx.fillText(meas.outOfGamut
    ? `Außerhalb des Display-Gamuts (${space === 'display-p3' ? 'Display P3' : 'sRGB'}): schraffiert, gezeigt wird die abgeschnittene Farbe`
    : `Display ${space === 'display-p3' ? 'P3' : 'sRGB'} · Helligkeit normiert · ohne Weißabgleich (Display-Weiß = D65)`, pad, top + ph + 19);
  ctx.fillStyle = 'rgba(230,215,170,0.55)';
  ctx.fillText('Stimmt nur bei kalibriertem Display und aktiver Farbverwaltung · Filtersensor: Trendmessung', pad, top + ph + 32);
}
