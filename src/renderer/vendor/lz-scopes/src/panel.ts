// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Draws one scope panel (WebGL trace + 2D overlay). Shared by the full app and the
// embeddable ScopeView (src/embed.ts).

import { DISPLAY_LABELS, FALSE_COLOR_PRESETS, GAMUTS, mul3, rgbToXyzMatrix, bandRange, gamutConvert, isLog, logBarTargets, transferLabel, ycbcr, type DisplaySpace, type GamutId, type HdrPreview } from './color';
import {
  drawChannelPlotGraticule, drawCubeGraticule, drawLutVolume, drawDiamondGraticule, drawSatLumGraticule, diamondPoint, drawVectorExtras, type VectorTarget, drawSkinRange, drawCieGraticule, drawHistogram, drawTextBox, drawVectorGraticule, drawWaveGraticule, drawWaveProbe,
  WAVE_ZOOMS, channelLayout, isAudio, isWaveform, plotRect, type WaveChannels, type WaveOpts, type WaveZoom, probeLines, statsLines, vectorPoint, type ScopeType, type Unit, type BarTargetSet,
} from './graticule';
import { drawAudioBar, drawAudioPanel, type AudioPanelOptions } from './audio/panels';
import type { DisplayParams, PictureMode, PictureParams, Rect, Renderer, ScatterMode, SkinRange } from './renderer';
import type { Source } from './sources';
import { barRefs, nearest, type DeRef } from './deltae';
import { LUTS, applyLut } from './lut';
import { lutVolume } from './cube';

/** LUT volume of the last drawn cube panel (recomputed when LUT, version or lattice change). */
let lutVolCache: { key: string; pts: { inp: number[]; out: number[] }[] } = { key: '', pts: [] };
import { QC_TYPES, drawQcLog, qcLog, type QcType } from './qclog';
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
import { drawLightPanel, isLight, lightSignature, type LightPanelOptions } from './opple/scopes';

export interface PanelState {
  scope: ScopeType; sourceId: string; gain: number; colorize: boolean; zoom: number;
  picture: PictureMode; hist: 'rgb' | 'luma' | 'split'; log: boolean;
  /** parades / RGB overlay: 'mono' | 'channel' | 'source' colours */
  paradeColor?: 'mono' | 'channel' | 'source';
  /** vectorscope: gamut boundaries to show */
  gamuts?: ('709' | 'p3' | '2020')[];
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
  /** waveforms: zoom into blacks/highlights, visible channels (parade/YRGB/RGB), channel names and unit */
  waveZoom?: WaveZoom; channels?: WaveChannels; names?: boolean;
  /** clock panel settings (src/clock/panel.ts); also used by the picture overlay */
  clock?: Partial<ClockOptions>;
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
   * split = divider at 50 %, wipe = divider at `pos`, diff = max |A − B| × `gain`.
   */
  ab?: { mode: 'off' | 'split' | 'wipe' | 'diff'; b: string; pos?: number; gain?: number };
  /** picture: ACES 1.3 reference gamut compression as a preview (picture and gamut warning, not the scopes) */
  rgc?: boolean;
  /** picture: compact time of day / source time code in the corner */
  clockOverlay?: boolean;
  /** light scopes (Opple Light Master, src/opple/scopes.ts) */
  light?: Partial<LightPanelOptions>;
}

/** CRT settings of a panel with defaults; null = digital display. */
export const crtOf = (p: PanelState): CrtSettings | null => (p.crt?.on ? { ...DEFAULT_CRT, ...p.crt, on: true } : null);

/** Graticule options of a waveform panel. */
export const waveOpts = (p: PanelState, src: Source | null): WaveOpts => ({
  lw: src?.hlgLw, r103: p.r103, marks: p.marks, range: WAVE_ZOOMS[p.waveZoom ?? 'full'], channels: p.channels, names: p.names,
});

export const TINTS = { white: [1, 1, 1], green: [0.55, 1, 0.62], amber: [1, 0.82, 0.45] } as const;
export type Tint = keyof typeof TINTS;

export interface DrawOptions {
  unit: Unit; tint: Tint; maxSamples: number; falsePreset: string;
  zebra: number; zebraLow: number; frozen: boolean; displayFps: number;
  skin: SkinRange; display: DisplaySpace;
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
}

export const DEFAULT_SKIN: SkinRange = { lo: 0.3, hi: 0.8, tol: 14 };

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
  const t = src.transfer;
  if (!isLog(t)) return undefined;
  return { t100: logBarTargets(t, src.gamut, src.colorspace, 1), t75: logBarTargets(t, src.gamut, src.colorspace, 0.75), label: `709-Balken in ${transferLabel(t)}/${GAMUTS[src.gamut].name}` };
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
    : (o.targets ?? []).filter((t) => r === 'targets' || r === `target:${t.name}`).map((t) => ({ name: t.name, rgb: t.rgb }));
  const n = nearest(src, rgb, refs);
  if (!n) return [`ΔE        – (kein Bezug „${r.replace('target:', '')}“)`];
  return [`${n.metric.padEnd(9)} ${n.value.toFixed(2)} zu ${n.ref.name}`];
}

/** B side of an A/B comparison: another stage of the panel's source or another source. */
export function abSource(b: string, a: Source, p: PanelState, o: DrawOptions): Source | null {
  if (b === 'rgc') return a;
  if (b.startsWith('stage:')) return stageView(baseOf(a), b.slice(6) as Stage);
  if (b.startsWith('src:')) { const s = o.sourceById?.(b.slice(4)); return s ? stageView(s, p.stage ?? o.stage ?? 'signal') : null; }
  return null;
}

export const abLabel = (b: string, s: Source | null) => (b === 'rgc' ? 'RGC umgeschaltet' : b.startsWith('stage:') ? STAGE_LABELS[b.slice(6) as Stage] ?? b : s?.name ?? 'fehlt');

function drawAbLabels(ctx: CanvasRenderingContext2D, r: Rect, ab: NonNullable<PanelState['ab']>, a: Source, b: Source | null) {
  ctx.save();
  ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'top';
  const tag = (t: string, x: number, align: CanvasTextAlign) => {
    ctx.textAlign = align; const w = ctx.measureText(t).width + 8;
    ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(align === 'left' ? x : x - w, r.y + r.h - 20, w, 14);
    ctx.fillStyle = '#ddd'; ctx.fillText(t, align === 'left' ? x + 4 : x - 4, r.y + r.h - 18);
  };
  const aName = a.name + (chainOf(a) ? ` · ${STAGE_LABELS[chainOf(a)!.stage]}` : '');
  if (!b || !b.ready) tag(`B: ${abLabel(ab.b, b)} – keine Daten, nur A`, r.x + 4, 'left');
  else if (ab.mode === 'diff') tag(`|A − B| × ${ab.gain ?? 4} · A ${aName} · B ${abLabel(ab.b, b)}`, r.x + 4, 'left');
  else {
    const x = r.x + r.w * (ab.mode === 'split' ? 0.5 : Math.max(0, Math.min(1, ab.pos ?? 0.5)));
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, r.y); ctx.lineTo(Math.round(x) + 0.5, r.y + r.h); ctx.stroke();
    tag(`A ${aName}`, x - 4, 'right');
    tag(`B ${abLabel(ab.b, b)}`, x + 4, 'left');
  }
  ctx.restore();
}

export function panelSignature(p: PanelState, src: Source | null, body: Rect, o: DrawOptions) {
  // clocks run: redraw at 25 Hz
  const tick = p.scope === 'clock' || (p.scope === 'picture' && p.clockOverlay) ? `|t${Math.floor(performance.now() / 40)}`
    // QC log: new events, and the durations of active ones once a second
    : p.scope === 'qclog' ? `|q${qcLog.version}:${Math.floor(Date.now() / 1000)}` : '';
  if (p.scope === 'clock') return `C|${src?.id}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}${tick}`;
  if (isLight(p.scope)) return `${lightSignature(p.scope, p.light, body.w, body.h)}|${body.x},${body.y}`;
  if (isAudio(p.scope)) {
    const a = src?.audio;
    return `A|${src?.id}:${a ? `${a.version}:${a.paused}:${a.stale}` : `${src?.status}:${src?.message}`}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}`;
  }
  if (src) src = stageView(src, p.stage ?? o.stage ?? 'signal');
  const s = src ? `${chainOf(src)?.sig ?? ''}:${src.id}:${src.frameSeq}:${src.status}:${src.message}:${src.width}x${src.height}:${src.colorspace}:${src.transfer}:${src.gamut}:${src.hlgLw}:${src.probe?.x},${src.probe?.y}:${src.roi?.join(',')}:${src.faceMode}:${src.faces.map((f) => f.id + '/' + f.box.join(',')).join(';')}:${[...src.faceSel].join(',')}:${p.scope === 'hist' || p.scope === 'stats' ? src.statsVersion : ''}${p.scope === 'timeline' ? `h${src.history.version}` : ''}` : '-';
  const bs = p.scope === 'picture' && src && p.ab && p.ab.mode !== 'off' ? abSource(p.ab.b, src, p, o) : null;
  const abSig = bs ? `|B${bs.id}:${bs.frameSeq}:${bs.status}:${chainOf(bs)?.sig ?? ''}` : '';
  const { displayFps, ...rest } = o;
  // compact level bar on the picture: redraw at 20 Hz of audio time
  const bar = p.scope === 'picture' && p.audioBar !== false && src?.audio ? `${Math.floor(src.audio.frames / (src.audio.fs / 20))}:${src.audio.stale}` : '';
  return `${s}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}|${JSON.stringify(rest)}|${p.scope === 'stats' ? displayFps : ''}${tick}|${bar}${abSig}`;
}

export const defaultPanel = (scope: ScopeType): PanelState => ({
  scope, sourceId: '', gain: 1, colorize: scope === 'vector' || scope === 'cie' || scope === 'cube' || scope === 'satlum' || scope === 'chplot', zoom: 1, picture: 'normal', hist: 'rgb', log: false,
});

const PARADE: ScopeType[] = ['parade', 'yrgb', 'wf-rgb'];

const SCATTER: Partial<Record<ScopeType, ScatterMode>> = {
  'wf-luma': 'luma', 'wf-color': 'luma', 'wf-skin': 'skin', 'wf-rgb': 'rgb', parade: 'parade', yrgb: 'yrgb', ycbcr: 'ycbcr', vector: 'vector', cie: 'cie', diamond: 'diamond', cube: 'cube', satlum: 'satlum', chplot: 'chplot',
};

/**
 * @param body panel body in CSS px relative to the renderer canvas
 * @param ctx  2D context of the panel overlay, already scaled to CSS px and cleared
 */
export function drawPanel(renderer: Renderer, ctx: CanvasRenderingContext2D, key: string, p: PanelState, src: Source | null, body: Rect, o: DrawOptions) {
  if (isAudio(p.scope)) {
    const empty = src ? (src.kind === 'stream' && src.settings.audio === false ? 'Ton ist für diese Quelle aus (Quelle → Ton)'
      : src.status === 'live' ? 'Kein Ton in dieser Quelle' : (src.message || 'Keine Daten – Quelle starten')) : (o.emptyText ?? 'Links eine Quelle hinzufügen');
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
      ctx.fillText(src ? (src.message || 'Keine Daten – Quelle starten') : (o.emptyText ?? 'Links eine Quelle hinzufügen'), body.w / 2, body.h / 2);
      return;
    }
    drawTimeline(ctx, { x: 4, y: 6, w: body.w - 8, h: body.h - 8 }, src.history, src.colorspace, p.span ?? 10);
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
  if (src) src = stageView(src, p.stage ?? o.stage ?? 'signal');
  const aspect = src && src.width ? src.width / src.height : 16 / 9;
  const r = plotRect(p.scope, body.w, body.h, aspect);
  const abs = { x: body.x + r.x, y: body.y + r.y, w: r.w, h: r.h };
  renderer.clearRect(abs);

  if (!src || !src.ready) {
    ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(src ? (src.message || 'Keine Daten – Quelle starten') : (o.emptyText ?? 'Links eine Quelle hinzufügen'), body.w / 2, body.h / 2);
    if (isWaveform(p.scope)) drawWaveGraticule(ctx, p.scope, r, o.unit, src?.transfer ?? 'sdr', waveOpts(p, src));
    return;
  }
  const probeRgb = src.probe ? src.readPixel(src.probe.x, src.probe.y) : null;
  const mode = p.scope === 'cube' && p.cube?.lutOnly && p.cube?.lut ? undefined : SCATTER[p.scope];
  if (mode) {
    const crt = crtOf(p);
    const cube = p.scope === 'cube' ? { ...DEFAULT_CUBE, ...p.cube } : null;
    renderer.drawScatter(key, src, abs, {
      ...(crt ? { crt } : {}),
      ...(!crt && p.persist && !isWaveform(p.scope) ? { persist: p.persist } : {}),
      ...(p.scope === 'chplot' ? { pair: p.pair ?? 0 } : {}),
      ...(cube ? { cube: {
        space: CUBE_SPACE_ID[cube.space], rot: cubeRotation(cube.yaw, cube.pitch), to2020: gamutConvert(GAMUTS[src.gamut], GAMUTS['2020']),
        white: mul3(rgbToXyzMatrix(GAMUTS[src.gamut]), [1, 1, 1]), nits: cubeNits(src.transfer),
        view: { zoom: cube.zoom ?? 1, panX: cube.panX ?? 0, panY: cube.panY ?? 0 },
      } } : {}),
      mode, gain: p.gain, colorize: PARADE.includes(p.scope) ? ({ mono: 0, channel: 1, source: 2 } as const)[p.paradeColor ?? (p.colorize ? 'channel' : 'mono')] : p.scope === 'wf-color' || p.colorize, zoom: p.zoom, tint: crt ? [...PHOSPHORS[crt.phosphor].color] as [number, number, number] : [...TINTS[o.tint]] as [number, number, number],
      maxSamples: o.maxSamples, roi: src.activeRois(), skin: o.skin, cieUv: p.scope === 'cie' && !!p.cieUv,
      ...(isWaveform(p.scope) ? { range: WAVE_ZOOMS[p.waveZoom ?? 'full'], ...(({ sec, n }) => ({ sec, secN: n }))(channelLayout(p.scope, p.channels)) } : {}),
    });
  }
  if (isWaveform(p.scope)) {
    const wo = waveOpts(p, src);
    drawWaveGraticule(ctx, p.scope, r, o.unit, src.transfer, wo);
    if (p.scope === 'wf-skin' && p.skinBand !== false) drawSkinRange(ctx, r, o.skin, wo.range);
    if (probeRgb) drawWaveProbe(ctx, p.scope, r, src, probeRgb, wo);
  } else if (p.scope === 'vector') {
    drawVectorGraticule(ctx, r, src.colorspace, p.zoom, o.skin.tol, vectorTargets(src));
    drawVectorExtras(ctx, r, src.colorspace, p.zoom, p.gamuts ?? [], o.targets ?? [], src.transfer, src.gamut);
    if (probeRgb) {
      const { cb, cr } = ycbcr(probeRgb[0], probeRgb[1], probeRgb[2], src.colorspace);
      const [x, y] = vectorPoint(r, cb, cr, p.zoom);
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ctx.stroke();
    }
  } else if (p.scope === 'cie') {
    drawCieGraticule(ctx, r, src.colorspace, { uv: p.cieUv, gamut: src.gamut });
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
    drawHistogram(ctx, r, src, p.hist, p.log);
  } else if (p.scope === 'picture') {
    const pic = (s: Source, rgcOn = !!p.rgc): PictureParams => ({
      mode: p.picture, bands: FALSE_COLOR_PRESETS[o.falsePreset] ?? [], zebra: o.zebra, zebraLow: o.zebraLow,
      roi: s.activeRois(), skin: o.skin, display: displayParams(s, o.display, o.hdrPreview), warn: warnMatrix(s, p.gamutTarget),
      ...(p.picture === 'neutral' ? { neutral: neutralParams(p) } : {}),
      ...(rgcOn ? { rgc: { toAp1: gamutConvert(GAMUTS[s.gamut], GAMUTS.ap1), fromAp1: gamutConvert(GAMUTS.ap1, GAMUTS[s.gamut]) } } : {}),
    });
    const ab = p.ab && p.ab.mode !== 'off' ? p.ab : null;
    const bSrc = ab ? abSource(ab.b, src, p, o) : null;
    // B 'rgc': the same picture with the gamut compression switched the other way
    const picB = (s: Source) => pic(s, ab?.b === 'rgc' ? !p.rgc : !!p.rgc);
    if (ab && bSrc?.ready) {
      if (ab.mode === 'diff') {
        if (!renderer.drawPictureDiff(key, src, pic(src), bSrc, picB(bSrc), abs, ab.gain ?? 4)) renderer.drawPicture(src, abs, pic(src));
      } else {
        const pos = ab.mode === 'split' ? 0.5 : Math.max(0, Math.min(1, ab.pos ?? 0.5));
        renderer.drawPicture(src, abs, pic(src), { x: abs.x, y: abs.y, w: abs.w * pos, h: abs.h });
        renderer.drawPicture(bSrc, abs, picB(bSrc), { x: abs.x + abs.w * pos, y: abs.y, w: abs.w * (1 - pos), h: abs.h });
      }
    } else renderer.drawPicture(src, abs, pic(src));
    if (ab) drawAbLabels(ctx, r, ab, src, bSrc);
    if (src.faceTrack) {
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
      if (!src.faces.length) drawTextBox(ctx, r.x + 6, r.y + r.h - 28, ['Suche Gesichter …']);
      else if (src.faceMode === 'detect' && !src.faceSel.size) drawTextBox(ctx, r.x + 6, r.y + r.h - 28, ['Gesicht anklicken zum Verfolgen']);
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
      const bw = Math.max(150, ...text.map((t) => ctx.measureText(t).width + 20));
      bands.forEach((bd, i) => {
        const y = r.y + r.h - 12 - (bands.length - 1 - i) * 14;
        ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(r.x + 4, y - 7, bw, 14);
        ctx.fillStyle = bd.color; ctx.fillRect(r.x + 6, y - 4, 8, 8);
        ctx.fillStyle = '#ddd'; ctx.fillText(text[i], r.x + 18, y);
      });
    }
    if (p.picture === 'r103') {
      const q = src.r103Stats();
      const legend: [string, string][] = [
        ['#ffb31a', `R 103 außerhalb −5/105 %${q ? ` · ${(q.pref * 100).toFixed(2)} %${q.alarm ? ' ⚠' : ''}` : ''}`],
        ['#ff1a33', `außerhalb 4–1019 (hart)${q ? ` · ${(q.total * 100).toFixed(2)} %` : ''}`],
      ];
      if (!src.yuv) legend.push(['#888', 'R′G′B′-Quelle beschnitten – Y′CbCr-Pfad nötig']);
      ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      legend.forEach(([col, label], i) => {
        const y = r.y + r.h - 12 - (legend.length - 1 - i) * 14;
        ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(r.x + 4, y - 7, 250, 14);
        ctx.fillStyle = col; ctx.fillRect(r.x + 6, y - 4, 8, 8);
        ctx.fillStyle = '#ddd'; ctx.fillText(label, r.x + 18, y);
      });
    }
    if (p.picture === 'neutral') {
      const np = neutralParams(p), nc = src.neutralCast(np.threshold, np.lo, np.hi);
      const lines = [`Fast neutral (< ${(np.threshold * 100).toFixed(0)} % Sättigung, Y′ ${(np.lo * 100).toFixed(0)}–${(np.hi * 100).toFixed(0)} %)`,
        nc ? `${(nc.share * 100).toFixed(1)} % der Fläche · Stich ${(nc.amount * 100).toFixed(2)} %${nc.amount > 0.002 ? ` Richtung ${castName(nc.deg, src.colorspace)}` : ' (neutral)'}` : 'keine CPU-Daten'];
      drawTextBox(ctx, r.x + 6, r.y + r.h - 6 - lines.length * 15 - 8, lines);
    }
    if (p.picture === 'gamut') {
      const legend: [string, string][] = [
        ['#ffe61a', `knapp außerhalb ${GAMUTS[p.gamutTarget ?? '709'].name} (≤ 5 %)`], ['#ff730d', 'außerhalb (≤ 20 %)'], ['#ff1abf', 'weit außerhalb (> 20 %)'],
      ];
      ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      legend.forEach(([col, label], i) => {
        const y = r.y + r.h - 12 - (legend.length - 1 - i) * 14;
        ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(r.x + 4, y - 7, 200, 14);
        ctx.fillStyle = col; ctx.fillRect(r.x + 6, y - 4, 8, 8);
        ctx.fillStyle = '#ddd'; ctx.fillText(label, r.x + 18, y);
      });
    }
    if (src.probe && probeRgb) {
      const x = r.x + ((src.probe.x + 0.5) / src.width) * r.w, y = r.y + ((src.probe.y + 0.5) / src.height) * r.h;
      ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 3, y); ctx.moveTo(x + 3, y); ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 3); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 10); ctx.stroke();
      drawTextBox(ctx, r.x + r.w - 6, r.y + 6, [...probeLines(src, probeRgb, o.unit), ...deLines(src, probeRgb, o)], 'right');
    }
    if (o.frozen) drawTextBox(ctx, r.x + 6, r.y + 6, ['STANDBILD']);
    if (p.clockOverlay) drawClockOverlay(ctx, clockOpts(p.clock), src, r.x + r.w - 6, r.y + r.h - 6);
    if (p.audioBar !== false && src.audio) drawAudioBar(ctx, src.audio, r);
  } else if (p.scope === 'stats') {
    const lines = statsLines(src, o.displayFps);
    if (probeRgb) lines.push('', 'Messpunkt', ...[...probeLines(src, probeRgb, o.unit), ...deLines(src, probeRgb, o)]);
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#d6d6d6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 12, 10 + i * 15));
  }
}
