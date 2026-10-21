// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Moiré meter in the LED wall dialog (idea 6): grid frequency of the wall from the homography of
// the camera check, 2D spectrum of the grabbed picture inside the wall area, risk display.
// docs/research/moire-meter.md.

import type { Source } from '../sources';
import { bbox, project, wallToImage, type Frame, type Pt } from './analysis';
import { matchesAlias, measureMoire, wallGridFrequency, type MoireMeasurement, type MoireRisk } from './moire';
import type { WallConfig } from './wall';
import { toolHelp } from '../help/scopeHelp';
import { num, t } from '../i18n';
import { button, chip, h, hint, inlineLabel as lab, numberInput, row, select } from '../ui';

export interface MoireHost {
  frame: () => Frame | null;
  corners: () => Pt[];
  wall: () => WallConfig;
  source: () => Source | undefined;
}

const fmt = (v: number, d = 3) => (Number.isFinite(v) ? num(v, d) : '–');
const TONE: Record<MoireRisk, 'ok' | 'warn' | 'bad'> = { resolved: 'ok', colour: 'warn', alias: 'bad' };

/** Log spectrum (DC centred) with the predicted alias marked. */
function drawSpectrum(c: HTMLCanvasElement, m: MoireMeasurement, alias: [number, number] | null) {
  const n = m.size;
  c.width = n; c.height = n;
  const ctx = c.getContext('2d')!, img = ctx.createImageData(n, n);
  let lo = Infinity, hi = -Infinity;
  for (const v of m.spectrum) { if (v > hi) hi = v; if (v < lo) lo = v; }
  lo = Math.max(lo, hi - 5);
  for (let i = 0; i < n * n; i++) {
    const g = Math.round(255 * Math.max(0, Math.min(1, (m.spectrum[i] - lo) / (hi - lo || 1))));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = g; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const mark = (fu: number, fv: number, col: string) => {
    for (const s of [1, -1]) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, n / 256);
      ctx.strokeRect(n / 2 + s * fu * n - n / 64, n / 2 + s * fv * n - n / 64, n / 32, n / 32);
    }
  };
  mark(m.luma.fu, m.luma.fv, '#ffb840');
  if (alias) mark(alias[0], alias[1], '#00dcff');
}

export function moireMeter(host: MoireHost): HTMLElement {
  const box = h('div', { class: 'moire' });
  const out = h('div'), msg = h('span', { class: 'hint', role: 'status' });
  const spec = h('canvas', { class: 'spectrum', width: 128, height: 128 });
  let recW = 0, win = 256;

  function run() {
    const f = host.frame();
    if (!f) { msg.textContent = t('led.grabFirst'); return; }
    msg.textContent = '';
    const s = host.source();
    const width = recW || s?.info?.sourceWidth || s?.width || f.width;
    const scale = f.width / width;
    const corners = host.corners();
    let cx = f.width / 2, cy = f.height / 2, side = Math.min(f.width, f.height);
    const lines: (string | Node)[] = [];
    let alias: [number, number] | null = null, risk: MoireRisk | null = null;
    if (corners.length === 4) {
      const w = host.wall(), g = wallGridFrequency(w, corners, scale);
      // centre of the wall in the picture, the window inside the wall area
      [cx, cy] = project(wallToImage(w, corners), (w.cabW * w.cols) / 2, (w.cabH * w.rows) / 2);
      const b = bbox(f, corners);
      side = Math.min(b.x1 - b.x0, b.y1 - b.y0) * 0.7;
      risk = g.worst.risk;
      // the recording aliases first; its alias in cycles per analysed pixel is what the spectrum shows
      alias = [g.centre.alias[0] / scale, g.centre.alias[1] / scale];
      lines.push(
        h('p', {}, chip(t(`wc.mo.risk.${risk}`), { tone: TONE[risk] }), ' ', t('wc.mo.grid', { f: fmt(g.worst.f), c: fmt(g.centre.f), px: fmt(1 / g.worst.f, 2), w: width })),
        h('p', { class: 'hint' }, risk === 'alias' ? t('wc.mo.aliasAt', { p: fmt(g.worst.aliasPeriod, 1) }) : risk === 'colour' ? t('wc.mo.colourHint') : t('wc.mo.resolvedHint')),
      );
    } else lines.push(h('p', { class: 'hint' }, t('wc.mo.noCorners')));
    const m = measureMoire(f, cx, cy, Math.min(win, side));
    const hit = alias ? matchesAlias(m.luma, alias, 3 / m.size) : false;
    lines.push(
      h('p', {}, t('wc.mo.peak', { f: fmt(m.luma.f), p: fmt(1 / m.luma.f, 1), pct: fmt(m.luma.pct, 2), n: m.size })),
      h('p', {}, t('wc.mo.chroma', { f: fmt(m.chroma.f), pct: fmt(m.chroma.pct, 2) })),
      alias ? h('p', { class: 'hint' }, hit ? t('wc.mo.hit') : t('wc.mo.noHit')) : '',
    );
    drawSpectrum(spec, m, alias);
    out.replaceChildren(...lines, h('div', { class: 'spectrum-wrap' }, spec), hint(t('wc.mo.specHint')));
  }

  box.replaceChildren(
    row(h('b', {}, t('wc.mo.title')), toolHelp('led-moire', t('wc.mo.title'))),
    row(
      lab(t('wc.mo.recW'), numberInput(recW || '', (v) => { recW = Math.max(0, Math.round(v)); }, { title: t('wc.mo.recWTitle'), size: 'l', min: 0, placeholder: t('wc.fl.auto') })),
      lab(t('wc.mo.window'), select(String(win), ['128', '256', '512'].map((v) => [v, `${v} px`] as [string, string]), (v) => { win = Number(v); })),
      button(t('wc.mo.run'), run, { variant: 'primary', title: t('wc.mo.runTitle') }),
      msg),
    out,
    hint(t('wc.mo.hint')),
  );
  return box;
}
