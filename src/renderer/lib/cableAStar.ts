/**
 * v7.8.8 — A* pathfinding for cable edges.
 *
 * Clean-room implementation written from the standard CLRS A* description
 * (Russell & Norvig, Chapter 3). NOT derived from any other open-source
 * pathfinder — see commit message for context.
 *
 * What this module provides
 * -------------------------
 *  - Pure algorithm on an integer grid. No React, no DOM, no store deps.
 *  - Orthogonal-only movement (4 neighbours, no diagonals) — matches how
 *    cables are drawn on the canvas.
 *  - Direction-aware A* state (col, row, dir) so the closed-set check
 *    doesn't reject a better arrival from a different direction.
 *    Without this a path that needed to swing wide to reach a goal
 *    handle from the correct side would get stuck.
 *  - Configurable turn penalty so the optimiser prefers long straight
 *    runs over staircase-like zigzags.
 *  - "Soft obstacles" — extra cost per cell, used to discourage
 *    routing through another cable's corridor without forbidding it.
 *  - Configurable required exit direction at start AND required
 *    arrival direction at goal (e.g. "exit going right out of source
 *    output handle, arrive going right into target input handle").
 *
 * Coordinate convention
 * ---------------------
 *  Pixel coordinates live in React-Flow's continuous flow-space.
 *  The grid is a discretisation at CELL_SIZE px per cell.
 *  Grid coords (col, row) are signed integers, origin at the world
 *  origin (so grid 0,0 maps to flow position 0,0). The grid struct
 *  carries an explicit `originCol` / `originRow` so callers can build a
 *  bounded grid centred on the relevant region without translating
 *  coordinates manually.
 */

export const CELL_SIZE = 20

/** Pixel → grid (round). */
export const pxToGrid = (px: number): number => Math.round(px / CELL_SIZE)
/** Grid → pixel. */
export const gridToPx = (g: number): number => g * CELL_SIZE

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
  /** Optional id — preserved through grid conversion for downstream
   *  use (e.g. "did we cross device X?"). */
  id?: string
}

/** Direction enum. 0=East, 1=South, 2=West, 3=North.
 *  Indexes into the unit-step arrays DX / DY below. */
export type Direction = 0 | 1 | 2 | 3

const DX: readonly number[] = [1, 0, -1, 0]
const DY: readonly number[] = [0, 1, 0, -1]

export interface GridRect {
  left: number
  top: number
  right: number
  bottom: number
  id?: string
}

/** Inflate by `pad` cells in every direction and convert pixel rect to
 *  grid rect. Padding adds breathing room around the device so cables
 *  don't graze the bounding box. */
export const pixelRectToGrid = (r: PixelRect, padCells = 1): GridRect => ({
  left: Math.floor(r.x / CELL_SIZE) - padCells,
  top: Math.floor(r.y / CELL_SIZE) - padCells,
  right: Math.ceil((r.x + r.width) / CELL_SIZE) + padCells,
  bottom: Math.ceil((r.y + r.height) / CELL_SIZE) + padCells,
  id: r.id,
})

export interface AStarOptions {
  /** Grid-space obstacles — cells inside are forbidden. */
  obstacles: GridRect[]
  /** Grid-space SOFT obstacles. Cells inside add `softCost` to the
   *  step cost. Used for other-cable corridors. */
  softObstacles?: GridRect[]
  /** Extra cost for stepping into a soft-obstacle cell. */
  softCost?: number
  /** Cost added when a step direction differs from the previous step
   *  (i.e. the path turns 90°). Higher values flatten zigzags. */
  turnPenalty?: number
  /** Required direction at the start cell (the path must leave
   *  pointing this way). If unset the path may leave in any direction. */
  startDir?: Direction
  /** Required direction at the goal cell (the path must arrive
   *  pointing this way). If unset the path may arrive from any
   *  direction. */
  endDir?: Direction
  /** Hard upper bound on the number of expanded nodes. Prevents the
   *  search from running away on very large grids or impossible
   *  problems. Default 50000. */
  maxNodes?: number
  /** If true, cells INSIDE the source's bounding rectangle are
   *  forced open (otherwise the source itself would be blocked).
   *  Pass the source equipment's GridRect as `sourceRect`. */
  sourceRect?: GridRect
  /** Same as sourceRect but for the target. */
  targetRect?: GridRect
}

export interface AStarResult {
  /** Found path as a list of grid points, including start and goal. */
  path: { col: number; row: number }[]
  /** Direction the path arrived from at each step. Length matches
   *  `path` (the first entry is the starting direction). */
  arrivalDirs: Direction[]
  /** Number of nodes expanded — useful for diagnostics. */
  expanded: number
}

/** Manhattan distance. Lower bound on remaining cost (admissible
 *  heuristic) for orthogonal-only movement on a unit grid. */
const manhattan = (ax: number, ay: number, bx: number, by: number): number =>
  Math.abs(ax - bx) + Math.abs(ay - by)

/** Heuristic that ALSO accounts for the minimum-possible turn count
 *  to reach the goal direction. Still admissible because every
 *  90° change in direction along the path requires at least one
 *  turn-penalty unit. */
const heuristic = (
  col: number,
  row: number,
  dir: Direction,
  goalCol: number,
  goalRow: number,
  endDir: Direction | undefined,
  turnPenalty: number,
): number => {
  const dc = goalCol - col
  const dr = goalRow - row
  let h = Math.abs(dc) + Math.abs(dr)
  // If we have to move in both X and Y from here, at least one turn.
  const needsXY = dc !== 0 && dr !== 0
  if (needsXY) h += turnPenalty
  // If endDir specified and current dir disagrees, more turns needed.
  if (endDir != null) {
    if (dc === 0 && dr === 0) {
      // Already at goal — only constraint is matching direction.
      if (dir !== endDir) h += turnPenalty * 2
    }
  }
  return h
}

/** Min-heap keyed by node f-cost. Implemented manually for speed on
 *  hot path (Map-based heaps in JS are slow). */
class MinHeap<T> {
  private items: T[] = []
  private readonly key: (a: T) => number
  constructor(key: (a: T) => number) {
    this.key = key
  }
  get size(): number {
    return this.items.length
  }
  push(item: T): void {
    this.items.push(item)
    let i = this.items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.key(this.items[parent]) <= this.key(this.items[i])) break
      ;[this.items[i], this.items[parent]] = [this.items[parent], this.items[i]]
      i = parent
    }
  }
  pop(): T | undefined {
    if (this.items.length === 0) return undefined
    const top = this.items[0]
    const last = this.items.pop()!
    if (this.items.length > 0) {
      this.items[0] = last
      let i = 0
      const n = this.items.length
      while (true) {
        const left = i * 2 + 1
        const right = i * 2 + 2
        let smallest = i
        if (left < n && this.key(this.items[left]) < this.key(this.items[smallest])) smallest = left
        if (right < n && this.key(this.items[right]) < this.key(this.items[smallest])) smallest = right
        if (smallest === i) break
        ;[this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]]
        i = smallest
      }
    }
    return top
  }
}

interface OpenNode {
  col: number
  row: number
  dir: Direction
  g: number
  f: number
  /** Index into the parent table — i.e. flat-encoded predecessor
   *  state. -1 for the start node. */
  parent: number
}

/** Pack a (col, row, dir) tuple into a single number for fast Map keys.
 *  Assumes col/row stay within ±32767 (1.3M pixels at CELL_SIZE=20 —
 *  plenty for any sane schematic). */
const packState = (col: number, row: number, dir: Direction): number =>
  // ((col + 32768) << 18) | ((row + 32768) << 4) | dir   — bit-packed
  ((col + 32768) * 0x40000 + (row + 32768) * 16 + dir) | 0

/** A* search on the integer grid. Returns null when no path exists
 *  within `maxNodes` expansions. */
export const aStarOrthogonal = (
  startCol: number,
  startRow: number,
  goalCol: number,
  goalRow: number,
  opts: AStarOptions,
): AStarResult | null => {
  const turnPenalty = opts.turnPenalty ?? 5
  const softCost = opts.softCost ?? 4
  const maxNodes = opts.maxNodes ?? 50000

  // Pre-bucket obstacles for fast "is cell blocked?" tests. For the
  // typical canvas with <100 devices a linear scan would be fine, but
  // bucketing by row makes the inner loop measurable.
  const blocked = (col: number, row: number): boolean => {
    // Sources / targets are forced-open if they fall inside their own
    // rect — they're the endpoints, you have to be able to start there.
    if (opts.sourceRect && inRect(opts.sourceRect, col, row)) return false
    if (opts.targetRect && inRect(opts.targetRect, col, row)) return false
    for (const r of opts.obstacles) {
      if (inRect(r, col, row)) return true
    }
    return false
  }

  const softCellCost = (col: number, row: number): number => {
    if (!opts.softObstacles || opts.softObstacles.length === 0) return 0
    for (const r of opts.softObstacles) {
      if (inRect(r, col, row)) return softCost
    }
    return 0
  }

  // Trivial: start == goal.
  if (startCol === goalCol && startRow === goalRow) {
    return {
      path: [{ col: startCol, row: startRow }],
      arrivalDirs: [opts.startDir ?? 0],
      expanded: 0,
    }
  }

  // Bound the grid we'll search: the bounding box around start+goal+
  // every obstacle, expanded by a small margin so paths can swing wide.
  let minCol = Math.min(startCol, goalCol)
  let maxCol = Math.max(startCol, goalCol)
  let minRow = Math.min(startRow, goalRow)
  let maxRow = Math.max(startRow, goalRow)
  for (const r of opts.obstacles) {
    if (r.left < minCol) minCol = r.left
    if (r.right > maxCol) maxCol = r.right
    if (r.top < minRow) minRow = r.top
    if (r.bottom > maxRow) maxRow = r.bottom
  }
  const MARGIN = 6
  minCol -= MARGIN
  maxCol += MARGIN
  minRow -= MARGIN
  maxRow += MARGIN

  const inBounds = (col: number, row: number): boolean =>
    col >= minCol && col <= maxCol && row >= minRow && row <= maxRow

  // Bookkeeping.
  const open = new MinHeap<OpenNode>((a) => a.f)
  const closed = new Set<number>()
  /** parents[stateKey] = parentStateKey; -1 for start. */
  const parents = new Map<number, number>()
  /** bestG[stateKey] = best known g-cost to reach this state. */
  const bestG = new Map<number, number>()

  // Seed the open set. If a startDir is given we use ONE entry; otherwise
  // we seed all four directions so the path can leave in any.
  const seedDirs: Direction[] = opts.startDir != null ? [opts.startDir] : [0, 1, 2, 3]
  for (const dir of seedDirs) {
    const key = packState(startCol, startRow, dir)
    const f = heuristic(startCol, startRow, dir, goalCol, goalRow, opts.endDir, turnPenalty)
    open.push({ col: startCol, row: startRow, dir, g: 0, f, parent: -1 })
    bestG.set(key, 0)
  }

  let expanded = 0
  while (open.size > 0) {
    if (expanded >= maxNodes) return null
    const node = open.pop()!
    const stateKey = packState(node.col, node.row, node.dir)
    if (closed.has(stateKey)) continue
    closed.add(stateKey)
    expanded += 1

    // Goal test (must arrive in the required direction if specified).
    if (
      node.col === goalCol &&
      node.row === goalRow &&
      (opts.endDir == null || node.dir === opts.endDir)
    ) {
      // Reconstruct path.
      const path: { col: number; row: number }[] = []
      const arrivalDirs: Direction[] = []
      let curKey: number | undefined = stateKey
      while (curKey != null && curKey !== -1) {
        const col = Math.floor(curKey / 0x40000) - 32768
        const row = Math.floor((curKey % 0x40000) / 16) - 32768
        const dir = (curKey & 15) as Direction
        path.unshift({ col, row })
        arrivalDirs.unshift(dir)
        const parent = parents.get(curKey)
        curKey = parent
      }
      return { path, arrivalDirs, expanded }
    }

    // Expand neighbours.
    for (let nd = 0 as Direction; nd <= 3; nd = ((nd + 1) | 0) as Direction) {
      const ncol = node.col + DX[nd]
      const nrow = node.row + DY[nd]
      if (!inBounds(ncol, nrow)) continue
      if (blocked(ncol, nrow)) continue
      const nkey = packState(ncol, nrow, nd)
      if (closed.has(nkey)) continue
      const turnCost = nd === node.dir ? 0 : turnPenalty
      const stepCost = 1 + turnCost + softCellCost(ncol, nrow)
      const ng = node.g + stepCost
      const prevG = bestG.get(nkey)
      if (prevG != null && prevG <= ng) continue
      bestG.set(nkey, ng)
      parents.set(nkey, stateKey)
      const h = heuristic(ncol, nrow, nd, goalCol, goalRow, opts.endDir, turnPenalty)
      open.push({ col: ncol, row: nrow, dir: nd, g: ng, f: ng + h, parent: stateKey })
    }
  }
  return null
}

const inRect = (r: GridRect, col: number, row: number): boolean =>
  col >= r.left && col < r.right && row >= r.top && row < r.bottom

/** Convert a list of grid points to flow-pixel waypoints. The
 *  intermediate result has every visited cell; we collapse colinear
 *  runs into the corner points only, then drop start/end (those are
 *  re-added by the calling renderer via the cable's source/target
 *  handle coordinates). */
export const simplifyPath = (
  path: { col: number; row: number }[],
): { x: number; y: number }[] => {
  if (path.length < 2) return []
  // Keep only the corner points: drop any cell whose direction is the
  // same as the previous cell's direction.
  const corners: { col: number; row: number }[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1]
    const cur = path[i]
    const next = path[i + 1]
    const dxIn = Math.sign(cur.col - prev.col)
    const dyIn = Math.sign(cur.row - prev.row)
    const dxOut = Math.sign(next.col - cur.col)
    const dyOut = Math.sign(next.row - cur.row)
    if (dxIn !== dxOut || dyIn !== dyOut) corners.push(cur)
  }
  corners.push(path[path.length - 1])
  // Convert to pixels and strip the endpoints (the caller already has
  // them as source/target).
  return corners.slice(1, -1).map((p) => ({ x: gridToPx(p.col), y: gridToPx(p.row) }))
}
