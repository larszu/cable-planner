// Loudness after ITU-R BS.1770-5 and EBU Tech 3341 (“EBU Mode”):
//   M = 0.4 s sliding window, S = 3 s sliding window, both ungated;
//   I = gated blocks of 400 ms with 75 % overlap (100 ms step), absolute gate −70 LKFS,
//       relative gate −10 LU below the loudness of the blocks above the absolute gate;
//   LRA after Tech 3342 from S values at 10 Hz (see lra.ts).
// The signal is K-weighted (kweight.ts) and summed as energy in 10 ms sub-blocks. M and S
// move in 10 ms steps, so Max M / Max S also catch windows that do not start on a 100 ms
// grid (Tech 3341 cases 10, 11, 13, 14). Gating blocks and S values for LRA are taken every
// 10 sub-blocks (= 100 ms) counted from the reset.

import { KFilter } from './kweight';
import { loudnessRange } from './lra';

/**
 * Channel weights G_i of BS.1770-5 Table 3 in ffmpeg/WAV channel order:
 * L, R, C = 1.0; Ls, Rs = 1.41; LFE is not measured (0).
 * Layouts beyond 5.1 get 1.0 per channel (not covered by Table 3 here).
 */
export function channelWeights(channels: number, layout = ''): number[] {
  const l = layout.toLowerCase();
  if (channels === 6) return [1, 1, 1, 0, 1.41, 1.41]; // FL FR FC LFE BL|SL BR|SR
  if (channels === 5) return [1, 1, 1, 1.41, 1.41]; // 5.0: FL FR FC BL|SL BR|SR
  if (channels === 4 && (l === 'quad' || l.startsWith('quad'))) return [1, 1, 1.41, 1.41];
  if (channels === 3 && l === '2.1') return [1, 1, 0];
  return Array.from({ length: channels }, () => 1);
}

export const ABS_GATE = -70;
export const REL_GATE = -10;
const SUB_PER_SECOND = 100; // 10 ms sub-blocks
const M_SUBS = 40, S_SUBS = 300, STEP_SUBS = 10;

export const lufs = (meanPower: number) => (meanPower > 0 ? -0.691 + 10 * Math.log10(meanPower) : -Infinity);

class Growable {
  data = new Float64Array(1024);
  length = 0;
  push(v: number) {
    if (this.length === this.data.length) { const d = new Float64Array(this.data.length * 2); d.set(this.data); this.data = d; }
    this.data[this.length++] = v;
  }
  clear() { this.length = 0; }
}

export class LoudnessMeter {
  readonly fs: number;
  readonly channels: number;
  readonly weights: number[];
  private filters: KFilter[];
  private ringE = new Float64Array(S_SUBS);
  private ringN = new Float64Array(S_SUBS);
  private ringPos = 0;
  private acc = 0;
  private accN = 0;
  /** Samples since reset and the sample count at which the current sub-block ends. */
  private samples = 0;
  private nextEdge = 0;
  private subs = 0;
  /** Sub-blocks since the full reset (sample clock of nextEdge). */
  private subIndex = 0;
  private blocks = new Growable();
  private shortTerms = new Growable();
  private cacheI: number | null = null;
  private cacheLRA: { at: number; v: number | null } = { at: -1, v: null };

  momentary = -Infinity;
  shortTerm = -Infinity;
  maxM = -Infinity;
  maxS = -Infinity;
  paused = false;
  /** Called after every 100 ms step with the current M and S (for the history). */
  onStep: ((m: number, s: number) => void) | null = null;

  constructor(fs: number, channels: number, layout = '') {
    this.fs = fs; this.channels = channels;
    this.weights = channelWeights(channels, layout);
    this.filters = Array.from({ length: channels }, () => new KFilter(fs));
    this.reset(true);
  }

  /** Reset I, LRA, Max M and Max S together (Tech 3341). `full` also clears the M/S windows. */
  reset(full = false) {
    this.blocks.clear(); this.shortTerms.clear();
    this.cacheI = null; this.cacheLRA = { at: -1, v: null };
    this.maxM = -Infinity; this.maxS = -Infinity;
    this.subs = 0;
    if (full) {
      this.filters.forEach((f) => f.reset());
      this.ringE.fill(0); this.ringN.fill(this.fs / SUB_PER_SECOND);
      this.acc = 0; this.accN = 0; this.samples = 0; this.subIndex = 0; this.nextEdge = this.edge(1);
      this.momentary = -Infinity; this.shortTerm = -Infinity;
    }
  }

  private edge(k: number) { return Math.round((k * this.fs) / SUB_PER_SECOND); }

  /** Feed n planar samples per channel, starting at `offset`. */
  process(chs: ArrayLike<number>[], n: number, offset = 0) {
    let off = offset;
    const end = offset + n;
    while (off < end) {
      const take = Math.min(end - off, this.nextEdge - this.samples);
      let e = 0;
      for (let c = 0; c < this.channels; c++) {
        const w = this.weights[c];
        const sum = this.filters[c].process(chs[c], off, take); // keep the filter state running even for w = 0
        e += w * sum;
      }
      this.acc += e; this.accN += take;
      this.samples += take; off += take;
      if (this.samples >= this.nextEdge) this.commit();
    }
  }

  private windowPower(len: number) {
    let e = 0, n = 0;
    for (let i = 1; i <= len; i++) {
      const j = (this.ringPos - i + S_SUBS) % S_SUBS;
      e += this.ringE[j]; n += this.ringN[j];
    }
    return n > 0 ? e / n : 0;
  }

  private commit() {
    this.ringE[this.ringPos] = this.acc; this.ringN[this.ringPos] = this.accN;
    this.ringPos = (this.ringPos + 1) % S_SUBS;
    this.acc = 0; this.accN = 0;
    this.subs++; this.subIndex++;
    this.nextEdge = this.edge(this.subIndex + 1);
    const pm = this.windowPower(M_SUBS), ps = this.windowPower(S_SUBS);
    this.momentary = lufs(pm); this.shortTerm = lufs(ps);
    if (this.paused) return;
    if (this.subs >= M_SUBS && this.momentary > this.maxM) this.maxM = this.momentary;
    if (this.subs >= S_SUBS && this.shortTerm > this.maxS) this.maxS = this.shortTerm;
    if (this.subs % STEP_SUBS === 0) {
      if (this.subs >= M_SUBS) { this.blocks.push(pm); this.cacheI = null; }
      if (this.subs >= S_SUBS) this.shortTerms.push(this.shortTerm);
      this.onStep?.(this.momentary, this.shortTerm);
    }
  }

  /** Seconds that went into I (gating blocks at 100 ms steps). */
  get measuredSeconds() { return this.subs / SUB_PER_SECOND; }

  /** Integrated loudness in LUFS (recomputed from all stored blocks: the relative gate moves). */
  get integrated(): number {
    if (this.cacheI !== null) return this.cacheI;
    const b = this.blocks.data, n = this.blocks.length;
    const absE = 10 ** ((ABS_GATE + 0.691) / 10);
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) if (b[i] > absE) { sum += b[i]; cnt++; }
    if (!cnt) return (this.cacheI = -Infinity);
    const relE = 10 ** ((lufs(sum / cnt) + REL_GATE + 0.691) / 10);
    sum = 0; cnt = 0;
    for (let i = 0; i < n; i++) if (b[i] > absE && b[i] > relE) { sum += b[i]; cnt++; }
    return (this.cacheI = cnt ? lufs(sum / cnt) : -Infinity);
  }

  /** Loudness range in LU (null without enough data). Cached per S value. */
  get lra(): number | null {
    if (this.cacheLRA.at !== this.shortTerms.length) {
      this.cacheLRA = { at: this.shortTerms.length, v: loudnessRange(this.shortTerms.data, this.shortTerms.length) };
    }
    return this.cacheLRA.v;
  }
}
