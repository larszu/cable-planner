/**
 * Lightweight obstacle-aware orthogonal routing for cable edges.
 *
 * Given the two endpoints of a cable (already at the device boundary) and a
 * list of equipment bounding boxes, returns a list of waypoints that form an
 * orthogonal path that does **not** cross through any equipment rectangle.
 *
 * The algorithm is intentionally simple — it is not a full A* solver, but
 * handles the common case of one obstacle between source and target by going
 * around the nearest edge of the obstacle. If no obstacle is in the way, the
 * path is returned without waypoints.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

const PADDING = 12

const inflate = (r: Rect, pad: number): Rect => ({
  x: r.x - pad,
  y: r.y - pad,
  width: r.width + pad * 2,
  height: r.height + pad * 2,
})

const segmentIntersectsRect = (a: Point, b: Point, r: Rect): boolean => {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  if (maxX < r.x || minX > r.x + r.width) return false
  if (maxY < r.y || minY > r.y + r.height) return false
  return true
}

const pathClearsAll = (points: Point[], obstacles: Rect[]): boolean => {
  for (let i = 0; i < points.length - 1; i++) {
    for (const rect of obstacles) {
      if (segmentIntersectsRect(points[i], points[i + 1], rect)) return false
    }
  }
  return true
}

/**
 * Build an orthogonal L- or U-shape path from source to target, detouring
 * around a single obstacle when required.
 */
const orthogonalVariants = (source: Point, target: Point): Point[][] => {
  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2
  return [
    // L: horizontal first — single bend, stays attached when target moves
    // vertically. Preferred so cables don't "spin" while dragging endpoints.
    [source, { x: target.x, y: source.y }, target],
    // L: vertical first
    [source, { x: source.x, y: target.y }, target],
    // HVH (two bends at horizontal mid-point) — fallback when L collides.
    [source, { x: midX, y: source.y }, { x: midX, y: target.y }, target],
    // VHV (two bends at vertical mid-point)
    [source, { x: source.x, y: midY }, { x: target.x, y: midY }, target],
  ]
}

const detourAround = (source: Point, target: Point, rect: Rect): Point[][] => {
  const r = inflate(rect, PADDING)
  const above = r.y
  const below = r.y + r.height
  const left = r.x
  const right = r.x + r.width
  return [
    // Over the top of the obstacle.
    [source, { x: source.x, y: above }, { x: target.x, y: above }, target],
    // Under the bottom of the obstacle.
    [source, { x: source.x, y: below }, { x: target.x, y: below }, target],
    // Around the left side.
    [source, { x: left, y: source.y }, { x: left, y: target.y }, target],
    // Around the right side.
    [source, { x: right, y: source.y }, { x: right, y: target.y }, target],
  ]
}

const pathLength = (points: Point[]): number => {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
  }
  return total
}

/**
 * Given source and target points plus equipment bounding boxes, returns a set
 * of intermediate waypoints (excluding source/target) that routes around any
 * obstacle. Returns an empty array when the direct orthogonal route is clear.
 */
export const computeObstacleAwareWaypoints = (
  source: Point,
  target: Point,
  obstacles: Rect[],
  ignoreIds?: Set<string>,
  obstacleIds?: string[],
): Point[] => {
  const relevantObstacles = obstacles.filter((_, i) => {
    const id = obstacleIds?.[i]
    if (!id) return true
    return !ignoreIds?.has(id)
  })
  if (relevantObstacles.length === 0) return []

  const variants = orthogonalVariants(source, target)
  // Pick the FIRST clear variant in the predefined order (L-h > L-v > HVH >
  // VHV). Single-bend L-shapes are preferred because they stay attached to
  // both endpoints when nodes are dragged, eliminating the user-visible
  // "spinning" / flickering of orthogonal cables on every pixel-level move.
  const firstClear = variants.find((v) => pathClearsAll(v, relevantObstacles))
  if (firstClear) return firstClear.slice(1, -1)

  // Find the first obstacle the naive HVH path crosses and detour around it.
  const naive = variants[2]
  const offender = relevantObstacles.find((rect) =>
    naive.some((_, i) => i < naive.length - 1 && segmentIntersectsRect(naive[i], naive[i + 1], rect)),
  )
  if (!offender) return []

  const detours = detourAround(source, target, offender)
  const firstClearDetour = detours.find((v) => pathClearsAll(v, relevantObstacles))
  if (firstClearDetour) return firstClearDetour.slice(1, -1)
  // Fall back to the shortest detour even if it still grazes something.
  detours.sort((a, b) => pathLength(a) - pathLength(b))
  return detours[0].slice(1, -1)
}
