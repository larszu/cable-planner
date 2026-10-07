// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Min/Max per picture line and the neutral-cast measurement (issue #67).
//
// Min Max (idea: Nobe OmniScope "Min Max", docs.timeinpixels.com/nobe-omniscope/scopes/min-max):
// for every picture line the darkest and the brightest Y′, drawn top to bottom like the picture;
// the gap is the local contrast, lines beyond the limits are marked. Own implementation.
// Neutral (idea: OmniScope "Neutral Scope"): pixels that are almost but not quite neutral
// (chroma below a threshold, 5 % by default) and their mean cast. Own implementation.

import { LUMA, type Colorspace } from './color';
import type { Decode } from './ycbcr';

export interface LineExtremes { min: Float32Array; max: Float32Array; rows: number }

/** Y′ min/max of `rows` evenly spaced picture lines (each line fully, every `xStep`-th pixel). */
export function lineExtremes(px: ArrayLike<number>, w: number, h: number, decode: Decode, cs: Colorspace, rows = Math.min(h, 540), xStep = Math.max(1, Math.floor(w / 960))): LineExtremes {
  const { kr, kb } = LUMA[cs], kg = 1 - kr - kb;
  const min = new Float32Array(rows), max = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    const y = Math.min(h - 1, Math.floor(((r + 0.5) / rows) * h));
    let lo = Infinity, hi = -Infinity;
    for (let x = 0; x < w; x += xStep) {
      const c = decode(px, (y * w + x) * 4), Y = kr * c[0] + kg * c[1] + kb * c[2];
      if (Y < lo) lo = Y;
      if (Y > hi) hi = Y;
    }
    min[r] = lo; max[r] = hi;
  }
  return { min, max, rows };
}

export interface NeutralCast {
  /** share of the analysed pixels that count as near-neutral */
  share: number;
  /** mean Cb, Cr of those pixels (−0.5…0.5) and the cast as hue angle (vectorscope degrees) and size in % of |CbCr|/0.5 */
  cb: number; cr: number; deg: number; amount: number;
  samples: number;
}

/**
 * Near-neutral pixels: chroma |CbCr|/0.5 below `threshold` (0.05 = 5 %) and Y′ in [lo, hi];
 * returns their share and mean cast. Exactly neutral pixels count too (they pull the mean to 0).
 */
export function neutralCast(px: ArrayLike<number>, w: number, h: number, step: number, decode: Decode, cs: Colorspace, threshold = 0.05, lo = 0.02, hi = 0.98): NeutralCast {
  const { kr, kb } = LUMA[cs], kg = 1 - kr - kb;
  let n = 0, all = 0, sb = 0, sr = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const c = decode(px, (y * w + x) * 4), Y = kr * c[0] + kg * c[1] + kb * c[2];
      all++;
      if (Y < lo || Y > hi) continue;
      const cb = (c[2] - Y) / (2 * (1 - kb)), cr = (c[0] - Y) / (2 * (1 - kr));
      if (Math.hypot(cb, cr) / 0.5 >= threshold) continue;
      n++; sb += cb; sr += cr;
    }
  }
  const cb = n ? sb / n : 0, cr = n ? sr / n : 0;
  return { share: all ? n / all : 0, cb, cr, deg: ((Math.atan2(cr, cb) * 180) / Math.PI + 360) % 360, amount: Math.hypot(cb, cr) / 0.5, samples: n };
}

/** Name of the nearest vectorscope direction of a hue angle, for "cast towards …". */
export function castName(deg: number, cs: Colorspace): string {
  const { kr, kb } = LUMA[cs];
  const angle = (rgb: number[]) => {
    const y = kr * rgb[0] + (1 - kr - kb) * rgb[1] + kb * rgb[2];
    return ((Math.atan2((rgb[0] - y) / (2 * (1 - kr)), (rgb[2] - y) / (2 * (1 - kb))) * 180) / Math.PI + 360) % 360;
  };
  const names: [string, number[]][] = [['Rot', [1, 0, 0]], ['Gelb', [1, 1, 0]], ['Grün', [0, 1, 0]], ['Cyan', [0, 1, 1]], ['Blau', [0, 0, 1]], ['Magenta', [1, 0, 1]]];
  let best = names[0][0], bd = 999;
  for (const [n, c] of names) { const d = Math.abs(((angle(c) - deg + 540) % 360) - 180); if (d < bd) { bd = d; best = n; } }
  return best;
}

const GRID = 'rgba(210, 190, 120, 0.42)', GRID_DIM = 'rgba(210, 190, 120, 0.16)', LABEL = 'rgba(230, 215, 170, 0.85)';
const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';

/**
 * Min Max panel: vertical = picture line (top line at the top), horizontal = Y′ (−7…110 %).
 * Min trace blue, max trace green; parts beyond lo / hi red; dashed limit and target lines.
 */
export function drawMinMax(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, e: LineExtremes | null, opts: { lo: number; hi: number; targets: number[] }) {
  const WMIN = -0.07, WMAX = 1.1;
  const X = (v: number) => r.x + ((Math.max(WMIN, Math.min(WMAX, v)) - WMIN) / (WMAX - WMIN)) * r.w;
  ctx.save(); ctx.font = FONT; ctx.lineWidth = 1;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const x = Math.round(X(v)) + 0.5;
    ctx.strokeStyle = v === 0 || v === 1 ? GRID : GRID_DIM; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke();
    ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${v * 100}`, x, r.y + r.h + 3);
  }
  const vline = (v: number, style: string, dash: number[]) => { const x = Math.round(X(v)) + 0.5; ctx.strokeStyle = style; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); ctx.setLineDash([]); };
  vline(opts.lo, 'rgba(255,90,90,0.8)', [4, 3]); vline(opts.hi, 'rgba(255,90,90,0.8)', [4, 3]);
  for (const t of opts.targets) vline(t, 'rgba(0,220,255,0.7)', [2, 3]);
  ctx.fillStyle = LABEL; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText('Zeile 1', r.x - 4, r.y);
  ctx.textBaseline = 'bottom'; ctx.fillText('letzte', r.x - 4, r.y + r.h);
  if (!e) { ctx.restore(); return; }
  const Y = (i: number) => r.y + ((i + 0.5) / e.rows) * r.h;
  const trace = (vals: Float32Array, ok: string) => {
    for (let i = 1; i < e.rows; i++) {
      const bad = (v: number) => v < opts.lo || v > opts.hi;
      ctx.strokeStyle = bad(vals[i]) || bad(vals[i - 1]) ? '#ff3b3b' : ok;
      ctx.beginPath(); ctx.moveTo(X(vals[i - 1]), Y(i - 1)); ctx.lineTo(X(vals[i]), Y(i)); ctx.stroke();
    }
  };
  ctx.lineWidth = 1.5;
  trace(e.min, 'rgba(110,160,255,0.95)');
  trace(e.max, 'rgba(140,255,160,0.95)');
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < e.rows; i++) { mn = Math.min(mn, e.min[i]); mx = Math.max(mx, e.max[i]); }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = LABEL;
  ctx.fillText(`Min ${(mn * 100).toFixed(1)} %  ·  Max ${(mx * 100).toFixed(1)} %  ·  Grenzen ${(opts.lo * 100).toFixed(0)}/${(opts.hi * 100).toFixed(0)} %`, r.x + 4, r.y + 4);
  ctx.restore();
}
