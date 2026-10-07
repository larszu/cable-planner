// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Colorimetry for display verification: targets (BT.1886, gamma, sRGB, PQ), ΔE00/ΔITP per
// patch, statistics, CCT/Duv. Sources in docs/research/display-kalibrierung.md.

import {
  GAMUTS, D65, deltaE2000, deltaEITP, gammaEotf, inv3, mul3, pqDecode, rgb2020ToIctcp, rgbToXyzMatrix, xyToXyz, xyzToLab,
  type GamutId, type XY,
} from '../color';

export type XYZ = [number, number, number];

export const xyzToXy = ([X, Y, Z]: number[]): XY => { const s = X + Y + Z; return s > 0 ? [X / s, Y / s] : [D65[0], D65[1]]; };
export const xyYToXyz = (x: number, y: number, Y: number): XYZ => (y > 0 ? [(x * Y) / y, Y, ((1 - x - y) * Y) / y] : [0, 0, 0]);
/** Absolute XYZ of a chromaticity at luminance Y. */
export const whiteXyz = (xy: XY, Y: number): XYZ => xyToXyz(xy).map((v) => v * Y) as XYZ;

/**
 * BT.1886 Annex 1 EOTF with measured white Lw and black Lb (cd/m²), γ = 2.4:
 * L = a·max(V + b, 0)^γ, a = (Lw^(1/γ) − Lb^(1/γ))^γ, b = Lb^(1/γ)/(Lw^(1/γ) − Lb^(1/γ)).
 */
export function bt1886(v: number, lw: number, lb: number, gamma = 2.4) {
  const w = Math.pow(lw, 1 / gamma), k = Math.pow(Math.max(0, lb), 1 / gamma);
  const a = Math.pow(w - k, gamma), b = k / (w - k);
  return a * Math.pow(Math.max(v + b, 0), gamma);
}

export type SdrTarget = 'bt1886' | 'g22' | 'g24' | 'srgb';
export type TargetTransfer = SdrTarget | 'pq';
export const TARGET_LABELS: Record<TargetTransfer, string> = {
  bt1886: 'BT.1886 (γ 2,4, mit gemessenem Schwarz)', g24: 'Gamma 2,4 (Schwarz-Offset)', g22: 'Gamma 2,2 (Schwarz-Offset)', srgb: 'sRGB', pq: 'PQ ST 2084 (absolut)',
};

export interface Target { transfer: TargetTransfer; gamut: GamutId; white: XY }

/** Displayed luminance factor per channel for a signal level (cd/m²). */
export function targetChannel(t: TargetTransfer, v: number, lw: number, lb: number): number {
  switch (t) {
    case 'bt1886': return bt1886(v, lw, lb);
    case 'g24': return lb + (lw - lb) * Math.pow(Math.max(0, v), 2.4);
    case 'g22': return lb + (lw - lb) * Math.pow(Math.max(0, v), 2.2);
    case 'srgb': return lb + (lw - lb) * gammaEotf('srgb', v);
    case 'pq': return pqDecode(v);
  }
}

/** Target XYZ (cd/m²) of an R'G'B' signal. SDR uses the measured white/black luminance. */
export function targetXyz(rgb: number[], t: Target, lw: number, lb: number): XYZ {
  const g = { ...GAMUTS[t.gamut], white: t.white };
  return mul3(rgbToXyzMatrix(g), rgb.map((v) => targetChannel(t.transfer, v, lw, lb))) as XYZ;
}

const M2020_INV = inv3(rgbToXyzMatrix(GAMUTS['2020']));
/** ICtCp of an absolute XYZ (cd/m²) via linear BT.2020 RGB (BT.2124 procedure). */
export const xyzToIctcp = (xyz: number[]) => rgb2020ToIctcp(mul3(M2020_INV, xyz));

export interface PatchDelta { dE00: number; dITP: number; dL: number; dC: number; dH: number }

/** ΔE00 in Lab relative to `refWhite` (absolute XYZ) plus ΔITP on absolute values. */
export function patchDelta(measured: number[], target: number[], refWhite: number[]): PatchDelta {
  const lm = xyzToLab(measured, refWhite), lt = xyzToLab(target, refWhite);
  const cm = Math.hypot(lm[1], lm[2]), ct = Math.hypot(lt[1], lt[2]);
  const dE76sq = (lm[0] - lt[0]) ** 2 + (lm[1] - lt[1]) ** 2 + (lm[2] - lt[2]) ** 2;
  const dL = lm[0] - lt[0], dC = cm - ct;
  return {
    dE00: deltaE2000(lt, lm), dITP: deltaEITP(xyzToIctcp(measured), xyzToIctcp(target)),
    dL, dC, dH: Math.sqrt(Math.max(0, dE76sq - dL * dL - dC * dC)),
  };
}

// ---------------------------------------------------------------- statistics

/** Percentile with linear interpolation between order statistics (numpy default), p in 0…100. */
export function percentile(values: number[], p: number) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const r = (p / 100) * (v.length - 1), lo = Math.floor(r), hi = Math.ceil(r);
  return v[lo] + (v[hi] - v[lo]) * (r - lo);
}
export interface Stats { n: number; mean: number; max: number; median: number; p95: number }
export function stats(values: number[]): Stats {
  const v = values.filter(Number.isFinite);
  return {
    n: v.length, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN,
    max: v.length ? Math.max(...v) : NaN, median: percentile(v, 50), p95: percentile(v, 95),
  };
}

/** Pass levels: nominal / recommended (DisplayCAL "Default", docs/research/colour-repos.md). */
export const DE00_LIMITS = { mean: [1.5, 1], max: [4, 3], white: [2, 1] } as const;
export type Grade = 'gut' | 'ok' | 'aus';
/** 'gut' = within recommended, 'ok' = within nominal, 'aus' = outside. */
export const grade = (v: number, [nominal, recommended]: readonly [number, number]): Grade => (v <= recommended ? 'gut' : v <= nominal ? 'ok' : 'aus');

// ---------------------------------------------------------------- CCT / Duv

// Planckian locus in CIE 1960 uv, Krystek (1985) rational approximation, valid 1000–15 000 K.
// Coefficients from alwan src/alwan/data/planckian_locus_krystek_{u,v}.csv (MIT, Copyright (c)
// 2025 Soufiane KHIAT, licenses/alwan-LICENSE.txt). The search below is our own.
const KU = [0.860117757, 1.54118254e-4, 1.28641212e-7, 1, 8.42420235e-4, 7.08145163e-7];
const KV = [0.317398726, 4.22806245e-5, 4.20481691e-8, 1, -2.89741816e-5, 1.61456053e-7];
export function planckUv(T: number): [number, number] {
  const r = (k: number[]) => (k[0] + k[1] * T + k[2] * T * T) / (k[3] + k[4] * T + k[5] * T * T);
  return [r(KU), r(KV)];
}
/** CIE 1960 UCS u, v from xy. */
export const xyToUv60 = ([x, y]: XY): [number, number] => { const d = -2 * x + 12 * y + 3; return [(4 * x) / d, (6 * y) / d]; };

/**
 * Correlated colour temperature and Duv: the locus point closest to (u, v) in CIE 1960 UCS,
 * searched in mired (golden section). Duv > 0 above the locus (greenish), < 0 below (magenta).
 * Outside 1000–15 000 K the result is clamped to the range edge (`inRange` false).
 */
export function cctDuv(xy: XY): { cct: number; duv: number; inRange: boolean } {
  const [u, v] = xyToUv60(xy);
  const dist = (mired: number) => { const [pu, pv] = planckUv(1e6 / mired); return Math.hypot(u - pu, v - pv); };
  let a = 1e6 / 15000, b = 1e6 / 1000;
  // coarse scan first (the distance has one minimum along the locus, but be safe)
  let best = a, bd = Infinity;
  for (let m = a; m <= b; m += 2) { const d = dist(m); if (d < bd) { bd = d; best = m; } }
  a = Math.max(1e6 / 15000, best - 2); b = Math.min(1e6 / 1000, best + 2);
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  for (let i = 0; i < 60; i++) {
    if (dist(c) < dist(d)) b = d; else a = c;
    c = b - g * (b - a); d = a + g * (b - a);
  }
  const m = (a + b) / 2, T = 1e6 / m, [pu, pv] = planckUv(T);
  const duv = Math.sign(v - pv) * Math.hypot(u - pu, v - pv);
  return { cct: T, duv, inRange: m > 1e6 / 15000 + 0.01 && m < 1e6 / 1000 - 0.01 };
}
