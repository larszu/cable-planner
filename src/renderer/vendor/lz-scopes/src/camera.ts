// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Camera log curves and camera gamuts.
//
// Curves and primaries are ported from alwan (https://github.com/soufianekhiat/alwan),
// MIT License, Copyright (c) 2025 Soufiane KHIAT – see licenses/alwan-LICENSE.txt.
// Curve source: src/alwan/core/alwan_rgb_core.inc (line numbers per curve below),
// primaries: src/alwan/data/rgb_spaces/*.csv (included via alwan_rgb_embedded.h).
// Cross-checked against the OCIO LogCameraTransform parameters of Joegenco/PixelManager
// config.ocio (see test/camera.test.ts); no code taken from there.
//
// All curves map scene-linear reflectance (0.18 = 18 % grey card) to a curve value that
// is a full-range 10-bit code / 1023, the way the manufacturers specify them. Cameras
// carry these codes unchanged in a narrow-range (64–940) video signal, so the scopes'
// normalised signal v (0 = code 64, 1 = code 940) maps to the curve value as
// (64 + 876·v) / 1023.

export type LogCurve =
  | 'logc3' | 'logc4' | 'slog3' | 'vlog' | 'bmdfilm5' | 'clog2' | 'clog3' | 'log3g10' | 'flog2' | 'dlog' | 'nlog' | 'applelog'
  | 'slog2' | 'acescct' | LogC3Ei;

/**
 * ARRI LogC3 for other exposure indices: parameters from ARRI, H. Brendel, "ALEXA Log C Curve –
 * Usage in VFX" (2017-03), appendix, table "conversion between Log C values and exposure values"
 * (p8): lin2log(x) = x > cut ? c·log10(a·x + b) + d : e·x + f. EI 800 is `logc3` (same values).
 * Above EI 1600 the compact formula does not describe the camera curve (same document) – no entry.
 */
export const LOGC3_EI = {
  160: [0.005561, 5.555556, 0.080216, 0.269036, 0.381991, 5.842037, 0.092778],
  200: [0.006208, 5.555556, 0.076621, 0.266007, 0.382478, 5.776265, 0.092782],
  250: [0.006871, 5.555556, 0.072941, 0.262978, 0.382966, 5.710494, 0.092786],
  320: [0.007622, 5.555556, 0.068768, 0.259627, 0.383508, 5.637732, 0.092791],
  400: [0.008318, 5.555556, 0.064901, 0.256598, 0.383999, 5.57196, 0.092795],
  500: [0.009031, 5.555556, 0.060939, 0.253569, 0.384493, 5.506188, 0.0928],
  640: [0.00984, 5.555556, 0.056443, 0.250219, 0.38504, 5.433426, 0.092805],
  1000: [0.011361, 5.555556, 0.047996, 0.244161, 0.386036, 5.301883, 0.092814],
  1280: [0.012235, 5.555556, 0.043137, 0.24081, 0.38659, 5.229121, 0.092819],
  1600: [0.013047, 5.555556, 0.038625, 0.237781, 0.387093, 5.16335, 0.092824],
} as const;
export type LogC3Ei = `logc3-${keyof typeof LOGC3_EI}`;

/** Camera and wide gamuts in addition to the video standards in color.ts. */
export type CameraGamutId = 'awg3' | 'awg4' | 'sgamut3' | 'sgamut3cine' | 'vgamut' | 'bmdwg5' | 'cinema' | 'rwg' | 'dgamut' | 'dwg' | 'ap0' | 'ap1';

type XY = [number, number];
export interface CameraGamut { name: string; r: XY; g: XY; b: XY; white: XY }

const D65: XY = [0.3127, 0.329];
/** ACES white (Academy TB-2014-004), aces-core Lib.Academy.OutputTransform.ctl l. 14–36. */
export const ACES_WHITE: XY = [0.32168, 0.33767];

// alwan data/rgb_spaces/<file>.csv, row order R xy, G xy, B xy, white xy
export const CAMERA_GAMUTS: Record<CameraGamutId, CameraGamut> = {
  awg3: { name: 'ARRI Wide Gamut 3', r: [0.684, 0.313], g: [0.221, 0.848], b: [0.0861, -0.102], white: D65 }, // arri_wide_gamut_3.csv
  awg4: { name: 'ARRI Wide Gamut 4', r: [0.7347, 0.2653], g: [0.1424, 0.8576], b: [0.0991, -0.0308], white: D65 }, // arri_wide_gamut_4.csv
  sgamut3: { name: 'S-Gamut3', r: [0.73, 0.28], g: [0.14, 0.855], b: [0.1, -0.05], white: D65 }, // s-gamut3.csv
  sgamut3cine: { name: 'S-Gamut3.Cine', r: [0.766, 0.275], g: [0.225, 0.8], b: [0.089, -0.087], white: D65 }, // s-gamut3cine.csv
  vgamut: { name: 'V-Gamut', r: [0.73, 0.28], g: [0.165, 0.84], b: [0.1, -0.03], white: D65 }, // v-gamut.csv
  bmdwg5: { name: 'Blackmagic WG Gen5', r: [0.7177215, 0.3171181], g: [0.228041, 0.861569], b: [0.1005841, -0.0820452], white: [0.312717, 0.3290312] }, // blackmagic_wide_gamut.csv
  cinema: { name: 'Canon Cinema Gamut', r: [0.74, 0.27], g: [0.17, 1.14], b: [0.08, -0.1], white: D65 }, // cinema_gamut.csv
  rwg: { name: 'REDWideGamutRGB', r: [0.780308, 0.304253], g: [0.121595, 1.493994], b: [0.095612, -0.084589], white: D65 }, // redwidegamutrgb.csv
  dgamut: { name: 'DJI D-Gamut', r: [0.71, 0.31], g: [0.21, 0.88], b: [0.09, -0.08], white: D65 }, // dji_d-gamut.csv
  dwg: { name: 'DaVinci Wide Gamut', r: [0.8, 0.313], g: [0.1682, 0.9877], b: [0.079, -0.1155], white: D65 }, // davinci_wide_gamut.csv
  ap0: { name: 'ACES AP0', r: [0.7347, 0.2653], g: [0, 1], b: [0.0001, -0.077], white: ACES_WHITE }, // aces2065-1.csv
  ap1: { name: 'ACES AP1', r: [0.713, 0.293], g: [0.165, 0.83], b: [0.128, 0.044], white: ACES_WHITE }, // acescg.csv
};

/**
 * Generic two-segment log curve (the shape of OCIO's LogCameraTransform):
 *   encode x < cutLin : linSlope·x + linOff
 *            else     : logSlope·log_base(linSideSlope·x + linSideOff) + logOff
 * decode is the exact inverse, split at cutEnc.
 */
export interface LogParams {
  base: number; logSlope: number; logOff: number; linSideSlope: number; linSideOff: number;
  cutLin: number; cutEnc: number; linSlope: number; linOff: number;
  /** alwan clamps negative scene values to 0 before encoding (C-Log2). */
  clampNeg?: boolean;
}

export interface LogCurveDef {
  name: string;
  /** Native gamut of the camera (a CameraGamutId or '2020'). */
  gamut: CameraGamutId | '2020';
  /** 0 generic (params), 1 C-Log3, 2 N-Log, 3 Apple Log – the shader has the special ones built in. */
  kind: 0 | 1 | 2 | 3;
  p?: LogParams;
  /** alwan_rgb_core.inc line of the OETF */
  ref: string;
}

const NONE = -1e9;

const LOGC3_EI_CURVES = Object.fromEntries(Object.entries(LOGC3_EI).map(([ei, [cut, a, b, c, d, e, f]]) => [`logc3-${ei}`, {
  name: `ARRI LogC3 EI ${ei}`, gamut: 'awg3', kind: 0, ref: 'ARRI ALEXA Log C Curve – Usage in VFX, p8',
  p: { base: 10, logSlope: c, logOff: d, linSideSlope: a, linSideOff: b, cutLin: cut, cutEnc: e * cut + f, linSlope: e, linOff: f },
} satisfies LogCurveDef])) as Record<LogC3Ei, LogCurveDef>;

/** narrow-range carriage of a full-range curve value y: code/1023 = (876·y + 64)/1023 (alwan full_to_legal_10bit) */
const L = (y: number) => (876 * y + 64) / 1023;
const SLOG2_K = 155 / 219 / 0.9;
const CCT_A = 10.5402377416545, CCT_B = 0.0729055341958355;

export const LOG_CURVES: Record<LogCurve, LogCurveDef> = {
  // LogC3 EI 800: a 5.555556, b 0.052272, c 0.247190, d 0.385537, e 5.367655, f 0.092809, cut 0.010591
  logc3: { name: 'ARRI LogC3', gamut: 'awg3', kind: 0, ref: 'alwan_rgb_core.inc:367–394', p: { base: 10, logSlope: 0.24719, logOff: 0.385537, linSideSlope: 5.555556, linSideOff: 0.052272, cutLin: 0.010591, cutEnc: 5.367655 * 0.010591 + 0.092809, linSlope: 5.367655, linOff: 0.092809 } },
  // LogC4: (log2(a·x + 64) − 6)/14·b + c, below t linear (x − t)/s
  logc4: { name: 'ARRI LogC4', gamut: 'awg4', kind: 0, ref: 'alwan_rgb_core.inc:396–423', p: { base: 2, logSlope: 0.9071358748778103 / 14, logOff: 0.09286412512218964 - (6 * 0.9071358748778103) / 14, linSideSlope: 2231.8263090676883, linSideOff: 64, cutLin: -0.01805699611991131, cutEnc: 0, linSlope: 1 / 0.1135972086105891, linOff: 0.01805699611991131 / 0.1135972086105891 } },
  // S-Log3: (420 + log10((x + 0.01)/0.19)·261.5)/1023, below 0.01125 linear 95 … 171.2102946929
  slog3: { name: 'Sony S-Log3', gamut: 'sgamut3cine', kind: 0, ref: 'alwan_rgb_core.inc:237–253', p: { base: 10, logSlope: 261.5 / 1023, logOff: 420 / 1023, linSideSlope: 1 / 0.19, linSideOff: 0.01 / 0.19, cutLin: 0.01125, cutEnc: 171.2102946929 / 1023, linSlope: (171.2102946929 - 95) / 0.01125 / 1023, linOff: 95 / 1023 } },
  // V-Log: c·log10(x + b) + d, below 0.01 linear 5.6·x + 0.125
  vlog: { name: 'Panasonic V-Log', gamut: 'vgamut', kind: 0, ref: 'alwan_rgb_core.inc:336–362', p: { base: 10, logSlope: 0.241514, logOff: 0.598206, linSideSlope: 1, linSideOff: 0.00873, cutLin: 0.01, cutEnc: 0.181, linSlope: 5.6, linOff: 0.125 } },
  // Blackmagic Film Gen 5: A·ln(x + B) + C, below 0.005 linear D·x + E
  bmdfilm5: { name: 'Blackmagic Film Gen 5', gamut: 'bmdwg5', kind: 0, ref: 'alwan_rgb_core.inc:480–505', p: { base: Math.E, logSlope: 0.08692876065491224, logOff: 0.5300133392291939, linSideSlope: 1, linSideOff: 0.005494072432257808, cutLin: 0.005, cutEnc: 8.283605932402494 * 0.005 + 0.09246575342465753, linSlope: 8.283605932402494, linOff: 0.09246575342465753 } },
  // C-Log2: a·log10(k·x/0.9 + 1) + offset, negative input clamped
  clog2: { name: 'Canon Log 2', gamut: 'cinema', kind: 0, ref: 'alwan_rgb_core.inc:281–300', p: { base: 10, logSlope: 0.24136077, logOff: 0.092864125, linSideSlope: 87.09937546 / 0.9, linSideOff: 1, cutLin: NONE, cutEnc: NONE, linSlope: 1, linOff: 0, clampNeg: true } },
  clog3: { name: 'Canon Log 3', gamut: 'cinema', kind: 1, ref: 'alwan_rgb_core.inc:302–330' },
  // Log3G10: a·log10(b·(x + c) + 1), below x + c < 0 linear (x + c)·g
  log3g10: { name: 'RED Log3G10', gamut: 'rwg', kind: 0, ref: 'alwan_rgb_core.inc:455–477', p: { base: 10, logSlope: 0.224282, logOff: 0, linSideSlope: 155.975327, linSideOff: 155.975327 * 0.01 + 1, cutLin: -0.01, cutEnc: 0, linSlope: 15.1927, linOff: 0.01 * 15.1927 } },
  // F-Log2: C·log10(A·x + B) + D, below 0.000889 linear E·x + F (F-Gamut = BT.2020 primaries, f-gamut.csv)
  flog2: { name: 'Fujifilm F-Log2', gamut: '2020', kind: 0, ref: 'alwan_rgb_core.inc:765–797', p: { base: 10, logSlope: 0.245281, logOff: 0.384316, linSideSlope: 5.555556, linSideOff: 0.064829, cutLin: 0.000889, cutEnc: 0.100686685370811, linSlope: 8.799461, linOff: 0.092864 } },
  // D-Log: log10(x·0.9892 + 0.0108)·0.256663 + 0.584555, up to 0.0078 linear 6.025·x + 0.0929
  dlog: { name: 'DJI D-Log', gamut: 'dgamut', kind: 0, ref: 'alwan_rgb_core.inc:829–860', p: { base: 10, logSlope: 0.256663, logOff: 0.584555, linSideSlope: 0.9892, linSideOff: 0.0108, cutLin: 0.0078, cutEnc: 0.14, linSlope: 6.025, linOff: 0.0929 } },
  nlog: { name: 'Nikon N-Log', gamut: '2020', kind: 2, ref: 'alwan_rgb_core.inc:641–673' }, // N-Gamut = BT.2020 (n-gamut.csv)
  applelog: { name: 'Apple Log', gamut: '2020', kind: 3, ref: 'alwan_rgb_core.inc:696–730' },
  // S-Log2 (alwan_rgb_core.inc:200–236): S-Log of lin·155/219, x = that/0.9;
  // y = 0.432699·log10(x + 0.037584) + 0.646596 (x ≥ 0), else 5·x + 0.030001222851889303, then legal range.
  // Native gamut S-Gamut (s-gamut.csv) has the same primaries as S-Gamut3.
  slog2: { name: 'Sony S-Log2', gamut: 'sgamut3', kind: 0, ref: 'alwan_rgb_core.inc:200–236', p: { base: 10, logSlope: 0.432699 * 876 / 1023, logOff: L(0.646596), linSideSlope: SLOG2_K, linSideOff: 0.037584, cutLin: 0, cutEnc: L(0.030001222851889303), linSlope: 5 * SLOG2_K * 876 / 1023, linOff: L(0.030001222851889303) } },
  // ACEScct (alwan_rgb_core.inc:174–196, Academy S-2016-001): (log2(x) + 9.72)/17.52, up to 2^-7 linear A·x + B.
  // ACEScct is a full-range encoding: here the scope signal level equals the ACEScct value (0 % = 0.0,
  // 100 % = 1.0), so the parameters are expressed in the narrow-range code domain of the other curves.
  acescct: { name: 'ACEScct', gamut: 'ap1', kind: 0, ref: 'alwan_rgb_core.inc:174–196', p: { base: 2, logSlope: (876 / 1023) / 17.52, logOff: L(9.72 / 17.52), linSideSlope: 1, linSideOff: 0, cutLin: 0.0078125, cutEnc: L(0.155251141552511), linSlope: CCT_A * 876 / 1023, linOff: L(CCT_B) } },
  ...LOGC3_EI_CURVES,
};

export const isLogCurve = (t: string): t is LogCurve => Object.prototype.hasOwnProperty.call(LOG_CURVES, t);

/** Scene-linear → curve value (full-range code / 1023). */
export function logEncode(c: LogCurve, x: number): number {
  const d = LOG_CURVES[c];
  if (d.kind === 1) { // C-Log3, three segments (alwan 303–315)
    const s = x / 0.9;
    if (s < -0.014) return -0.36726845 * Math.log10(-s * 14.98325 + 1) + 0.12783901;
    if (s <= 0.014) return 1.9754798 * s + 0.12512219;
    return 0.36726845 * Math.log10(s * 14.98325 + 1) + 0.12240537;
  }
  if (d.kind === 2) { // N-Log: a·∛(x + b) below 0.328, c·ln(x) + d above (alwan 646–661)
    if (x < 0.328) return 0.635386119257087 * Math.cbrt(x + 0.0075);
    return 0.1466275659824047 * Math.log(x) + 0.6050830889540567;
  }
  if (d.kind === 3) { // Apple Log (alwan 701–715)
    const R0 = -0.05641088;
    if (x < R0) return 0;
    if (x < 0.01) return 47.28711236 * (x - R0) * (x - R0);
    return 0.08550479 * Math.log2(x + 0.00964052) + 0.69336945;
  }
  const p = d.p!;
  if (p.clampNeg) x = Math.max(0, x);
  if (x < p.cutLin) return p.linSlope * x + p.linOff;
  return p.logSlope * (Math.log(p.linSideSlope * x + p.linSideOff) / Math.log(p.base)) + p.logOff;
}

/** Curve value (full-range code / 1023) → scene-linear. */
export function logDecode(c: LogCurve, v: number): number {
  const d = LOG_CURVES[c];
  if (d.kind === 1) { // C-Log3 (alwan 317–330)
    let s: number;
    if (v < 0.097465473) s = -(Math.pow(10, (0.12783901 - v) / 0.36726845) - 1) / 14.98325;
    else if (v <= 0.15277891) s = (v - 0.12512219) / 1.9754798;
    else s = (Math.pow(10, (v - 0.12240537) / 0.36726845) - 1) / 14.98325;
    return s * 0.9;
  }
  if (d.kind === 2) { // N-Log (alwan 663–673)
    if (v < 0.4418377321603128) return Math.pow(v / 0.635386119257087, 3) - 0.0075;
    return Math.exp((v - 0.6050830889540567) / 0.1466275659824047);
  }
  if (d.kind === 3) { // Apple Log (alwan 717–730)
    if (v < 0) return -0.05641088;
    if (v < 0.20855531595464202) return Math.sqrt(v / 47.28711236) - 0.05641088;
    return Math.pow(2, (v - 0.69336945) / 0.08550479) - 0.00964052;
  }
  const p = d.p!;
  if (v < p.cutEnc) return (v - p.linOff) / p.linSlope;
  return (Math.pow(p.base, (v - p.logOff) / p.logSlope) - p.linSideOff) / p.linSideSlope;
}

/** Normalised narrow-range signal (0 = code 64, 1 = code 940) ↔ curve value (code / 1023). */
export const signalToCurve = (v: number) => (64 + 876 * v) / 1023;
export const curveToSignal = (c: number) => (c * 1023 - 64) / 876;

/** Scene-linear reflectance of a scope signal level. */
export const logSignalToScene = (c: LogCurve, v: number) => logDecode(c, signalToCurve(v));
/** Scope signal level of a scene-linear reflectance. */
export const logSceneToSignal = (c: LogCurve, x: number) => curveToSignal(logEncode(c, x));

/**
 * GLSL for the picture and CIE shaders. The generic curve is driven by uniforms
 * (uLogA = base, logSlope, logOff, linSideSlope; uLogB = linSideOff, cutEnc, linSlope, linOff),
 * the three special shapes are written out with the same constants as above.
 */
export const logGlsl = (sfx = '') => `
uniform int uLogKind${sfx}; uniform vec4 uLogA${sfx}, uLogB${sfx};
float logDecode${sfx}(float s) {
  float v = (64.0 + 876.0 * s) / 1023.0;
  if (uLogKind${sfx} == 1) {
    float x = v < 0.097465473 ? -(pow(10.0, (0.12783901 - v) / 0.36726845) - 1.0) / 14.98325
      : v <= 0.15277891 ? (v - 0.12512219) / 1.9754798
      : (pow(10.0, (v - 0.12240537) / 0.36726845) - 1.0) / 14.98325;
    return x * 0.9;
  }
  if (uLogKind${sfx} == 2) return v < 0.4418377321603128 ? pow(v / 0.635386119257087, 3.0) - 0.0075 : exp((v - 0.6050830889540567) / 0.1466275659824047);
  if (uLogKind${sfx} == 3) return v < 0.0 ? -0.05641088 : v < 0.20855531595464202 ? sqrt(v / 47.28711236) - 0.05641088 : exp2((v - 0.69336945) / 0.08550479) - 0.00964052;
  if (v < uLogB${sfx}.y) return (v - uLogB${sfx}.w) / uLogB${sfx}.z;
  return (pow(uLogA${sfx}.x, (v - uLogA${sfx}.z) / uLogA${sfx}.y) - uLogB${sfx}.x) / uLogA${sfx}.w;
}`;
export const LOG_GLSL = logGlsl();

/**
 * Scene-linear → scope signal for the CST output (same constants as logEncode).
 * Generic curve: uLogE (cutLin, clampNeg) in addition to uLogA/uLogB of logGlsl(sfx).
 */
export const logEncodeGlsl = (sfx = '') => `
uniform vec2 uLogE${sfx};
float logEncode${sfx}(float x) {
  float v;
  if (uLogKind${sfx} == 1) {
    float s = x / 0.9;
    v = s < -0.014 ? -0.36726845 * log(-s * 14.98325 + 1.0) / log(10.0) + 0.12783901
      : s <= 0.014 ? 1.9754798 * s + 0.12512219
      : 0.36726845 * log(s * 14.98325 + 1.0) / log(10.0) + 0.12240537;
  } else if (uLogKind${sfx} == 2) {
    float a = x + 0.0075;
    v = x < 0.328 ? 0.635386119257087 * sign(a) * pow(abs(a), 1.0 / 3.0) : 0.1466275659824047 * log(x) + 0.6050830889540567;
  } else if (uLogKind${sfx} == 3) {
    v = x < -0.05641088 ? 0.0 : x < 0.01 ? 47.28711236 * (x + 0.05641088) * (x + 0.05641088) : 0.08550479 * log2(x + 0.00964052) + 0.69336945;
  } else {
    if (uLogE${sfx}.y > 0.5) x = max(x, 0.0);
    v = x < uLogE${sfx}.x ? uLogB${sfx}.z * x + uLogB${sfx}.w
      : uLogA${sfx}.y * log(uLogA${sfx}.w * x + uLogB${sfx}.x) / log(uLogA${sfx}.x) + uLogA${sfx}.z;
  }
  return (v * 1023.0 - 64.0) / 876.0;
}`;

/** Uniform values for logGlsl / logEncodeGlsl. */
export function logUniforms(c: LogCurve): { kind: number; a: [number, number, number, number]; b: [number, number, number, number]; e: [number, number] } {
  const d = LOG_CURVES[c];
  const p = d.p ?? { base: 10, logSlope: 1, logOff: 0, linSideSlope: 1, linSideOff: 0, cutLin: 0, cutEnc: 0, linSlope: 1, linOff: 0 };
  return { kind: d.kind, a: [p.base, p.logSlope, p.logOff, p.linSideSlope], b: [p.linSideOff, p.cutEnc, p.linSlope, p.linOff], e: [p.cutLin, p.clampNeg ? 1 : 0] };
}
/** Neutral values when no log curve is active. */
export const NO_LOG = { kind: 0, a: [10, 1, 0, 1] as [number, number, number, number], b: [0, 0, 1, 0] as [number, number, number, number], e: [0, 0] as [number, number] };
