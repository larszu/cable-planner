// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Y′CbCr (8 bit, 4:2:0) → R′G′B′A for the H.264 transport (#16). The decoded planes are
// converted here with the matrix the bridge used, not by the browser: drawing a VideoFrame
// into a canvas would pass through Chromium's colour management and change code values.
//
// Narrow range, 8 bit (ITU-R BT.709-6 §4.6, BT.2020-2 Table 5): Y′ = (D_Y − 16)/219,
// Cb/Cr = (D − 128)/224. R′ = Y′ + 2(1 − Kr)·Cr, B′ = Y′ + 2(1 − Kb)·Cb,
// G′ = (Y′ − Kr·R′ − Kb·B′)/Kg. Chroma: nearest sample (no interpolation).

/** Kr, Kb per matrix name as the bridge reports it (`decodeMatrix`). */
export const MATRIX_K: Record<string, [number, number]> = {
  bt709: [0.2126, 0.0722], // BT.709-6 Table 3 item 3.2
  bt601: [0.299, 0.114], // BT.601-7 §2.5.1
  bt2020: [0.2627, 0.0593], // BT.2020-2 Table 4
  smpte240m: [0.212, 0.087], // SMPTE ST 240
};

export interface YuvPlanes {
  y: Uint8Array; u: Uint8Array; v: Uint8Array;
  strideY: number; strideU: number; strideV: number;
  /** NV12: u holds interleaved CbCr, v is ignored */
  nv12?: boolean;
}

/** Convert 4:2:0 planes into a new RGBA8 buffer (optionally after `offset` bytes, e.g. a frame header). */
export function yuv420ToRgba(p: YuvPlanes, w: number, h: number, matrix: string, fullRange = false, offset = 0): Uint8Array {
  const [kr, kb] = MATRIX_K[matrix] ?? MATRIX_K.bt709, kg = 1 - kr - kb;
  const out = new Uint8Array(offset + w * h * 4);
  const ys = fullRange ? 1 / 255 : 1 / 219, yo = fullRange ? 0 : 16, cs = fullRange ? 1 / 255 : 1 / 224;
  const rCr = 2 * (1 - kr), bCb = 2 * (1 - kb);
  // lookup tables: 256 entries each
  const Y = new Float32Array(256), C = new Float32Array(256);
  for (let i = 0; i < 256; i++) { Y[i] = (i - yo) * ys; C[i] = (i - 128) * cs; }
  const clamp = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);
  for (let row = 0; row < h; row++) {
    const yRow = row * p.strideY, cRow = (row >> 1) * p.strideU, vRow = (row >> 1) * p.strideV;
    let o = offset + row * w * 4;
    for (let x = 0; x < w; x++) {
      const cx = x >> 1;
      const cb = p.nv12 ? C[p.u[cRow + cx * 2]] : C[p.u[cRow + cx]];
      const cr = p.nv12 ? C[p.u[cRow + cx * 2 + 1]] : C[p.v[vRow + cx]];
      const yy = Y[p.y[yRow + x]];
      const r = yy + rCr * cr, b = yy + bCb * cb, g = (yy - kr * r - kb * b) / kg;
      out[o] = clamp(r); out[o + 1] = clamp(g); out[o + 2] = clamp(b); out[o + 3] = 255;
      o += 4;
    }
  }
  return out;
}
