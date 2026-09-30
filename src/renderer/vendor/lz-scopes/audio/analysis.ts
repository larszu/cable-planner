// Audio analysis of one source: loudness (M/S/I/LRA/Max), level meters (peak, true peak,
// correlation), a ring of the latest samples for spectrum and goniometer, and the M/S
// history at 10 Hz. Fed from the capture worklet, the generator loop-back or the bridge
// (proto 2). No DOM – the panels only read from here.

import { LoudnessMeter } from './dsp/loudness';
import { LevelMeter } from './dsp/meters';

const RING = 32768;
const HISTORY = 36000; // 1 h at 10 Hz

export const CHANNEL_NAMES: Record<number, string[]> = {
  1: ['M'], 2: ['L', 'R'], 3: ['L', 'R', 'C'], 4: ['L', 'R', 'Ls', 'Rs'], 5: ['L', 'R', 'C', 'Ls', 'Rs'], 6: ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'],
  8: ['L', 'R', 'C', 'LFE', 'Lb', 'Rb', 'Ls', 'Rs'],
};

export class AudioAnalysis {
  readonly fs: number;
  readonly channels: number;
  readonly layout: string;
  readonly loud: LoudnessMeter;
  readonly level: LevelMeter;
  readonly names: string[];
  /** latest samples per channel; `frames` counts everything ever pushed */
  private ring: Float32Array[];
  frames = 0;
  /** M and S at 10 Hz */
  readonly histM = new Float32Array(HISTORY);
  readonly histS = new Float32Array(HISTORY);
  histLen = 0;
  histHead = 0;
  /** gaps in the sample index of bridge packets since the last reset */
  gaps = 0;
  private expect = -1;
  version = 0;
  lastPush = 0;
  /** where the numbers come from, e.g. "Bridge · aac 48 kHz" */
  label = '';

  constructor(fs: number, channels: number, layout = '') {
    this.fs = fs; this.channels = Math.max(1, channels); this.layout = layout;
    this.loud = new LoudnessMeter(fs, this.channels, layout);
    this.level = new LevelMeter(fs, this.channels);
    this.ring = Array.from({ length: this.channels }, () => new Float32Array(RING));
    this.names = CHANNEL_NAMES[this.channels] ?? Array.from({ length: this.channels }, (_, i) => String(i + 1));
    this.loud.onStep = (m, s) => {
      this.histM[this.histHead] = m; this.histS[this.histHead] = s;
      this.histHead = (this.histHead + 1) % HISTORY;
      this.histLen = Math.min(HISTORY, this.histLen + 1);
    };
  }

  /** Planar samples (one array per channel, n frames). */
  push(chs: Float32Array[], n: number) {
    if (n <= 0) return;
    const planar = chs.length >= this.channels ? chs : [...chs, ...Array.from({ length: this.channels - chs.length }, () => new Float32Array(n))];
    this.loud.process(planar, n);
    this.level.process(planar, n);
    for (let c = 0; c < this.channels; c++) {
      const r = this.ring[c], x = planar[c];
      const pos = this.frames % RING;
      if (n >= RING) { r.set(x.subarray(n - RING)); continue; }
      const first = Math.min(n, RING - pos);
      r.set(x.subarray(0, first), pos);
      if (first < n) r.set(x.subarray(first, n), 0);
    }
    this.frames += n;
    this.version++;
    this.lastPush = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  /** Interleaved f32 (bridge). `first` = index of the first frame since stream start. */
  pushInterleaved(data: Float32Array, first = -1) {
    const ch = this.channels, n = Math.floor(data.length / ch);
    if (first >= 0) {
      if (this.expect >= 0 && first !== this.expect) this.gaps++;
      this.expect = first + n;
    }
    const chs = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0, j = 0; i < n; i++) for (let c = 0; c < ch; c++) chs[c][i] = data[j++];
    this.push(chs, n);
  }

  /** Copy of the last n samples of channel c (n ≤ 32768). */
  latest(c: number, n: number): Float32Array {
    n = Math.min(n, RING);
    const out = new Float32Array(n), r = this.ring[Math.min(c, this.channels - 1)];
    const end = this.frames % RING;
    const start = (end - n + RING) % RING;
    if (start + n <= RING) out.set(r.subarray(start, start + n));
    else { out.set(r.subarray(start)); out.set(r.subarray(0, n - (RING - start)), RING - start); }
    return out;
  }

  /** History values of the last `points` steps (oldest first). */
  history(which: 'm' | 's', points: number): Float32Array {
    const src = which === 'm' ? this.histM : this.histS, n = Math.min(points, this.histLen);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = src[(this.histHead - n + i + HISTORY) % HISTORY];
    return out;
  }

  /** Reset I, LRA, Max M/S, Max peak/TP, clip and gap counters together. */
  reset() {
    this.loud.reset(); this.level.reset(); this.gaps = 0; this.version++;
  }
  get paused() { return this.loud.paused; }
  set paused(v: boolean) { this.loud.paused = v; this.version++; }
  /** Silent for more than a second (source stopped, stream stalled). */
  get stale() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.lastPush > 1000; }
}
