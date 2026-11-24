// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// v210 transport (#258): DeckLink/AJA pictures as they leave the card – Y′CbCr 4:2:2, 10 bit,
// 6 pixels in 4 little-endian 32-bit words (Cb Y Cr | Y Cb Y | Cr Y Cb | Y Cr Y), rows padded to
// 48 pixels (128 bytes). The bridge passes them through without ffmpeg (server/helper-input.mjs);
// the frame worker unpacks them here to the `format=yuv` layout (src/ycbcr.ts: A, Y′, Cb, Cr as
// uint16, codes left-justified), so everything after it stays the same.

/** Bytes of one v210 picture. */
export const v210Bytes = (w: number, h: number) => Math.ceil(w / 48) * 128 * h;

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
