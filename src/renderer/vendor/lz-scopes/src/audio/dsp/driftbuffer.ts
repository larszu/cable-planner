// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Ring buffer with drift compensation for listening to a stream whose clock is not the
// sound card's (bridge PCM from a camera or capture device, later e.g. LTC playback).
//
// The producer pushes packets (e.g. 20 ms from the bridge), the audio thread pulls blocks
// (128 frames per render quantum). Both clocks differ by some ppm, so the fill level
// drifts. A PI controller on the smoothed fill level changes the read step slightly
// (linear interpolation) so the fill stays at the target; the pitch change stays below
// ±0.2 % (clamped; 0.2 % ≈ 3.5 cent). Underrun → silence and re-priming, overflow →
// the oldest samples are dropped. Both are counted. Measurement is not affected: the
// analysis runs on the unmodified samples, this is only for monitoring.

export interface DriftStats { fillMs: number; targetMs: number; ppm: number; underruns: number; overruns: number; playing: boolean }

export class DriftBuffer {
  readonly channels: number;
  readonly fs: number;
  private buf: Float32Array[];
  private cap: number;
  private w = 0; // frames written (absolute)
  private r = 0; // read position (absolute, fractional)
  private target: number;
  private smooth = 0;
  private integ = 0;
  private step = 1;
  private primed = false;
  private gain = 0;
  underruns = 0;
  overruns = 0;
  /** source channel for each output channel (default: 1 → 1, 2 → 2, mono on both) */
  map: number[] | null = null;
  static readonly MAX_CORR = 0.002;

  constructor(channels: number, fs: number, targetMs = 120, capacityMs = 1000) {
    this.channels = channels; this.fs = fs;
    this.cap = Math.round((fs * capacityMs) / 1000);
    this.target = Math.round((fs * targetMs) / 1000);
    this.buf = Array.from({ length: channels }, () => new Float32Array(this.cap));
  }

  get fill() { return this.w - this.r; }

  /** Planar samples, n frames. */
  push(chs: ArrayLike<number>[], n: number) {
    for (let i = 0; i < n; i++) {
      const p = (this.w + i) % this.cap;
      for (let c = 0; c < this.channels; c++) this.buf[c][p] = chs[c]?.[i] ?? 0;
    }
    this.w += n;
    if (this.fill > this.cap - 4) { this.r = this.w - this.target; this.overruns++; }
  }

  /** Interleaved samples (bridge format). */
  pushInterleaved(x: Float32Array, channels: number) {
    const n = Math.floor(x.length / channels);
    for (let i = 0; i < n; i++) {
      const p = (this.w + i) % this.cap;
      for (let c = 0; c < this.channels; c++) this.buf[c][p] = c < channels ? x[i * channels + c] : 0;
    }
    this.w += n;
    if (this.fill > this.cap - 4) { this.r = this.w - this.target; this.overruns++; }
  }

  /** Fill `out` (planar, n frames) with drift-compensated samples. */
  pull(out: Float32Array[], n: number) {
    if (!this.primed) {
      if (this.fill >= this.target) { this.primed = true; this.smooth = this.fill; this.integ = 0; }
      else { for (const o of out) o.fill(0, 0, n); return; }
    }
    // PI control on the smoothed fill (time constant 2 s, so packet jitter averages out).
    // Plant: d(err)/dt = −corr·fs/target. Gains for a closed loop of ω ≈ 0.1 rad/s, ζ ≈ 0.7
    // (settles in about 30–40 s; the clamp limits the pitch change meanwhile).
    const dt = n / this.fs, K = this.fs / this.target;
    this.smooth += (this.fill - this.smooth) * Math.min(1, dt / 2);
    const err = (this.smooth - this.target) / this.target;
    const kp = (2 * 0.7 * 0.1) / K, ki = (0.1 * 0.1) / K;
    this.integ = Math.max(-DriftBuffer.MAX_CORR / ki, Math.min(DriftBuffer.MAX_CORR / ki, this.integ + err * dt));
    const corr = Math.max(-DriftBuffer.MAX_CORR, Math.min(DriftBuffer.MAX_CORR, kp * err + ki * this.integ));
    this.step = 1 + corr;
    const fade = 1 / (0.005 * this.fs);
    for (let i = 0; i < n; i++) {
      if (this.fill < 2) {
        // underrun: fade out, then wait for the target fill again
        this.underruns++; this.primed = false;
        for (let j = i; j < n; j++) for (const o of out) o[j] = 0;
        this.gain = 0;
        return;
      }
      const ip = Math.floor(this.r), fr = this.r - ip;
      const p0 = ip % this.cap, p1 = (ip + 1) % this.cap;
      this.gain = Math.min(1, this.gain + fade);
      for (let c = 0; c < out.length; c++) {
        const b = this.buf[Math.min(this.map?.[c] ?? c, this.channels - 1)];
        out[c][i] = (b[p0] + (b[p1] - b[p0]) * fr) * this.gain;
      }
      this.r += this.step;
    }
  }

  stats(): DriftStats {
    return {
      fillMs: (this.fill / this.fs) * 1000, targetMs: (this.target / this.fs) * 1000, ppm: (this.step - 1) * 1e6,
      underruns: this.underruns, overruns: this.overruns, playing: this.primed,
    };
  }
}
