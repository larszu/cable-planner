// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Unclipped Y′CbCr path (issue #7): 16-bit Y′CbCr frames from the bridge (`format=yuv`) and
// the 16-bit test patterns are decoded to R′G′B′ in the shaders (and on the CPU for probe and
// statistics) without any clamping, so sub-black and super-white survive. Plus the EBU R 103
// v3.0 gamut check with its measurement filter and 1 % area rule.
//
// Frame layout (docs/frame-protocol.md, format "yuv"): 4 × uint16 per pixel in the order of
// ffmpeg's `ayuv64le`: A, Y′, Cb, Cr. n-bit code values are left-justified to 16 bit
// (value · 2^(16−n)) – ffmpeg 9.0.1 does this for both ranges, checked: 10-bit 943 → 60352,
// 8-bit full-range 255 → 65280.

/** How the Y′CbCr code values are quantised: narrow ("tv", 16–235 · 2^(n−8)) or full ("pc"), n bits. */
export interface YuvCoding { full: boolean; bits: number }

/**
 * Offsets and scales in 16-bit units, from ITU-R BT.2100-3 Tab. 9 (p11):
 * narrow D = Round[(219·E′ + 16)·2^(n−8)], chroma Round[(224·E′ + 128)·2^(n−8)];
 * full   D = Round[(2^n − 1)·E′],          chroma Round[(2^n − 1)·E′ + 2^(n−1)].
 * Left-justified to 16 bit: × 2^(16−n).
 */
export function yuvScale(c: YuvCoding) {
  if (!c.full) return { yOff: 16 * 256, yScale: 219 * 256, cOff: 128 * 256, cScale: 224 * 256 };
  const n = Math.max(8, Math.min(16, Math.round(c.bits) || 10)), s = 2 ** (16 - n), top = (2 ** n - 1) * s;
  return { yOff: 0, yScale: top, cOff: 2 ** (n - 1) * s, cScale: top };
}

/** 16-bit Y′, Cb, Cr codes → normalised R′G′B′ (0 = 0 %, 1 = 100 %), unclipped. */
export function decodeYuv(Y: number, Cb: number, Cr: number, kr: number, kb: number, c: YuvCoding): [number, number, number] {
  const s = yuvScale(c);
  const y = (Y - s.yOff) / s.yScale, cb = (Cb - s.cOff) / s.cScale, cr = (Cr - s.cOff) / s.cScale;
  const r = y + 2 * (1 - kr) * cr, b = y + 2 * (1 - kb) * cb;
  return [r, (y - kr * r - kb * b) / (1 - kr - kb), b];
}

/** Normalised R′G′B′ → 16-bit Y′, Cb, Cr codes (rounded, limited to 0…65535). */
export function encodeYuv(r: number, g: number, b: number, kr: number, kb: number, c: YuvCoding): [number, number, number] {
  const s = yuvScale(c);
  const y = kr * r + (1 - kr - kb) * g + kb * b;
  const cb = (b - y) / (2 * (1 - kb)), cr = (r - y) / (2 * (1 - kr));
  const q = (v: number) => Math.max(0, Math.min(65535, Math.round(v)));
  return [q(s.yOff + y * s.yScale), q(s.cOff + cb * s.cScale), q(s.cOff + cr * s.cScale)];
}

/** Reads pixel i (index of its first sample) of a raw frame as normalised R′G′B′. */
export type Decode = (px: ArrayLike<number>, i: number) => [number, number, number];

export const rgbDecoder = (scale: number): Decode => (px, i) => [px[i] / scale, px[i + 1] / scale, px[i + 2] / scale];

export function yuvDecoder(kr: number, kb: number, c: YuvCoding): Decode {
  const s = yuvScale(c), kg = 1 - kr - kb, ar = 2 * (1 - kr), ab = 2 * (1 - kb);
  return (px, i) => {
    const y = (px[i + 1] - s.yOff) / s.yScale, cb = (px[i + 2] - s.cOff) / s.cScale, cr = (px[i + 3] - s.cOff) / s.cScale;
    const r = y + ar * cr, b = y + ab * cb;
    return [r, (y - kr * r - kb * b) / kg, b];
  };
}

/**
 * GLSL for the Y′CbCr texture (RGBA16UI holding A, Y′, Cb, Cr): defines fetchRaw like the
 * other FETCH variants in renderer.ts, so the CST/LUT chain (chain.ts) runs after it.
 */
export const YUV_FETCH_GLSL = `
uniform highp usampler2D uSrc;
uniform vec4 uYuvN;  // yOff, yScale, cOff, cScale (16-bit units)
uniform vec2 uYuvK;  // Kr, Kb of the source matrix
vec3 fetchRaw(ivec2 p) {
  vec3 d = vec3(texelFetch(uSrc, p, 0).gba);
  float y = (d.x - uYuvN.x) / uYuvN.y, cb = (d.y - uYuvN.z) / uYuvN.w, cr = (d.z - uYuvN.z) / uYuvN.w;
  float kr = uYuvK.x, kb = uYuvK.y;
  float r = y + 2.0 * (1.0 - kr) * cr, b = y + 2.0 * (1.0 - kb) * cb;
  return vec3(r, (y - kr * r - kb * b) / (1.0 - kr - kb), b);
}`;

// ---------------------------------------------------------------- EBU R 103

/**
 * EBU R 103 v3.0 (May 2020), Tab. 1 p5, as signal levels from the 10-bit codes
 * (narrow range, 64 = 0 %, 940 = 100 %): preferred range 20–984 = −5.02 %…105.02 %,
 * total video signal range 4–1019 = −6.85 %…109.02 %. The 8/12/16-bit columns give the
 * same levels within rounding. Applies to R, G, B and the luminance Y (p4).
 */
export const R103 = {
  prefLo: (20 - 64) / 876, prefHi: (984 - 64) / 876,
  totalLo: (4 - 64) / 876, totalHi: (1019 - 64) / 876,
  /** the limits are integer codes: a value counts as outside only half a 10-bit code beyond them */
  tol: 0.5 / 876,
  /** "indicate an Out-of-Gamut occurrence only after the error exceeds 1 % of the image" (p5) */
  area: 0.01,
};

/** R 103 measurement filters (p5): horizontal quarter band, vertical half band. */
export const R103_H = [1, 2, 3, 4, 3, 2, 1].map((v) => v / 16);
export const R103_V = [1, 2, 1].map((v) => v / 4);

export interface R103Result {
  /** fraction of the measured area outside the preferred range (any of R, G, B, Y) */
  pref: number;
  /** fraction outside the total video signal range */
  total: number;
  /** per channel R, G, B, Y: fraction below / above the preferred range */
  below: number[]; above: number[];
  /** filtered extremes per channel R, G, B, Y */
  min: number[]; max: number[];
  /** out-of-gamut occurrence per R 103: more than 1 % of the area */
  alarm: boolean;
  samples: number; width: number; height: number;
}

/**
 * R 103 check on a whole frame: decode, filter R′G′B′ with 1/16…1/16 horizontally and
 * 1/4-1/2-1/4 vertically (edges repeated), Y from the filtered R′G′B′ (the filter is linear),
 * then count. `rois` restricts the counted area (the filter still sees the neighbours).
 */
export function r103Check(px: ArrayLike<number>, w: number, h: number, decode: Decode, kr: number, kb: number,
  map?: (rgb: number[]) => number[], rois: [number, number, number, number][] | null = null): R103Result {
  const n = w * h, R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let c: number[] = decode(px, k * 4);
    if (map) c = map(c);
    R[k] = c[0]; G[k] = c[1]; B[k] = c[2];
  }
  const tmp = new Float32Array(n);
  const filt = (P: Float32Array) => {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let t = -3; t <= 3; t++) s += R103_H[t + 3] * P[row + Math.min(w - 1, Math.max(0, x + t))];
        tmp[row + x] = s;
      }
    }
    for (let y = 0; y < h; y++) {
      const up = Math.max(0, y - 1) * w, dn = Math.min(h - 1, y + 1) * w, row = y * w;
      for (let x = 0; x < w; x++) P[row + x] = R103_V[0] * tmp[up + x] + R103_V[1] * tmp[row + x] + R103_V[2] * tmp[dn + x];
    }
  };
  filt(R); filt(G); filt(B);
  const kg = 1 - kr - kb;
  const below = [0, 0, 0, 0], above = [0, 0, 0, 0], min = [Infinity, Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity, -Infinity];
  let pref = 0, total = 0, samples = 0;
  const inside = (x: number, y: number) => !rois || rois.some((r) => x >= r[0] && y >= r[1] && x < r[2] && y < r[3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const k = y * w + x, v = [R[k], G[k], B[k], kr * R[k] + kg * G[k] + kb * B[k]];
      let p = false, t = false;
      for (let c = 0; c < 4; c++) {
        const e = v[c];
        if (e < min[c]) min[c] = e;
        if (e > max[c]) max[c] = e;
        if (e < R103.prefLo - R103.tol) { below[c]++; p = true; } else if (e > R103.prefHi + R103.tol) { above[c]++; p = true; }
        if (e < R103.totalLo - R103.tol || e > R103.totalHi + R103.tol) t = true;
      }
      if (p) pref++;
      if (t) total++;
      samples++;
    }
  }
  const d = Math.max(1, samples);
  return {
    pref: pref / d, total: total / d, below: below.map((v) => v / d), above: above.map((v) => v / d), min, max,
    alarm: pref / d > R103.area, samples, width: w, height: h,
  };
}

/**
 * GLSL for the picture overlay: filtered R′G′B′Y at a source pixel against the R 103 limits.
 * Returns 0 inside, 1 outside the preferred range, 2 outside the total range. Needs fetchRGB.
 */
export const R103_GLSL = `
uniform vec4 uR103; // prefLo, prefHi, totalLo, totalHi (tolerance already applied)
int r103Level(ivec2 p, ivec2 size, vec2 k) {
  float hw[7] = float[7](1.0, 2.0, 3.0, 4.0, 3.0, 2.0, 1.0);
  float vw[3] = float[3](1.0, 2.0, 1.0);
  vec3 acc = vec3(0.0);
  for (int j = -1; j <= 1; j++)
    for (int i = -3; i <= 3; i++)
      acc += hw[i + 3] * vw[j + 1] * fetchRGB(clamp(p + ivec2(i, j), ivec2(0), size - 1));
  acc /= 64.0;
  vec4 v = vec4(acc, dot(acc, vec3(k.x, 1.0 - k.x - k.y, k.y)));
  if (any(lessThan(v, vec4(uR103.z))) || any(greaterThan(v, vec4(uR103.w)))) return 2;
  if (any(lessThan(v, vec4(uR103.x))) || any(greaterThan(v, vec4(uR103.y)))) return 1;
  return 0;
}`;
