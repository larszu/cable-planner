// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Stereo field per frequency band (#186): width, balance, correlation and energy per
// third-octave (or octave) band, plus mono compatibility as one number.
//
// From the Hann spectra L(k), R(k) of the same window, per band (bins weighted by their
// overlap with the band, weighting.ts bandPowers):
//   P_L = Σ|L|², P_R = Σ|R|², X = Σ Re(L·R*)
//   P_M = (P_L + P_R + 2X)/4  (M = (L+R)/2),  P_S = (P_L + P_R − 2X)/4  (S = (L−R)/2)
// The three sums are averaged exponentially over time (time constant = correlation window
// of the panel), then
//   correlation r = X / √(P_L·P_R)     the band-limited form of the correlation of the
//                                      phase meter, r = Σ(L·R)/√(ΣL²·ΣR²) (meters.ts); by
//                                      Parseval both agree for one band covering everything
//   width       w = P_S / (P_M + P_S)  0 = mono, ½ = uncorrelated, 1 = out of phase
//   balance     b = (P_R − P_L)/(P_R + P_L)  −1 = left only, +1 = right only
// There is no freely available standard for a per-band correlation meter; these
// definitions are our own (docs/research/audio.md i).
//
// Mono compatibility: level change of the mono sum against the stereo programme, both
// K-weighted after ITU-R BS.1770-5 (kweight.ts):
//   ΔL = 10 lg( Σ g_k·P_M,k / Σ g_k·(P_L,k + P_R,k)/2 )
// 0 dB = mono, −3 dB = fully uncorrelated, −∞ = out of phase. Own definition as above.

import { windowedSpectrum } from './fft';
import { kWeightingPowerGain } from './kweight';
import type { Band } from './weighting';

export interface BandSums { pl: Float64Array; pr: Float64Array; x: Float64Array }

/** Per-band sums of one window of L and R (n = power of two). */
export function bandSums(l: ArrayLike<number>, r: ArrayLike<number>, n: number, fs: number, bands: Band[]): BandSums {
  const L = windowedSpectrum(l, 0, n), R = windowedSpectrum(r, 0, n), df = fs / n, top = L.re.length - 1;
  const out: BandSums = { pl: new Float64Array(bands.length), pr: new Float64Array(bands.length), x: new Float64Array(bands.length) };
  bands.forEach((bd, i) => {
    const k0 = Math.max(1, Math.floor(bd.lo / df + 0.5)), k1 = Math.min(top, Math.floor(bd.hi / df + 0.5));
    let pl = 0, pr = 0, x = 0;
    for (let k = k0; k <= k1; k++) {
      const ov = (Math.min(bd.hi, (k + 0.5) * df) - Math.max(bd.lo, (k - 0.5) * df)) / df;
      if (ov <= 0) continue;
      const lr = L.re[k], li = L.im[k], rr = R.re[k], ri = R.im[k];
      pl += (lr * lr + li * li) * ov; pr += (rr * rr + ri * ri) * ov; x += (lr * rr + li * ri) * ov;
    }
    // Hann equivalent noise bandwidth: 1.5 bins (see bandPowers)
    out.pl[i] = pl / 1.5; out.pr[i] = pr / 1.5; out.x[i] = x / 1.5;
  });
  return out;
}

/** Exponential average of band sums in place: acc = a·acc + (1−a)·now. */
export function averageSums(acc: BandSums, now: BandSums, a: number) {
  for (const k of ['pl', 'pr', 'x'] as const) for (let i = 0; i < acc[k].length; i++) acc[k][i] = a * acc[k][i] + (1 - a) * now[k][i];
}

export interface BandField {
  fm: number;
  /** band energy (L + R)/2 relative to a full-scale sine, dB */
  db: number;
  corr: number | null;
  width: number | null;
  balance: number | null;
}

const SILENT = 1e-12; // −120 dB

export function bandField(s: BandSums, bands: Band[]): BandField[] {
  return bands.map((b, i) => {
    const pl = s.pl[i], pr = s.pr[i], x = s.x[i], p = (pl + pr) / 2;
    if (p < SILENT) return { fm: b.fm, db: -120, corr: null, width: null, balance: null };
    const pm = (pl + pr + 2 * x) / 4, ps = (pl + pr - 2 * x) / 4;
    return {
      fm: b.fm, db: 10 * Math.log10(p),
      corr: pl > SILENT && pr > SILENT ? Math.max(-1, Math.min(1, x / Math.sqrt(pl * pr))) : null,
      width: Math.max(0, Math.min(1, ps / Math.max(SILENT, pm + ps))),
      balance: (pr - pl) / (pr + pl),
    };
  });
}

/** Correlation over all bands together (same as the phase meter over the window). */
export function totalCorrelation(s: BandSums): number | null {
  let pl = 0, pr = 0, x = 0;
  for (let i = 0; i < s.pl.length; i++) { pl += s.pl[i]; pr += s.pr[i]; x += s.x[i]; }
  return pl > SILENT && pr > SILENT ? Math.max(-1, Math.min(1, x / Math.sqrt(pl * pr))) : null;
}

/** Mono compatibility ΔL in dB (K-weighted), null without signal; −Infinity when the sum cancels. */
export function monoLossDb(s: BandSums, bands: Band[], fs: number): number | null {
  let mono = 0, st = 0;
  bands.forEach((b, i) => {
    const g = kWeightingPowerGain(b.fm, fs);
    mono += g * (s.pl[i] + s.pr[i] + 2 * s.x[i]) / 4;
    st += g * (s.pl[i] + s.pr[i]) / 2;
  });
  if (st < SILENT) return null;
  return mono > 0 ? 10 * Math.log10(mono / st) : -Infinity;
}
