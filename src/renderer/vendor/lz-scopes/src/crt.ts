// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// CRT / analogue trace look (issue #27): the scope trace drawn as the path of an electron beam
// instead of single points. Waveforms connect neighbouring samples along each picture line,
// the vectorscope and CIE plot connect successive samples in scan order.
//
// Beam model after woscope (github.com/m1el/woscope @ 74af1e3, MIT, © 2015 Igor Null, Chad von Nau;
// shaders/vsLine.glsl, fsLine.glsl): every segment is a quad around the line, the fragment
// shader integrates a Gaussian spot along the segment analytically with erf. Changed: rewritten
// for WebGL2 and our scatter pipeline, the deposit is normalised so that each segment carries the
// same energy as one point of the digital mode (brightness ∝ 1/segment length = 1/beam speed),
// persistence and glow are our own passes. See licenses/woscope-LICENSE.txt.
//
// Phosphors: colour and persistence class from the "Standard phosphor types" table of the
// Wikipedia article "Phosphor" (P1 green 525 nm, 1–100 ms; P7 blue with yellow persistence
// 440/558 nm, long; P31 yellowish green, 0.01–1 ms). The display colours are approximations of
// those wavelengths on an sRGB screen, not colorimetric measurements.

export type Phosphor = 'P31' | 'P1' | 'P7';

export interface CrtSettings {
  on: boolean;
  phosphor: Phosphor;
  /** persistence time constant τ in ms; 0 = none, -1 = infinite (storage) */
  persist: number;
  /** glow (halo around the trace) 0…1 */
  glow: number;
  /** beam width (FWHM) in CSS pixels */
  beam: number;
}

export interface PhosphorDef {
  name: string;
  /** trace colour (linear-ish sRGB 0…1, approximation) */
  color: [number, number, number];
  /** P7: colour of the fresh flash; the afterglow uses `color` */
  flash?: [number, number, number];
  /** default τ in ms for the persistence class of the table */
  tau: number;
  note: string;
}

export const PHOSPHORS: Record<Phosphor, PhosphorDef> = {
  P31: { name: 'P31 (gelbgrün, kurz)', color: [0.55, 1, 0.25], tau: 0.5, note: 'ZnS:Cu, gelblich grün, 0,01–1 ms' },
  P1: { name: 'P1 (grün, mittel)', color: [0.2, 1, 0.35], tau: 30, note: 'Zn₂SiO₄:Mn, grün 525 nm, 1–100 ms' },
  P7: { name: 'P7 (blau, gelbes Nachleuchten)', color: [0.85, 1, 0.2], flash: [0.55, 0.7, 1], tau: 1500, note: '(Zn,Cd)S:Cu, blau 440 nm mit gelbem Nachleuchten 558 nm, lang' },
};

export const DEFAULT_CRT: CrtSettings = { on: false, phosphor: 'P31', persist: 0.5, glow: 0.35, beam: 1.5 };

export const PERSIST_CHOICES: [number, string][] = [
  [0, 'aus'], [0.5, '0,5 ms (P31)'], [30, '30 ms (P1)'], [100, '100 ms'], [300, '300 ms'], [1500, '1,5 s (P7)'], [5000, '5 s'], [-1, 'unendlich'],
];

/** Gaussian σ in device pixels from the beam FWHM in CSS pixels. */
export const beamSigma = (fwhm: number, dpr: number) => Math.max(0.35, (fwhm * dpr) / (2 * Math.sqrt(2 * Math.log(2))));

/**
 * Persistence mix: new = acc·(1 − d) + old·d with d = exp(−Δt/τ). The result converges to the
 * current trace, so the brightness does not depend on τ; only moving traces leave a tail.
 * τ = ∞ keeps the maximum (storage scope), τ = 0 shows only the current trace.
 */
export function persistDecay(dtMs: number, tauMs: number) {
  if (tauMs < 0) return 1;
  if (tauMs === 0) return 0;
  return Math.exp(-Math.max(0, dtMs) / tauMs);
}

/** erf, Abramowitz & Stegun 7.1.27 (|error| < 5·10⁻⁴) – the same approximation woscope uses. */
export function erfApprox(x: number) {
  const s = Math.sign(x), a = Math.abs(x);
  let t = 1 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  t *= t;
  return s - s / (t * t);
}

/**
 * Deposit density of one beam segment of length `len` at (x along, y across), both in pixels,
 * for a Gaussian spot of σ: the integral over the plane is 1 (per unit intensity).
 */
export function beamDensity(x: number, y: number, len: number, sigma: number) {
  if (len < 1e-3) return Math.exp(-(x * x + y * y) / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma);
  const k = Math.SQRT2 * sigma;
  return (0.5 * (erfApprox((len - x) / k) + erfApprox(x / k)) / len) * Math.exp(-(y * y) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
}

/** GLSL of beamDensity for the fragment shader. */
export const BEAM_GLSL = `
float erfA(float x) {
  float s = sign(x), a = abs(x);
  float t = 1.0 + (0.278393 + (0.230389 + (0.000972 + 0.078108 * a) * a) * a) * a;
  t *= t;
  return s - s / (t * t);
}
float beamDensity(float x, float y, float len, float sigma) {
  if (len < 1e-3) return exp(-(x * x + y * y) / (2.0 * sigma * sigma)) / (6.283185307 * sigma * sigma);
  float k = 1.414213562 * sigma;
  return 0.5 * (erfA((len - x) / k) + erfA(x / k)) / len * exp(-(y * y) / (2.0 * sigma * sigma)) / (sigma * 2.506628275);
}`;

/**
 * Vertex shader body of a beam segment (needs SAMPLE_GLSL of renderer.ts). Instance = segment
 * × channel; vertices 0–3 = corners of the quad (triangle strip). Segments join sample c and
 * c + 1 of one row (stepped by uStepX/uStepY).
 */
export const CRT_VS_MAIN = `
uniform int uStepX, uStepY, uChN;
uniform vec2 uVp;     // viewport in device pixels
uniform float uReach; // half size of the quad around the line (≈ 3.5 σ), device pixels
out vec3 vSeg;        // along, across, length (device pixels)
void main() {
  int ch = gl_InstanceID % uChN, seg = gl_InstanceID / uChN;
  int segCols = uCols - 1, row = seg / segCols, c = seg % segCols;
  ivec2 p0 = ivec2(c * uStepX, row * uStepY), p1 = ivec2(min((c + 1) * uStepX, uSize.x - 1), row * uStepY);
  vec2 a, b; vec3 ca, cb;
  if (p0.y >= uSize.y || !plotSample(p0, ch, a, ca) || !plotSample(p1, ch, b, cb)) { gl_Position = vec4(9.0); return; }
  vec2 A = (a * 0.5 + 0.5) * uVp, B = (b * 0.5 + 0.5) * uVp, d = B - A;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0), nrm = vec2(-dir.y, dir.x);
  bool end = gl_VertexID >= 2;
  float side = (gl_VertexID % 2 == 0) ? -1.0 : 1.0;
  vec2 P = (end ? B : A) + ((end ? 1.0 : -1.0) * dir + side * nrm) * uReach;
  vSeg = vec3(end ? len + uReach : -uReach, side * uReach, len);
  vColor = mix(ca, cb, 0.5) * uIntensity;
  vW = uIntensity;
  gl_Position = vec4(P / uVp * 2.0 - 1.0, 0.0, 1.0);
}`;

export const CRT_FS = `#version 300 es
precision highp float;
in vec3 vColor; in float vW; in vec3 vSeg;
uniform float uSigma;
out vec4 o;
${BEAM_GLSL}
void main() {
  float g = beamDensity(vSeg.x, vSeg.y, vSeg.z, uSigma);
  o = vec4(vColor * g, vW * g);
}`;

/** Persistence: mix of the new trace and the previous state (see persistDecay). */
export const PERSIST_FS = `#version 300 es
precision highp float;
uniform sampler2D uAcc, uPrev; uniform float uDecay; uniform int uStore;
in vec2 vUv; out vec4 o;
void main() {
  vec4 a = texture(uAcc, vUv), p = texture(uPrev, vUv);
  o = uStore == 1 ? max(a, p) : mix(a, p, uDecay);
}`;

/** Separable glow: 9 taps (binomial weights), `uDir` = step in texture coordinates. */
export const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uDir;
in vec2 vUv; out vec4 o;
void main() {
  float w[5] = float[5](70.0, 56.0, 28.0, 8.0, 1.0);
  vec4 s = texture(uTex, vUv) * w[0];
  for (int i = 1; i < 5; i++) s += (texture(uTex, vUv + uDir * float(i)) + texture(uTex, vUv - uDir * float(i))) * w[i];
  o = s / 256.0;
}`;

/** Display of the CRT buffers: trace + glow, tone-mapped like the digital mode; P7 two-colour. */
export const CRT_DISPLAY_FS = `#version 300 es
precision highp float;
uniform sampler2D uPers, uGlow, uAcc;
uniform float uGain, uGlowAmt; uniform int uAvg, uTwo;
uniform vec3 uFlash, uAfter;
in vec2 vUv; out vec4 o;
void main() {
  vec4 p = texture(uPers, vUv), a = p + uGlowAmt * texture(uGlow, vUv);
  vec3 c;
  if (uTwo == 1) {
    // P7: where the beam is now = blue flash, what only persists = yellow afterglow
    float fresh = clamp(texture(uAcc, vUv).a / max(p.a, 1e-6), 0.0, 1.0);
    c = mix(uAfter, uFlash, fresh) * (1.0 - exp(-a.a * uGain));
  } else if (uAvg == 1) {
    c = a.a > 0.0 ? clamp(a.rgb / a.a, 0.0, 1.0) * (1.0 - exp(-a.a * uGain)) : vec3(0.0);
  } else {
    float m = max(a.r, max(a.g, a.b));
    c = m > 0.0 ? a.rgb / m * (1.0 - exp(-m * uGain)) : vec3(0.0);
  }
  o = vec4(c, 1.0);
}`;
