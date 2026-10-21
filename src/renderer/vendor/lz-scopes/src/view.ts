// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Zoom and pan of a scope panel (#89): the transform shared by WebGL, the 2D overlay, the
// pointer mapping and the gesture handling (gestures.ts).
//
// A view is stored in the clip units of the plot area (−1 … 1, y up), the same form the 3D
// volume has used since #67 (cube.ts CubeView): a plotted point at clip position c is shown at
//     c′ = c · z + (x, y)
// The GL shaders apply exactly that; the overlay draws with the transformed plot rect
// (viewRect), which maps clip units linearly onto the screen, so lines, labels and markers stay
// on the trace. Waveforms only zoom vertically and express the view as a level range instead
// (waveRange), so the existing range path (shader uWMin/uWMax, waveTicks) keeps fine ticks.

import type { Rect } from './renderer';

export interface View { z: number; x: number; y: number }
export const IDENTITY: View = { z: 1, x: 0, y: 0 };

/** Which axes a scope zooms: 'y' = waveforms (vertical only), 'xy' = everything else. */
export type ViewAxes = 'xy' | 'y';
export interface ViewLimits { min: number; max: number; axes: ViewAxes; /** keep the plot filled (no empty margins) */ cover: boolean }

export const isIdentity = (v: View | undefined) => !v || (Math.abs(v.z - 1) < 1e-6 && Math.abs(v.x) < 1e-6 && Math.abs(v.y) < 1e-6);

/** The plot rect drawn with view `v` (larger than `r` when zoomed in); clip to `r` when drawing. */
export function viewRect(r: Rect, v: View = IDENTITY): Rect {
  const w = r.w * v.z, h = r.h * v.z;
  return { x: r.x + (r.w - w) / 2 + (v.x * r.w) / 2, y: r.y + (r.h - h) / 2 - (v.y * r.h) / 2, w, h };
}

/** Clip-space position after the view (what the shaders compute). */
export const viewClip = (v: View, cx: number, cy: number): [number, number] => [cx * v.z + v.x, cy * v.z + v.y];

/** Keep z within the limits; with `cover` the zoomed plot always fills `r` (pan clamped). */
export function clampView(v: View, l: ViewLimits): View {
  const z = Math.min(l.max, Math.max(l.min, v.z));
  let x = l.axes === 'y' ? 0 : v.x, y = v.y;
  if (l.cover && z >= 1) {
    const m = z - 1;
    x = Math.min(m, Math.max(-m, x));
    y = Math.min(m, Math.max(-m, y));
  }
  return { z, x: x || 0, y: y || 0 };
}

/** Screen point (relative to the same origin as `r`) → clip units of `r`. */
const toClip = (r: Rect, px: number, py: number): [number, number] => [((px - r.x) / r.w) * 2 - 1, 1 - ((py - r.y) / r.h) * 2];

/**
 * Zoom by `factor` so that the screen point (px, py) keeps showing the same content
 * (zoom around the cursor / the pinch centre). Waveforms ('y') keep x at 0.
 */
export function zoomAt(v: View, r: Rect, px: number, py: number, factor: number, l: ViewLimits): View {
  const z = Math.min(l.max, Math.max(l.min, v.z * factor));
  const k = z / v.z;
  const [cx, cy] = toClip(r, px, py);
  // c′ = c·z + t; the content under the cursor u = (c′ − t)/z stays at c′: t′ = c′ − (c′ − t)·k
  const x = l.axes === 'y' ? 0 : cx - (cx - v.x) * k;
  const y = cy - (cy - v.y) * k;
  return clampView({ z, x, y }, l);
}

/** Move by (dx, dy) screen px. */
export function panBy(v: View, r: Rect, dx: number, dy: number, l: ViewLimits): View {
  return clampView({ z: v.z, x: v.x + (l.axes === 'y' ? 0 : (dx * 2) / r.w), y: v.y - (dy * 2) / r.h }, l);
}

/**
 * Waveform level range shown with view `v` on top of the base range (full, black or highlight
 * magnifier): the levels at the bottom and the top edge of the plot.
 */
export function waveRange(base: readonly [number, number], v: View | undefined): [number, number] {
  if (!v || isIdentity(v)) return [base[0], base[1]];
  // plot edges at clip −1 / +1 show the content at c = (±1 − y)/z
  const lv = (c: number) => base[0] + ((c + 1) / 2) * (base[1] - base[0]);
  return [lv((-1 - v.y) / v.z), lv((1 - v.y) / v.z)];
}

/**
 * Wheel delta → zoom factor. Pinch (ctrlKey) deltas are small scale steps; mouse notches are
 * ±100 px or 1–3 lines. Capped so a fast flick does not jump (danburzo.ro/dom-gestures).
 */
export function wheelFactor(deltaY: number, deltaMode: number, pinch: boolean): number {
  let d = deltaMode === 1 ? deltaY * 8 : deltaMode === 2 ? deltaY * 24 : deltaY;
  d = Math.max(-50, Math.min(50, d));
  return Math.exp(-d * (pinch ? 0.01 : 0.0025));
}

/**
 * What a wheel event means: 'pinch' (trackpad pinch – Chromium/Firefox send it as ctrl+wheel – or
 * ctrl+wheel), 'pan' (two-finger scroll on a trackpad) or 'wheel' (mouse wheel notch).
 * Trackpad vs. mouse: mouse notches carry the legacy wheelDeltaY in multiples of 120, precise
 * trackpad deltas do not (in WebKit/Chromium often −3 × deltaY); horizontal deltas only come from
 * trackpads (and tilt wheels).
 */
export function classifyWheel(e: { ctrlKey: boolean; metaKey?: boolean; deltaX: number; deltaY: number; deltaMode: number; wheelDeltaY?: number }): 'pinch' | 'pan' | 'wheel' {
  if (e.ctrlKey) return 'pinch';
  if (e.deltaMode !== 0) return 'wheel';
  if (typeof e.wheelDeltaY === 'number' && e.wheelDeltaY !== 0) return e.wheelDeltaY % 120 === 0 && e.wheelDeltaY !== -3 * e.deltaY ? 'wheel' : 'pan';
  if (e.deltaX !== 0) return 'pan';
  return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 50 ? 'wheel' : 'pan';
}

/** Short label of the zoom factor for the chip: ×1.5, ×12. */
export const zoomLabel = (z: number) => `×${z < 10 ? (Math.round(z * 10) / 10).toString() : Math.round(z)}`;

/** Two touch points → centre, distance (pinch). */
export function pinchOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) };
}

/** Visible part of `rect` inside `clip` (null when they do not overlap). */
export function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}
