// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Draws one scope panel (WebGL trace + 2D overlay). Shared by the full app and the
// embeddable ScopeView (src/embed.ts).

import { legendBox, splitPos, type Box } from './overlayDrag';
import { drawGenlockPanel, type GenlockOptions } from './genlock';
import { DISPLAY_LABELS, FALSE_COLOR_PRESETS, GAMUTS, mul3, rgbToXyzMatrix, bandRange, gamutConvert, isLog, logBarTargets, transferLabel, ycbcr, type DisplaySpace, type GamutId, type HdrPreview } from './color';
import {
  drawChannelPlotGraticule, drawCubeGraticule, drawLutVolume, drawDiamondGraticule, drawSatLumGraticule, diamondPoint, drawVectorExtras, type VectorTarget, drawSkinRange, drawCieGraticule, drawHistogram, drawTextBox, drawVectorGraticule, drawHlsGraticule, hsl, hlsPoint, drawWaveGraticule, drawWaveProbe,
  WAVE_ZOOMS, channelLayout, isAudio, isWaveform, plotRect, type WaveChannels, type WaveOpts, type WaveZoom, probeLines, statsLines, vectorPoint, vectorBands, vectorBandRects, FONT, LABEL, type ScopeType, type Unit, type BarTargetSet,
} from './graticule';
import { drawAudioBar, drawAudioPanel, type AudioPanelOptions } from './audio/panels';
import type { DisplayParams, PictureMode, PictureParams, Rect, Renderer, ScatterMode, ScatterParams, SkinRange } from './renderer';
import type { Source } from './sources';
import { barRefs, nearest, type DeRef } from './deltae';
import { LUTS, applyLut } from './lut';
import { lutVolume } from './cube';

/** LUT volume of the last drawn cube panel (recomputed when LUT, version or lattice change). */
let lutVolCache: { key: string; pts: { inp: number[]; out: number[] }[] } = { key: '', pts: [] };
import { DEFAULT_ALARM, QC_TYPES, alarmColor, drawQcLog, qcLog, type AlarmSettings, type AlarmState, type QcType } from './qclog';
import { castName, drawMinMax } from './minmax';

const NEUTRAL_RANGES = { all: [0.02, 0.98], shadows: [0.02, 0.3], mids: [0.3, 0.7], highlights: [0.7, 0.98] } as const;
export const neutralParams = (p: PanelState) => {
  const [lo, hi] = NEUTRAL_RANGES[p.neutral?.range ?? 'all'];
  return { threshold: (p.neutral?.threshold ?? 5) / 100, lo, hi };
};
import { drawTimeline, type TimelineSpan } from './history';
import { CUBE_SPACE_ID, DEFAULT_CUBE, cubeNits, cubeQOf, cubeRotation, type CubeSettings } from './cube';
import { DEFAULT_CRT, PHOSPHORS, type CrtSettings } from './crt';
import { STAGE_LABELS, autoPeaks, baseOf, chainOf, stageView, type Stage } from './chain';
import { clockOpts, drawClockOverlay, drawClockPanel, type ClockOptions } from './clock/panel';
import { GREEN_DEFAULT, targetSignal } from './match/core';
import { drawMatchPanel, matchSignature, type MatchSettings } from './match/panel';
import { cropPlan, regionOf } from './match/crop';
import { drawDriftPanel, driftSignature, type DriftSettings } from './match/driftPanel';
import { chartSignature, drawChartPanel, type ChartSettings } from './match/chartPanel';
import { drawLightPanel, isLight, lightSignature, type LightPanelOptions } from './opple/scopes';
import { drawSimulcastPanel, type SimulcastSettings } from './simulcastPanel';
import { drawEncoderPanel, type EncoderSettings } from './encoderPanel';
import { drawLensPanel, type LensSettings } from './lensPanel';
import { drawSdiPanel } from './sdiPanel';
import { num, t } from './i18n';
import { IDENTITY, isIdentity, viewRect, waveRange, type View, type ViewLimits } from './view';
import { GHOST_CSS, GHOST_TINT, deltaRows, ghostChannels, hasGhost, histOf, levelDeltas, traceLevels } from './ghost';
import { LUMA } from './color';
import { drawGuidePanel, type GuideState } from './shading/guidePanel';
import { PEAK_COLOURS, PEAK_DEFAULT, PeakHold, lumaPlane, measureRect, sharpness, type PeakColour, type Rect4 } from './focus';
import { channelPlanes, measureNoise, noiseRows, quantFloorDb, type NoiseResult } from './noise';
import { analyseShading, cellColour, cellDeviation, rampColour, shadingRows, type ShadingChannel, type ShadingResult } from './whiteShading';
import { CLOUD_COLOURS, cloudRow, skinCloud, type SkinCloud } from './skinTone';
import { TILE_HEAD, sanitizeTiles, tileAspect, tileGrid, tileLabel, tileSources, type TileSettings } from './tiles';

export interface PanelState {
  scope: ScopeType; sourceId: string; gain: number; colorize: boolean; zoom: number;
  picture: PictureMode; hist: 'rgb' | 'luma' | 'split'; log: boolean;
  /** parades / RGB overlay: 'mono' | 'channel' | 'source' colours */
  paradeColor?: 'mono' | 'channel' | 'source';
  /** vectorscope: gamut boundaries to show */
  gamuts?: ('709' | 'p3' | '2020')[];
  /** scale of this panel instead of the global unit (#179) */
  unit?: Unit;
  /** signal low-pass before the measurement (#179): 0 off, 1 = 3×3, 2 = 5×5 */
  smooth?: 0 | 1 | 2;
  /** CIE diagram: share of the picture outside gamutTarget below the diagram (#181), on by default */
  gamutShare?: boolean;
  /** vectorscope by tonal range (#180): the two boundaries in % Y′, and which circle is shown alone (0 = all three) */
  bands?: [number, number];
  big?: 0 | 1 | 2 | 3;
  /** coloured frame while the QC conditions of this source hold (#182) */
  alarm?: AlarmSettings;
  /** Pinned panels keep their source when another panel switches. */
  pin?: boolean;
  /** waveforms: EBU R 103 −5/105 % lines (off by default) and reference marks (BT.2408 / 18 % grey, on by default) */
  r103?: boolean; marks?: boolean;
  /** CIE scope in CIE 1976 u′v′ */
  cieUv?: boolean;
  /** picture 'gamut' overlay: target gamut of the warning */
  gamutTarget?: '709' | 'p3' | '2020';
  /** settings of the audio panels */
  audio?: AudioPanelOptions;
  /** picture: compact level bar of the source's sound (default on when there is sound) */
  audioBar?: boolean;
  /** where this panel measures in the source's chain; unset = global default */
  stage?: Stage;
  /** skin-tone waveform: show the luma window band and lines (default on) */
  skinBand?: boolean;
  /** green waveform: show the luma window band (default on); vectorscope: show the green wedge */
  greenBand?: boolean; greenWedge?: boolean;
  /** colour match panel (match/panel.ts) */
  match?: MatchSettings;
  /** waveforms: zoom into blacks/highlights, visible channels (parade/YRGB/RGB), channel names and unit */
  waveZoom?: WaveZoom; channels?: WaveChannels; names?: boolean;
  /** clock panel settings (src/clock/panel.ts); also used by the picture overlay */
  clock?: Partial<ClockOptions>;
  /** reference/genlock panel (src/genlock.ts) */
  genlock?: Partial<GenlockOptions>;
  /** scatter scopes: analogue beam look (crt.ts) */
  crt?: Partial<CrtSettings>;
  /** Min/Max per line: limits ('r103' −5/105 %, 'legal' 0/100 %) and up to 4 target lines in % */
  minmax?: { limits?: 'r103' | 'legal'; targets?: number[] };
  /** picture 'neutral' overlay: chroma threshold in % and Y′ range */
  neutral?: { threshold?: number; range?: 'all' | 'shadows' | 'mids' | 'highlights' };
  /** channel plot: channel pair (graticule.ts CHANNEL_PAIRS) */
  pair?: number;
  /** QC log: event types shown */
  qcTypes?: QcType[];
  /** timeline: one sample per new picture instead of 10 Hz; raster width */
  everyFrame?: boolean; grid?: number;
  /** timeline: shown time span in seconds */
  span?: TimelineSpan;
  /** vectorscope, CIE, diamond, 3D volume (digital): persistence in ms, −1 = infinite (trace history) */
  persist?: number;
  /** 3D colour volume: space, rotation, wire-frame gamut */
  cube?: Partial<CubeSettings>;
  /**
   * picture: A/B comparison. `b` = 'stage:signal|cst|lut' (same source) or 'src:<id>';
   * split = divider at `pos` (drag it in the picture; 'wipe' = older saved name), diff = max |A − B| × `gain`.
   */
  ab?: { mode: 'off' | 'split' | 'wipe' | 'diff' | 'crop' | 'butterfly'; b: string; pos?: number; gain?: number };
  /** picture: overlay legend position (fractions of the free space, default bottom-left) */
  legendPos?: { x: number; y: number };
  /** picture: ACES 1.3 reference gamut compression as a preview (picture and gamut warning, not the scopes) */
  rgc?: boolean;
  /** picture: compact time of day / source time code in the corner */
  clockOverlay?: boolean;
  /** light scopes (Opple Light Master, src/opple/scopes.ts) */
  light?: Partial<LightPanelOptions>;
  /** simulcast deviation map (simulcastPanel.ts): stages compared, colour scale */
  simulcast?: SimulcastSettings;
  /** encoder confidence (encoderPanel.ts): programme source against this panel's source (the return) */
  encoder?: EncoderSettings;
  /** lens fingerprint (lensPanel.ts): lens, zoom, compared print */
  lens?: LensSettings;
  /** zoom/pan from gestures (#89, view.ts); the 3D volume keeps its view in `cube` */
  view?: View;
  /** reference trace of the reference camera (ghost.ts) over this scope, with Δ levels */
  ghost?: boolean;
  /** tile view (tiles.ts): inner scope and sources */
  tiles?: TileSettings;
  /** picture 'peaking' overlay (focus.ts): gradient threshold and colour */
  peak?: { threshold?: number; colour?: PeakColour };
  /** noise meter (noise.ts): remove a fitted shading surface before measuring (default on) */
  noise?: { detrend?: boolean };
  /** white-shading map (whiteShading.ts): mapped quantity, full scale in %, measuring frame only */
  wshading?: { map?: ShadingChannel | 'colour'; scale?: number; roi?: boolean };
  /** skin tone of all cameras (skinTone.ts): sources (empty = first eight) and vectorscope zoom */
  skinall?: { sources?: string[]; zoom?: number };
  /** colour-chart match matrix (match/chartPanel.ts): sources, corners per source, tolerance */
  chart?: ChartSettings;
  /** shading assistant (src/shading/guidePanel.ts, #151) */
  shguide?: GuideState;
  /** drift guard (match/driftPanel.ts): sources, tolerance */
  drift?: DriftSettings;
}

/** Sources of the skin-tone panel (same choice rule as the tiles). */
export function skinSources(p: PanelState, o: DrawOptions) {
  const all = o.sourceList?.() ?? [];
  return { all, list: tileSources(all.filter((s) => s.kind !== 'audio'), p.skinall?.sources ?? []) };
}
/** Sources of the colour-chart panel (same choice rule as the tiles). */
export function chartSources(p: PanelState, o: DrawOptions) {
  const all = o.sourceList?.() ?? [];
  return { all, list: tileSources(all.filter((s) => s.kind !== 'audio'), p.chart?.sources ?? []) };
}
/** Sources of the drift guard (same choice rule as the tiles). */
export function driftSources(p: PanelState, o: DrawOptions) {
  const all = o.sourceList?.() ?? [];
  return { all, list: tileSources(all.filter((s) => s.kind !== 'audio'), p.drift?.sources ?? []) };
}
/** Skin cloud of a source: faces (face tracking) or the measuring frame, else the whole picture. */
const cloudCache = new Map<string, { key: string; c: SkinCloud | null }>();
export function skinCloudOf(src: Source, q: SkinRange): SkinCloud | null {
  const b = baseOf(src), key = `${b.frameSeq}:${b.statsVersion}:${b.activeRois().flat().join(',')}:${q.lo}:${q.hi}:${q.tol}:${b.colorspace}`;
  const hit = cloudCache.get(b.id);
  if (hit?.key === key) return hit.c;
  const { kr, kb } = LUMA[b.colorspace];
  const c = skinCloud(b.roiSamples(15000), kr, kb, q);
  cloudCache.set(b.id, { key, c });
  return c;
}

function drawSkinAllPanel(ctx: CanvasRenderingContext2D, p: PanelState, body: Rect, o: DrawOptions) {
  const { all, list } = skinSources(p, o);
  const zoom = p.skinall?.zoom ?? 2;
  const cs = list[0]?.colorspace ?? '709';
  // vectorscope square on the left (wide) or on top (narrow), legend beside or below
  const legendW = 470, wide = body.w > legendW + 220;
  const side = wide ? Math.min(body.h - 16, body.w - legendW - 24) : Math.min(body.w - 16, body.h - 16 - (list.length + 2) * 15 - 12);
  const r = { x: 8, y: 8, w: Math.max(40, side), h: Math.max(40, side) };
  drawVectorGraticule(ctx, r, cs, zoom, o.skin.tol);
  const refId = o.ref?.source()?.id;
  const clouds = list.map((s) => ({ s, c: s.ready ? skinCloudOf(s, o.skin) : null }));
  const ref = clouds.find((x) => x.s.id === refId && x.c)?.c ?? clouds.find((x) => x.c)?.c ?? null;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  clouds.forEach(({ c }, i) => {
    if (!c) return;
    ctx.fillStyle = CLOUD_COLOURS[i % CLOUD_COLOURS.length]; ctx.globalAlpha = 0.45;
    for (const [cb, cr] of c.pts) { const [x, y] = vectorPoint(r, cb, cr, zoom); ctx.fillRect(x - 1, y - 1, 2, 2); }
  });
  ctx.globalAlpha = 1;
  clouds.forEach(({ c }, i) => {
    if (!c) return;
    const [x, y] = vectorPoint(r, c.cb, c.cr, zoom);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
    ctx.strokeStyle = CLOUD_COLOURS[i % CLOUD_COLOURS.length]; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
  });
  ctx.restore();
  const lx = wide ? r.x + r.w + 16 : 12, ly = wide ? 10 : r.y + r.h + 10;
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#d6d6d6';
  const head = wrapText(ctx, t('skinall.head', { zoom }), (wide ? body.w - lx : body.w - 24) - 8);
  head.forEach((l, i) => ctx.fillText(l, lx, ly + i * 15));
  const top = ly + head.length * 15 + 4;
  if (!list.length) ctx.fillText(o.emptyText ?? t('panel.draw.addSource'), lx, top);
  clouds.forEach(({ s, c }, i) => {
    const y = top + i * 15;
    ctx.fillStyle = CLOUD_COLOURS[i % CLOUD_COLOURS.length]; ctx.fillRect(lx, y + 2, 8, 8);
    ctx.fillStyle = '#d6d6d6';
    const label = `${all.indexOf(s) + 1} ${s.name}`.slice(0, 14).padEnd(14);
    const where = s.faceTrack ? t('skinall.faces', { n: s.activeRois().length }) : s.roi ? t('skinall.frame') : t('skinall.whole');
    ctx.fillText(c ? `${cloudRow(label, c, ref)}  ${where}` : `${label}  ${t('skinall.none')}  ${where}`, lx + 14, y);
  });
}

/** Split a text line into lines of at most `maxW` px at spaces. */
export function wrapText(ctx: CanvasRenderingContext2D, line: string, maxW: number): string[] {
  if (ctx.measureText(line).width <= maxW) return [line];
  const out: string[] = []; let cur = '';
  for (const w of line.split(' ')) { const next = cur ? `${cur} ${w}` : w; if (ctx.measureText(next).width > maxW && cur) { out.push(cur); cur = w; } else cur = next; }
  return [...out, cur];
}

/** White-shading analysis of the whole picture (or the measuring frame), once per frame. */
const shadingCache = new Map<string, { key: string; r: ShadingResult | null }>();
export function shadingOf(src: Source, useRoi: boolean): ShadingResult | null {
  const b = baseOf(src), f = b.cpuFrame();
  if (!f) return null;
  const roi = useRoi ? b.activeRois()[0] : undefined, sx = f.w / b.width, sy = f.h / b.height;
  const rect: Rect4 = roi ? measureRect([roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy], f.w, f.h) : [0, 0, f.w, f.h];
  const c = chainOf(src);
  const key = `${b.frameSeq}:${rect.join(',')}:${f.w}:${b.colorspace}:${c?.sig ?? ''}`;
  const hit = shadingCache.get(b.id);
  if (hit?.key === key) return hit.r;
  const { kr, kb } = LUMA[b.colorspace];
  const decode = c ? ((px: ArrayLike<number>, i: number) => c.apply(f.decode(px, i)) as [number, number, number]) : f.decode;
  const r = analyseShading(channelPlanes(f.px, f.w, decode, kr, kb, rect, 400_000));
  shadingCache.set(b.id, { key, r });
  return r;
}

function drawShadingPanel(ctx: CanvasRenderingContext2D, p: PanelState, src: Source, body: Rect) {
  const o = p.wshading ?? {};
  const map = o.map ?? 'Y', scale = (o.scale ?? 5) / 100;
  const r = shadingOf(src, !!o.roi);
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#d6d6d6';
  if (!r) { ctx.fillText(t('noise.noData'), 12, 10); return; }
  const rows = [t(map === 'colour' ? 'wshading.mapColour' : 'wshading.mapLevel', { ch: map === 'Y' ? 'Y′' : `${map}′`, scale: (scale * 100).toFixed(0) }), '', ...shadingRows(r, { flat: t('wshading.flat') }), '', t('wshading.read')];
  // wide panel: map left, table right; narrow: map on top
  const tableW = 360, wide = body.w > tableW + 260;
  const area = wide ? { x: 8, y: 8, w: body.w - tableW - 24, h: body.h - 16 } : { x: 8, y: 8, w: body.w - 16, h: Math.max(60, body.h - rows.length * 15 - 28) };
  const aspect = src.width && src.height ? src.width / src.height : 16 / 9;
  let mw = area.w, mh = mw / aspect;
  if (mh > area.h) { mh = area.h; mw = mh * aspect; }
  const cw = mw / r.gx, ch = mh / r.gy;
  for (let j = 0; j < r.gy; j++) for (let i = 0; i < r.gx; i++) {
    const k = j * r.gx + i;
    let rgb: [number, number, number];
    if (map === 'colour') {
      // cast of the cell against the field's own balance: R′ − G′ and B′ − G′, amplified to full scale
      const [dr, db] = cellColour(r, k), a = 0.5 / scale;
      rgb = [0.55 + dr * a, 0.55 - (dr + db) * a * 0.5, 0.55 + db * a].map((v) => Math.max(0, Math.min(1, v))) as [number, number, number];
    } else rgb = rampColour(cellDeviation(r, map, k), scale);
    ctx.fillStyle = `rgb(${rgb.map((v) => Math.round(v * 255)).join(',')})`;
    ctx.fillRect(area.x + i * cw, area.y + j * ch, Math.ceil(cw), Math.ceil(ch));
  }
  if (map !== 'colour' && cw > 34 && ch > 14) {
    ctx.fillStyle = 'rgba(10,10,12,0.85)'; ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let j = 0; j < r.gy; j++) for (let i = 0; i < r.gx; i++) {
      const d = cellDeviation(r, map, j * r.gx + i) * 100;
      ctx.fillText(`${d < -0.05 ? '−' : '+'}${Math.abs(d).toFixed(1)}`, area.x + (i + 0.5) * cw, area.y + (j + 0.5) * ch);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(area.x + 0.5, area.y + 0.5, mw - 1, mh - 1);
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#d6d6d6';
  const tx = wide ? area.x + mw + 16 : 12, ty = wide ? 10 : area.y + mh + 10;
  // long text lines (not the table rows) wrap to the space beside or below the map
  const maxW = (wide ? body.w - tx : body.w - 24) - 8;
  rows.flatMap((l) => (l.startsWith('  ') || /^[YRGB]′/.test(l) ? [l] : wrapText(ctx, l, maxW))).forEach((l, i) => ctx.fillText(l, tx, ty + i * 15));
}

/** Noise of the measuring frame (centre third without one), once per frame and setting. */
const noiseCache = new Map<string, { key: string; r: NoiseResult | null; rect: Rect4; scaled: boolean; fw: number; sw: number }>();
export function noiseOf(src: Source, detrend: boolean) {
  const b = baseOf(src), f = b.cpuFrame();
  if (!f) return null;
  const roi = b.activeRois()[0], sx = f.w / b.width, sy = f.h / b.height;
  const rect = measureRect(roi ? [roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy] : null, f.w, f.h);
  const key = `${b.frameSeq}:${rect.join(',')}:${f.w}:${detrend}:${b.colorspace}`;
  const hit = noiseCache.get(b.id);
  if (hit?.key === key) return hit;
  const { kr, kb } = LUMA[b.colorspace];
  const c = chainOf(src);
  const decode = c ? ((px: ArrayLike<number>, i: number) => c.apply(f.decode(px, i)) as [number, number, number]) : f.decode;
  const out = { key, r: measureNoise(channelPlanes(f.px, f.w, decode, kr, kb, rect), detrend), rect, scaled: f.w < (b.info?.sourceWidth ?? b.width) || f.w < b.width, fw: f.w, sw: Math.max(b.width, b.info?.sourceWidth ?? 0) };
  noiseCache.set(b.id, out);
  return out;
}

function drawNoisePanel(ctx: CanvasRenderingContext2D, p: PanelState, src: Source) {
  const detrend = p.noise?.detrend !== false;
  const m = noiseOf(src, detrend);
  const lines = [src.name];
  if (!m?.r) lines.push(t('noise.noData'));
  else {
    const [x0, y0, x1, y1] = m.rect;
    lines.push(t(src.activeRois().length ? 'noise.region' : 'noise.regionCentre', { w: x1 - x0, h: y1 - y0 }) + (detrend ? ` · ${t('noise.detrendOn')}` : ''), '');
    lines.push(...noiseRows(m.r, { level: t('noise.level'), sigma: 'σ %' }), '');
    lines.push(t('noise.snr', { db: Number.isFinite(m.r.Y.db) ? (-m.r.Y.db).toFixed(1) : '∞' }));
    const floor = src.yuv ? quantFloorDb(src.yuv.bits, !src.yuv.full) : quantFloorDb(src.depth === 16 ? 16 : 8, false);
    lines.push(t('noise.floor', { db: floor.toFixed(1) }));
    if (m.scaled) lines.push(t('noise.scaled', { w: m.fw, src: m.sw }));
  }
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#d6d6d6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, 12, 10 + i * 15));
}

/** Focus value per source: last frame's sharpness and the peak hold (focus.ts). */
const focusState = new Map<string, { key: string; value: number; hold: PeakHold }>();
/** Start the focus peak hold of a source over. */
export function resetFocusPeak(id: string) { focusState.get(id)?.hold.reset(); }
/** Sharpness of the measuring frame (centre third without one) and its peak since reset; region in source pixels. */
export function focusOf(src: Source): { value: number; peak: number; rect: Rect4 } | null {
  const b = baseOf(src), f = b.cpuFrame();
  if (!f) return null;
  const roi = b.activeRois()[0];
  const sx = f.w / b.width, sy = f.h / b.height;
  const rect = measureRect(roi ? [roi[0] * sx, roi[1] * sy, roi[2] * sx, roi[3] * sy] : null, f.w, f.h);
  const st = focusState.get(b.id) ?? { key: '', value: 0, hold: new PeakHold() };
  focusState.set(b.id, st);
  const key = `${b.frameSeq}:${rect.join(',')}:${f.w}`;
  if (st.key !== key) {
    const { kr, kb } = LUMA[b.colorspace];
    st.value = sharpness(lumaPlane(f.px, f.w, f.decode, kr, kb, rect));
    st.key = key;
  }
  return { value: st.value, peak: st.hold.update(`${rect.join(',')}:${f.w}`, st.value), rect: [rect[0] / sx, rect[1] / sy, rect[2] / sx, rect[3] / sy] };
}

// ------------------------------------------------------------------ zoom and pan (#89)

const XY: ViewLimits = { min: 1, max: 16, axes: 'xy', cover: true };
/** Zoom range and axes of a scope; null = no zoom (audio, clock, tables …). */
export function viewLimits(scope: ScopeType): ViewLimits | null {
  if (isWaveform(scope)) return { min: 1, max: 20, axes: 'y', cover: true };
  if (scope === 'cube') return { min: 0.3, max: 8, axes: 'xy', cover: false };
  if (scope === 'vector' || scope === 'hls' || scope === 'cie' || scope === 'satlum' || scope === 'chplot' || scope === 'diamond' || scope === 'hist' || scope === 'picture') return XY;
  return null;
}
/** Current view of a panel (the 3D volume: its own zoom/pan). */
export function panelView(p: PanelState): View {
  if (p.scope === 'cube') return { z: p.cube?.zoom ?? 1, x: p.cube?.panX ?? 0, y: p.cube?.panY ?? 0 };
  return p.view ?? IDENTITY;
}
export function setPanelView(p: PanelState, v: View) {
  if (p.scope === 'cube') p.cube = { ...DEFAULT_CUBE, ...p.cube, zoom: v.z, panX: v.x, panY: v.y };
  else p.view = isIdentity(v) ? undefined : { z: v.z, x: v.x, y: v.y };
}
/** Waveform level range on screen: magnifier preset plus gesture zoom. */
export const waveRangeOf = (p: PanelState): [number, number] => waveRange(WAVE_ZOOMS[p.waveZoom ?? 'full'], isWaveform(p.scope) ? p.view : undefined);
/** 2D scopes and the picture: the plot rect with the gesture view applied (pointer mapping, overlay). */
export function contentRect(p: PanelState, w: number, h: number, aspect = 16 / 9): Rect {
  const r = plotRect(p.scope, w, h, aspect), v = xyView(p);
  return v ? viewRect(r, v) : r;
}
/** The gesture view of a 2D scope or the picture (not waveforms, not the 3D volume); null = none. */
function xyView(p: PanelState): View | null {
  return p.view && !isIdentity(p.view) && viewLimits(p.scope)?.axes === 'xy' && p.scope !== 'cube' ? p.view : null;
}
/** Scopes whose labels sit outside the plot: their overlay is clipped to the panel, not the plot. */
const LABELS_OUTSIDE: ScopeType[] = ['cie', 'satlum', 'chplot', 'hist'];

/** CRT settings of a panel with defaults; null = digital display. */
export const crtOf = (p: PanelState): CrtSettings | null => (p.crt?.on ? { ...DEFAULT_CRT, ...p.crt, on: true } : null);

/** Graticule options of a waveform panel. */
export const waveOpts = (p: PanelState, src: Source | null): WaveOpts => ({
  lw: src?.hlgLw, r103: p.r103, marks: p.marks, range: waveRangeOf(p), channels: p.channels, names: p.names,
});

export const TINTS = { white: [1, 1, 1], green: [0.55, 1, 0.62], amber: [1, 0.82, 0.45] } as const;
export type Tint = keyof typeof TINTS;

export interface DrawOptions {
  unit: Unit; tint: Tint; maxSamples: number; falsePreset: string;
  zebra: number; zebraLow: number; frozen: boolean; displayFps: number;
  skin: SkinRange; display: DisplaySpace;
  /** green/grass qualifier (match/core.ts GREEN_DEFAULT) */
  green?: SkinRange;
  /** picture view: HDR/log → SDR down-mapping (default BT.2408 hybrid-linear) */
  hdrPreview?: HdrPreview;
  /** user colour-match targets (vectorscope) */
  targets?: VectorTarget[];
  /** default measuring stage of panels without their own */
  stage?: Stage;
  emptyText?: string;
  /** ΔE at the probe point: 'off', 'bars' (nearest colour bar), 'targets' (nearest user target) or 'target:<name>' */
  deRef?: string;
  /** resolves the B source of an A/B comparison */
  sourceById?: (id: string) => Source | null;
  /** reference camera (ghost.ts); functions are left out of the panel signature, `sig` stands in */
  ref?: RefDraw;
  /** all sources in list order (tile view: which sources, camera numbers) */
  sourceList?: () => Source[];
}

/** Sources of a tile panel with their camera number (index in the source list). */
export function tilePlan(p: PanelState, body: { w: number; h: number }, o: DrawOptions) {
  const ts = sanitizeTiles(p.tiles);
  const all = o.sourceList?.() ?? [];
  const list = tileSources(all.filter((s) => s.kind !== 'audio'), ts.sources);
  const cells = tileGrid(list.length, body.w, body.h, tileAspect(ts.scope));
  return { ts, cells, tiles: list.map((s, i) => ({ src: s, no: all.indexOf(s), cell: cells[i], sub: { ...p, scope: ts.scope, sourceId: s.id, tiles: undefined, view: undefined } as PanelState })) };
}
/** Body rect of one tile's scope (below its ID strip), absolute like `body`. */
const tileBody = (body: Rect, c: Rect): Rect => ({ x: body.x + c.x, y: body.y + c.y + TILE_HEAD, w: c.w, h: Math.max(1, c.h - TILE_HEAD) });

function drawTiles(renderer: Renderer, ctx: CanvasRenderingContext2D, key: string, p: PanelState, body: Rect, o: DrawOptions) {
  renderer.clearRect(body);
  const { tiles } = tilePlan(p, body, o);
  if (!tiles.length) {
    ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.emptyText ?? t('panel.draw.addSource'), body.w / 2, body.h / 2);
    return;
  }
  tiles.forEach(({ src, no, cell, sub }, i) => {
    const inner = tileBody(body, cell);
    renderer.clearRect(inner, [0.043, 0.047, 0.055]);
    ctx.save();
    ctx.translate(cell.x, cell.y + TILE_HEAD);
    ctx.beginPath(); ctx.rect(0, 0, inner.w, inner.h); ctx.clip();
    drawPanel(renderer, ctx, `${key}#t${i}`, sub, src, inner, o);
    ctx.restore();
    // camera ID strip
    ctx.fillStyle = '#1c1f24'; ctx.fillRect(cell.x, cell.y, cell.w, TILE_HEAD);
    ctx.fillStyle = '#e8e8e8'; ctx.font = '600 11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = tileLabel(no, src.name);
    let text = label;
    while (text.length > 4 && ctx.measureText(text).width > cell.w - 12) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, cell.x + 6, cell.y + TILE_HEAD / 2 + 0.5);
    if (src.status !== 'live' && !src.ready) { ctx.fillStyle = '#c8892b'; ctx.fillRect(cell.x + cell.w - 8, cell.y + 6, 5, 5); }
  });
}

/** The reference as the panels see it. */
export interface RefDraw {
  source: () => Source | null;
  /** frozen: renderer snapshot tag and the R′G′B′ samples taken at that moment */
  snapshot?: string; samples?: () => number[][];
  opacity: number; name: string; frozen: boolean;
  /** changes whenever the reference picture changes (frame, freeze) */
  sig: string;
}

/** R′G′B′ samples of a source frame for the Δ levels, once per frame and measuring frame. */
const sampleCache = new Map<string, { key: string; px: number[][] }>();
export function frameSamples(src: Source): number[][] {
  const b = baseOf(src), key = `${b.frameSeq}:${b.statsVersion}:${b.width}x${b.height}:${b.activeRois().flat().join(',')}`;
  const hit = sampleCache.get(b.id);
  if (hit?.key === key) return hit.px;
  const px = b.roiSamples(12000);
  sampleCache.set(b.id, { key, px });
  return px;
}
/** Samples as a panel at its measuring stage sees them (chain.ts). */
const atStage = (src: Source, px: number[][]) => { const c = chainOf(src); return c ? px.map((v) => c.apply(v)) : px; };

/** The reference source at the panel's stage; null when there is none or it would compare the source with itself live. */
function refView(src: Source, p: PanelState, o: DrawOptions): Source | null {
  if (!p.ghost || !o.ref || !hasGhost(p.scope)) return null;
  const r = o.ref.source();
  if (!r || !r.ready) return null;
  if (!o.ref.frozen && baseOf(r).id === baseOf(src).id) return null;
  return stageView(r, p.stage ?? o.stage ?? 'signal');
}

/** Δ box (live − reference) at the top left of the plot. */
function drawGhostDeltas(ctx: CanvasRenderingContext2D, frame: Rect, scope: ScopeType, src: Source, ref: Source, o: DrawOptions) {
  const rd = o.ref!;
  const refPx = atStage(ref, rd.frozen && rd.samples ? rd.samples() : frameSamples(ref));
  const cur = traceLevels(atStage(src, frameSamples(src)), LUMA[src.colorspace].kr, LUMA[src.colorspace].kb);
  const rl = traceLevels(refPx, LUMA[ref.colorspace].kr, LUMA[ref.colorspace].kb);
  const head = t('ghost.box.ref', { name: rd.name, mode: rd.frozen ? t('ghost.frozen') : t('ghost.live') });
  const lines = cur && rl ? deltaRows(levelDeltas(cur, rl), ghostChannels(scope), { black: t('ghost.black'), median: t('ghost.median'), peak: t('ghost.peak') }) : [t('ghost.noData')];
  drawTextBox(ctx, frame.x + 6, frame.y + 6, [head, ...lines]);
  ctx.fillStyle = GHOST_CSS; ctx.fillRect(frame.x + 6, frame.y + 6, 3, 15);
}

export const DEFAULT_SKIN: SkinRange = { lo: 0.3, hi: 0.8, tol: 14 };
/** Green qualifier of the draw options with defaults. */
export const greenOf = (o: DrawOptions): SkinRange => ({ ...GREEN_DEFAULT, ...o.green });
const matchCtx = (o: DrawOptions) => ({ targets: o.targets ?? [], sourceById: o.sourceById ?? (() => null), display: o.display });

/**
 * Input gamut → display gamut and output curve for the picture view; HDR and log sources are
 * down-mapped to SDR (color.ts hdrToSdr) with the source peak (PQ 1000 cd/m² mastering, HLG Lw,
 * log the curve's top in cd/m² at 203 = reference white).
 */
export function displayParams(src: Source, display: DisplaySpace, hdrPreview: HdrPreview = 'bt2408'): DisplayParams {
  const from = GAMUTS[src.gamut];
  if (display === 'raw') return { curve: 2, gamut: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  const to = display === 'p3' ? GAMUTS.p3 : GAMUTS['709'];
  const peak = autoPeaks({ transfer: src.transfer, gamut: src.gamut, lw: src.hlgLw }, { transfer: 'sdr', gamut: '709', lw: 100 }).src;
  return {
    curve: display === 'rec709' ? 1 : 0, gamut: gamutConvert(from, to),
    hdr: { mode: hdrPreview, peak, to2020: gamutConvert(from, GAMUTS['2020']), from2020: gamutConvert(GAMUTS['2020'], to) },
  };
}
export { DISPLAY_LABELS };

/** Source linear → target gamut linear for the gamut warning (Bradford-adapted). */
export const warnMatrix = (src: Source, target: GamutId = '709') => gamutConvert(GAMUTS[src.gamut], GAMUTS[target]);

/** Vectorscope targets: for camera log sources the 709 bars encoded into the source curve and gamut. */
export function vectorTargets(src: Source): BarTargetSet | undefined {
  const tr = src.transfer;
  if (!isLog(tr)) return undefined;
  return { t100: logBarTargets(tr, src.gamut, src.colorspace, 1), t75: logBarTargets(tr, src.gamut, src.colorspace, 0.75), label: t('panel.draw.logBars', { curve: transferLabel(tr), gamut: GAMUTS[src.gamut].name }) };
}

export const ROI_CLOSE = 16;
/** Top-left corner of the ROI's close box (CSS px, relative to the panel body). */
export const roiCloseBox = (rx: number, ry: number, rw: number) => [rx + rw - ROI_CLOSE / 2, ry - ROI_CLOSE / 2] as const;

/** Everything a panel's pixels depend on; unchanged → the panel is not redrawn. */
/** ΔE line of the probe values against the chosen reference (deltae.ts). */
export function deLines(src: Source, rgb: [number, number, number], o: DrawOptions): string[] {
  const r = o.deRef ?? 'off';
  if (r === 'off') return [];
  const refs: DeRef[] = r === 'bars' ? barRefs(src)
    : (o.targets ?? []).filter((tg) => r === 'targets' || r === `target:${tg.name}`).map((tg) => ({ name: tg.name, rgb: targetSignal(tg, src) }));
  const n = nearest(src, rgb, refs);
  if (!n) return [`ΔE        – ${t('panel.draw.noRef', { name: r.replace('target:', '') })}`];
  return [`${n.metric.padEnd(9)} ${t('panel.draw.deTo', { value: n.value.toFixed(2), name: n.ref.name })}`];
}

/** B side of an A/B comparison: another stage of the panel's source or another source. */
export function abSource(b: string, a: Source, p: PanelState, o: DrawOptions): Source | null {
  if (b === 'rgc') return a;
  if (b.startsWith('stage:')) return stageView(baseOf(a), b.slice(6) as Stage);
  if (b.startsWith('src:')) { const s = o.sourceById?.(b.slice(4)); return s ? stageView(s, p.stage ?? o.stage ?? 'signal') : null; }
  return null;
}

export const abLabel = (b: string, s: Source | null) => (b === 'rgc' ? t('panel.draw.rgcSwitched') : b.startsWith('stage:') ? STAGE_LABELS[b.slice(6) as Stage] ?? b : s?.name ?? t('panel.draw.missing'));

/** Last drawn overlay legend per panel (panel coordinates) — the pointer handler drags it. */
export const legendBoxes = new WeakMap<PanelState, Box>();

/** Overlay legend (false colour, R 103, gamut): colour swatch + label rows, draggable. */
function drawLegend(ctx: CanvasRenderingContext2D, frame: Rect, p: PanelState, rows: [string, string][], w: number) {
  const b = legendBox(frame, w, rows.length * 14, p.legendPos);
  legendBoxes.set(p, b);
  ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  rows.forEach(([col, label], i) => {
    const y = b.y + 7 + i * 14;
    ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(b.x, y - 7, w, 14);
    ctx.fillStyle = col; ctx.fillRect(b.x + 2, y - 4, 8, 8);
    ctx.fillStyle = '#ddd'; ctx.fillText(label, b.x + 14, y);
  });
}

function drawAbLabels(ctx: CanvasRenderingContext2D, r: Rect, ab: NonNullable<PanelState['ab']>, a: Source, b: Source | null) {
  ctx.save();
  ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'top';
  const tag = (text: string, x: number, align: CanvasTextAlign) => {
    ctx.textAlign = align; const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(align === 'left' ? x : x - w, r.y + r.h - 20, w, 14);
    ctx.fillStyle = '#ddd'; ctx.fillText(text, align === 'left' ? x + 4 : x - 4, r.y + r.h - 18);
  };
  const aName = a.name + (chainOf(a) ? ` · ${STAGE_LABELS[chainOf(a)!.stage]}` : '');
  if (!b || !b.ready) tag(t('panel.draw.bNoData', { b: abLabel(ab.b, b) }), r.x + 4, 'left');
  else if (ab.mode === 'diff') tag(`|A − B| × ${ab.gain ?? 4} · A ${aName} · B ${abLabel(ab.b, b)}`, r.x + 4, 'left');
  else {
    const x = r.x + r.w * (ab.mode === 'split' || ab.mode === 'wipe' ? splitPos(ab) : 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, r.y); ctx.lineTo(Math.round(x) + 0.5, r.y + r.h); ctx.stroke();
    tag(`A ${aName}`, x - 4, 'right');
    tag(`B ${abLabel(ab.b, b)}`, x + 4, 'left');
  }
  ctx.restore();
}

export function panelSignature(p: PanelState, src: Source | null, body: Rect, o: DrawOptions): string {
  if (p.scope === 'skinall') {
    const { all, list } = skinSources(p, o);
    return `K|${list.map((s) => `${all.indexOf(s)}:${s.name}:${s.id}:${s.frameSeq}:${s.statsVersion}:${s.status}:${s.faceMode}:${s.activeRois().flat().join(',')}`).join(';')}|${JSON.stringify(p)}|${JSON.stringify(o.skin)}|${o.ref?.source()?.id ?? ''}|${body.x},${body.y},${body.w},${body.h}`;
  }
  if (p.scope === 'drift') return `${driftSignature(p.drift, driftSources(p, o).list)}|${body.x},${body.y},${body.w},${body.h}`;
  if (p.scope === 'chart') {
    const { list } = chartSources(p, o);
    return `${chartSignature(p.chart, list, o.ref?.source()?.id)}|${body.x},${body.y},${body.w},${body.h}`;
  }
  if (p.scope === 'tiles') {
    const plan = tilePlan(p, body, o);
    return `T|${plan.tiles.map(({ src: s, no, cell, sub }) => `${no}:${s.name}:${panelSignature(sub, s, tileBody(body, cell), o)}`).join('||')}|${body.w}x${body.h}`;
  }
  // clocks run: redraw at 25 Hz
  const tick = p.scope === 'clock' || (p.scope === 'picture' && p.clockOverlay) ? `|t${Math.floor(performance.now() / 40)}`
    // QC log: new events, and the durations of active ones once a second
    : p.scope === 'genlock' ? `|g${Math.floor(Date.now() / 250)}`
    // simulcast map: chain settings of other stages can change without a new frame
    : p.scope === 'simulcast' ? `|s${Math.floor(Date.now() / 500)}`
    // encoder confidence samples programme and return while it is drawn: 25 Hz
    : p.scope === 'encoder' ? `|e${Math.floor(Date.now() / 40)}`
    // lens fingerprint: stored prints can change without a new frame
    : p.scope === 'lens' ? `|l${Math.floor(Date.now() / 500)}`
    // CIE: the share outside the target gamut is counted twice a second (#181)
    : p.scope === 'cie' && p.gamutShare !== false ? `|c${Math.floor(Date.now() / 500)}`
    // SDI signal info: VANC records arrive beside the frames and go stale
    : p.scope === 'sdi' ? `|v${src?.vanc?.at ?? 0}:${Math.floor(Date.now() / 1000)}`
    : p.scope === 'qclog' ? `|q${qcLog.version}:${Math.floor(Date.now() / 1000)}` : '';
  if (p.scope === 'clock') return `C|${src?.id}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}${tick}`;
  if (isLight(p.scope)) return `${lightSignature(p.scope, p.light, body.w, body.h)}|${body.x},${body.y}`;
  if (isAudio(p.scope)) {
    const a = src?.audio;
    return `A|${src?.id}:${a ? `${a.version}:${a.paused}:${a.stale}` : `${src?.status}:${src?.message}`}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}`;
  }
  // the frame has to be redrawn when the state changes, even if nothing else did (#182)
  const alarm = p.alarm?.on ? `|A${alarmOf(p, src)}` : '';
  if (src) src = stageView(src, p.stage ?? o.stage ?? 'signal');
  const s = src ? `${chainOf(src)?.sig ?? ''}:${src.id}:${src.frameSeq}:${src.status}:${src.message}:${src.width}x${src.height}:${src.colorspace}:${src.transfer}:${src.gamut}:${src.hlgLw}:${src.probe?.x},${src.probe?.y}:${src.roi?.join(',')}:${src.faceMode}:${src.faces.map((f) => f.id + '/' + f.box.join(',')).join(';')}:${[...src.faceSel].join(',')}:${p.scope === 'hist' || p.scope === 'stats' ? src.statsVersion : ''}${p.scope === 'timeline' ? `h${src.history.version}` : ''}${p.scope === 'match' ? matchSignature(p.match, src, matchCtx(o)) : ''}` : '-';
  const bs = p.scope === 'picture' && src && p.ab && p.ab.mode !== 'off' ? abSource(p.ab.b, src, p, o) : null;
  const abSig = bs ? `|B${bs.id}:${bs.frameSeq}:${bs.status}:${chainOf(bs)?.sig ?? ''}` : '';
  const { displayFps, ...rest } = o;
  // compact level bar on the picture: redraw at 20 Hz of audio time
  const bar = p.scope === 'picture' && p.audioBar !== false && src?.audio ? `${Math.floor(src.audio.frames / (src.audio.fs / 20))}:${src.audio.stale}` : '';
  const refSig = p.ghost && o.ref && hasGhost(p.scope) ? `|R${o.ref.sig}:${src?.statsVersion}` : '';
  return `${s}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}|${JSON.stringify(rest)}|${p.scope === 'stats' ? displayFps : ''}${tick}${alarm}|${bar}${abSig}${refSig}`;
}

export const defaultPanel = (scope: ScopeType): PanelState => ({
  scope, sourceId: '', gain: 1, colorize: scope === 'vector' || scope === 'vector3' || scope === 'hls' || scope === 'cie' || scope === 'cube' || scope === 'satlum' || scope === 'chplot', zoom: 1, picture: 'normal', hist: 'rgb', log: false,
});

const PARADE: ScopeType[] = ['parade', 'yrgb', 'wf-rgb'];

const SCATTER: Partial<Record<ScopeType, ScatterMode>> = {
  'wf-luma': 'luma', 'wf-color': 'luma', 'wf-skin': 'skin', 'wf-green': 'skin', 'wf-rgb': 'rgb', parade: 'parade', yrgb: 'yrgb', ycbcr: 'ycbcr', vector: 'vector', vector3: 'vector', hls: 'hls', cie: 'cie', diamond: 'diamond', cube: 'cube', satlum: 'satlum', chplot: 'chplot',
};

/**
 * @param body panel body in CSS px relative to the renderer canvas
 * @param ctx  2D context of the panel overlay, already scaled to CSS px and cleared
 */
export function drawPanel(renderer: Renderer, ctx: CanvasRenderingContext2D, key: string, p: PanelState, src: Source | null, body: Rect, o: DrawOptions) {
  drawPanelBody(renderer, ctx, key, p, src, body, o);
  // alarm frame over everything the panel drew (#182)
  const col = p.alarm?.on ? alarmColor(alarmOf(p, src), p.alarm) : '';
  if (col) {
    const w = Math.max(1, Math.min(16, p.alarm?.width ?? DEFAULT_ALARM.width));
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.strokeRect(w / 2, w / 2, Math.max(0, body.w - w), Math.max(0, body.h - w));
    ctx.restore();
  }
}

/** State of the panel's source for the alarm frame; 'ok' without a source. */
export function alarmOf(p: PanelState, src: Source | null, now = Date.now()): AlarmState {
  if (!src) return 'ok';
  return qcLog.alarm(src.id, p.alarm?.types ?? QC_TYPES, Math.max(0, p.alarm?.hold ?? DEFAULT_ALARM.hold), now);
}

function drawPanelBody(renderer: Renderer, ctx: CanvasRenderingContext2D, key: string, p: PanelState, src: Source | null, body: Rect, o: DrawOptions) {
  if (isAudio(p.scope)) {
    const empty = src ? (src.kind === 'stream' && src.settings.audio === false ? t('panel.draw.audioOff')
      : src.status === 'live' ? t('panel.draw.noAudio') : (src.message || t('panel.draw.noData'))) : (o.emptyText ?? t('panel.draw.addSource'));
    drawAudioPanel(ctx, p.scope, src?.audio ?? null, body.w, body.h, p.audio, empty, p);
    return;
  }
  if (p.scope === 'qclog') {
    renderer.clearRect(body);
    drawQcLog(ctx, body.w, body.h, qcLog, p.qcTypes ?? QC_TYPES);
    return;
  }
  if (p.scope === 'timeline') {
    renderer.clearRect(body);
    if (!src || !src.ready) {
      ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(src ? (src.message || t('panel.draw.noData')) : (o.emptyText ?? t('panel.draw.addSource')), body.w / 2, body.h / 2);
      return;
    }
    drawTimeline(ctx, { x: 4, y: 6, w: body.w - 8, h: body.h - 8 }, src.history, src.colorspace, p.span ?? 10);
    return;
  }
  if (p.scope === 'genlock') {
    renderer.clearRect(body);
    drawGenlockPanel(ctx, p.genlock, src, body.w, body.h);
    return;
  }
  if (p.scope === 'clock') {
    renderer.clearRect(body);
    drawClockPanel(ctx, clockOpts(p.clock), src, body.w, body.h);
    return;
  }
  if (isLight(p.scope)) {
    renderer.clearRect(body);
    drawLightPanel(ctx, p.scope, p.light, body.w, body.h);
    return;
  }
  if (p.scope === 'tiles') { drawTiles(renderer, ctx, key, p, body, o); return; }
  if (p.scope === 'skinall') { renderer.clearRect(body); drawSkinAllPanel(ctx, p, body, o); return; }
  if (p.scope === 'drift') {
    renderer.clearRect(body);
    const { all, list } = driftSources(p, o);
    drawDriftPanel(ctx, body.w, body.h, p.drift, all, list, o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (p.scope === 'chart') {
    renderer.clearRect(body);
    const { all, list } = chartSources(p, o);
    drawChartPanel(ctx, body.w, body.h, p.chart, all, list, o.ref?.source()?.id, o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (p.scope === 'sdi') {
    renderer.clearRect(body);
    drawSdiPanel(ctx, body.w, body.h, src, o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (p.scope === 'lens') {
    renderer.clearRect(body);
    drawLensPanel(ctx, body.w, body.h, p.lens, src, o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (p.scope === 'encoder') {
    renderer.clearRect(body);
    drawEncoderPanel(ctx, body.w, body.h, p.encoder, src, o.sourceById ?? (() => null), o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (p.scope === 'simulcast') {
    renderer.clearRect(body);
    drawSimulcastPanel(ctx, body.w, body.h, p.simulcast, src, o.emptyText ?? t('panel.draw.addSource'));
    return;
  }
  if (src) src = stageView(src, p.stage ?? o.stage ?? 'signal');
  const aspect = src && src.width ? src.width / src.height : 16 / 9;
  const frame = plotRect(p.scope, body.w, body.h, aspect);
  const abs = { x: body.x + frame.x, y: body.y + frame.y, w: frame.w, h: frame.h };
  renderer.clearRect(abs);
  // gesture zoom (#89): GL through the shader view (scatter) or a larger picture rect; the
  // overlay draws with the zoomed rect `r`, clipped, so graticule and markers follow the trace
  const xv = xyView(p);
  const r = xv ? viewRect(frame, xv) : frame;
  const absV = { x: body.x + r.x, y: body.y + r.y, w: r.w, h: r.h };
  const wz = isWaveform(p.scope) && p.view ? p.view.z : 1;

  if (!src || !src.ready) {
    ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(src ? (src.message || t('panel.draw.noData')) : (o.emptyText ?? t('panel.draw.addSource')), body.w / 2, body.h / 2);
    if (isWaveform(p.scope)) drawWaveGraticule(ctx, p.scope, r, p.unit ?? o.unit, src?.transfer ?? 'sdr', waveOpts(p, src));
    return;
  }
  if (xv) {
    ctx.save();
    const c = LABELS_OUTSIDE.includes(p.scope) ? { x: 0, y: 0, w: body.w, h: body.h } : frame;
    ctx.beginPath(); ctx.rect(c.x, c.y, c.w, c.h); ctx.clip();
  }
  const probeRgb = src.probe ? src.readPixel(src.probe.x, src.probe.y) : null;
  const mode = p.scope === 'cube' && p.cube?.lutOnly && p.cube?.lut ? undefined : SCATTER[p.scope];
  const ref = refView(src, p, o);
  if (mode) {
    const crt = crtOf(p);
    const cube = p.scope === 'cube' ? { ...DEFAULT_CUBE, ...p.cube } : null;
    const params = (s: Source): ScatterParams => ({
      ...(crt ? { crt } : {}),
      ...(!crt && p.persist ? { persist: p.persist } : {}),
      ...(p.smooth ? { smooth: p.smooth } : {}),
      ...(p.scope === 'chplot' ? { pair: p.pair ?? 0 } : {}),
      ...(cube ? { cube: {
        space: CUBE_SPACE_ID[cube.space], rot: cubeRotation(cube.yaw, cube.pitch), to2020: gamutConvert(GAMUTS[src.gamut], GAMUTS['2020']),
        white: mul3(rgbToXyzMatrix(GAMUTS[src.gamut]), [1, 1, 1]), nits: cubeNits(src.transfer),
        view: { zoom: cube.zoom ?? 1, panX: cube.panX ?? 0, panY: cube.panY ?? 0 },
      } } : {}),
      ...(xv ? { view: [xv.z, xv.x, xv.y] as [number, number, number], density: xv.z * xv.z } : wz !== 1 ? { density: wz } : {}),
      mode, gain: p.gain, colorize: PARADE.includes(p.scope) ? ({ mono: 0, channel: 1, source: 2 } as const)[p.paradeColor ?? (p.colorize ? 'channel' : 'mono')] : p.scope === 'wf-color' || p.colorize, zoom: p.zoom, tint: crt ? [...PHOSPHORS[crt.phosphor].color] as [number, number, number] : [...TINTS[o.tint]] as [number, number, number],
      maxSamples: o.maxSamples, roi: s.activeRois(), skin: p.scope === 'wf-green' ? greenOf(o) : o.skin, cieUv: p.scope === 'cie' && !!p.cieUv,
      ...(isWaveform(p.scope) ? { range: waveRangeOf(p), ...(({ sec, n }) => ({ sec, secN: n }))(channelLayout(p.scope, p.channels)) } : {}),
    });
    if (p.scope === 'vector3') {
      // one vectorscope per tonal range (#180): same trace, three luma windows, three rects
      const bands = vectorBands(p.bands);
      const big = p.big ?? 0;
      vectorBandRects(r, big).forEach((br, i) => {
        const band = bands[big ? big - 1 : i];
        const a = { x: body.x + br.x, y: body.y + br.y, w: br.w, h: br.h };
        renderer.drawScatter(`${key}#b${i}`, src, a, { ...params(src), luma: band });
        if (ref) {
          const { crt: _c, persist: _p, ...rp } = params(ref);
          renderer.drawScatter(`${key}#b${i}#ref`, ref, a, { ...rp, colorize: 0, luma: band }, true, o.ref!.opacity, { tint: GHOST_TINT, snapshot: o.ref!.frozen ? o.ref!.snapshot : undefined });
        }
      });
    } else {
      renderer.drawScatter(key, src, abs, params(src));
      if (ref) {
        // reference trace: same geometry, mono, no beam look or persistence, added on top
        const { crt: _c, persist: _p, ...rp } = params(ref);
        renderer.drawScatter(`${key}#ref`, ref, abs, { ...rp, colorize: 0 }, true, o.ref!.opacity, { tint: GHOST_TINT, snapshot: o.ref!.frozen ? o.ref!.snapshot : undefined });
      }
    }
  }
  if (isWaveform(p.scope)) {
    const wo = waveOpts(p, src);
    drawWaveGraticule(ctx, p.scope, r, p.unit ?? o.unit, src.transfer, wo);
    if (p.scope === 'wf-skin' && p.skinBand !== false) drawSkinRange(ctx, r, o.skin, wo.range);
    if (p.scope === 'wf-green' && p.greenBand !== false) drawSkinRange(ctx, r, greenOf(o), wo.range, true);
    if (probeRgb) drawWaveProbe(ctx, p.scope, r, src, probeRgb, wo);
  } else if (p.scope === 'vector') {
    const g = greenOf(o);
    drawVectorGraticule(ctx, r, src.colorspace, p.zoom, o.skin.tol, vectorTargets(src), p.greenWedge ? { hue: g.hue ?? GREEN_DEFAULT.hue, tol: g.tol } : undefined);
    drawVectorExtras(ctx, r, src.colorspace, p.zoom, p.gamuts ?? [], o.targets ?? [], src.transfer, src.gamut, src.hlgLw);
    if (probeRgb) {
      const { cb, cr } = ycbcr(probeRgb[0], probeRgb[1], probeRgb[2], src.colorspace);
      const [x, y] = vectorPoint(r, cb, cr, p.zoom);
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
    }
  } else if (p.scope === 'vector3') {
    const bands = vectorBands(p.bands);
    const big = p.big ?? 0;
    const names = [t('panel.vec3.low'), t('panel.vec3.mid'), t('panel.vec3.high')];
    vectorBandRects(r, big).forEach((br, i) => {
      const n = big ? big - 1 : i;
      const [lo, hi] = bands[n];
      drawVectorGraticule(ctx, br, src.colorspace, p.zoom, o.skin.tol, vectorTargets(src));
      ctx.fillStyle = LABEL; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const range = `${Math.max(0, Math.round(lo * 100))}–${Math.min(100, Math.round(hi * 100))} %`;
      ctx.fillText(`${names[n]} · ${range}`, br.x + br.w / 2, Math.max(10, br.y - 4));
    });
  } else if (p.scope === 'hls') {
    drawHlsGraticule(ctx, r, src.colorspace, p.zoom);
    if (probeRgb) {
      const q = hsl(probeRgb[0], probeRgb[1], probeRgb[2]);
      const [x, y] = hlsPoint(r, q.h, q.s, src.colorspace, p.zoom);
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
    }
  } else if (p.scope === 'cie') {
    const target = p.gamutTarget ?? '709';
    drawCieGraticule(ctx, r, src.colorspace, { uv: p.cieUv, gamut: src.gamut, target: p.gamutShare === false ? undefined : target });
    // share of the picture outside the target gamut (#181): the number to the picture's gamut warning
    if (p.gamutShare !== false) {
      const g = src.gamutOutside(target);
      ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      if (!g) ctx.fillStyle = 'rgba(230, 215, 170, 0.6)';
      else ctx.fillStyle = g.share > 0.01 ? '#ffb300' : LABEL;
      const pct = (v: number) => `${(v * 100).toFixed(v >= 0.01 ? 1 : 2)} %`;
      // the overlay context is relative to the panel body
      ctx.fillText(g ? t('panel.cie.outside', { pct: pct(g.share), gamut: GAMUTS[target].name }) + (g.far > 0 ? ` · ${pct(g.far)} ${t('panel.cie.far')}` : '') : t('panel.cie.outsideWait'),
        4, body.h - 4);
    }
  } else if (p.scope === 'minmax') {
    const lim = p.minmax?.limits === 'legal' ? [0, 1] : [-0.05, 1.05];
    drawMinMax(ctx, r, src.lineExtremes(), { lo: lim[0], hi: lim[1], targets: (p.minmax?.targets ?? []).slice(0, 4).map((t) => t / 100) });
  } else if (p.scope === 'satlum') {
    drawSatLumGraticule(ctx, r);
  } else if (p.scope === 'chplot') {
    drawChannelPlotGraticule(ctx, r, p.pair ?? 0);
  } else if (p.scope === 'cube') {
    const c = { ...DEFAULT_CUBE, ...p.cube };
    const lut = c.lut ? LUTS.get(c.lut) : undefined;
    if (lut) {
      const key = `${lut.name}#${lut.version}:${c.lutGrid ?? 17}`;
      if (lutVolCache.key !== key) lutVolCache = { key, pts: lutVolume((rgb) => applyLut(lut, rgb), c.lutGrid ?? 17) };
      drawLutVolume(ctx, r, c, lutVolCache.pts, (rgb) => cubeQOf(c.space, rgb, src), !!c.lutInput);
    }
    drawCubeGraticule(ctx, r, c, src.gamut, cubeNits(src.transfer), probeRgb ? cubeQOf(c.space, probeRgb, src) : null, src.colorspace);
  } else if (p.scope === 'diamond') {
    drawDiamondGraticule(ctx, r);
    if (probeRgb) {
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      for (const [a, upper] of [[probeRgb[2], true], [probeRgb[0], false]] as [number, boolean][]) {
        const [x, y] = diamondPoint(r, a, probeRgb[1], upper);
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
  } else if (p.scope === 'hist') {
    const rpx = ref ? atStage(ref, o.ref!.frozen && o.ref!.samples ? o.ref!.samples() : frameSamples(ref)) : null;
    drawHistogram(ctx, r, src, p.hist, p.log, ref && rpx?.length ? { hist: histOf(rpx, LUMA[ref.colorspace].kr, LUMA[ref.colorspace].kb), color: GHOST_CSS, alpha: Math.min(1, 0.3 + o.ref!.opacity) } : undefined);
  } else if (p.scope === 'picture') {
    legendBoxes.delete(p);
    const pic = (s: Source, rgcOn = !!p.rgc): PictureParams => ({
      mode: p.picture, bands: FALSE_COLOR_PRESETS[o.falsePreset] ?? [], zebra: o.zebra, zebraLow: o.zebraLow,
      roi: s.activeRois(), skin: p.picture === 'green' ? greenOf(o) : o.skin, display: displayParams(s, o.display, o.hdrPreview), warn: warnMatrix(s, p.gamutTarget),
      ...(p.picture === 'neutral' ? { neutral: neutralParams(p) } : {}),
      ...(p.picture === 'peaking' ? { peaking: { threshold: p.peak?.threshold ?? PEAK_DEFAULT.threshold, colour: PEAK_COLOURS[p.peak?.colour ?? PEAK_DEFAULT.colour] } } : {}),
      ...(rgcOn ? { rgc: { toAp1: gamutConvert(GAMUTS[s.gamut], GAMUTS.ap1), fromAp1: gamutConvert(GAMUTS.ap1, GAMUTS[s.gamut]) } } : {}),
    });
    const ab = p.ab && p.ab.mode !== 'off' ? p.ab : null;
    const bSrc = ab ? abSource(ab.b, src, p, o) : null;
    // B 'rgc': the same picture with the gamut compression switched the other way
    const picB = (s: Source) => pic(s, ab?.b === 'rgc' ? !p.rgc : !!p.rgc);
    if (ab && bSrc?.ready) {
      if (ab.mode === 'diff') {
        if (!renderer.drawPictureDiff(key, src, pic(src), bSrc, picB(bSrc), absV, ab.gain ?? 4, abs)) renderer.drawPicture(src, absV, pic(src), abs);
      } else if (ab.mode === 'crop' || ab.mode === 'butterfly') {
        // measuring frame (or first face) of A and of B, scaled into the panel (match/crop.ts)
        const ba = baseOf(src), bb = baseOf(bSrc);
        const plan = cropPlan(ab.mode, abs, regionOf(ba.activeRois(), ba.width, ba.height), [ba.width, ba.height], regionOf(bb.activeRois(), bb.width, bb.height), [bb.width, bb.height]);
        renderer.drawPicture(src, plan.a.rect, pic(src), plan.a.clip);
        renderer.drawPicture(bSrc, plan.b.rect, { ...picB(bSrc), mirror: plan.b.mirror }, plan.b.clip);
      } else {
        const pos = splitPos(ab);
        renderer.drawPicture(src, absV, pic(src), { x: abs.x, y: abs.y, w: abs.w * pos, h: abs.h });
        renderer.drawPicture(bSrc, absV, picB(bSrc), { x: abs.x + abs.w * pos, y: abs.y, w: abs.w * (1 - pos), h: abs.h });
      }
    } else renderer.drawPicture(src, absV, pic(src), abs);
    if (ab) drawAbLabels(ctx, frame, ab, src, bSrc);
    // crop/butterfly show only the regions: face and frame marks would sit in the wrong place
    const cropped = ab?.mode === 'crop' || ab?.mode === 'butterfly';
    if (cropped) { /* regions fill the panel */ } else if (src.faceTrack) {
      // detected faces, numbered left to right; active ones highlighted
      src.faces.forEach(({ id, box: f }, i) => {
        const on = src.faceMode === 'all' || src.faceSel.has(id);
        const rx = r.x + (f[0] / src.width) * r.w, ry = r.y + (f[1] / src.height) * r.h;
        const rw = ((f[2] - f[0]) / src.width) * r.w, rh = ((f[3] - f[1]) / src.height) * r.h;
        ctx.strokeStyle = on ? '#ffb840' : 'rgba(255,255,255,0.45)'; ctx.lineWidth = on ? 2 : 1;
        ctx.setLineDash(on ? [] : [4, 3]); ctx.strokeRect(rx, ry, rw, rh); ctx.setLineDash([]);
        ctx.fillStyle = on ? '#ffb840' : 'rgba(255,255,255,0.7)';
        ctx.fillRect(rx, ry - 15, 18, 15);
        ctx.fillStyle = '#111'; ctx.font = '600 11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), rx + 9, ry - 7);
      });
      if (!src.faces.length) drawTextBox(ctx, frame.x + 6, frame.y + frame.h - 28, [t('panel.draw.searchFaces')]);
      else if (src.faceMode === 'detect' && !src.faceSel.size) drawTextBox(ctx, frame.x + 6, frame.y + frame.h - 28, [t('panel.draw.clickFace')]);
    } else if (src.roi) {
      const [x0, y0, x1, y1] = src.roi;
      ctx.strokeStyle = '#ffb840'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      const rx = r.x + (x0 / src.width) * r.w, ry = r.y + (y0 / src.height) * r.h, rw = ((x1 - x0) / src.width) * r.w, rh = ((y1 - y0) / src.height) * r.h;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      // close box at the top-right corner (click removes the ROI)
      const [bx, by] = roiCloseBox(rx, ry, rw);
      ctx.fillStyle = '#ffb840'; ctx.fillRect(bx, by, ROI_CLOSE, ROI_CLOSE);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + 4, by + 4); ctx.lineTo(bx + ROI_CLOSE - 4, by + ROI_CLOSE - 4); ctx.moveTo(bx + ROI_CLOSE - 4, by + 4); ctx.lineTo(bx + 4, by + ROI_CLOSE - 4); ctx.stroke();
    }
    if (p.picture === 'false') {
      const bands = FALSE_COLOR_PRESETS[o.falsePreset] ?? [];
      ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const text = bands.map((bd) => `${bandRange(bd)} % ${bd.label}`);
      const bw = Math.max(150, ...text.map((s) => ctx.measureText(s).width + 20));
      drawLegend(ctx, frame, p, bands.map((bd, i) => [bd.color, text[i]]), bw);
    }
    if (p.picture === 'r103') {
      const q = src.r103Stats();
      const legend: [string, string][] = [
        ['#ffb31a', `${t('panel.draw.r103Pref')}${q ? ` · ${(q.pref * 100).toFixed(2)} %${q.alarm ? ' ⚠' : ''}` : ''}`],
        ['#ff1a33', `${t('panel.draw.r103Total')}${q ? ` · ${(q.total * 100).toFixed(2)} %` : ''}`],
      ];
      if (!src.yuv) legend.push(['#888', t('panel.draw.rgbClipped')]);
      drawLegend(ctx, frame, p, legend, 250);
    }
    if (p.picture === 'peaking') {
      const fv = focusOf(src);
      if (fv) {
        if (!src.activeRois().length) {
          // the centre third that is measured without a measuring frame
          const [x0, y0, x1, y1] = fv.rect;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
          ctx.strokeRect(r.x + (x0 / src.width) * r.w, r.y + (y0 / src.height) * r.h, ((x1 - x0) / src.width) * r.w, ((y1 - y0) / src.height) * r.h);
          ctx.setLineDash([]);
        }
        const lines = [t('focus.value', { value: fv.value.toFixed(1), peak: fv.peak.toFixed(1), pct: fv.peak > 0 ? Math.round((fv.value / fv.peak) * 100) : 0 })];
        drawTextBox(ctx, frame.x + 6, frame.y + frame.h - 6 - lines.length * 15 - 8, lines);
        // bar: current value against the peak hold
        const bw = 120, bx = frame.x + 6, by = frame.y + frame.h - 6 - lines.length * 15 - 16;
        ctx.fillStyle = 'rgba(8,9,11,0.78)'; ctx.fillRect(bx, by, bw, 6);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(bx, by, fv.peak > 0 ? (bw * fv.value) / fv.peak : 0, 6);
      } else drawTextBox(ctx, frame.x + 6, frame.y + frame.h - 29, [t('panel.draw.noCpu')]);
    }
    if (p.picture === 'neutral') {
      const np = neutralParams(p), nc = src.neutralCast(np.threshold, np.lo, np.hi);
      const lines = [t('panel.draw.nearNeutral', { sat: (np.threshold * 100).toFixed(0), lo: (np.lo * 100).toFixed(0), hi: (np.hi * 100).toFixed(0) }),
        nc ? `${t('panel.draw.castShare', { share: (nc.share * 100).toFixed(1), amount: (nc.amount * 100).toFixed(2) })}${nc.amount > 0.002 ? ` ${t('panel.draw.castTowards', { hue: castName(nc.deg, src.colorspace) })}` : t('panel.draw.castNeutral')}` : t('panel.draw.noCpu')];
      drawTextBox(ctx, frame.x + 6, frame.y + frame.h - 6 - lines.length * 15 - 8, lines);
    }
    if (p.picture === 'gamut') {
      const legend: [string, string][] = [
        ['#ffe61a', t('panel.draw.justOutside', { gamut: GAMUTS[p.gamutTarget ?? '709'].name })], ['#ff730d', t('panel.draw.outside')], ['#ff1abf', t('panel.draw.farOutside')],
      ];
      drawLegend(ctx, frame, p, legend, 200);
    }
    if (src.probe && probeRgb) {
      const x = r.x + ((src.probe.x + 0.5) / src.width) * r.w, y = r.y + ((src.probe.y + 0.5) / src.height) * r.h;
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10); ctx.stroke();
      drawTextBox(ctx, frame.x + frame.w - 6, frame.y + 6, [...probeLines(src, probeRgb, p.unit ?? o.unit), ...deLines(src, probeRgb, o)], 'right');
    }
    if (o.frozen) drawTextBox(ctx, frame.x + 6, frame.y + 6, [t('panel.draw.frozen')]);
    if (p.clockOverlay) drawClockOverlay(ctx, clockOpts(p.clock), src, frame.x + frame.w - 6, frame.y + frame.h - 6);
    if (p.audioBar !== false && src.audio) drawAudioBar(ctx, src.audio, frame);
  } else if (p.scope === 'match') {
    drawMatchPanel(ctx, body.w, body.h, p.match, src, matchCtx(o));
  } else if (p.scope === 'wshading') {
    drawShadingPanel(ctx, p, src, body);
  } else if (p.scope === 'noise') {
    drawNoisePanel(ctx, p, src);
  } else if (p.scope === 'shguide') {
    drawGuidePanel(ctx, p.shguide ?? {}, src, body.w, wrapText);
  } else if (p.scope === 'stats') {
    const lines = statsLines(src, o.displayFps);
    if (probeRgb) lines.push('', t('settings.stage.point'), ...[...probeLines(src, probeRgb, p.unit ?? o.unit), ...deLines(src, probeRgb, o)]);
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#d6d6d6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 12, 10 + i * 15));
  }
  if (xv) ctx.restore();
  // smoothing changes what is measured, so the panel says it (#179)
  const note = smoothNote(p);
  if (note) {
    ctx.fillStyle = '#ffb300'; ctx.font = FONT; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(note, body.w - 6, body.h - 6);
  }
  if (ref) drawGhostDeltas(ctx, p.scope === 'hist' ? { ...frame, y: frame.y + 16 } : frame, p.scope, src, ref, o);
}

/**
 * What the panel has to admit about its own reading (#179): a signal low-pass averages noise
 * away – and a real single-pixel spike with it – and a smoothed trace is older than this frame.
 * Empty when nothing is smoothed; the CRT look is a look, not a filter, and says so itself.
 */
export function smoothNote(p: PanelState): string {
  const parts: string[] = [];
  if (p.smooth) parts.push(t('panel.sig.noteSignal', { grid: p.smooth === 2 ? '5×5' : '3×3' }));
  if (p.persist && !p.crt?.on) parts.push(t('panel.sig.noteTrace', { s: p.persist < 0 ? '∞' : num(p.persist / 1000, 1) }));
  return parts.length ? `${t('panel.sig.note')} ${parts.join(' · ')}` : '';
}
