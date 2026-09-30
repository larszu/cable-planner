// K-weighting of ITU-R BS.1770-5 (pre-filter "head" shelf + RLB high-pass), for any
// sample rate. The norm only tabulates 48 kHz (p6–7, Tables 1 and 2); the formula
// below is the one of libebur128 (`ebur128_init_filter`, MIT) and reproduces the
// table to at least 13 decimals at 48 kHz (see docs/research/audio.md, c.1).

export interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

export function kWeightingCoefficients(fs: number): [Biquad, Biquad] {
  // stage 1: high shelf
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const s1: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0,
  };
  // stage 2: high-pass (RLB)
  const f1 = 38.13547087602444, Q2 = 0.5003270373238773;
  K = Math.tan((Math.PI * f1) / fs);
  a0 = 1 + K / Q2 + K * K;
  const s2: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q2 + K * K) / a0 };
  return [s1, s2];
}

/** |H(f)|² of the K-filter at frequency f (used for the generator's expected LUFS). */
export function kWeightingPowerGain(f: number, fs: number): number {
  let g = 1;
  const w = (2 * Math.PI * f) / fs;
  for (const c of kWeightingCoefficients(fs)) {
    // H(e^jw) = (b0 + b1 z^-1 + b2 z^-2) / (1 + a1 z^-1 + a2 z^-2)
    const nr = c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w), ni = -c.b1 * Math.sin(w) - c.b2 * Math.sin(2 * w);
    const dr = 1 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w), di = -c.a1 * Math.sin(w) - c.a2 * Math.sin(2 * w);
    g *= (nr * nr + ni * ni) / (dr * dr + di * di);
  }
  return g;
}

/** Two cascaded biquads in direct form I, one instance per channel. */
export class KFilter {
  private c: [Biquad, Biquad];
  private s = new Float64Array(8); // x1 x2 y1 y2 for each stage
  constructor(fs: number) { this.c = kWeightingCoefficients(fs); }
  reset() { this.s.fill(0); }
  /** Filter n samples of x from `start` and return Σ y² (the K-weighted energy). */
  process(x: ArrayLike<number>, start: number, n: number): number {
    const [p, q] = this.c, s = this.s;
    let ax1 = s[0], ax2 = s[1], ay1 = s[2], ay2 = s[3], bx1 = s[4], bx2 = s[5], by1 = s[6], by2 = s[7];
    let sum = 0;
    for (let i = start, end = start + n; i < end; i++) {
      const x0 = x[i];
      const y = p.b0 * x0 + p.b1 * ax1 + p.b2 * ax2 - p.a1 * ay1 - p.a2 * ay2;
      ax2 = ax1; ax1 = x0; ay2 = ay1; ay1 = y;
      const z = q.b0 * y + q.b1 * bx1 + q.b2 * bx2 - q.a1 * by1 - q.a2 * by2;
      bx2 = bx1; bx1 = y; by2 = by1; by1 = z;
      sum += z * z;
    }
    // flush denormals after long silence
    if (Math.abs(ay1) < 1e-30 && Math.abs(ay2) < 1e-30) { ay1 = 0; ay2 = 0; }
    if (Math.abs(by1) < 1e-30 && Math.abs(by2) < 1e-30) { by1 = 0; by2 = 0; }
    s[0] = ax1; s[1] = ax2; s[2] = ay1; s[3] = ay2; s[4] = bx1; s[5] = bx2; s[6] = by1; s[7] = by2;
    return sum;
  }
}
