// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// v210 transport (#258): DeckLink/AJA pictures as they leave the card – Y′CbCr 4:2:2, 10 bit,
// 6 pixels in 4 little-endian 32-bit words (Cb Y Cr | Y Cb Y | Cr Y Cb | Y Cr Y), rows padded to
// 48 pixels (128 bytes). The bridge passes them through without ffmpeg (server/helper-input.mjs).
// The packed words go to the GPU as they are (R32UI texture; one pass of V210_UNPACK_FS per new
// picture turns them into the Y′CbCr texture there) and the CPU paths (statistics, probe, R 103 …)
// read them in place with v210Decoder. Both give the same values as unpackV210, which turns them
// into the `format=yuv` layout (src/ycbcr.ts: A, Y′, Cb, Cr as uint16, codes left-justified) –
// still used with the debug switch {"v210":"worker"} (unpack in the frame worker, the path
// before) and for tests.
// Layout: Apple “Uncompressed Y′CbCr 10-bit 4:2:2” (v210, Technical Note TN2162), Blackmagic
// DeckLink SDK bmdFormat10BitYUV: word 0 = Cb0 | Y0<<10 | Cr0<<20, word 1 = Y1 | Cb1<<10 | Y2<<20,
// word 2 = Cr1 | Y3<<10 | Cb2<<20, word 3 = Y4 | Cr2<<10 | Y5<<20. Chroma is co-sited with the
// even pixels (ITU-R BT.709-6 Part 2 / BT.2100 4:2:2 sampling).

import { type Decode, type YuvCoding, yuvScale } from './ycbcr';

/** Bytes of one v210 picture. */
export const v210Bytes = (w: number, h: number) => Math.ceil(w / 48) * 128 * h;
/** 32-bit words of one v210 row (padded to 48 pixels). */
export const v210RowWords = (w: number) => Math.ceil(w / 48) * 32;

// position of Y′ number k (0…5) of a 6-pixel group: word and bit shift
const YW = [0, 1, 1, 2, 3, 3], YS = [10, 0, 20, 10, 0, 20];
// chroma pair j (0…2) of a group: Cb and Cr word and shift
const CBW = [0, 1, 2], CBS = [0, 10, 20], CRW = [0, 2, 3], CRS = [20, 0, 10];

/**
 * Y′, Cb, Cr at pixel (x, y) of a packed picture as 16-bit codes (× 64), into `out`. Same values
 * as unpackV210: odd pixels get the mean chroma of their neighbours, the last one repeats.
 */
export function v210Sample(src: ArrayLike<number>, w: number, x: number, y: number, out: number[]): number[] {
  const row = y * v210RowWords(w), g = (x / 6) | 0, k = x - g * 6;
  out[0] = ((src[row + g * 4 + YW[k]] >>> YS[k]) & 1023) * 64;
  const c = x >> 1, cg = (c / 3) | 0, j = c - cg * 3, o = row + cg * 4;
  let cb = (src[o + CBW[j]] >>> CBS[j]) & 1023, cr = (src[o + CRW[j]] >>> CRS[j]) & 1023;
  if (x & 1 && c < ((w + 1) >> 1) - 1) {
    const c1 = c + 1, g1 = (c1 / 3) | 0, j1 = c1 - g1 * 3, o1 = row + g1 * 4;
    cb += (src[o1 + CBW[j1]] >>> CBS[j1]) & 1023; cr += (src[o1 + CRW[j1]] >>> CRS[j1]) & 1023;
    out[1] = cb * 32; out[2] = cr * 32;
  } else { out[1] = cb * 64; out[2] = cr * 64; }
  return out;
}

/** Y′ code (× 64) at pixel (x, y) of a packed picture. */
export function v210Luma(src: ArrayLike<number>, w: number, x: number, y: number): number {
  const g = (x / 6) | 0, k = x - g * 6;
  return ((src[y * v210RowWords(w) + g * 4 + YW[k]] >>> YS[k]) & 1023) * 64;
}

/**
 * CPU reader of a packed picture (statistics, probe, R 103, timeline …): the same Decode as
 * yuvDecoder, with `i` = 4 × pixel index as for the unpacked layout, so every caller stays as is.
 */
export function v210Decoder(w: number, kr: number, kb: number, c: YuvCoding): Decode {
  const s = yuvScale(c), kg = 1 - kr - kb, ar = 2 * (1 - kr), ab = 2 * (1 - kb);
  const rw = v210RowWords(w), lastC = ((w + 1) >> 1) - 1, yo = s.yOff, ys = s.yScale, co = s.cOff, cs = s.cScale;
  // hot path (statistics, R 103, timeline …): the six pixel positions of a group written out,
  // faster than the table-driven v210Sample; still about 1.7 × the cost of yuvDecoder per sample
  // in the app (CPU profile, PR for #258)
  return (px, i) => {
    const k = i >> 2, y = (k / w) | 0, x = k - y * w, g = (x / 6) | 0, q = x - g * 6, o = y * rw + g * 4;
    const odd = q & 1 && x >> 1 < lastC;
    let yc: number, cb: number, cr: number;
    switch (q) {
      case 0: { const a = px[o]; yc = (a >> 10) & 1023; cb = (a & 1023) * 64; cr = ((a >> 20) & 1023) * 64; break; }
      case 1: {
        const a = px[o], b = px[o + 1]; yc = b & 1023; cb = (a & 1023) * 64; cr = ((a >> 20) & 1023) * 64;
        if (odd) { cb = (cb + ((b >> 10) & 1023) * 64) / 2; cr = (cr + (px[o + 2] & 1023) * 64) / 2; }
        break;
      }
      case 2: { const b = px[o + 1]; yc = (b >> 20) & 1023; cb = ((b >> 10) & 1023) * 64; cr = (px[o + 2] & 1023) * 64; break; }
      case 3: {
        const b = px[o + 1], d = px[o + 2]; yc = (d >> 10) & 1023; cb = ((b >> 10) & 1023) * 64; cr = (d & 1023) * 64;
        if (odd) { cb = (cb + ((d >> 20) & 1023) * 64) / 2; cr = (cr + ((px[o + 3] >> 10) & 1023) * 64) / 2; }
        break;
      }
      case 4: { const e = px[o + 3]; yc = e & 1023; cb = ((px[o + 2] >> 20) & 1023) * 64; cr = ((e >> 10) & 1023) * 64; break; }
      default: {
        const e = px[o + 3]; yc = (e >> 20) & 1023; cb = ((px[o + 2] >> 20) & 1023) * 64; cr = ((e >> 10) & 1023) * 64;
        if (odd) { const n = px[o + 4]; cb = (cb + (n & 1023) * 64) / 2; cr = (cr + ((n >> 20) & 1023) * 64) / 2; }
      }
    }
    const Y = (yc * 64 - yo) / ys, u = (cb - co) / cs, v = (cr - co) / cs;
    const r = Y + ar * v, b = Y + ab * u;
    return [r, (Y - kr * r - kb * b) / kg, b];
  };
}

/**
 * Accessor in the unpacked layout (A, Y′, Cb, Cr per pixel, index 4 × pixel + channel) for
 * readers that index samples, e.g. readStamp (server/stamp.mjs). Slow per call – for a few
 * hundred reads, not for whole frames.
 */
export function v210At(src: ArrayLike<number>, w: number): (i: number) => number {
  const d = [0, 0, 0];
  return (i) => {
    const ch = i & 3, k = i >> 2, y = (k / w) | 0, x = k - y * w;
    if (ch === 0) return 65535;
    if (ch === 1) return v210Luma(src, w, x, y);
    return v210Sample(src, w, x, y, d)[ch - 1];
  };
}

/** meanLuma (src/luma.ts) of a packed picture: the Y′ code on the same sparse grid, 0…1 of 65535. */
export function v210MeanLuma(src: ArrayLike<number>, w: number, h: number): number {
  const sx = Math.max(1, Math.floor(w / 64)), sy = Math.max(1, Math.floor(h / 36));
  let sum = 0, n = 0;
  for (let y = sy >> 1; y < h; y += sy) for (let x = sx >> 1; x < w; x += sx) { sum += v210Luma(src, w, x, y); n++; }
  return n ? sum / n / 65535 : 0;
}

/**
 * Fragment shader of the GPU unpack pass (renderer.ts sourceTexture): reads the packed texture
 * (R32UI, one word per texel, v210RowWords(w) × h) and writes the `format=yuv` layout into an
 * RGBA16UI target of w × h – the same integers as unpackV210. It runs once per new picture; every
 * scope then reads the unpacked texture as before (YUV_FETCH_GLSL). Decoding in each scope's
 * fetchRaw instead cost 4–5 texel fetches per sample and panel and measured slower (PR #258).
 * No loops; a separate small program, compiled only when a v210 source is shown.
 */
export const V210_UNPACK_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D uPacked;
uniform int uW;  // picture width in pixels
out uvec4 oYuv;
uint v210W(int x, int y, int sh) { return (texelFetch(uPacked, ivec2(x, y), 0).r >> uint(sh)) & 1023u; }
// chroma pair c of row y (co-sited with pixel 2c): Cb, Cr
uvec2 v210C(int c, int y) {
  int g = c / 3, j = c - g * 3, o = g * 4;
  if (j == 0) { uint a = texelFetch(uPacked, ivec2(o, y), 0).r; return uvec2(a & 1023u, (a >> 20u) & 1023u); }
  if (j == 1) return uvec2(v210W(o + 1, y, 10), v210W(o + 2, y, 0));
  return uvec2(v210W(o + 2, y, 20), v210W(o + 3, y, 10));
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  int g = p.x / 6, k = p.x - g * 6;
  int wo = k == 0 ? 0 : k < 3 ? 1 : k == 3 ? 2 : 3;
  int sh = (k == 1 || k == 4) ? 0 : (k == 0 || k == 3) ? 10 : 20;
  uint Y = v210W(g * 4 + wo, p.y, sh);
  int c = p.x >> 1;
  uvec2 C = v210C(c, p.y);
  // odd pixels: mean of both neighbours (sum × 64 / 2), the last one repeats its left neighbour
  C = (p.x & 1) == 1 && c < ((uW + 1) >> 1) - 1 ? (C + v210C(c + 1, p.y)) * 32u : C * 64u;
  oYuv = uvec4(65535u, Y * 64u, C);
}`;

/**
 * Unpacks `src` (v210, rows padded) into `out` (4 × uint16 per pixel, A Y′ Cb Cr, × 64).
 * 4:2:2 → 4:4:4: even pixels carry their own (co-sited) chroma, odd pixels the mean of both
 * neighbours (the last one repeats its left neighbour).
 */
export function unpackV210(src: Uint32Array, w: number, h: number, out: Uint16Array): Uint16Array {
  const rowWords = Math.ceil(w / 48) * 32;
  const y = new Uint16Array(w), cb = new Uint16Array((w + 1) >> 1), cr = new Uint16Array((w + 1) >> 1);
  for (let r = 0; r < h; r++) {
    let o = r * rowWords, px = 0, c = 0;
    // 4 words → 6 Y′, 3 Cb, 3 Cr
    while (px < w) {
      const a = src[o], b = src[o + 1], d = src[o + 2], e = src[o + 3];
      o += 4;
      cb[c] = a & 1023; y[px] = (a >> 10) & 1023; cr[c] = (a >> 20) & 1023;
      if (px + 1 < w) y[px + 1] = b & 1023;
      if (c + 1 < cb.length) { cb[c + 1] = (b >> 10) & 1023; cr[c + 1] = d & 1023; }
      if (px + 2 < w) y[px + 2] = (b >> 20) & 1023;
      if (px + 3 < w) y[px + 3] = (d >> 10) & 1023;
      if (c + 2 < cb.length) { cb[c + 2] = (d >> 20) & 1023; cr[c + 2] = (e >> 10) & 1023; }
      if (px + 4 < w) y[px + 4] = e & 1023;
      if (px + 5 < w) y[px + 5] = (e >> 20) & 1023;
      px += 6; c += 3;
    }
    let q = r * w * 4;
    const last = cb.length - 1;
    for (let x = 0; x < w; x++, q += 4) {
      const i = x >> 1;
      let u = cb[i], v = cr[i];
      if (x & 1 && i < last) { u = (u + cb[i + 1]) / 2; v = (v + cr[i + 1]) / 2; }
      out[q] = 65535; out[q + 1] = y[x] * 64; out[q + 2] = Math.round(u * 64); out[q + 3] = Math.round(v * 64);
    }
  }
  return out;
}

/**
 * A received v210 message → the same message with an ayuv64 picture. `head` bytes in front
 * (16 with frame protocol 2) are copied unchanged.
 */
export function v210Message(buf: ArrayBuffer, w: number, h: number, head: number): ArrayBuffer {
  const out = new ArrayBuffer(head + w * h * 8);
  if (head) new Uint8Array(out, 0, head).set(new Uint8Array(buf, 0, head));
  unpackV210(new Uint32Array(buf, head, v210Bytes(w, h) / 4), w, h, new Uint16Array(out, head));
  return out;
}
