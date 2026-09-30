// Level meters on 10 ms sub-blocks: sample peak, true peak (truepeak.ts), clip counter,
// correlation of channels 1/2 and a simple polarity indicator. Everything is kept in a
// 3 s ring so every panel can read its own window without extra state.
//
// Correlation: r = Σ(L·R) / √(ΣL²·ΣR²) over a sliding window. There is no freely
// available normative definition (docs/research/audio.md c.8), so the window is a
// setting of the phase panel.

import { TruePeak } from './truepeak';

export const SUBS = 300; // 3 s of 10 ms sub-blocks

export class LevelMeter {
  readonly fs: number;
  readonly channels: number;
  private tps: TruePeak[];
  /** per channel and sub-block: sample peak, true peak, largest positive and negative sample */
  readonly peak: Float32Array[];
  readonly tp: Float32Array[];
  private pos: Float32Array[];
  private neg: Float32Array[];
  private lr = new Float64Array(SUBS);
  private ll = new Float64Array(SUBS);
  private rr = new Float64Array(SUBS);
  /** index of the next sub-block to write */
  head = 0;
  private cur: { peak: number[]; tp: number[]; pos: number[]; neg: number[]; lr: number; ll: number; rr: number };
  private samples = 0;
  private subIndex = 0;
  private nextEdge: number;

  /** Since the last reset: largest sample peak / true peak (linear), clipped samples (|x| ≥ 1). */
  maxPeak: number[];
  maxTP: number[];
  clips: number[];

  constructor(fs: number, channels: number) {
    this.fs = fs; this.channels = channels;
    this.tps = Array.from({ length: channels }, () => new TruePeak());
    const mk = () => Array.from({ length: channels }, () => new Float32Array(SUBS));
    this.peak = mk(); this.tp = mk(); this.pos = mk(); this.neg = mk();
    this.cur = this.blank();
    this.maxPeak = Array(channels).fill(0); this.maxTP = Array(channels).fill(0); this.clips = Array(channels).fill(0);
    this.nextEdge = Math.round(fs / 100);
  }

  private blank() {
    const z = () => Array(this.channels).fill(0);
    return { peak: z(), tp: z(), pos: z(), neg: z(), lr: 0, ll: 0, rr: 0 };
  }

  reset() {
    this.maxPeak.fill(0); this.maxTP.fill(0); this.clips.fill(0);
  }

  process(chs: ArrayLike<number>[], n: number, offset = 0) {
    let off = offset;
    const end = offset + n;
    while (off < end) {
      const take = Math.min(end - off, this.nextEdge - this.samples);
      const c = this.cur;
      for (let ch = 0; ch < this.channels; ch++) {
        const x = chs[ch];
        let pk = c.peak[ch], ps = c.pos[ch], ng = c.neg[ch], clip = 0;
        for (let i = off; i < off + take; i++) {
          const v = x[i];
          if (v > ps) ps = v;
          if (-v > ng) ng = -v;
          if (v >= 1 || v <= -1) clip++;
        }
        pk = Math.max(pk, ps, ng);
        c.peak[ch] = pk; c.pos[ch] = ps; c.neg[ch] = ng;
        this.clips[ch] += clip;
        c.tp[ch] = Math.max(c.tp[ch], this.tps[ch].process(x, off, take));
      }
      if (this.channels >= 2) {
        const L = chs[0], R = chs[1];
        let lr = 0, ll = 0, rr = 0;
        for (let i = off; i < off + take; i++) { const l = L[i], r = R[i]; lr += l * r; ll += l * l; rr += r * r; }
        c.lr += lr; c.ll += ll; c.rr += rr;
      }
      this.samples += take; off += take;
      if (this.samples >= this.nextEdge) this.commit();
    }
  }

  private commit() {
    const c = this.cur, h = this.head;
    for (let ch = 0; ch < this.channels; ch++) {
      this.peak[ch][h] = c.peak[ch]; this.tp[ch][h] = c.tp[ch]; this.pos[ch][h] = c.pos[ch]; this.neg[ch][h] = c.neg[ch];
      if (c.peak[ch] > this.maxPeak[ch]) this.maxPeak[ch] = c.peak[ch];
      if (c.tp[ch] > this.maxTP[ch]) this.maxTP[ch] = c.tp[ch];
    }
    this.lr[h] = c.lr; this.ll[h] = c.ll; this.rr[h] = c.rr;
    this.head = (h + 1) % SUBS;
    this.cur = this.blank();
    this.subIndex++;
    this.nextEdge = Math.round(((this.subIndex + 1) * this.fs) / 100);
  }

  private max(arr: Float32Array, subs: number) {
    let m = 0;
    for (let i = 1; i <= Math.min(subs, SUBS); i++) { const v = arr[(this.head - i + SUBS) % SUBS]; if (v > m) m = v; }
    return m;
  }
  /** Sample peak of channel ch over the last `ms` milliseconds (linear). */
  peakOver(ch: number, ms: number) { return this.max(this.peak[ch], Math.ceil(ms / 10)); }
  truePeakOver(ch: number, ms: number) { return this.max(this.tp[ch], Math.ceil(ms / 10)); }

  /** Correlation of channels 1 and 2 over the last `ms` (null for silence or mono). */
  correlation(ms: number): number | null {
    if (this.channels < 2) return null;
    let lr = 0, ll = 0, rr = 0;
    for (let i = 1; i <= Math.min(SUBS, Math.ceil(ms / 10)); i++) {
      const j = (this.head - i + SUBS) % SUBS;
      lr += this.lr[j]; ll += this.ll[j]; rr += this.rr[j];
    }
    const d = Math.sqrt(ll * rr);
    return d > 1e-12 ? Math.max(-1, Math.min(1, lr / d)) : null;
  }

  /**
   * Polarity of an asymmetric test signal (e.g. the generator's polarity pulse):
   * '+' if the positive excursion clearly dominates, '−' if the negative one does,
   * '?' for symmetric signals, null for silence.
   */
  polarity(ch: number, ms = 1000): '+' | '−' | '?' | null {
    const p = this.max(this.pos[ch], Math.ceil(ms / 10)), n = this.max(this.neg[ch], Math.ceil(ms / 10));
    if (Math.max(p, n) < 1e-4) return null;
    if (p > n * 1.5) return '+';
    if (n > p * 1.5) return '−';
    return '?';
  }
}
