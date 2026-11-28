// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Shared drawing style of the audio panels (panels.ts, soundPanels.ts).

import { lang } from '../i18n';

export interface Box { x: number; y: number; w: number; h: number }
export const FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
export const GRID = 'rgba(210, 190, 120, 0.35)';
export const GRID_DIM = 'rgba(210, 190, 120, 0.13)';
export const LABEL = 'rgba(230, 215, 170, 0.85)';
export const TEXT = '#d6d6d6';
export const OK = '#8cff9e', WARN = '#ffb44a', BAD = '#ff5c5c';

/** Decimal comma in German, point in English. */
export const dec = (s: string) => (lang() === 'de' ? s.replace('.', ',') : s);
/** Drop a trailing ",0" / ".0". */
export const trim0 = (s: string) => s.replace(/[.,]0$/, '');
export const fmt1 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : dec(v.toFixed(1)).replace('-', '−'));

/** The panel's main values as the canvas' accessible name (screen readers, e2e). */
export function say(ctx: CanvasRenderingContext2D, parts: string[]) {
  ctx.canvas?.setAttribute?.('aria-label', parts.join('; '));
}

export function empty(ctx: CanvasRenderingContext2D, w: number, h: number, text: string) {
  ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
}
