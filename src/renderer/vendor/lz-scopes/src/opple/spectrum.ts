// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Spectra from real spectrometers (ArgyllCMS spotread, files) and the filter channels of the
// Opple meters, for the wavelength monitor (#11).
//
// - XYZ from a spectrum: X = k·Σ S(λ)·x̄(λ)·Δλ (Y likewise), k = 683 lm/W for absolute
//   (ir)radiance – CIE 1931 2°, table in cmf.ts. With S in W/(m²·nm) Y is the illuminance in lx;
//   in W/(m²·sr·nm) it is the luminance in cd/m².
// - ArgyllCMS units (argyllcms.com/doc/spotread.html, table "Mode / Y Units"): Ambient
//   mW/(m²·nm), Emission mW/(m²·sr·nm).
// - Argyll .sp files (CGATS, written by spotread -O): keywords SPECTRAL_BANDS, SPECTRAL_START_NM,
//   SPECTRAL_END_NM, SPECTRAL_NORM, MEAS_TYPE, values in the data block; value = stored / norm
//   (xspect.c of ArgyllCMS 3.5.0, read as a fact).
// - AS7341 (Light Master 4, according to sunday-light-meter): centre wavelengths and FWHM from the
//   ams-OSRAM datasheet DS000504 v3-00 (2020), Figure 7. The LM3's filter widths are not published.

import { CMF, CMF_START, CMF_STEP } from './cmf';

export type SpectrumUnit = 'mW/(m²·nm)' | 'mW/(m²·sr·nm)' | 'relativ';
export interface Spectrum { start: number; end: number; values: number[]; unit: SpectrumUnit }

/** Wavelength of sample i. */
export const wavelengthAt = (s: Spectrum, i: number) => (s.values.length > 1 ? s.start + (i * (s.end - s.start)) / (s.values.length - 1) : s.start);

/** Linear interpolation; 0 outside the measured range. */
export function sampleAt(s: Spectrum, nm: number) {
  const n = s.values.length;
  if (n < 2 || nm < s.start || nm > s.end) return 0;
  const f = ((nm - s.start) / (s.end - s.start)) * (n - 1), i = Math.min(n - 2, Math.floor(f)), t = f - i;
  return s.values[i] * (1 - t) + s.values[i + 1] * t;
}

/**
 * CIE 1931 XYZ of a spectrum. Absolute units give lx (ambient) or cd/m² (emission) in Y;
 * 'relativ' gives Y relative (only the chromaticity is meaningful).
 */
export function spectrumToXyz(s: Spectrum): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i * 3 < CMF.length; i++) {
    const v = sampleAt(s, CMF_START + i * CMF_STEP);
    X += v * CMF[i * 3]; Y += v * CMF[i * 3 + 1]; Z += v * CMF[i * 3 + 2];
  }
  const k = s.unit === 'relativ' ? 1 : 683 * 1e-3 * CMF_STEP;
  return [X * k, Y * k, Z * k];
}

/** Peak wavelength. */
export function peakOf(s: Spectrum) {
  let best = 0;
  s.values.forEach((v, i) => { if (v > s.values[best]) best = i; });
  return { nm: wavelengthAt(s, best), value: s.values[best] };
}

// ---------------------------------------------------------------- files

/** Argyll .sp (CGATS) file → spectrum, or null. */
export function parseArgyllSp(text: string): Spectrum | null {
  const kw = (k: string) => new RegExp(`^\\s*${k}\\s+"?([^"\\n]+)"?`, 'm').exec(text)?.[1]?.trim();
  const bands = Number(kw('SPECTRAL_BANDS')), start = Number(kw('SPECTRAL_START_NM')), end = Number(kw('SPECTRAL_END_NM'));
  const norm = Number(kw('SPECTRAL_NORM') ?? 1) || 1;
  const data = /BEGIN_DATA\s*\n([\s\S]*?)END_DATA/.exec(text.replace(/BEGIN_DATA_FORMAT[\s\S]*?END_DATA_FORMAT/, ''))?.[1];
  if (!bands || !Number.isFinite(start) || !Number.isFinite(end) || !data) return null;
  const nums = data.trim().split(/\s+/).map(Number).filter(Number.isFinite);
  if (nums.length < bands) return null;
  const type = kw('MEAS_TYPE')?.toUpperCase();
  const unit: SpectrumUnit = type === 'AMBIENT' ? 'mW/(m²·nm)' : type === 'EMISSION' ? 'mW/(m²·sr·nm)' : 'relativ';
  return { start, end, values: nums.slice(0, bands).map((v) => v / norm), unit };
}

/**
 * Two-column text (wavelength, value): comma, semicolon, tab or blanks; with ';' or tab a decimal
 * comma is accepted. Lines that are not two numbers (headers, comments) are skipped. Wavelengths
 * must be equally spaced and rising (resampled otherwise is not done – the import says so).
 */
export function parseSpectrumCsv(text: string, unit: SpectrumUnit = 'relativ'): Spectrum | null {
  const pts: [number, number][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || /^[#"a-zA-Z]/.test(l)) continue;
    let f: string[];
    if (/[;\t]/.test(l)) f = l.split(/[;\t]/).map((x) => x.trim().replace(',', '.'));
    else if ((l.match(/,/g) ?? []).length === 1) f = l.split(',');
    else f = l.split(/\s+/);
    const a = Number(f[0]), b = Number(f[1]);
    if (f.length >= 2 && Number.isFinite(a) && Number.isFinite(b)) pts.push([a, b]);
  }
  if (pts.length < 3) return null;
  const step = pts[1][0] - pts[0][0];
  if (!(step > 0) || pts.some(([w], i) => Math.abs(w - (pts[0][0] + i * step)) > step * 0.01)) return null;
  return { start: pts[0][0], end: pts[pts.length - 1][0], values: pts.map(([, v]) => v), unit };
}

// ---------------------------------------------------------------- filter channels

export interface FilterBand { nm: number; fwhm: number | null }
/** AS7341 F1–F8 (DS000504, Figure 7, typical). */
export const AS7341_BANDS: FilterBand[] = [
  { nm: 415, fwhm: 26 }, { nm: 445, fwhm: 30 }, { nm: 480, fwhm: 36 }, { nm: 515, fwhm: 39 },
  { nm: 555, fwhm: 39 }, { nm: 590, fwhm: 40 }, { nm: 630, fwhm: 50 }, { nm: 680, fwhm: 52 },
];
/** Filter description of a reading's channels: LM4 = AS7341, LM3 = centre only (widths unknown). */
export function filterBands(model: 'lm3' | 'lm4', wavelengths: number[]): FilterBand[] {
  return model === 'lm4' ? AS7341_BANDS : wavelengths.map((nm) => ({ nm, fwhm: null }));
}
