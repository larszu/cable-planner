// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Focus assist (scope-wuensche.md wish 4): edge peaking in the picture (renderer.ts, picture mode
// 'peaking') and a sharpness value for the measuring frame, with a peak hold so focus can be
// racked to the maximum. Pure functions, no DOM (test/focus.test.ts).
//
// Sharpness = RMS of the Sobel gradient of Y′ inside the region (Tenengrad), the gradient scaled
// so that a hard black-to-white step reads 1.0 at the edge. An own measure, not a standard; it
// depends on the picture content, so only changes on the same framing mean anything (that is what
// the peak hold is for). The picture is measured at its analysis resolution, never resampled:
// scaling would blur the edges the measure looks for.

import type { Decode } from './ycbcr';

export type Rect4 = [number, number, number, number];

/** Region to measure: the measuring frame, otherwise the centre third of the picture. */
export function measureRect(roi: Rect4 | null | undefined, w: number, h: number): Rect4 {
  if (roi) return [Math.max(0, Math.floor(roi[0])), Math.max(0, Math.floor(roi[1])), Math.min(w, Math.ceil(roi[2])), Math.min(h, Math.ceil(roi[3]))];
  return [Math.round(w / 3), Math.round(h / 3), Math.round((2 * w) / 3), Math.round((2 * h) / 3)];
}

/**
 * Y′ of the pixels in `rect` of a frame (R′G′B′ through `decode`), at full resolution; a region
 * above `maxPixels` is cut down to its centre (not scaled).
 */
export function lumaPlane(px: ArrayLike<number>, w: number, decode: Decode, kr: number, kb: number, rect: Rect4, maxPixels = 400_000): { y: Float32Array; w: number; h: number } {
  let [x0, y0, x1, y1] = rect;
  const k = Math.sqrt(Math.max(1, ((x1 - x0) * (y1 - y0)) / maxPixels));
  if (k > 1) {
    const cw = Math.floor((x1 - x0) / k), ch = Math.floor((y1 - y0) / k);
    x0 += Math.floor((x1 - x0 - cw) / 2); y0 += Math.floor((y1 - y0 - ch) / 2); x1 = x0 + cw; y1 = y0 + ch;
  }
  const W = Math.max(0, x1 - x0), H = Math.max(0, y1 - y0), out = new Float32Array(W * H), kg = 1 - kr - kb;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = decode(px, ((y + y0) * w + x + x0) * 4);
    out[y * W + x] = kr * r + kg * g + kb * b;
  }
  return { y: out, w: W, h: H };
}

/** Sobel gradient magnitude at an inner pixel, scaled so a full black→white step gives 1. */
function sobel(y: Float32Array, w: number, i: number) {
  const a = y[i - w - 1], b = y[i - w], c = y[i - w + 1], d = y[i - 1], f = y[i + 1], g = y[i + w - 1], hh = y[i + w], k = y[i + w + 1];
  const gx = (c + 2 * f + k - a - 2 * d - g) / 4, gy = (g + 2 * hh + k - a - 2 * b - c) / 4;
  return Math.hypot(gx, gy);
}

/** RMS Sobel gradient (Tenengrad) of a Y′ plane, × 100. 0 for a flat or too small region. */
export function sharpness(p: { y: Float32Array; w: number; h: number }): number {
  const { y, w, h } = p;
  if (w < 3 || h < 3) return 0;
  let s = 0;
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) { const g = sobel(y, w, r * w + c); s += g * g; }
  return Math.sqrt(s / ((w - 2) * (h - 2))) * 100;
}

/** Share of inner pixels whose gradient exceeds the peaking threshold (what the overlay colours). */
export function peakingShare(p: { y: Float32Array; w: number; h: number }, threshold: number): number {
  const { y, w, h } = p;
  if (w < 3 || h < 3) return 0;
  let n = 0;
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) if (sobel(y, w, r * w + c) > threshold) n++;
  return n / ((w - 2) * (h - 2));
}

/** Peak hold: highest value since reset; a new framing (region change) starts over. */
export class PeakHold {
  private key = '';
  peak = 0;
  update(key: string, v: number) {
    if (key !== this.key) { this.key = key; this.peak = 0; }
    this.peak = Math.max(this.peak, v);
    return this.peak;
  }
  reset() { this.peak = 0; }
}

/** Peaking colours offered in the panel. */
export const PEAK_COLOURS = { red: [1, 0.15, 0.15], yellow: [1, 0.9, 0.1], blue: [0.2, 0.55, 1], white: [1, 1, 1] } as const;
export type PeakColour = keyof typeof PEAK_COLOURS;
export const PEAK_DEFAULT = { threshold: 0.12, colour: 'red' as PeakColour };
