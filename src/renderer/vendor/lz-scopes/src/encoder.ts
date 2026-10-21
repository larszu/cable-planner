// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Encoder confidence for streams (idea 8, docs/research/encoder-confidence.md): programme (what
// goes into the encoder) against the return (the decoded stream), live. Pure functions, no DOM.
//
//  - blocking:  Wang, Sheikh & Bovik, ICIP 2002, eq. 2/3/6 – mean difference across the 8×8 block
//               boundaries (B) against the mean difference inside the blocks (A); B/A ≈ 1 = no
//               block structure, > 1 = edges on the 8-pixel grid.
//  - banding:   after CAMBI (Tandon et al. 2021, eq. 3/4), simplified: share of ±k steps (10-bit
//               scale) in flat neighbourhoods at several window sizes, worst 30 % pooled.
//  - delay:     the return's small thumbnails against the programme's, best time lag.
//  - A/V:       the A/V offsets both sources measure from flash and beep (audio/dsp/avsync.ts);
//               the difference is what the stream path adds (BT.1359-1 sign and limits).

import { rateAv, type AvRating } from './audio/dsp/avsync';

// ---------------------------------------------------------------- blocking

export interface Blockiness { B: number; A: number; ratio: number }

/**
 * Blocking of a luma picture (any scale, e.g. 0–255), block size `n` (8 in the paper), grid at
 * the picture origin: horizontal and vertical B and A after Wang/Sheikh/Bovik eq. 2, 3, 6.
 */
export function blockiness(Y: ArrayLike<number>, w: number, h: number, n = 8): Blockiness {
  // horizontal: d_h(i, j) = x(i, j+1) − x(i, j); boundaries at j = n·k (between column n·k−1 and n·k in 0-based terms)
  let bh = 0, nb = 0, all = 0, na = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x + 1 < w; x++) {
    const d = Math.abs(Y[y * w + x + 1] - Y[y * w + x]);
    all += d; na++;
    if ((x + 1) % n === 0) { bh += d; nb++; }
  }
  const Bh = nb ? bh / nb : 0, Ah = na ? ((n * all) / na - Bh) / (n - 1) : 0;
  let bv = 0, nbv = 0, allv = 0, nav = 0;
  for (let y = 0; y + 1 < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(Y[(y + 1) * w + x] - Y[y * w + x]);
    allv += d; nav++;
    if ((y + 1) % n === 0) { bv += d; nbv++; }
  }
  const Bv = nbv ? bv / nbv : 0, Av = nav ? ((n * allv) / nav - Bv) / (n - 1) : 0;
  const B = (Bh + Bv) / 2, A = (Ah + Av) / 2;
  return { B, A, ratio: A > 1e-9 ? B / A : B > 1e-9 ? Infinity : 1 };
}

// ---------------------------------------------------------------- banding (after CAMBI)

export interface BandingOptions {
  /** picture width the 65-px CAMBI window refers to (4k in the paper) */
  refWidth?: number;
  /** gradient threshold in 10-bit codes: neighbours steeper than this are texture (own choice) */
  gradient?: number;
  /** centre spacing in pixels */
  stride?: number;
}

/**
 * Banding index of a picture given in 10-bit codes (integers after the 2×2 low-pass, see
 * `to10bit`): for centres on a grid and windows of 65·v·W/refWidth px (v = 1, 2, 4, 8), CAMBI eq. 3
 * c(k, v) = p(0)·max(p(−k)/(p(0)+p(−k)), p(k)/(p(0)+p(k))) over the flat pixels of the window,
 * summed with weights k·log2(16/v) (eq. 4); mean of the worst 30 % of the centres.
 */
export function bandingIndex(Y10: ArrayLike<number>, w: number, h: number, o: BandingOptions = {}): number {
  const refW = o.refWidth ?? 3840, tg = o.gradient ?? 2, stride = o.stride ?? Math.max(4, Math.round(w / 48));
  const flat = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = Y10[i];
    const gx = x + 1 < w ? Math.abs(Y10[i + 1] - v) : 0, gy = y + 1 < h ? Math.abs(Y10[i + w] - v) : 0;
    flat[i] = Math.max(gx, gy) < tg ? 1 : 0;
  }
  const scores: number[] = [];
  const scales = [1, 2, 4, 8].map((v) => ({ v, r: Math.max(2, Math.round((65 * v * w) / refW / 2)) }));
  for (let cy = stride >> 1; cy < h; cy += stride) for (let cx = stride >> 1; cx < w; cx += stride) {
    const c0 = Y10[cy * w + cx];
    let s = 0;
    for (const { v, r } of scales) {
      const step = Math.max(1, Math.round(r / 8)), cnt = new Map<number, number>();
      let tot = 0;
      for (let y = Math.max(0, cy - r); y <= Math.min(h - 1, cy + r); y += step) for (let x = Math.max(0, cx - r); x <= Math.min(w - 1, cx + r); x += step) {
        const i = y * w + x;
        if (!flat[i]) continue;
        const d = Y10[i] - c0;
        if (d >= -4 && d <= 4) cnt.set(d, (cnt.get(d) ?? 0) + 1);
        tot++;
      }
      if (!tot) continue;
      const p = (k: number) => (cnt.get(k) ?? 0) / tot, p0 = p(0);
      if (p0 <= 0) continue;
      for (let k = 1; k <= 4; k++) {
        const pm = p(-k), pp = p(k);
        const c = p0 * Math.max(pm > 0 ? pm / (p0 + pm) : 0, pp > 0 ? pp / (p0 + pp) : 0);
        s += c * k * Math.log2(16 / v);
      }
    }
    scores.push(s);
  }
  if (!scores.length) return 0;
  scores.sort((a, b) => b - a);
  const n = Math.max(1, Math.round(scores.length * 0.3));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += scores[i];
  return sum / n;
}

/** Luma 0–1 → 10-bit codes after a 2×2 box low-pass, rounded (CAMBI preprocessing, simplified). */
export function to10bit(Y: ArrayLike<number>, w: number, h: number): Int16Array {
  const out = new Int16Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x1 = Math.min(w - 1, x + 1), y1 = Math.min(h - 1, y + 1);
    const m = (Y[y * w + x] + Y[y * w + x1] + Y[y1 * w + x] + Y[y1 * w + x1]) / 4;
    out[y * w + x] = Math.round(Math.max(0, Math.min(1, m)) * 1023);
  }
  return out;
}

// ---------------------------------------------------------------- delay

export interface Thumb { t: number; f: Float32Array }

/**
 * Delay of the return against the programme in ms: for lags 0 … maxMs in `stepMs` steps the mean
 * absolute difference between each return thumbnail and the programme thumbnail nearest to
 * (t − lag); best lag, its error and the contrast to the median error (confidence: the content
 * has to move). null without enough overlap.
 */
export function estimateDelay(prog: Thumb[], ret: Thumb[], o: { maxMs?: number; stepMs?: number } = {}) {
  const maxMs = o.maxMs ?? 8000, step = o.stepMs ?? 10;
  if (prog.length < 4 || ret.length < 4) return null;
  const pt = prog.map((p) => p.t);
  const nearest = (t: number) => {
    let lo = 0, hi = pt.length - 1;
    if (t < pt[0] - 60 || t > pt[hi] + 60) return -1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pt[m] <= t) lo = m; else hi = m; }
    return Math.abs(pt[lo] - t) <= Math.abs(pt[hi] - t) ? lo : hi;
  };
  const errs: { lag: number; e: number }[] = [];
  for (let lag = 0; lag <= maxMs; lag += step) {
    let s = 0, n = 0;
    for (const r of ret) {
      const k = nearest(r.t - lag);
      if (k < 0) continue;
      const a = prog[k].f, b = r.f;
      let d = 0;
      for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]);
      s += d / a.length; n++;
    }
    if (n >= Math.max(4, ret.length / 3)) errs.push({ lag, e: s / n });
  }
  if (errs.length < 3) return null;
  const best = errs.reduce((m, x) => (x.e < m.e ? x : m), errs[0]);
  const sorted = errs.map((x) => x.e).sort((a, b) => a - b), med = sorted[sorted.length >> 1];
  return { ms: best.lag, error: best.e, contrast: med > 1e-9 ? 1 - best.e / med : 0 };
}

// ---------------------------------------------------------------- A/V

/** A/V shift added by the stream path: return offset minus programme offset (BT.1359 sign), rated. */
export function avShift(progMs: number | null, retMs: number | null): { ms: number; rating: AvRating } | null {
  if (progMs === null || retMs === null || !Number.isFinite(progMs) || !Number.isFinite(retMs)) return null;
  const ms = retMs - progMs;
  return { ms, rating: rateAv(ms) };
}
