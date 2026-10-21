// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Panel "Drift-Wächter" (#150): black floor and neutral balance of every camera against the
// group mean, during the show. Maths in loop.ts (driftRows).

import { LUMA } from '../color';
import { traceLevels, type TraceLevels } from '../ghost';
import type { Source } from '../sources';
import { DRIFT_DEFAULTS, driftRows } from './loop';
import { num, t } from '../i18n';

export interface DriftSettings {
  /** sources (empty = first eight) */
  sources?: string[];
  /** tolerance in % for black and for the neutral balance */
  tol?: number;
}

const cache = new Map<string, { key: string; l: TraceLevels | null }>();
function levelsOf(s: Source): TraceLevels | null {
  const key = `${s.frameSeq}:${s.statsVersion}:${s.roi?.join(',')}:${s.colorspace}`, hit = cache.get(s.id);
  if (hit?.key === key) return hit.l;
  const { kr, kb } = LUMA[s.colorspace];
  const l = s.ready ? traceLevels(s.roiSamples(15000), kr, kb) : null;
  cache.set(s.id, { key, l });
  return l;
}

const MONO = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v * 100), 1)}`;

export function drawDriftPanel(ctx: CanvasRenderingContext2D, w: number, h: number, d: DriftSettings | undefined, all: Source[], list: Source[], empty: string) {
  ctx.save();
  ctx.font = MONO; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = '#d6d6d6';
  const tol = (d?.tol ?? DRIFT_DEFAULTS.black * 100) / 100;
  const cams = list.map((s) => ({ s, l: levelsOf(s) }));
  const rows = driftRows(cams.filter((c) => c.l).map((c) => ({ id: c.s.id, levels: c.l! })), { black: tol, neutral: tol });
  if (!list.length) { ctx.fillText(empty, 10, 10); ctx.restore(); return; }
  ctx.fillText(t('drift.head', { tol: num(tol * 100, 1) }), 10, 8);
  ctx.fillStyle = '#9a9a9a';
  ctx.fillText(t('drift.cols'), 10, 30);
  cams.forEach(({ s }, i) => {
    const y = 50 + i * 20;
    if (y > h - 10) return;
    const r = rows.find((x) => x.id === s.id);
    const name = `${all.indexOf(s) + 1} ${s.name}`.slice(0, 16).padEnd(16);
    if (!r) { ctx.fillStyle = '#9a9a9a'; ctx.fillText(`${name}  ${t('drift.noPicture')}`, 10, y); return; }
    if (r.alarm) { ctx.fillStyle = 'rgba(248,113,113,0.18)'; ctx.fillRect(6, y - 3, Math.max(0, w - 12), 18); }
    ctx.fillStyle = r.alarm ? '#f87171' : '#4ade80';
    ctx.fillRect(10, y + 3, 8, 8);
    ctx.fillStyle = '#d6d6d6';
    ctx.fillText(`${name}  ${num(r.black * 100, 1).padStart(5)}  ${pct(r.dBlack).padStart(6)}  ${pct(r.dRg).padStart(6)}  ${pct(r.dBg).padStart(6)}  ${r.alarm ? t('drift.alarm') : t('drift.ok')}`, 24, y);
  });
  ctx.restore();
}

export function driftSignature(d: DriftSettings | undefined, list: Source[]) {
  return `D|${list.map((s) => `${s.id}:${s.name}:${s.frameSeq}:${s.statsVersion}:${s.status}:${s.roi?.join(',')}`).join(';')}|${JSON.stringify(d)}`;
}
