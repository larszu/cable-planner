// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "Lens fingerprint" panel (idea 9): live white shading of a flat white field (src/lensShading.ts on the core src/surface.ts),
// saved per lens and zoom position (src/lensprint.ts) and compared after a lens change.

import { comparePrints, loadPrints, nearestZoom, printId, printOf, rankPrints, savePrints, storePrint, TERMS, type Ch, type LensPrint } from './lensprint';
import { shadingFit, shadingGrid, type ShadingFit } from './lensShading';
import type { Source } from './sources';
import { num, t } from './i18n';
import { button, checkbox, download, field, filePicker, hint, numberInput, row, select, textInput } from './ui';

export interface LensSettings {
  lens?: string; zoom?: number;
  /** linearise with the inverse BT.709 OETF (camera gamma on) or read code values (gamma off, as for shading) */
  linear?: boolean;
  /** stored print to compare with: '' = automatic (same lens, nearest zoom; else the most similar) */
  ref?: string;
}

const cache = new Map<string, { at: number; seq: number; fit: ShadingFit | null }>();

/** Live shading of the source (ROI if set), at most 4 times a second. */
export function liveShading(src: Source, linear: boolean): ShadingFit | null {
  const key = `${src.id}|${linear}|${src.roi?.join(',') ?? ''}`, c = cache.get(key), now = performance.now();
  if (c && (c.seq === src.frameSeq || now - c.at < 250)) return c.fit;
  const f = src.cpuFrame();
  if (!f) return c?.fit ?? null;
  const region: [number, number, number, number] = src.roi && src.width ? [src.roi[0] / src.width, src.roi[1] / src.height, src.roi[2] / src.width, src.roi[3] / src.height] : [0, 0, 1, 1];
  const fit = shadingFit(shadingGrid(f, 16, 9, region, linear));
  if (cache.size > 8) cache.clear();
  cache.set(key, { at: now, seq: src.frameSeq, fit });
  return fit;
}

/** The stored print to compare with, and why it was chosen. */
export function referenceOf(s: LensSettings, live: LensPrint, prints = loadPrints()): { p: LensPrint; how: 'chosen' | 'zoom' | 'similar' } | null {
  if (s.ref) { const p = prints.find((x) => printId(x) === s.ref); return p ? { p, how: 'chosen' } : null; }
  if (s.lens) { const p = nearestZoom(prints, s.lens, s.zoom ?? 0); if (p) return { p, how: 'zoom' }; }
  const r = rankPrints(live, prints)[0];
  return r ? { p: r.p, how: 'similar' } : null;
}

const CH: Ch[] = ['r', 'g', 'b'];
const CH_COL: Record<Ch, string> = { r: '#ff7b6b', g: '#7be08a', b: '#7ba8ff' };
/** signed value; what rounds to 0 shows as 0 (no −0.0) */
const signed = (v: number, d = 1) => { if (!Number.isFinite(v)) return '–'; const r = Number(v.toFixed(d)); return r === 0 ? num(0, d) : `${r > 0 ? '+' : ''}${num(r, d)}`; };

export function drawLensPanel(ctx: CanvasRenderingContext2D, w: number, h: number, s: LensSettings | undefined, src: Source | null, empty: string) {
  const st = s ?? {};
  const msg = (text: string) => { ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2); };
  if (!src || !src.ready) { msg(src ? (src.message || t('panel.draw.noData')) : empty); return; }
  const fit = liveShading(src, !!st.linear);
  if (!fit) { msg(t('panel.draw.noCpu')); return; }
  const live = printOf(st.lens || '?', st.zoom ?? 0, fit, !!st.linear);
  const ref = referenceOf(st, live), d = ref ? comparePrints(live, ref.p) : null;
  // layout: map left (or top when narrow), table right (or below)
  const narrow = w < 520;
  const mw = narrow ? w - 16 : Math.min(w * 0.45, (h - 40) * (16 / 9)), mh = mw * (9 / 16);
  const cw = mw / fit.nx, chh = mh / fit.ny;
  for (let j = 0; j < fit.ny; j++) for (let i = 0; i < fit.nx; i++) {
    const v = fit.map[j * fit.nx + i], a = Math.max(-1, Math.min(1, v / 10)), m = Math.abs(a);
    const base = [70, 72, 78], hot = a > 0 ? [235, 120, 60] : [70, 130, 235];
    ctx.fillStyle = `rgb(${base.map((b, k) => Math.round(b + (hot[k] - b) * m)).join(',')})`;
    ctx.fillRect(8 + i * cw, 8 + j * chh, Math.ceil(cw), Math.ceil(chh));
  }
  ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillStyle = '#bbb';
  ctx.fillText(t('lens.mapCaption'), 8, 12 + mh);
  // table
  let x = narrow ? 8 : 24 + mw, y = narrow ? 30 + mh : 8;
  const col = [x, x + 20, x + 82, x + 144, x + 206, x + 268];
  const said: string[] = [];
  const rowText = (cells: string[], colour = '#d6d6d6') => {
    ctx.fillStyle = colour; cells.forEach((c, k) => { if (col[k] < w - 4) ctx.fillText(c, col[k], y); });
    said.push(cells.join(' ')); y += 15;
  };
  ctx.font = '11px ui-monospace, Menlo, monospace';
  rowText(['', t('lens.sawH'), t('lens.sawV'), t('lens.parH'), t('lens.parV'), t('lens.rest')], '#9aa0a8');
  for (const c of CH) { const v = fit[c]; rowText([c.toUpperCase(), signed(v.sawH), signed(v.sawV), signed(v.parH), signed(v.parV), num(v.rest, 2)], CH_COL[c]); }
  rowText([t('lens.centre', { rg: num(live.rg, 3), bg: num(live.bg, 3) })], '#d6d6d6');
  y += 6;
  if (ref && d) {
    rowText([t(`lens.ref.${ref.how}`, { lens: ref.p.lens, zoom: num(ref.p.zoom, 0), date: ref.p.date.slice(0, 10) })], '#9aa0a8');
    for (const c of CH) rowText([`Δ${c.toUpperCase()}`, ...TERMS.map((tm) => signed(d.terms[c][tm]))], CH_COL[c]);
    rowText([t('lens.dCentre', { rg: signed(d.dRg, 2), bg: signed(d.dBg, 2) })]);
    rowText([t('lens.worst', { ch: d.worst.ch.toUpperCase(), term: t(`lens.${d.worst.term}`), pp: signed(d.worst.pp) })], Math.abs(d.worst.pp) > 2 ? '#f0c24b' : '#6fd08c');
  } else rowText([t('lens.noRef')], '#9aa0a8');
  ctx.canvas.setAttribute('aria-label', said.join('; '));
}

/** ⚙ rows: lens, zoom, signal, store, reference, import/export. */
export function lensPanelSettings(p: { lens?: LensSettings; sourceId?: string }, save: () => void, src: () => Source | null, refresh: () => void): Node[] {
  const s = p.lens ?? {};
  const set = (patch: Partial<LensSettings>) => { p.lens = { ...p.lens, ...patch }; save(); };
  const prints = loadPrints();
  const imp = filePicker('.json,application/json', async ([f]) => {
    try {
      const list = JSON.parse(await f.text()) as LensPrint[];
      if (Array.isArray(list)) { for (const x of list) if (x?.lens && x.r && x.g && x.b) storePrint(x); refresh(); }
    } catch { /* not a fingerprint file */ }
  });
  return [
    field(t('lens.lens'), textInput(s.lens ?? '', (v) => { set({ lens: v.trim() || undefined }); refresh(); }, { placeholder: t('lens.lensPh') })),
    field(t('lens.zoom'), numberInput(s.zoom ?? '', (v) => set({ zoom: v }), { title: t('lens.zoomTitle'), size: 'l', step: 'any' })),
    field(t('lens.signal'), checkbox(!!s.linear, t('lens.linear'), (v) => set({ linear: v }), t('lens.linearTitle'))),
    row(button(t('lens.store'), () => {
      const cur = p.lens ?? {}, sr = src(), fit = sr ? liveShading(sr, !!cur.linear) : null;
      if (!fit || !cur.lens) return;
      storePrint(printOf(cur.lens, cur.zoom ?? 0, fit, !!cur.linear)); refresh();
    }, { variant: 'primary', title: t('lens.storeTitle'), disabled: !s.lens })),
    field(t('lens.compare'), select(s.ref ?? '', [['', t('lens.auto')], ...prints.map((x) => [printId(x), `${x.lens} @ ${num(x.zoom, 0)} · ${x.date.slice(0, 10)}`] as [string, string])], (v) => set({ ref: v || undefined }))),
    row(
      button(t('lens.delete'), () => { if (s.ref) { savePrints(prints.filter((x) => printId(x) !== s.ref)); set({ ref: undefined }); refresh(); } }, { small: true, disabled: !s.ref }),
      button(t('lens.export'), () => download('lz-scopes-lens-fingerprints.json', JSON.stringify(prints, null, 1), 'application/json'), { small: true, disabled: !prints.length }),
      button(t('lens.import'), () => imp.pick(), { small: true }), imp.input),
    hint(t('lens.hint')),
  ];
}
