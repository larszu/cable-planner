/**
 * Shared grid specs for ATEM Multiviewer layouts. Used by both the live view
 * (MultiviewerLayoutView) and the offline editor (AtemMvConfigDialog).
 *
 * Layout enum values mirror atem-connection's MultiViewerLayout enum.
 * Each MV has 10 windows: 0 = PRV, 1 = PGM (or swapped), 2-9 = small tiles.
 */

export const MV_LAYOUT = {
  Default: 0,
  TopLeftSmall: 1,
  TopRightSmall: 2,
  ProgramBottom: 3,
  BottomLeftSmall: 4,
  ProgramRight: 5,
  BottomRightSmall: 8,
  ProgramLeft: 10,
  ProgramTop: 12,
  // v7.9.4 — Constellation-Familie unterstützt zusätzlich:
  Grid16Small: 16, // 4×4 alle kleine Fenster (kein PGM/PRV)
  Quad4Big: 32, //    2×2 vier große Fenster
} as const

export const MV_LAYOUT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Default' },
  { value: 12, label: 'Program Top' },
  { value: 3, label: 'Program Bottom' },
  { value: 10, label: 'Program Left' },
  { value: 5, label: 'Program Right' },
  { value: 1, label: 'Small in Top-Left Corner' },
  { value: 2, label: 'Small in Top-Right Corner' },
  { value: 4, label: 'Small in Bottom-Left Corner' },
  { value: 8, label: 'Small in Bottom-Right Corner' },
  { value: 16, label: 'Grid (16 klein)' },
  { value: 32, label: 'Quad (4 groß)' },
]

export interface MvGridSpec {
  big: { window: number; colStart: number; rowStart: number; colSpan: number; rowSpan: number }[]
  small: { colStart: number; rowStart: number }[]
  /** v7.9.4 — Optionaler Versatz für die windowIndex-Berechnung kleiner
   *  Zellen. Default ist 2 (window 0/1 sind PGM/PRV in den großen
   *  Fenstern, kleine starten bei windowIndex=2). Für Grid16Small ist
   *  das 0 (alle 16 Fenster sind klein, beginnen bei 0). */
  smallWindowOffset?: number
}

export const MV_GRID_4X4: Record<number, MvGridSpec> = {
  [MV_LAYOUT.Default]: {
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
  [MV_LAYOUT.ProgramTop]: {
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
  [MV_LAYOUT.ProgramBottom]: {
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
  [MV_LAYOUT.ProgramLeft]: {
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
  [MV_LAYOUT.ProgramRight]: {
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
  [MV_LAYOUT.TopLeftSmall]: {
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
  [MV_LAYOUT.TopRightSmall]: {
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
  [MV_LAYOUT.BottomLeftSmall]: {
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
  [MV_LAYOUT.BottomRightSmall]: {
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
  // v7.9.4 — Grid 16: jede der 16 Zellen ist ein eigenes kleines
  // Fenster. Kein PGM/PRV — alle 16 sind gleichberechtigt.
  // smallWindowOffset=0 → windowIndex == smallIdx (0..15)
  [MV_LAYOUT.Grid16Small]: {
    big: [],
    smallWindowOffset: 0,
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 }, { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 }, { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 }, { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 }, { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  // v7.9.4 — Quad 4: vier große 2×2 Fenster, kein kleines.
  // Fenster-IDs 0/1 sind weiterhin PGM/PRV-Plätze (oben),
  // 2/3 sind die zwei unteren großen Fenster.
  [MV_LAYOUT.Quad4Big]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 2, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
      { window: 3, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [],
  },
}

export const getMvGridSpec = (layout: number): MvGridSpec =>
  MV_GRID_4X4[layout] ?? MV_GRID_4X4[MV_LAYOUT.Default]

/**
 * Heuristic: how many multiviewers does this ATEM model have?
 * Constellation 8K = 4, 2 M/E = 2, 1 M/E Production = 1, Mini series = 1.
 */
export const defaultMvCount = (equipmentName: string): number => {
  const n = equipmentName.toLowerCase()
  if (n.includes('constellation') && n.includes('8k')) return 4
  if (n.includes('constellation')) return 2
  if (n.includes('2 m/e') || n.includes('2m/e') || n.includes('2me')) return 2
  if (n.includes('television studio')) return 1
  if (n.includes('mini')) return 1
  if (n.includes('1 m/e') || n.includes('1m/e')) return 1
  return 2
}

/** v7.9.4 — Modell-Capabilities: welche MV-Layouts unterstützt das
 *  jeweilige ATEM-Modell auf der Hardware? Wir senden den Layout-Code
 *  via atem-connection; das ATEM ignoriert/rejected unbekannte Werte.
 *  Das hier ist die Lookup-Liste die wir aus Blackmagic-Manuals
 *  ableiten — siehe README + die Override pro Gerät
 *  (equipment.atemMvCapabilitiesOverride) zum Anpassen wenn die
 *  Heuristik mal falsch liegt. */
export interface AtemMvCapabilities {
  /** Wie viele MultiViewer-Ausgänge hat das Modell? */
  mvCount: number
  /** Welche Layout-Werte unterstützt das Modell? (Aus MV_LAYOUT) */
  supportedLayouts: number[]
  /** Maximale Anzahl Fenster pro MV (10 für Standard, 16 für Grid). */
  maxWindowsPerMv: number
}

const ALL_STANDARD_9: number[] = [0, 1, 2, 3, 4, 5, 8, 10, 12]
const ALL_LAYOUTS_FULL: number[] = [...ALL_STANDARD_9, MV_LAYOUT.Grid16Small, MV_LAYOUT.Quad4Big]

/** Patterns matchen gegen equipment.name.toLowerCase(). Erste Treffer
 *  gewinnt — also speziellere Patterns nach oben packen. */
const MODEL_CAPABILITIES_RULES: Array<{ pattern: RegExp; caps: AtemMvCapabilities }> = [
  // Constellation 8K — Top-Tier, 4 MVs, alle 11 Layouts inkl. Grid+Quad
  {
    pattern: /constellation\s*8k/i,
    caps: { mvCount: 4, supportedLayouts: ALL_LAYOUTS_FULL, maxWindowsPerMv: 16 },
  },
  // Constellation HD/4K — 2 MVs, alle 9 Standard + Grid16 + Quad4
  {
    pattern: /constellation/i,
    caps: { mvCount: 2, supportedLayouts: ALL_LAYOUTS_FULL, maxWindowsPerMv: 16 },
  },
  // 4 M/E Production/Broadcast Studio 4K — 2 MVs, alle 9 Standard
  {
    pattern: /4\s*m\/e/i,
    caps: { mvCount: 2, supportedLayouts: ALL_STANDARD_9, maxWindowsPerMv: 10 },
  },
  // 2 M/E Production/Broadcast Studio 4K — 2 MVs, alle 9 Standard
  {
    pattern: /2\s*m\/e/i,
    caps: { mvCount: 2, supportedLayouts: ALL_STANDARD_9, maxWindowsPerMv: 10 },
  },
  // 1 M/E Production Studio 4K — 1 MV, alle 9 Standard
  {
    pattern: /1\s*m\/e/i,
    caps: { mvCount: 1, supportedLayouts: ALL_STANDARD_9, maxWindowsPerMv: 10 },
  },
  // Television Studio HD8 (ISO) — 1 MV, Standard 9 (geprüft im Manual)
  {
    pattern: /television\s*studio\s*hd\s*8/i,
    caps: { mvCount: 1, supportedLayouts: ALL_STANDARD_9, maxWindowsPerMv: 10 },
  },
  // Television Studio HD — 1 MV, NUR Default (sehr eingeschränkt)
  {
    pattern: /television\s*studio/i,
    caps: { mvCount: 1, supportedLayouts: [MV_LAYOUT.Default], maxWindowsPerMv: 10 },
  },
  // ATEM Mini Extreme (ISO) — 1 MV, Standard 9
  {
    pattern: /mini\s*extreme/i,
    caps: { mvCount: 1, supportedLayouts: ALL_STANDARD_9, maxWindowsPerMv: 10 },
  },
  // ATEM Mini Pro (ISO) — 1 MV, NUR Default
  {
    pattern: /mini\s*pro/i,
    caps: { mvCount: 1, supportedLayouts: [MV_LAYOUT.Default], maxWindowsPerMv: 10 },
  },
  // ATEM Mini (Original) — KEIN MV-Out → mvCount: 0, kein Layout
  {
    pattern: /\bmini\b/i,
    caps: { mvCount: 0, supportedLayouts: [], maxWindowsPerMv: 0 },
  },
]

/** Default-Capabilities wenn kein Pattern matcht — konservativ.
 *  Zwei MVs, alle 9 Standard-Layouts, kein Grid/Quad (das ist
 *  Constellation-spezifisch). */
export const DEFAULT_CAPABILITIES: AtemMvCapabilities = {
  mvCount: 2,
  supportedLayouts: ALL_STANDARD_9,
  maxWindowsPerMv: 10,
}

/** Lookup mit optionalem Override. Wenn der User die Auto-Erkennung
 *  überschreiben will, speichert das EquipmentItem ein
 *  atemMvCapabilitiesOverride-Feld das hier rein-pipettiert wird. */
export const getMvCapabilities = (
  equipmentName: string,
  override?: AtemMvCapabilities,
): AtemMvCapabilities => {
  if (override) return override
  for (const rule of MODEL_CAPABILITIES_RULES) {
    if (rule.pattern.test(equipmentName)) return rule.caps
  }
  return DEFAULT_CAPABILITIES
}

/** Helper für die UI: ist ein bestimmter Layout-Wert für dieses
 *  Modell unterstützt? */
export const isLayoutSupported = (
  layout: number,
  caps: AtemMvCapabilities,
): boolean => caps.supportedLayouts.includes(layout)

// v7.9.4 — Quadranten-basiertes Model. Der User kann JEDEN Quadranten
// einzeln zwischen "1 großes Fenster" und "4 kleine Fenster" togglen,
// unabhängig von ATEMs festen Pattern-Vorgaben. ATEM-Layout wird beim
// Senden aus den Quadrants abgeleitet.
import type { AtemMvDefinition, AtemMvQuadrants, AtemMvQuadrantState } from '../types/equipment'

/** Quadranten-Zustand für die 9 echten ATEM-Layouts. Dient als
 *  Default-Ableitung wenn ein MV-Eintrag kein `quadrants`-Field hat
 *  (Legacy-Daten). */
const LAYOUT_TO_QUADRANTS: Record<number, AtemMvQuadrants> = {
  0: ['big', 'big', 'small', 'small'], // Default
  1: ['small', 'big', 'small', 'big'], // TopLeftSmall
  2: ['big', 'small', 'big', 'small'], // TopRightSmall
  3: ['small', 'small', 'big', 'big'], // ProgramBottom
  4: ['big', 'big', 'small', 'small'], // BottomLeftSmall
  5: ['small', 'big', 'small', 'big'], // ProgramRight
  8: ['big', 'big', 'small', 'small'], // BottomRightSmall
  10: ['big', 'small', 'big', 'small'], // ProgramLeft
  12: ['big', 'big', 'small', 'small'], // ProgramTop
  [MV_LAYOUT.Grid16Small]: ['small', 'small', 'small', 'small'],
  [MV_LAYOUT.Quad4Big]: ['big', 'big', 'big', 'big'],
}

/** Liefert das Quadranten-4-Tupel für einen MV-Eintrag. Bevorzugt
 *  `mv.quadrants`, fällt sonst auf eine Ableitung aus `mv.layout`
 *  zurück. */
export const getMvQuadrants = (
  mv: Pick<AtemMvDefinition, 'quadrants' | 'layout'>,
): AtemMvQuadrants => {
  if (mv.quadrants) return mv.quadrants
  return LAYOUT_TO_QUADRANTS[mv.layout] ?? LAYOUT_TO_QUADRANTS[0]
}

/** Window-Index Schema im Quadranten-Modell:
 *  - 0/1/2/3 = großer Slot für TL/TR/BL/BR
 *  - 10-13/20-23/30-33/40-43 = die 4 kleinen Zellen pro Quadrant
 *  (Zell-Order innerhalb des Quadranten: row-major, top-left zuerst.) */
export const mvWindowIndex = (quadIdx: 0 | 1 | 2 | 3, cellIdx?: 0 | 1 | 2 | 3): number => {
  if (cellIdx === undefined) return quadIdx
  return (quadIdx + 1) * 10 + cellIdx
}

/**
 * v7.9.123 / Bug #ATEM-MV — Mapping CP-internes Quadranten-Schema →
 * ATEM-native Window-Indexes vor dem Senden.
 *
 * CP intern: 0/1/2/3 (groß) + 10-13/20-23/30-33/40-43 (klein).
 * ATEM extern erwartet:
 *   - Standard 10-Tile-Layout (Default, ProgramTop/Bottom/Left/Right,
 *     TopLeft/Right/BottomLeft/BottomRight-Small): 0..9.
 *       0 = PGM/PRV-Slot 1 (groß), 1 = PGM/PRV-Slot 2 (groß),
 *       2..9 = kleine Tiles in row-major-Reihenfolge im Small-Bereich.
 *   - Grid16Small: 0..15, row-major im 4×4-Grid.
 *   - Quad4Big: 0..3, row-major im 2×2-Grid.
 *
 * Diese Funktion kennt die Mapping-Regeln pro Layout und liefert -1
 * wenn der CP-Index im aktuellen Layout keine Entsprechung hat
 * (Caller skipt diesen Window-Update-Befehl dann).
 */
export const mapCpWindowIndexToAtem = (
  cpWindowIndex: number,
  layout: number,
): number => {
  // CP-Index < 10 → großer Slot (Quadrant-ID 0/1/2/3)
  if (cpWindowIndex < 10) {
    const quadIdx = cpWindowIndex as 0 | 1 | 2 | 3
    return mapBigQuadrantToAtem(quadIdx, layout)
  }
  // CP-Index ≥ 10 → kleine Zelle: 10-13 = Quad0 cells 0-3, 20-23 = Quad1 cells 0-3, ...
  const quadIdx = (Math.floor(cpWindowIndex / 10) - 1) as 0 | 1 | 2 | 3
  const cellIdx = (cpWindowIndex % 10) as 0 | 1 | 2 | 3
  return mapSmallCellToAtem(quadIdx, cellIdx, layout)
}

/** Großer Quadrant → ATEM-Window-Index. Welcher Quadrant zu welchem
 *  ATEM-Big-Slot (0 oder 1) gehört, hängt vom Layout ab. Wenn der
 *  Quadrant im gewählten Layout KEIN großer Slot ist (z.B. Quad 2 bei
 *  Default-Layout, der ist da klein), liefert die Funktion -1. */
const mapBigQuadrantToAtem = (
  quadIdx: 0 | 1 | 2 | 3,
  layout: number,
): number => {
  if (layout === MV_LAYOUT.Quad4Big) {
    // 2×2 große Tiles, alle vier sind big, row-major.
    // ATEM-Indices: TL=0, TR=1, BL=2, BR=3 → Quad-IDs gehen direkt durch.
    return quadIdx
  }
  if (layout === MV_LAYOUT.Grid16Small) {
    // Hat keine big-Slots — der User hat im Quadranten-Modell aber
    // einen 'big' eingestellt. Im Grid16-Layout existiert das nicht;
    // der Caller skipt den Window-Set.
    return -1
  }
  // Standard-10-Tile: Big-Slots sind 0 und 1, in der Reihenfolge ihrer
  // Position. MV_GRID_4X4[layout].big[] hat sie sortiert.
  const spec = MV_GRID_4X4[layout]
  if (!spec) return -1
  // Welcher Quadrant entspricht welchem ATEM-Big-Slot? Dazu schauen wir
  // wo in MV_GRID_4X4[layout].big[] die big-Cells positioniert sind und
  // mappen anhand der colStart/rowStart auf die Quadrant-IDs (TL/TR/BL/BR).
  for (let i = 0; i < spec.big.length; i++) {
    const big = spec.big[i]
    const bigQuadrant = quadrantOfCell(big.colStart, big.rowStart)
    if (bigQuadrant === quadIdx) {
      // ATEM-Slot fuer dieses Quad = spec.big[i].window (typischerweise 0 oder 1)
      return big.window
    }
  }
  return -1
}

/** Kleine Zelle (Quadrant + Cell 0/1/2/3) → ATEM-Window-Index. */
const mapSmallCellToAtem = (
  quadIdx: 0 | 1 | 2 | 3,
  cellIdx: 0 | 1 | 2 | 3,
  layout: number,
): number => {
  if (layout === MV_LAYOUT.Grid16Small) {
    // 4×4-Grid, row-major über alle 16 Zellen.
    // Quadrant 0 (TL) cells 0,1,2,3 → ATEM-windows 0,1,4,5
    // Quadrant 1 (TR) cells 0,1,2,3 → ATEM-windows 2,3,6,7
    // Quadrant 2 (BL) cells 0,1,2,3 → ATEM-windows 8,9,12,13
    // Quadrant 3 (BR) cells 0,1,2,3 → ATEM-windows 10,11,14,15
    const qRow = Math.floor(quadIdx / 2)
    const qCol = quadIdx % 2
    const cRow = Math.floor(cellIdx / 2)
    const cCol = cellIdx % 2
    return qRow * 8 + cRow * 4 + qCol * 2 + cCol
  }
  if (layout === MV_LAYOUT.Quad4Big) {
    // Keine kleinen Zellen in diesem Layout — User wechselte vom Big-
    // zum Small-Modus, der Window-Set wird vom Caller geskipt.
    return -1
  }
  // Standard-10-Tile-Layout: Kleine Tiles sind 2..9, in MV_GRID_4X4[
  // layout].small[] in row-major-Reihenfolge gelistet. Wir suchen die
  // Position dieser Quadrant-Cell in spec.small[] und mappen auf
  // (smallWindowOffset ?? 2) + index.
  const spec = MV_GRID_4X4[layout]
  if (!spec) return -1
  // Position der Cell in CP-Koordinaten:
  //   col innerhalb des Quadranten = cellIdx % 2
  //   row innerhalb des Quadranten = Math.floor(cellIdx / 2)
  // Plus Quadrant-Offset:
  const qCol = quadIdx % 2  // 0 oder 1 → linke oder rechte Quadrant-Spalte
  const qRow = Math.floor(quadIdx / 2)  // 0 oder 1
  const targetCol = qCol * 2 + (cellIdx % 2) + 1  // 1..4
  const targetRow = qRow * 2 + Math.floor(cellIdx / 2) + 1  // 1..4
  const offset = spec.smallWindowOffset ?? 2
  for (let i = 0; i < spec.small.length; i++) {
    if (spec.small[i].colStart === targetCol && spec.small[i].rowStart === targetRow) {
      return offset + i
    }
  }
  return -1
}

/** Helper: welche Quadrant-ID (0/1/2/3) entspricht einer (col,row)-Position
 *  im 4×4-Grid? col/row sind 1-basiert. */
const quadrantOfCell = (col: number, row: number): 0 | 1 | 2 | 3 => {
  const qCol = col <= 2 ? 0 : 1
  const qRow = row <= 2 ? 0 : 1
  return (qRow * 2 + qCol) as 0 | 1 | 2 | 3
}

/** Findet das nächstgelegene unterstützte ATEM-Layout für eine
 *  Quadranten-Konfiguration. Wird beim Senden an die ATEM benutzt
 *  damit das Modell den Befehl überhaupt versteht. */
export const closestAtemLayout = (
  quadrants: AtemMvQuadrants,
  caps: AtemMvCapabilities,
): number => {
  let best = caps.supportedLayouts[0] ?? 0
  let bestScore = -1
  for (const l of caps.supportedLayouts) {
    const q = LAYOUT_TO_QUADRANTS[l]
    if (!q) continue
    let score = 0
    for (let i = 0; i < 4; i++) {
      if (q[i] === quadrants[i]) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = l
    }
  }
  return best
}

/** Migriert eine Legacy-MvDefinition (alte windowIndex-Slots 0..9
 *  in ATEM-Standard-Reihenfolge) auf das neue Quadranten-Schema.
 *  Idempotent: wenn `quadrants` schon gesetzt ist, bleibt alles wie es ist. */
export const migrateMvToQuadrants = (mv: AtemMvDefinition): AtemMvDefinition => {
  if (mv.quadrants) return mv
  const quadrants = LAYOUT_TO_QUADRANTS[mv.layout] ?? LAYOUT_TO_QUADRANTS[0]
  const spec = MV_GRID_4X4[mv.layout] ?? MV_GRID_4X4[0]
  // Map legacy windowIndex → new windowIndex via the grid spec's positions.
  const quadrantOf = (col: number, row: number): 0 | 1 | 2 | 3 => {
    const qCol = col <= 2 ? 0 : 1
    const qRow = row <= 2 ? 0 : 1
    return (qRow * 2 + qCol) as 0 | 1 | 2 | 3
  }
  const newWindows: { windowIndex: number; sourceId: number }[] = []
  for (const big of spec.big) {
    const quadIdx = quadrantOf(big.colStart, big.rowStart)
    const legacy = mv.windows.find((w) => w.windowIndex === big.window)
    if (legacy) {
      newWindows.push({ windowIndex: mvWindowIndex(quadIdx), sourceId: legacy.sourceId })
    }
  }
  for (let smallIdx = 0; smallIdx < spec.small.length; smallIdx++) {
    const cell = spec.small[smallIdx]
    const quadIdx = quadrantOf(cell.colStart, cell.rowStart)
    const subCol = ((cell.colStart - 1) % 2) as 0 | 1
    const subRow = ((cell.rowStart - 1) % 2) as 0 | 1
    const cellIdx = (subRow * 2 + subCol) as 0 | 1 | 2 | 3
    const legacyWi = (spec.smallWindowOffset ?? 2) + smallIdx
    const legacy = mv.windows.find((w) => w.windowIndex === legacyWi)
    if (legacy) {
      newWindows.push({
        windowIndex: mvWindowIndex(quadIdx, cellIdx),
        sourceId: legacy.sourceId,
      })
    }
  }
  return { ...mv, quadrants, windows: newWindows }
}

/** Helper für Highlight im Picker: PGM (10011) bzw. PVW (10010) bekommen
 *  rote/grüne Border — die User-Anweisung "PGM/PVW sind nur Sources" ist
 *  korrekt, aber sie als spezielle Sources visuell hervorzuheben hilft
 *  trotzdem dem Operator. */
export const roleForSource = (sourceId: number): 'pgm' | 'pvw' | 'other' => {
  if (sourceId === 10011) return 'pgm'
  if (sourceId === 10010) return 'pvw'
  return 'other'
}

export type { AtemMvQuadrants, AtemMvQuadrantState }
