// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Noise meter (scope-wuensche.md wish 5): random noise of Y′, R′, G′, B′ in the measuring frame,
// as on a waveform monitor's noise option (Leader LV5490SER10: "Select one of Y / G / B / R",
// measuring window "as flat as possible", level in mVrms or dB). Pure functions, no DOM
// (test/noise.test.ts); derivation in docs/research/kamera-messwerkzeuge.md.
//
//   σ      RMS deviation of the samples from their mean – or, with `detrend`, from a fitted
//          quadratic surface (surface.ts), the stand-in for the monitor's high-pass filter that
//          keeps lens shading and slow gradients out of the noise figure
//   mV     σ × 700 mV (100 % = 700 mV, nominal HD/SD video white)
//   dB     20·log10(σ) relative to 100 %, so −50 dB = 0.32 % noise; S/N = −dB

import { fitSurface, norm, surfaceAt } from './surface';
import type { Decode } from './ycbcr';
import type { Rect4 } from './focus';

export const NOISE_CHANNELS = ['Y', 'R', 'G', 'B'] as const;
export type NoiseChannel = (typeof NOISE_CHANNELS)[number];
export interface ChannelNoise { mean: number; sigma: number; mv: number; db: number }
export type NoiseResult = Record<NoiseChannel, ChannelNoise> & { n: number; w: number; h: number };

/** Y′, R′, G′, B′ planes of `rect` (full resolution, a region above `maxPixels` is cut to its centre). */
export function channelPlanes(px: ArrayLike<number>, w: number, decode: Decode, kr: number, kb: number, rect: Rect4, maxPixels = 250_000) {
  let [x0, y0, x1, y1] = rect;
  const k = Math.sqrt(Math.max(1, ((x1 - x0) * (y1 - y0)) / maxPixels));
  if (k > 1) {
    const cw = Math.floor((x1 - x0) / k), ch = Math.floor((y1 - y0) / k);
    x0 += Math.floor((x1 - x0 - cw) / 2); y0 += Math.floor((y1 - y0 - ch) / 2); x1 = x0 + cw; y1 = y0 + ch;
  }
  const W = Math.max(0, x1 - x0), H = Math.max(0, y1 - y0), kg = 1 - kr - kb;
  const planes = { Y: new Float32Array(W * H), R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [r, g, b] = decode(px, ((y + y0) * w + x + x0) * 4), i = y * W + x;
    planes.R[i] = r; planes.G[i] = g; planes.B[i] = b; planes.Y[i] = kr * r + kg * g + kb * b;
  }
  return { planes, w: W, h: H };
}

/** dB relative to 100 % of an RMS level; −Infinity for zero. */
export const toDb = (sigma: number) => (sigma > 0 ? 20 * Math.log10(sigma) : -Infinity);

/** Noise of one plane: mean and RMS deviation (from the mean or from the fitted surface). */
export function planeNoise(v: Float32Array, w: number, h: number, detrend: boolean): ChannelNoise {
  const n = w * h;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += v[i];
  mean /= Math.max(1, n);
  const s = detrend ? fitSurface(v, w, h, Math.max(1, Math.floor(Math.sqrt(n / 40000)))) : null;
  let q = 0;
  for (let y = 0; y < h; y++) {
    const ny = norm(y, h);
    for (let x = 0; x < w; x++) {
      const ref = s ? surfaceAt(s, norm(x, w), ny) : mean;
      const d = v[y * w + x] - ref;
      q += d * d;
    }
  }
  // the fit uses six degrees of freedom, the mean one
  // below 1e-6 (−120 dB) only rounding of the fit is left: report a noise-free signal as 0
  const raw = Math.sqrt(q / Math.max(1, n - (s ? 6 : 1))), sigma = raw < 1e-6 ? 0 : raw;
  return { mean, sigma, mv: sigma * 700, db: toDb(sigma) };
}

export function measureNoise(p: { planes: Record<NoiseChannel, Float32Array>; w: number; h: number }, detrend = true): NoiseResult | null {
  if (p.w < 4 || p.h < 4) return null;
  const out = { n: p.w * p.h, w: p.w, h: p.h } as NoiseResult;
  for (const c of NOISE_CHANNELS) out[c] = planeNoise(p.planes[c], p.w, p.h, detrend);
  return out;
}

/**
 * Quantisation floor of the signal path: RMS of a uniform rounding error, step/√12, in dB.
 * 8-bit R′G′B′ (step 1/255) ≈ −58.9 dB; 10-bit narrow range (step 1/876) ≈ −69.6 dB.
 */
export function quantFloorDb(bits: number, narrow: boolean): number {
  const step = narrow ? 1 / ((219 << (bits - 8))) : 1 / ((1 << bits) - 1);
  return toDb(step / Math.sqrt(12));
}

/** One text row per channel: level, σ in %, mVrms, dB. */
export function noiseRows(r: NoiseResult, labels: { level: string; sigma: string }): string[] {
  const f = (v: number, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '−∞');
  return [
    `     ${labels.level.padStart(7)} ${labels.sigma.padStart(7)} ${'mVrms'.padStart(7)} ${'dB'.padStart(7)}`,
    ...NOISE_CHANNELS.map((c) => `${(c === 'Y' ? 'Y′' : `${c}′`).padEnd(4)} ${f(r[c].mean * 100).padStart(7)} ${f(r[c].sigma * 100, 2).padStart(7)} ${f(r[c].mv, 2).padStart(7)} ${f(r[c].db).padStart(7)}`),
  ];
}
