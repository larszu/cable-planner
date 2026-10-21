// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// LED wall tool (#10): wall configuration, LED test patterns and the camera-based check,
// as one dialog of the main window. The wall itself is calibrated by its processor
// (Brompton Tessera, NovaStar NovaLCT/NovaCLB, Colorlight) – the dialog says so.

import type { Source } from '../sources';
import {
  analyseWall, angleSeries, cameraMatrix, compareResults, findOutlierPixels, locateOnWall, ocioMatrix, project,
  reportCsv, scanLineIndex, wallToImage, bbox, type CameraTransfer, type DeltaStat, type Frame, type PixelHit, type Pt, type WallResult,
} from './analysis';
import { LED_PATTERNS } from './patterns';
import {
  PATCH_PRESETS, PROCESSOR_LABELS, cabinets, deleteWall, ledSettings, parsePatchList, pictureSize, saveWall, savedWalls, setLedSettings, wallSize,
  type LedSettings, type WallConfig,
} from './wall';
import { bt709InverseOetf } from '../color';
import { mountMeterCheck } from './oppleUi';
import { flickerFinder, type RegionFrac } from './flickerUi';
import { moireMeter } from './moireUi';
import type { PointStat } from './oppleCheck';
import { lang, num, t } from '../i18n';
import { button, checkbox, disclosure, download, h, hint, inlineLabel as lab, modal, numberInput, row, select as sel, table, textInput, type Kid, type Modal } from '../ui';

/** Table of figures (right-aligned, tabular), scrolled inside .table-wrap on phones. */
const numTable = (head: Kid[] | undefined, rows: Kid[][]) => table(rows, { head, cls: 'num-table' });

export interface LedHost {
  sources: () => Source[];
  /** show an LED pattern at w×h in a pattern source and open the output window */
  showPattern: (id: string, w: number, h: number) => void;
  /** LED settings changed: redraw pattern sources that show LED patterns */
  patternsChanged: () => void;
}

const fmt = (v: number, d = 1) => (Number.isFinite(v) ? num(v, d) : '–');
const locale = () => (lang() === 'de' ? 'de-DE' : 'en-GB');
const signed = (v: number, d = 1) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${fmt(v, d)}` : '–');

/** Copy the current frame of a source into an RGB float frame (at most 3840 px wide). */
export function grabFrame(s: Source): Frame | null {
  if (!s.ready) return null;
  if (s.data) {
    const scale = s.depth === 16 ? 65535 : 255, st = Math.max(1, Math.ceil(s.width / 3840));
    const w = Math.floor(s.width / st), hh = Math.floor(s.height / st), rgb = new Float32Array(w * hh * 3);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      const i = (y * st * s.width + x * st) * 4, o = (y * w + x) * 3;
      rgb[o] = s.data[i] / scale; rgb[o + 1] = s.data[i + 1] / scale; rgb[o + 2] = s.data[i + 2] / scale;
    }
    return { width: w, height: hh, rgb };
  }
  if (!s.element) return null;
  const w = Math.min(3840, s.width), hh = Math.round((s.height * w) / s.width);
  const c = h('canvas', { width: w, height: hh });
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(s.element, 0, 0, w, hh);
  const d = ctx.getImageData(0, 0, w, hh).data, rgb = new Float32Array(w * hh * 3);
  for (let i = 0, o = 0; i < d.length; i += 4, o += 3) { rgb[o] = d[i] / 255; rgb[o + 1] = d[i + 1] / 255; rgb[o + 2] = d[i + 2] / 255; }
  return { width: w, height: hh, rgb };
}

/** Grab n frames (waiting for new frames of the source) and average them. */
async function grabAveraged(s: Source, n: number): Promise<Frame | null> {
  let sum: Frame | null = null, got = 0, seq = -1;
  for (let k = 0; k < n; k++) {
    const t0 = performance.now();
    while (s.frameSeq === seq && performance.now() - t0 < 600) await new Promise((r) => setTimeout(r, 15));
    seq = s.frameSeq;
    const f = grabFrame(s);
    if (!f) break;
    if (!sum) sum = { ...f, rgb: new Float32Array(f.rgb) };
    else if (f.width === sum.width && f.height === sum.height) for (let i = 0; i < f.rgb.length; i++) sum.rgb[i] += f.rgb[i];
    else break;
    got++;
  }
  if (!sum || !got) return null;
  if (got > 1) for (let i = 0; i < sum.rgb.length; i++) sum.rgb[i] /= got;
  return sum;
}

/** Diverging colour for a deviation: blue (darker) – grey – red (brighter). */
function heatColor(v: number, range: number) {
  if (!Number.isFinite(v)) return '#333';
  const t = Math.max(-1, Math.min(1, v / range)), a = Math.abs(t);
  const base = [60, 62, 66], hot = t > 0 ? [230, 70, 50] : [60, 120, 235];
  return `rgb(${base.map((b, i) => Math.round(b + (hot[i] - b) * a)).join(',')})`;
}

let open: Modal | null = null;

export function openLedTool(host: LedHost) {
  if (open) { open.open(); return; }
  // long settings and a running check: no close by a stray click next to the dialog
  const dlg = modal({ title: t('led.title'), cls: 'ledtool', size: 'xl', sticky: true });
  open = dlg;

  let s = ledSettings();
  const set = (patch: Partial<LedSettings>) => { s = setLedSettings(patch); host.patternsChanged(); };
  const setWall = (patch: Partial<WallConfig>) => { set({ wall: { ...s.wall, ...patch } }); renderWall(); };

  // ------------------------------------------------ wall
  const wallBox = h('div');
  function renderWall() {
    const w = s.wall, ws = wallSize(w), ps = pictureSize(w);
    const walls = savedWalls();
    wallBox.replaceChildren(
      row(
        lab('Name', textInput(w.name, (v) => setWall({ name: v }))),
        walls.length ? sel('', [['', t('led.wall.saved')], ...walls.map((x) => [x.name, x.name] as [string, string])], (v) => { const x = walls.find((y) => y.name === v); if (x) setWall(x); }) : '',
        button(t('led.save'), () => { saveWall(s.wall); renderWall(); }),
        walls.some((x) => x.name === w.name) && button(t('led.delete'), () => { deleteWall(w.name); renderWall(); })),
      row(
        lab(t('led.wall.cabinetPx'), numberInput(w.cabW, (n) => setWall({ cabW: n }), { title: t('led.wall.cabWTitle'), size: 'l' }), '×', numberInput(w.cabH, (n) => setWall({ cabH: n }), { title: t('led.wall.cabHTitle'), size: 'l' })),
        lab(t('led.wall.colsRows'), numberInput(w.cols, (n) => setWall({ cols: n }), { title: t('led.wall.colsTitle'), size: 's' }), '×', numberInput(w.rows, (n) => setWall({ rows: n }), { title: t('led.wall.rowsTitle'), size: 's' })),
        lab(t('led.wall.module'), numberInput(w.modW, (n) => setWall({ modW: n }), { title: t('led.wall.modWTitle'), size: 's' }), '×', numberInput(w.modH, (n) => setWall({ modH: n }), { title: t('led.wall.modHTitle'), size: 's' }))),
      row(
        lab(t('led.wall.offset'), numberInput(w.offX, (n) => setWall({ offX: n }), { title: t('led.wall.offXTitle'), size: 'l' }), numberInput(w.offY, (n) => setWall({ offY: n }), { title: t('led.wall.offYTitle'), size: 'l' })),
        lab(t('led.wall.processor'), sel(w.processor, Object.entries(PROCESSOR_LABELS) as [string, string][], (v) => setWall({ processor: v as WallConfig['processor'] }), t('led.wall.processorTitle'))),
        lab(t('led.wall.order'), sel(w.order, [['rows', t('led.wall.byRows')], ['cols', t('led.wall.byCols')], ['snake', t('led.wall.snake')]], (v) => setWall({ order: v as WallConfig['order'] })),
          t('led.wall.from'), numberInput(w.start, (n) => setWall({ start: n }), { title: t('led.wall.startTitle'), size: 's' })),
        h('span', { class: 'hint' }, t('led.wall.summary', { ww: ws.w, wh: ws.h, pw: ps.w, ph: ps.h, n: w.cols * w.rows }))),
    );
  }

  // ------------------------------------------------ patterns
  const patBox = h('div');
  let patId = 'led-cabinet-grid';
  function renderPatterns() {
    const p = s.patch, ps = pictureSize(s.wall);
    const listText = h('textarea', { title: t('led.pat.listTitle') }, p.list.map((c) => c.map((v) => Number(v.toFixed(4))).join(' ')).join('\n'));
    listText.onchange = () => { const l = parsePatchList(listText.value); if (l.length) { set({ patch: { ...p, list: l, index: 0 } }); renderPatterns(); } };
    const code = Math.round((s.level / 100) * 255);
    patBox.replaceChildren(
      row(
        sel(patId, LED_PATTERNS.map((x) => [x.id, x.name] as [string, string]), (v) => { patId = v; }),
        button(t('led.pat.show', { w: ps.w, h: ps.h }), () => host.showPattern(patId, ps.w, ps.h), { variant: 'primary', title: t('led.pat.showTitle', { w: ps.w, h: ps.h }) })),
      row(
        lab(t('led.pat.level'), numberInput(s.level, (n) => { set({ level: n }); renderPatterns(); }, { title: t('led.pat.levelTitle'), step: '0.5', size: 'l' }), h('span', { class: 'hint' }, `= ${t('led.pat.code', { code })}`)),
        ...(['R', 'G', 'B'] as const).map((c, i) => checkbox(s.channels[i], c, (on) => { const ch = [...s.channels] as LedSettings['channels']; ch[i] = on; set({ channels: ch }); })),
        lab(t('led.pat.gridEvery'), numberInput(s.gridStep, (n) => set({ gridStep: n }), { title: t('led.pat.gridTitle'), size: 's' }), 'px'),
        lab(t('led.pat.lowMax'), numberInput(s.lowMax, (n) => set({ lowMax: n }), { title: t('led.pat.lowMaxTitle'), size: 's' })),
        lab('Scroll', sel(s.scroll, [['h', t('led.pat.horizontal')], ['v', t('led.pat.vertical')]], (v) => set({ scroll: v as 'h' | 'v' })))),
      hint(t('led.pat.canvasHint')),
      row(
        h('b', {}, t('led.pat.sequencer')),
        lab(t('led.pat.window'), sel(String(p.window), ['1', '4', '10', '25', '100'].map((v) => [v, `${v} %`] as [string, string]), (v) => set({ patch: { ...p, window: Number(v) } }))),
        lab(t('led.pat.surround'), numberInput(p.surround, (n) => set({ patch: { ...p, surround: n } }), { title: t('led.pat.surroundTitle'), size: 's' })),
        sel('', [['', t('led.pat.loadSet')], ...PATCH_PRESETS.map((x) => [x.id, x.name] as [string, string])], (v) => {
          const pr = PATCH_PRESETS.find((x) => x.id === v); if (pr) { set({ patch: { ...p, list: pr.list(), index: 0 } }); renderPatterns(); }
        })),
      row(
        listText,
        h('div', {},
          row(
            button('◀', () => { set({ patch: { ...p, index: (p.index - 1 + p.list.length) % p.list.length } }); renderPatterns(); }, { small: true }),
            h('span', {}, t('led.pat.patch', { i: Math.min(p.index, p.list.length - 1) + 1, n: p.list.length, rgb: p.list[Math.min(p.index, p.list.length - 1)].map((v) => Math.round(v * 255)).join(' ') })),
            button('▶', () => { set({ patch: { ...p, index: (p.index + 1) % p.list.length } }); renderPatterns(); }, { small: true })),
          row(
            checkbox(p.auto, t('led.pat.auto'), (on) => set({ patch: { ...p, auto: on } })),
            lab(t('led.pat.each'), numberInput(p.seconds, (n) => set({ patch: { ...p, seconds: n } }), { title: t('led.pat.secondsTitle'), step: '0.5' }), 's'),
            checkbox(p.label, t('led.pat.label'), (on) => set({ patch: { ...p, label: on } }))),
          hint(t('led.pat.seqHint')))),
    );
  }

  // ------------------------------------------------ camera check
  let frame: Frame | null = null, corners: Pt[] = [], result: WallResult | null = null, before: WallResult | null = null;
  let hits: PixelHit[] = [];
  const series: { angle: number; result: WallResult }[] = [];
  const scans: { note: string; index: number }[] = [];
  let transfer: CameraTransfer = 'code', margin = 15, captures = 4, srcId = '', camNote = '', heatMode: 'dev' | 'cb' | 'cr' | 'delta' | 'o-dy' | 'o-duv' = 'dev', range = 5, angle = 0;
  const camCanvas = h('canvas', { class: 'cam', width: 960, height: 540 });
  const heat = h('canvas', { class: 'heat', width: 960, height: 400 });
  const camMsg = h('span', { class: 'hint' });
  const resBox = h('div');
  let meterStats: PointStat[] = [];
  const camImg = h('canvas');

  const cams = () => host.sources().filter((x) => x.ready);
  function drawCam() {
    const ctx = camCanvas.getContext('2d')!;
    if (!frame) { camCanvas.width = 960; camCanvas.height = 540; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 960, 540); ctx.fillStyle = '#888'; ctx.font = '16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(t('led.cam.placeholder'), 480, 270); return; }
    camCanvas.width = frame.width; camCanvas.height = frame.height;
    ctx.drawImage(camImg, 0, 0);
    const lw = Math.max(1, frame.width / 700);
    if (corners.length === 4) {
      const H = wallToImage(s.wall, corners), w = s.wall;
      ctx.strokeStyle = 'rgba(140,255,158,.8)'; ctx.lineWidth = lw; ctx.beginPath();
      for (let c = 0; c <= w.cols; c++) { const a = project(H, c * w.cabW, 0), b = project(H, c * w.cabW, w.rows * w.cabH); ctx.moveTo(...a); ctx.lineTo(...b); }
      for (let r = 0; r <= w.rows; r++) { const a = project(H, 0, r * w.cabH), b = project(H, w.cols * w.cabW, r * w.cabH); ctx.moveTo(...a); ctx.lineTo(...b); }
      ctx.stroke();
      ctx.fillStyle = 'rgba(140,255,158,.9)'; ctx.font = `${Math.round(lw * 11)}px system-ui`; ctx.textAlign = 'center';
      for (const cab of cabinets(w)) { const p = project(H, cab.x + cab.w / 2, cab.y + cab.h / 2); ctx.fillText(cab.label, p[0], p[1]); }
    }
    corners.forEach((p, i) => {
      ctx.fillStyle = '#ffb44a'; ctx.beginPath(); ctx.arc(p[0], p[1], lw * 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = `bold ${Math.round(lw * 13)}px system-ui`; ctx.fillText([t('led.cam.tlShort'), t('led.cam.trShort'), t('led.cam.brShort'), t('led.cam.blShort')][i], p[0] + lw * 14, p[1] - lw * 8);
    });
    ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = lw * 1.5;
    for (const hit of hits.slice(0, 500)) { ctx.beginPath(); ctx.arc(hit.x + 0.5, hit.y + 0.5, lw * 6, 0, Math.PI * 2); ctx.stroke(); }
  }
  const toImg = (e: MouseEvent): Pt => {
    const r = camCanvas.getBoundingClientRect(), W = camCanvas.width, H = camCanvas.height;
    const sc = Math.min(r.width / W, r.height / H), ox = (r.width - W * sc) / 2, oy = (r.height - H * sc) / 2;
    return [(e.clientX - r.left - ox) / sc, (e.clientY - r.top - oy) / sc];
  };
  let dragIdx = -1;
  camCanvas.addEventListener('pointerdown', (e) => {
    if (!frame) return;
    const p = toImg(e), tol = frame.width / 40;
    const near = corners.findIndex((c) => Math.hypot(c[0] - p[0], c[1] - p[1]) < tol);
    if (near >= 0) dragIdx = near;
    else if (corners.length < 4) { corners.push(p); dragIdx = corners.length - 1; }
    drawCam(); updateCamMsg();
  });
  camCanvas.addEventListener('pointermove', (e) => { if (dragIdx >= 0) { corners[dragIdx] = toImg(e); drawCam(); } });
  window.addEventListener('pointerup', () => { dragIdx = -1; });

  const updateCamMsg = () => {
    camMsg.textContent = !frame ? '' : corners.length < 4
      ? t('led.cam.clickCorners', { corner: [t('led.cam.tl'), t('led.cam.tr'), t('led.cam.br'), t('led.cam.bl')][corners.length] })
      : t('led.cam.wallPlaced');
  };

  async function grab() {
    const src = cams().find((x) => x.id === srcId) ?? cams()[0];
    if (!src) { camMsg.textContent = t('led.cam.noSource'); return; }
    srcId = src.id;
    camMsg.textContent = t('led.cam.grabbing', { n: captures });
    const f = await grabAveraged(src, captures);
    if (!f) { camMsg.textContent = t('led.cam.noPicture'); return; }
    if (frame && (frame.width !== f.width || frame.height !== f.height)) corners = [];
    frame = f; hits = [];
    camImg.width = f.width; camImg.height = f.height;
    const ictx = camImg.getContext('2d')!, img = ictx.createImageData(f.width, f.height);
    for (let i = 0, o = 0; o < f.rgb.length; i += 4, o += 3) { img.data[i] = f.rgb[o] * 255; img.data[i + 1] = f.rgb[o + 1] * 255; img.data[i + 2] = f.rgb[o + 2] * 255; img.data[i + 3] = 255; }
    ictx.putImageData(img, 0, 0);
    drawCam(); updateCamMsg();
  }

  function evaluate() {
    if (!frame || corners.length !== 4) { camMsg.textContent = t('led.cam.needCorners'); return; }
    try { result = analyseWall(frame, s.wall, corners, { margin: margin / 100, transfer, captures }); }
    catch (e) { camMsg.textContent = (e as Error).message; return; }
    renderResult();
  }

  const delta = (): DeltaStat[] | null => (before && result ? compareResults(before, result) : null);

  function drawHeat() {
    if (!result) return;
    const w = result.wall, ctx = heat.getContext('2d')!;
    const W = heat.width, sc = W / (w.cols * w.cabW), Ht = Math.round(w.rows * w.cabH * sc);
    heat.height = Ht + 28;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, heat.height);
    const d = delta(), cw = w.cabW * sc, ch = w.cabH * sc;
    for (const c of result.cabinets) {
      const m = meterStats.find((x) => x.point === c.label);
      const v = heatMode === 'dev' ? c.dev : heatMode === 'cb' ? c.dCb : heatMode === 'cr' ? c.dCr : heatMode === 'o-dy' ? m?.dY ?? NaN : heatMode === 'o-duv' ? (m ? m.duv * 1000 : NaN) : d?.find((x) => x.label === c.label)?.delta ?? NaN;
      ctx.fillStyle = heatColor(v, range); ctx.fillRect(c.c * cw, c.r * ch, cw, ch);
      ctx.strokeStyle = '#000'; ctx.strokeRect(c.c * cw + 0.5, c.r * ch + 0.5, cw - 1, ch - 1);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const fs = Math.max(8, Math.min(ch / 4.5, cw / 5.5));
      ctx.font = `600 ${fs}px system-ui`; ctx.fillText(signed(v, heatMode === 'dev' || heatMode === 'delta' || heatMode.startsWith('o-') ? 1 : 2), c.c * cw + cw / 2, c.r * ch + ch / 2 + fs * 0.45);
      ctx.font = `${fs * 0.7}px system-ui`; ctx.fillStyle = '#ddd'; ctx.fillText(`${c.label} #${c.id}`, c.c * cw + cw / 2, c.r * ch + ch / 2 - fs * 0.6);
    }
    // seams: colour lines by their contrast
    for (const sm of result.seams) {
      ctx.strokeStyle = heatColor(sm.contrast, range); ctx.lineWidth = Math.max(2, Math.min(cw, ch) / 18);
      ctx.beginPath();
      if (sm.dir === 'v') { const x = (sm.c + 1) * cw; ctx.moveTo(x, sm.r * ch + ch * 0.2); ctx.lineTo(x, sm.r * ch + ch * 0.8); }
      else { const y = (sm.r + 1) * ch; ctx.moveTo(sm.c * cw + cw * 0.2, y); ctx.lineTo(sm.c * cw + cw * 0.8, y); }
      ctx.stroke();
    }
    ctx.fillStyle = '#aaa'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const what = { dev: t('led.heat.dev'), cb: 'ΔCb ×100', cr: 'ΔCr ×100', delta: t('led.heat.delta'), 'o-dy': t('led.heat.oDy'), 'o-duv': t('led.heat.oDuv') }[heatMode];
    ctx.fillText(t('led.heat.caption', { name: w.name, what, range, date: new Date(result.date).toLocaleString(locale()) }), 6, Ht + 14);
  }

  function renderResult() {
    if (!result) { resBox.replaceChildren(); return; }
    const r = result, d = delta();
    const seams = [...r.seams].sort((a, b) => Math.abs(b.contrast) - Math.abs(a.contrast)).slice(0, 8);
    const worst = [...r.cabinets].sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev)).slice(0, 8);
    const pts = angleSeries(series);
    resBox.replaceChildren(
      row(
        h('b', {}, t('led.res.summary', { u: fmt(r.uniformity), s: fmt(r.spread, 2), n: r.cabinets.length })),
        lab(t('led.res.map'), sel(heatMode, [['dev', t('led.res.brightness')], ['cb', 'ΔCb'], ['cr', 'ΔCr'], ...(d ? [['delta', t('led.res.beforeAfter')] as [string, string]] : []), ...(meterStats.length ? [['o-dy', t('led.res.oppleBrightness')], ['o-duv', 'Opple: Δu′v′']] as [string, string][] : [])], (v) => { heatMode = v as typeof heatMode; drawHeat(); })),
        lab(t('led.res.scale'), sel(String(range), ['1', '2', '5', '10', '20'].map((v) => [v, v] as [string, string]), (v) => { range = Number(v); drawHeat(); }))),
      heat,
      row(
        button('⤓ CSV', () => download(`${t('led.file.prefix')}-${r.wall.name}-${r.date.slice(0, 16).replace(/[:T]/g, '-')}.csv`, new Blob([reportCsv(r, { [t('led.csv.camera')]: camNote }, d)], { type: 'text/csv' }))),
        button('⤓ PNG', () => heat.toBlob((b) => b && download(`${t('led.file.prefix')}-${r.wall.name}-heatmap.png`, b), 'image/png')),
        button(t('led.res.remember'), () => { before = r; renderResult(); }, { title: t('led.res.rememberTitle') }),
        before && h('span', { class: 'hint' }, t('led.res.before', { time: new Date(before.date).toLocaleTimeString(locale()), a: fmt(before.spread, 2), b: fmt(r.spread, 2) })),
        lab(`${t('led.res.angle')} °`, numberInput(angle, (n) => { angle = n; }, { title: t('led.res.angleTitle'), size: 's' })),
        button(t('led.res.series'), () => { series.push({ angle, result: r }); renderResult(); }, { title: t('led.res.seriesTitle') })),
      h('div', { class: 'cols' },
        h('div', { class: 'table-wrap' }, numTable(['Cabinet', t('led.res.devPct'), 'ΔCb', 'ΔCr', 'Std'],
          worst.map((c) => [`${c.label} #${c.id}`, signed(c.dev, 2), signed(c.dCb, 2), signed(c.dCr, 2), fmt(c.std * 100, 2)]))),
        h('div', { class: 'table-wrap' }, numTable([t('led.res.seam'), t('led.res.contrastPct'), t('led.res.profile')],
          seams.map((sm) => [`${sm.a} | ${sm.b}`, signed(sm.contrast, 2), sparkline(sm.profile)])))),
      pts.length ? h('div', { class: 'table-wrap' }, numTable([t('led.res.angle'), t('led.res.wallMedian'), t('led.res.relative'), 'Cb ×100', 'Cr ×100', t('led.res.spreadPct')],
        pts.map((p) => [fmt(p.angle, 0), fmt(p.median, 4), fmt(p.relative), signed(p.cb, 2), signed(p.cr, 2), fmt(p.spread, 2)]))) : '',
    );
    drawHeat();
  }

  function sparkline(v: number[]) {
    const c = h('canvas', { width: 84, height: 18 }), ctx = c.getContext('2d')!;
    const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
    ctx.strokeStyle = '#8cff9e'; ctx.beginPath();
    v.forEach((y, i) => { const px = (i / (v.length - 1)) * 83, py = 16 - ((y - lo) / span) * 14; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
    ctx.stroke(); ctx.fillStyle = '#555'; ctx.fillRect(42, 0, 1, 18);
    return c;
  }

  const scanBox = h('span', { class: 'hint' }), hitBox = h('div', { class: 'hint' });
  /** wall area of the grabbed picture as fractions (the finders read the live source) */
  const regionFrac = (): RegionFrac => {
    if (!frame || corners.length !== 4) return null;
    const b = bbox(frame, corners);
    return [b.x0 / frame.width, b.y0 / frame.height, b.x1 / frame.width, b.y1 / frame.height];
  };
  const camSrc = () => cams().find((x) => x.id === srcId) ?? cams()[0];
  const flickerBox = flickerFinder({ source: camSrc, region: regionFrac });
  const moireBox = moireMeter({ frame: () => frame, corners: () => corners, wall: () => s.wall, source: camSrc });
  let scanNote = '', thr = 20;
  const camBox = h('div');
  function renderCam() {
    const list = cams();
    camBox.replaceChildren(
      row(
        sel(srcId, list.length ? list.map((x) => [x.id, x.name] as [string, string]) : [['', t('led.cam.noSourceOpt')]], (v) => { srcId = v; }, t('led.cam.sourceTitle')),
        button('↻', renderCam, { small: true, title: t('led.cam.reloadTitle') }),
        lab(t('led.cam.average'), numberInput(captures, (n) => { captures = Math.max(1, Math.min(32, Math.round(n))); }, { title: t('led.cam.averageTitle'), size: 's' })),
        button(t('led.cam.grab'), grab, { variant: 'primary' }),
        button(t('led.cam.resetCorners'), () => { corners = []; hits = []; drawCam(); updateCamMsg(); }),
        camMsg),
      h('div', { class: 'cam-wrap' }, camCanvas),
      row(
        lab(t('led.cam.margin'), numberInput(margin, (n) => { margin = n; }, { title: t('led.cam.marginTitle'), size: 's' })),
        lab('Signal', sel(transfer, [['code', t('led.cam.codeValues')], ['bt709', t('led.cam.linearised')]], (v) => { transfer = v as CameraTransfer; })),
        lab(t('led.cam.camNote'), textInput(camNote, (v) => { camNote = v; }, { placeholder: t('led.cam.camNotePh') })),
        button(t('led.cam.evaluate'), evaluate, { variant: 'primary' })),
      hint(t('led.cam.howto')),
      resBox,
      row(
        h('b', {}, t('led.scan.title')),
        textInput('', (v) => { scanNote = v; }, { placeholder: t('led.scan.notePh') }),
        button(t('led.scan.measure'), () => {
          if (!frame) { scanBox.textContent = t('led.grabFirst'); return; }
          const r = scanLineIndex(frame, corners.length === 4 ? corners : null);
          scans.push({ note: scanNote || t('led.scan.n', { n: scans.length + 1 }), index: r.index });
          scanBox.textContent = scans.map((x) => `${x.note}: ${fmt(x.index, 3)} %`).join(' · ');
        }, { title: t('led.scan.measureTitle') }), scanBox),
      hint(t('led.scan.hint')),
      flickerBox,
      moireBox,
      row(
        h('b', {}, t('led.px.title')),
        lab(t('led.px.threshold'), numberInput(thr, (n) => { thr = n; }, { title: t('led.px.thresholdTitle'), size: 's' })),
        button(t('led.px.search'), () => {
          if (!frame) { hitBox.textContent = t('led.grabFirst'); return; }
          hits = findOutlierPixels(frame, corners.length === 4 ? corners : null, thr / 100);
          drawCam();
          const where = hits.slice(0, 40).map((p) => {
            const loc = corners.length === 4 ? locateOnWall(s.wall, corners, p.x, p.y) : null;
            return `${p.kind} ${p.x}/${p.y}${loc ? ` → ${t('led.px.loc', { label: loc.label, x: loc.px, y: loc.py })}` : ''}`;
          });
          hitBox.textContent = hits.length ? t('led.px.found', { n: `${hits.length}${hits.length >= 500 ? '+' : ''}`, list: where.join(' · ') }) : t('led.px.none');
        })),
      hitBox,
      hint(t('led.px.hint')),
    );
    drawCam();
  }

  // ------------------------------------------------ camera matrix (Unreal procedure)
  const matBox = h('div');
  const meas: Record<'r' | 'g' | 'b' | 'w', number[] | null> = { r: null, g: null, b: null, w: null };
  let matTransfer: CameraTransfer = 'bt709';
  async function measure(k: keyof typeof meas) {
    const src = cams().find((x) => x.id === srcId) ?? cams()[0];
    const f = src ? await grabAveraged(src, Math.max(1, captures)) : null;
    if (!f) { renderMatrix(t('led.mat.noPicture')); return; }
    // centre 20 % of the wall area (or of the frame)
    const region = corners.length === 4 ? corners : null;
    const b = bbox(f, region), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, rw = (b.x1 - b.x0) * 0.1, rh = (b.y1 - b.y0) * 0.1;
    const sum = [0, 0, 0]; let n = 0;
    for (let y = Math.floor(cy - rh); y < cy + rh; y++) for (let x = Math.floor(cx - rw); x < cx + rw; x++) {
      const i = (y * f.width + x) * 3;
      for (let c = 0; c < 3; c++) sum[c] += matTransfer === 'bt709' ? bt709InverseOetf(f.rgb[i + c]) : f.rgb[i + c];
      n++;
    }
    meas[k] = sum.map((v) => v / n);
    renderMatrix();
  }
  function renderMatrix(msg = '') {
    const all = meas.r && meas.g && meas.b && meas.w;
    let out: Node | string = '';
    if (all) {
      try {
        const m = cameraMatrix(meas.r!, meas.g!, meas.b!, meas.w!);
        const txt = ocioMatrix(m);
        out = h('div', {},
          h('div', { class: 'table-wrap' }, numTable(undefined, [0, 1, 2].map((i) => [0, 1, 2].map((j) => m[i * 3 + j].toFixed(5))))),
          row(h('code', {}, txt), button(t('led.mat.copy'), () => navigator.clipboard?.writeText(txt), { small: true })));
      } catch (e) { out = (e as Error).message; }
    }
    const showPatch = (i: number) => { set({ patch: { ...s.patch, list: PATCH_PRESETS[0].list(), index: i, auto: false, window: 25 } }); const ps = pictureSize(s.wall); host.showPattern('led-patch', ps.w, ps.h); renderPatterns(); };
    matBox.replaceChildren(
      hint(t('led.mat.hint')),
      row(
        lab(t('led.mat.linearisation'), sel(matTransfer, [['bt709', t('led.mat.inverse709')], ['code', t('led.mat.alreadyLinear')]], (v) => { matTransfer = v as CameraTransfer; })),
        ...(['r', 'g', 'b', 'w'] as const).map((k, i) => h('span', { class: 'row' },
          button(t('led.mat.show', { c: 'RGBW'[i] }), () => showPatch(i), { small: true, title: t('led.mat.showTitle') }),
          button(t('led.mat.measure', { c: 'RGBW'[i] }), () => measure(k)),
          h('span', { class: 'hint' }, meas[k] ? meas[k]!.map((v) => v.toFixed(3)).join(' ') : '–')))),
      msg && h('p', { class: 'note' }, msg), out);
  }

  // ------------------------------------------------ light meter (Opple)
  const meterBox = h('div');
  const meterCheck = mountMeterCheck(meterBox, {
    wall: () => s.wall,
    openOutput: () => { const ps = pictureSize(s.wall); host.showPattern('led-flat', ps.w, ps.h); },
    cameraCsv: () => (result ? reportCsv(result, { [t('led.csv.camera')]: camNote }, delta()) : null),
    cameraHeat: () => (result ? heat : null),
    onStats: (st) => { meterStats = st; if (result) renderResult(); },
  });
  dlg.dlg.addEventListener('close', () => meterCheck.stop());

  // ------------------------------------------------ assemble
  dlg.setBody(
    h('p', { class: 'note' }, t('led.intro')),
    disclosure(t('led.sec.wall'), [wallBox], { open: true }),
    disclosure(t('led.sec.patterns'), [patBox], { open: true }),
    disclosure(t('led.sec.camera'), [camBox]),
    disclosure(t('led.sec.opple'), [meterBox]),
    disclosure(t('led.sec.matrix'), [matBox]),
  );
  dlg.foot.hidden = false;
  dlg.foot.append(button(t('led.close'), () => dlg.close()));
  renderWall(); renderPatterns(); renderCam(); renderMatrix();
  dlg.open();
}
