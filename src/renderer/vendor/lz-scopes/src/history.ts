// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Scopes over time ("Zeitverlauf", issue: cube rework / OmniScope gaps). Ten times a second (or
// for every new picture) a grid of the picture (96 × 54 points, finer selectable) is reduced to: mean colour (one column of a movie
// barcode), Y′ min / mean / max, mean and 95th-percentile saturation and a hue histogram. The
// timeline panel draws these as lanes, newest on the right – a vectorscope and waveform history
// in a few rows. Research and sources: docs/research/scopes-over-time.md.

import { LUMA, type Colorspace } from './color';
import type { Decode } from './ycbcr';

export const HUE_BINS = 24;
export const GRID_W = 96, GRID_H = 54;
/** selectable grids (width; height = width · 9/16) */
export const GRIDS = [96, 192, 384] as const;

export interface HistorySample {
  /** performance.now() in ms */
  t: number;
  /** mean R′G′B′ (signal) */
  rgb: [number, number, number];
  yMin: number; yAvg: number; yMax: number;
  /** saturation = |CbCr| / 0.5 (100 % ≈ fully saturated primary); mean and 95th percentile */
  sat: number; sat95: number;
  /** hue histogram, weighted by saturation, bin 0 starts at +Cb (0°), counter-clockwise; sum 1 */
  hue: Float32Array;
}

/** Hue angle (degrees, counter-clockwise from +Cb as on the vectorscope) and saturation of R′G′B′. */
export function hueSat(rgb: number[], cs: Colorspace) {
  const { kr, kb } = LUMA[cs];
  const y = kr * rgb[0] + (1 - kr - kb) * rgb[1] + kb * rgb[2];
  const cb = (rgb[2] - y) / (2 * (1 - kb)), cr = (rgb[0] - y) / (2 * (1 - kr));
  const deg = ((Math.atan2(cr, cb) * 180) / Math.PI + 360) % 360;
  return { y, deg, sat: Math.hypot(cb, cr) / 0.5 };
}

/** One history sample from grid points (each a normalised R′G′B′). */
export function summarise(points: number[][], cs: Colorspace, t: number): HistorySample {
  const hue = new Float32Array(HUE_BINS);
  const sats: number[] = [];
  let yMin = Infinity, yMax = -Infinity, ySum = 0, r = 0, g = 0, b = 0, hueSum = 0;
  for (const p of points) {
    const h = hueSat(p, cs);
    yMin = Math.min(yMin, h.y); yMax = Math.max(yMax, h.y); ySum += h.y;
    r += p[0]; g += p[1]; b += p[2];
    sats.push(h.sat);
    if (h.sat > 0.03) { hue[Math.floor(h.deg / (360 / HUE_BINS)) % HUE_BINS] += h.sat; hueSum += h.sat; }
  }
  const n = Math.max(1, points.length);
  if (hueSum > 0) for (let i = 0; i < HUE_BINS; i++) hue[i] /= hueSum;
  sats.sort((x, y) => x - y);
  return {
    t, rgb: [r / n, g / n, b / n], yMin: points.length ? yMin : 0, yAvg: ySum / n, yMax: points.length ? yMax : 0,
    sat: sats.reduce((a, v) => a + v, 0) / n, sat95: sats.length ? sats[Math.min(sats.length - 1, Math.floor(sats.length * 0.95))] : 0, hue,
  };
}

/** Grid points of a raw frame (bridge data / 16-bit patterns). */
export function gridFromData(px: ArrayLike<number>, w: number, h: number, decode: Decode, gw = GRID_W, gh = GRID_H): number[][] {
  const out: number[][] = [];
  for (let gy = 0; gy < gh; gy++) {
    const y = Math.min(h - 1, Math.floor(((gy + 0.5) / gh) * h));
    for (let gx = 0; gx < gw; gx++) {
      const x = Math.min(w - 1, Math.floor(((gx + 0.5) / gw) * w));
      out.push(decode(px, (y * w + x) * 4));
    }
  }
  return out;
}

/** Ring buffer of samples (up to `max`, 10 Hz → 10 minutes). */
export class History {
  samples: HistorySample[] = [];
  version = 0;
  constructor(readonly max = 6000) {}
  push(s: HistorySample) {
    this.samples.push(s);
    if (this.samples.length > this.max) this.samples.splice(0, this.samples.length - this.max);
    this.version++;
  }
  clear() { this.samples = []; this.version++; }
}

// ---------------------------------------------------------------- drawing

export type TimelineSpan = 10 | 60 | 300;

/** Display colour of a hue angle (for the hue lane): Y′ 0.6 with the chroma at that angle. */
function hueColor(deg: number, cs: Colorspace): string {
  const { kr, kb } = LUMA[cs], a = (deg * Math.PI) / 180;
  const cb = 0.25 * Math.cos(a), cr = 0.25 * Math.sin(a), y = 0.55;
  const R = y + 2 * (1 - kr) * cr, B = y + 2 * (1 - kb) * cb, G = (y - kr * R - kb * B) / (1 - kr - kb);
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(R)},${c(G)},${c(B)})`;
}

const LABEL = 'rgba(230, 215, 170, 0.85)', GRID = 'rgba(210, 190, 120, 0.25)';

/**
 * Timeline lanes in `r` (CSS px): colour barcode, hue over time (heat: brighter = more of that
 * hue), saturation (mean, 95 %), Y′ (min–max band and mean). Newest sample at the right edge.
 */
export function drawTimeline(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, h: History, cs: Colorspace, spanS: TimelineSpan, now = performance.now()) {
  const left = r.x + 26, w = r.w - 50;
  const lanes = [{ name: 'Farbe', f: 0.12 }, { name: 'Farbton', f: 0.34 }, { name: 'Sättigung', f: 0.22 }, { name: 'Luma Y′', f: 0.32 }];
  const gap = 6, total = r.h - 18 - gap * (lanes.length - 1);
  let y = r.y;
  const box = lanes.map((l) => { const b = { y, h: total * l.f, name: l.name }; y += b.h + gap; return b; });
  const xOf = (t: number) => left + w - ((now - t) / (spanS * 1000)) * w;
  const vis = h.samples.filter((s) => now - s.t <= spanS * 1000);
  ctx.save();
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  // lane frames (names are drawn last, on top, inside the lanes)
  for (const b of box) { ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.strokeRect(left + 0.5, b.y + 0.5, w - 1, b.h - 1); }
  // each sample fills the time until the next one (no gaps when the display runs slowly)
  const minW = Math.max(1, w / Math.max(1, spanS * 10));
  const span = (i: number) => { const x = xOf(vis[i].t); return { x, cw: Math.max(minW, (i + 1 < vis.length ? xOf(vis[i + 1].t) : x + minW) - x) }; };
  // 1 barcode
  vis.forEach((s, i) => {
    const c = s.rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)), { x, cw } = span(i);
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; ctx.fillRect(x, box[0].y + 1, cw + 0.5, box[0].h - 2);
  });
  // 2 hue heat map: rows = hue bins (0° at the bottom), alpha = share
  const hb = box[1], rowH = (hb.h - 2) / HUE_BINS;
  const colors = Array.from({ length: HUE_BINS }, (_, i) => hueColor((i + 0.5) * (360 / HUE_BINS), cs));
  vis.forEach((s, k) => {
    const { x, cw } = span(k);
    for (let i = 0; i < HUE_BINS; i++) {
      const v = s.hue[i];
      if (v <= 0.002) continue;
      ctx.globalAlpha = Math.min(1, 0.15 + v * 4);
      ctx.fillStyle = colors[i]; ctx.fillRect(x, hb.y + hb.h - 1 - (i + 1) * rowH, cw + 0.5, rowH + 0.5);
    }
  });
  ctx.globalAlpha = 1;
  // vectorscope names at their angles (BT.709 bars, same matrix as the source)
  ctx.textAlign = 'left'; ctx.fillStyle = LABEL;
  for (const [name, rgb] of [['R', [1, 0, 0]], ['Yl', [1, 1, 0]], ['G', [0, 1, 0]], ['Cy', [0, 1, 1]], ['B', [0, 0, 1]], ['Mg', [1, 0, 1]]] as [string, number[]][]) {
    const d = hueSat(rgb, cs).deg;
    ctx.fillText(name, r.x + 2, hb.y + hb.h - 1 - (d / 360) * (hb.h - 2));
  }
  // 3 saturation: mean (solid) and 95 % (thin), 0 … 100 %
  const sb = box[2], sy = (v: number) => sb.y + sb.h - 1 - Math.max(0, Math.min(1.1, v)) / 1.1 * (sb.h - 2);
  const plot = (get: (s: HistorySample) => number, yOf: (v: number) => number, style: string, width: number) => {
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.beginPath();
    vis.forEach((s, i) => { const x = xOf(s.t), yy = yOf(get(s)); if (i) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); });
    ctx.stroke();
  };
  ctx.strokeStyle = GRID; ctx.beginPath(); for (const v of [0.5, 1]) { ctx.moveTo(left, sy(v)); ctx.lineTo(left + w, sy(v)); } ctx.stroke();
  plot((s) => s.sat95, sy, 'rgba(255,170,90,0.6)', 1);
  plot((s) => s.sat, sy, 'rgba(255,170,90,1)', 1.5);
  // 4 luma: min–max band, mean line, 0/50/100 % grid
  const lb = box[3], ly = (v: number) => lb.y + lb.h - 1 - (Math.max(-0.07, Math.min(1.1, v)) + 0.07) / 1.17 * (lb.h - 2);
  ctx.strokeStyle = GRID; ctx.beginPath(); for (const v of [0, 0.5, 1]) { ctx.moveTo(left, ly(v)); ctx.lineTo(left + w, ly(v)); } ctx.stroke();
  ctx.fillStyle = 'rgba(140, 255, 160, 0.22)';
  vis.forEach((s, i) => { const { x, cw } = span(i); ctx.fillRect(x, ly(s.yMax), cw + 0.5, Math.max(1, ly(s.yMin) - ly(s.yMax))); });
  plot((s) => s.yAvg, ly, 'rgba(140,255,160,1)', 1.5);
  ctx.fillStyle = LABEL; ctx.textAlign = 'left';
  ctx.fillText('100', left + w + 2, ly(1)); ctx.fillText('0', left + w + 2, ly(0));
  ctx.fillText('100', left + w + 2, sy(1));
  // time axis
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const tick = spanS <= 10 ? 2 : spanS <= 60 ? 10 : 60;
  for (let s = 0; s <= spanS; s += tick) {
    const x = left + w - (s / spanS) * w;
    ctx.fillText(s ? `−${s >= 60 ? `${s / 60} min` : `${s} s`}` : 'jetzt', x, r.y + r.h - 14);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const b of box) { ctx.fillStyle = 'rgba(8,9,11,0.7)'; const tw = ctx.measureText(b.name).width + 6; ctx.fillRect(left + 2, b.y + 2, tw, 13); ctx.fillStyle = LABEL; ctx.fillText(b.name, left + 5, b.y + 4); }
  if (!vis.length) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Verlauf beginnt, sobald die Quelle Bilder liefert', left + w / 2, r.y + r.h / 2); }
  ctx.restore();
}
