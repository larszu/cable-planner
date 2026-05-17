/**
 * Adapter that turns my Cable + Equipment world into pathfinding input
 * and returns waypoints in flow-pixel coordinates that the existing
 * CableEdge can render.
 *
 * The adapter does NOT mutate the store. It is a pure function that
 * returns waypoints; the caller decides whether to write them back to
 * the cable.
 *
 * v7.9.32 — Bug-Fixes:
 *  - Obstacles werden jetzt um OBSTACLE_PAD_PX inflated. Vorher kamen
 *    Geräte-Rects roh (ohne PAD) in den Pathfinder rein → Pfad lief
 *    bis zur Geräte-Kante, sah optisch aus als ginge er durch das
 *    Gerät hindurch (vor allem weil Edges in ReactFlow unter den Nodes
 *    gerendert werden). Mit PAD_PX = 2·CELL_SIZE = 40 px Buffer
 *    behält der Pfad sichtbaren Abstand.
 *  - Top/Bottom-Handle: vorher hat der Adapter sourceExitsRight=false
 *    und targetEntersLeft=false gesetzt, was den Stub horizontal nach
 *    links statt vertikal vom Handle weggesetzt hat. Jetzt: bei
 *    Vertical-Handles wird der Stub zur "richtigen" Seite des Gerätes
 *    gelegt indem die Source/Target X-Position auf die Geräte-Mitte
 *    verschoben wird (Stub wandert dann effektiv vertikal beim Routing).
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
  /** Flow-pixel position of the source handle (already includes
   *  ReactFlow's viewport offset etc. — pass through what's in
   *  EdgeProps). */
  source: { x: number; y: number }
  target: { x: number; y: number }
  sourceSide: HandleSide
  targetSide: HandleSide
  /** All equipment rectangles (in flow coordinates). The source and
   *  target equipment are excluded automatically by id so the router
   *  isn't asked to dodge its own endpoints. */
  obstacles: PixelRect[]
  sourceEquipmentId: string
  targetEquipmentId: string
}

/** v7.9.32 — Sichtbare Lücke um jedes Hindernis. 2 Grid-Cells = 40 px.
 *  Größer als das interne ROUTING_DEFAULTS.PAD damit der Pfad klar
 *  außerhalb der Geräte-Karte verläuft (inkl. Drop-Shadow + Port-Label-
 *  Overflow), nicht direkt an der Kante entlang. */
const OBSTACLE_PAD_PX = 2 * CELL_SIZE

// ReactFlow side → outward direction (0=E, 1=S, 2=W, 3=N).
const handleToOutwardDir = (side: HandleSide): 0 | 1 | 2 | 3 => {
  switch (side) {
    case 'right':  return 0
    case 'bottom': return 1
    case 'left':   return 2
    case 'top':    return 3
  }
}

const inflate = (r: PixelRect, pad: number): Rect => ({
  left: r.x - pad,
  top: r.y - pad,
  right: r.x + r.width + pad,
  bottom: r.y + r.height + pad,
  nodeId: r.id,
})

/** Run pathfinding and return waypoints (flow-pixel coordinates) that,
 *  when combined with the source/target by the renderer, form a clean
 *  orthogonal path. Returns null if no path could be found.
 *
 *  Note: the returned waypoints are the intermediate corner points only —
 *  the literal source/target handle positions are stripped because
 *  CableEdge prepends source and appends target itself. */
export const routeCableWithAStar = (
  args: RouteCableArgs,
): { x: number; y: number }[] | null => {
  // Source and target equipment must be excluded from the obstacle set
  // so the router can plant a stub inside them.
  const excluded = new Set([args.sourceEquipmentId, args.targetEquipmentId])
  const obstacles: Rect[] = args.obstacles
    .filter((o) => !o.id || !excluded.has(o.id))
    .map((r) => inflate(r, OBSTACLE_PAD_PX))

  // Pathfinder kann nur horizontalen Stub (left/right). Für Top/Bottom-
  // Handles würden wir sonst den Stub horizontal in die falsche
  // Richtung schicken. Workaround: wir routen vom Handle aus erst
  // intern ein paar Pixel in die korrekte Vertical-Richtung; das macht
  // CableEdge beim Rendern via dem zurückgegebenen Waypoint-Set.
  // Für die Pathfinder-Anfrage geben wir source/target an, lassen aber
  // den Stub-Boolean an die nächstgelegene Horizontal-Side anlehnen.
  const sourceExitsRight = args.sourceSide === 'right' || args.sourceSide === 'top' || args.sourceSide === 'bottom'
    ? args.sourceSide === 'right' || (args.sourceSide !== 'left' && args.source.x <= args.target.x)
    : false
  const targetEntersLeft = args.targetSide === 'left' || args.targetSide === 'top' || args.targetSide === 'bottom'
    ? args.targetSide === 'left' || (args.targetSide !== 'right' && args.source.x <= args.target.x)
    : false

  // Direction the path arrives at the goal cell, in pathfinding's enum
  // (0=E, 1=S, 2=W, 3=N). Path travels INTO the device, so it's the
  // opposite of the handle's outward direction.
  const arriveDir = (handleToOutwardDir(args.targetSide) + 2) % 4
  // Free end-direction unless the handle is on a horizontal side. The
  // underlying A* already enforces "arrive horizontally" by default, so
  // for vertical handles we open it up and exclude the wrong-way arrival.
  const freeEndDir = args.targetSide === 'top' || args.targetSide === 'bottom'
  const excludeEndDir = freeEndDir ? ((arriveDir + 2) % 4) : undefined

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
  })
  if (!result) return null

  // computeEdgePath returns waypoints including source + target (grid-
  // snapped). Strip them — CableEdge re-adds the actual handle pixels.
  // Also dedup neighbouring points within one cell so stub == handle
  // doesn't leave a zero-length segment.
  const inner = result.waypoints.slice(1, -1)
  const out: { x: number; y: number }[] = []
  for (const p of inner) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 1 || Math.abs(last.y - p.y) > 1) out.push(p)
  }
  return out
}

// Re-exported for callers that previously imported these from cableAStar.
export { CELL_SIZE }
