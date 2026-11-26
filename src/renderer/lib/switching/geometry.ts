// ───────────────────────────────────────────────────────────────────────────
// Bildgeometrie fuer SuperSource-Boxen und DVE-Keyer (#1240, Stufe 3).
//
// Masse und `boxRect`/`dveRect` wie in lz-switcher-motion
// (src/shared/model.ts, eigener Code, oeffentlich): das Bild reicht von
// x −16…16 und y −9…9, y nach oben. Fuer das Zeichnen rechnet `toUnit` in
// Einheitskoordinaten um (0…1, y nach unten). REIN.
// ───────────────────────────────────────────────────────────────────────────
import type { BoxState } from './types'

export const FRAME_W = 32
export const FRAME_H = 18

/** Rechteck in Einheitskoordinaten: 0…1, Ursprung oben links. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 }

export type FullBox = Required<BoxState>

const OFF_BOX: FullBox = {
  enabled: false,
  x: 0,
  y: 0,
  size: 0.5,
  cropped: false,
  cropTop: 0,
  cropBottom: 0,
  cropLeft: 0,
  cropRight: 0,
}

/** Das Quad des SimSwitcher: vier halbe Bilder in den Ecken, Box 1 oben links. */
export const QUAD: readonly [number, number][] = [
  [-8, 4.5],
  [8, 4.5],
  [-8, -4.5],
  [8, -4.5],
]

/** Box k (1-basiert) mit Vorgaben aus dem Quad aufgefuellt. */
export const fullBox = (k: number, b: BoxState | undefined): FullBox => {
  const q = QUAD[(k - 1) % QUAD.length] ?? [0, 0]
  return { ...OFF_BOX, enabled: true, x: q[0], y: q[1], ...(b ?? {}) }
}

/** Sichtbares Rechteck einer Box in Bildeinheiten (links, oben, Breite, Hoehe; y nach oben). */
export function boxRect(b: FullBox): { left: number; top: number; width: number; height: number } {
  const s = b.size
  const c = b.cropped ? b : { cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 }
  const left = b.x + (-FRAME_W / 2 + c.cropLeft) * s
  const right = b.x + (FRAME_W / 2 - c.cropRight) * s
  const top = b.y + (FRAME_H / 2 - c.cropTop) * s
  const bottom = b.y + (-FRAME_H / 2 + c.cropBottom) * s
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, top - bottom) }
}

/** Die DVE-Lage eines Keyers; Vorgabe wie im SimSwitcher (ein Drittel, oben rechts). */
export interface Dve {
  positionX: number
  positionY: number
  sizeX: number
  sizeY: number
}
export const DEFAULT_DVE: Dve = { positionX: 8, positionY: 4.5, sizeX: 0.33, sizeY: 0.33 }

export function dveRect(d: Dve): { left: number; top: number; width: number; height: number } {
  const w = FRAME_W * d.sizeX
  const h = FRAME_H * d.sizeY
  return { left: d.positionX - w / 2, top: d.positionY + h / 2, width: w, height: h }
}

/** Bildeinheiten (y nach oben) in Einheitskoordinaten (y nach unten). */
export const toUnit = (r: { left: number; top: number; width: number; height: number }): Rect => ({
  x: (r.left + FRAME_W / 2) / FRAME_W,
  y: (FRAME_H / 2 - r.top) / FRAME_H,
  w: r.width / FRAME_W,
  h: r.height / FRAME_H,
})

/** Das ganze Quellbild einer Box (ohne Crop) — dahinein wird gezeichnet. */
export const boxPictureRect = (b: FullBox): Rect =>
  toUnit(boxRect({ ...b, cropped: false }))

/** Rechteck `inner` (relativ zu 0…1) in `outer` abbilden. */
export const mapRect = (outer: Rect, inner: Rect): Rect => ({
  x: outer.x + inner.x * outer.w,
  y: outer.y + inner.y * outer.h,
  w: inner.w * outer.w,
  h: inner.h * outer.h,
})

export const inRect = (r: Rect, x: number, y: number): boolean =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
