// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Audio waveform over time (#196, picture history panel): the sample peaks of every channel
// reduced to one min/max pair per 10 ms step, kept for the last 60 s. This is the drawing an
// editing timeline or a Blackmagic Web Presenter shows – raw sample values (linear, full scale
// ±1), not a level meter: no true-peak oversampling and no ballistics (those live in meters.ts).

/** length of one step in ms */
export const ENV_STEP_MS = 10;
/** steps kept (60 s; the longest picture history is 12 × 5 s) */
export const ENV_STEPS = 6000;

export class Envelope {
  readonly channels: number;
  readonly min: Float32Array[];
  readonly max: Float32Array[];
  /** time of each step's last sample (performance.now() in ms) */
  readonly time = new Float64Array(ENV_STEPS);
  len = 0;
  head = 0;
  private readonly per: number;
  private fill = 0;
  private curMin: Float32Array;
  private curMax: Float32Array;

  constructor(readonly fs: number, channels: number) {
    this.channels = Math.max(1, channels);
    this.per = Math.max(1, Math.round((fs * ENV_STEP_MS) / 1000));
    this.min = Array.from({ length: this.channels }, () => new Float32Array(ENV_STEPS));
    this.max = Array.from({ length: this.channels }, () => new Float32Array(ENV_STEPS));
    this.curMin = new Float32Array(this.channels).fill(Infinity);
    this.curMax = new Float32Array(this.channels).fill(-Infinity);
  }

  /** Planar samples; `now` = arrival time of the last sample. */
  push(chs: Float32Array[], n: number, now: number) {
    const C = this.channels;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < C; c++) {
        const v = chs[c]?.[i] ?? 0;
        if (v < this.curMin[c]) this.curMin[c] = v;
        if (v > this.curMax[c]) this.curMax[c] = v;
      }
      if (++this.fill >= this.per) {
        const h = this.head;
        for (let c = 0; c < C; c++) { this.min[c][h] = this.curMin[c]; this.max[c][h] = this.curMax[c]; }
        this.time[h] = now - ((n - 1 - i) * 1000) / this.fs;
        this.head = (h + 1) % ENV_STEPS;
        this.len = Math.min(ENV_STEPS, this.len + 1);
        this.fill = 0; this.curMin.fill(Infinity); this.curMax.fill(-Infinity);
      }
    }
  }

  /** Steps not older than `fromT` (oldest first): ring indices. */
  since(fromT: number): number[] {
    const out: number[] = [];
    for (let k = 0; k < this.len; k++) {
      const j = (this.head - 1 - k + ENV_STEPS) % ENV_STEPS;
      if (this.time[j] < fromT) break;
      out.push(j);
    }
    return out.reverse();
  }

  clear() { this.len = 0; this.fill = 0; this.curMin.fill(Infinity); this.curMax.fill(-Infinity); }
}
