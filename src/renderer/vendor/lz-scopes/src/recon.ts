// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
/**
 * Waveform "Flat reconstructed" (#257): the trace between the samples as a sin(x)/x reconstruction
 * draws it, like Tektronix in Flat (WFM5200 spec 077-0533-00, p. 2). Every row is oversampled 4×
 * horizontally with a Lanczos-3 kernel. The same arithmetic runs in the scatter shader
 * (renderer.ts fetchMeasured); this module is its reference and the unit-test target.
 */
export const RECON_FACTOR = 4;
export const RECON_TAPS = 3;

/** Lanczos-3: sinc(x)·sinc(x/3) for |x| < 3. */
export function lanczos3(x: number): number {
  if (x === 0) return 1;
  if (Math.abs(x) >= RECON_TAPS) return 0;
  const px = Math.PI * x;
  return (RECON_TAPS * Math.sin(px) * Math.sin(px / RECON_TAPS)) / (px * px);
}

/**
 * Value at position i + f (0 ≤ f < 1) of one row; edges repeat the border sample. The weights are
 * normalised, so a flat area keeps its level exactly; at f = 0 the sample itself comes back.
 */
export function reconAt(row: ArrayLike<number>, i: number, f: number): number {
  if (f === 0) return row[i];
  let s = 0, w = 0;
  for (let k = 1 - RECON_TAPS; k <= RECON_TAPS; k++) {
    const g = lanczos3(k - f);
    s += g * row[Math.min(row.length - 1, Math.max(0, i + k))];
    w += g;
  }
  return s / w;
}

/** The whole row, `factor` points per sample. */
export function reconstructRow(row: ArrayLike<number>, factor = RECON_FACTOR): number[] {
  const out: number[] = [];
  for (let i = 0; i < row.length; i++) for (let j = 0; j < factor; j++) out.push(reconAt(row, i, j / factor));
  return out;
}
