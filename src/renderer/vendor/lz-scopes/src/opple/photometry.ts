// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Opple Light Master 3 / 4 – raw channels to XYZ, lux, xy, CCT, Duv (#11).
//
// The meters report raw counts per filter band; the colour maths runs on the client.
// Matrices and the LM3 source-type rule are taken from natmart-in/sunday-light-meter
// `src/lm3.js`, `src/lm4.js` @ eb50efc (MIT, licenses/sunday-light-meter-LICENSE.txt).
// Origin of the numbers as that project states it: LM3 3×7 matrices via OlliV/
// open-light-master, LM4 3×8 matrix (set `LightmasterIVCoeff_20231115`) extracted from
// the official OPPLE Smart app by gabrielebaudo/opple-bridge. Using the app's
// coefficients commercially is an open question (docs/research/opple-light-master.md).
//
// Filter sensors with 6–8 bands and fixed matrices suit room and set light; for narrow-band
// LED primaries (LED walls) the colour values are a trend indicator, not a reference.

import type { Calibration, Measurement, Model } from './protocol';
import type { Spectrum } from './spectrum';

export const LM3_WAVELENGTHS = [450, 500, 550, 570, 600, 650];
export const LM4_WAVELENGTHS = [415, 445, 480, 515, 555, 590, 630, 680];

/** LM3 matrices per source type 1 = monochromatic, 2 = incandescent, 3 = general; columns: 6 bands + constant c1. */
const LM3_MATRICES = [
  [
    [0.06023, 0.00106, 0.02108, 0.03673, 0.1683, 0.02001, 0.0],
    [0.00652, 0.04478, 0.16998, -0.03268, 0.07425, 0.00739, 0.0],
    [0.33092, 0.12936, -0.15809, 0.19889, -0.0156, 0.00296, 0.0],
  ],
  [
    [-0.43786, 0.53102, -0.1453, 0.2316, 0.36758, -0.09047, 0.0],
    [-0.23226, 0.69225, -0.39786, 0.22539, 0.47947, -0.17614, 0.0],
    [-0.11002, 1.21259, -0.56003, 0.14487, 0.35074, -0.30248, 0.0],
  ],
  [
    [-0.05825, -0.0896, 0.25859, 0.19518, 0.10893, 0.06724, 0.0],
    [-0.19865, 0.01337, 0.40651, 0.29702, -0.06287, 0.03282, 0.0],
    [0.58258, 0.11548, 0.21823, -0.00136, -0.10732, -0.00915, 0.0],
  ],
];
export const LM3_MODE_NAMES: Record<number, string> = { 1: 'monochromatisch', 2: 'Glühlampe', 3: 'allgemein' };

const LM4_MATRIX = [
  [-0.873112331303128, 0.805269469275936, -0.14141487926448, 0.0341236934045446, 0.290053924131123, 0.681542877395036, 0.237949611300369, -0.0216220125618065],
  [-0.892318403241807, 0.283584501574269, -0.142426509016336, 0.670437256572805, 0.619588489202499, 0.436347226426992, 0.0482937353635748, -0.00263886395266582],
  [-1.60374782255152, 3.11179541056893, 0.945597350971534, -0.0788297890447575, 0.103830669638194, -0.0824849988110418, -0.0071035486372898, -0.0659551443269493],
];

/** LM3 source type from the calibrated channel shares (sunday-light-meter `lm3LightMode`). */
export function lm3Mode(ch: number[]) {
  const [V, B, G, Y, O, R] = ch, total = V + B + G + Y + O + R;
  if (total <= 0) return 3;
  const a = (O + R) / total, b = (R - Y) / total;
  if (Math.max(V, B, G, Y, O, R) / total >= 0.45) return 1;
  if (a >= 0.5 && a <= 0.55 && b >= 0 && b <= 0.05) return 2;
  return 3;
}

const dotPos = (row: number[], v: number[]) => Math.max(0, row.reduce((s, w, k) => s + w * v[k], 0));

// ---------------------------------------------------------------- colorimetry

export const xyzToXy = (X: number, Y: number, Z: number): [number, number] => { const s = X + Y + Z; return s === 0 ? [0, 0] : [X / s, Y / s]; };

/** CIE 1931 xy → CIE 1960 UCS u, v (u = 4x/(−2x+12y+3), v = 6y/(−2x+12y+3)). */
export function xyToUv(x: number, y: number): [number, number] {
  const d = -2 * x + 12 * y + 3;
  return [(4 * x) / d, (6 * y) / d];
}

/**
 * CCT after McCamy (1992, Color Res. Appl. 17(2) 142–144, with erratum), as given in
 * Wikipedia "Correlated color temperature", section Approximation (opened 30.09.2026):
 * CCT = −449 n³ + 3525 n² − 6823.3 n + 5520.33 with n = (x − 0.3320)/(y − 0.1858);
 * error < 2 K between 2856 K and 6504 K, a rough value outside.
 */
export function cctMcCamy(x: number, y: number) {
  if (y === 0.1858) return NaN;
  const n = (x - 0.332) / (y - 0.1858);
  return -449 * n ** 3 + 3525 * n ** 2 - 6823.3 * n + 5520.33;
}

// k0…k6 of the Planckian-locus polynomial in the angle a (Ohno, "Practical Use and
// Calculation of CCT and Duv", LEUKOS 10(1), 2014, doi 10.1080/15502724.2014.839020 –
// paper not accessible here; the coefficients are those of sunday-light-meter and of
// waveformlighting.com "Calculate Duv from CIE 1931 xy", opened 30.09.2026, both agree).
// test/opple.test.ts checks the result against the exact Planckian locus (Planck + CIE 1931).
const DUV_K = [-0.471106, 1.925865, -2.4243787, 1.5317403, -0.5179722, 0.0893944, -0.00616793];

/** Duv: signed distance from the Planckian locus in CIE 1960 uv (+ = above/green, − = below/magenta). */
export function duvFromUv(u: number, v: number) {
  const lfp = Math.hypot(u - 0.292, v - 0.24);
  if (lfp === 0) return 0;
  const a = Math.acos((u - 0.292) / lfp);
  let lbb = 0;
  for (let i = 0; i < 7; i++) lbb += DUV_K[i] * a ** i;
  return lfp - lbb;
}

export interface Reading {
  model: Model | 'argyll' | 'datei';
  /** illuminance in lx (Y of the meter's XYZ) */
  lux: number;
  X: number; Y: number; Z: number;
  x: number; y: number; u: number; v: number;
  cct: number; duv: number;
  /** LM3 only: source-type matrix used */
  mode: number | null;
  /** calibrated channels (without the LM4 clear channel) */
  bands: number[];
  wavelengths: number[];
  raw: number[];
  calibrated: boolean;
  battery: number | null;
  temperature: number | null;
  ts: number;
  /** key of the meter that took it (src/opple/store.ts); unset for single readings */
  device?: string;
  /** spectrometers (drivers.ts): measured spectrum and what ArgyllCMS computed from it */
  spectrum?: Spectrum;
  cri?: { ra: number; r9: number; r: number[]; caution: boolean };
  tlci?: { qa: number; caution: boolean };
  tm30?: { rf: number; rg: number; caution: boolean };
  /** 'cd/m²' when the instrument measured luminance (no ambient mode); default lx */
  quantity?: 'lx' | 'cd/m²';
}

/** Raw measurement + unit calibration → photometric reading. */
export function processMeasurement(m: Measurement, cal: Calibration | null, ts = Date.now()): Reading {
  const k = cal && cal.model === m.model ? cal.kSensor : null;
  let XYZ: number[], mode: number | null = null, bands: number[];
  if (m.model === 'lm4') {
    const ch = m.raw.slice(0, 9).map((r, i) => r * (k?.[i] ?? 1));
    bands = ch.slice(0, 8);
    XYZ = LM4_MATRIX.map((row) => dotPos(row, bands));
  } else {
    const ch = m.raw.slice(0, 6).map((r, i) => r * (k?.[i] ?? 1));
    const c1 = k?.[6] ?? 1;
    mode = lm3Mode(ch);
    bands = ch;
    XYZ = LM3_MATRICES[mode - 1].map((row) => dotPos(row, [...ch, c1]));
  }
  const [X, Y, Z] = XYZ;
  const [x, y] = xyzToXy(X, Y, Z);
  const [u, v] = x || y ? xyToUv(x, y) : [0, 0];
  const dark = !(Y > 0);
  return {
    model: m.model, lux: Y, X, Y, Z, x, y, u, v,
    cct: dark ? NaN : cctMcCamy(x, y), duv: dark ? NaN : duvFromUv(u, v), mode,
    bands, wavelengths: m.model === 'lm4' ? LM4_WAVELENGTHS : LM3_WAVELENGTHS,
    raw: m.raw, calibrated: !!k, battery: m.batteryRaw || null, temperature: m.temperature, ts,
  };
}

/** CSV of a reading history (comma, dot decimals). */
export function readingsCsv(list: Reading[], note = '') {
  const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : '');
  const head = ['zeit', 'modell', 'lux', 'x', 'y', 'u', 'v', 'cct_k', 'duv', 'kalibriert', 'temperatur_c', 'kanaele_roh'];
  return [
    '# LZ Scopes – Opple Light Master (Werte clientseitig aus Rohkanälen; McCamy-CCT, Ohno-Duv)' + (note ? `,"${note.replace(/"/g, '""')}"` : ''),
    head.join(','),
    ...list.map((r) => [new Date(r.ts).toISOString(), r.model, f(r.lux, 2), f(r.x, 5), f(r.y, 5), f(r.u, 5), f(r.v, 5), f(r.cct, 0), f(r.duv, 5), r.calibrated ? 'ja' : 'nein', r.temperature ?? '', `"${r.raw.join(' ')}"`].join(',')),
  ].join('\n') + '\n';
}
