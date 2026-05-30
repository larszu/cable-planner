/**
 * Standard cable-length color coding.
 * The lengths and colors follow German broadcast convention:
 * 1m=red, 2m=yellow, 3m=green, 5m=white, 10m=red, 20m=yellow,
 * 25m=yellow/white dashed, 50m=white, 100m=red
 */

export interface LengthColorRule {
  length: number
  /** CSS stroke color. */
  color: string
  /** Optional dasharray for the stroke (e.g. "10 6"). */
  dashArray?: string
  /** Human-readable description shown in the legend. */
  label: string
}

export const LENGTH_COLOR_RULES: LengthColorRule[] = [
  { length: 1, color: '#ef4444', label: '1 m – rot' },
  { length: 2, color: '#eab308', label: '2 m – gelb' },
  { length: 3, color: '#22c55e', label: '3 m – grün' },
  { length: 5, color: '#f8fafc', label: '5 m – weiß' },
  { length: 10, color: '#ef4444', label: '10 m – rot' },
  { length: 20, color: '#eab308', label: '20 m – gelb' },
  { length: 25, color: '#eab308', dashArray: '12 8', label: '25 m – gelb/weiß gestrichelt' },
  { length: 50, color: '#f8fafc', label: '50 m – weiß' },
  { length: 100, color: '#ef4444', label: '100 m – rot' },
]

/**
 * Return the stroke color and optional dashArray for a cable based on its length.
 * Returns `null` when no rule matches the length.
 */
export const colorByLength = (
  length: number,
): { color: string; dashArray?: string } | null => {
  const rule = LENGTH_COLOR_RULES.find((r) => r.length === length)
  if (!rule) return null
  return { color: rule.color, dashArray: rule.dashArray }
}

import type { ConnectorType } from '../types/equipment'

/**
 * Visual color associated with each connector type. Used by the optional
 * "Ports nach Typ einfärben" toggle so users can spot SDI/HDMI/Ethernet
 * ports at a glance on equipment nodes. Values match the cable catalog
 * defaults where possible (e.g. SDI = amber, HDMI = purple).
 */
export const DEFAULT_CONNECTOR_TYPE_COLORS: Record<ConnectorType, string> = {
  XLR: '#38bdf8',
  BNC: '#f59e0b',
  HDMI: '#a855f7',
  'Ethernet/RJ45': '#22c55e',
  Fiber: '#eab308',
  SFP: '#facc15',
  'SFP+': '#ca8a04',
  DIN: '#94a3b8',
  DisplayPort: '#8b5cf6',
  USB: '#64748b',
  'USB-C': '#7c3aed',
  Triax: '#d97706',
  'Wireless/RF': '#ec4899',
  'IEC 230V': '#475569',
  PowerCON: '#0ea5e9',
  'Schuko 230V': '#334155',
  'C7 Eurostecker': '#64748b',
  // #371 — D-Sub / DVI / VGA
  'VGA (DE-15)': '#6366f1',
  DVI: '#818cf8',
  'D-Sub DB9': '#fbbf24',
  'D-Sub DB25': '#fb7185',
  // #361 — DMX
  'DMX 5-pol (XLR)': '#fb923c',
  'DMX 3-pol (XLR)': '#fdba74',
  // #369 — analoge / Consumer-Video-Stecker
  'Cinch/RCA': '#eab308',
  SCART: '#a16207',
  'S-Video': '#ca8a04',
  // #384 — Steckverbinder Runde 2
  'Klinke 6.3mm': '#0ea5e9',
  'Klinke 3.5mm': '#38bdf8',
  'TT/Bantam': '#0891b2',
  'Mini-XLR': '#22d3ee',
  'Mini-BNC': '#f97316',
  'Micro-BNC': '#ea580c',
  'HD-BNC': '#c2410c',
  'F-Stecker': '#b45309',
  GG45: '#16a34a',
  'Mini-HDMI': '#c084fc',
  'Kleeblatt C5': '#475569',
  // #364 — Strom-Steckverbinder Event/Touring
  CEE16: '#2563eb',
  CEE32: '#1d4ed8',
  CEE63: '#dc2626',
  Powerlock: '#991b1b',
  Socapex: '#7c2d12',
  Harting: '#52525b',
  Custom: '#94a3b8',
}

/** Backwards-compat alias for older imports. Prefer
 *  `useUiStore.getState().connectorTypeColors` or the colorForConnector
 *  helper below — both honour user overrides made in Settings. */
export const CONNECTOR_TYPE_COLORS = DEFAULT_CONNECTOR_TYPE_COLORS

/** Resolve a colour for a connector type, preferring user overrides if a
 *  map is provided (read from the UI store). Falls back to the built-in
 *  default palette, then to the Custom colour. */
export const colorForConnector = (
  connectorType: ConnectorType,
  overrides?: Partial<Record<ConnectorType, string>>,
): string =>
  overrides?.[connectorType] ??
  DEFAULT_CONNECTOR_TYPE_COLORS[connectorType] ??
  DEFAULT_CONNECTOR_TYPE_COLORS.Custom
