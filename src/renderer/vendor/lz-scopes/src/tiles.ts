// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Tile view (scope-wuensche.md wish 2): the same scope for up to eight sources side by side,
// each tile marked with the camera ID (source number and name), as multi-input monitors show
// camera inputs in a grid. Pure layout and selection, no DOM (test/tiles.test.ts).

import type { Rect } from './renderer';

export const MAX_TILES = 8;
/** Scopes a tile can show (single-source scopes with a plot; not the 3D volume, audio or tables). */
export const TILE_SCOPES = ['picture', 'wf-luma', 'wf-color', 'wf-skin', 'wf-rgb', 'parade', 'yrgb', 'vector', 'hls', 'diamond', 'cie', 'hist'] as const;
export type TileScope = (typeof TILE_SCOPES)[number];
export interface TileSettings { scope: TileScope; /** chosen source ids in order; empty = the first eight video sources */ sources: string[] }
export const DEFAULT_TILES: TileSettings = { scope: 'wf-luma', sources: [] };

/** Header strip of each tile carrying the camera ID (CSS px). */
export const TILE_HEAD = 18;
/** Gap between tiles (CSS px). */
export const TILE_GAP = 2;

/**
 * Grid for `n` tiles in a w × h body: the column count that gives each tile the largest area at
 * the wanted plot aspect (width / height of the tile without its header). Tiles fill row by row.
 */
export function tileGrid(n: number, w: number, h: number, aspect = 16 / 9): Rect[] {
  if (n <= 0 || w <= 0 || h <= 0) return [];
  let best = { cols: 1, area: -1 };
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const cw = (w - TILE_GAP * (cols - 1)) / cols, ch = (h - TILE_GAP * (rows - 1)) / rows - TILE_HEAD;
    if (cw <= 0 || ch <= 0) continue;
    // usable plot inside the tile at the wanted aspect
    const pw = Math.min(cw, ch * aspect), area = pw * (pw / aspect);
    if (area > best.area + 1e-6) best = { cols, area };
  }
  const cols = best.cols, rows = Math.ceil(n / cols);
  const cw = (w - TILE_GAP * (cols - 1)) / cols, ch = (h - TILE_GAP * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ x: (i % cols) * (cw + TILE_GAP), y: Math.floor(i / cols) * (ch + TILE_GAP), w: cw, h: ch }));
}

/** Plot aspect a scope prefers in a tile (waveforms wide, round scopes square). */
export function tileAspect(scope: TileScope): number {
  return scope === 'vector' || scope === 'hls' || scope === 'cie' ? 1 : scope === 'diamond' ? 0.5 : 16 / 9;
}

/** Which sources the tiles show: the chosen ones that still exist, else the first `max` candidates. */
export function tileSources<S extends { id: string }>(all: readonly S[], chosen: readonly string[], max = MAX_TILES): S[] {
  const picked = chosen.map((id) => all.find((s) => s.id === id)).filter((s): s is S => !!s);
  return (picked.length ? picked : all).slice(0, max);
}

/** Camera ID of a tile: number in the source list (1-based) and name. */
export const tileLabel = (index: number, name: string) => `${index + 1} · ${name}`;

/** Which tile lies under a point of the panel body; −1 = none (gap or outside). */
export function tileAt(cells: readonly Rect[], x: number, y: number): number {
  return cells.findIndex((c) => x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h);
}

/** Clamp stored settings (layout import, old saves). */
export function sanitizeTiles(t: Partial<TileSettings> | undefined): TileSettings {
  const scope = (TILE_SCOPES as readonly string[]).includes(t?.scope as string) ? (t!.scope as TileScope) : DEFAULT_TILES.scope;
  const sources = Array.isArray(t?.sources) ? t!.sources.filter((s) => typeof s === 'string').slice(0, MAX_TILES) : [];
  return { scope, sources };
}
