// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Sound level meter on one channel (#187), after IEC 61672-1:2013:
//   - frequency weightings A, C, Z (weighting.ts, §5.5),
//   - exponential time weightings F (τ = 0.125 s) and S (τ = 1 s) (§5.8, eq. (2)):
//       L_τ(t) = 10 lg[ (1/τ) ∫ p²(ξ) e^{−(t−ξ)/τ} dξ / p0² ],
//   - peak sound level L_peak = 20 lg(|p|max / p0) (§3.21, §5.13),
//   - time-averaged level L_eq,T = 10 lg[ (1/T) ∫ p² dt / p0² ] (§3.9).
// Everything is computed on digital full scale; the panel adds the microphone calibration
// `cal` = sound pressure level in dB that a full-scale sine produces (AES17: 0 dBFS). Mean
// square m of the signal → level 10 lg(2m) + cal; instantaneous sample x → peak level
// 20 lg(√2·|x|) + cal (a full-scale sine has |x| = 1 and its RMS at `cal`).
// The 100 ms blocks keep one hour for L_eq over a sliding period and the hold values.

import { WeightingFilter, type Weighting } from './weighting';

export const SPL_BLOCK_S = 0.1;
export const SPL_BLOCKS = 36000; // 1 h
export const TAU = { F: 0.125, S: 1 } as const;
export type TimeWeighting = keyof typeof TAU;
export const WEIGHTINGS: Weighting[] = ['A', 'C', 'Z'];

/** dB of a mean square relative to a full-scale sine (add the calibration for dB SPL). */
export const msDb = (m: number) => (m > 1e-20 ? 10 * Math.log10(2 * m) : -200);
/** dB of an instantaneous peak magnitude, same reference as msDb. */
export const peakDb = (x: number) => (x > 1e-10 ? 20 * Math.log10(Math.SQRT2 * x) : -200);

interface PerWeighting {
  /** exponentially averaged x² for F and S */
  f: number; s: number;
  /** running sums for the current block */
  sum: number; maxF: number; maxS: number; peak: number;
  /** block rings: mean square, max F/S mean square, peak |x| */
  bMs: Float32Array; bF: Float32Array; bS: Float32Array; bPk: Float32Array;
  /** since the last reset: energy sum (Σx²) and largest values */
  total: number; holdF: number; holdS: number; holdPk: number;
}

export class SplMeter {
  readonly fs: number;
  private filters: { A: WeightingFilter; C: WeightingFilter };
  private kF: number; private kS: number;
  readonly w: Record<Weighting, PerWeighting>;
  /** wall-clock time (ms) at the end of each block */
  readonly bTime = new Float64Array(SPL_BLOCKS);
  head = 0; len = 0;
  private inBlock = 0;
  private blockLen: number;
  /** samples since the last reset */
  count = 0;
  startedAt = Date.now();

  constructor(fs: number) {
    this.fs = fs;
    this.filters = { A: new WeightingFilter('A', fs), C: new WeightingFilter('C', fs) };
    this.kF = 1 - Math.exp(-1 / (TAU.F * fs)); this.kS = 1 - Math.exp(-1 / (TAU.S * fs));
    this.blockLen = Math.round(fs * SPL_BLOCK_S);
    const mk = (): PerWeighting => ({
      f: 0, s: 0, sum: 0, maxF: 0, maxS: 0, peak: 0,
      bMs: new Float32Array(SPL_BLOCKS), bF: new Float32Array(SPL_BLOCKS), bS: new Float32Array(SPL_BLOCKS), bPk: new Float32Array(SPL_BLOCKS),
      total: 0, holdF: 0, holdS: 0, holdPk: 0,
    });
    this.w = { A: mk(), C: mk(), Z: mk() };
  }

  process(x: ArrayLike<number>, n: number, now = Date.now()) {
    const A = this.w.A, C = this.w.C, Z = this.w.Z, fa = this.filters.A, fc = this.filters.C, kF = this.kF, kS = this.kS;
    for (let i = 0; i < n; i++) {
      const z = x[i], a = fa.process(z), c = fc.process(z);
      step(A, a, kF, kS); step(C, c, kF, kS); step(Z, z, kF, kS);
      if (++this.inBlock >= this.blockLen) this.endBlock(now - ((n - 1 - i) / this.fs) * 1000);
    }
    this.count += n;
  }

  private endBlock(time: number) {
    const h = this.head;
    for (const k of WEIGHTINGS) {
      const p = this.w[k];
      p.bMs[h] = p.sum / this.inBlock; p.bF[h] = p.maxF; p.bS[h] = p.maxS; p.bPk[h] = p.peak;
      p.total += p.sum;
      p.holdF = Math.max(p.holdF, p.maxF); p.holdS = Math.max(p.holdS, p.maxS); p.holdPk = Math.max(p.holdPk, p.peak);
      p.sum = 0; p.maxF = p.f; p.maxS = p.s; p.peak = 0;
    }
    this.bTime[h] = time;
    this.head = (h + 1) % SPL_BLOCKS; this.len = Math.min(SPL_BLOCKS, this.len + 1);
    this.inBlock = 0;
  }

  /** Current time-weighted mean square. */
  level(w: Weighting, t: TimeWeighting) { return t === 'F' ? this.w[w].f : this.w[w].s; }

  /**
   * Mean square over the last `seconds` (complete 100 ms blocks), or since the reset for
   * seconds ≤ 0. Also returns how many seconds it actually covers.
   */
  leq(w: Weighting, seconds: number): { ms: number; seconds: number } {
    const p = this.w[w];
    if (seconds <= 0) {
      const blocks = this.count - this.inBlock;
      return { ms: blocks > 0 ? p.total / blocks : 0, seconds: blocks / this.fs };
    }
    const n = Math.min(this.len, Math.round(seconds / SPL_BLOCK_S));
    let s = 0;
    for (let i = 1; i <= n; i++) s += p.bMs[(this.head - i + SPL_BLOCKS) % SPL_BLOCKS];
    return { ms: n ? s / n : 0, seconds: n * SPL_BLOCK_S };
  }

  /** Largest time-weighted mean square and peak |x| in the blocks that ended after `since` (ms). */
  maxSince(w: Weighting, t: TimeWeighting, since: number): { ms: number; peak: number } {
    const p = this.w[w], ring = t === 'F' ? p.bF : p.bS;
    let ms = 0, peak = 0;
    for (let i = 1; i <= this.len; i++) {
      const j = (this.head - i + SPL_BLOCKS) % SPL_BLOCKS;
      if (this.bTime[j] <= since) break;
      ms = Math.max(ms, ring[j]); peak = Math.max(peak, p.bPk[j]);
    }
    return { ms, peak };
  }

  /** Time of the newest finished block (ms), 0 before the first one. */
  get lastBlock() { return this.len ? this.bTime[(this.head - 1 + SPL_BLOCKS) % SPL_BLOCKS] : 0; }

  reset() {
    for (const k of WEIGHTINGS) { const p = this.w[k]; p.total = 0; p.holdF = 0; p.holdS = 0; p.holdPk = 0; }
    this.count = this.inBlock; this.len = 0; this.startedAt = Date.now();
  }
}

function step(p: PerWeighting, v: number, kF: number, kS: number) {
  const q = v * v;
  p.f += kF * (q - p.f); p.s += kS * (q - p.s);
  p.sum += q;
  if (p.f > p.maxF) p.maxF = p.f;
  if (p.s > p.maxS) p.maxS = p.s;
  const m = v < 0 ? -v : v;
  if (m > p.peak) p.peak = m;
}
