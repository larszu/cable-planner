// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// White-shading map (scope-wuensche.md wish 7): flatness of Y′ and of each colour channel over an
// evenly lit white or grey field, split into the terms a camera's white-shading menu adjusts –
// saw (linear) and par (parabolic), horizontal and vertical, per R′, G′, B′ (Tektronix app note
// 25W-27159 p. 3–4: "adjust the H and V Saw so that the trace is as flat as possible. Then make
// adjustments of the H and V Par", per channel Green, Red, Blue). Pure functions, no DOM
// (test/whiteShading.test.ts); derivation in docs/research/kamera-messwerkzeuge.md.
//
// Terms from the least-squares surface (surface.ts) c0 + c1·x + c2·y + c3·x² + c4·y² + c5·x·y
// (x, y = −1 … +1, left → right, top → bottom), reported as level differences in % of the mean:
//   saw H = right edge − left edge = 2·c1      saw V = bottom − top = 2·c2
//   par H = edges − centre (horizontal) = c3   par V = edges − centre (vertical) = c4

import { fitSurface, surfaceAt, type Surface } from './surface';
import type { NoiseChannel } from './noise';

export const SHADING_CHANNELS = ['Y', 'R', 'G', 'B'] as const satisfies readonly NoiseChannel[];
export type ShadingChannel = (typeof SHADING_CHANNELS)[number];
export interface ShadingTerms {
  mean: number;
  /** relative to the channel mean (0.01 = 1 %) */
  sawH: number; sawV: number; parH: number; parV: number; diag: number;
  /** spread of the fitted surface over the field, max − min, relative to the mean */
  flatness: number;
  surface: Surface;
}
export type ShadingResult = Record<ShadingChannel, ShadingTerms> & {
  /** cell means per channel (gx × gy, row-major) for the map */
  grid: Record<ShadingChannel, Float32Array>; gx: number; gy: number;
};

/** Terms of one plane. */
export function shadingTerms(v: Float32Array, w: number, h: number): ShadingTerms | null {
  const s = fitSurface(v, w, h, Math.max(1, Math.floor(Math.sqrt((w * h) / 60000))));
  if (!s) return null;
  let mean = 0;
  for (let i = 0; i < v.length; i++) mean += v[i];
  mean /= v.length;
  const m = Math.abs(mean) > 1e-6 ? mean : 1;
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    const z = surfaceAt(s, i / 4 - 1, j / 4 - 1);
    lo = Math.min(lo, z); hi = Math.max(hi, z);
  }
  return { mean, sawH: (2 * s[1]) / m, sawV: (2 * s[2]) / m, parH: s[3] / m, parV: s[4] / m, diag: s[5] / m, flatness: (hi - lo) / m, surface: s };
}

/** Cell means of a plane on a gx × gy grid. */
export function cellMeans(v: Float32Array, w: number, h: number, gx: number, gy: number): Float32Array {
  const sum = new Float64Array(gx * gy), cnt = new Float64Array(gx * gy);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(gy - 1, Math.floor((y * gy) / h));
    for (let x = 0; x < w; x++) { const c = cy * gx + Math.min(gx - 1, Math.floor((x * gx) / w)); sum[c] += v[y * w + x]; cnt[c]++; }
  }
  return Float32Array.from(sum, (s, i) => (cnt[i] ? s / cnt[i] : 0));
}

export function analyseShading(p: { planes: Record<ShadingChannel, Float32Array>; w: number; h: number }, gx = 16, gy = 9): ShadingResult | null {
  if (p.w < 8 || p.h < 8) return null;
  const out = { gx, gy, grid: {} } as ShadingResult;
  for (const c of SHADING_CHANNELS) {
    const tr = shadingTerms(p.planes[c], p.w, p.h);
    if (!tr) return null;
    out[c] = tr;
    out.grid[c] = cellMeans(p.planes[c], p.w, p.h, gx, gy);
  }
  return out;
}

/**
 * Value of a map cell, as a deviation in % points of the channel mean:
 * 'Y'/'R'/'G'/'B' = level − mean; 'colour' = [R′ − G′, B′ − G′] relative to the field's own balance.
 */
export function cellDeviation(r: ShadingResult, ch: ShadingChannel, i: number) {
  return (r.grid[ch][i] - r[ch].mean) / (r[ch].mean || 1);
}
export function cellColour(r: ShadingResult, i: number): [number, number] {
  const g = r.grid.G[i] || 1e-6;
  return [r.grid.R[i] / g - r.R.mean / (r.G.mean || 1e-6), r.grid.B[i] / g - r.B.mean / (r.G.mean || 1e-6)];
}

/** Map colour for a deviation d (fraction) at full scale `scale`: blue below, neutral, warm above. */
export function rampColour(d: number, scale: number): [number, number, number] {
  const k = Math.max(-1, Math.min(1, d / scale));
  return k >= 0 ? [0.5 + 0.5 * k, 0.5 + 0.2 * k, 0.5 - 0.4 * k] : [0.5 + 0.4 * k, 0.5 + 0.2 * k, 0.5 - 0.5 * k];
}

/** Text rows: per channel saw/par H/V and flatness in % points. */
export function shadingRows(r: ShadingResult, head: { flat: string }): string[] {
  const f = (v: number) => `${v < -0.00005 ? '−' : '+'}${Math.abs(v * 100).toFixed(2)}`;
  return [
    `     ${'Saw H'.padStart(7)} ${'Saw V'.padStart(7)} ${'Par H'.padStart(7)} ${'Par V'.padStart(7)} ${head.flat.padStart(7)}`,
    ...SHADING_CHANNELS.map((c) => `${(c === 'Y' ? 'Y′' : `${c}′`).padEnd(4)} ${f(r[c].sawH).padStart(7)} ${f(r[c].sawV).padStart(7)} ${f(r[c].parH).padStart(7)} ${f(r[c].parV).padStart(7)} ${(r[c].flatness * 100).toFixed(2).padStart(7)}`),
  ];
}

