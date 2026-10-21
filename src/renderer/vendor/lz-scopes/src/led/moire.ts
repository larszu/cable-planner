// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Moiré meter for LED walls (idea 6, docs/research/moire-meter.md). Pure functions, no DOM.
//
// Geometry: the wall's pixel grid, mapped into the camera picture by the homography of the LED
// check, has a spatial frequency per picture pixel. Sampling theory (Imatest, "Nyquist frequency
// and aliasing"): above 0.5 cycles/pixel it is recorded at a wrong, lower frequency – the moiré;
// in a Bayer sensor red and blue already alias above 0.25 cycles/pixel (colour moiré).
// Measurement: 2D FFT of a window of the camera picture inside the wall area – on a flat field
// any strong periodic peak is the grid or its alias.

import { fft } from '../audio/dsp/fft';
import { project, wallToImage, type Frame, type Pt } from './analysis';
import type { WallConfig } from './wall';

const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;

export type MoireRisk = 'resolved' | 'colour' | 'alias';

export interface GridFrequency {
  /** frequency vector of the wall's column grid and row grid, cycles per recorded picture pixel (u, v) */
  col: [number, number]; row: [number, number];
  /** their magnitudes, the larger one and its risk class */
  fCol: number; fRow: number; f: number; risk: MoireRisk;
  /** where it is aliased into: frequency vector of the alias (cycles/px), its magnitude and period in px */
  alias: [number, number]; aliasF: number; aliasPeriod: number;
}

/** Fold a frequency vector into the base band (−0.5 … 0.5 cycles/px per axis): the alias. */
export function foldFrequency(f: [number, number]): [number, number] {
  return [f[0] - Math.round(f[0]), f[1] - Math.round(f[1])];
}

/** Risk class of a grid frequency in cycles per pixel (Imatest: Nyquist 0.5, Bayer R/B 0.25). */
export const riskOf = (f: number): MoireRisk => (f >= 0.5 ? 'alias' : f >= 0.25 ? 'colour' : 'resolved');

/**
 * Grid frequency of the wall at the wall point (wx, wy) in wall pixels: the gradient of the wall
 * coordinates in the picture (inverse Jacobian of the homography), scaled from the analysed
 * picture to the recorded resolution (`scale` = analysed width / recorded width, ≤ 1 when the
 * analysis picture is smaller than the recording).
 */
export function gridFrequencyAt(H: number[], wx: number, wy: number, scale = 1): GridFrequency {
  const e = 0.5;
  const p0 = project(H, wx, wy), px = project(H, wx + e, wy), py = project(H, wx, wy + e);
  // Jacobian J = ∂(u,v)/∂(wx,wy); its inverse rows are ∇wx and ∇wy in the picture
  const a = (px[0] - p0[0]) / e, b = (py[0] - p0[0]) / e, c = (px[1] - p0[1]) / e, d = (py[1] - p0[1]) / e;
  const det = a * d - b * c;
  // one picture pixel of the analysis = 1/scale recorded pixels: frequencies per recorded pixel × scale
  const col: [number, number] = [(d / det) * scale, (-b / det) * scale];
  const row: [number, number] = [(-c / det) * scale, (a / det) * scale];
  const fCol = Math.hypot(...col), fRow = Math.hypot(...row);
  const worst = fCol >= fRow ? col : row, f = Math.max(fCol, fRow);
  const alias = foldFrequency(worst), aliasF = Math.hypot(...alias);
  return { col, row, fCol, fRow, f, risk: riskOf(f), alias, aliasF, aliasPeriod: aliasF > 1e-9 ? 1 / aliasF : Infinity };
}

/** Grid frequency at the wall centre and corners; the worst point decides (perspective varies it). */
export function wallGridFrequency(wall: WallConfig, corners: Pt[], scale = 1) {
  const H = wallToImage(wall, corners), W = wall.cabW * wall.cols, Hh = wall.cabH * wall.rows;
  const pts: [number, number][] = [[W / 2, Hh / 2], [1, 1], [W - 1, 1], [W - 1, Hh - 1], [1, Hh - 1]];
  const all = pts.map(([x, y]) => gridFrequencyAt(H, x, y, scale));
  const worst = all.reduce((m, g) => (g.f > m.f ? g : m), all[0]);
  return { centre: all[0], worst, all };
}

export interface SpectrumPeak {
  /** frequency vector in cycles per analysed pixel, magnitude, amplitude in % of the mean */
  fu: number; fv: number; f: number; pct: number;
}

export interface MoireMeasurement {
  size: number;
  /** strongest periodic peaks of the luma and of R−B (colour moiré, Imatest), outside the DC zone */
  luma: SpectrumPeak; chroma: SpectrumPeak;
  /** log power spectrum (size × size, DC centred) for display */
  spectrum: Float32Array;
}

/** Largest power of two ≤ n (at least 16). */
const pow2Floor = (n: number) => { let p = 16; while (p * 2 <= n) p *= 2; return p; };

/** 2D FFT (rows then columns) of a real n×n array in place; returns re, im. */
function fft2(v: Float64Array, n: number) {
  const re = Float64Array.from(v), im = new Float64Array(n * n);
  const r = new Float64Array(n), i = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) { r[x] = re[y * n + x]; i[x] = im[y * n + x]; }
    fft(r, i);
    for (let x = 0; x < n; x++) { re[y * n + x] = r[x]; im[y * n + x] = i[x]; }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) { r[y] = re[y * n + x]; i[y] = im[y * n + x]; }
    fft(r, i);
    for (let y = 0; y < n; y++) { re[y * n + x] = r[y]; im[y * n + x] = i[y]; }
  }
  return { re, im };
}

/**
 * Measure a square window of the frame centred on (cx, cy), side `size` (power of two, at most
 * the frame): Hann window, 2D FFT of luma and of R−B, strongest peak outside a DC zone of
 * `dcBins` bins. Amplitudes in % of the window's mean luma.
 */
export function measureMoire(f: Frame, cx: number, cy: number, size: number, dcBins = 3): MoireMeasurement {
  const n = pow2Floor(Math.min(size, f.width, f.height));
  const x0 = Math.max(0, Math.min(f.width - n, Math.round(cx - n / 2))), y0 = Math.max(0, Math.min(f.height - n, Math.round(cy - n / 2)));
  const Y = new Float64Array(n * n), C = new Float64Array(n * n);
  let my = 0, mc = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = ((y0 + y) * f.width + x0 + x) * 3, k = y * n + x;
    Y[k] = KR * f.rgb[i] + KG * f.rgb[i + 1] + KB * f.rgb[i + 2]; C[k] = f.rgb[i] - f.rgb[i + 2];
    my += Y[k]; mc += C[k];
  }
  my /= n * n; mc /= n * n;
  const w = new Float64Array(n);
  let ws = 0;
  for (let x = 0; x < n; x++) { w[x] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (x + 0.5)) / n); ws += w[x]; }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const k = y * n + x, ww = w[x] * w[y]; Y[k] = (Y[k] - my) * ww; C[k] = (C[k] - mc) * ww; }
  // amplitude of a cosine A·cos(…): |X| = A · ws² / 2
  const norm = 2 / (ws * ws);
  const sy = fft2(Y, n), sc = fft2(C, n);
  const spectrum = new Float32Array(n * n);
  const peak = (s: { re: Float64Array; im: Float64Array }, keep: boolean): SpectrumPeak => {
    let best = -1, bu = 0, bv = 0;
    for (let v = 0; v < n; v++) for (let u = 0; u < n; u++) {
      const su = u < n / 2 ? u : u - n, sv = v < n / 2 ? v : v - n;
      const m = Math.hypot(s.re[v * n + u], s.im[v * n + u]);
      if (keep) spectrum[((sv + n / 2) % n) * n + ((su + n / 2) % n)] = Math.log10(1e-9 + m * norm);
      if (Math.hypot(su, sv) < dcBins || (sv < 0 || (sv === 0 && su < 0))) continue; // half plane: real input is symmetric
      if (m > best) { best = m; bu = su; bv = sv; }
    }
    const fu = bu / n, fv = bv / n;
    return { fu, fv, f: Math.hypot(fu, fv), pct: my > 0 ? ((best * norm) / my) * 100 : NaN };
  };
  return { size: n, luma: peak(sy, true), chroma: peak(sc, false), spectrum };
}

/** Does a measured peak sit at the predicted alias (± tolerance in cycles/px, either sign)? */
export function matchesAlias(p: SpectrumPeak, alias: [number, number], tol: number) {
  return Math.min(Math.hypot(p.fu - alias[0], p.fv - alias[1]), Math.hypot(p.fu + alias[0], p.fv + alias[1])) <= tol;
}

// ---------------------------------------------------------------- synthetic camera picture (tests)

/**
 * Camera picture of an LED grid: round emitters (Gaussian spots, σ = `blur` × pitch, standing
 * in for emitter size, lens and optical low-pass) on a pitch of `pitch` picture pixels, rotated
 * by `angle` rad; each picture pixel integrates its area (ss × ss sub-samples). `blur` ≥ 1 gives
 * a flat field.
 */
export function simulateGrid(o: { width: number; height: number; pitch: number; blur?: number; angle?: number; ss?: number; level?: number; rgb?: [number, number, number] }): Frame {
  const { width, height, pitch } = o, sg = o.blur ?? 0.2, ss = o.ss ?? 8, ca = Math.cos(o.angle ?? 0), sa = Math.sin(o.angle ?? 0);
  const col = o.rgb ?? [1, 1, 1], lvl = o.level ?? 1;
  const rgb = new Float32Array(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let on = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const px = x + (i + 0.5) / ss, py = y + (j + 0.5) / ss;
      const gx = (ca * px + sa * py) / pitch, gy = (-sa * px + ca * py) / pitch;
      const dx = gx - Math.round(gx), dy = gy - Math.round(gy);
      on += sg >= 1 ? 1 : Math.exp(-(dx * dx + dy * dy) / (2 * sg * sg));
    }
    const v = (on / (ss * ss)) * lvl, k = (y * width + x) * 3;
    rgb[k] = v * col[0]; rgb[k + 1] = v * col[1]; rgb[k + 2] = v * col[2];
  }
  return { width, height, rgb };
}
