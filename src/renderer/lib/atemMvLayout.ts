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
]

export interface MvGridSpec {
  big: { window: number; colStart: number; rowStart: number; colSpan: number; rowSpan: number }[]
  small: { colStart: number; rowStart: number }[]
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
