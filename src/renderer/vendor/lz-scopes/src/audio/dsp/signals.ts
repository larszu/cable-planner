// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Tone generator, sample-accurate and without DOM (runs in the AudioWorklet and in vitest).
//
// Levels are peak levels in dBFS (1.0 = 0 dBFS). Noise is scaled to the same RMS as a
// sine of that peak level. Idents after docs/research/audio.md c.7:
//   EBU stereo ident: 1 kHz, L interrupted for 250 ms every 3 s (Tech 3304 §2.1)
//   GLITS: 1 kHz, 4 s cycle, L off for 250 ms; 250 ms later R off twice for 250 ms with a
//          250 ms gap (secondary source: Wikipedia)
// Own signals (not standardised, described in the README):
//   Kanal-Ident L/R: 3 s cycle, L 1 kHz 0–0.4 s, R 1 kHz 1.0–1.4 s and 1.6–2.0 s
//   Polaritätstest: positive half-sine pulse, 1 ms long, every 20 ms, DC removed
//   A/V-Sync: 1 kHz beep of 80 ms at every whole second of the shared clock
// Multichannel idents after EBU Tech 3304 (2009, p6–8, opened as PDF):
//   BLITS (§4.1): L=R 880 Hz, C 1320 Hz, LFE 82.5 Hz, Ls=Rs 660 Hz. Section 1 (0–4.8 s):
//     one 600 ms burst per channel at −18 dBFS, 200 ms apart, order L, R, C, LFE, Ls, Rs
//     (Figure 2), then 200 ms silence. Section 2 (4.8–10.2 s): 1 kHz at −18 dBFS, R on for
//     5.1 s; L on 1 s, off 300 ms, three times on/off 300 ms, then 2 s on; 300 ms silence.
//     Section 3 (10.2–13.4 s): 2 kHz at −24 dBFS in phase on all channels for 3 s, 200 ms
//     silence. 13.4 s, repeating. The level setting is the −18 dBFS reference.
//   EBU multichannel ident (§4.2): 3 s 1 kHz coherent on all main channels, 0.5 s silence,
//     then each main channel alone for 0.5 s in clockwise order from front left, 0.5 s
//     apart, a final 1 s of silence; LFE carries 80 Hz continuously. Cycle = 4 s + 1 s
//     per main channel (Tech 3304: identification 6.0 s for 5.1, 8.0 s for 7.1).

import { channelInfo, clockwiseOrder } from './layouts';

export type Signal =
  | 'sine' | 'square' | 'triangle' | 'saw' | 'white' | 'pink' | 'pink-band' | 'sweep' | 'steps'
  | 'ebu-ident' | 'glits' | 'ident-lr' | 'polarity' | 'avsync' | 'blits' | 'ebu-multi';

export const SIGNAL_LABELS: Record<Signal, string> = {
  sine: 'Sinus', square: 'Rechteck', triangle: 'Dreieck', saw: 'Sägezahn',
  white: 'Weißes Rauschen', pink: 'Rosa Rauschen', 'pink-band': 'Rosa Rauschen 500–2000 Hz (Tech 3343)',
  sweep: 'Log-Sweep', steps: 'Stufen-Sweep (Terzmitten)',
  'ebu-ident': 'EBU-Stereo-Ident', glits: 'GLITS', 'ident-lr': 'Kanal-Ident L/R', polarity: 'Polaritätstest', avsync: 'A/V-Sync-Piep',
  blits: 'BLITS (5.1-Ident, Tech 3304)', 'ebu-multi': 'EBU-Mehrkanal-Ident (Tech 3304)',
};

export interface ChannelRoute { on: boolean; invert: boolean; trim: number }

export interface GenConfig {
  signal: Signal;
  freq: number;
  /** peak level in dBFS */
  level: number;
  sweepFrom: number; sweepTo: number; sweepSeconds: number; sweepRepeat: boolean;
  stepSeconds: number;
  /** noise: same noise on all channels (true) or independent per channel */
  correlated: boolean;
  routes: ChannelRoute[];
  running: boolean;
  /** output channels (2 = stereo, 6 = 5.1, 8 = 7.1; ffmpeg/WAV channel order) */
  channels?: number;
}

export const DEFAULT_GEN: GenConfig = {
  signal: 'sine', freq: 1000, level: -18, sweepFrom: 20, sweepTo: 20000, sweepSeconds: 10, sweepRepeat: true, stepSeconds: 2,
  correlated: true, routes: [{ on: true, invert: false, trim: 0 }, { on: true, invert: false, trim: 0 }], running: false, channels: 2,
};

/** Third-octave centres 1000·10^(k/10) from 20 Hz to 20 kHz (base-10 series, exact values). */
export const STEP_FREQS = Array.from({ length: 31 }, (_, i) => 1000 * 10 ** ((i - 17) / 10)).filter((f) => f >= 19.9 && f <= 20001);

const FADE_S = 0.01;
/** JSON copy: structuredClone does not exist in AudioWorkletGlobalScope. */
const clone = (c: GenConfig): GenConfig => JSON.parse(JSON.stringify(c));
const AV_BEEP_S = 0.08;

class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 0x9e3779b9; }
  /** uniform in [0, 1) (xorshift32) */
  next() { let x = this.s; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.s = x; return x / 4294967296; }
  /** standard normal (Box-Muller) */
  gauss() { const u = Math.max(1e-12, this.next()), v = this.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
}

/** Pink filter after Paul Kellet ("refined" version), fed with white noise. */
class Pink {
  private b = new Float64Array(7);
  next(w: number) {
    const b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179; b[1] = 0.99332 * b[1] + w * 0.0750759;
    b[2] = 0.969 * b[2] + w * 0.153852; b[3] = 0.8665 * b[3] + w * 0.3104856;
    b[4] = 0.55 * b[4] + w * 0.5329522; b[5] = -0.7616 * b[5] - w * 0.016898;
    const y = b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362;
    b[6] = w * 0.115926;
    return y;
  }
}

/** Butterworth biquad (RBJ cookbook), 'hp' or 'lp'. */
class Biq {
  private b0: number; private b1: number; private b2: number; private a1: number; private a2: number;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(type: 'hp' | 'lp', f: number, q: number, fs: number) {
    const w = (2 * Math.PI * f) / fs, cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const k = type === 'lp' ? (1 - cs) / 2 : (1 + cs) / 2;
    this.b0 = k / a0; this.b1 = (type === 'lp' ? 1 - cs : -(1 + cs)) / a0; this.b2 = k / a0;
    this.a1 = (-2 * cs) / a0; this.a2 = (1 - al) / a0;
  }
  next(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** One noise stream (white → pink → optional 4th-order band limit), normalised to unit RMS. */
class Noise {
  private rng: Rng;
  private pink = new Pink();
  private band: Biq[];
  private gain = 1;
  constructor(seed: number, private kind: 'white' | 'pink' | 'pink-band', fs: number, calibrate = true) {
    this.rng = new Rng(seed);
    // 4th-order Butterworth high-pass 500 Hz and low-pass 2 kHz (two biquads each)
    const q = [0.5411961, 1.3065630];
    this.band = kind === 'pink-band' ? [...q.map((x) => new Biq('hp', 500, x, fs)), ...q.map((x) => new Biq('lp', 2000, x, fs))] : [];
    if (kind !== 'white' && calibrate) {
      // calibrate the RMS numerically on a fixed seed
      const cal = new Noise(12345, kind, fs, false);
      let s = 0;
      const n = Math.round(fs * 4);
      for (let i = 0; i < n; i++) { const v = cal.next(); if (i > fs / 2) s += v * v; }
      this.gain = 1 / Math.sqrt(s / (n - fs / 2 - 1));
    }
  }
  next() {
    const w = this.rng.gauss();
    if (this.kind === 'white') return w;
    let y = this.pink.next(w);
    for (const f of this.band) y = f.next(y);
    return y * this.gain;
  }
}

const TAU = 2 * Math.PI;

/** BLITS (Tech 3304 §4.1): frequency per channel in 5.1 order L, R, C, LFE, Ls, Rs. */
export const BLITS_FREQS = [880, 880, 1320, 82.5, 660, 660];
export const BLITS_CYCLE = 13.4;
/** BLITS section 2: L is on in these intervals (s after 4.8 s); R on for 5.1 s. */
export const BLITS_LEFT_ON: [number, number][] = [[0, 1], [1.3, 1.6], [1.9, 2.2], [2.5, 2.8], [3.1, 5.1]];

/** BLITS value of channel ch (5.1 order) at time tc in the cycle, relative to the −18 dBFS reference (1 = reference). */
export function blitsValue(ch: number, t: number): number {
  const tc = ((t % BLITS_CYCLE) + BLITS_CYCLE) % BLITS_CYCLE;
  if (tc < 4.8) {
    const k = Math.floor(tc / 0.8), u = tc - k * 0.8;
    return k === ch && k < 6 && u < 0.6 ? Math.sin(TAU * BLITS_FREQS[ch] * tc) : 0;
  }
  if (tc < 10.2) {
    const u = tc - 4.8;
    if (u >= 5.1 || ch > 1) return 0;
    const on = ch === 1 || BLITS_LEFT_ON.some(([a, b]) => u >= a && u < b);
    return on ? Math.sin(TAU * 1000 * tc) : 0;
  }
  const u = tc - 10.2;
  return u < 3 ? 0.5011872336272722 * Math.sin(TAU * 2000 * tc) : 0; // −24 dBFS = −6 dB re −18
}

/** EBU multichannel ident (Tech 3304 §4.2): cycle length in s for m main channels. */
export const ebuMultiCycle = (mains: number) => 4 + mains;

/** EBU multichannel ident value of channel ch at time t (relative to the line-up level). */
export function ebuMultiValue(ch: number, t: number, order: number[], lfe: number[]): number {
  if (lfe.includes(ch)) return Math.sin(TAU * 80 * t);
  const T = ebuMultiCycle(order.length), tc = ((t % T) + T) % T;
  const tone = Math.sin(TAU * 1000 * tc);
  if (tc < 3) return tone;
  if (tc < 3.5) return 0;
  const k = Math.floor(tc - 3.5), u = tc - 3.5 - k;
  return k < order.length && u < 0.5 && order[k] === ch ? tone : 0;
}

export class ToneGenerator {
  readonly fs: number;
  readonly channels: number;
  cfg: GenConfig;
  /** absolute frame at which an A/V-sync beep starts, and the beep period in frames */
  avFrame0 = 0;
  avPeriod: number;
  private phase = 0;
  private k = 0; // frames since the signal started (sweeps, idents)
  private gain: number[];
  private pending: GenConfig | null = null;
  private noise: Noise[] = [];
  private noiseKind = '';
  private polarityDc = 0;
  private order: number[];
  private lfe: number[];

  constructor(fs: number, channels = 2, cfg: GenConfig = DEFAULT_GEN) {
    this.fs = fs; this.channels = channels;
    const info = channelInfo(channels);
    this.order = clockwiseOrder(info);
    this.lfe = info.map((c, i) => (c.lfe ? i : -1)).filter((i) => i >= 0);
    this.cfg = clone(cfg);
    this.gain = Array(channels).fill(0);
    this.avPeriod = fs;
    // DC of the polarity pulse train: mean of a 1 ms half-sine per 20 ms = (2/π)·(1/20)
    this.polarityDc = (2 / Math.PI) * (1 / 20);
  }

  /** New settings; a different signal fades out first (10 ms) and restarts at t = 0. */
  set(cfg: GenConfig) {
    if (cfg.signal !== this.cfg.signal || cfg.sweepFrom !== this.cfg.sweepFrom || cfg.sweepTo !== this.cfg.sweepTo) {
      if (this.gain.every((g) => g === 0)) this.apply(cfg); else this.pending = clone(cfg);
    } else {
      this.cfg = clone(cfg);
    }
  }
  private apply(cfg: GenConfig) {
    this.cfg = clone(cfg); this.pending = null; this.phase = 0; this.k = 0;
  }

  private target(ch: number) {
    const c = this.pending ? null : this.cfg;
    if (!c || !c.running) return 0;
    const r = c.routes[ch] ?? { on: false, invert: false, trim: 0 };
    if (!r.on) return 0;
    return (r.invert ? -1 : 1) * 10 ** ((c.level + r.trim) / 20);
  }

  private noiseFor(kind: 'white' | 'pink' | 'pink-band') {
    const key = `${kind}:${this.cfg.correlated}`;
    if (this.noiseKind !== key) {
      this.noise = Array.from({ length: this.cfg.correlated ? 1 : this.channels }, (_, i) => new Noise(0x1234567 + i * 7919 + Date.now(), kind, this.fs));
      this.noiseKind = key;
    }
    return this.noise;
  }

  /** Render n frames into planar outputs. `frame` = absolute frame index of the first sample. */
  render(out: Float32Array[], n: number, frame = 0) {
    const fs = this.fs, c = this.cfg, step = 1 / (FADE_S * fs);
    const noise = c.signal === 'white' || c.signal === 'pink' || c.signal === 'pink-band' ? this.noiseFor(c.signal) : null;
    const vals = new Float64Array(this.channels);
    for (let i = 0; i < n; i++) {
      // per-channel base value (before gain); `same` = identical on all channels
      let v = 0;
      let gate: number[] | null = null;
      const tc = this.k / fs;
      switch (c.signal) {
        case 'sine': v = Math.sin(this.phase); break;
        case 'square': v = this.phase < Math.PI ? 1 : -1; v += this.blepSquare(); break;
        case 'triangle': { const p = this.phase / TAU; v = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4; break; }
        case 'saw': { const p = this.phase / TAU; v = 2 * p - 1 - this.blep(p, c.freq / fs); break; }
        case 'sweep': {
          const T = Math.max(0.1, c.sweepSeconds);
          if (tc >= T && !c.sweepRepeat) { v = 0; break; }
          v = Math.sin(this.phase);
          break;
        }
        case 'steps': v = Math.sin(this.phase); break;
        case 'ebu-ident': {
          const cyc = tc % 3;
          v = Math.sin(TAU * 1000 * cyc);
          gate = [cyc < 0.25 ? 0 : 1, 1];
          break;
        }
        case 'glits': {
          const cyc = tc % 4;
          v = Math.sin(TAU * 1000 * cyc);
          gate = [cyc < 0.25 ? 0 : 1, (cyc >= 0.5 && cyc < 0.75) || (cyc >= 1 && cyc < 1.25) ? 0 : 1];
          break;
        }
        case 'ident-lr': {
          const cyc = tc % 3;
          v = Math.sin(TAU * 1000 * cyc);
          gate = [cyc < 0.4 ? 1 : 0, (cyc >= 1 && cyc < 1.4) || (cyc >= 1.6 && cyc < 2) ? 1 : 0];
          break;
        }
        case 'polarity': {
          const cyc = tc % 0.02;
          v = (cyc < 0.001 ? Math.sin((Math.PI * cyc) / 0.001) : 0) - this.polarityDc;
          break;
        }
        case 'blits': case 'ebu-multi': {
          gate = Array(this.channels);
          for (let ch = 0; ch < this.channels; ch++) gate[ch] = c.signal === 'blits' ? blitsValue(ch, tc) : ebuMultiValue(ch, tc, this.order, this.lfe);
          v = 1;
          break;
        }
        case 'avsync': {
          const k = (((frame + i - this.avFrame0) % this.avPeriod) + this.avPeriod) % this.avPeriod;
          v = k < AV_BEEP_S * fs ? Math.sin((TAU * 1000 * k) / fs) : 0;
          break;
        }
        default: v = 0;
      }
      for (let ch = 0; ch < this.channels; ch++) {
        const tg = this.target(ch);
        let g = this.gain[ch];
        if (g < tg) g = Math.min(tg, g + step); else if (g > tg) g = Math.max(tg, g - step);
        this.gain[ch] = g;
        let x: number;
        if (noise) x = (noise[this.cfg.correlated ? 0 : ch].next() * Math.SQRT1_2);
        else x = v * (gate ? gate[ch] ?? 1 : 1);
        vals[ch] = x * g;
      }
      for (let ch = 0; ch < out.length; ch++) out[ch][i] = ch < this.channels ? Math.max(-1, Math.min(1, vals[ch])) : 0;
      // advance
      let f = c.freq;
      if (c.signal === 'sweep') {
        const T = Math.max(0.1, c.sweepSeconds), tt = c.sweepRepeat ? tc % T : Math.min(tc, T);
        f = c.sweepFrom * (c.sweepTo / c.sweepFrom) ** (tt / T);
      } else if (c.signal === 'steps') {
        f = STEP_FREQS[Math.floor(tc / Math.max(0.2, c.stepSeconds)) % STEP_FREQS.length];
      }
      this.phase += (TAU * Math.min(f, fs / 2)) / fs;
      if (this.phase >= TAU) this.phase -= TAU;
      this.k++;
      if (this.pending && this.gain.every((g) => g === 0)) {
        this.apply(this.pending);
        if (i + 1 < n) this.render(out.map((a) => a.subarray(i + 1)), n - i - 1, frame + i + 1);
        return;
      }
    }
  }

  /** PolyBLEP residual for a saw with phase p ∈ [0, 1) and increment dt. */
  private blep(p: number, dt: number) {
    if (p < dt) { const x = p / dt; return x + x - x * x - 1; }
    if (p > 1 - dt) { const x = (p - 1) / dt; return x * x + x + x + 1; }
    return 0;
  }
  private blepSquare() {
    const dt = this.cfg.freq / this.fs, p = this.phase / TAU;
    return this.blep(p, dt) - this.blep((p + 0.5) % 1, dt);
  }
}

/** What a meter should show for a steady sine on the active channels (null for other signals). */
export function expectedSine(cfg: GenConfig, kGain: (f: number) => number): { dbtp: number; lufs: number } | null {
  if (cfg.signal !== 'sine') return null;
  let p = 0, peak = -Infinity;
  for (const r of cfg.routes) {
    if (!r.on) continue;
    const a = 10 ** ((cfg.level + r.trim) / 20);
    p += (a * a) / 2;
    peak = Math.max(peak, cfg.level + r.trim);
  }
  if (!p) return null;
  return { dbtp: peak, lufs: -0.691 + 10 * Math.log10(p * kGain(cfg.freq)) };
}
