// #118 / v7.9.28 — Pure alignment/distribute geometry, geteilt zwischen der
// globalen CanvasToolbar und der schwebenden Inline-Selektions-Toolbar (#118),
// damit beide exakt dieselbe Mathematik nutzen (Single Source of Truth).

export type AlignMode =
  | 'left'
  | 'right'
  | 'center-h'
  | 'top'
  | 'bottom'
  | 'center-v'
  | 'distribute-h'
  | 'distribute-v'

export interface AlignItem {
  id: string
  x: number
  y: number
  /** gerenderte Breite */
  w: number
  /** gerenderte Höhe */
  h: number
}

export interface AlignOptions {
  /** Snap-Funktion (Raster oder Math.round). */
  snap: (v: number) => number
  /** Bounding-Box-Referenz für Single-Selection (Viewport). Bei Multi-
   *  Selection ignoriert — dann ist die Selektions-Bbox die Referenz. */
  singleSelectionBounds?: { minX: number; minY: number; maxX: number; maxY: number } | null
}

/** Liefert die geänderten Positionen je Item-ID (nur tatsächlich bewegte). */
export const computeAlignedPositions = (
  items: AlignItem[],
  mode: AlignMode,
  { snap, singleSelectionBounds }: AlignOptions,
): Map<string, { x: number; y: number }> => {
  const result = new Map<string, { x: number; y: number }>()
  if (items.length === 0) return result

  // Distribute braucht 3+ Items — sonst no-op.
  if ((mode === 'distribute-h' || mode === 'distribute-v') && items.length < 3) return result

  if (mode === 'distribute-h') {
    const sorted = [...items].sort((a, b) => a.x - b.x)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const span = last.x + last.w - first.x
    const totalWidths = sorted.reduce((sum, s) => sum + s.w, 0)
    const gapEach = (span - totalWidths) / (sorted.length - 1)
    let cursor = first.x
    for (const s of sorted) {
      const nx = snap(cursor)
      if (nx !== s.x) result.set(s.id, { x: nx, y: s.y })
      cursor += s.w + gapEach
    }
    return result
  }

  if (mode === 'distribute-v') {
    const sorted = [...items].sort((a, b) => a.y - b.y)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const span = last.y + last.h - first.y
    const totalHeights = sorted.reduce((sum, s) => sum + s.h, 0)
    const gapEach = (span - totalHeights) / (sorted.length - 1)
    let cursor = first.y
    for (const s of sorted) {
      const ny = snap(cursor)
      if (ny !== s.y) result.set(s.id, { x: s.x, y: ny })
      cursor += s.h + gapEach
    }
    return result
  }

  // Single Selection → Bounding-Box ist der sichtbare Viewport.
  // Multi → Selection-Bounding-Box (Figma-Standard).
  let minX: number, maxX: number, minY: number, maxY: number
  if (items.length === 1) {
    if (!singleSelectionBounds) return result
    minX = singleSelectionBounds.minX
    maxX = singleSelectionBounds.maxX
    minY = singleSelectionBounds.minY
    maxY = singleSelectionBounds.maxY
  } else {
    minX = Math.min(...items.map((s) => s.x))
    maxX = Math.max(...items.map((s) => s.x + s.w))
    minY = Math.min(...items.map((s) => s.y))
    maxY = Math.max(...items.map((s) => s.y + s.h))
  }
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  for (const { id, x, y, w, h } of items) {
    let nx = x
    let ny = y
    switch (mode) {
      case 'left': nx = minX; break
      case 'right': nx = maxX - w; break
      case 'center-h': nx = centerX - w / 2; break
      case 'top': ny = minY; break
      case 'bottom': ny = maxY - h; break
      case 'center-v': ny = centerY - h / 2; break
    }
    nx = snap(nx)
    ny = snap(ny)
    if (nx !== x || ny !== y) result.set(id, { x: nx, y: ny })
  }
  return result
}
