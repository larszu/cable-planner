// ───────────────────────────────────────────────────────────────────────────
// Das simulierte Ergebnisbild (#1240, Stufe 3): PGM, Aux, M/E-Ausgaenge und
// Multiviewer-Fenster als Liste von Zeichenschritten.
//
// REIN: kein Canvas, kein Bild. Ein Schritt nennt nur, WELCHE Quelle (Knoten
// der internen Matrix) WOHIN gezeichnet wird, mit welcher Deckkraft und
// welchem Ausschnitt. Das Zeichnen (`Ergebnisbild`) setzt Pruefbilder bzw.
// geladene PNGs ein. So laesst sich das Bild ohne Browser pruefen
// (`sampleAt`): welche Quelle liegt an diesem Punkt oben?
//
// Reihenfolge von unten nach oben: M/E-Hintergrund (mit Uebergang), dann die
// Keyer der M/E; auf PGM noch die DSKs. Eine SuperSource zeichnet Art-Fill,
// dann die Boxen von hinten (letzte Box) nach vorn (Box 1).
// ───────────────────────────────────────────────────────────────────────────
import { getMvGridSpec, getMvQuadrants } from '../atemMvLayout'
import type { AtemMvDefinition } from '../../types/equipment'
import { DEFAULT_DVE, FULL, boxPictureRect, boxRect, dveRect, fullBox, inRect, mapRect, toUnit, type Rect } from './geometry'
import type { InnerMatrix } from './internalMatrix'
import { runOf, transitionOf, type SimState } from './simulation'
import type { WipePattern } from './types'

export type Clip = { kind: 'rect'; rect: Rect } | { kind: 'wipe'; pattern: WipePattern; k: number; frame: Rect }

export interface DrawOp {
  /** Quelle als Knoten-ID: `in:n`, `black`, `bars`, `color:n`, `mp:n`. */
  leaf: string
  rect: Rect
  clips: Clip[]
  alpha: number
}

export interface ComposeInput {
  matrix: InnerMatrix
  /** Alle Kreuzpunkte (`allRoutes` ueber `sim.switching`). */
  routes: ReadonlyMap<string, string>
  sim: SimState
}

const LEAF_KINDS = new Set(['input', 'black', 'bars', 'color', 'mediaPlayer'])

/** Ist der Punkt (Einheitskoordinaten) im Wipe-Bereich der kommenden Quelle? */
export const wipeContains = (pattern: WipePattern, k: number, frame: Rect, x: number, y: number): boolean => {
  const u = (x - frame.x) / frame.w
  const v = (y - frame.y) / frame.h
  const dx = (u - 0.5) * (16 / 9)
  const dy = v - 0.5
  switch (pattern) {
    case 'right':
      return u < k
    case 'left':
      return u > 1 - k
    case 'down':
      return v < k
    case 'up':
      return v > 1 - k
    case 'barnDoor':
      return Math.abs(u - 0.5) < k / 2
    case 'circle':
      return Math.hypot(dx, dy) < k * Math.hypot(8 / 9, 0.5)
    case 'diamond':
      return Math.abs(dx) + Math.abs(dy) < k * (8 / 9 + 0.5)
    case 'box':
      return Math.abs(u - 0.5) < k / 2 && Math.abs(v - 0.5) < k / 2
  }
}

const clipContains = (c: Clip, x: number, y: number): boolean =>
  c.kind === 'rect' ? inRect(c.rect, x, y) : wipeContains(c.pattern, c.k, c.frame, x, y)

/** Die Zeichenschritte fuer eine Quelle (Knoten-ID) bzw. `pgm`. */
export function composeSource(input: ComposeInput, sourceId: string): DrawOp[] {
  const ops: DrawOp[] = []
  const { matrix, routes, sim } = input
  const state = sim.switching

  const draw = (id: string | undefined, rect: Rect, clips: Clip[], alpha: number, seen: ReadonlySet<string>) => {
    if (!id || alpha <= 0) return
    // Eine Schleife (M/E 1 in Box 1 von SuperSource 1 auf M/E 1) zeigt Schwarz.
    if (seen.has(id)) {
      ops.push({ leaf: 'black', rect, clips, alpha })
      return
    }
    const next = new Set(seen).add(id)
    if (id === 'pgm') {
      draw('me:1', rect, clips, alpha, next)
      for (const b of matrix.blocks) {
        if (b.kind !== 'downstreamKeyer' || state.keyers?.[b.id]?.onAir !== true) continue
        draw(routes.get(`${b.id}/fill`), rect, clips, alpha, next)
      }
      return
    }
    const block = matrix.byId.get(id)
    if (!block) return
    if (LEAF_KINDS.has(block.kind)) {
      ops.push({ leaf: id, rect, clips, alpha })
      return
    }
    if (block.kind === 'mixEffect') {
      const pgm = routes.get(`${id}/pgm`)
      const pvw = routes.get(`${id}/pvw`)
      const k = runOf(sim, id).progress
      const t = transitionOf(state, id)
      if (k <= 0) draw(pgm, rect, clips, alpha, next)
      else if (t.style === 'mix') {
        draw(pgm, rect, clips, alpha, next)
        draw(pvw, rect, clips, alpha * k, next)
      } else if (t.style === 'dip') {
        if (k < 0.5) {
          draw(pgm, rect, clips, alpha, next)
          draw(t.dipSource, rect, clips, alpha * k * 2, next)
        } else {
          draw(t.dipSource, rect, clips, alpha, next)
          draw(pvw, rect, clips, alpha * (k * 2 - 1), next)
        }
      } else {
        draw(pgm, rect, clips, alpha, next)
        draw(pvw, rect, [...clips, { kind: 'wipe', pattern: t.wipe, k, frame: rect }], alpha, next)
      }
      for (const key of matrix.blocks) {
        if (key.kind !== 'upstreamKeyer' || key.parent !== id) continue
        const ks = state.keyers?.[key.id]
        if (ks?.onAir !== true) continue
        const fill = routes.get(`${key.id}/fill`)
        const into = ks.type === 'dve' ? mapRect(rect, toUnit(dveRect(DEFAULT_DVE))) : rect
        const kc = ks.type === 'dve' ? [...clips, { kind: 'rect' as const, rect: into }] : clips
        draw(fill, into, kc, alpha, next)
      }
      return
    }
    if (block.kind === 'superSource') {
      const art = routes.get(`${id}/art-fill`)
      if (art) draw(art, rect, clips, alpha, next)
      else ops.push({ leaf: 'black', rect, clips, alpha })
      const boxes = block.dests.filter((d) => d.role === 'box').reverse()
      for (const d of boxes) {
        const src = routes.get(d.id)
        const b = fullBox(d.index ?? 1, state.boxes?.[d.id])
        if (!src || !b.enabled) continue
        const pic = mapRect(rect, boxPictureRect(b))
        const vis = mapRect(rect, toUnit(boxRect(b)))
        draw(src, pic, [...clips, { kind: 'rect', rect: vis }], alpha, next)
      }
      return
    }
    if (block.kind === 'aux') {
      draw(routes.get(id), rect, clips, alpha, next)
    }
  }

  draw(sourceId, FULL, [], 1, new Set())
  return ops
}

/** Was eine Vorschau-Schiene zeigt: die Quelle auf dem Vorschau-Bus. */
export const composePreview = (input: ComposeInput, me: string): DrawOp[] => {
  const pvw = input.routes.get(`${me}/pvw`)
  return pvw ? composeSource(input, pvw) : []
}

/** Die Quellen an einem Punkt, oben zuerst. Fuer Tests und die Pixelprobe. */
export const sampleAt = (ops: readonly DrawOp[], x: number, y: number): DrawOp[] =>
  ops.filter((o) => inRect(o.rect, x, y) && o.clips.every((c) => clipContains(c, x, y))).reverse()

// ─── Multiviewer ────────────────────────────────────────────────────────

export interface MvWindow {
  rect: Rect
  /** Was das Fenster zeigt: Knoten-ID, `pgm` oder `pvw:me:n`. */
  target: string
  sourceId: number
}

/** ATEM-Quellen-ID in ein Ziel der Komposition. */
export const targetForSourceId = (matrix: InnerMatrix, sourceId: number): string | undefined => {
  if (sourceId === 10010) return 'pgm'
  if (sourceId === 10011) return 'pvw:me:1'
  if (sourceId >= 10000) {
    const me = Math.floor((sourceId - 10000) / 10)
    return sourceId % 10 === 1 ? `pvw:me:${me}` : `me:${me}`
  }
  if (sourceId >= 8001 && sourceId < 9000) return `aux:${sourceId - 8000}`
  return matrix.blocks.find((b) => b.sourceId === sourceId && b.source)?.id
}

/** Vorgabe ohne gespeicherte Fenster: Vorschau und Programm gross, Eingaenge 1–8 klein. */
const defaultWindowSource = (i: number): number => (i === 0 ? 10011 : i === 1 ? 10010 : i - 1)

/** Die Fenster eines Multiviewers in Einheitskoordinaten (4×4-Raster). */
export function multiviewerWindows(mv: Pick<AtemMvDefinition, 'layout' | 'quadrants' | 'windows'> | undefined): MvWindow[] {
  const cell = (col: number, row: number, span = 1): Rect => ({ x: (col - 1) / 4, y: (row - 1) / 4, w: span / 4, h: span / 4 })
  const src = (i: number) => mv?.windows.find((w) => w.windowIndex === i)?.sourceId
  const out: MvWindow[] = []
  if (mv?.quadrants) {
    const q = getMvQuadrants(mv)
    q.forEach((art, qi) => {
      const col = qi % 2 === 0 ? 1 : 3
      const row = qi < 2 ? 1 : 3
      if (art === 'big') {
        const s = src(qi) ?? defaultWindowSource(qi)
        out.push({ rect: cell(col, row, 2), target: '', sourceId: s })
      } else {
        for (let c = 0; c < 4; c++) {
          const s = src((qi + 1) * 10 + c) ?? 1 + qi * 4 + c
          out.push({ rect: cell(col + (c % 2), row + Math.floor(c / 2)), target: '', sourceId: s })
        }
      }
    })
    return out
  }
  const spec = getMvGridSpec(mv?.layout ?? 0)
  for (const b of spec.big) {
    out.push({ rect: cell(b.colStart, b.rowStart, b.colSpan), target: '', sourceId: src(b.window) ?? defaultWindowSource(b.window) })
  }
  const off = spec.smallWindowOffset ?? 2
  spec.small.forEach((c, i) => {
    out.push({ rect: cell(c.colStart, c.rowStart), target: '', sourceId: src(off + i) ?? defaultWindowSource(off + i) })
  })
  return out
}

/** Ein Multiviewer als Zeichenschritte, je Fenster die Komposition seiner Quelle. */
export function composeMultiviewer(
  input: ComposeInput,
  mv: Pick<AtemMvDefinition, 'layout' | 'quadrants' | 'windows'> | undefined,
): { ops: DrawOp[]; windows: MvWindow[] } {
  const ops: DrawOp[] = []
  const windows = multiviewerWindows(mv).map((w) => ({ ...w, target: targetForSourceId(input.matrix, w.sourceId) ?? '' }))
  for (const w of windows) {
    const inner = composeTarget(input, w.target)
    for (const o of inner) {
      ops.push({
        ...o,
        rect: mapRect(w.rect, o.rect),
        clips: [
          { kind: 'rect', rect: w.rect },
          ...o.clips.map((c): Clip =>
            c.kind === 'rect' ? { kind: 'rect', rect: mapRect(w.rect, c.rect) } : { ...c, frame: mapRect(w.rect, c.frame) },
          ),
        ],
      })
    }
  }
  return { ops, windows }
}

/** Ziel der Ansicht: `pgm`, `aux:n`, `me:n`, `pvw:me:n` oder eine Quelle. */
export const composeTarget = (input: ComposeInput, target: string): DrawOp[] =>
  target.startsWith('pvw:') ? composePreview(input, target.slice(4)) : target ? composeSource(input, target) : []
