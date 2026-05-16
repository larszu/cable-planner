/**
 * v7.8.8 — Adapter that turns my Cable + Equipment world into A* input
 * and returns waypoints in flow-pixel coordinates that the existing
 * CableEdge can render.
 *
 * Inputs that matter:
 *   - source / target ports' flow positions (computed by the caller —
 *     ReactFlow gives us those as sourceX/sourceY/targetX/targetY in
 *     the EdgeProps)
 *   - source / target handle SIDES (Left | Right | Top | Bottom) so we
 *     can tell A* "exit this side going outward, enter that side going
 *     inward"
 *   - every other equipment box on the canvas, used as a hard obstacle
 *   - optionally, every OTHER cable's path used as soft obstacles so
 *     the router prefers a free corridor over piling on top of an
 *     existing trunk
 *
 * The adapter does NOT mutate the store. It is a pure function that
 * returns waypoints; the caller decides whether to write them back to
 * the cable.
 */

import {
  aStarOrthogonal,
  pixelRectToGrid,
  pxToGrid,
  simplifyPath,
  type Direction,
  type GridRect,
  type PixelRect,
} from './cableAStar'

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'

/** Map a handle side to the OUTWARD-facing direction the path should
 *  leave (or arrive). A right-side output exits going EAST (dir 0); a
 *  left-side input is entered going EAST too (path arrives traveling
 *  east into the left side of the device). */
const handleToOutwardDir = (side: HandleSide): Direction => {
  switch (side) {
    case 'right':
      return 0 // East — paths leaving a right handle go east; paths entering a right handle came from east → travel west → dir 2. (See arrivalDir below.)
    case 'bottom':
      return 1 // South
    case 'left':
      return 2 // West
    case 'top':
      return 3 // North
  }
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
   *  target equipment must be flagged so the router opens cells inside
   *  them — otherwise the start/end are blocked. */
  obstacles: PixelRect[]
  /** id of the source equipment in `obstacles`. Used to find the
   *  matching rect and pass it as sourceRect. */
  sourceEquipmentId: string
  targetEquipmentId: string
  /** Segments of every other cable (flow coords). Cells inside the
   *  corridor formed by these segments incur a soft cost so the
   *  router prefers free space. */
  otherCableSegments?: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>
  /** Override the default per-cell turn penalty. */
  turnPenalty?: number
}

const STUB_CELLS = 1 // grid cells to step away from the handle before turning

/** Build "soft obstacle" rects from another cable's segments. Each
 *  segment becomes a thin rectangle (1 cell wide) along its axis. */
const segmentsToSoftRects = (
  segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>,
): GridRect[] => {
  const rects: GridRect[] = []
  for (const seg of segments) {
    const a = seg.a
    const b = seg.b
    if (Math.abs(a.y - b.y) < 1) {
      // Horizontal segment
      const left = pxToGrid(Math.min(a.x, b.x))
      const right = pxToGrid(Math.max(a.x, b.x))
      const row = pxToGrid(a.y)
      rects.push({ left, right: right + 1, top: row, bottom: row + 1 })
    } else if (Math.abs(a.x - b.x) < 1) {
      // Vertical segment
      const top = pxToGrid(Math.min(a.y, b.y))
      const bottom = pxToGrid(Math.max(a.y, b.y))
      const col = pxToGrid(a.x)
      rects.push({ left: col, right: col + 1, top, bottom: bottom + 1 })
    }
  }
  return rects
}

/** Step away from the handle by STUB_CELLS so the start/end cells
 *  are OUTSIDE the device's blocked rect. Returns the new (col, row)
 *  in grid coordinates plus the direction the path should head from
 *  that cell. */
const stubStart = (
  side: HandleSide,
  px: { x: number; y: number },
): { col: number; row: number; dir: Direction } => {
  const baseCol = pxToGrid(px.x)
  const baseRow = pxToGrid(px.y)
  const outward = handleToOutwardDir(side)
  const stubCol = baseCol + STUB_CELLS * Math.sign((outward === 0 ? 1 : outward === 2 ? -1 : 0))
  const stubRow = baseRow + STUB_CELLS * Math.sign((outward === 1 ? 1 : outward === 3 ? -1 : 0))
  return { col: stubCol, row: stubRow, dir: outward }
}

const stubEnd = (
  side: HandleSide,
  px: { x: number; y: number },
): { col: number; row: number; arriveDir: Direction } => {
  const baseCol = pxToGrid(px.x)
  const baseRow = pxToGrid(px.y)
  const outward = handleToOutwardDir(side)
  // Path must ARRIVE traveling INTO the device — so direction is the
  // OPPOSITE of outward.
  const arriveDir = ((outward + 2) % 4) as Direction
  const stubCol = baseCol + STUB_CELLS * Math.sign((outward === 0 ? 1 : outward === 2 ? -1 : 0))
  const stubRow = baseRow + STUB_CELLS * Math.sign((outward === 1 ? 1 : outward === 3 ? -1 : 0))
  return { col: stubCol, row: stubRow, arriveDir }
}

/** Run A* and return waypoints (flow-pixel coordinates) that, when
 *  combined with the source/target by the renderer, form a clean
 *  orthogonal path. Returns null if no path was found within the
 *  search budget — caller should fall back to the existing simple
 *  router.
 *
 *  Note: the returned waypoints do NOT include the literal handle
 *  positions; they are the intermediate corner points only. CableEdge
 *  prepends source and appends target as usual. */
export const routeCableWithAStar = (
  args: RouteCableArgs,
): { x: number; y: number }[] | null => {
  // Convert obstacles. The source and target equipment get their rects
  // surfaced so A* can force-open their cells at start/end.
  const PAD = 1 // grid cells of breathing room around each device
  const obstaclesGrid = args.obstacles.map((o) => pixelRectToGrid(o, PAD))
  const sourceRect = obstaclesGrid.find((r) => r.id === args.sourceEquipmentId)
  const targetRect = obstaclesGrid.find((r) => r.id === args.targetEquipmentId)
  // Remove source/target rects from the blocked list — they're force-
  // opened, but other cables shouldn't dodge their own endpoints.
  const obstacles = obstaclesGrid.filter(
    (r) => r.id !== args.sourceEquipmentId && r.id !== args.targetEquipmentId,
  )

  const soft = args.otherCableSegments ? segmentsToSoftRects(args.otherCableSegments) : []

  // Stub points: step away from each handle by 1 cell so A* starts
  // OUTSIDE the device rect.
  const start = stubStart(args.sourceSide, args.source)
  const end = stubEnd(args.targetSide, args.target)

  const result = aStarOrthogonal(start.col, start.row, end.col, end.row, {
    obstacles,
    softObstacles: soft,
    softCost: 4,
    turnPenalty: args.turnPenalty ?? 5,
    startDir: start.dir,
    endDir: end.arriveDir,
    sourceRect,
    targetRect,
    maxNodes: 30000,
  })
  if (!result) return null

  // Build the full pixel path: source handle → stub-start → corners
  // → stub-end → target handle. The returned simplifyPath drops the
  // start/end cells from `path`, but we want the stubs to be part of
  // the waypoint list because the renderer connects directly from
  // source-handle to first waypoint.
  const corners = simplifyPath(result.path)
  // Convert stub cells to pixel coords and prepend / append to corners.
  const stubStartPx = { x: start.col * 20, y: start.row * 20 }
  const stubEndPx = { x: end.col * 20, y: end.row * 20 }

  // Only include stubs as explicit waypoints if they actually sit
  // away from the source/target pixel — otherwise duplicating points
  // creates zero-length segments.
  const dedup: { x: number; y: number }[] = []
  const push = (p: { x: number; y: number }) => {
    const last = dedup[dedup.length - 1]
    if (!last || Math.abs(last.x - p.x) > 1 || Math.abs(last.y - p.y) > 1) dedup.push(p)
  }
  push(stubStartPx)
  for (const c of corners) push(c)
  push(stubEndPx)

  return dedup
}
