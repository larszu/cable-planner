// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Panel "Shading Assistant" (#151): guided sequence, black/flare assistant and the camera data of
// the Touch Shading target, drawn as text on the panel canvas. Figures from guide.ts.

import { baseOf, chainOf } from '../chain';
import { LUMA } from '../color';
import { measureRect, type Rect4 } from '../focus';
import { t, type Key } from '../i18n';
import type { Source } from '../sources';
import { FIELDS } from './model';
import { GUIDE_STEPS, cameraDataRows, evaluateStep, frameStats, progress, type FrameStats, type GuideStep, type Means } from './guide';
import { cameraDataLabels, liveCamera } from './live';

export interface GuideState { step?: GuideStep; done?: string[]; closed?: Means }

const cache = new Map<string, { key: string; area: FrameStats | null; frame: FrameStats | null }>();

/** Measuring frame (centre third without one) and the whole picture, once per frame. */
export function guideMeasure(src: Source) {
  const b = baseOf(src), f = b.cpuFrame();
  if (!f) return null;
  const roi = b.activeRois()[0], sx = f.w / b.width, sy = f.h / b.height;
  const rect: Rect4 = measureRect(roi ? [roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy] : null, f.w, f.h);
  const c = chainOf(src);
  const key = `${b.frameSeq}:${rect.join(',')}:${f.w}:${b.colorspace}:${c?.sig ?? ''}`;
  const hit = cache.get(b.id);
  if (hit?.key === key) return hit;
  const { kr, kb } = LUMA[b.colorspace];
  const decode = c ? ((px: ArrayLike<number>, i: number) => c.apply(f.decode(px, i)) as [number, number, number]) : f.decode;
  // the whole frame with at most ~250 000 samples
  const stride = Math.max(1, Math.round(Math.sqrt((f.w * f.h) / 250_000)));
  const out = { key, area: frameStats(f.px, f.w, decode, kr, kb, rect, stride), frame: frameStats(f.px, f.w, decode, kr, kb, [0, 0, f.w, f.h], stride) };
  cache.set(b.id, out);
  return out;
}

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} %`;

/** Text lines of the panel. */
export function guideLines(src: Source, g: GuideState): string[] {
  const step = g.step ?? 'black', done = g.done ?? [];
  const lines: string[] = [];
  const cam = liveCamera();
  if (cam) {
    lines.push(t('shguide.camera', { n: cam.n, label: cam.label }) + (cam.connected ? '' : ` · ${t('shguide.offline')}`));
    lines.push(cameraDataRows(cam.data, cameraDataLabels()).map(([k, v]) => `${k} ${v}`).join(' · '));
  } else lines.push(t('shguide.noCamera'));
  const pr = progress(done);
  lines.push('', t('shguide.progress', { done: pr.done, total: pr.total }));
  GUIDE_STEPS.forEach((s, i) => lines.push(`${done.includes(s) ? '✓' : s === step ? '▸' : ' '} ${i + 1} ${t(`shguide.step.${s}` as Key)}`));
  lines.push('', t(`shguide.do.${step}` as Key));
  const m = guideMeasure(src);
  const r = evaluateStep(step, m?.area ?? null, m?.frame ?? null, g.closed);
  const v = r.values;
  if (step === 'knee' && v.max !== undefined) lines.push(t('shguide.kneeValues', { max: pct(v.max), clip: (v.clip * 100).toFixed(2) }));
  else if (v.y !== undefined) lines.push(t('shguide.values', { y: pct(v.y), dr: sgn(v.dr), db: sgn(v.db) }));
  if (step === 'flare' && v.dy !== undefined) lines.push(t('shguide.flareValues', { dy: sgn(v.dy), c: (v.chroma * 100).toFixed(2), a: Math.round(v.angle) }));
  if (step === 'flare' && !g.closed) lines.push(t('shguide.needClosed'));
  lines.push(t(`shguide.state.${r.state}` as Key));
  for (const a of r.advice) lines.push(`  ${a.field === 'iris' ? t('shguide.iris') : FIELDS[a.field].label} ${a.dir > 0 ? '↑' : '↓'}`);
  if (pr.done === pr.total) lines.push('', t('shguide.finished'));
  return lines;
}

export function drawGuidePanel(ctx: CanvasRenderingContext2D, g: GuideState, src: Source, w: number, wrap: (ctx: CanvasRenderingContext2D, l: string, maxW: number) => string[]) {
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const lines = guideLines(src, g).flatMap((l) => wrap(ctx, l, w - 24));
  lines.forEach((l, i) => {
    ctx.fillStyle = l.startsWith('✓') ? '#7fd39a' : l.startsWith('▸') ? '#ffd34d' : '#d6d6d6';
    ctx.fillText(l, 12, 10 + i * 15);
  });
}
