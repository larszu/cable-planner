/**
 * Adapter that turns my Cable + Equipment world into pathfinding input
 * and returns waypoints in flow-pixel coordinates that the existing
 * CableEdge can render.
 *
 * The adapter does NOT mutate the store. It is a pure function that
 * returns waypoints; the caller decides whether to write them back to
 * the cable.
 *
 * v7.9.32 — Obstacles werden inflated bevor sie an den Pathfinder gehen.
 * v7.9.37 — Source/Target werden jetzt AUCH als Obstacles mit Padding
 * in den Pathfinder gegeben. Vorher waren beide komplett ausgeschlossen,
 * was A* erlaubt hat den Pfad durch den Source/Target hindurch zu
 * optimieren (kürzer = mehr Cells, weniger Turns). Mit Padding + Korridor:
 *  - Source-Device + 40 px Padding sind hart blockiert
 *  - Korridor vom Handle nach außen (durch das eigene Padding) ist
 *    force-unblocked, damit der Pfad raus kommt
 *  - Stub-Endpunkt liegt jenseits des Paddings, damit A* dort frei
 *    weiterplanen kann
 *  - Pfad kann nie zurück durch den eigenen Body (auch nicht aus dem
 *    Padding)
 */

import {
  CELL_SIZE,
  computeEdgePath,
  type Rect,
} from './pathfinding'

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'

/** Pixel-coordinate equipment rectangle used by the canvas obstacle
 *  builder. Kept as the public input shape so call-sites stay readable. */
export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
  id?: string
}

export interface RouteCableArgs {
  /** Flow-pixel position of the source handle. */
  source: { x: number; y: number }
  target: { x: number; y: number }
  sourceSide: HandleSide
  targetSide: HandleSide
  /** All equipment rectangles (in flow coordinates). Source/Target
   *  müssen in dieser Liste vorhanden sein UND ihre id muss source-/
   *  targetEquipmentId entsprechen, damit der Adapter sie als
   *  "Korridor erforderlich" markiert. */
  obstacles: PixelRect[]
  sourceEquipmentId: string
  targetEquipmentId: string
  /** v7.9.118 — Padding in Grid-Zellen um jedes Hindernis. Default 2
   *  (= 40 px) — angenehmer Abstand im Haupt-Canvas. In dichten Racks
   *  (mode='rack'), wo Geraete vertikal direkt aufeinander gestapelt
   *  sind, sperrt das den Korridor zwischen zwei benachbarten Geraeten
   *  komplett → A* loopt um das ganze Rack. Caller darf den Wert
   *  reduzieren (z.B. 0) um dichte Routen zuzulassen. */
  obstaclePadCells?: number
}

/** v7.9.32 — Sichtbare Lücke um jedes Hindernis. 2 Grid-Cells = 40 px. */
const OBSTACLE_PAD_CELLS = 2

// ReactFlow side → outward direction in pixel space (dx, dy).
const handleOutwardDelta = (side: HandleSide): { dx: number; dy: number } => {
  switch (side) {
    case 'right':  return { dx: 1, dy: 0 }
    case 'bottom': return { dx: 0, dy: 1 }
    case 'left':   return { dx: -1, dy: 0 }
    case 'top':    return { dx: 0, dy: -1 }
  }
}

const inflate = (r: PixelRect, pad: number): Rect => ({
  left: r.x - pad,
  top: r.y - pad,
  right: r.x + r.width + pad,
  bottom: r.y + r.height + pad,
  nodeId: r.id,
})

/** Compute force-open cells: ein Korridor vom Handle, einen Cell tief
 *  ins Source-Device hinein (damit der gerenderte erste Segment am
 *  Handle anschließt) PLUS OBSTACLE_PAD_CELLS Cells nach außen durch
 *  das eigene Padding. Ohne den Korridor wäre der Stub-Endpunkt in der
 *  Padding-Zone des Source-Devices selbst gefangen. */
const handleCorridor = (
  handlePx: { x: number; y: number },
  side: HandleSide,
  outwardCells: number,
): { gx: number; gy: number }[] => {
  const { dx, dy } = handleOutwardDelta(side)
  const baseGx = Math.round(handlePx.x / CELL_SIZE)
  const baseGy = Math.round(handlePx.y / CELL_SIZE)
  const cells: { gx: number; gy: number }[] = []
  for (let i = 0; i <= outwardCells; i++) {
    cells.push({ gx: baseGx + dx * i, gy: baseGy + dy * i })
  }
  return cells
}

export const routeCableWithAStar = (
  args: RouteCableArgs,
): { x: number; y: number }[] | null => {
  // v7.9.37 — ALLE Devices kommen mit Padding als Hard-Obstacles rein,
  // inklusive Source und Target. Damit kann A* den Pfad nicht mehr durch
  // den eigenen Source/Target-Body optimieren.
  // v7.9.118 — Padding-Zellen ueberschreibbar fuer Rack-Mode (default 2).
  const padCells = typeof args.obstaclePadCells === 'number' && args.obstaclePadCells >= 0
    ? args.obstaclePadCells
    : OBSTACLE_PAD_CELLS
  const padPx = padCells * CELL_SIZE
  const obstacles: Rect[] = args.obstacles.map((r) => inflate(r, padPx))

  // Stub-Distanz: muss past dem eigenen Padding liegen, sonst sitzt
  // der A*-Startpunkt im blockierten Padding-Bereich fest.
  // Mind. 1 damit der Handle nicht unmittelbar im Padding-Bereich endet.
  const stubCells = Math.max(1, padCells + 1)

  // Korridor force-open: vom Handle nach außen durch das eigene Padding,
  // damit der gerenderte erste Segment (Handle → erstes Waypoint = Stub)
  // einen freien Weg hat und A* den Stub erreichen kann.
  const extraForceOpen = [
    ...handleCorridor(args.source, args.sourceSide, stubCells),
    ...handleCorridor(args.target, args.targetSide, stubCells),
  ]

  // Bei Top/Bottom-Handles weiß der Pathfinder nicht von "vertical stub" —
  // er kennt nur horizontale Stubs (links/rechts). Wir wählen die Stub-
  // Richtung anhand der relativen Source/Target-Position so dass der
  // Stub in Richtung Ziel zeigt, was meistens visuell sinnvoll ist.
  const sourceExitsRight =
    args.sourceSide === 'right'
      ? true
      : args.sourceSide === 'left'
        ? false
        : args.source.x <= args.target.x
  const targetEntersLeft =
    args.targetSide === 'left'
      ? true
      : args.targetSide === 'right'
        ? false
        : args.source.x <= args.target.x

  const arriveDir = handleArriveDir(args.targetSide)
  const freeEndDir = args.targetSide === 'top' || args.targetSide === 'bottom'
  const excludeEndDir = freeEndDir ? ((arriveDir + 2) % 4) : undefined

  // v7.9.65 / #188 — Verbiete dem A*-Solver direkt vom Stub-Cell aus
  // wieder ZURÜCK in Richtung Source zu laufen. Ohne diese Sperre konnte
  // der Pfad direkt am Stub wieder nach links umkehren (visuell: das
  // Kabel "knickt" gleich am Ausgang zurück). Mit excludeStartDir = 180°-
  // Gegenrichtung der Outward-Richtung muss der erste Move geradeaus
  // oder seitlich gehen.
  const outwardDirFor = (side: HandleSide): 0 | 1 | 2 | 3 => {
    switch (side) {
      case 'right':  return 0
      case 'bottom': return 1
      case 'left':   return 2
      case 'top':    return 3
    }
  }
  const excludeStartDir = (outwardDirFor(args.sourceSide) + 2) % 4

  const result = computeEdgePath({
    sourceX: args.source.x,
    sourceY: args.source.y,
    targetX: args.target.x,
    targetY: args.target.y,
    obstacles,
    sourceExitsRight,
    targetEntersLeft,
    freeEndDir,
    excludeEndDir,
    excludeStartDir,
    stubCells,
    extraForceOpen,
  })
  if (!result) return null

  const inner = result.waypoints.slice(1, -1)
  const out: { x: number; y: number }[] = []
  for (const p of inner) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 1 || Math.abs(last.y - p.y) > 1) out.push(p)
  }
  return out
}

const handleArriveDir = (side: HandleSide): 0 | 1 | 2 | 3 => {
  // Direction the path arrives at the goal cell, in pathfinding's enum
  // (0=E, 1=S, 2=W, 3=N). Path travels INTO the device, so it's the
  // opposite of the handle's outward direction.
  switch (side) {
    case 'right':  return 2 // arrives going west
    case 'bottom': return 3 // arrives going north
    case 'left':   return 0 // arrives going east
    case 'top':    return 1 // arrives going south
  }
}

// Re-exported for callers that previously imported these from cableAStar.
export { CELL_SIZE }
