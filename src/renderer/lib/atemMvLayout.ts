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
