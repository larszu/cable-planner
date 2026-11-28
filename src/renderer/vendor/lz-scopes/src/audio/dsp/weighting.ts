// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Frequency weightings A and C of IEC 61672-1:2013 and fractional-octave bands of
// IEC 61260-1:2014, for the sound level meter and the RTA (#187).
//
// Weightings: IEC 61672-1:2013 Annex E, eq. (E.1)–(E.6). Pole frequencies
//   f1 = 20.598997 Hz, f2 = 107.65265 Hz, f3 = 737.86223 Hz, f4 = 12194.217 Hz,
//   C(f) = 20 lg[f4² f² / ((f² + f1²)(f² + f4²))] − C1000,          C1000 = −0.062 dB
//   A(f) = 20 lg[f4² f⁴ / ((f² + f1²)(f² + f2²)^½ (f² + f3²)^½ (f² + f4²))] − A1000, A1000 = −2.000 dB
// The time-domain filters are the analog prototypes of Annex E (double poles at f1 and f4,
// single poles at f2 and f3, zeros at 0 Hz) mapped with the bilinear transform, each pole
// frequency pre-warped, and normalised to 0 dB at 1 kHz. The bilinear transform squeezes the
// response above about 10 kHz towards Nyquist; the deviation from Annex E at 48 kHz is
// listed in docs/research/audio.md (i) and checked in test/spl.test.ts.
//
// Bands: IEC 61260-1:2014 §5.2–5.4, base-10 system: G = 10^(3/10), reference fr = 1000 Hz,
//   b odd:  fm = fr · G^(x/b)          b even: fm = fr · G^((2x + 1)/(2b))
//   band edges f1,2 = fm · G^(∓1/(2b)).

export const F1 = 20.598997, F2 = 107.65265, F3 = 737.86223, F4 = 12194.217;
export const A1000 = -2.0, C1000 = -0.062;

export type Weighting = 'A' | 'C' | 'Z';

/** Weighting in dB after IEC 61672-1 Annex E (Z = 0 dB). */
export function weightingDb(w: Weighting, f: number): number {
  if (w === 'Z') return 0;
  const f2 = f * f;
  if (w === 'C') return 20 * Math.log10((F4 * F4 * f2) / ((f2 + F1 * F1) * (f2 + F4 * F4))) - C1000;
  return 20 * Math.log10((F4 * F4 * f2 * f2) / ((f2 + F1 * F1) * Math.sqrt(f2 + F2 * F2) * Math.sqrt(f2 + F3 * F3) * (f2 + F4 * F4))) - A1000;
}

/** One first-order section y = (b0 x + b1 x₋₁ − a1 y₋₁). */
interface Section { b0: number; b1: number; a1: number }

/** Bilinear first-order section of s/(s+ω) (`hp`) or ω/(s+ω), pole frequency pre-warped. */
function section(f: number, fs: number, hp: boolean): Section {
  const K = 2 * fs, w = K * Math.tan((Math.PI * f) / fs);
  const a0 = K + w;
  return hp ? { b0: K / a0, b1: -K / a0, a1: (w - K) / a0 } : { b0: w / a0, b1: w / a0, a1: (w - K) / a0 };
}

function sectionsOf(w: Exclude<Weighting, 'Z'>, fs: number): Section[] {
  return w === 'A'
    ? [section(F1, fs, true), section(F1, fs, true), section(F2, fs, true), section(F3, fs, true), section(F4, fs, false), section(F4, fs, false)]
    : [section(F1, fs, true), section(F1, fs, true), section(F4, fs, false), section(F4, fs, false)];
}

function sectionsGain(s: Section[], f: number, fs: number): number {
  const w = (2 * Math.PI * f) / fs, cr = Math.cos(w), ci = -Math.sin(w);
  let g = 1;
  for (const x of s) {
    // (b0 + b1 z⁻¹)/(1 + a1 z⁻¹), z⁻¹ = cr + j ci
    const nr = x.b0 + x.b1 * cr, ni = x.b1 * ci, dr = 1 + x.a1 * cr, di = x.a1 * ci;
    g *= Math.hypot(nr, ni) / Math.hypot(dr, di);
  }
  return g;
}

/** Time-domain A or C weighting for one channel. */
export class WeightingFilter {
  private s: Section[];
  private x1: Float64Array;
  private y1: Float64Array;
  private gain: number;
  constructor(readonly w: Exclude<Weighting, 'Z'>, readonly fs: number) {
    this.s = sectionsOf(w, fs);
    this.x1 = new Float64Array(this.s.length); this.y1 = new Float64Array(this.s.length);
    this.gain = 1 / sectionsGain(this.s, 1000, fs);
  }
  /** |H(f)| in dB of the digital filter (for tests and the documentation). */
  responseDb(f: number) { return 20 * Math.log10(sectionsGain(this.s, f, this.fs) * this.gain); }
  process(x: number): number {
    let v = x * this.gain;
    const s = this.s, x1 = this.x1, y1 = this.y1;
    for (let i = 0; i < s.length; i++) {
      const y = s[i].b0 * v + s[i].b1 * x1[i] - s[i].a1 * y1[i];
      x1[i] = v; y1[i] = y; v = y;
    }
    return v;
  }
  reset() { this.x1.fill(0); this.y1.fill(0); }
}

export interface Band { fm: number; lo: number; hi: number }

/** 1/b-octave bands (IEC 61260-1 base 10) whose centre lies within fLo … fHi. */
export function fractionalOctaveBands(b: number, fLo = 20, fHi = 20000): Band[] {
  const G = 10 ** 0.3, out: Band[] = [];
  const centre = (x: number) => (b % 2 ? 1000 * G ** (x / b) : 1000 * G ** ((2 * x + 1) / (2 * b)));
  const xMin = Math.floor((b * Math.log(fLo / 1000)) / Math.log(G)) - 2, xMax = Math.ceil((b * Math.log(fHi / 1000)) / Math.log(G)) + 2;
  for (let x = xMin; x <= xMax; x++) {
    const fm = centre(x);
    if (fm < fLo * 0.98 || fm > fHi * 1.02) continue; // nominal 20 Hz is 19.95 Hz
    out.push({ fm, lo: fm * G ** (-1 / (2 * b)), hi: fm * G ** (1 / (2 * b)) });
  }
  return out;
}

/** Nominal label of a band centre (rounded, k for kHz). */
export function bandLabel(fm: number): string {
  // nominal frequencies of IEC 61260-1 Annex E: the R10 preferred numbers for third-octave
  // centres (1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8); other banding rounded to 2 digits
  const e = Math.floor(Math.log10(fm)), m = fm / 10 ** e;
  const r10 = [1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8, 10].find((x) => Math.abs(m / x - 1) < 0.015);
  const v = (r10 ?? Math.round(m * 10) / 10) * 10 ** e;
  const r = (x: number) => String(Math.round(x * 1000) / 1000);
  return v >= 1000 ? `${r(v / 1000)}k` : r(v);
}

/**
 * Power of each band from a linear power spectrum P (bins 0 … n/2, a sine of amplitude A has
 * its peak bin at A², Hann window). Each bin covers [k − ½, k + ½]·Δf and contributes in
 * proportion to its overlap with the band, divided by the Hann equivalent noise bandwidth
 * (1.5 bins), so a band narrower than one bin still gets the power density of its bins.
 * The result is the band's mean square relative to a full-scale sine (AES17: 0 dBFS).
 */
export function bandPowers(P: Float64Array | Float32Array, fs: number, bands: Band[]): Float64Array {
  const n = (P.length - 1) * 2, df = fs / n, out = new Float64Array(bands.length);
  bands.forEach((bd, i) => {
    const k0 = Math.max(1, Math.floor(bd.lo / df + 0.5)), k1 = Math.min(P.length - 1, Math.floor(bd.hi / df + 0.5));
    let p = 0;
    for (let k = k0; k <= k1; k++) {
      const ov = Math.min(bd.hi, (k + 0.5) * df) - Math.max(bd.lo, (k - 0.5) * df);
      if (ov > 0) p += P[k] * (ov / df);
    }
    out[i] = p / 1.5;
  });
  return out;
}
