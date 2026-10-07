// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Mean luma of a frame for the A/V offset (#24). Shared by src/sources.ts and the frame
// worker (src/frameWorker.ts), which measures every frame, also those it replaces (#16).

/** Mean luma (BT.709 weights on the R'G'B' values, 0…1) on a sparse grid – only for flash detection. */
export function meanLuma(px: ArrayLike<number>, w: number, h: number, max: number, yuv = false): number {
  const sx = Math.max(1, Math.floor(w / 64)), sy = Math.max(1, Math.floor(h / 36));
  let sum = 0, n = 0;
  for (let y = sy >> 1; y < h; y += sy) for (let x = sx >> 1; x < w; x += sx) {
    const i = (y * w + x) * 4;
    if (i + 2 >= px.length) break;
    // Y′CbCr frames (A, Y′, Cb, Cr): the Y′ code itself
    sum += yuv ? px[i + 1] : 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; n++;
  }
  return n ? sum / n / max : 0;
}
