// Colour science used by the scopes and graticules. All signal values are normalised
// R'G'B' / Y' in 0..1 where 0 = black level and 1 = nominal peak (100 %).

import { CAMERA_GAMUTS, LOG_CURVES, isLogCurve, logSceneToSignal, logSignalToScene, type CameraGamutId, type LogCurve } from './camera';

/** Y'CbCr matrix and default primaries. '601' = 525 lines (SMPTE-C), '601-625' = 625 lines (EBU). */
export type Colorspace = '709' | '2020' | '601' | '601-625';
/**
 * SDR display curves: 'sdr' = BT.1886 (γ 2.4), pure power laws 2.2/2.6/2.8 (BT.470 names γ 2.2 for
 * 525 and 2.8 for 625 lines), sRGB (IEC 61966-2-1) and linear.
 */
export type GammaTransfer = 'sdr' | 'g22' | 'g26' | 'g28' | 'srgb' | 'linear';
/** Display transfers plus scene-referred camera log curves (src/camera.ts). */
export type Transfer = GammaTransfer | 'pq' | 'hlg' | LogCurve;
export type { LogCurve } from './camera';
export const isLog = (t: Transfer): t is LogCurve => isLogCurve(t);
export const GAMMA_EXP: Partial<Record<Transfer, number>> = { sdr: 2.4, g22: 2.2, g26: 2.6, g28: 2.8 };
export const isGamma = (t: Transfer): t is GammaTransfer => t in GAMMA_EXP || t === 'srgb' || t === 'linear';

const GAMMA_LABELS: Record<GammaTransfer, string> = { sdr: 'SDR BT.1886 (γ 2,4)', g22: 'Gamma 2,2', g26: 'Gamma 2,6', g28: 'Gamma 2,8', srgb: 'sRGB', linear: 'Linear' };
export function transferLabel(t: Transfer) {
  return isLog(t) ? LOG_CURVES[t].name : isGamma(t) ? GAMMA_LABELS[t] : t.toUpperCase();
}

/** Relative display light (0…1 = black…white) of an SDR-curve signal, and back. */
export function gammaEotf(t: GammaTransfer, v: number) {
  if (t === 'linear') return v;
  if (t === 'srgb') { const a = Math.abs(v); return Math.sign(v) * (a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4)); }
  return Math.pow(Math.max(0, v), GAMMA_EXP[t]!);
}
export function gammaInverse(t: GammaTransfer, l: number) {
  if (t === 'linear') return l;
  if (t === 'srgb') { const a = Math.abs(l); return Math.sign(l) * (a <= 0.0031308 ? 12.92 * a : 1.055 * Math.pow(a, 1 / 2.4) - 0.055); }
  return Math.pow(Math.max(0, l), 1 / GAMMA_EXP[t]!);
}

/** Luma coefficients Kr, Kb (ITU-R BT.601 / BT.709 / BT.2020). */
export const LUMA: Record<Colorspace, { kr: number; kb: number }> = {
  '601': { kr: 0.299, kb: 0.114 },
  '601-625': { kr: 0.299, kb: 0.114 },
  '709': { kr: 0.2126, kb: 0.0722 },
  '2020': { kr: 0.2627, kb: 0.0593 },
};

export type XY = [number, number];
export interface Gamut { name: string; r: XY; g: XY; b: XY; white: XY }

export const D65: XY = [0.3127, 0.329];
export type GamutId = '709' | 'p3' | '2020' | '601' | '601-625' | CameraGamutId;
export const GAMUTS: Record<GamutId, Gamut> = {
  '709': { name: 'Rec.709', r: [0.64, 0.33], g: [0.3, 0.6], b: [0.15, 0.06], white: D65 },
  p3: { name: 'P3-D65', r: [0.68, 0.32], g: [0.265, 0.69], b: [0.15, 0.06], white: D65 },
  '2020': { name: 'Rec.2020', r: [0.708, 0.292], g: [0.17, 0.797], b: [0.131, 0.046], white: D65 },
  // BT.601-7 §2.6.1, p8 (docs/research/ebu-video.md): 525 lines = SMPTE-C, 625 lines = EBU
  '601': { name: 'SMPTE-C (601/525)', r: [0.63, 0.34], g: [0.31, 0.595], b: [0.155, 0.07], white: D65 },
  '601-625': { name: 'EBU (601/625)', r: [0.64, 0.33], g: [0.29, 0.6], b: [0.15, 0.06], white: D65 },
  ...CAMERA_GAMUTS,
};

/** Default primaries of a Y'CbCr colour space. */
export const colorspaceGamut = (cs: Colorspace): GamutId => cs;

export function ycbcr(r: number, g: number, b: number, cs: Colorspace) {
  const { kr, kb } = LUMA[cs];
  const y = kr * r + (1 - kr - kb) * g + kb * b;
  return { y, cb: (b - y) / (2 * (1 - kb)), cr: (r - y) / (2 * (1 - kr)) };
}

/** Row-major 3×3 RGB(linear) → XYZ matrix for a set of primaries. */
export function rgbToXyzMatrix(g: Gamut): number[] {
  const col = ([x, y]: XY) => [x / y, 1, (1 - x - y) / y];
  const R = col(g.r), G = col(g.g), B = col(g.b), W = col(g.white);
  const m = [R[0], G[0], B[0], R[1], G[1], B[1], R[2], G[2], B[2]];
  const s = mul3(inv3(m), W);
  return [m[0] * s[0], m[1] * s[1], m[2] * s[2], m[3] * s[0], m[4] * s[1], m[5] * s[2], m[6] * s[0], m[7] * s[1], m[8] * s[2]];
}

export function mul33(a: number[], b: number[]) {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

// Bradford chromatic adaptation. Cone response matrix and the von-Kries procedure from
// aces-core lib/Lib.Academy.ColorSpaces.ctl l. 43–93 (Apache 2.0, Copyright Contributors
// to the ACES Project, see licenses/aces-core-LICENSE.txt). Changed: transposed to
// column-vector (row-major M·v) convention, ported to TypeScript.
export const BRADFORD = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
export const xyToXyz = ([x, y]: XY): [number, number, number] => [x / y, 1, (1 - x - y) / y];

/** XYZ → XYZ adaptation matrix from one white to another (row-major 3×3). */
export function bradford(src: XY, dst: XY): number[] {
  const s = mul3(BRADFORD, xyToXyz(src)), d = mul3(BRADFORD, xyToXyz(dst));
  const vk = [d[0] / s[0], 0, 0, 0, d[1] / s[1], 0, 0, 0, d[2] / s[2]];
  return mul33(inv3(BRADFORD), mul33(vk, BRADFORD));
}
const sameWhite = (a: XY, b: XY) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

/** Linear RGB in one gamut → linear RGB in another (row-major 3×3), Bradford-adapted when the whites differ. */
export function gamutConvert(from: Gamut, to: Gamut) {
  const toXyz = rgbToXyzMatrix(from);
  const adapted = sameWhite(from.white, to.white) ? toXyz : mul33(bradford(from.white, to.white), toXyz);
  return mul33(inv3(rgbToXyzMatrix(to)), adapted);
}

export type DisplaySpace = 'srgb' | 'p3' | 'rec709' | 'raw';
export const DISPLAY_LABELS: Record<DisplaySpace, string> = {
  srgb: 'sRGB-Display', p3: 'Display P3', rec709: 'Rec.709 / BT.1886 (2.4)', raw: 'Signal direkt (ohne Umrechnung)',
};

/** What the end device can show, via CSS media queries. */
export function detectDisplay(): { space: DisplaySpace; hdr: boolean; gamut: string } {
  const mq = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const gamut = mq('(color-gamut: rec2020)') ? 'rec2020' : mq('(color-gamut: p3)') ? 'p3' : 'srgb';
  return { space: gamut === 'srgb' ? 'srgb' : 'p3', hdr: mq('(dynamic-range: high)'), gamut };
}

export function mul3(m: number[], v: number[]) {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

export function inv3(m: number[]) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

// SMPTE ST 2084 (PQ)
const M1 = 2610 / 16384, M2 = (2523 / 4096) * 128, C1 = 3424 / 4096, C2 = (2413 / 4096) * 32, C3 = (2392 / 4096) * 32;
export function pqEncode(nits: number) {
  const y = Math.max(0, nits) / 10000, p = Math.pow(y, M1);
  return Math.pow((C1 + C2 * p) / (1 + C3 * p), M2);
}
export function pqDecode(signal: number) {
  const p = Math.pow(Math.max(0, signal), 1 / M2);
  return 10000 * Math.pow(Math.max(0, p - C1) / (C2 - C3 * p), 1 / M1);
}

// ARIB STD-B67 / BT.2100 HLG
const HA = 0.17883277, HB = 1 - 4 * HA, HC = 0.5 - HA * Math.log(4 * HA);
export function hlgOetf(e: number) {
  return e <= 1 / 12 ? Math.sqrt(3 * Math.max(0, e)) : HA * Math.log(12 * e - HB) + HC;
}
export function hlgInverseOetf(v: number) {
  return v <= 0.5 ? (v * v) / 3 : (Math.exp((v - HC) / HA) + HB) / 12;
}
/**
 * HLG system gamma for a display of peak luminance Lw (BT.2100-3, Note 5f, p9):
 * γ = 1.2 + 0.42·log10(Lw/1000) for 400–2000 cd/m², outside that range the extended
 * formula γ = 1.2·κ^log2(Lw/1000) with κ = 1.111 (matches the R 167 presets, Tab. 1.1).
 */
export function hlgGamma(lw = 1000) {
  return lw >= 400 && lw <= 2000 ? 1.2 + 0.42 * Math.log10(lw / 1000) : 1.2 * Math.pow(1.111, Math.log2(lw / 1000));
}
/** R 167 v1.1 Tab. 1.1 (p6): predefined HLG display peaks in cd/m². */
export const HLG_PEAKS = [500, 600, 1000, 2000, 3000, 4000, 5000, 10000];
/**
 * HLG OOTF (BT.2100-3 p8, Note 5e): F_D = Lw·Y_S^(γ−1)·E with Y_S the scene luminance
 * from the BT.2020 luma weights – the gamma acts on luminance, not on each channel.
 * @param e scene-linear R, G, B (inverse OETF) · @returns display light in cd/m²
 */
export function hlgOotf(e: [number, number, number], lw = 1000): [number, number, number] {
  const ys = 0.2627 * e[0] + 0.678 * e[1] + 0.0593 * e[2];
  const k = ys > 0 ? lw * Math.pow(ys, hlgGamma(lw) - 1) : 0;
  return [k * e[0], k * e[1], k * e[2]];
}
/** Displayed luminance of an achromatic HLG signal on a display with peak Lw. */
export function hlgNits(v: number, lw = 1000) { return lw * Math.pow(hlgInverseOetf(v), hlgGamma(lw)); }
export function hlgFromNits(n: number, lw = 1000) { return hlgOetf(Math.pow(Math.max(0, n) / lw, 1 / hlgGamma(lw))); }

/** BT.709 OETF (BT.709-6, p5): V = 1.099·L^0.45 − 0.099 for L ≥ 0.018, else 4.5·L. */
export function bt709Oetf(l: number) { return l < 0.018 ? 4.5 * l : 1.099 * Math.pow(l, 0.45) - 0.099; }
export function bt709InverseOetf(v: number) { return v < 0.081 ? v / 4.5 : Math.pow((v + 0.099) / 1.099, 1 / 0.45); }

/** SDR per BT.1886 with a 100 cd/m² reference white. */
export function sdrNits(v: number) { return 100 * Math.pow(Math.max(0, v), 2.4); }
export function sdrFromNits(n: number) { return Math.pow(Math.max(0, n) / 100, 1 / 2.4); }

/** Display luminance of a signal level. Log curves are scene-referred: see signalToScene. */
export function signalToNits(v: number, t: Transfer, lw = 1000) {
  return t === 'pq' ? pqDecode(v) : t === 'hlg' ? hlgNits(v, lw) : isLog(t) ? 100 * logSignalToScene(t, v) : 100 * gammaEotf(t, v);
}
export function nitsToSignal(n: number, t: Transfer, lw = 1000) {
  return t === 'pq' ? pqEncode(n) : t === 'hlg' ? hlgFromNits(n, lw) : isLog(t) ? logSceneToSignal(t, n / 100) : gammaInverse(t, Math.max(0, n) / 100);
}
/** Scene-linear reflectance (0.18 = grey card) of a log signal level. */
export function signalToScene(v: number, t: LogCurve) { return logSignalToScene(t, v); }
export function sceneToSignal(x: number, t: LogCurve) { return logSceneToSignal(t, x); }

/** Read-out of a level: cd/m² for display transfers, reflectance and stops for log. */
export function levelText(v: number, t: Transfer, lw = 1000) {
  if (isLog(t)) {
    const x = signalToScene(v, t), st = x > 0 ? Math.log2(x / 0.18) : -Infinity;
    return `${(x * 100).toFixed(1)} % Szene (${Number.isFinite(st) ? `${st >= 0 ? '+' : ''}${st.toFixed(1)}` : '−∞'} Bl.)`;
  }
  return `${Math.round(signalToNits(v, t, lw))} cd/m² (${transferLabel(t)}${t === 'hlg' && lw !== 1000 ? ` ${lw}` : ''})`;
}

/** ffprobe color_transfer names and what they mean here. Unlisted/unknown = not signalled. */
const FF_TRANSFER: Record<string, Transfer> = {
  smpte2084: 'pq', 'arib-std-b67': 'hlg', bt709: 'sdr', smpte170m: 'sdr', 'bt2020-10': 'sdr', 'bt2020-12': 'sdr', bt1361e: 'sdr',
  smpte240m: 'sdr', gamma22: 'g22', gamma28: 'g28', 'iec61966-2-1': 'srgb', 'iec61966-2-4': 'sdr', linear: 'linear',
};
/** Map ffprobe colour metadata to our settings (BT.1886 when nothing is signalled). */
export function detectTransfer(ffTransfer?: string): Transfer {
  return (ffTransfer && FF_TRANSFER[ffTransfer]) || 'sdr';
}
/** Is the transfer actually signalled in the stream (vs. assumed)? */
export const transferSignalled = (ffTransfer?: string) => !!(ffTransfer && FF_TRANSFER[ffTransfer]);
/** 525/625 split: bt470bg = 625 lines (EBU primaries), smpte170m = 525 lines (SMPTE-C). */
export function detectColorspace(matrix?: string, primaries?: string, height = 1080): Colorspace {
  if (matrix?.startsWith('bt2020') || primaries === 'bt2020') return '2020';
  if (matrix === 'bt709' || primaries === 'bt709') return '709';
  if (primaries === 'bt470bg') return '601-625';
  if (primaries === 'smpte170m') return '601';
  if (matrix === 'bt470bg') return '601-625';
  if (matrix === 'smpte170m') return '601';
  if (matrix === 'bt601') return height === 576 ? '601-625' : '601';
  return height > 576 ? '709' : height === 576 ? '601-625' : '601';
}

/** Legal-range code value for a normalised signal level (0 % = 16/64, 100 % = 235/940). */
export function codeValue(level: number, bits: 8 | 10) {
  return bits === 8 ? 16 + level * 219 : 64 + level * 876;
}

/** Vectorscope targets for 75 % and 100 % colour bars. */
export const BAR_COLORS: { label: string; rgb: [number, number, number] }[] = [
  { label: 'R', rgb: [1, 0, 0] }, { label: 'Mg', rgb: [1, 0, 1] }, { label: 'B', rgb: [0, 0, 1] },
  { label: 'Cy', rgb: [0, 1, 1] }, { label: 'G', rgb: [0, 1, 0] }, { label: 'Yl', rgb: [1, 1, 0] },
];
export function barTargets(cs: Colorspace, level: number) {
  return BAR_COLORS.map(({ label, rgb }) => {
    const { cb, cr } = ycbcr(rgb[0] * level, rgb[1] * level, rgb[2] * level, cs);
    return { label, cb, cr };
  });
}

/**
 * Vectorscope targets for a camera log source: the Rec.709 bars as scene light (100 % → 1.0,
 * 75 % → BT.709 inverse OETF of 0.75), converted into the source gamut and log-encoded.
 * Shows where a correctly exposed 709 chart lands in the log signal.
 */
export function logBarTargets(t: LogCurve, gamut: GamutId, cs: Colorspace, level: number) {
  const m = gamutConvert(GAMUTS['709'], GAMUTS[gamut]);
  const lin = level >= 1 ? 1 : bt709InverseOetf(level);
  return BAR_COLORS.map(({ label, rgb }) => {
    const c = mul3(m, rgb.map((v) => v * lin)).map((v) => logSceneToSignal(t, v));
    const { cb, cr } = ycbcr(c[0], c[1], c[2], cs);
    return { label, cb, cr };
  });
}

/** Skin-tone ("I") line angle, measured counter-clockwise from +Cb. */
export const SKIN_LINE_DEG = 123;

/** CIE 1931 2° spectral locus (x, y), 380–700 nm. */
export const SPECTRAL_LOCUS: [number, number, number][] = [
  [380, 0.1741, 0.005], [400, 0.1733, 0.0048], [420, 0.1714, 0.0051], [430, 0.1689, 0.0069],
  [440, 0.1644, 0.0109], [450, 0.1566, 0.0177], [460, 0.144, 0.0297], [470, 0.1241, 0.0578],
  [475, 0.1096, 0.0868], [480, 0.0913, 0.1327], [485, 0.0687, 0.2007], [490, 0.0454, 0.295],
  [495, 0.0235, 0.4127], [500, 0.0082, 0.5384], [505, 0.0039, 0.6548], [510, 0.0139, 0.7502],
  [515, 0.0389, 0.812], [520, 0.0743, 0.8338], [525, 0.1142, 0.8262], [530, 0.1547, 0.8059],
  [540, 0.2296, 0.7543], [550, 0.3016, 0.6923], [560, 0.3731, 0.6245], [570, 0.4441, 0.5547],
  [580, 0.5125, 0.4866], [590, 0.5752, 0.4242], [600, 0.627, 0.3725], [610, 0.6658, 0.334],
  [620, 0.6915, 0.3083], [630, 0.7079, 0.292], [640, 0.719, 0.2809], [650, 0.726, 0.274],
  [660, 0.73, 0.27], [680, 0.7334, 0.2666], [700, 0.7347, 0.2653],
];

export interface FalseColorBand { from: number; to: number; color: string; label: string }
/** Signal-level bands in % (ARRI-style exposure false colour). Everything else shows as greyscale. */
export const FALSE_COLOR_PRESETS: Record<string, FalseColorBand[]> = {
  ARRI: [
    { from: 0, to: 2.5, color: '#8a2be2', label: 'Schwarz-Clip' },
    { from: 2.5, to: 4, color: '#1e5bff', label: 'knapp über Schwarz' },
    { from: 38, to: 42, color: '#22c55e', label: '18 % Grau' },
    { from: 52, to: 56, color: '#ff6ec7', label: 'Grau +1 Blende' },
    { from: 97, to: 99, color: '#ffd400', label: 'knapp unter Weiß' },
    { from: 99, to: 100.01, color: '#ff1f1f', label: 'Weiß-Clip' },
  ],
  Belichtung: [
    { from: 0, to: 5, color: '#6a0dad', label: 'abgesoffen' },
    { from: 5, to: 20, color: '#1e3a8a', label: 'Schatten' },
    { from: 40, to: 50, color: '#16a34a', label: 'Mittelton' },
    { from: 55, to: 70, color: '#f472b6', label: 'Hautton' },
    { from: 90, to: 97, color: '#facc15', label: 'Lichter' },
    { from: 97, to: 100.01, color: '#dc2626', label: 'Clip' },
  ],
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------- chromaticity & colour difference

/** CIE 1976 UCS: u′ = 4X/(X+15Y+3Z), v′ = 9Y/(X+15Y+3Z) (alwan alwan_colorspace_core.inc l. 75–81, MIT). */
export function xyzToUv(X: number, Y: number, Z: number): XY {
  const d = X + 15 * Y + 3 * Z;
  return d > 0 ? [(4 * X) / d, (9 * Y) / d] : [0, 0];
}
/** CIE 1931 xy → CIE 1976 u′v′ (same formula with X = x, Y = y, Z = 1 − x − y). */
export function xyToUv([x, y]: XY): XY {
  const d = -2 * x + 12 * y + 3;
  return [(4 * x) / d, (9 * y) / d];
}

/** CIE XYZ → CIELAB (CIE 15:2004) relative to a reference white XYZ. */
export function xyzToLab(xyz: number[], white: number[]): [number, number, number] {
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = [0, 1, 2].map((i) => f(xyz[i] / white[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000 colour difference (kL = kC = kH = 1). Ported from alwan
 * core/alwan_colorspace_core.inc l. 425–489 (MIT, Copyright (c) 2025 Soufiane KHIAT).
 */
export function deltaE2000(lab1: number[], lab2: number[]): number {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const rad = Math.PI / 180, P7 = 6103515625; // 25^7
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, Cm7 = Cm ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cm7 / (Cm7 + P7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p;
  const achromatic = C1p * C2p === 0;
  const dh = h2p - h1p;
  const dhp = achromatic ? 0 : Math.abs(dh) <= 180 ? dh : dh > 180 ? dh - 360 : dh + 360;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2;
  const hs = h1p + h2p;
  const Hpm = achromatic ? hs : Math.abs(dh) <= 180 ? hs / 2 : hs < 360 ? (hs + 360) / 2 : (hs - 360) / 2;
  const T = 1 - 0.17 * Math.cos((Hpm - 30) * rad) + 0.24 * Math.cos(2 * Hpm * rad) + 0.32 * Math.cos((3 * Hpm + 6) * rad) - 0.2 * Math.cos((4 * Hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((Hpm - 275) / 25) ** 2));
  const Cpm7 = Cpm ** 7, RC = 2 * Math.sqrt(Cpm7 / (Cpm7 + P7));
  const l50 = (Lpm - 50) ** 2;
  const SL = 1 + (0.015 * l50) / Math.sqrt(20 + l50), SC = 1 + 0.045 * Cpm, SH = 1 + 0.015 * Cpm * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  const t1 = dLp / SL, t2 = dCp / SC, t3 = dHp / SH;
  return Math.sqrt(t1 * t1 + t2 * t2 + t3 * t3 + RT * t2 * t3);
}

/**
 * ICtCp (PQ) from linear BT.2020 RGB in cd/m². Matrices are the BT.2100-3 integer
 * coefficients /4096 (Table 7), as in alwan data/ictcp_rgb_to_lms.csv and
 * ictcp_lms_p_to_ictcp_pq.csv.
 */
export function rgb2020ToIctcp(rgb: number[]): [number, number, number] {
  const lms = mul3([1688, 2146, 262, 683, 2951, 462, 99, 309, 3688].map((v) => v / 4096), rgb).map(pqEncode);
  return mul3([2048, 2048, 0, 6610, -13613, 7003, 17933, -17390, -543].map((v) => v / 4096), lms) as [number, number, number];
}

/** ΔE ITP (ITU-R BT.2124): 720·√(ΔI² + 0.25·ΔCt² + ΔCp²) (alwan alwan_colorspace_core.inc l. 332–337). */
export function deltaEITP(ictcp1: number[], ictcp2: number[]): number {
  const dI = ictcp1[0] - ictcp2[0], dT = ictcp1[1] - ictcp2[1], dP = ictcp1[2] - ictcp2[2];
  return 720 * Math.sqrt(dI * dI + 0.25 * dT * dT + dP * dP);
}

/**
 * Gamut distance per pixel (idea from jedypod/gamut-compress, formula re-implemented):
 * d = (max − c)/|max| over the channels of a linear RGB value in the target gamut.
 * 0 = neutral, 1 = on the gamut boundary (a channel reaches 0), > 1 = outside.
 */
export function gamutDistance(rgb: number[]): number {
  const ach = Math.max(rgb[0], rgb[1], rgb[2]);
  if (ach <= 0) return 0;
  return Math.max(...rgb.map((c) => (ach - c) / Math.abs(ach)));
}

// ---------------------------------------------------------------- linear light (CST, shared with the shaders)

/** HLG reference white (75 % signal, BT.2408) in cd/m² on a display of peak Lw. */
export const hlgRefWhite = (lw = 1000) => lw * Math.pow(hlgInverseOetf(0.75), hlgGamma(lw));

/**
 * Signal R'G'B' → linear light with 1.0 = reference white (mirror of toLinear in renderer.ts):
 * SDR BT.1886 γ 2.4 · PQ cd/m²/203 · HLG OOTF on luminance (ys = Y row of the gamut) · log scene-linear.
 */
export function signalToLinear(rgb: number[], t: Transfer, lw = 1000, ys: number[] = [0.2627, 0.678, 0.0593]): number[] {
  if (t === 'pq') return rgb.map((v) => pqDecode(v) / 203);
  if (t === 'hlg') {
    const e = rgb.map(hlgInverseOetf);
    const y = e[0] * ys[0] + e[1] * ys[1] + e[2] * ys[2];
    const k = y > 0 ? (lw / hlgRefWhite(lw)) * Math.pow(y, hlgGamma(lw) - 1) : 0;
    return e.map((v) => v * k);
  }
  if (isLog(t)) return rgb.map((v) => logSignalToScene(t, v));
  return rgb.map((v) => gammaEotf(t as GammaTransfer, v));
}

/** Inverse of signalToLinear (HLG: inverse OOTF, then OETF). SDR is not clipped above 1. */
export function linearToSignal(l: number[], t: Transfer, lw = 1000, ys: number[] = [0.2627, 0.678, 0.0593]): number[] {
  if (t === 'pq') return l.map((v) => pqEncode(v * 203));
  if (t === 'hlg') {
    const f = l.map((v) => (Math.max(0, v) * hlgRefWhite(lw)) / lw); // display light / Lw
    const yd = f[0] * ys[0] + f[1] * ys[1] + f[2] * ys[2];
    if (yd <= 0) return [0, 0, 0];
    const g = hlgGamma(lw), y = Math.pow(yd, 1 / g), k = Math.pow(y, g - 1);
    return f.map((v) => hlgOetf(v / k));
  }
  if (isLog(t)) return l.map((v) => logSceneToSignal(t, v));
  return l.map((v) => gammaInverse(t as GammaTransfer, v));
}

/**
 * BT.2390 EETF (ITU-R BT.2390, section 5.4): Hermite roll-off in the PQ domain from a source
 * peak to a target peak, identity below the knee KS = 1.5·maxLum − 0.5. Ported from alwan
 * core/alwan_hdr_core.inc l. 235–265 (MIT); black level terms left out (LB = 0).
 * @param e PQ signal · @param srcPeak, tgtPeak PQ signal of the peaks
 */
export function bt2390Eetf(e: number, srcPeak: number, tgtPeak: number): number {
  const range = Math.max(1e-10, srcPeak);
  const en = Math.min(1, Math.max(0, e / range));
  const maxLum = Math.min(1, tgtPeak / range);
  const ks = Math.min(1, Math.max(0, 1.5 * maxLum - 0.5));
  if (en <= ks) return en * range;
  const t = Math.min(1, (en - ks) / (1 - ks + 1e-10)), t2 = t * t, t3 = t2 * t;
  const p = (2 * t3 - 3 * t2 + 1) * ks + (t3 - 2 * t2 + t) * (1 - ks) + (-2 * t3 + 3 * t2) * maxLum;
  return p * range;
}
