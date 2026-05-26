/**
 * v7.9.123 / Bug-1 — Multi-Viewer Window-Index-Mapping fuer ATEM-Send.
 *
 * Cable-Planner verwendet intern ein Quadranten-basiertes Schema:
 *   - 0/1/2/3        = grosse Slots (TL/TR/BL/BR)
 *   - 10-13          = kleine Zellen in Quadrant 0
 *   - 20-23          = kleine Zellen in Quadrant 1
 *   - 30-33          = kleine Zellen in Quadrant 2
 *   - 40-43          = kleine Zellen in Quadrant 3
 *
 * ATEM-Hardware erwartet aber 0..N je nach Layout:
 *   - Standard 10-Tile (Default/ProgramTop/...): 0..9
 *       0,1 = grosse Slots (PGM/PRV)
 *       2..9 = 8 kleine Tiles in row-major-Reihenfolge
 *   - Grid16Small (=16): 0..15 row-major im 4x4-Grid
 *   - Quad4Big (=32):    0..3  row-major im 2x2-Grid
 *
 * Diese Datei spiegelt die Mapping-Logik aus src/renderer/lib/
 * atemMvLayout.ts; der Renderer hat einen UI-Pfad mit ggf. anderen
 * Anwendungen — der Main-Prozess hier nur die Send-Konvertierung.
 *
 * Liefert -1 wenn der CP-Index im aktuellen Layout keine ATEM-Window-
 * Entsprechung hat (Caller skipt diesen Window-Update-Befehl dann).
 */

const MV_LAYOUT_DEFAULT = 0
const MV_LAYOUT_TOP_LEFT_SMALL = 1
const MV_LAYOUT_TOP_RIGHT_SMALL = 2
const MV_LAYOUT_PROGRAM_BOTTOM = 3
const MV_LAYOUT_BOTTOM_LEFT_SMALL = 4
const MV_LAYOUT_PROGRAM_RIGHT = 5
const MV_LAYOUT_BOTTOM_RIGHT_SMALL = 8
const MV_LAYOUT_PROGRAM_LEFT = 10
const MV_LAYOUT_PROGRAM_TOP = 12
const MV_LAYOUT_GRID_16_SMALL = 16
const MV_LAYOUT_QUAD_4_BIG = 32

interface GridCell {
  colStart: number
  rowStart: number
}
interface BigCell extends GridCell {
  window: number
  colSpan: number
  rowSpan: number
}
interface MvGridSpec {
  big: BigCell[]
  small: GridCell[]
  smallWindowOffset?: number
}

// Replizieren wir aus src/renderer/lib/atemMvLayout.ts. Die Specs muessen
// 1:1 dem Renderer-Pendant entsprechen damit das UI und der Send-Path
// dieselbe Welt-Vorstellung haben.
const MV_GRID_4X4: Record<number, MvGridSpec> = {
  [MV_LAYOUT_DEFAULT]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_PROGRAM_TOP]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_PROGRAM_BOTTOM]: {
    big: [
      { window: 0, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 },
      { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 },
      { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
    ],
  },
  [MV_LAYOUT_PROGRAM_LEFT]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_PROGRAM_RIGHT]: {
    big: [
      { window: 0, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 },
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_TOP_LEFT_SMALL]: {
    big: [
      { window: 0, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 },
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_TOP_RIGHT_SMALL]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_BOTTOM_LEFT_SMALL]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_BOTTOM_RIGHT_SMALL]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_GRID_16_SMALL]: {
    big: [],
    smallWindowOffset: 0,
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 }, { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 }, { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 }, { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 }, { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [MV_LAYOUT_QUAD_4_BIG]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 2, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
      { window: 3, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [],
  },
}

const quadrantOfCell = (col: number, row: number): 0 | 1 | 2 | 3 => {
  const qCol = col <= 2 ? 0 : 1
  const qRow = row <= 2 ? 0 : 1
  return (qRow * 2 + qCol) as 0 | 1 | 2 | 3
}

export const mapCpWindowIndexToAtem = (
  cpWindowIndex: number,
  layout: number,
): number => {
  if (cpWindowIndex < 10) {
    const quadIdx = cpWindowIndex as 0 | 1 | 2 | 3
    if (layout === MV_LAYOUT_QUAD_4_BIG) return quadIdx
    if (layout === MV_LAYOUT_GRID_16_SMALL) return -1
    const spec = MV_GRID_4X4[layout]
    if (!spec) return -1
    for (const big of spec.big) {
      if (quadrantOfCell(big.colStart, big.rowStart) === quadIdx) return big.window
    }
    return -1
  }
  const quadIdx = (Math.floor(cpWindowIndex / 10) - 1) as 0 | 1 | 2 | 3
  const cellIdx = (cpWindowIndex % 10) as 0 | 1 | 2 | 3
  if (layout === MV_LAYOUT_GRID_16_SMALL) {
    const qRow = Math.floor(quadIdx / 2)
    const qCol = quadIdx % 2
    const cRow = Math.floor(cellIdx / 2)
    const cCol = cellIdx % 2
    return qRow * 8 + cRow * 4 + qCol * 2 + cCol
  }
  if (layout === MV_LAYOUT_QUAD_4_BIG) return -1
  const spec = MV_GRID_4X4[layout]
  if (!spec) return -1
  const qCol = quadIdx % 2
  const qRow = Math.floor(quadIdx / 2)
  const targetCol = qCol * 2 + (cellIdx % 2) + 1
  const targetRow = qRow * 2 + Math.floor(cellIdx / 2) + 1
  const offset = spec.smallWindowOffset ?? 2
  for (let i = 0; i < spec.small.length; i++) {
    if (spec.small[i].colStart === targetCol && spec.small[i].rowStart === targetRow) {
      return offset + i
    }
  }
  return -1
}

/**
 * #288 — Reverse-Lookup: ATEM-Window-Index → CP-Quadranten-Schema.
 *
 * Implementiert durch Vorwaerts-Iteration ueber alle moeglichen CP-Indices
 * (0..3 fuer big-Slots + 10..13/20..23/30..33/40..43 fuer small-Cells),
 * sodass wir keine zweite Layout-Spec parallel pflegen muessen. Liefert
 * undefined wenn der ATEM-Index im aktuellen Layout keine CP-Entsprechung
 * hat (sollte nicht passieren wenn der ATEM die Daten gerade selbst
 * gesendet hat, defensiver Fallback).
 */
export const mapAtemWindowIndexToCp = (
  atemWindowIndex: number,
  layout: number,
): number | undefined => {
  const candidates = [
    0, 1, 2, 3,
    10, 11, 12, 13,
    20, 21, 22, 23,
    30, 31, 32, 33,
    40, 41, 42, 43,
  ]
  for (const cp of candidates) {
    if (mapCpWindowIndexToAtem(cp, layout) === atemWindowIndex) return cp
  }
  return undefined
}
