// Spectrum: radix-2 FFT with a Hann window, levels in dBFS so that a full-scale sine
// reads 0 dBFS, optional slope in dB/octave around 1 kHz and 1/3-octave bands on the
// base-10 series fm = 1000 · 10^(k/10), band edges fm · 10^(±1/20).

const windows = new Map<number, Float32Array>();
function hann(n: number) {
  let w = windows.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    windows.set(n, w);
  }
  return w;
}

/** In-place complex FFT (re, im length n = power of two). */
export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

/**
 * Power spectrum of the last n samples (x is read from `start`, length n) in dBFS per bin
 * (bins 0 … n/2). A sine of amplitude A shows its peak bin at 20·log10(A).
 */
export function spectrumDb(x: ArrayLike<number>, start: number, n: number): Float32Array {
  const w = hann(n), re = new Float64Array(n), im = new Float64Array(n);
  let wsum = 0;
  for (let i = 0; i < n; i++) { re[i] = x[start + i] * w[i]; wsum += w[i]; }
  fft(re, im);
  const out = new Float32Array(n / 2 + 1), norm = 2 / wsum;
  for (let k = 0; k <= n / 2; k++) {
    const m = Math.hypot(re[k], im[k]) * norm;
    out[k] = m > 1e-10 ? 20 * Math.log10(m) : -200;
  }
  return out;
}

/** Third-octave centre frequencies 1000·10^(k/10) between fLo and fHi. */
export function thirdOctaveCentres(fLo = 20, fHi = 20000): number[] {
  const out: number[] = [];
  for (let k = -20; k <= 14; k++) { const f = 1000 * 10 ** (k / 10); if (f >= fLo * 0.99 && f <= fHi * 1.01) out.push(f); }
  return out;
}

/** Sum the bin powers of a dB spectrum into third-octave bands (dBFS of the band energy). */
export function thirdOctaveBands(db: Float32Array, fs: number, centres: number[]): number[] {
  const n = (db.length - 1) * 2, df = fs / n;
  // Hann: equivalent noise bandwidth 1.5 bins; a sine inside one band keeps its level
  return centres.map((fm) => {
    const lo = fm * 10 ** (-1 / 20), hi = fm * 10 ** (1 / 20);
    let p = 0;
    for (let k = Math.max(1, Math.ceil(lo / df)); k <= Math.min(db.length - 1, Math.floor(hi / df)); k++) p += 10 ** (db[k] / 10);
    return p > 0 ? 10 * Math.log10(p / 1.5) : -200;
  });
}

/** Display slope: +dB/oct·log2(f/1 kHz). */
export const tiltDb = (f: number, dbPerOct: number) => (dbPerOct ? dbPerOct * Math.log2(Math.max(1, f) / 1000) : 0);
