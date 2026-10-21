// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Least-squares surface over the picture plane: level = c0 + c1·x + c2·y + c3·x² + c4·y² + c5·x·y,
// with x, y running −1 … +1 across the region (left → right, top → bottom). Used by the noise
// meter (noise.ts: remove shading before measuring) and the white-shading map (shading.ts:
// saw = linear, par = parabolic terms, as cameras adjust them). Pure functions, no DOM.

/** Coefficients [c0 … c5] in the order of the basis above. */
export type Surface = [number, number, number, number, number, number];

const basis = (x: number, y: number) => [1, x, y, x * x, y * y, x * y];

/** Solve A·c = b (n × n, Gaussian elimination with partial pivoting); null when singular. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** Normalised coordinate of column/row i of n (−1 … +1, pixel centres). */
export const norm = (i: number, n: number) => (n <= 1 ? 0 : ((i + 0.5) / n) * 2 - 1);

/**
 * Fit the surface to a w × h plane (row-major). `step` thins the samples on large planes.
 * Returns null for planes too small to fit six terms.
 */
export function fitSurface(v: ArrayLike<number>, w: number, h: number, step = 1): Surface | null {
  if (w < 3 || h < 3) return null;
  const A = Array.from({ length: 6 }, () => new Array(6).fill(0)), b = new Array(6).fill(0);
  for (let r = 0; r < h; r += step) for (let c = 0; c < w; c += step) {
    const f = basis(norm(c, w), norm(r, h)), z = v[r * w + c];
    for (let i = 0; i < 6; i++) { b[i] += f[i] * z; for (let j = 0; j < 6; j++) A[i][j] += f[i] * f[j]; }
  }
  return solve(A, b) as Surface | null;
}

/** Value of the fitted surface at normalised (x, y). */
export function surfaceAt(s: Surface, x: number, y: number) {
  const f = basis(x, y);
  let z = 0;
  for (let i = 0; i < 6; i++) z += s[i] * f[i];
  return z;
}
