// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// 3D colour volume (issue #8): every sampled pixel as a point in the R′G′B′ cube, in CIELAB or
// in ICtCp, rotatable, with the target gamut as a wire frame. Idea from colour-repos.md (DCTLs
// "Map_to_3D_Cube", prism LUT volume view – GPL resp. MIT, only the idea); own code. The shader
// (renderer.ts, mode 9) and the CPU functions below use the same axes and scales:
//   R′G′B′: x = R′, y = G′, z = B′, centred on 50 %;
//   CIELAB: x = a*, y = L* (up), z = b*, D65 white of the source = L* 100;
//   ICtCp : x = CT, y = I (up), z = CP, from BT.2020 display light (1.0 = 203 cd/m² for HDR,
//           100 cd/m² for SDR) – BT.2100 ICtCp as in color.ts rgb2020ToIctcp;
//   Y′CbCr: x = Cb, y = Y′ (up), z = Cr of the signal (the "Hector" view: waveform and vectorscope in one);
//   CIE XYZ: x = X, y = Y (up), z = Z, linear light, white Y = 1;
//   CHL   : x = hue h_ab (0…360°), y = L*, z = chroma C*_ab – CIELAB unrolled into a box;
//   HSV   : cylinder of the signal, angle = hue, radius = saturation, y = value.
// Models and navigation (drag = rotate, shift-drag = pan, wheel = zoom, double click = reset) as
// listed in the Nobe OmniScope docs ("3D Color Cube", "HectorScope"); own implementation.

import { GAMUTS, LUMA, gamutConvert, mul3, rgb2020ToIctcp, rgbToXyzMatrix, signalToLinear, xyzToLab, type Colorspace, type GamutId, type Transfer } from './color';

/** Y′, Cb, Cr of a signal R′G′B′ (Cb/Cr −0.5…0.5). */
export function yccOf(c: number[], k: { kr: number; kb: number }): [number, number, number] {
  const y = k.kr * c[0] + (1 - k.kr - k.kb) * c[1] + k.kb * c[2];
  return [y, (c[2] - y) / (2 * (1 - k.kb)), (c[0] - y) / (2 * (1 - k.kr))];
}

export type CubeSpace = 'rgb' | 'lab' | 'ictcp' | 'ycbcr' | 'xyz' | 'chl' | 'hsv';
export const CUBE_SPACE_ID: Record<CubeSpace, number> = { rgb: 0, lab: 1, ictcp: 2, ycbcr: 3, xyz: 4, chl: 5, hsv: 6 };
export const CUBE_SPACE_LABELS: Record<CubeSpace, string> = {
  rgb: 'R′G′B′-Würfel', ycbcr: 'Y′CbCr (3D-Waveform)', hsv: 'HSV-Zylinder', xyz: 'CIE XYZ', lab: 'CIELAB', chl: 'CIE LCh (abgerollt)', ictcp: 'ICtCp',
};
/** spaces built from the signal (wire frame = 0–100 % signal cube) vs. from linear light (wire frame = target gamut) */
export const SIGNAL_SPACES: CubeSpace[] = ['rgb', 'ycbcr', 'hsv'];

export interface CubeSettings {
  space: CubeSpace; yaw: number; pitch: number; gamut: '709' | 'p3' | '2020';
  /** view: zoom factor and pan in clip units */
  zoom?: number; panX?: number; panY?: number;
  /** LUT volume: name of a loaded LUT, lattice size, show the input lattice too, hide the picture */
  lut?: string; lutGrid?: number; lutInput?: boolean; lutOnly?: boolean;
}
export const DEFAULT_CUBE: CubeSettings = { space: 'rgb', yaw: 35, pitch: 25, gamut: '709', zoom: 1, panX: 0, panY: 0 };

/** Projection scale into clip space (fits the rotated cube corners). */
export const CUBE_SCALE = 0.55;

/** Row-major rotation: first yaw about the vertical axis, then pitch about the horizontal one (degrees). */
export function cubeRotation(yawDeg: number, pitchDeg: number): number[] {
  const y = (yawDeg * Math.PI) / 180, p = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  // Rx(p) · Ry(y)
  return [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
}

export const qFromRgb = (rgb: number[]) => rgb.map((v) => (v - 0.5) * 1.6);
export const qFromLab = (lab: number[]) => [(lab[1] / 128) * 1.2, (lab[0] / 100 - 0.5) * 2, (lab[2] / 128) * 1.2];
export const qFromIctcp = (ic: number[]) => [ic[1] * 3, (ic[0] - 0.3) * 2.4, ic[2] * 3];
export const qFromYcc = (ycc: number[]) => [ycc[1] * 2.4, (ycc[0] - 0.5) * 2, ycc[2] * 2.4];
export const qFromXyz = (xyz: number[]) => xyz.map((v) => (v - 0.5) * 1.6);
/** [L*, C*, h° ] */
export const qFromChl = (lch: number[]) => [(lch[2] / 360 - 0.5) * 2.4, (lch[0] / 100 - 0.5) * 2, (lch[1] / 128) * 1.2 - 0.6];
/** [h°, s, v] */
export const qFromHsv = (hsv: number[]) => [hsv[1] * Math.cos((hsv[0] * Math.PI) / 180) * 1.2, (hsv[2] - 0.5) * 2, hsv[1] * Math.sin((hsv[0] * Math.PI) / 180) * 1.2];

/** HSV of a signal R′G′B′ (hue in degrees, 0 = red). */
export function hsvOf(c: number[]): [number, number, number] {
  const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === c[0]) h = ((((c[1] - c[2]) / d) % 6) + 6) % 6;
    else if (mx === c[1]) h = (c[2] - c[0]) / d + 2;
    else h = (c[0] - c[1]) / d + 4;
    h *= 60;
  }
  return [h, mx > 1e-6 ? d / mx : 0, mx];
}
const lchOf = (lab: number[]) => [lab[0], Math.hypot(lab[1], lab[2]), ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360];

export interface CubeView { zoom: number; panX: number; panY: number }
const NO_VIEW: CubeView = { zoom: 1, panX: 0, panY: 0 };

/** Clip-space x, y of a volume point after the rotation (orthographic), zoom and pan. */
export function cubeProject(rot: number[], q: number[], view: CubeView = NO_VIEW): [number, number] {
  const v = mul3(rot, q);
  return [v[0] * CUBE_SCALE * view.zoom + view.panX, v[1] * CUBE_SCALE * view.zoom + view.panY];
}

/** Cube edges as corner-index pairs (corner i = bits R, G, B). */
const EDGES: [number, number][] = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
const corner = (i: number) => [i & 1, (i >> 1) & 1, (i >> 2) & 1];

/**
 * Wire frame polylines (volume coordinates q) of the target: in R′G′B′ the 0–100 % cube, in
 * CIELAB / ICtCp the edges of the target gamut's linear RGB cube (0…1 = up to reference white),
 * seen from a source with primaries `srcGamut` (its white is the Lab reference).
 */
export function cubeWireframe(space: CubeSpace, target: GamutId, srcGamut: GamutId, nits = 100, steps = 24, k: { kr: number; kb: number } = { kr: 0.2126, kb: 0.0722 }): number[][][] {
  return EDGES.map(([a, b]) => {
    const ca = corner(a), cb = corner(b), line: number[][] = [];
    for (let i = 0; i <= (space === 'rgb' ? 1 : steps); i++) {
      const t = space === 'rgb' ? i : i / steps;
      const c = ca.map((v, kk) => v + (cb[kk] - v) * t);
      if (space === 'rgb') line.push(qFromRgb(c));
      else if (space === 'ycbcr') line.push(qFromYcc(yccOf(c, k)));
      else if (space === 'hsv') line.push(qFromHsv(hsvOf(c)));
      else if (space === 'xyz') {
        const M = rgbToXyzMatrix(GAMUTS[target]), W = mul3(rgbToXyzMatrix(GAMUTS[srcGamut]), [1, 1, 1]);
        line.push(qFromXyz(mul3(M, c).map((v) => v / W[1])));
      } else if (space === 'chl') {
        const M = rgbToXyzMatrix(GAMUTS[target]), W = mul3(rgbToXyzMatrix(GAMUTS[srcGamut]), [1, 1, 1]);
        line.push(qFromChl(lchOf(xyzToLab(mul3(M, c), W))));
      } else if (space === 'lab') {
        const M = rgbToXyzMatrix(GAMUTS[target]), W = mul3(rgbToXyzMatrix(GAMUTS[srcGamut]), [1, 1, 1]);
        line.push(qFromLab(xyzToLab(mul3(M, c), W)));
      } else {
        const m = gamutConvert(GAMUTS[target], GAMUTS['2020']);
        line.push(qFromIctcp(rgb2020ToIctcp(mul3(m, c).map((v) => Math.max(0, v) * nits))));
      }
    }
    return line;
  });
}

/** GLSL for plotSample mode 9 (needs toLinear, uToXYZ of the scatter shader). */
export const CUBE_GLSL = `
uniform int uCube; uniform mat3 uRot, uTo2020; uniform vec3 uWhiteXYZ, uView; uniform float uCubeNits;
vec3 hsvQ(vec3 c) {
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), d = mx - mn, h = 0.0;
  if (d > 1e-6) {
    if (mx == c.r) h = mod((c.g - c.b) / d + 6.0, 6.0);
    else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
  }
  float s = mx > 1e-6 ? d / mx : 0.0, a = radians(h * 60.0);
  return vec3(s * cos(a) * 1.2, (mx - 0.5) * 2.0, s * sin(a) * 1.2);
}
float labF(float t) { return t > 216.0 / 24389.0 ? pow(t, 1.0 / 3.0) : (24389.0 / 27.0 * t + 16.0) / 116.0; }
float pqE(float n) { float p = pow(max(n, 0.0) / 10000.0, 0.1593017578125); return pow((0.8359375 + 18.8515625 * p) / (1.0 + 18.6875 * p), 78.84375); }
vec3 cubeQ(vec3 rgb) {
  if (uCube == 0) return (rgb - 0.5) * 1.6;
  if (uCube == 3) {
    float kr = uK.x, kb = uK.y, y = dot(rgb, vec3(kr, 1.0 - kr - kb, kb));
    return vec3((rgb.b - y) / (2.0 * (1.0 - kb)) * 2.4, (y - 0.5) * 2.0, (rgb.r - y) / (2.0 * (1.0 - kr)) * 2.4);
  }
  if (uCube == 6) return hsvQ(rgb);
  vec3 lin = toLinear(rgb);
  if (uCube == 4) return (uToXYZ * lin / uWhiteXYZ.y - 0.5) * 1.6;
  if (uCube == 1 || uCube == 5) {
    vec3 xyz = uToXYZ * lin / uWhiteXYZ;
    vec3 f = vec3(labF(xyz.x), labF(xyz.y), labF(xyz.z));
    vec3 lab = vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
    if (uCube == 5) {
      float h = mod(degrees(atan(lab.z, lab.y)) + 360.0, 360.0);
      return vec3((h / 360.0 - 0.5) * 2.4, (lab.x / 100.0 - 0.5) * 2.0, length(lab.yz) / 128.0 * 1.2 - 0.6);
    }
    return vec3(lab.y / 128.0 * 1.2, (lab.x / 100.0 - 0.5) * 2.0, lab.z / 128.0 * 1.2);
  }
  vec3 n = max(uTo2020 * lin, 0.0) * uCubeNits;
  vec3 lms = vec3(pqE(dot(n, vec3(1688.0, 2146.0, 262.0) / 4096.0)), pqE(dot(n, vec3(683.0, 2951.0, 462.0) / 4096.0)), pqE(dot(n, vec3(99.0, 309.0, 3688.0) / 4096.0)));
  vec3 ic = vec3(dot(lms, vec3(2048.0, 2048.0, 0.0)), dot(lms, vec3(6610.0, -13613.0, 7003.0)), dot(lms, vec3(17933.0, -17390.0, -543.0))) / 4096.0;
  return vec3(ic.y * 3.0, (ic.x - 0.3) * 2.4, ic.z * 3.0);
}`;

/** cd/m² of linear 1.0 for the ICtCp axis: HDR reference white 203 (BT.2408), SDR 100. */
export const cubeNits = (t: Transfer) => (t === 'pq' || t === 'hlg' ? 203 : 100);

/** Volume coordinates of one signal R′G′B′ (CPU mirror of cubeQ in the shader). */
export function cubeQOf(space: CubeSpace, rgb: number[], s: { transfer: Transfer; gamut: GamutId; hlgLw: number; colorspace?: Colorspace }): number[] {
  if (space === 'rgb') return qFromRgb(rgb);
  if (space === 'ycbcr') return qFromYcc(yccOf(rgb, LUMA[s.colorspace ?? '709']));
  if (space === 'hsv') return qFromHsv(hsvOf(rgb));
  const lin = signalToLinear(rgb, s.transfer, s.hlgLw);
  const M = rgbToXyzMatrix(GAMUTS[s.gamut]), W = mul3(M, [1, 1, 1]);
  if (space === 'xyz') return qFromXyz(mul3(M, lin).map((v) => v / W[1]));
  if (space === 'lab') return qFromLab(xyzToLab(mul3(M, lin), W));
  if (space === 'chl') return qFromChl(lchOf(xyzToLab(mul3(M, lin), W)));
  const m = gamutConvert(GAMUTS[s.gamut], GAMUTS['2020']);
  return qFromIctcp(rgb2020ToIctcp(mul3(m, lin).map((v) => Math.max(0, v) * cubeNits(s.transfer))));
}

/**
 * LUT volume (issue #67; idea: OmniScope "3D LUT / ICC Profile" scope, prism's LUT volume view):
 * an n³ lattice over the input domain 0…1 and the LUT's output for every lattice point.
 * Works for 1D, 3D and shaper+3D LUTs alike, since it goes through applyLut.
 */
export function lutVolume(apply: (rgb: number[]) => number[], n = 17): { inp: number[]; out: number[] }[] {
  const pts: { inp: number[]; out: number[] }[] = [];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
    const inp = [r / (n - 1), g / (n - 1), b / (n - 1)];
    pts.push({ inp, out: apply(inp) });
  }
  return pts;
}
