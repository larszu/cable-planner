// True peak after ITU-R BS.1770-5 Annex 2 (p20): 4× oversampling with the example
// FIR interpolator of order 48 (4 phases × 12 taps), absolute value, 20·log10.
// Float processing, so the 12.04 dB attenuation/make-up of the integer path is not needed.
// The same 4× filter is used at every sample rate (at 96 kHz and up the norm would
// also allow 2×; 4× only oversamples more).

/** Annex 2 coefficients, columns Phase 0 … Phase 3, copied from the norm (p20–21). */
export const TP_PHASES: readonly (readonly number[])[] = [
  [0.001708984375, 0.010986328125, -0.0196533203125, 0.033203125, -0.0594482421875, 0.1373291015625,
    0.97216796875, -0.102294921875, 0.047607421875, -0.026611328125, 0.014892578125, -0.00830078125],
  [-0.0291748046875, 0.029296875, -0.0517578125, 0.089111328125, -0.166503906250, 0.465087890625,
    0.77978515625, -0.2003173828125, 0.1015625, -0.0582275390625, 0.0330810546875, -0.0189208984375],
  [-0.0189208984375, 0.0330810546875, -0.0582275390625, 0.1015625, -0.2003173828125, 0.77978515625,
    0.465087890625, -0.166503906250, 0.089111328125, -0.0517578125, 0.029296875, -0.0291748046875],
  [-0.00830078125, 0.014892578125, -0.026611328125, 0.047607421875, -0.102294921875, 0.97216796875,
    0.1373291015625, -0.0594482421875, 0.033203125, -0.0196533203125, 0.010986328125, 0.001708984375],
];
const TAPS = 12;
const COEF = new Float64Array(TAPS * 4);
for (let k = 0; k < TAPS; k++) for (let p = 0; p < 4; p++) COEF[k * 4 + p] = TP_PHASES[p][k];

/** Per-channel true-peak detector with a 12-sample history. */
export class TruePeak {
  private hist = new Float64Array(TAPS * 2); // doubled ring: contiguous window without modulo
  private pos = 0;
  reset() { this.hist.fill(0); this.pos = 0; }
  /** Largest |x| of the 4× oversampled signal over n input samples (linear). */
  process(x: ArrayLike<number>, start: number, n: number): number {
    const h = this.hist;
    let pos = this.pos, peak = 0;
    const c = COEF;
    for (let i = start, end = start + n; i < end; i++) {
      const v = x[i];
      pos = pos === 0 ? TAPS - 1 : pos - 1;
      h[pos] = v; h[pos + TAPS] = v;
      // h[pos + k] = x[n − k]; COEF is interleaved [k][phase]
      let y0 = 0, y1 = 0, y2 = 0, y3 = 0;
      for (let k = 0, j = 0; k < TAPS; k++, j += 4) {
        const s = h[pos + k];
        y0 += c[j] * s; y1 += c[j + 1] * s; y2 += c[j + 2] * s; y3 += c[j + 3] * s;
      }
      if (y0 < 0) y0 = -y0;
      if (y1 < 0) y1 = -y1;
      if (y2 < 0) y2 = -y2;
      if (y3 < 0) y3 = -y3;
      if (y0 > peak) peak = y0;
      if (y1 > peak) peak = y1;
      if (y2 > peak) peak = y2;
      if (y3 > peak) peak = y3;
    }
    this.pos = pos;
    return peak;
  }
}

export const toDb = (lin: number) => (lin > 0 ? 20 * Math.log10(lin) : -Infinity);
