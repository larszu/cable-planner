// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "Farbabgleich" panel (issue #55): measured colour of the panel's source against a colour
// target or against the same object measured in another source (camera matching).

import { barTargets, isLog, ycbcr, type DisplaySpace } from '../color';
import type { Space } from '../deltae';
import type { Rect } from '../renderer';
import type { Source } from '../sources';
import {
  aggregate, cameraText, codes, compare, convertSignal, correctionText, deVerdict, hexLine, swatchCss, targetSignal, type ColorTarget, type Rgb,
} from './core';
import { num, t } from '../i18n';

export interface MatchSettings {
  /** 'target:<name>' (colour target) or 'src:<id>' (reference camera) */
  ref?: string;
  /** series of measurements (effect paints: several spots/angles), signals in `seriesSpace` */
  series?: number[][];
  seriesSpace?: Space;
  /** ΔE up to which the difference counts as "visible side by side" (default 3) */
  tol?: number;
}

export const spaceOf = (s: Source): Space => ({ transfer: s.transfer, gamut: s.gamut, hlgLw: s.hlgLw });

/** What the source measures: mean of the ROI / tracked faces, else the probe pixel. */
export function measure(s: Source): { rgb: Rgb; how: string } | null {
  if (!s.ready) return null;
  if (s.activeRois().length && s.stats?.samples) return { rgb: [...s.stats.rgbAvg] as Rgb, how: t('match.howRoi') };
  if (s.probe) { const rgb = s.readPixel(s.probe.x, s.probe.y); if (rgb) return { rgb, how: t('match.howProbe', { x: s.probe.x, y: s.probe.y }) }; }
  return null;
}

export interface MatchContext {
  targets: ColorTarget[];
  sourceById: (id: string) => Source | null;
  display: DisplaySpace;
}

/** Source side (series mean when a series exists) and reference side, both in the source's encoding. */
export function matchValues(m: MatchSettings, src: Source, c: MatchContext) {
  const sp = spaceOf(src);
  let a: { rgb: Rgb; how: string } | null = measure(src);
  let spread: ReturnType<typeof aggregate> = null;
  if (m.series?.length) {
    const samples = m.series.map((v) => (m.seriesSpace ? convertSignal(v, m.seriesSpace, sp) : (v as Rgb)));
    spread = aggregate(samples, sp);
    if (spread) a = { rgb: spread.mean, how: t('match.howSeries', { n: spread.n }) };
  }
  const ref = m.ref ?? '';
  let b: { rgb: Rgb; name: string; how: string } | null = null;
  if (ref.startsWith('src:')) {
    const o = c.sourceById(ref.slice(4));
    const mb = o ? measure(o) : null;
    if (o && mb) b = { rgb: convertSignal(mb.rgb, spaceOf(o), sp), name: o.name, how: mb.how };
    else if (o) b = null;
  } else if (ref.startsWith('target:')) {
    const tg = c.targets.find((x) => x.name === ref.slice(7));
    if (tg) b = { rgb: targetSignal(tg, sp), name: tg.name, how: tg.ci ? `CI ${tg.ci.interp === 'srgb' ? t('match.howSrgb') : t('match.howVideo')}` : tg.space ? t('match.measured') : t('match.howSignal') };
  }
  return { a, b, spread, sp };
}

/** Redraw key: everything the panel's numbers depend on. */
export function matchSignature(m: MatchSettings | undefined, src: Source, c: MatchContext) {
  const ref = m?.ref ?? '';
  const o = ref.startsWith('src:') ? c.sourceById(ref.slice(4)) : null;
  const st = (s: Source) => `${s.id}:${s.frameSeq}:${s.statsVersion}:${s.probe?.x},${s.probe?.y}:${s.roi?.join(',')}`;
  return `M${st(src)}|${o ? st(o) : ''}|${JSON.stringify(c.targets)}`;
}

const MONO = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
const VERDICT = ['#4ade80', '#facc15', '#f87171'];
const f1 = (v: number) => num(v, 1);
const sg = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), d)}`;

function valueLines(rgb: Rgb, src: Source, sp: Space): string[] {
  const { y } = ycbcr(rgb[0], rgb[1], rgb[2], src.colorspace);
  const c10 = codes(rgb, 10, true);
  return [hexLine(rgb, sp), `10 bit ${c10.join(' ')}  Y′ ${f1(y * 100)} %`];
}

export function drawMatchPanel(ctx: CanvasRenderingContext2D, w: number, h: number, m: MatchSettings | undefined, src: Source, c: MatchContext) {
  const { a, b, spread, sp } = matchValues(m ?? {}, src, c);
  const pad = 10, gap = 10;
  const sw = (w - 2 * pad - gap) / 2, sh = Math.max(36, Math.min(110, h * 0.28));
  ctx.font = MONO; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const side = (x: number, title: string, sub: string, rgb: Rgb | null, empty: string) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, 0, sw, h); ctx.clip();
    sideInner(x, title, sub, rgb, empty);
    ctx.restore();
  };
  const sideInner = (x: number, title: string, sub: string, rgb: Rgb | null, empty: string) => {
    ctx.fillStyle = '#9aa0a8'; ctx.fillText(title, x, pad);
    ctx.fillStyle = '#6b7078'; ctx.fillText(sub, x, pad + 14);
    const y0 = pad + 30;
    if (!rgb) {
      ctx.strokeStyle = '#3a3f46'; ctx.setLineDash([4, 3]); ctx.strokeRect(x + 0.5, y0 + 0.5, sw - 1, sh - 1); ctx.setLineDash([]);
      ctx.fillStyle = '#6b7078'; ctx.fillText(empty, x + 6, y0 + sh / 2 - 6);
      return;
    }
    const sc = swatchCss(rgb, sp, c.display);
    ctx.fillStyle = sc.css; ctx.fillRect(x, y0, sw, sh);
    if (sc.clipped) { ctx.fillStyle = 'rgba(8,9,11,0.7)'; ctx.fillRect(x, y0 + sh - 15, sw, 15); ctx.fillStyle = '#facc15'; ctx.fillText(t('match.clippedSwatch'), x + 4, y0 + sh - 13); }
    ctx.fillStyle = '#d6d6d6';
    valueLines(rgb, src, sp).forEach((l, i) => ctx.fillText(l, x, y0 + sh + 6 + i * 14));
  };
  side(pad, t('match.sourceName', { name: src.name }), a?.how ?? '', a?.rgb ?? null, t('match.setProbeOrRoi'));
  const refName = m?.ref && b ? t(m.ref.startsWith('src:') ? 'match.refName' : 'match.optTarget', { name: b.name }) : t('match.optTarget', { name: '–' });
  side(pad + sw + gap, refName, b?.how ?? '', b?.rgb ?? null, m?.ref?.startsWith('src:') ? t('match.refNeedsProbe') : t('match.chooseTarget'));

  let y = pad + 30 + sh + 40;
  // word-wrapped text line (continuation indented)
  const line = (text: string, col = '#d6d6d6') => {
    ctx.fillStyle = col;
    let rest = text, first = true;
    while (rest && y <= h - 14) {
      const x = pad + (first ? 0 : 12), max = w - x - pad;
      let cut = rest.length;
      while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > max) { const sp = rest.lastIndexOf(' ', cut - 1); cut = sp > 0 ? sp : cut - 1; }
      ctx.fillText(rest.slice(0, cut), x, y); y += 15;
      rest = rest.slice(cut).trimStart(); first = false;
    }
  };
  if (!a || !b) {
    line(c.display === 'p3' ? t('match.swatchP3') : t('match.swatchFor', { display: c.display === 'srgb' ? t('match.srgbDisplay') : c.display }), '#6b7078');
    return;
  }
  const cmp = compare(a.rgb, b.rgb, sp, src.colorspace);
  const v = deVerdict(cmp.de.value, m?.tol ?? 3);
  ctx.font = '600 20px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.fillStyle = VERDICT[v.level];
  ctx.fillText(`${cmp.de.metric} ${num(cmp.de.value, 2)}`, pad, y);
  ctx.font = MONO; ctx.fillStyle = '#9aa0a8';
  ctx.fillText(`${v.text}${cmp.de.metric === 'ΔITP' ? ` ${t('match.itpSteps')}` : ''}`, pad + 170, y + 5);
  y += 28;
  line(`ΔL* ${sg(cmp.dL)}  ΔC* ${sg(cmp.dC)}  ΔH* ${sg(cmp.dH)}  ${t('match.labNote')}`);
  line(t('match.hueSatLine', { h0: f1(cmp.src.deg), h1: f1(cmp.ref.deg), s0: f1(cmp.src.sat * 100), s1: f1(cmp.ref.sat * 100) }));
  if (spread) line(t('match.seriesLine', { n: spread.n, metric: cmp.de.metric, avg: f1(spread.avg), max: f1(spread.max) }), '#9aa0a8');
  y += 4;
  line(t('match.correctionTitle'), '#9aa0a8');
  for (const s of correctionText(cmp, src.colorspace)) line(`· ${s}`);
  for (const s of cameraText(cmp, a.rgb, b.rgb, sp, src.colorspace)) line(`· ${s}`, '#b8bec6');
  if (isLog(sp.transfer)) line(t('match.logNote'), '#6b7078');

  // mini vectorscope with the correction arrow (right of the text when there is room)
  const R = Math.min(90, (h - (pad + 30 + sh + 40)) / 2 - 6);
  if (w > 760 && R > 30) drawMiniVector(ctx, { x: w - pad - 2 * R, y: pad + 30 + sh + 40, w: 2 * R, h: 2 * R }, src, a.rgb, b.rgb);
}

function drawMiniVector(ctx: CanvasRenderingContext2D, r: Rect, src: Source, a: Rgb, b: Rgb) {
  const R = r.w / 2, cx = r.x + R, cy = r.y + R;
  // auto zoom: both points comfortably inside
  const ca = ycbcr(a[0], a[1], a[2], src.colorspace), cb = ycbcr(b[0], b[1], b[2], src.colorspace);
  const maxC = Math.max(Math.hypot(ca.cb, ca.cr), Math.hypot(cb.cb, cb.cr), 0.02);
  const k = (R * 0.85) / Math.min(0.6, maxC * 1.3);
  const pt = (c: { cb: number; cr: number }) => [cx + c.cb * k, cy - c.cr * k] as const;
  ctx.save();
  ctx.strokeStyle = 'rgba(210,190,120,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  ctx.font = '9px ui-monospace, Menlo, monospace'; ctx.fillStyle = 'rgba(230,215,170,0.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const bt of barTargets(src.colorspace, 0.75)) {
    const ang = Math.atan2(bt.cr, bt.cb);
    ctx.fillText(bt.label, cx + Math.cos(ang) * (R - 8), cy - Math.sin(ang) * (R - 8));
  }
  const [ax, ay] = pt(ca), [bx, by] = pt(cb);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 8 * Math.cos(ang - 0.4), by - 8 * Math.sin(ang - 0.4)); ctx.lineTo(bx - 8 * Math.cos(ang + 0.4), by - 8 * Math.sin(ang + 0.4)); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = '#00dcff'; ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#6b7078'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(`×${(0.5 / Math.min(0.6, maxC * 1.3)).toFixed(1)}`, r.x + r.w, r.y + r.h + 10);
  ctx.restore();
}
