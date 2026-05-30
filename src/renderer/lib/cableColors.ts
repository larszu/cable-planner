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
  // #376 — Triax (analog) und SMPTE 304M (Hybrid-Fiber) sind getrennte
  // Familien. Triax-Subtypes in warmen Brauntoenen, SMPTE 304M in
  // Burnt-Orange/Amber damit sie in der Legende klar unterscheidbar sind.
  Triax: '#d97706',
  'Triax (Damar & Hagen)': '#a16207',
  'Triax (Fischer)': '#854d0e',
  'LEMO 3K.93C (SMPTE 304M)': '#ea580c',
  'Neutrik Dragonfly (SMPTE 304M)': '#b45309',
  'Wireless/RF': '#ec4899',
  'IEC 230V': '#475569',
  PowerCON: '#0ea5e9',
  'Schuko 230V': '#334155',
  'C7 Eurostecker': '#64748b',
  CEE16: '#2563eb',
  CEE32: '#dc2626',
  CEE63: '#b91c1c',
  Powerlock: '#1e293b',
  Socapex: '#475569',
  Harting: '#334155',
  VGA: '#3b82f6',
  DVI: '#6366f1',
  DB9: '#10b981',
  DB25: '#14b8a6',
  Klinke: '#22d3ee',
  'Mini-XLR': '#0ea5e9',
  'HD-BNC': '#fb923c',
  'Mini-HDMI': '#c084fc',
  'F-Connector': '#a16207',
  GG45: '#15803d',
  Kleeblatt: '#1e293b',
  // Licht/DMX in Orange, Legacy-Analog-Video in warmen Gelb-/Brauntoenen,
  // Patchbay-Audio (TT/Bantam) in Cyan, kompakte BNC-Varianten in Amber.
  'DMX 5-pol (XLR)': '#fb923c',
  'DMX 3-pol (XLR)': '#f97316',
  'Cinch/RCA': '#eab308',
  SCART: '#ca8a04',
  'S-Video': '#a16207',
  'TT/Bantam': '#06b6d4',
  'Mini-BNC': '#fbbf24',
  'Micro-BNC': '#fcd34d',
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
