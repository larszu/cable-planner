// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "Simulcast deviation" panel (idea 7): heat map of ΔE ITP between two stages of the source's
// chain (src/simulcast.ts), over a grey picture of stage A, with statistics.

import { compileChain, STAGE_LABELS, STAGES, hasChain, type Stage } from './chain';
import { drawTextBox } from './graticule';
import { deviationColour, simulcastMap, type SimulcastMap } from './simulcast';
import type { Source } from './sources';
import { num, t } from './i18n';
import { field, hint, select } from './ui';

export interface SimulcastSettings {
  /** reference stage (the real picture) and compared stage (the converted one) */
  a?: Stage; b?: Stage;
  /** ΔE ITP at the top of the colour scale */
  scale?: number;
  /** share above this value is counted (default 3) */
  limit?: number;
}

const DEF = { a: 'signal' as Stage, b: 'lut' as Stage, scale: 10, limit: 3 };
export const simulcastOf = (s?: SimulcastSettings) => ({ ...DEF, ...s });

/** Recomputed at most 6 times a second per source and setting (CPU work on up to 160×90 cells). */
const cache = new Map<string, { at: number; seq: number; map: SimulcastMap | null; grey: Uint8ClampedArray | null }>();

function compute(src: Source, s: ReturnType<typeof simulcastOf>) {
  const key = `${src.id}|${s.a}|${s.b}|${s.limit}|${compileChain(src, s.a).sig}|${compileChain(src, s.b).sig}`;
  const c = cache.get(key), now = performance.now();
  if (c && (c.seq === src.frameSeq || now - c.at < 160)) return c;
  const f = src.cpuFrame();
  if (!f) return c ?? null;
  const A = compileChain(src, s.a), B = compileChain(src, s.b);
  const sp = (x: typeof A) => ({ apply: x.apply, space: { transfer: x.view.transfer, gamut: x.view.gamut, lw: x.view.lw } });
  const map = simulcastMap(f, sp(A), sp(B), { limit: s.limit });
  // grey picture of stage A on the same grid (signal luma, BT.2020-ish weights are enough for orientation)
  const grey = new Uint8ClampedArray(map.w * map.h);
  for (let j = 0; j < map.h; j++) for (let i = 0; i < map.w; i++) {
    const x = Math.min(f.w - 1, Math.floor(((i + 0.5) * f.w) / map.w)), y = Math.min(f.h - 1, Math.floor(((j + 0.5) * f.h) / map.h));
    const v = A.apply(f.decode(f.px, (y * f.w + x) * 4));
    grey[j * map.w + i] = 255 * Math.max(0, Math.min(1, 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]));
  }
  const out = { at: now, seq: src.frameSeq, map, grey };
  if (cache.size > 16) cache.clear();
  cache.set(key, out);
  return out;
}

let tmp: HTMLCanvasElement | null = null;

/** "after LUT" without a LUT is the CST output: say so. */
const stageLabel = (src: Source, st: Stage) => (st === 'lut' && !src.settings.chain?.lut1 && !src.settings.chain?.lut2 ? STAGE_LABELS.cst : STAGE_LABELS[st]);

export function drawSimulcastPanel(ctx: CanvasRenderingContext2D, w: number, h: number, settings: SimulcastSettings | undefined, src: Source | null, empty: string) {
  const s = simulcastOf(settings);
  const msg = (text: string) => { ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2); };
  if (!src || !src.ready) { msg(src ? (src.message || t('panel.draw.noData')) : empty); return; }
  if (!hasChain(src) || s.a === s.b) { msg(t('sim.noChain')); return; }
  const r = compute(src, s);
  if (!r?.map) { msg(t('panel.draw.noCpu')); return; }
  const { map, grey } = r;
  tmp ??= document.createElement('canvas');
  tmp.width = map.w; tmp.height = map.h;
  const tc = tmp.getContext('2d')!, img = tc.createImageData(map.w, map.h);
  for (let k = 0; k < map.d.length; k++) {
    const g = (grey![k] * 0.45) | 0, [cr, cg, cb, ca] = deviationColour(map.d[k], s.scale), al = ca / 255;
    img.data[k * 4] = g + (cr - g) * al; img.data[k * 4 + 1] = g + (cg - g) * al; img.data[k * 4 + 2] = g + (cb - g) * al; img.data[k * 4 + 3] = 255;
  }
  tc.putImageData(img, 0, 0);
  // picture area with the source's aspect, legend strip below
  const legendH = 18, aspect = src.width / src.height || 16 / 9;
  let pw = w, ph = w / aspect;
  if (ph > h - legendH) { ph = h - legendH; pw = ph * aspect; }
  const px = (w - pw) / 2, py = Math.max(0, (h - legendH - ph) / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, px, py, pw, ph);
  // legend: 1 … scale
  const lx = px, lw = Math.min(pw, 220), ly = py + ph + 4;
  for (let i = 0; i < lw; i++) {
    const v = Math.exp((i / (lw - 1)) * Math.log(s.scale));
    const [cr, cg, cb, ca] = deviationColour(Math.max(1.0001, v), s.scale);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${ca / 255})`; ctx.fillRect(lx + i, ly, 1, 8);
  }
  ctx.fillStyle = '#bbb'; ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(`ΔE ITP 1 … ${s.scale}`, lx + lw + 6, ly - 1);
  const st = map.stats;
  drawTextBox(ctx, px + 6, py + 6, [
    `${stageLabel(src, s.a)} ↔ ${stageLabel(src, s.b)}`,
    t('sim.stats', { mean: num(st.mean, 2), p95: num(st.p95, 2), max: num(st.max, 1) }),
    t('sim.share', { jnd: num(st.overJnd * 100, 1), limit: s.limit, over: num(st.overLimit * 100, 1) }),
    ...(map.scene ? [t('sim.scene')] : []),
  ]);
}

/** ⚙ rows of the panel. */
export function simulcastPanelSettings(p: { simulcast?: SimulcastSettings }, save: () => void): Node[] {
  const s = simulcastOf(p.simulcast);
  const set = (patch: Partial<SimulcastSettings>) => { p.simulcast = { ...p.simulcast, ...patch }; save(); };
  const stages = STAGES.map((st) => [st, STAGE_LABELS[st]] as [string, string]);
  return [
    field(t('sim.a'), select(s.a, stages, (v) => set({ a: v as Stage }), t('sim.aTitle'))),
    field(t('sim.b'), select(s.b, stages, (v) => set({ b: v as Stage }), t('sim.bTitle'))),
    field(t('sim.scale'), select(String(s.scale), ['3', '5', '10', '20', '50'].map((v) => [v, v] as [string, string]), (v) => set({ scale: Number(v) }))),
    field(t('sim.limit'), select(String(s.limit), ['1', '2', '3', '5', '10'].map((v) => [v, v] as [string, string]), (v) => set({ limit: Number(v) }), t('sim.limitTitle'))),
    hint(t('sim.hint')),
  ];
}
