// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Camera-based LED wall check (#10): 4-point rectification, per-cabinet statistics,
// seam profiles, scan-line index, dead-pixel search, before/after, viewing-angle series
// and the Unreal-style camera matrix. Pure functions on RGB frames (0–1), no DOM.
//
// A video camera is not a colorimeter: everything here is relative (cabinet against the
// wall median, seam against the neighbouring interior, before against after).

import { bt709InverseOetf, inv3 } from '../color';
import { cabinets, type WallConfig } from './wall';
import { t } from '../i18n';

/** RGB frame, 3 floats per pixel in 0–1 (camera code values). */
export interface Frame { width: number; height: number; rgb: Float32Array }

export type Pt = [number, number];
/** Signal treatment: code values as recorded, or linearised with the inverse BT.709 OETF. */
export type CameraTransfer = 'code' | 'bt709';

// BT.709 luma and colour-difference scaling (ITU-R BT.709-6, items 3.2 and 3.3)
const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;

// ---------------------------------------------------------------- homography

/** Solve A·x = b (n×n, partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error(t('led.err.collinear'));
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/**
 * Projective transform (3×3, row-major, h33 = 1) that maps the four `from` points onto
 * the four `to` points: x' = (h0 x + h1 y + h2)/(h6 x + h7 y + 1), y' likewise.
 */
export function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...solve(A, b), 1];
}

export function project(H: number[], x: number, y: number): Pt {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

export const invertHomography = (H: number[]) => { const m = inv3(H); return m.map((v) => v / m[8]); };

/** Maps wall pixels (0…wallW, 0…wallH) to image points; corners in the order TL, TR, BR, BL. */
export function wallToImage(wall: WallConfig, corners: Pt[]) {
  const W = wall.cabW * wall.cols, H = wall.cabH * wall.rows;
  return homography([[0, 0], [W, 0], [W, H], [0, H]], corners);
}

// ---------------------------------------------------------------- sampling

/** Bilinear RGB sample at image point (x, y); null outside. */
export function sample(f: Frame, x: number, y: number): [number, number, number] | null {
  x -= 0.5; y -= 0.5; // pixel centres
  if (x < -0.5 || y < -0.5 || x > f.width - 0.5 || y > f.height - 0.5) return null;
  const x0 = Math.max(0, Math.min(f.width - 1, Math.floor(x))), y0 = Math.max(0, Math.min(f.height - 1, Math.floor(y)));
  const x1 = Math.min(f.width - 1, x0 + 1), y1 = Math.min(f.height - 1, y0 + 1);
  const fx = Math.min(1, Math.max(0, x - x0)), fy = Math.min(1, Math.max(0, y - y0));
  const out: [number, number, number] = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = f.rgb[(y0 * f.width + x0) * 3 + k], b = f.rgb[(y0 * f.width + x1) * 3 + k];
    const c = f.rgb[(y1 * f.width + x0) * 3 + k], d = f.rgb[(y1 * f.width + x1) * 3 + k];
    out[k] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  }
  return out;
}

/** Luminance value used for the uniformity figures. */
export function lumaOf(rgb: ArrayLike<number>, transfer: CameraTransfer) {
  if (transfer === 'bt709') return KR * bt709InverseOetf(rgb[0]) + KG * bt709InverseOetf(rgb[1]) + KB * bt709InverseOetf(rgb[2]);
  return KR * rgb[0] + KG * rgb[1] + KB * rgb[2];
}

/** Cb, Cr of code values (BT.709: Cb = (B′−Y′)/1.8556, Cr = (R′−Y′)/1.5748). */
export function chromaOf(rgb: ArrayLike<number>): [number, number] {
  const y = KR * rgb[0] + KG * rgb[1] + KB * rgb[2];
  return [(rgb[2] - y) / (2 * (1 - KB)), (rgb[0] - y) / (2 * (1 - KR))];
}

const median = (a: number[]) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

/** Samples a wall-pixel rectangle on a grid of n×n points; returns luma and chroma lists. */
function sampleRect(f: Frame, H: number[], x: number, y: number, w: number, h: number, nx: number, ny: number, transfer: CameraTransfer) {
  const Y: number[] = [], cb: number[] = [], cr: number[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const [u, v] = project(H, x + ((i + 0.5) * w) / nx, y + ((j + 0.5) * h) / ny);
    const rgb = sample(f, u, v);
    if (!rgb) continue;
    Y.push(lumaOf(rgb, transfer));
    const [b, r] = chromaOf(rgb); cb.push(b); cr.push(r);
  }
  return { Y, cb, cr };
}

// ---------------------------------------------------------------- cabinet analysis

export interface CabinetStat {
  id: number; label: string; c: number; r: number;
  mean: number; median: number; std: number;
  /** deviation of the cabinet median from the wall median, % */
  dev: number;
  cb: number; cr: number;
  /** chroma difference to the wall median in code % (100 × ΔCb, ΔCr) */
  dCb: number; dCr: number;
  n: number;
}

export interface SeamStat {
  /** 'v' = between columns c and c+1 (row r), 'h' = between rows r and r+1 (column c) */
  dir: 'v' | 'h'; c: number; r: number; a: string; b: string;
  /** seam strip against the mean of the neighbouring interiors, % (+ = bright line, − = dark) */
  contrast: number;
  /** luma profile across the seam, from −25 % to +25 % of the cabinet size */
  profile: number[];
}

export interface WallResult {
  date: string; wall: WallConfig; corners: Pt[]; transfer: CameraTransfer; margin: number; captures: number;
  cabinets: CabinetStat[]; seams: SeamStat[];
  wallMedian: number;
  /** min/max of the cabinet medians, % (100 = perfectly even) */
  uniformity: number;
  /** spread: standard deviation of the cabinet deviations, % */
  spread: number;
}

export interface AnalyseOptions {
  /** cabinet edge zone left out of the interior statistics, fraction per side (0–0.45) */
  margin?: number;
  transfer?: CameraTransfer;
  /** sample grid per cabinet (n×n) */
  samples?: number;
  captures?: number;
}

export function analyseWall(f: Frame, wall: WallConfig, corners: Pt[], o: AnalyseOptions = {}): WallResult {
  const margin = Math.min(0.45, Math.max(0, o.margin ?? 0.15)), transfer = o.transfer ?? 'code', n = o.samples ?? 24;
  const H = wallToImage(wall, corners);
  const raw = cabinets(wall).map((cab) => {
    const mx = cab.w * margin, my = cab.h * margin;
    const s = sampleRect(f, H, cab.x + mx, cab.y + my, cab.w - 2 * mx, cab.h - 2 * my, n, n, transfer);
    return { cab, Y: s.Y, cb: mean(s.cb), cr: mean(s.cr) };
  });
  const meds = raw.map((x) => median(x.Y)).filter(Number.isFinite);
  const wallMedian = median(meds), cbMed = median(raw.map((x) => x.cb).filter(Number.isFinite)), crMed = median(raw.map((x) => x.cr).filter(Number.isFinite));
  const cabs: CabinetStat[] = raw.map(({ cab, Y, cb, cr }) => {
    const md = median(Y);
    return {
      id: cab.id, label: cab.label, c: cab.c, r: cab.r, mean: mean(Y), median: md, std: std(Y),
      dev: wallMedian > 0 ? (md / wallMedian - 1) * 100 : NaN, cb, cr, dCb: (cb - cbMed) * 100, dCr: (cr - crMed) * 100, n: Y.length,
    };
  });
  const good = cabs.map((c) => c.median).filter((v) => Number.isFinite(v));
  return {
    date: new Date().toISOString(), wall, corners, transfer, margin, captures: o.captures ?? 1,
    cabinets: cabs, seams: analyseSeams(f, wall, H, transfer),
    wallMedian,
    uniformity: good.length ? (Math.min(...good) / Math.max(...good)) * 100 : NaN,
    spread: std(cabs.map((c) => c.dev).filter(Number.isFinite)),
  };
}

/**
 * Seams: a strip of 4 % cabinet width (at least 1 wall pixel) centred on each inner
 * cabinet boundary against 10 % strips of both cabinets' interior beside it (starting
 * 8 % away from the boundary); rows/columns within the 15 % end zones are left out.
 */
export function analyseSeams(f: Frame, wall: WallConfig, H: number[], transfer: CameraTransfer = 'code'): SeamStat[] {
  const out: SeamStat[] = [];
  const lab = (c: number, r: number) => `C${c + 1}-R${r + 1}`;
  const profileSteps = 21;
  for (let r = 0; r < wall.rows; r++) for (let c = 0; c < wall.cols; c++) {
    for (const dir of ['v', 'h'] as const) {
      if (dir === 'v' && c === wall.cols - 1) continue;
      if (dir === 'h' && r === wall.rows - 1) continue;
      const size = dir === 'v' ? wall.cabW : wall.cabH, len = dir === 'v' ? wall.cabH : wall.cabW;
      const pos = dir === 'v' ? (c + 1) * wall.cabW : (r + 1) * wall.cabH;
      const along0 = (dir === 'v' ? r * wall.cabH : c * wall.cabW) + len * 0.15, alongLen = len * 0.7;
      const sw = Math.max(1, size * 0.04), nw = size * 0.1, gap = size * 0.08;
      const strip = (a: number, width: number) => {
        const s = dir === 'v'
          ? sampleRect(f, H, a, along0, width, alongLen, 3, 24, transfer)
          : sampleRect(f, H, along0, a, alongLen, width, 24, 3, transfer);
        return mean(s.Y);
      };
      const seam = strip(pos - sw / 2, sw);
      const side = (strip(pos - gap - nw, nw) + strip(pos + gap, nw)) / 2;
      const profile: number[] = [];
      for (let k = 0; k < profileSteps; k++) {
        const a = pos + ((k / (profileSteps - 1)) - 0.5) * 0.5 * size;
        profile.push(strip(a - 0.5, 1));
      }
      out.push({
        dir, c, r, a: lab(c, r), b: dir === 'v' ? lab(c + 1, r) : lab(c, r + 1),
        contrast: side > 0 ? (seam / side - 1) * 100 : NaN, profile,
      });
    }
  }
  return out;
}

/** Average several frames of the same size (noise, scan lines). */
export function averageFrames(frames: Frame[]): Frame {
  const f0 = frames[0], rgb = new Float32Array(f0.rgb.length);
  for (const f of frames) {
    if (f.width !== f0.width || f.height !== f0.height) throw new Error(t('led.err.sizeChanged'));
    for (let i = 0; i < rgb.length; i++) rgb[i] += f.rgb[i];
  }
  for (let i = 0; i < rgb.length; i++) rgb[i] /= frames.length;
  return { width: f0.width, height: f0.height, rgb };
}

// ---------------------------------------------------------------- scan lines

/** Bounding box of image points, clipped to the frame. */
export function bbox(f: Frame, pts: Pt[] | null) {
  if (!pts?.length) return { x0: 0, y0: 0, x1: f.width, y1: f.height };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs))), y0: Math.max(0, Math.floor(Math.min(...ys))),
    x1: Math.min(f.width, Math.ceil(Math.max(...xs))), y1: Math.min(f.height, Math.ceil(Math.max(...ys))),
  };
}

/**
 * Scan-line index: row means of the luma inside the region, minus a moving average over
 * `window` rows (removes the slow brightness course), RMS of the rest relative to the
 * mean, in %. Horizontal banding from an unsynchronised refresh raises it; a comparison
 * value for shutter angle and genlock phase, not a standardised figure. Research A.4 item 9.
 */
export function scanLineIndex(f: Frame, region: Pt[] | null = null, window = 0) {
  const { x0, y0, x1, y1 } = bbox(f, region);
  const rows: number[] = [];
  for (let y = y0; y < y1; y++) {
    let s = 0;
    for (let x = x0; x < x1; x++) { const i = (y * f.width + x) * 3; s += KR * f.rgb[i] + KG * f.rgb[i + 1] + KB * f.rgb[i + 2]; }
    rows.push(s / Math.max(1, x1 - x0));
  }
  const n = rows.length, k = Math.max(3, window || Math.round(n / 20)) | 1, half = k >> 1;
  const m = mean(rows);
  if (!(m > 0) || n < k) return { index: NaN, rows };
  let ss = 0, cnt = 0;
  for (let y = half; y < n - half; y++) {
    let s = 0;
    for (let j = -half; j <= half; j++) s += rows[y + j];
    ss += (rows[y] - s / k) ** 2; cnt++;
  }
  return { index: (Math.sqrt(ss / cnt) / m) * 100, rows };
}

// ---------------------------------------------------------------- dead pixels

export interface PixelHit { x: number; y: number; value: number; local: number; kind: 'hell' | 'dunkel' }

/**
 * Outlier pixels: luma differs from the median of its 8 neighbours by more than
 * `threshold` (0–1). Single LEDs are only found when the camera resolves the wall
 * pixels (camera resolution in the crop above the wall resolution).
 */
export function findOutlierPixels(f: Frame, region: Pt[] | null = null, threshold = 0.2, max = 500): PixelHit[] {
  const { x0, y0, x1, y1 } = bbox(f, region);
  const Y = (x: number, y: number) => { const i = (y * f.width + x) * 3; return KR * f.rgb[i] + KG * f.rgb[i + 1] + KB * f.rgb[i + 2]; };
  const hits: PixelHit[] = [], nb = new Array<number>(8);
  for (let y = Math.max(1, y0); y < Math.min(f.height - 1, y1); y++) {
    for (let x = Math.max(1, x0); x < Math.min(f.width - 1, x1); x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) nb[k++] = Y(x + dx, y + dy);
      nb.sort((a, b) => a - b);
      const local = (nb[3] + nb[4]) / 2, v = Y(x, y);
      if (Math.abs(v - local) > threshold) {
        hits.push({ x, y, value: v, local, kind: v > local ? 'hell' : 'dunkel' });
        if (hits.length >= max) return hits;
      }
    }
  }
  return hits;
}

/** Cabinet and wall pixel of an image point (null outside the wall). */
export function locateOnWall(wall: WallConfig, corners: Pt[], x: number, y: number) {
  const inv = invertHomography(wallToImage(wall, corners));
  const [wx, wy] = project(inv, x + 0.5, y + 0.5);
  const c = Math.floor(wx / wall.cabW), r = Math.floor(wy / wall.cabH);
  if (c < 0 || r < 0 || c >= wall.cols || r >= wall.rows) return null;
  return { c, r, label: `C${c + 1}-R${r + 1}`, px: Math.floor(wx), py: Math.floor(wy) };
}

// ---------------------------------------------------------------- before / after, angles

export interface DeltaStat { id: number; label: string; c: number; r: number; before: number; after: number; delta: number }

/** Per cabinet: deviation after minus deviation before (percentage points). */
export function compareResults(before: WallResult, after: WallResult): DeltaStat[] {
  const map = new Map(before.cabinets.map((c) => [c.label, c]));
  return after.cabinets.flatMap((a) => {
    const b = map.get(a.label);
    return b ? [{ id: a.id, label: a.label, c: a.c, r: a.r, before: b.dev, after: a.dev, delta: a.dev - b.dev }] : [];
  });
}

export interface AnglePoint { angle: number; median: number; relative: number; cb: number; cr: number; spread: number }

/** Viewing-angle series: wall median and mean chroma per camera position, relative to the first. */
export function angleSeries(list: { angle: number; result: WallResult }[]): AnglePoint[] {
  const sorted = [...list].sort((a, b) => a.angle - b.angle);
  const ref = sorted.find((x) => x.angle === 0)?.result.wallMedian ?? sorted[0]?.result.wallMedian ?? NaN;
  return sorted.map(({ angle, result }) => ({
    angle, median: result.wallMedian, relative: (result.wallMedian / ref) * 100,
    cb: mean(result.cabinets.map((c) => c.cb)) * 100, cr: mean(result.cabinets.map((c) => c.cr)) * 100, spread: result.spread,
  }));
}

// ---------------------------------------------------------------- camera matrix

/**
 * Camera colour calibration matrix as Epic describes it for ICVFX (UE 5.7, "Camera Color
 * Calibration for In-Camera VFX"): the linearised camera RGB of the red, green and blue
 * wall patches form the columns of F; S = F⁻¹ · W / max(W) with the white patch W;
 * F is scaled column-wise by S, and the calibration matrix is the inverse of the scaled F.
 * Result: row-major 3×3 that maps camera RGB to wall RGB (white → equal channels).
 */
export function cameraMatrix(r: number[], g: number[], b: number[], w: number[]) {
  const F = [r[0], g[0], b[0], r[1], g[1], b[1], r[2], g[2], b[2]];
  const I = inv3(F);
  if (I.some((v) => !Number.isFinite(v))) throw new Error(t('led.err.dependent'));
  const mx = Math.max(...w);
  const wn = w.map((v) => v / mx);
  const S = [0, 1, 2].map((i) => I[i * 3] * wn[0] + I[i * 3 + 1] * wn[1] + I[i * 3 + 2] * wn[2]);
  const Fs = F.map((v, i) => v * S[i % 3]);
  return inv3(Fs);
}

/** OCIO MatrixTransform text (4×4 row-major). */
export function ocioMatrix(m: number[]) {
  const f = (v: number) => Number(v.toPrecision(8));
  return `!<MatrixTransform> {matrix: [${f(m[0])}, ${f(m[1])}, ${f(m[2])}, 0, ${f(m[3])}, ${f(m[4])}, ${f(m[5])}, 0, ${f(m[6])}, ${f(m[7])}, ${f(m[8])}, 0, 0, 0, 0, 1]}`;
}

// ---------------------------------------------------------------- report

const num = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '');
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** CSV report (comma separated, dot decimals, # lines = metadata). */
export function reportCsv(res: WallResult, meta: Record<string, string> = {}, delta: DeltaStat[] | null = null) {
  const w = res.wall;
  const lines = [
    `# ${t('led.csv.head')}`,
    `# ${t('led.csv.date')},${res.date}`,
    `# ${t('led.csv.wall')},${q(w.name)},Cabinet ${w.cabW}x${w.cabH} px,${t('led.csv.grid', { c: w.cols, r: w.rows })},${t('led.csv.module', { w: w.modW, h: w.modH })},${t('led.csv.order', { order: w.order, start: w.start })}`,
    `# Signal,${res.transfer === 'bt709' ? t('led.cam.linearised') : t('led.csv.codeValues')},${t('led.csv.margin', { m: Math.round(res.margin * 100) })},${t('led.csv.captures', { n: res.captures })}`,
    `# ${t('led.csv.corners')},${res.corners.map((p) => `${num(p[0], 1)} ${num(p[1], 1)}`).join(',')}`,
    ...Object.entries(meta).filter(([, v]) => v).map(([k, v]) => `# ${k},${q(v)}`),
    `# ${t('led.res.wallMedian')},${num(res.wallMedian, 5)},${t('led.csv.uniformity')},${num(res.uniformity, 2)},${t('led.res.spreadPct')},${num(res.spread, 2)}`,
    '',
    'id,label,column,row,mean,median,std,deviation_percent,cb,cr,delta_cb_x100,delta_cr_x100,samples' + (delta ? ',before_percent,delta_before_pp' : ''),
    ...res.cabinets.map((c) => {
      const d = delta?.find((x) => x.label === c.label);
      return [c.id, c.label, c.c + 1, c.r + 1, num(c.mean, 5), num(c.median, 5), num(c.std, 5), num(c.dev, 2), num(c.cb, 5), num(c.cr, 5), num(c.dCb, 3), num(c.dCr, 3), c.n,
        ...(delta ? [num(d?.before ?? NaN, 2), num(d?.delta ?? NaN, 2)] : [])].join(',');
    }),
    '',
    'seam,direction,cabinet_a,cabinet_b,contrast_percent',
    ...[...res.seams].sort((a, b) => Math.abs(b.contrast) - Math.abs(a.contrast)).map((s, i) => [i + 1, s.dir === 'v' ? 'vertical' : 'horizontal', s.a, s.b, num(s.contrast, 2)].join(',')),
  ];
  return lines.join('\n') + '\n';
}
