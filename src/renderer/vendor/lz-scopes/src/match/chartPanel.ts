// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Panel "Farbtafel-Match" (#149): match matrix patch × camera with ΔE against the reference
// camera, mean/max per camera and a 3×3 matrix suggestion. Maths in chart.ts.

import type { Source } from '../sources';
import type { Pt } from '../led/analysis';
import { grabFrame } from '../led/ui';
import { CLASSIC_24, matchMatrix, patchMedians, suggestMatrix, toPixels, type CameraPatches, type MatrixRow } from './chart';
import { deVerdict } from './core';
import { spaceOf } from './panel';
import { num, t } from '../i18n';

export interface ChartSettings {
  /** sources (empty = first eight) */
  sources?: string[];
  /** chart corners TL, TR, BR, BL per source id, as fractions of the picture */
  corners?: Record<string, Pt[]>;
  /** ΔE tolerance (default 3) */
  tol?: number;
}

export type CornerOrigin = 'clicked' | 'frame' | 'whole';
/** Corners of a source: clicked ones, else the measuring frame, else the whole picture. */
export function chartCorners(s: Source, c: ChartSettings | undefined): { pts: Pt[]; from: CornerOrigin } {
  const k = c?.corners?.[s.id];
  if (k?.length === 4) return { pts: k, from: 'clicked' };
  if (s.roi && s.width && s.height) {
    const [x0, y0, x1, y1] = s.roi, w = s.width, h = s.height;
    return { pts: [[x0 / w, y0 / h], [x1 / w, y0 / h], [x1 / w, y1 / h], [x0 / w, y1 / h]], from: 'frame' };
  }
  return { pts: [[0, 0], [1, 0], [1, 1], [0, 1]], from: 'whole' };
}

// patch medians per source, once per new frame / stats update (a frame copy per source is not free)
const cache = new Map<string, { key: string; at: number; p: CameraPatches }>();
function patchesOf(s: Source, pts: Pt[]): CameraPatches | null {
  if (!s.ready) return null;
  const key = `${pts.flat().join(',')}:${s.transfer}:${s.gamut}:${s.hlgLw}:${s.frameSeq}:${s.statsVersion}`, hit = cache.get(s.id), now = performance.now();
  if (hit && hit.key === key) return hit.p;
  const f = grabFrame(s);
  if (!f) return hit?.p ?? null;
  const p = { id: s.id, space: spaceOf(s), patches: patchMedians(f, toPixels(pts, f.width, f.height), CLASSIC_24) };
  cache.set(s.id, { key, at: now, p });
  return p;
}

const VERDICT = ['#4ade80', '#facc15', '#f87171'];
const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

export function drawChartPanel(ctx: CanvasRenderingContext2D, w: number, h: number, c: ChartSettings | undefined, all: Source[], list: Source[], refId: string | undefined, empty: string) {
  ctx.save();
  ctx.font = MONO; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = '#d6d6d6';
  if (!list.length) { ctx.fillText(empty, 10, 10); ctx.restore(); return; }
  const tol = c?.tol ?? 3;
  const cams = list.map((s) => ({ s, ...chartCorners(s, c), p: null as CameraPatches | null }));
  for (const x of cams) x.p = patchesOf(x.s, x.pts);
  const withData = cams.filter((x) => x.p);
  const ref = withData.find((x) => x.s.id === refId) ?? withData[0];
  if (!ref) { ctx.fillText(t('chart.noData'), 10, 10); ctx.restore(); return; }
  const rows = matchMatrix(withData.map((x) => x.p!), ref.s.id);
  const rowOf = (id: string) => rows.find((r) => r.id === id);
  ctx.fillText(t('chart.head', { ref: ref.s.name, metric: rows[0]?.metric ?? 'ΔE00', tol: num(tol, 1) }), 10, 8);
  // one block per camera: name, mean/max, 6 × 4 cells coloured by verdict, matrix suggestion
  const cellW = Math.max(22, Math.min(46, (w - 20) / 6)), cellH = 16, blockW = cellW * 6 + 16;
  const perRow = Math.max(1, Math.floor((w - 10) / blockW)), blockH = 4 * cellH + 72;
  cams.forEach((x, i) => {
    const bx = 10 + (i % perRow) * blockW, by = 28 + Math.floor(i / perRow) * blockH;
    if (by > h) return;
    const r: MatrixRow | undefined = rowOf(x.s.id);
    ctx.fillStyle = '#d6d6d6';
    const name = `${all.indexOf(x.s) + 1} ${x.s.name}`.slice(0, 18);
    ctx.fillText(x.s.id === ref.s.id ? `${name} · ${t('chart.reference')}` : name, bx, by);
    if (!r) { ctx.fillText(t('chart.noPicture'), bx, by + 16); return; }
    const mean = r.mean ?? 0;
    ctx.fillStyle = VERDICT[deVerdict(mean, tol).level];
    ctx.fillText(t('chart.meanMax', { mean: num(mean, 1), max: num(r.max ?? 0, 1) }) + `  ${t(`chart.from.${x.from}`)}`, bx, by + 14);
    r.de.forEach((d, k) => {
      const cx = bx + (k % 6) * cellW, cy = by + 30 + Math.floor(k / 6) * cellH;
      ctx.fillStyle = d == null ? '#333' : VERDICT[deVerdict(d, tol).level];
      ctx.globalAlpha = 0.85; ctx.fillRect(cx, cy, cellW - 2, cellH - 2); ctx.globalAlpha = 1;
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.fillText(d == null ? '–' : num(d, cellW > 30 ? 1 : 0), cx + (cellW - 2) / 2, cy + 2);
      ctx.textAlign = 'left';
    });
    if (x.s.id !== ref.s.id) {
      const sug = suggestMatrix(x.p!, ref.p!);
      ctx.fillStyle = '#bdbdbd';
      const y = by + 32 + 4 * cellH;
      if (sug) {
        const m = sug.m.map((v) => num(v, 3));
        ctx.fillText(t('chart.matrix', { before: num(sug.before, 1), after: num(sug.after, 1) }), bx, y);
        ctx.fillText(`${m.slice(0, 3).join(' ')} | ${m.slice(3, 6).join(' ')} | ${m.slice(6).join(' ')}`, bx, y + 13);
      } else ctx.fillText(t('chart.noMatrix'), bx, y);
    }
  });
  ctx.restore();
}

export function chartSignature(c: ChartSettings | undefined, list: Source[], refId: string | undefined) {
  return `C|${list.map((s) => `${s.id}:${s.name}:${s.frameSeq}:${s.statsVersion}:${s.status}:${s.roi?.join(',')}`).join(';')}|${JSON.stringify(c)}|${refId ?? ''}`;
}
