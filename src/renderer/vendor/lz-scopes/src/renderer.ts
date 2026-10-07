// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// WebGL2 renderer: one canvas behind the whole panel grid. Scopes are computed on the
// GPU by scattering every sampled pixel as a point into a float accumulation buffer
// (additive blending), then tone-mapped into the panel's plot rectangle.

import { glDeepBuffer } from './deep';
import { GAMUTS, HDR_PREVIEW_GLSL, LUMA, hexToRgb, rgbToXyzMatrix, type FalseColorBand, type HdrPreview } from './color';
import { CHAIN_GLSL, baseOf, chainOf, linearGlsl, setChainUniforms, setLinearUniforms, type LutTex } from './chain';
import type { Lut } from './lut';
import type { Source } from './sources';
import { RGC, RGC_GLSL, rgcScale } from './rgc';
import { CUBE_GLSL, CUBE_SCALE } from './cube';
import { R103, R103_GLSL, YUV_FETCH_GLSL, yuvScale } from './ycbcr';
import { BLUR_FS, CRT_DISPLAY_FS, CRT_FS, CRT_VS_MAIN, PERSIST_FS, PHOSPHORS, beamSigma, persistDecay, type CrtSettings } from './crt';

/** Beam segments per CRT scope and frame (each is a quad, far more fill than a point). */
const CRT_BUDGET = 150_000;

export type ScatterMode = 'luma' | 'rgb' | 'parade' | 'yrgb' | 'ycbcr' | 'vector' | 'cie' | 'skin' | 'diamond' | 'cube' | 'satlum' | 'chplot';
const MODE_ID: Record<ScatterMode, number> = { luma: 0, rgb: 1, parade: 2, yrgb: 3, ycbcr: 4, vector: 5, cie: 6, skin: 7, diamond: 8, cube: 9, satlum: 10, chplot: 11 };
const INSTANCES: Record<ScatterMode, number> = { luma: 1, rgb: 3, parade: 3, yrgb: 4, ycbcr: 3, vector: 1, cie: 1, skin: 1, diamond: 2, cube: 1, satlum: 1, chplot: 1 };

export type PictureMode = 'normal' | 'false' | 'zebra' | 'clip' | 'luma' | 'skin' | 'gamut' | 'r103' | 'neutral';
const PICTURE_ID: Record<PictureMode, number> = { normal: 0, false: 1, zebra: 2, clip: 3, luma: 4, skin: 5, gamut: 6, r103: 7, neutral: 8 };

/** Region of interest in source pixels [x0, y0, x1, y1) and skin-tone detection window. */
export type Roi = [number, number, number, number] | null;
/** One or more regions of interest (manual rectangle or tracked faces). */
export type Rois = [number, number, number, number][];
const MAX_ROIS = 8;
const ROI_GLSL = `
uniform ivec4 uRois[8]; uniform int uRoiCount;
bool inRoi(ivec2 p) {
  for (int i = 0; i < 8; i++) {
    if (i >= uRoiCount) break;
    ivec4 r = uRois[i];
    if (p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w) return true;
  }
  return false;
}`;
export interface SkinRange { lo: number; hi: number; tol: number }

const SKIN_GLSL = `
bool isSkin(float cb, float cr, float tol) {
  float ang = degrees(atan(cr, cb));
  return length(vec2(cb, cr)) > 0.012 && abs(ang - 123.0) <= tol;
}`;

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * Vertical waveform range: signal level at the bottom and top edge of the plot. Wide enough
 * for the R 103 limits −5/105 % to show as lines and for BT.2111 −7 %/109 % (ebu-video.md, Abw. 13).
 */
export const WAVE_MIN = -0.07;
export const WAVE_MAX = 1.1;
/** CIE 1931 xy plot window (square). */
export const CIE_VIEW = { x0: -0.05, x1: 0.85, y0: -0.03, y1: 0.87 };
/** CIE 1976 u′v′ plot window (square). */
export const CIE_VIEW_UV = { x0: -0.05, x1: 0.65, y0: -0.05, y1: 0.65 };

/**
 * Signal → linear light with 1.0 = reference white, shared by the CIE scatter and the
 * picture view. SDR: BT.1886 γ 2.4. PQ: cd/m² / 203. HLG: BT.2100 OOTF on luminance
 * (Y_S from the source primaries, γ from Lw), normalised to the 75 % HLG level.
 * Log: scene-linear from the camera curve (0.18 = grey card).
 */
const LINEAR_GLSL = linearGlsl();

/** How the raw frame is stored: 8-bit or 16-bit R′G′B′, or unclipped 16-bit Y′CbCr (ycbcr.ts). */
type TexKind = '8' | '16' | 'yuv';
/**
 * Raw source texel plus the processing chain (CST/LUT, see chain.ts) → fetchRGB. The Y′CbCr
 * decode sits in fetchRaw, i.e. before the chain.
 */
const FETCH = (k: TexKind) => (k === 'yuv' ? YUV_FETCH_GLSL : k === '16'
  ? `uniform highp usampler2D uSrc;
     vec3 fetchRaw(ivec2 p) { return vec3(texelFetch(uSrc, p, 0).rgb) / 65535.0; }`
  : `uniform highp sampler2D uSrc;
     vec3 fetchRaw(ivec2 p) { return texelFetch(uSrc, p, 0).rgb; }`) + CHAIN_GLSL;

/** Shared by the point scatter and the CRT beam (crt.ts): uniforms and plotSample(). */
const SAMPLE_GLSL = (k: TexKind) => `
${FETCH(k)}
uniform ivec2 uSize;
uniform int uStep, uCols, uMode, uColorize, uCieUv, uSecN, uPair;
uniform ivec4 uSec; // section per trace instance (-1 = hidden channel)
uniform vec2 uK;
uniform float uZoom, uIntensity, uWMin, uWMax, uPointSize;
uniform mat3 uToXYZ;
uniform vec4 uCie;
${ROI_GLSL}
uniform vec3 uSkin, uTint;
out vec3 vColor;
out float vW;
${SKIN_GLSL}
${LINEAR_GLSL}
${CUBE_GLSL}

float waveY(float v) { return (v - uWMin) / (uWMax - uWMin) * 2.0 - 1.0; }

/** Position (clip space) and colour of one trace sample; false = not drawn (hidden channel, no colour). */
bool plotSample(ivec2 p, int ch, out vec2 pos, out vec3 col) {
  vec3 rgb = fetchRGB(p);
  float kr = uK.x, kb = uK.y, kg = 1.0 - kr - kb;
  float Y = dot(rgb, vec3(kr, kg, kb));
  float cb = (rgb.b - Y) / (2.0 * (1.0 - kb));
  float cr = (rgb.r - Y) / (2.0 * (1.0 - kr));
  float x = (float(p.x) + 0.5) / float(uSize.x);
  vec3 unit[3] = vec3[3](vec3(1.0, 0.18, 0.18), vec3(0.2, 1.0, 0.25), vec3(0.3, 0.45, 1.0));
  vec3 mono = uTint;
  // the pixel's own colour, brightness normalised so dark pixels stay visible
  vec3 srcCol = clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0);
  col = mono;

  if (uMode == 7) {
    pos = vec2(x * 2.0 - 1.0, waveY(Y));
    bool inRange = Y >= uSkin.x && Y <= uSkin.y;
    // skin tones in their own colour, everything else black & white
    bool skin = isSkin(cb, cr, uSkin.z) && inRange;
    col = skin ? srcCol : vec3(0.6); // skin in its source colour (hue and saturation unchanged)
  } else if (uMode == 0) {
    pos = vec2(x * 2.0 - 1.0, waveY(Y));
    if (uColorize == 1) col = clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0);
  } else if (uMode == 1 || uMode == 2) {
    if (uSec[ch] < 0) return false;
    float v = ch == 0 ? rgb.r : ch == 1 ? rgb.g : rgb.b;
    float px = uMode == 2 ? (float(uSec[ch]) + x) / float(uSecN) : x;
    pos = vec2(px * 2.0 - 1.0, waveY(v));
    // source colours: in each channel's section only the pixels dominated by that channel are coloured
    float cv = ch == 0 ? rgb.r : ch == 1 ? rgb.g : rgb.b;
    bool dom = cv >= max(rgb.r, max(rgb.g, rgb.b)) - 0.02 && cv - min(rgb.r, min(rgb.g, rgb.b)) > 0.04;
    col = uColorize == 2 ? (dom ? srcCol : vec3(0.3)) : uColorize == 1 || uMode == 1 ? unit[ch] : mono;
  } else if (uMode == 3) {
    if (uSec[ch] < 0) return false;
    float v = ch == 0 ? Y : ch == 1 ? rgb.r : ch == 2 ? rgb.g : rgb.b;
    pos = vec2((float(uSec[ch]) + x) / float(uSecN) * 2.0 - 1.0, waveY(v));
    float cv3 = ch == 1 ? rgb.r : ch == 2 ? rgb.g : rgb.b;
    bool dom3 = ch > 0 && cv3 >= max(rgb.r, max(rgb.g, rgb.b)) - 0.02 && cv3 - min(rgb.r, min(rgb.g, rgb.b)) > 0.04;
    col = uColorize == 2 ? (ch == 0 ? srcCol : dom3 ? srcCol : vec3(0.3)) : ch == 0 || uColorize == 0 ? mono : unit[ch - 1];
  } else if (uMode == 4) {
    float v = ch == 0 ? Y : ch == 1 ? cb + 0.5 : cr + 0.5;
    pos = vec2((float(ch) + x) / 3.0 * 2.0 - 1.0, waveY(v));
    col = ch == 0 || uColorize == 0 ? mono : ch == 1 ? vec3(0.35, 0.55, 1.0) : vec3(1.0, 0.3, 0.35);
  } else if (uMode == 8) {
    // Tektronix diamond (graticule.ts DIAMOND_SCALE): upper B′+G′ over B′−G′, lower −(R′+G′) over R′−G′
    float a = ch == 0 ? rgb.b : rgb.r, s = a + rgb.g;
    pos = vec2(a - rgb.g, ch == 0 ? s : -s) * vec2(0.92, 0.46);
    if (uColorize == 1) col = srcCol;
  } else if (uMode == 10) {
    // saturation over luma (graticule.ts drawSatLumGraticule): x = Y′, y = |CbCr| / 0.5 (0…120 %)
    pos = vec2(waveY(Y), length(vec2(cb, cr)) / 0.5 / 1.2 * 2.0 - 1.0);
    if (uColorize == 1) col = srcCol;
  } else if (uMode == 11) {
    // channel plot: two channels against each other (Cb/Cr shifted by +0.5)
    vec2 v = uPair == 0 ? rgb.rg : uPair == 1 ? rgb.rb : uPair == 2 ? rgb.gb : uPair == 3 ? vec2(Y, cb + 0.5) : uPair == 4 ? vec2(Y, cr + 0.5) : vec2(cb + 0.5, cr + 0.5);
    pos = vec2(waveY(v.x), waveY(v.y));
    if (uColorize == 1) col = srcCol;
  } else if (uMode == 9) {
    // 3D colour volume (cube.ts): rotated, orthographic
    pos = (uRot * cubeQ(rgb)).xy * ${CUBE_SCALE.toFixed(4)} * uView.x + uView.yz;
    if (uColorize == 1) col = srcCol;
  } else if (uMode == 5) {
    pos = vec2(cb, cr) * 2.0 * 0.9 * uZoom;
    if (uColorize == 1) col = clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0);
  } else {
    vec3 XYZ = uToXYZ * toLinear(rgb);
    float s = uCieUv == 1 ? XYZ.x + 15.0 * XYZ.y + 3.0 * XYZ.z : XYZ.x + XYZ.y + XYZ.z;
    if (s < 1e-6) return false;
    // CIE 1931 xy or CIE 1976 u'v' = (4X, 9Y)/(X + 15Y + 3Z)
    vec2 xy = uCieUv == 1 ? vec2(4.0 * XYZ.x, 9.0 * XYZ.y) / s : XYZ.xy / s;
    pos = vec2((xy.x - uCie.x) / (uCie.y - uCie.x), (xy.y - uCie.z) / (uCie.w - uCie.z)) * 2.0 - 1.0;
    col = uColorize == 1 ? clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0) : mono;
  }
  if (uRoiCount > 0) {
    bool inside = inRoi(p);
    bool colored = uColorize >= 1 || uMode == 1 || uMode == 7;
    col = inside ? (colored ? col : vec3(1.0, 0.72, 0.25)) : col * 0.25;
  }
  return true;
}`;


const SCATTER_VS = (k: TexKind) => `#version 300 es
precision highp float; precision highp int;
${SAMPLE_GLSL(k)}
void main() {
  gl_PointSize = uPointSize;
  ivec2 p = ivec2(gl_VertexID % uCols, gl_VertexID / uCols) * uStep;
  vec2 pos; vec3 col;
  if (p.y >= uSize.y || p.x >= uSize.x || !plotSample(p, gl_InstanceID, pos, col)) { gl_Position = vec4(9.0); return; }
  vColor = col * uIntensity;
  vW = uIntensity;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const CRT_VS = (k: TexKind) => `#version 300 es
precision highp float; precision highp int;
${SAMPLE_GLSL(k)}
${CRT_VS_MAIN}`;

const SCATTER_FS = `#version 300 es
precision highp float;
in vec3 vColor; in float vW; out vec4 o;
void main() { o = vec4(vColor, vW); }`;

const QUAD_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uAcc; uniform float uGain; uniform vec3 uTint; uniform int uAvg;
in vec2 vUv; out vec4 o;
void main() {
  vec4 a = texture(uAcc, vUv);
  vec3 c;
  if (uAvg == 1) {
    // average colour of the points × density: dimmed/highlighted points keep their
    // weight, colours do not wash out to white in dense traces
    c = a.a > 0.0 ? clamp(a.rgb / a.a, 0.0, 1.0) * (1.0 - exp(-a.a * uGain)) : vec3(0.0);
  } else {
    // additive channels (RGB overlay): hue-preserving, R+G+B on top of each other → white
    float m = max(a.r, max(a.g, a.b));
    c = m > 0.0 ? a.rgb / m * (1.0 - exp(-m * uGain)) : vec3(0.0);
  }
  o = vec4(c * uTint, 1.0);
}`;

/**
 * `r103`: variant with the R 103 overlay. Its 7×3 filter makes the shader much larger, which
 * software GL (SwiftShader) needs seconds to compile – so it is only built when that overlay is used.
 */
const PICTURE_FS = (k: TexKind, r103: boolean) => `#version 300 es
precision highp float; precision highp int;
${FETCH(k)}
${r103 ? R103_GLSL : ''}
${RGC_GLSL}
uniform ivec2 uSize; uniform int uMode; uniform vec2 uK;
uniform vec4 uBand[12]; uniform int uBands;
uniform float uZebra, uZebraLow;
uniform vec4 uNeutral;
uniform int uDisp;
uniform mat3 uGamut, uWarn, uTo2020, uFrom2020;
uniform vec3 uSkin;
${ROI_GLSL}
in vec2 vUv; out vec4 o;
${SKIN_GLSL}
${LINEAR_GLSL}
float srgbOetf(float l) { return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
${HDR_PREVIEW_GLSL}
/**
 * Signal → what the chosen display should show (uDisp 0 sRGB/P3 curve, 1 BT.1886, 2 raw).
 * HDR and log go through the HDR → SDR down-mapping (color.ts hdrToSdr) in BT.2020.
 */
vec3 toDisplay(vec3 rgb) {
  if (uDisp == 2) return rgb;
  vec3 lin = rgcLin(toLinear(rgb));
  vec3 l = uHdrMode > 0 && uTransfer >= 1 && uTransfer <= 3
    ? uFrom2020 * hdrToSdr(uTo2020 * lin)
    : uGamut * lin;
  l = clamp(l, 0.0, 1.0);
  return uDisp == 1 ? pow(l, vec3(1.0 / 2.4)) : vec3(srgbOetf(l.r), srgbOetf(l.g), srgbOetf(l.b));
}
void main() {
  ivec2 p = clamp(ivec2(vec2(vUv.x, 1.0 - vUv.y) * vec2(uSize)), ivec2(0), uSize - 1);
  vec3 rgb = fetchRGB(p);
  float kr = uK.x, kb = uK.y;
  float Y = dot(rgb, vec3(kr, 1.0 - kr - kb, kb));
  vec3 c = toDisplay(rgb);
  if (uMode == 5) {
    float cb = (rgb.b - Y) / (2.0 * (1.0 - kb)), cr = (rgb.r - Y) / (2.0 * (1.0 - kr));
    bool inRange = Y >= uSkin.x && Y <= uSkin.y;
    if (!(isSkin(cb, cr, uSkin.z) && inRange)) c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)));
  } else if (uMode == 1) {
    c = vec3(Y * 0.8);
    for (int i = 0; i < 12; i++) {
      if (i >= uBands) break;
      vec4 b = uBand[i];
      float from = b.x, to = b.y;
      if (Y >= from && Y < to) {
        float packed = b.z; // 0xRRGGBB packed into a float (exact up to 2^24)
        float r = floor(packed / 65536.0), g = floor(mod(packed, 65536.0) / 256.0), bl = mod(packed, 256.0);
        c = vec3(r, g, bl) / 255.0;
      }
    }
  } else if (uMode == 2) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0));
    if (Y >= uZebra) c = mix(c, vec3(stripe), 0.85);
    else if (uZebraLow > 0.0 && Y >= uZebraLow && Y < uZebraLow + 0.05) c = mix(c, vec3(stripe), 0.5);
  } else if (uMode == 3) {
    float hi = 254.5 / 255.0, lo = 0.5 / 255.0;
    bool h = max(rgb.r, max(rgb.g, rgb.b)) >= hi, l = min(rgb.r, min(rgb.g, rgb.b)) <= lo;
    c = vec3(Y * 0.6);
    if (h) c = vec3(1.0, 0.1, 0.1);
    if (l) c = vec3(0.15, 0.3, 1.0);
  } else if (uMode == 4) {
    c = vec3(Y);
  } else if (uMode == 8) {
    // neutral check (minmax.ts): near-neutral pixels in Y′ range shown in their cast, amplified
    float kr2 = uK.x, kb2 = uK.y;
    float cb = (rgb.b - Y) / (2.0 * (1.0 - kb2)), cr = (rgb.r - Y) / (2.0 * (1.0 - kr2));
    float s = length(vec2(cb, cr)) / 0.5;
    c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.3);
    if (Y >= uNeutral.y && Y <= uNeutral.z && s < uNeutral.x) {
      if (s < 0.004) c = vec3(0.55);
      else {
        vec2 d = normalize(vec2(cb, cr)) * 0.22;
        float yy = 0.6, R = yy + 2.0 * (1.0 - kr2) * d.y, B = yy + 2.0 * (1.0 - kb2) * d.x;
        c = clamp(vec3(R, (yy - kr2 * R - kb2 * B) / (1.0 - kr2 - kb2), B), 0.0, 1.0);
      }
    }
  } else if (uMode == 6) {
    // gamut warning: distance d = (max - c)/max in the target gamut; d > 1 = a channel is negative
    vec3 t = uWarn * rgcLin(toLinear(rgb));
    float ach = max(t.r, max(t.g, t.b));
    float d = ach > 0.0 ? max((ach - t.r) / ach, max((ach - t.g) / ach, (ach - t.b) / ach)) : 0.0;
    c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.7);
    if (d > 1.2) c = vec3(1.0, 0.1, 0.75);
    else if (d > 1.05) c = vec3(1.0, 0.45, 0.05);
    else if (d > 1.0) c = vec3(1.0, 0.9, 0.1);
  }${r103 ? `
  if (uMode == 7) {
    // EBU R 103: filtered R, G, B, Y outside the preferred (amber) or total range (red)
    int lvl = r103Level(p, uSize, uK);
    c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.6);
    if (lvl == 2) c = vec3(1.0, 0.1, 0.2);
    else if (lvl == 1) c = vec3(1.0, 0.7, 0.1);
  }` : ''}
  if (uRoiCount > 0 && !inRoi(p)) c *= 0.55;
  o = vec4(c, 1.0);
}`;

interface SrcTex { tex: WebGLTexture; w: number; h: number; u16: boolean; seq: number }
interface Accum { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }

export interface ScatterParams {
  /** colorize: false/0 mono, true/1 channel colours (or source colours for luma/vector), 2 source colours in parades */
  mode: ScatterMode; gain: number; colorize: boolean | 0 | 1 | 2; zoom: number; tint: [number, number, number]; maxSamples: number;
  roi: Rois; skin: SkinRange;
  /** CIE scope in CIE 1976 u′v′ instead of 1931 xy */
  cieUv?: boolean;
  /** waveforms: vertical range (zoom) and trace sections (graticule.channelLayout) */
  range?: [number, number];
  sec?: number[]; secN?: number;
  /** 3D volume (cube.ts): space id, row-major rotation, source → BT.2020, source white XYZ, cd/m² of 1.0 */
  cube?: { space: number; rot: number[]; to2020: number[]; white: number[]; nits: number; view?: { zoom: number; panX: number; panY: number } };
  /** channel plot: 0 R/G, 1 R/B, 2 G/B, 3 Y/Cb, 4 Y/Cr, 5 Cb/Cr */
  pair?: number;
  /** digital display: persistence τ in ms (trace history; −1 = infinite), as in the CRT mode */
  persist?: number;
  /** analogue beam look (crt.ts) */
  crt?: CrtSettings;
}
/** How the picture view maps the signal to the screen. */
export interface DisplayParams {
  curve: 0 | 1 | 2; gamut: number[] /* row-major 3×3 input→display, linear */;
  /** HDR/log sources: down-mapping (color.ts hdrToSdr), source peak in cd/m², matrices source → BT.2020 → display */
  hdr?: { mode: HdrPreview; peak: number; to2020: number[]; from2020: number[] };
}
export interface PictureParams {
  mode: PictureMode; bands: FalseColorBand[]; zebra: number; zebraLow: number; roi: Rois; skin: SkinRange; display: DisplayParams;
  /** neutral overlay: chroma threshold (|CbCr|/0.5) and Y′ range */
  neutral?: { threshold: number; lo: number; hi: number };
  /** gamut warning: row-major 3×3 source linear → target gamut linear */
  warn?: number[];
  /** ACES 1.3 RGC preview (rgc.ts): row-major source linear → AP1 and back */
  rgc?: { toAp1: number[]; fromAp1: number[] };
}

const colMajor = (m: number[]) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private progs = new Map<string, WebGLProgram>();
  private uloc = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private vao: WebGLVertexArrayObject;
  private textures = new Map<string, SrcTex>();
  private accums = new Map<string, Accum>();
  private sigs = new Map<string, string>();
  private lutTex = new Map<string, LutTex & { version: number }>();
  dpr = 1;

  /** Drawing buffer format actually in use ('RGBA16F' only with the deep option, src/deep.ts). */
  bufferFormat: 'RGBA16F' | 'RGBA8' = 'RGBA8';

  /**
   * `deep`: ask for a RGBA16F drawing buffer (output windows). drawingBufferStorage needs
   * alpha: true (WebGL spec), so endFrame() then sets alpha back to 1 everywhere.
   */
  constructor(readonly canvas: HTMLCanvasElement, private readonly opts: { deep?: boolean } = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: !!opts.deep, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 wird von diesem Browser nicht unterstützt.');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float fehlt – Scopes brauchen Float-Rendertargets.');
    gl.getExtension('EXT_float_blend');
    this.gl = gl;
    this.vao = gl.createVertexArray()!;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  private program(key: string, vs: string, fs: string) {
    let p = this.progs.get(key);
    if (p) return p;
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`${key}: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${key}: ${gl.getProgramInfoLog(p)}`);
    this.progs.set(key, p); this.uloc.set(p, new Map());
    return p;
  }

  private u(p: WebGLProgram, name: string) {
    const m = this.uloc.get(p)!;
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  /** Colour space the browser assumes for the canvas output (Display P3 on wide-gamut screens). */
  setOutputSpace(space: 'srgb' | 'display-p3') {
    const gl = this.gl as WebGL2RenderingContext & { drawingBufferColorSpace?: string };
    if ('drawingBufferColorSpace' in gl && gl.drawingBufferColorSpace !== space) gl.drawingBufferColorSpace = space;
  }

  /** Returns true when the canvas size changed (its content is then gone). */
  resize(w: number, h: number, dpr: number) {
    this.dpr = dpr;
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
    if (this.canvas.width === W && this.canvas.height === H) return false;
    this.canvas.width = W; this.canvas.height = H;
    if (this.opts.deep) this.bufferFormat = glDeepBuffer(this.gl, W, H);
    return true;
  }

  /** Deep buffer only: make every pixel opaque (the canvas has alpha for drawingBufferStorage). */
  endFrame() {
    if (!this.opts.deep) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(false, false, false, true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.colorMask(true, true, true, true);
  }

  /** Clear the whole canvas (after layout/size changes); otherwise untouched panels keep their pixels. */
  beginFrame(clear = true) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (!clear) return;
    gl.clearColor(0.043, 0.047, 0.055, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Upload the source's newest frame if it changed. Returns the texture or null. */
  private sourceTexture(src: Source): SrcTex | null {
    if (!src.ready) return null;
    const gl = this.gl;
    const u16 = src.data !== null && src.depth === 16;
    let t = this.textures.get(src.id);
    const w = src.width, h = src.height;
    if (t && t.seq === src.frameSeq && t.w === w && t.h === h && t.u16 === u16) return t;
    if (!t || t.u16 !== u16) {
      if (t) gl.deleteTexture(t.tex);
      const tex = gl.createTexture()!;
      t = { tex, w: 0, h: 0, u16, seq: -1 };
      this.textures.set(src.id, t);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    const same = t.w === w && t.h === h;
    try {
      if (src.data && u16) {
        if (same) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, src.data);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16UI, w, h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT, src.data);
      } else if (src.data) {
        if (same) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
      } else if (src.element) {
        if (same) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.element);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src.element);
      }
    } catch {
      return null; // e.g. video not ready yet
    }
    t.w = w; t.h = h; t.seq = src.frameSeq;
    return t;
  }

  private accum(key: string, w: number, h: number): Accum {
    const gl = this.gl;
    let a = this.accums.get(key);
    if (a && a.w === w && a.h === h) return a;
    if (a) { gl.deleteTexture(a.tex); gl.deleteFramebuffer(a.fbo); }
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    a = { tex, fbo, w, h };
    this.accums.set(key, a);
    return a;
  }

  dropPanel(key: string) {
    for (const k of [key, `${key}#p0`, `${key}#p1`, `${key}#g0`, `${key}#g1`, `${key}#da`, `${key}#db`]) {
      const a = this.accums.get(k);
      if (a) { this.gl.deleteTexture(a.tex); this.gl.deleteFramebuffer(a.fbo); this.accums.delete(k); }
    }
    this.settling.delete(key); this.crtTimes.delete(key);
  }
  dropSource(id: string) {
    const t = this.textures.get(id);
    if (t) { this.gl.deleteTexture(t.tex); this.textures.delete(id); }
  }

  /** CSS-pixel rect (relative to canvas) → GL viewport in device pixels (origin bottom-left). */
  private viewport(r: Rect) {
    const d = this.dpr;
    const x = Math.round(r.x * d), w = Math.max(1, Math.round(r.w * d)), h = Math.max(1, Math.round(r.h * d));
    const y = this.canvas.height - Math.round(r.y * d) - h;
    return { x, y, w, h };
  }

  private texKind(src: Source, t: SrcTex): TexKind {
    return !t.u16 ? '8' : baseOf(src).yuv ? 'yuv' : '16';
  }

  /** Uniforms of LINEAR_GLSL (what the scopes see) and CHAIN_GLSL (CST/LUT) for a source or stage view. */
  private linearUniforms(prog: WebGLProgram, src: Source) {
    const u = (n: string) => this.u(prog, n);
    const base = baseOf(src);
    if (base.yuv) {
      // decode with the matrix of the source itself, not of a stage view
      const s = yuvScale(base.yuv), { kr, kb } = LUMA[base.colorspace];
      this.gl.uniform4f(u('uYuvN'), s.yOff, s.yScale, s.cOff, s.cScale);
      this.gl.uniform2f(u('uYuvK'), kr, kb);
    }
    setLinearUniforms(this.gl, u, '', { transfer: src.transfer, gamut: src.gamut, lw: src.hlgLw });
    setChainUniforms(this.gl, u, chainOf(src), (l) => this.lutTextures(l));
  }

  /** 3D LUT as RGB32F 3D texture (red = width), 1D part as N×1 texture; read with texelFetch. */
  private lutTextures(l: Lut & { version: number }): LutTex {
    const gl = this.gl;
    const have = this.lutTex.get(l.name);
    if (have && have.version === l.version) return have;
    if (have) { if (have.t3) gl.deleteTexture(have.t3); if (have.t1) gl.deleteTexture(have.t1); }
    const t: LutTex & { version: number } = { version: l.version };
    const params = (target: number) => {
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    gl.activeTexture(gl.TEXTURE5);
    if (l.cube) {
      t.t3 = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_3D, t.t3); params(gl.TEXTURE_3D);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB32F, l.cube.size, l.cube.size, l.cube.size, 0, gl.RGB, gl.FLOAT, l.cube.data);
    }
    if (l.pre) {
      t.t1 = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t.t1); params(gl.TEXTURE_2D);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, l.pre.size, 1, 0, gl.RGB, gl.FLOAT, l.pre.data);
    }
    gl.activeTexture(gl.TEXTURE0);
    this.lutTex.set(l.name, t);
    return t;
  }

  /**
   * @param overlay add the traces on top of what is already there (scope over picture)
   * @param opacity trace strength when overlaid (0…1)
   */
  drawScatter(key: string, src: Source, rect: Rect, p: ScatterParams, overlay = false, opacity = 1) {
    const t = this.sourceTexture(baseOf(src));
    if (!t) return;
    const gl = this.gl;
    const vp = this.viewport(rect);
    const acc = this.accum(key, vp.w, vp.h);
    const kind = this.texKind(src, t);
    const crt = p.crt?.on ? p.crt : null;
    const wave = p.mode !== 'vector' && p.mode !== 'cie' && p.mode !== 'diamond' && p.mode !== 'cube' && p.mode !== 'satlum' && p.mode !== 'chplot';
    // Normalise so that the display brightness does not depend on source or panel size.
    const sections = p.mode === 'parade' || p.mode === 'yrgb' ? p.secN ?? (p.mode === 'yrgb' ? 4 : 3) : p.mode === 'ycbcr' ? 3 : 1;
    let stepX: number, stepY: number;
    if (crt) {
      // beam segments are expensive: waveforms first reduced horizontally to the scope width,
      // then as many lines as the (smaller) budget allows
      const budget = Math.min(p.maxSamples, CRT_BUDGET);
      if (wave) {
        stepX = Math.max(1, Math.ceil(t.w / Math.max(16, vp.w / sections)));
        stepY = Math.max(1, Math.ceil(t.h / Math.max(1, Math.floor(budget / Math.ceil(t.w / stepX)))));
      } else stepX = stepY = Math.max(1, Math.ceil(Math.sqrt((t.w * t.h) / budget)));
    } else stepX = stepY = Math.max(1, Math.ceil(Math.sqrt((t.w * t.h) / p.maxSamples)));
    const cols = Math.ceil(t.w / stepX), rows = Math.ceil(t.h / stepY);
    const n = crt ? Math.max(1, cols - 1) * rows : cols * rows;
    const area = (vp.w / sections) * vp.h;
    // the 3D volume spreads the points thinly: bigger dots and more weight so colours stay visible
    const dot = !crt && !wave ? Math.max(1, Math.round(this.dpr)) * (p.mode === 'cube' ? 3 : 1) : 1;
    const intensity = ((wave ? 0.9 : 0.6) * area) / n / (dot * dot) * (p.mode === 'cube' ? 6 : 1);

    // Only re-scatter when the frame or a parameter changed; otherwise reuse the accumulation.
    const sig = `${src.id}:${src.frameSeq}:${t.w}x${t.h}:${acc.w}x${acc.h}:${src.colorspace}:${src.transfer}:${src.gamut}:${src.hlgLw}:${chainOf(src)?.sig ?? ''}:${JSON.stringify(baseOf(src).yuv)}:${baseOf(src).colorspace}:${this.dpr}:${JSON.stringify(p)}`;
    const fresh = this.sigs.get(key) !== sig;
    this.sigs.set(key, sig);
    if (fresh) {
      const prog = crt ? this.program(`crt${kind}`, CRT_VS(kind), CRT_FS) : this.program(`scatter${kind}`, SCATTER_VS(kind), SCATTER_FS);
      gl.bindFramebuffer(gl.FRAMEBUFFER, acc.fbo);
      gl.viewport(0, 0, acc.w, acc.h);
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      const { kr, kb } = LUMA[src.colorspace];
      gl.uniform1i(this.u(prog, 'uSrc'), 0);
      gl.uniform2i(this.u(prog, 'uSize'), t.w, t.h);
      gl.uniform1i(this.u(prog, 'uStep'), stepX);
      gl.uniform1i(this.u(prog, 'uCols'), cols);
      gl.uniform1i(this.u(prog, 'uMode'), MODE_ID[p.mode]);
      this.linearUniforms(prog, src);
      gl.uniform1i(this.u(prog, 'uCieUv'), p.cieUv ? 1 : 0);
      gl.uniform1i(this.u(prog, 'uColorize'), Number(p.colorize));
      gl.uniform2f(this.u(prog, 'uK'), kr, kb);
      gl.uniform1f(this.u(prog, 'uZoom'), p.zoom);
      gl.uniform1f(this.u(prog, 'uIntensity'), intensity);
      gl.uniform1f(this.u(prog, 'uPointSize'), dot);
      gl.uniform1f(this.u(prog, 'uWMin'), p.range?.[0] ?? WAVE_MIN);
      gl.uniform1f(this.u(prog, 'uWMax'), p.range?.[1] ?? WAVE_MAX);
      const sec = p.sec ?? [0, 1, 2, 3];
      gl.uniform4i(this.u(prog, 'uSec'), sec[0], sec[1], sec[2], sec[3] ?? 3);
      gl.uniform1i(this.u(prog, 'uPair'), p.pair ?? 0);
      gl.uniform1i(this.u(prog, 'uSecN'), p.secN ?? (p.mode === 'yrgb' ? 4 : 3));
      // GLSL mat3 is column-major
      gl.uniformMatrix3fv(this.u(prog, 'uToXYZ'), false, colMajor(rgbToXyzMatrix(GAMUTS[src.gamut])));
      const cv = p.cieUv ? CIE_VIEW_UV : CIE_VIEW;
      gl.uniform4f(this.u(prog, 'uCie'), cv.x0, cv.x1, cv.y0, cv.y1);
      this.setRois(prog, p.roi);
      gl.uniform3f(this.u(prog, 'uSkin'), p.skin.lo, p.skin.hi, p.skin.tol);
      gl.uniform3fv(this.u(prog, 'uTint'), p.tint);
      if (p.cube) {
        gl.uniform1i(this.u(prog, 'uCube'), p.cube.space);
        gl.uniformMatrix3fv(this.u(prog, 'uRot'), false, colMajor(p.cube.rot));
        gl.uniformMatrix3fv(this.u(prog, 'uTo2020'), false, colMajor(p.cube.to2020));
        gl.uniform3fv(this.u(prog, 'uWhiteXYZ'), p.cube.white);
        gl.uniform1f(this.u(prog, 'uCubeNits'), p.cube.nits);
        gl.uniform3f(this.u(prog, 'uView'), p.cube.view?.zoom ?? 1, p.cube.view?.panX ?? 0, p.cube.view?.panY ?? 0);
      }
      gl.bindVertexArray(this.vao);
      if (crt) {
        const sigma = beamSigma(crt.beam, this.dpr);
        gl.uniform1i(this.u(prog, 'uStepX'), stepX);
        gl.uniform1i(this.u(prog, 'uStepY'), stepY);
        gl.uniform1i(this.u(prog, 'uChN'), INSTANCES[p.mode]);
        gl.uniform2f(this.u(prog, 'uVp'), acc.w, acc.h);
        gl.uniform1f(this.u(prog, 'uReach'), 3.5 * sigma);
        gl.uniform1f(this.u(prog, 'uSigma'), sigma);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n * INSTANCES[p.mode]);
      } else gl.drawArraysInstanced(gl.POINTS, 0, n, INSTANCES[p.mode]);
      gl.disable(gl.BLEND);
    }

    let shown = acc.tex, glow: WebGLTexture | null = null;
    if (crt) ({ shown, glow } = this.crtPasses(key, acc, crt, fresh));
    // digital display with persistence (trace history): the same time-based mix as the CRT
    else if (p.persist) shown = this.crtPasses(key, acc, { on: true, phosphor: 'P31', persist: p.persist, glow: 0, beam: 1 }, fresh).shown;
    else this.settling.delete(key);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    const avg = p.mode === 'rgb' ? 0 : 1;
    if (crt) {
      const dp = this.program('crtDisplay', QUAD_VS, CRT_DISPLAY_FS);
      gl.useProgram(dp);
      [shown, glow ?? shown, acc.tex].forEach((tex, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); });
      gl.uniform1i(this.u(dp, 'uPers'), 0); gl.uniform1i(this.u(dp, 'uGlow'), 1); gl.uniform1i(this.u(dp, 'uAcc'), 2);
      gl.uniform1f(this.u(dp, 'uGain'), p.gain);
      gl.uniform1f(this.u(dp, 'uGlowAmt'), glow ? crt.glow * 1.5 : 0);
      gl.uniform1i(this.u(dp, 'uAvg'), avg);
      const ph = PHOSPHORS[crt.phosphor];
      gl.uniform1i(this.u(dp, 'uTwo'), ph.flash && !p.colorize ? 1 : 0);
      gl.uniform3fv(this.u(dp, 'uFlash'), ph.flash ?? ph.color);
      gl.uniform3fv(this.u(dp, 'uAfter'), ph.color);
      gl.activeTexture(gl.TEXTURE0);
    } else {
      const dp = this.program('display', QUAD_VS, DISPLAY_FS);
      gl.useProgram(dp);
      gl.bindTexture(gl.TEXTURE_2D, shown);
      gl.uniform1i(this.u(dp, 'uAcc'), 0);
      gl.uniform1f(this.u(dp, 'uGain'), p.gain);
      gl.uniform3f(this.u(dp, 'uTint'), 1, 1, 1);
      gl.uniform1i(this.u(dp, 'uAvg'), avg);
    }
    if (overlay) {
      gl.enable(gl.BLEND);
      if (opacity < 1) { gl.blendColor(0, 0, 0, opacity); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE); } else gl.blendFunc(gl.ONE, gl.ONE);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  /**
   * Panels whose CRT persistence is still fading: they must be redrawn although their inputs
   * did not change (main.ts clears their signatures).
   */
  readonly settling = new Set<string>();
  private crtTimes = new Map<string, { last: number; fresh: number; cur: number }>();

  /** CRT persistence (ping-pong) and glow (separable blur); returns the textures to display. */
  private crtPasses(key: string, acc: Accum, crt: CrtSettings, fresh: boolean) {
    const gl = this.gl, now = performance.now();
    const st = this.crtTimes.get(key) ?? { last: now, fresh: now, cur: 0 };
    this.crtTimes.set(key, st);
    const dt = now - st.last;
    st.last = now;
    if (fresh) st.fresh = now;
    const quad = (prog: WebGLProgram, target: Accum) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.disable(gl.BLEND);
      gl.useProgram(prog);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    let shown = acc.tex;
    if (crt.persist !== 0) {
      const prev = this.accum(`${key}#p${st.cur}`, acc.w, acc.h), next = this.accum(`${key}#p${1 - st.cur}`, acc.w, acc.h);
      const prog = this.program('persist', QUAD_VS, PERSIST_FS);
      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prev.tex);
      gl.uniform1i(this.u(prog, 'uAcc'), 0); gl.uniform1i(this.u(prog, 'uPrev'), 1);
      gl.uniform1f(this.u(prog, 'uDecay'), persistDecay(dt, crt.persist));
      gl.uniform1i(this.u(prog, 'uStore'), crt.persist < 0 ? 1 : 0);
      quad(prog, next);
      gl.activeTexture(gl.TEXTURE0);
      st.cur = 1 - st.cur;
      shown = next.tex;
    }
    // keep redrawing until the tail has faded (5 τ); not needed for τ = 0 or ∞
    if (crt.persist > 0 && now - st.fresh < 5 * crt.persist) this.settling.add(key); else this.settling.delete(key);
    let glow: WebGLTexture | null = null;
    if (crt.glow > 0) {
      const a = this.accum(`${key}#g0`, acc.w, acc.h), b = this.accum(`${key}#g1`, acc.w, acc.h);
      const prog = this.program('blur', QUAD_VS, BLUR_FS);
      const px = Math.max(1, Math.round(beamSigma(crt.beam, this.dpr) * 2));
      gl.useProgram(prog);
      gl.uniform1i(this.u(prog, 'uTex'), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, shown);
      gl.uniform2f(this.u(prog, 'uDir'), px / acc.w, 0);
      quad(prog, a);
      gl.bindTexture(gl.TEXTURE_2D, a.tex);
      gl.uniform2f(this.u(prog, 'uDir'), 0, px / acc.h);
      quad(prog, b);
      glow = b.tex;
    }
    return { shown, glow };
  }

  /** Darken a rect (translucent black), e.g. behind an overlaid scope. */
  shade(rect: Rect, alpha: number) {
    const gl = this.gl, vp = this.viewport(rect);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    const prog = this.program('solid', QUAD_VS, `#version 300 es
precision highp float; uniform vec4 uColor; out vec4 o; void main() { o = uColor; }`);
    gl.useProgram(prog);
    gl.uniform4f(this.u(prog, 'uColor'), 0, 0, 0, alpha);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  /**
   * @param clip  only draw inside this rect (A/B wipe)
   * @param target render into an offscreen buffer instead of the canvas (A/B difference)
   */
  drawPicture(src: Source, rect: Rect, p: PictureParams, clip?: Rect, target?: Accum) {
    const t = this.sourceTexture(baseOf(src));
    if (!t) return false;
    const gl = this.gl;
    const vp = this.viewport(rect);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo ?? null);
    if (target) gl.viewport(0, 0, target.w, target.h); else gl.viewport(vp.x, vp.y, vp.w, vp.h);
    if (clip && !target) { const c = this.viewport(clip); gl.enable(gl.SCISSOR_TEST); gl.scissor(c.x, c.y, c.w, c.h); }
    const kind = this.texKind(src, t);
    const r103 = p.mode === 'r103';
    const prog = this.program(`picture${kind}${r103 ? 'r103' : ''}`, QUAD_VS, PICTURE_FS(kind, r103));
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    const { kr, kb } = LUMA[src.colorspace];
    gl.uniform1i(this.u(prog, 'uSrc'), 0);
    gl.uniform2i(this.u(prog, 'uSize'), t.w, t.h);
    gl.uniform1i(this.u(prog, 'uMode'), PICTURE_ID[p.mode]);
    gl.uniform2f(this.u(prog, 'uK'), kr, kb);
    gl.uniform1f(this.u(prog, 'uZebra'), p.zebra);
    gl.uniform1f(this.u(prog, 'uZebraLow'), p.zebraLow);
    gl.uniform4f(this.u(prog, 'uNeutral'), p.neutral?.threshold ?? 0.05, p.neutral?.lo ?? 0.02, p.neutral?.hi ?? 0.98, 0);
    if (r103) gl.uniform4f(this.u(prog, 'uR103'), R103.prefLo - R103.tol, R103.prefHi + R103.tol, R103.totalLo - R103.tol, R103.totalHi + R103.tol);
    this.linearUniforms(prog, src);
    gl.uniform1i(this.u(prog, 'uDisp'), p.display.curve);
    gl.uniformMatrix3fv(this.u(prog, 'uGamut'), false, colMajor(p.display.gamut));
    const hdr = p.display.hdr;
    gl.uniform1i(this.u(prog, 'uHdrMode'), hdr ? { bt2408: 1, bt2446a: 2 }[hdr.mode] : 0);
    gl.uniform1f(this.u(prog, 'uHdrPeak'), hdr?.peak ?? 1000);
    gl.uniformMatrix3fv(this.u(prog, 'uTo2020'), false, colMajor(hdr?.to2020 ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniformMatrix3fv(this.u(prog, 'uFrom2020'), false, colMajor(hdr?.from2020 ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniformMatrix3fv(this.u(prog, 'uWarn'), false, colMajor(p.warn ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniform1i(this.u(prog, 'uRgc'), p.rgc ? 1 : 0);
    if (p.rgc) {
      gl.uniformMatrix3fv(this.u(prog, 'uToAp1'), false, colMajor(p.rgc.toAp1));
      gl.uniformMatrix3fv(this.u(prog, 'uFromAp1'), false, colMajor(p.rgc.fromAp1));
      gl.uniform3f(this.u(prog, 'uRgcThr'), RGC.thrC, RGC.thrM, RGC.thrY);
      gl.uniform3f(this.u(prog, 'uRgcScale'), rgcScale(RGC.limC, RGC.thrC, RGC.power), rgcScale(RGC.limM, RGC.thrM, RGC.power), rgcScale(RGC.limY, RGC.thrY, RGC.power));
      gl.uniform1f(this.u(prog, 'uRgcPow'), RGC.power);
    }
    gl.uniform3f(this.u(prog, 'uSkin'), p.skin.lo, p.skin.hi, p.skin.tol);
    this.setRois(prog, p.roi);
    const bands = new Float32Array(48);
    p.bands.slice(0, 12).forEach((b, i) => {
      const [r, g, bl] = hexToRgb(b.color).map((v) => Math.round(v * 255));
      bands.set([b.from / 100, b.to / 100, r * 65536 + g * 256 + bl, 0], i * 4);
    });
    gl.uniform4fv(this.u(prog, 'uBand'), bands);
    gl.uniform1i(this.u(prog, 'uBands'), Math.min(12, p.bands.length));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    return true;
  }

  /**
   * A/B difference: both pictures rendered offscreen (display-encoded, as shown), then
   * max |A − B| over R, G, B × gain as grey.
   */
  drawPictureDiff(key: string, a: Source, pa: PictureParams, b: Source, pb: PictureParams, rect: Rect, gain: number) {
    const gl = this.gl, vp = this.viewport(rect);
    const ta = this.accum(`${key}#da`, vp.w, vp.h), tb = this.accum(`${key}#db`, vp.w, vp.h);
    if (!this.drawPicture(a, rect, pa, undefined, ta) || !this.drawPicture(b, rect, pb, undefined, tb)) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    const prog = this.program('abdiff', QUAD_VS, `#version 300 es
precision highp float;
uniform sampler2D uA, uB; uniform float uGain;
in vec2 vUv; out vec4 o;
void main() {
  vec3 d = abs(texture(uA, vUv).rgb - texture(uB, vUv).rgb);
  o = vec4(vec3(clamp(max(d.r, max(d.g, d.b)) * uGain, 0.0, 1.0)), 1.0);
}`);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ta.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tb.tex);
    gl.uniform1i(this.u(prog, 'uA'), 0); gl.uniform1i(this.u(prog, 'uB'), 1);
    gl.uniform1f(this.u(prog, 'uGain'), gain);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    return true;
  }

  private setRois(prog: WebGLProgram, rois: Rois) {
    const n = Math.min(MAX_ROIS, rois.length);
    this.gl.uniform1i(this.u(prog, 'uRoiCount'), n);
    if (n) this.gl.uniform4iv(this.u(prog, 'uRois'), new Int32Array(rois.slice(0, n).flat()));
  }

  /** Fill a rect with the plot background colour. */
  clearRect(rect: Rect, rgb: [number, number, number] = [0, 0, 0]) {
    const gl = this.gl, vp = this.viewport(rect);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(vp.x, vp.y, vp.w, vp.h);
    gl.clearColor(rgb[0], rgb[1], rgb[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }
}
