// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// How much of the picture lies outside a target gamut (#181). The picture view can already
// paint those pixels (gamut warning, renderer.ts uMode 6); this is the number to go with it.
//
// Same rule as the shader, so the number and the marked pixels always agree: convert the pixel
// into the target gamut in linear light, then d = (max − c) / max over the three channels.
// d > 1 means a negative channel – the colour cannot be shown in that gamut. The grades are the
// shader's: > 1 outside, > 1.2 clearly outside (the middle grade is only a drawing nuance).
//
// It runs on the CPU over the statistics frame (Source.cpuFrame), the same picture the QC checks
// use. For sources the browser decodes that costs a read-back, which is why the panel asks for
// it only while the number is shown, and at most a few times a second (Source.gamutOutside).

import { mul3 } from './color';
import type { Decode } from './ycbcr';

export interface GamutShare {
  /** fraction of the samples outside the target gamut (d > 1) */
  share: number;
  /** fraction clearly outside (d > 1.2) */
  far: number;
  samples: number;
}

/** At most this many samples; the step is widened until the picture fits. */
const MAX_SAMPLES = 12_000;

/**
 * @param m    row-major 3×3, source linear → target gamut linear
 * @param lin  signal → linear light of the source (transfer curve)
 */
export function gamutShare(px: ArrayLike<number>, w: number, h: number, decode: Decode, m: number[], lin: (rgb: number[]) => number[]): GamutShare {
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / MAX_SAMPLES)));
  let n = 0, out = 0, far = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const t = mul3(m, lin(decode(px, (y * w + x) * 4)));
      const ach = Math.max(t[0], t[1], t[2]);
      n++;
      if (ach <= 0) continue; // black: nothing to be outside of
      const d = Math.max((ach - t[0]) / ach, (ach - t[1]) / ach, (ach - t[2]) / ach);
      if (d > 1) out++;
      if (d > 1.2) far++;
    }
  }
  return { share: n ? out / n : 0, far: n ? far / n : 0, samples: n };
}
