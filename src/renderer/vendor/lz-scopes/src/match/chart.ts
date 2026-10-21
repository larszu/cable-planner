// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Colour chart match matrix (#140 step 3, #149): four clicked chart corners per camera →
// homography (src/led/analysis.ts) → median per patch → ΔE00/ΔITP per patch × camera against
// the reference camera, plus a least-squares 3×3 matrix suggestion in linear light.
// Pure functions, no DOM (test/chart.test.ts).

import { inv3, mul3, signalToLinear, linearToSignal } from '../color';
import { deltaE, type Space } from '../deltae';
import { homography, project, type Frame, type Pt } from '../led/analysis';
import { convertSignal, type Rgb } from './core';

export interface ChartLayout { cols: number; rows: number }
/** X-Rite/Calibrite ColorChecker Classic: 6 × 4 patches, read row by row from top left (dark skin). */
export const CLASSIC_24: ChartLayout = { cols: 6, rows: 4 };

/** Corners TL, TR, BR, BL in image pixels → median signal R′G′B′ per patch (row by row). */
export function patchMedians(f: Frame, corners: Pt[], layout: ChartLayout = CLASSIC_24, inner = 0.5, grid = 7): (Rgb | null)[] {
  if (corners.length !== 4) return [];
  const { cols, rows } = layout;
  const H = homography([[0, 0], [cols, 0], [cols, rows], [0, rows]], corners);
  const out: (Rgb | null)[] = [];
  const lo = (1 - inner) / 2;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch: number[][] = [[], [], []];
    for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
      const [x, y] = project(H, c + lo + (inner * (i + 0.5)) / grid, r + lo + (inner * (j + 0.5)) / grid);
      const xi = Math.floor(x), yi = Math.floor(y);
      if (xi < 0 || yi < 0 || xi >= f.width || yi >= f.height) continue;
      const o = (yi * f.width + xi) * 3;
      ch[0].push(f.rgb[o]); ch[1].push(f.rgb[o + 1]); ch[2].push(f.rgb[o + 2]);
    }
    out.push(ch[0].length ? (ch.map(median) as Rgb) : null);
  }
  return out;
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface CameraPatches { id: string; space: Space; patches: (Rgb | null)[] }
export interface MatrixRow { id: string; de: (number | null)[]; mean: number | null; max: number | null; metric: 'ΔE00' | 'ΔITP' }

/** ΔE per patch of every camera against the reference (all in the reference encoding). */
export function matchMatrix(cams: CameraPatches[], refId: string): MatrixRow[] {
  const ref = cams.find((c) => c.id === refId);
  if (!ref) return [];
  return cams.map((cam) => {
    let metric: MatrixRow['metric'] = 'ΔE00';
    const de = cam.patches.map((p, i) => {
      const q = ref.patches[i];
      if (!p || !q) return null;
      const d = deltaE(ref.space, convertSignal(p, cam.space, ref.space), q);
      metric = d.metric;
      return d.value;
    });
    const ok = de.filter((v): v is number => v != null);
    return { id: cam.id, de, mean: ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null, max: ok.length ? Math.max(...ok) : null, metric };
  });
}

/**
 * Least-squares 3×3 matrix M (row-major) with M · src ≈ ref, both linear light. Needs at least
 * three patches that are not collinear in RGB; returns null otherwise.
 */
export function fitMatrix(src: number[][], ref: number[][]): number[] | null {
  if (src.length < 3 || src.length !== ref.length) return null;
  const AtA = new Array(9).fill(0);
  for (const s of src) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) AtA[i * 3 + j] += s[i] * s[j];
  const det = AtA[0] * (AtA[4] * AtA[8] - AtA[5] * AtA[7]) - AtA[1] * (AtA[3] * AtA[8] - AtA[5] * AtA[6]) + AtA[2] * (AtA[3] * AtA[7] - AtA[4] * AtA[6]);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = inv3(AtA), M: number[] = [];
  for (let row = 0; row < 3; row++) {
    const Atb = [0, 0, 0];
    src.forEach((s, k) => { for (let i = 0; i < 3; i++) Atb[i] += s[i] * ref[k][row]; });
    M.push(...mul3(inv, Atb));
  }
  return M;
}

/** Matrix suggestion for one camera against the reference, in the camera's linear light. */
export function suggestMatrix(cam: CameraPatches, ref: CameraPatches): { m: number[]; before: number; after: number } | null {
  const a: number[][] = [], b: number[][] = [], pairs: [Rgb, Rgb][] = [];
  cam.patches.forEach((p, i) => {
    const q = ref.patches[i];
    if (!p || !q) return;
    const qc = convertSignal(q, ref.space, cam.space);
    a.push(signalToLinear(p, cam.space.transfer, cam.space.hlgLw)); b.push(signalToLinear(qc, cam.space.transfer, cam.space.hlgLw));
    pairs.push([p, qc]);
  });
  const m = fitMatrix(a, b);
  if (!m) return null;
  const mean = (f: (p: Rgb, q: Rgb) => number) => pairs.reduce((s, [p, q]) => s + f(p, q), 0) / pairs.length;
  const apply = (p: Rgb) => linearToSignal(mul3(m, signalToLinear(p, cam.space.transfer, cam.space.hlgLw)), cam.space.transfer, cam.space.hlgLw);
  return {
    m,
    before: mean((p, q) => deltaE(cam.space, p, q).value),
    after: mean((p, q) => deltaE(cam.space, apply(p), q).value),
  };
}

/** Corners stored as fractions of the picture (resolution-independent) ↔ pixels. */
export const toPixels = (c: Pt[], w: number, h: number): Pt[] => c.map(([x, y]) => [x * w, y * h]);
export const toFractions = (c: Pt[], w: number, h: number): Pt[] => c.map(([x, y]) => [x / w, y / h]);
