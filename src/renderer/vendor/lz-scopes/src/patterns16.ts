// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Test patterns with exact 10-bit code values (issue #7). They are built as a raster of
// R′G′B′ codes and handed to the scopes as 16-bit Y′CbCr frames (src/ycbcr.ts), so −7 %,
// −2 % and 109 % arrive unclipped. The output window draws the same codes on a float16 canvas
// where the browser has one (src/deep.ts); with levels 0–100 % it clips below 0 % and above
// 100 %, with “codes 1:1” (legal-range monitor) it keeps them.

import type { Colorspace } from './color';
import { LUMA } from './color';
import { encodeYuv, type YuvCoding } from './ycbcr';

export interface Frame16 { data: Uint16Array; width: number; height: number; coding: YuvCoding; colorspace: Colorspace }

type Code3 = [number, number, number];

/** Raster of 10-bit R′G′B′ code values. */
export class CodeRaster {
  readonly c: Uint16Array;
  constructor(readonly w: number, readonly h: number, bg: number) { this.c = new Uint16Array(w * h * 3).fill(bg); }
  fill(x0: number, y0: number, x1: number, y1: number, v: Code3) {
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0));
    x1 = Math.min(this.w, Math.round(x1)); y1 = Math.min(this.h, Math.round(y1));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * this.w + x) * 3; this.c[i] = v[0]; this.c[i + 1] = v[1]; this.c[i + 2] = v[2]; }
  }
  at(x: number, y: number): Code3 { const i = (y * this.w + x) * 3; return [this.c[i], this.c[i + 1], this.c[i + 2]]; }
}

/** 10-bit code → signal level (narrow: 64 = 0 %, 940 = 100 %; full: 0 … 1023). */
export const level10 = (d: number, full: boolean) => (full ? d / 1023 : (d - 64) / 876);

/** Code raster → 16-bit Y′CbCr frame (A, Y′, Cb, Cr) for the scopes. */
export function toFrame16(r: CodeRaster, full: boolean, colorspace: Colorspace): Frame16 {
  const coding: YuvCoding = { full, bits: 10 };
  const { kr, kb } = LUMA[colorspace];
  const data = new Uint16Array(r.w * r.h * 4);
  const cache = new Map<number, [number, number, number]>();
  for (let k = 0; k < r.w * r.h; k++) {
    const a = r.c[k * 3], b = r.c[k * 3 + 1], c = r.c[k * 3 + 2], key = (a * 1024 + b) * 1024 + c;
    let v = cache.get(key);
    if (!v) { v = encodeYuv(level10(a, full), level10(b, full), level10(c, full), kr, kb, coding); cache.set(key, v); }
    data[k * 4] = 65535; data[k * 4 + 1] = v[0]; data[k * 4 + 2] = v[1]; data[k * 4 + 3] = v[2];
  }
  return { data, width: r.w, height: r.h, coding, colorspace };
}

/** Code raster → 8-bit full-range canvas (clipped to 0…100 %). */
export function drawRaster(ctx: CanvasRenderingContext2D, r: CodeRaster, full: boolean) {
  const img = ctx.createImageData(r.w, r.h), d = img.data;
  const lut = new Uint8ClampedArray(1024);
  for (let v = 0; v < 1024; v++) lut[v] = Math.round(Math.max(0, Math.min(1, level10(v, full))) * 255);
  for (let k = 0; k < r.w * r.h; k++) {
    d[k * 4] = lut[r.c[k * 3]]; d[k * 4 + 1] = lut[r.c[k * 3 + 1]]; d[k * 4 + 2] = lut[r.c[k * 3 + 2]]; d[k * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- ITU-R BT.2111-3

export type Bt2111Kind = 'hlg' | 'pq' | 'pqfull';

/**
 * Code values of ITU-R BT.2111-3 (05/2025), 10 bit: Tab. 2 (HLG narrow, p7–8), Tab. 3
 * (PQ narrow, p9–10), Tab. 4 (PQ full, p10–11).
 */
export const BT2111 = {
  hlg: {
    full: false, hi: 940, lo: 64, bar: 721, grey: 414, sideWhite: 721, first: 4,
    steps: [64, 152, 239, 327, 414, 502, 590, 677, 765, 852, 940, 1019],
    b709: { y: [713, 719, 316], c: [538, 709, 718], g: [512, 706, 296], m: [651, 286, 705], r: [639, 269, 164], b: [227, 147, 702] },
    black: { m2: 48, p2: 80, p4: 99 }, rampLo: 4, rampHi: 1019, ramp: { B: 559, D: 107 },
  },
  pq: {
    full: false, hi: 940, lo: 64, bar: 573, grey: 414, sideWhite: 573, first: 4,
    steps: [64, 152, 239, 327, 414, 502, 590, 677, 765, 852, 940, 1019],
    b709: { y: [569, 572, 381], c: [485, 566, 571], g: [474, 565, 368], m: [537, 362, 564], r: [531, 351, 257], b: [318, 236, 563] },
    black: { m2: 48, p2: 80, p4: 99 }, rampLo: 4, rampHi: 1019, ramp: { B: 559, D: 107 },
  },
  pqfull: {
    full: true, hi: 1023, lo: 0, bar: 594, grey: 409, sideWhite: 594, first: 0,
    steps: [0, 102, 205, 307, 409, 512, 614, 716, 818, 921, 1023, 1023],
    b709: { y: [589, 593, 370], c: [491, 586, 592], g: [479, 585, 355], m: [552, 348, 584], r: [545, 335, 225], b: [296, 201, 582] },
    // full range has no −2 % black: that position is 0 % (Fig. 3)
    black: { m2: 0, p2: 19, p4: 41 }, rampLo: 0, rampHi: 1023, ramp: { B: 618, D: 40 },
  },
} as const;

/**
 * BT.2111-3 layout, Fig. 1–3 (p4–6) with the 2K sizes of Tab. 1 (p6): a 1920, b 1080,
 * c 240, d 206, e 204, f 136, g 70, h 68, i 238, j 438, k 282; rows b/12, b/2, b/12, b/12, b/4.
 * Ramp (Fig. 5/6, Tab. 5/6, p12–13): starts at x = c, 1680 px: B px at the lowest code, then
 * one code per pixel (2K) up to the highest, D px at the highest. Other sizes are scaled from
 * 2K (exact for 3840×2160, where Tab. 1/5/6 double every width).
 */
export function bt2111Raster(kind: Bt2111Kind, w: number, h: number): CodeRaster {
  const T = BT2111[kind], sx = w / 1920, sy = h / 1080;
  const r = new CodeRaster(w, h, T.lo);
  const g3 = (v: number): Code3 => [v, v, v];
  const X = (px2k: number) => Math.round(px2k * sx), Y = (px2k: number) => Math.round(px2k * sy);
  const rows = [0, 90, 630, 720, 810, 1080].map(Y);
  const hi = T.hi, lo = T.lo, bar = T.bar;
  // columns of rows 1–3: c, d, d, d, e, d, d, d, c
  const colW = [240, 206, 206, 206, 204, 206, 206, 206, 240];
  const cols = colW.reduce((a, v) => [...a, a[a.length - 1] + v], [0]).map(X);
  const top: Code3[] = [[hi, hi, hi], [hi, hi, lo], [lo, hi, hi], [lo, hi, lo], [hi, lo, hi], [hi, lo, lo], [lo, lo, hi]];
  const mid: Code3[] = top.map((c) => c.map((v) => (v === hi ? bar : lo)) as Code3);
  r.fill(cols[0], rows[0], cols[1], rows[2], g3(T.grey));
  r.fill(cols[8], rows[0], cols[9], rows[2], g3(T.grey));
  for (let i = 0; i < 7; i++) {
    r.fill(cols[i + 1], rows[0], cols[i + 2], rows[1], top[i]);
    r.fill(cols[i + 1], rows[1], cols[i + 2], rows[2], mid[i]);
  }
  // row 3: side whites, first step (−7 % or 0 %), then two steps per bar
  r.fill(cols[0], rows[2], cols[1], rows[3], g3(T.sideWhite));
  r.fill(cols[8], rows[2], cols[9], rows[3], g3(T.sideWhite));
  r.fill(cols[1], rows[2], cols[2], rows[3], g3(T.first));
  for (let i = 0; i < 6; i++) {
    const x0 = cols[i + 2], x1 = cols[i + 3], xm = Math.round((x0 + x1) / 2);
    r.fill(x0, rows[2], xm, rows[3], g3(T.steps[i * 2]));
    r.fill(xm, rows[2], x1, rows[3], g3(T.steps[i * 2 + 1]));
  }
  // row 4: 0 % black under the left grey, ramp from x = c to the right edge
  r.fill(0, rows[3], X(240), rows[4], g3(lo));
  const B = T.ramp.B * sx;
  for (let x = X(240); x < w; x++) {
    const t = x - X(240);
    r.fill(x, rows[3], x + 1, rows[4], g3(t < B ? T.rampLo : Math.min(T.rampHi, T.rampLo + 1 + Math.floor((t - B) / sx))));
  }
  // row 5: 709 bars (c/3 each), blacks f g h g h g i, white j, black k, 709 bars
  const b5 = [80, 80, 80, 136, 70, 68, 70, 68, 70, 238, 438, 282, 80, 80, 80];
  const xs = b5.reduce((a, v) => [...a, a[a.length - 1] + v], [0]).map(X);
  const K = T.black, b = T.b709;
  const row5: Code3[] = [b.y, b.c, b.g, g3(lo), g3(K.m2), g3(lo), g3(K.p2), g3(lo), g3(K.p4), g3(lo), g3(bar), g3(lo), b.m, b.r, b.b] as Code3[];
  row5.forEach((c, i) => r.fill(xs[i], rows[4], xs[i + 1], rows[5], c));
  return r;
}

// ---------------------------------------------------------------- ITU-R BT.814-4 PLUGE

/**
 * PLUGE after ITU-R BT.814-4 Annex 2 (Fig. 2, Tab. 2–5, p5–9), positions scaled from the
 * HDTV sample/line numbers (inclusive; progressive lines 42–1121 → rows 0–1079).
 * Boxes [x, y, w, h, 10-bit code] on black (64): 10-line stripes lighter (80, upper half) and
 * darker (48, lower half) on the left, the Higher-level box in the centre, broad lighter/darker
 * boxes on the right. SDR: Higher level 940, HDR: 399 (Tab. 3).
 */
export function plugeBoxes(w: number, h: number, higher: number): [number, number, number, number, number][] {
  const X = (s: number) => (s / 1920) * w, Y = (l: number) => ((l - 42) / 1080) * h;
  const box = (s0: number, s1: number, l0: number, l1: number, c: number): [number, number, number, number, number] =>
    [X(s0), Y(l0), X(s1 + 1) - X(s0), Y(l1 + 1) - Y(l0), c];
  const [Sb, Sc, Sd, Se, Sf, Sg] = [312, 599, 888, 1031, 1320, 1607];
  const [Lb, Lc, Ld, Le, Lf, Lg, Lh, Li] = [366, 387, 509, 510, 653, 654, 776, 797];
  const out: [number, number, number, number, number][] = [];
  for (let l = Lc; l <= Lh; l += 20) out.push(box(Sb, Sc, l, Math.min(Lh, l + 9), l >= Le ? 48 : 80));
  out.push(box(Sd, Se, Le, Lf, higher), box(Sf, Sg, Lb, Ld, 80), box(Sf, Sg, Lg, Li, 48));
  return out;
}

export function plugeRaster(w: number, h: number, higher: number) {
  const r = new CodeRaster(w, h, 64);
  for (const [x, y, bw, bh, c] of plugeBoxes(w, h, higher)) r.fill(x, y, x + bw, y + bh, [c, c, c]);
  return r;
}

/** Note shown for patterns whose exact codes only reach the scopes. */
export const NOTE_16 = 'Scopes: exakte 10-bit-Codes (16-bit-Y′CbCr-Pfad). Ausgabefenster: exakte Codes auf float16-Canvas, wo verfügbar; Pegel Full schneidet unter 0 % / über 100 % ab, „Codes 1:1“ (Taste R) behält sie.';

export interface Pattern16 { id: string; name: string; transfer?: 'pq' | 'hlg'; colorspace: Colorspace; full: boolean; raster: (w: number, h: number) => CodeRaster }

export const PATTERNS_16: Pattern16[] = [
  { id: 'bt2111-hlg', name: 'BT.2111-3 HDR-Balken HLG (narrow)', transfer: 'hlg', colorspace: '2020', full: false, raster: (w, h) => bt2111Raster('hlg', w, h) },
  { id: 'bt2111-pq', name: 'BT.2111-3 HDR-Balken PQ (narrow)', transfer: 'pq', colorspace: '2020', full: false, raster: (w, h) => bt2111Raster('pq', w, h) },
  { id: 'bt2111-pqfull', name: 'BT.2111-3 HDR-Balken PQ (full)', transfer: 'pq', colorspace: '2020', full: true, raster: (w, h) => bt2111Raster('pqfull', w, h) },
];

/** 16-bit frames for the existing BT.814 PLUGE patterns (ids in patterns.ts). */
export const PLUGE_16: Record<string, { higher: number; colorspace: Colorspace }> = {
  pluge: { higher: 940, colorspace: '709' },
  'pluge-hlg': { higher: 399, colorspace: '2020' },
  'pluge-pq': { higher: 399, colorspace: '2020' },
};
