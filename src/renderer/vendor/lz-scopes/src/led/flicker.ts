// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Shutter / refresh-rate finder for LED walls and LED light (idea 5, docs/research/shutter-finder.md).
// Pure functions, no DOM: a series of row profiles (one per camera frame, mean luma per picture
// row inside the wall area) → spatial and temporal spectrum of the banding → alias frequency,
// band spacing, the camera's line time and shutter times that span whole flicker cycles.
//
// Model (shutter-finder.md, section "Model"): the light flickers with frequency f (PWM / refresh).
// Each sensor row integrates it over the exposure T (a rectangular window), a rolling shutter
// starts row y a line time t_row later than row y−1. Row y of frame n therefore sees
// cos(2π(f·t_row·y + f·n/F)): bands with ky = f·t_row cycles per row that move from frame to
// frame by f/F cycles – seen by the camera as the alias f − F·round(f/F). The rectangular
// window weights the flicker with |sinc(f·T)|, which is zero when T spans whole cycles (n/f).

import { fft } from '../audio/dsp/fft';

/** One recorded frame: mean luma per row of the analysed region, the source's frame counter and time. */
export interface ProfileFrame { rows: ArrayLike<number>; seq: number; t: number }

export interface FlickerOptions {
  /** camera frame rate in fps; unset = measured from the frame times */
  fps?: number;
  /** nominal flicker frequency in Hz (LED refresh / PWM, mains ×2); 0/unset = unknown */
  refreshHz?: number;
  /** height of the camera picture in rows (the profile's rows are picture rows) – for the readout time */
  height?: number;
  /** sensor readout time of the camera in ms (data sheet) – estimates f when refreshHz is unknown */
  readoutMs?: number;
}

export interface FlickerResult {
  frames: number;
  /** frame rate used (given or measured) and the measured one */
  fs: number; measuredFs: number;
  /** frames missing between the recorded ones (frame counter jumped) */
  missing: number;
  /** moving bands: strongest row frequency of the frame-to-frame changes, cycles per row */
  ky: number;
  /** their amplitude (peak, % of the mean level) */
  bandPct: number;
  /** their temporal frequency as the camera sees it, Hz, signed: > 0 = bands move up the picture */
  alias: number;
  /** whole-frame pulsing (all rows together): strongest frequency in Hz and amplitude in % */
  pumpHz: number; pumpPct: number;
  /** standing banding (same in every frame, e.g. genlocked wall): row frequency and amplitude % */
  staticKy: number; staticPct: number;
  /** flicker frequency used for the suggestions and where it comes from */
  f: number; fSource: 'given' | 'readout' | 'none';
  /** given f: the alias it should produce at fs, and whether the measurement agrees */
  predictedAlias: number; consistent: boolean | null;
  /** line time t_row = ky/f in µs and readout of the whole picture in ms (needs f and height) */
  lineUs: number; readoutMs: number;
  /** frequencies that fit the measured alias (k·fs + alias), when f is unknown */
  candidates: number[];
}

const mean = (a: ArrayLike<number>) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : NaN; };
const pow2 = (n: number) => { let p = 1; while (p < n) p <<= 1; return p; };

/** The alias a flicker of f Hz shows at F frames per second: f − F·round(f/F), in (−F/2, F/2]. */
export function aliasOf(f: number, F: number) {
  const a = f - F * Math.round(f / F);
  return a <= -F / 2 + 1e-9 ? a + F : a;
}

/** Response of the rectangular exposure window to a flicker of f Hz: |sin(πfT)/(πfT)| (1 = no attenuation). */
export function exposureResponse(f: number, T: number) {
  const x = Math.PI * f * T;
  return x === 0 ? 1 : Math.abs(Math.sin(x) / x);
}

export interface ShutterOption {
  /** exposure in s, as 1/x s, shutter angle at fps, whole cycles in it */
  T: number; oneOver: number; angle: number; cycles: number;
}

/**
 * Exposure times that span whole flicker cycles (T = n/f), between minAngle and 360° at fps,
 * sorted by their distance to the target angle (default 180°).
 */
export function shutterOptions(f: number, fps: number, o: { target?: number; minAngle?: number; max?: number } = {}): ShutterOption[] {
  if (!(f > 0) || !(fps > 0)) return [];
  const target = o.target ?? 180, minAngle = o.minAngle ?? 11.25, out: ShutterOption[] = [];
  const nMax = Math.floor(f / fps + 1e-9);
  for (let n = 1; n <= nMax; n++) {
    const T = n / f, angle = 360 * T * fps;
    if (angle < minAngle - 1e-9) continue;
    out.push({ T, oneOver: f / n, angle, cycles: n });
  }
  return out.sort((a, b) => Math.abs(a.angle - target) - Math.abs(b.angle - target)).slice(0, o.max ?? 6);
}

/** Flicker cycles in an exposure and the rest attenuation of the fundamental (|sinc|). */
export function shutterCheck(f: number, T: number) {
  const cycles = f * T;
  return { cycles, whole: Math.abs(cycles - Math.round(cycles)) < 0.02 && cycles >= 0.98, response: exposureResponse(f, T) };
}

/** Hann-windowed real FFT of v (mean removed); returns re/im of length n (power of two). */
function rowSpectrum(v: ArrayLike<number>, n: number) {
  const re = new Float64Array(n), im = new Float64Array(n), L = v.length, m = mean(v);
  let wsum = 0;
  for (let i = 0; i < L; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / L); re[i] = (v[i] - m) * w; wsum += w; }
  fft(re, im);
  return { re, im, wsum };
}

/** Parabolic interpolation of a peak at bin k of a magnitude array. */
function refine(mag: ArrayLike<number>, k: number) {
  if (k <= 0 || k >= mag.length - 1) return k;
  const a = mag[k - 1], b = mag[k], c = mag[k + 1], d = a - 2 * b + c;
  return d < 0 ? k + (0.5 * (a - c)) / d : k;
}

/**
 * Analyse a series of row profiles. Needs at least 8 frames of the same row count; consecutive
 * frames (frame counter +1) carry the band motion, gaps are allowed and counted.
 */
export function analyseFlicker(frames: ProfileFrame[], o: FlickerOptions = {}): FlickerResult {
  const N = frames.length, L = frames[0]?.rows.length ?? 0;
  if (N < 8 || L < 16 || frames.some((f) => f.rows.length !== L)) throw new Error('flicker: need ≥ 8 frames of the same size');
  const seq0 = frames[0].seq, seqSpan = frames[N - 1].seq - seq0, tSpan = (frames[N - 1].t - frames[0].t) / 1000;
  const measuredFs = tSpan > 0 ? seqSpan / tSpan : NaN;
  const fs = o.fps && o.fps > 0 ? o.fps : measuredFs;
  const missing = Math.max(0, seqSpan - (N - 1));

  // relative profiles: each frame divided by the time-mean profile (removes the wall content)
  const pbar = new Float64Array(L);
  for (const f of frames) for (let y = 0; y < L; y++) pbar[y] += f.rows[y] / N;
  const lvl = mean(pbar);
  const rel = frames.map((f) => { const r = new Float64Array(L); for (let y = 0; y < L; y++) r[y] = pbar[y] > 1e-6 ? f.rows[y] / pbar[y] - 1 : 0; return r; });

  // standing banding: spectrum of the time-mean profile itself
  const n = pow2(L), half = n / 2;
  const st = rowSpectrum(Array.from(pbar, (v) => v / lvl), n);
  const stMag = new Float64Array(half);
  for (let k = 0; k < half; k++) stMag[k] = Math.hypot(st.re[k], st.im[k]) * (2 / st.wsum);
  // at least 2 cycles inside the region: bins below 2·n/L are the slow course of the picture
  const kMin = Math.max(2, Math.ceil((2 * n) / L));
  let ks = kMin;
  for (let k = kMin; k < half; k++) if (stMag[k] > stMag[ks]) ks = k;

  // moving bands: power of the relative profiles per row frequency
  const specs = rel.map((r) => rowSpectrum(r, n));
  const pw = new Float64Array(half);
  for (const s of specs) for (let k = 1; k < half; k++) pw[k] += (s.re[k] ** 2 + s.im[k] ** 2) / N;
  let km = 1;
  for (let k = 1; k < half; k++) if (pw[k] > pw[km]) km = k;
  const wsum = specs[0].wsum;
  const bandPct = ((Math.sqrt(pw[km]) * 2) / wsum) * 100;
  // phase step of that row frequency between consecutive frames
  let zr = 0, zi = 0;
  for (let i = 0; i + 1 < N; i++) {
    if (frames[i + 1].seq - frames[i].seq !== 1) continue;
    const a = specs[i], b = specs[i + 1];
    zr += b.re[km] * a.re[km] + b.im[km] * a.im[km];
    zi += b.im[km] * a.re[km] - b.re[km] * a.im[km];
  }
  // fft uses e^{−iωy}: a pattern cos(2π(ky·y + a·t)) advances its phase by +2π·a/fs per frame,
  // which moves the bands towards smaller y (up the picture)
  const alias = (Math.atan2(zi, zr) / (2 * Math.PI)) * fs;
  const ky = refine(Array.from(pw, Math.sqrt), km) / n;

  // whole-frame pulsing: DFT of the frame means over the true frame times (seq / fs)
  const g = rel.map((r) => mean(r)), gm = mean(g);
  let pumpHz = 0, pumpPct = 0;
  const steps = Math.max(16, 4 * seqSpan);
  for (let j = 1; j <= steps / 2; j++) {
    const fr = (j / steps) * fs;
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * fr * ((frames[i].seq - seq0) / fs); re += (g[i] - gm) * Math.cos(ph); im += (g[i] - gm) * Math.sin(ph); }
    const amp = (2 * Math.hypot(re, im)) / N * 100;
    if (amp > pumpPct) { pumpPct = amp; pumpHz = fr; }
  }

  // flicker frequency: given, or from the readout time and the band spacing
  let f = o.refreshHz && o.refreshHz > 0 ? o.refreshHz : NaN, fSource: FlickerResult['fSource'] = Number.isFinite(f) ? 'given' : 'none';
  const height = o.height ?? L;
  const candidates: number[] = [];
  if (!Number.isFinite(f) && Number.isFinite(fs)) {
    // f ≡ alias (mod fs); list the first few positive ones
    for (let k = 0; candidates.length < 6 && k < 400; k++) { const c = k * fs + alias; if (c > 0) candidates.push(c); }
    if (o.readoutMs && o.readoutMs > 0) {
      const est = (ky * height) / (o.readoutMs / 1000);
      const k = Math.round((est - alias) / fs);
      f = Math.max(1, k * fs + alias); fSource = 'readout';
    }
  }
  const predictedAlias = Number.isFinite(f) && fs > 0 ? aliasOf(f, fs) : NaN;
  const tol = Math.max(0.6, (2 * fs) / Math.max(1, seqSpan));
  const consistent = fSource === 'given' && Number.isFinite(predictedAlias) ? Math.abs(aliasOf(alias - predictedAlias, fs)) <= tol : null;
  const lineUs = Number.isFinite(f) ? (ky / f) * 1e6 : NaN;
  return {
    frames: N, fs, measuredFs, missing, ky, bandPct, alias, pumpHz, pumpPct,
    staticKy: refine(stMag, ks) / n, staticPct: stMag[ks] * 100,
    f, fSource, predictedAlias, consistent, lineUs, readoutMs: (lineUs * height) / 1000, candidates,
  };
}

// ---------------------------------------------------------------- synthetic camera (tests, docs)

export interface SimOptions {
  rows: number; frames: number; fps: number;
  /** flicker frequency Hz, PWM duty 0–1, exposure s, readout of all rows s */
  f: number; duty: number; T: number; readout: number;
  /** wall content per row (default flat 1) and the frame counter step pattern (default 1) */
  content?: (y: number) => number;
  skip?: (n: number) => boolean;
}

/**
 * Row profiles a rolling-shutter camera records of a PWM light: row y of frame n integrates the
 * square wave over [n/F + y·readout/rows, … + T] (exact integral), times the content.
 */
export function simulateProfiles(o: SimOptions): ProfileFrame[] {
  const P = 1 / o.f, on = o.duty * P;
  // light integral of a square wave from 0 to t
  const I = (t: number) => { const k = Math.floor(t / P), r = t - k * P; return k * on + Math.min(r, on); };
  const out: ProfileFrame[] = [];
  for (let n = 0, seq = 0; out.length < o.frames; n++) {
    if (o.skip?.(n)) continue;
    const rows = new Float64Array(o.rows);
    for (let y = 0; y < o.rows; y++) {
      const t0 = n / o.fps + (y * o.readout) / o.rows;
      rows[y] = ((I(t0 + o.T) - I(t0)) / o.T) * (o.content?.(y) ?? 1);
    }
    out.push({ rows, seq: n, t: (n / o.fps) * 1000 });
    seq++;
  }
  return out;
}
