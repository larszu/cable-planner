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
export const CONNECTOR_TYPE_COLORS: Record<ConnectorType, string> = {
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
  Custom: '#94a3b8',
}

export const colorForConnector = (connectorType: ConnectorType): string =>
  CONNECTOR_TYPE_COLORS[connectorType] ?? CONNECTOR_TYPE_COLORS.Custom
