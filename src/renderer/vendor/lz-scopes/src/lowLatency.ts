// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Low-latency mode settings (docs/research/low-latency.md, docs/research/rtp-eigenempfang.md).
// A global set in Settings; every bridge source can switch the mode on/off and override
// single fields. Every measure is optional, because each has a price (fewer sample points,
// more draw work, no common A/V time base, …).

import { t } from './i18n';

export interface LowLatencyConfig {
  /** analysis width cap in px (0 = native, no cap) */
  width: number;
  /** draw a bridge frame when it arrives instead of at the next animation frame */
  drawOnArrive: boolean;
  /** RTSP through the bridge's own RTP reception (server/rtsp.mjs) instead of ffmpeg's */
  ownRtp: boolean;
  /** interval of the CPU statistics (histogram, clip shares) in ms */
  statsMs: number;
}

export const DEFAULT_LOW_LATENCY: LowLatencyConfig = { width: 640, drawOnArrive: true, ownRtp: true, statsMs: 100 };

export const LL_WIDTHS: [string, string][] = [['320', '320 px'], ['480', '480 px'], ['640', '640 px'], ['960', '960 px'], ['0', t('tools.ll.native')]];
export const LL_STATS: [string, string][] = [['100', t('tools.ll.every100')], ['250', t('tools.ll.every250')], ['500', t('tools.ll.every500')], ['1000', t('tools.ll.everySecond')]];

/** Global settings with a source's own overrides. */
export function mergeLowLatency(global: Partial<LowLatencyConfig> | undefined, own: Partial<LowLatencyConfig> | undefined): LowLatencyConfig {
  const pick = <K extends keyof LowLatencyConfig>(k: K): LowLatencyConfig[K] => own?.[k] ?? global?.[k] ?? DEFAULT_LOW_LATENCY[k];
  return { width: pick('width'), drawOnArrive: pick('drawOnArrive'), ownRtp: pick('ownRtp'), statsMs: pick('statsMs') };
}

/** Analysis width actually requested from the bridge: the source's own choice, capped in low-latency mode. */
export function effectiveWidth(width: number, low: boolean, cap: number): number {
  if (!low || cap === 0) return width;
  return width === 0 || width > cap ? cap : width;
}

/** Short description for the source card and the Messwerte panel. */
export function describeLowLatency(c: LowLatencyConfig): string {
  return [
    c.width ? `≤ ${c.width} px` : t('tools.ll.widthFree'),
    c.drawOnArrive ? t('tools.ll.drawOnArrive') : t('tools.ll.drawOnFrame'),
    c.ownRtp ? t('tools.ll.ownRtp') : t('tools.ll.ffmpegRtp'),
    t('tools.ll.stats', { ms: c.statsMs }),
  ].join(' · ');
}
