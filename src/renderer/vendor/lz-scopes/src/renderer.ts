// WebGL2 renderer: one canvas behind the whole panel grid. Scopes are computed on the
// GPU by scattering every sampled pixel as a point into a float accumulation buffer
// (additive blending), then tone-mapped into the panel's plot rectangle.

import { GAMUTS, LUMA, hexToRgb, rgbToXyzMatrix, type Colorspace, type FalseColorBand } from './color';
import { CHAIN_GLSL, baseOf, chainOf, linearGlsl, setChainUniforms, setLinearUniforms, type LutTex } from './chain';
import type { Lut } from './lut';
import type { Source } from './sources';

export type ScatterMode = 'luma' | 'rgb' | 'parade' | 'yrgb' | 'ycbcr' | 'vector' | 'cie' | 'skin';
const MODE_ID: Record<ScatterMode, number> = { luma: 0, rgb: 1, parade: 2, yrgb: 3, ycbcr: 4, vector: 5, cie: 6, skin: 7 };
const INSTANCES: Record<ScatterMode, number> = { luma: 1, rgb: 3, parade: 3, yrgb: 4, ycbcr: 3, vector: 1, cie: 1, skin: 1 };

export type PictureMode = 'normal' | 'false' | 'zebra' | 'clip' | 'luma' | 'skin' | 'gamut';
const PICTURE_ID: Record<PictureMode, number> = { normal: 0, false: 1, zebra: 2, clip: 3, luma: 4, skin: 5, gamut: 6 };

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

/** Raw source texel plus the processing chain (CST/LUT, see chain.ts) → fetchRGB. */
const FETCH = (u16: boolean) => (u16
  ? `uniform highp usampler2D uSrc;
     vec3 fetchRaw(ivec2 p) { return vec3(texelFetch(uSrc, p, 0).rgb) / 65535.0; }`
  : `uniform highp sampler2D uSrc;
     vec3 fetchRaw(ivec2 p) { return texelFetch(uSrc, p, 0).rgb; }`) + CHAIN_GLSL;

const SCATTER_VS = (u16: boolean) => `#version 300 es
precision highp float; precision highp int;
${FETCH(u16)}
uniform ivec2 uSize;
uniform int uStep, uCols, uMode, uColorize, uCieUv, uSecN;
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

float waveY(float v) { return (v - uWMin) / (uWMax - uWMin) * 2.0 - 1.0; }

void main() {
  gl_PointSize = uPointSize;
  ivec2 p = ivec2(gl_VertexID % uCols, gl_VertexID / uCols) * uStep;
  if (p.y >= uSize.y || p.x >= uSize.x) { gl_Position = vec4(9.0); return; }
  vec3 rgb = fetchRGB(p);
  float kr = uK.x, kb = uK.y, kg = 1.0 - kr - kb;
  float Y = dot(rgb, vec3(kr, kg, kb));
  float cb = (rgb.b - Y) / (2.0 * (1.0 - kb));
  float cr = (rgb.r - Y) / (2.0 * (1.0 - kr));
  float x = (float(p.x) + 0.5) / float(uSize.x);
  int ch = gl_InstanceID;
  vec3 unit[3] = vec3[3](vec3(1.0, 0.18, 0.18), vec3(0.2, 1.0, 0.25), vec3(0.3, 0.45, 1.0));
  vec3 mono = uTint;
  // the pixel's own colour, brightness normalised so dark pixels stay visible
  vec3 srcCol = clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0);
  vec2 pos; vec3 col = mono;

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
    if (uSec[ch] < 0) { gl_Position = vec4(9.0); return; }
    float v = ch == 0 ? rgb.r : ch == 1 ? rgb.g : rgb.b;
    float px = uMode == 2 ? (float(uSec[ch]) + x) / float(uSecN) : x;
    pos = vec2(px * 2.0 - 1.0, waveY(v));
    // source colours: in each channel's section only the pixels dominated by that channel are coloured
    float cv = ch == 0 ? rgb.r : ch == 1 ? rgb.g : rgb.b;
    bool dom = cv >= max(rgb.r, max(rgb.g, rgb.b)) - 0.02 && cv - min(rgb.r, min(rgb.g, rgb.b)) > 0.04;
    col = uColorize == 2 ? (dom ? srcCol : vec3(0.3)) : uColorize == 1 || uMode == 1 ? unit[ch] : mono;
  } else if (uMode == 3) {
    if (uSec[ch] < 0) { gl_Position = vec4(9.0); return; }
    float v = ch == 0 ? Y : ch == 1 ? rgb.r : ch == 2 ? rgb.g : rgb.b;
    pos = vec2((float(uSec[ch]) + x) / float(uSecN) * 2.0 - 1.0, waveY(v));
    float cv3 = ch == 1 ? rgb.r : ch == 2 ? rgb.g : rgb.b;
    bool dom3 = ch > 0 && cv3 >= max(rgb.r, max(rgb.g, rgb.b)) - 0.02 && cv3 - min(rgb.r, min(rgb.g, rgb.b)) > 0.04;
    col = uColorize == 2 ? (ch == 0 ? srcCol : dom3 ? srcCol : vec3(0.3)) : ch == 0 || uColorize == 0 ? mono : unit[ch - 1];
  } else if (uMode == 4) {
    float v = ch == 0 ? Y : ch == 1 ? cb + 0.5 : cr + 0.5;
    pos = vec2((float(ch) + x) / 3.0 * 2.0 - 1.0, waveY(v));
    col = ch == 0 || uColorize == 0 ? mono : ch == 1 ? vec3(0.35, 0.55, 1.0) : vec3(1.0, 0.3, 0.35);
  } else if (uMode == 5) {
    pos = vec2(cb, cr) * 2.0 * 0.9 * uZoom;
    if (uColorize == 1) col = clamp(rgb / max(max(rgb.r, max(rgb.g, rgb.b)), 0.05), 0.0, 1.0);
  } else {
    vec3 XYZ = uToXYZ * toLinear(rgb);
    float s = uCieUv == 1 ? XYZ.x + 15.0 * XYZ.y + 3.0 * XYZ.z : XYZ.x + XYZ.y + XYZ.z;
    if (s < 1e-6) { gl_Position = vec4(9.0); return; }
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
  vColor = col * uIntensity;
  vW = uIntensity;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

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

const PICTURE_FS = (u16: boolean) => `#version 300 es
precision highp float; precision highp int;
${FETCH(u16)}
uniform ivec2 uSize; uniform int uMode; uniform vec2 uK;
uniform vec4 uBand[8]; uniform int uBands;
uniform float uZebra, uZebraLow;
uniform int uDisp;
uniform mat3 uGamut, uWarn;
uniform vec3 uSkin;
${ROI_GLSL}
in vec2 vUv; out vec4 o;
${SKIN_GLSL}
${LINEAR_GLSL}
float srgbOetf(float l) { return l <= 0.0031308 ? 12.92 * l : 1.055 * pow(l, 1.0 / 2.4) - 0.055; }
/** Signal → what the chosen display should show (uDisp 0 sRGB/P3 curve, 1 BT.1886, 2 raw). */
vec3 toDisplay(vec3 rgb) {
  if (uDisp == 2) return rgb;
  vec3 l = uGamut * toLinear(rgb);
  if (uTransfer >= 1 && uTransfer <= 3) { // simple highlight roll-off for HDR/log on SDR (approximation, not BT.2390/BT.2408)
    float m = max(l.r, max(l.g, l.b)), w = 4.0;
    if (m > 0.0) l *= (1.0 + m / (w * w)) / (1.0 + m);
  }
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
    for (int i = 0; i < 8; i++) {
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
  } else if (uMode == 6) {
    // gamut warning: distance d = (max - c)/max in the target gamut; d > 1 = a channel is negative
    vec3 t = uWarn * toLinear(rgb);
    float ach = max(t.r, max(t.g, t.b));
    float d = ach > 0.0 ? max((ach - t.r) / ach, max((ach - t.g) / ach, (ach - t.b) / ach)) : 0.0;
    c = vec3(dot(c, vec3(0.2126, 0.7152, 0.0722)) * 0.7);
    if (d > 1.2) c = vec3(1.0, 0.1, 0.75);
    else if (d > 1.05) c = vec3(1.0, 0.45, 0.05);
    else if (d > 1.0) c = vec3(1.0, 0.9, 0.1);
  }
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
}
/** How the picture view maps the signal to the screen. */
export interface DisplayParams { curve: 0 | 1 | 2; gamut: number[] /* row-major 3×3 input→display, linear */ }
export interface PictureParams {
  mode: PictureMode; bands: FalseColorBand[]; zebra: number; zebraLow: number; roi: Rois; skin: SkinRange; display: DisplayParams;
  /** gamut warning: row-major 3×3 source linear → target gamut linear */
  warn?: number[];
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

  readonly canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
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
    return true;
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
    const a = this.accums.get(key);
    if (a) { this.gl.deleteTexture(a.tex); this.gl.deleteFramebuffer(a.fbo); this.accums.delete(key); }
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

  /** Uniforms of LINEAR_GLSL (what the scopes see) and CHAIN_GLSL (CST/LUT) for a source or stage view. */
  private linearUniforms(prog: WebGLProgram, src: Source) {
    const u = (n: string) => this.u(prog, n);
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
    const prog = this.program(`scatter${t.u16 ? 16 : 8}`, SCATTER_VS(t.u16), SCATTER_FS);
    const step = Math.max(1, Math.ceil(Math.sqrt((t.w * t.h) / p.maxSamples)));
    const cols = Math.ceil(t.w / step), rows = Math.ceil(t.h / step);
    const cs: Colorspace = src.colorspace;
    const { kr, kb } = LUMA[cs];
    const mode = MODE_ID[p.mode];
    const n = cols * rows;
    // Normalise so that the display brightness does not depend on source or panel size.
    const sections = p.mode === 'parade' || p.mode === 'yrgb' ? p.secN ?? (p.mode === 'yrgb' ? 4 : 3) : p.mode === 'ycbcr' ? 3 : 1;
    const area = (vp.w / sections) * vp.h;
    const dot = p.mode === 'vector' || p.mode === 'cie' ? Math.max(1, Math.round(this.dpr)) : 1;
    const intensity = ((p.mode === 'vector' || p.mode === 'cie' ? 0.6 : 0.9) * area) / n / (dot * dot);

    // Only re-scatter when the frame or a parameter changed; otherwise reuse the accumulation.
    const sig = `${src.id}:${src.frameSeq}:${t.w}x${t.h}:${acc.w}x${acc.h}:${src.colorspace}:${src.transfer}:${src.gamut}:${src.hlgLw}:${chainOf(src)?.sig ?? ''}:${JSON.stringify(p)}`;
    const fresh = this.sigs.get(key) !== sig;
    this.sigs.set(key, sig);
    if (fresh) {
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
    gl.uniform1i(this.u(prog, 'uSrc'), 0);
    gl.uniform2i(this.u(prog, 'uSize'), t.w, t.h);
    gl.uniform1i(this.u(prog, 'uStep'), step);
    gl.uniform1i(this.u(prog, 'uCols'), cols);
    gl.uniform1i(this.u(prog, 'uMode'), mode);
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
    gl.uniform1i(this.u(prog, 'uSecN'), p.secN ?? (p.mode === 'yrgb' ? 4 : 3));
    // GLSL mat3 is column-major
    gl.uniformMatrix3fv(this.u(prog, 'uToXYZ'), false, colMajor(rgbToXyzMatrix(GAMUTS[src.gamut])));
    const cv = p.cieUv ? CIE_VIEW_UV : CIE_VIEW;
    gl.uniform4f(this.u(prog, 'uCie'), cv.x0, cv.x1, cv.y0, cv.y1);
    this.setRois(prog, p.roi);
    gl.uniform3f(this.u(prog, 'uSkin'), p.skin.lo, p.skin.hi, p.skin.tol);
    gl.uniform3fv(this.u(prog, 'uTint'), p.tint);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.POINTS, 0, n, INSTANCES[p.mode]);
    gl.disable(gl.BLEND);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    const dp = this.program('display', QUAD_VS, DISPLAY_FS);
    gl.useProgram(dp);
    gl.bindTexture(gl.TEXTURE_2D, acc.tex);
    gl.uniform1i(this.u(dp, 'uAcc'), 0);
    gl.uniform1f(this.u(dp, 'uGain'), p.gain);
    gl.uniform3f(this.u(dp, 'uTint'), 1, 1, 1);
    gl.uniform1i(this.u(dp, 'uAvg'), p.mode === 'rgb' ? 0 : 1);
    if (overlay) {
      gl.enable(gl.BLEND);
      if (opacity < 1) { gl.blendColor(0, 0, 0, opacity); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE); } else gl.blendFunc(gl.ONE, gl.ONE);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
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

  drawPicture(src: Source, rect: Rect, p: PictureParams) {
    const t = this.sourceTexture(baseOf(src));
    if (!t) return;
    const gl = this.gl;
    const vp = this.viewport(rect);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vp.x, vp.y, vp.w, vp.h);
    const prog = this.program(`picture${t.u16 ? 16 : 8}`, QUAD_VS, PICTURE_FS(t.u16));
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
    this.linearUniforms(prog, src);
    gl.uniform1i(this.u(prog, 'uDisp'), p.display.curve);
    gl.uniformMatrix3fv(this.u(prog, 'uGamut'), false, colMajor(p.display.gamut));
    gl.uniformMatrix3fv(this.u(prog, 'uWarn'), false, colMajor(p.warn ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]));
    gl.uniform3f(this.u(prog, 'uSkin'), p.skin.lo, p.skin.hi, p.skin.tol);
    this.setRois(prog, p.roi);
    const bands = new Float32Array(32);
    p.bands.slice(0, 8).forEach((b, i) => {
      const [r, g, bl] = hexToRgb(b.color).map((v) => Math.round(v * 255));
      bands.set([b.from / 100, b.to / 100, r * 65536 + g * 256 + bl, 0], i * 4);
    });
    gl.uniform4fv(this.u(prog, 'uBand'), bands);
    gl.uniform1i(this.u(prog, 'uBands'), Math.min(8, p.bands.length));
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
