// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Shutter / refresh-rate finder in the LED wall dialog (idea 5): records the row profile of the
// wall area for N consecutive camera frames, analyses it (flicker.ts) and suggests exposures of
// whole flicker cycles. docs/research/shutter-finder.md.

import type { Source } from '../sources';
import { analyseFlicker, shutterCheck, shutterOptions, type FlickerResult, type ProfileFrame } from './flicker';
import { toolHelp } from '../help/scopeHelp';
import { num, t } from '../i18n';
import { button, h, hint, inlineLabel as lab, numberInput, row, select, table } from '../ui';

const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;

/** Region as fractions of the picture (x0, y0, x1, y1); null = whole picture. */
export type RegionFrac = [number, number, number, number] | null;

let cropCanvas: HTMLCanvasElement | null = null;

/** Mean luma per picture row of the region, straight from the source (raw frame or element). */
export function rowProfileOf(s: Source, region: RegionFrac): Float64Array | null {
  if (!s.ready) return null;
  const [fx0, fy0, fx1, fy1] = region ?? [0, 0, 1, 1];
  const x0 = Math.max(0, Math.floor(fx0 * s.width)), x1 = Math.min(s.width, Math.ceil(fx1 * s.width));
  const y0 = Math.max(0, Math.floor(fy0 * s.height)), y1 = Math.min(s.height, Math.ceil(fy1 * s.height));
  if (x1 - x0 < 2 || y1 - y0 < 16) return null;
  const rows = new Float64Array(y1 - y0);
  if (s.data) {
    const dec = s.decoder(), step = Math.max(1, Math.floor((x1 - x0) / 512));
    for (let y = y0; y < y1; y++) {
      let sum = 0, n = 0;
      for (let x = x0; x < x1; x += step) { const c = dec(s.data, (y * s.width + x) * 4); sum += KR * c[0] + KG * c[1] + KB * c[2]; n++; }
      rows[y - y0] = sum / n;
    }
    return rows;
  }
  if (!s.element) return null;
  // element: crop at full row resolution, at most 256 columns
  const w = Math.min(256, x1 - x0), hh = y1 - y0;
  cropCanvas ??= document.createElement('canvas');
  if (cropCanvas.width !== w || cropCanvas.height !== hh) { cropCanvas.width = w; cropCanvas.height = hh; }
  const ctx = cropCanvas.getContext('2d', { willReadFrequently: true })!;
  try { ctx.drawImage(s.element, x0, y0, x1 - x0, hh, 0, 0, w, hh); } catch { return null; }
  const d = ctx.getImageData(0, 0, w, hh).data;
  for (let y = 0; y < hh; y++) {
    let sum = 0;
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; sum += KR * d[i] + KG * d[i + 1] + KB * d[i + 2]; }
    rows[y] = sum / w / 255;
  }
  return rows;
}

/** Record n consecutive frames (waits for each new frame, gives up after 1 s without one). */
export async function recordProfiles(s: Source, n: number, region: RegionFrac, onProgress?: (i: number) => void): Promise<ProfileFrame[]> {
  const out: ProfileFrame[] = [];
  let seq = s.frameSeq;
  while (out.length < n) {
    const t0 = performance.now();
    while (s.frameSeq === seq && performance.now() - t0 < 1000) await new Promise((r) => setTimeout(r, 2));
    if (s.frameSeq === seq) break;
    seq = s.frameSeq;
    const rows = rowProfileOf(s, region);
    if (!rows || (out.length && rows.length !== out[0].rows.length)) break;
    out.push({ rows, seq, t: performance.now() });
    onProgress?.(out.length);
  }
  return out;
}

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? num(v, d) : '–');
/** 1/x denominators: whole numbers without decimals (1/100 s, 1/33.33 s) */
const den = (v: number) => fmt(v, Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2);

/** Streak image: relative row profile (rows down, frames across), grey ±range. */
function drawStreak(c: HTMLCanvasElement, frames: ProfileFrame[]) {
  const N = frames.length, L = frames[0].rows.length;
  const mean = new Float64Array(L);
  for (const f of frames) for (let y = 0; y < L; y++) mean[y] += f.rows[y] / N;
  c.width = N; c.height = Math.min(L, 720);
  const ctx = c.getContext('2d')!, img = ctx.createImageData(N, c.height);
  let peak = 1e-6;
  const rel = frames.map((f) => Array.from({ length: c.height }, (_, j) => { const y = Math.floor((j * L) / c.height); const v = mean[y] > 1e-6 ? f.rows[y] / mean[y] - 1 : 0; peak = Math.max(peak, Math.abs(v)); return v; }));
  for (let x = 0; x < N; x++) for (let j = 0; j < c.height; j++) {
    const g = Math.round(128 + 127 * (rel[x][j] / peak)), i = (j * N + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export interface FlickerHost {
  source: () => Source | undefined;
  region: () => RegionFrac;
}

/** The finder's controls and result; rebuilt by the caller with the camera section. */
export function flickerFinder(host: FlickerHost): HTMLElement {
  const box = h('div', { class: 'flicker' });
  const msg = h('span', { class: 'hint', role: 'status' });
  const out = h('div');
  const streak = h('canvas', { class: 'streak', width: 64, height: 64 });
  let n = 64, refresh = 0, readout = 0, fps = 0, angle = 180;
  let last: { r: FlickerResult; frames: ProfileFrame[] } | null = null;

  const presets: [string, string][] = [['', t('wc.fl.preset')], ...[100, 120, 400, 960, 1920, 3840, 7680].map((v) => [String(v), `${v} Hz`] as [string, string])];
  const refreshIn = numberInput(refresh, (v) => { refresh = Math.max(0, v); show(); }, { title: t('wc.fl.refreshTitle'), size: 'l', step: 'any', min: 0 });

  async function run() {
    const s = host.source();
    if (!s) { msg.textContent = t('led.cam.noSource'); return; }
    if (!fps) fps = s.info?.sourceFps ?? (s.nominalFps || 0);
    msg.textContent = t('wc.fl.recording', { i: 0, n });
    const frames = await recordProfiles(s, n, host.region(), (i) => { if (i % 8 === 0) msg.textContent = t('wc.fl.recording', { i, n }); });
    if (frames.length < 8) { msg.textContent = t('wc.fl.tooFew'); return; }
    last = { r: analyseFlicker(frames, opts(s)), frames };
    msg.textContent = '';
    drawStreak(streak, frames);
    show();
  }
  const opts = (s?: Source) => ({ fps: fps || undefined, refreshHz: refresh || undefined, readoutMs: readout || undefined, height: s?.height });

  function show() {
    if (!last) { out.replaceChildren(); return; }
    const r = analyseFlicker(last.frames, opts(host.source()));
    last.r = r;
    const lines: string[] = [
      t('wc.fl.rate', { fs: fmt(r.fs, 2), meas: fmt(r.measuredFs, 2), n: r.frames, miss: r.missing }),
      t('wc.fl.bands', { pct: fmt(r.bandPct, 2), period: fmt(1 / r.ky, 1), alias: fmt(Math.abs(r.alias), 2), dir: r.alias > 0.05 ? t('wc.fl.up') : r.alias < -0.05 ? t('wc.fl.down') : t('wc.fl.still') }),
      t('wc.fl.pump', { pct: fmt(r.pumpPct, 2), hz: fmt(r.pumpHz, 2) }),
      t('wc.fl.static', { pct: fmt(r.staticPct, 2), period: fmt(1 / r.staticKy, 1) }),
    ];
    if (r.missing > 0 || (fps && Math.abs(r.measuredFs / fps - 1) > 0.05)) lines.push(t('wc.fl.dropWarn'));
    if (r.fSource === 'given') {
      lines.push(t('wc.fl.given', { f: fmt(r.f, 0), pred: fmt(r.predictedAlias, 2), ok: r.consistent ? t('wc.fl.fits') : t('wc.fl.fitsNot') }));
      if (Number.isFinite(r.readoutMs)) lines.push(t('wc.fl.readout', { line: fmt(r.lineUs, 2), ms: fmt(r.readoutMs, 2) }));
    } else if (r.fSource === 'readout') lines.push(t('wc.fl.fromReadout', { f: fmt(r.f, 0), fs: fmt(r.fs, 2) }));
    else lines.push(t('wc.fl.candidates', { list: r.candidates.map((c) => fmt(c, 1)).join(' · ') }));
    const F = r.fs;
    const opts2 = Number.isFinite(r.f) ? shutterOptions(r.f, F) : [];
    const cur = Number.isFinite(r.f) && F > 0 ? shutterCheck(r.f, angle / 360 / F) : null;
    out.replaceChildren(
      ...lines.map((l) => h('p', { class: 'hint' }, l)),
      cur ? h('p', {}, t('wc.fl.current', { angle: fmt(angle, 1), x: den((360 * F) / angle), cycles: fmt(cur.cycles, 2), resp: fmt(cur.response * 100, 1) })) : '',
      opts2.length ? h('div', { class: 'table-wrap' }, table(opts2.map((o) => [`1/${den(o.oneOver)} s`, `${fmt(o.angle, 1)}°`, String(o.cycles)]), { head: [t('wc.fl.exposure'), t('wc.fl.angle'), t('wc.fl.cycles')], cls: 'num-table' })) : '',
      h('div', { class: 'cam-wrap' }, streak),
      hint(t('wc.fl.streakHint')),
    );
  }

  box.replaceChildren(
    row(h('b', {}, t('wc.fl.title')), toolHelp('led-flicker', t('wc.fl.title'))),
    row(
      lab(t('wc.fl.frames'), select(String(n), ['32', '64', '128', '256'].map((v) => [v, v] as [string, string]), (v) => { n = Number(v); })),
      lab(t('wc.fl.fps'), numberInput(fps || '', (v) => { fps = Math.max(0, v); show(); }, { title: t('wc.fl.fpsTitle'), size: 'l', step: 'any', min: 0, placeholder: t('wc.fl.auto') })),
      lab(t('wc.fl.refresh'), refreshIn, select('', presets, (v) => { if (v) { refresh = Number(v); refreshIn.value = v; show(); } }, t('wc.fl.presetTitle'))),
      lab(t('wc.fl.readoutIn'), numberInput(readout || '', (v) => { readout = Math.max(0, v); show(); }, { title: t('wc.fl.readoutTitle'), size: 'm', step: 'any', min: 0, placeholder: '–' })),
      lab(t('wc.fl.angleIn'), numberInput(angle, (v) => { angle = Math.min(360, Math.max(1, v)); show(); }, { title: t('wc.fl.angleTitle'), size: 'm', step: 'any', min: 1, max: 360 })),
      button(t('wc.fl.run'), run, { variant: 'primary', title: t('wc.fl.runTitle') }),
      msg),
    out,
    hint(t('wc.fl.hint')),
  );
  return box;
}
