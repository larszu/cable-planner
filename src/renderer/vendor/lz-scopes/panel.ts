// Draws one scope panel (WebGL trace + 2D overlay). Shared by the full app and the
// embeddable ScopeView (src/embed.ts).

import { DISPLAY_LABELS, FALSE_COLOR_PRESETS, GAMUTS, gamutConvert, isLog, logBarTargets, transferLabel, ycbcr, type DisplaySpace, type GamutId } from './color';
import {
  drawVectorExtras, type VectorTarget, drawSkinRange, drawCieGraticule, drawHistogram, drawTextBox, drawVectorGraticule, drawWaveGraticule, drawWaveProbe,
  WAVE_ZOOMS, channelLayout, isAudio, isWaveform, plotRect, type WaveChannels, type WaveOpts, type WaveZoom, probeLines, statsLines, vectorPoint, type ScopeType, type Unit, type BarTargetSet,
} from './graticule';
import { drawAudioPanel, type AudioPanelOptions } from './audio/panels';
import type { DisplayParams, PictureMode, Rect, Renderer, ScatterMode, SkinRange } from './renderer';
import type { Source } from './sources';
import { chainOf, stageView, type Stage } from './chain';

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
  /** where this panel measures in the source's chain; unset = global default */
  stage?: Stage;
  /** skin-tone waveform: show the luma window band and lines (default on) */
  skinBand?: boolean;
  /** waveforms: zoom into blacks/highlights, visible channels (parade/YRGB/RGB), channel names and unit */
  waveZoom?: WaveZoom; channels?: WaveChannels; names?: boolean;
}

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
  /** user colour-match targets (vectorscope) */
  targets?: VectorTarget[];
  /** default measuring stage of panels without their own */
  stage?: Stage;
  emptyText?: string;
}

export const DEFAULT_SKIN: SkinRange = { lo: 0.3, hi: 0.8, tol: 14 };

/** Input gamut → display gamut and output curve for the picture view. */
export function displayParams(src: Source, display: DisplaySpace): DisplayParams {
  const from = GAMUTS[src.gamut];
  if (display === 'raw') return { curve: 2, gamut: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
  const to = display === 'p3' ? GAMUTS.p3 : GAMUTS['709'];
  return { curve: display === 'rec709' ? 1 : 0, gamut: gamutConvert(from, to) };
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
export function panelSignature(p: PanelState, src: Source | null, body: Rect, o: DrawOptions) {
  if (isAudio(p.scope)) {
    const a = src?.audio;
    return `A|${src?.id}:${a ? `${a.version}:${a.paused}:${a.stale}` : `${src?.status}:${src?.message}`}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}`;
  }
  if (src) src = stageView(src, p.stage ?? o.stage ?? 'signal');
  const s = src ? `${chainOf(src)?.sig ?? ''}:${src.id}:${src.frameSeq}:${src.status}:${src.message}:${src.width}x${src.height}:${src.colorspace}:${src.transfer}:${src.gamut}:${src.hlgLw}:${src.probe?.x},${src.probe?.y}:${src.roi?.join(',')}:${src.faceMode}:${src.faces.map((f) => f.id + '/' + f.box.join(',')).join(';')}:${[...src.faceSel].join(',')}:${p.scope === 'hist' || p.scope === 'stats' ? src.statsVersion : ''}` : '-';
  const { displayFps, ...rest } = o;
  return `${s}|${JSON.stringify(p)}|${body.x},${body.y},${body.w},${body.h}|${JSON.stringify(rest)}|${p.scope === 'stats' ? displayFps : ''}`;
}

export const defaultPanel = (scope: ScopeType): PanelState => ({
  scope, sourceId: '', gain: 1, colorize: scope === 'vector' || scope === 'cie', zoom: 1, picture: 'normal', hist: 'rgb', log: false,
});

const PARADE: ScopeType[] = ['parade', 'yrgb', 'wf-rgb'];

const SCATTER: Partial<Record<ScopeType, ScatterMode>> = {
  'wf-luma': 'luma', 'wf-color': 'luma', 'wf-skin': 'skin', 'wf-rgb': 'rgb', parade: 'parade', yrgb: 'yrgb', ycbcr: 'ycbcr', vector: 'vector', cie: 'cie',
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
  const mode = SCATTER[p.scope];
  if (mode) {
    renderer.drawScatter(key, src, abs, {
      mode, gain: p.gain, colorize: PARADE.includes(p.scope) ? ({ mono: 0, channel: 1, source: 2 } as const)[p.paradeColor ?? (p.colorize ? 'channel' : 'mono')] : p.scope === 'wf-color' || p.colorize, zoom: p.zoom, tint: [...TINTS[o.tint]] as [number, number, number],
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
  } else if (p.scope === 'hist') {
    drawHistogram(ctx, r, src, p.hist, p.log);
  } else if (p.scope === 'picture') {
    renderer.drawPicture(src, abs, {
      mode: p.picture, bands: FALSE_COLOR_PRESETS[o.falsePreset] ?? [], zebra: o.zebra, zebraLow: o.zebraLow,
      roi: src.activeRois(), skin: o.skin, display: displayParams(src, o.display), warn: warnMatrix(src, p.gamutTarget),
    });
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
      bands.forEach((bd, i) => {
        const y = r.y + r.h - 12 - (bands.length - 1 - i) * 14;
        ctx.fillStyle = 'rgba(8,9,11,0.75)'; ctx.fillRect(r.x + 4, y - 7, 150, 14);
        ctx.fillStyle = bd.color; ctx.fillRect(r.x + 6, y - 4, 8, 8);
        ctx.fillStyle = '#ddd'; ctx.fillText(`${bd.from}–${Math.min(100, bd.to)} % ${bd.label}`, r.x + 18, y);
      });
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
      drawTextBox(ctx, r.x + r.w - 6, r.y + 6, probeLines(src, probeRgb, o.unit), 'right');
    }
    if (o.frozen) drawTextBox(ctx, r.x + 6, r.y + 6, ['STANDBILD']);
  } else if (p.scope === 'stats') {
    const lines = statsLines(src, o.displayFps);
    if (probeRgb) lines.push('', 'Messpunkt', ...probeLines(src, probeRgb, o.unit));
    ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.fillStyle = '#d6d6d6'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, 12, 10 + i * 15));
  }
}
