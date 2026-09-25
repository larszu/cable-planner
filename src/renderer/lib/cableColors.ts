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
  // #885 — die Breakout-Buchsen bleiben in der Fiber-Familie (gelb) und
  // nicht bei SMPTE 304M: durch sie geht Glas und kein Hybrid-Kamerakabel.
  // Zwei Abstufungen, damit DUO und QUAD in der Legende auseinandergehen.
  'Neutrik opticalCON DUO': '#fbbf24',
  'Neutrik opticalCON QUAD': '#d97706',
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
  // #832 — Die Klinken-Familie teilt EINE Farbe. Sie steht fuer „hier laeuft
  // ein Klinken-Kabel", und das ist beim Blick auf den Plan die Frage; welche
  // Groesse es ist, liest man am Port. Sechs Blautoene nebeneinander waeren
  // sechs Farben, die niemand auseinanderhaelt, und die Farbe verlore genau
  // die Aufgabe, die sie hat.
  Klinke: '#22d3ee',
  'Jack 6.35 mm TS': '#22d3ee',
  'Jack 6.35 mm TRS': '#22d3ee',
  'Jack 3.5 mm TS': '#22d3ee',
  'Jack 3.5 mm TRS': '#22d3ee',
  'Jack 3.5 mm TRRS': '#22d3ee',
  'Jack 2.5 mm TRS': '#22d3ee',
  'Jack 6.35 mm': '#22d3ee',
  'Jack 3.5 mm': '#22d3ee',
  'Mini-XLR': '#0ea5e9',
  'HD-BNC': '#fb923c',
  'Mini-HDMI': '#c084fc',
  'Micro-HDMI': '#c084fc',
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
  // ─── DIE 69 STECKER, DIE AM 2026-09-24 DAZUKAMEN ────────────────────────
  //
  // 36 davon standen schon im Auswahldialog (`connectorCatalog.ts`) und nur
  // nicht im Typ; 33 sind Vokabel-Luecken aus der Installations-AV. Siehe den
  // Kopf der Union in `types/equipment.ts`.
  //
  // FARBE NACH FAMILIE, nicht nach Laune — dieselbe Ordnung, nach der die
  // Werte darueber schon vergeben waren: Audio blau, MIDI/DIN magenta, Video
  // bernstein, HDMI/DP violett, Netz gruen, Glas gelb, Strom rot bis dunkel,
  // Daten grau, Funk pink.
  //
  // Die Schraubklemmen bekommen ein DUNKLERES Blau als die XLR: sie fuehren
  // dasselbe Signal, sind aber kein Steckverbinder. Wer die Patchliste
  // ausdruckt, soll das am Farbton sehen und nicht zum falschen Kabel greifen.
  'XLR 3 Male': '#38bdf8',
  'XLR 3 Female': '#38bdf8',
  'XLR 4 Male': '#38bdf8',
  'XLR 4 Female': '#38bdf8',
  'XLR 5 Male': '#38bdf8',
  'XLR 5 Female': '#38bdf8',
  'XLR 6 Male': '#38bdf8',
  'XLR 6 Female': '#38bdf8',
  'XLR 7 Male': '#38bdf8',
  'XLR 7 Female': '#38bdf8',
  'Combo XLR/Jack': '#38bdf8',
  'speakON 2 Pole': '#0ea5e9',
  'speakON 4 Pole': '#0ea5e9',
  'Binding Post': '#0ea5e9',
  'Phoenix/Euroblock': '#0284c7',
  'Terminal Block': '#0284c7',
  'Bare Wire': '#0369a1',
  Toslink: '#67e8f9',
  MIDI: '#e879f9',
  'DIN 5-pol': '#e879f9',
  'S-VHS': '#f59e0b',
  'Mini-DisplayPort': '#8b5cf6',
  'USB Type A': '#64748b',
  'USB Type B': '#64748b',
  'USB 3 Type A': '#475569',
  'USB 3 Type B': '#475569',
  'USB Mini-B': '#94a3b8',
  'USB Micro-B': '#94a3b8',
  'FireWire 400': '#a1a1aa',
  'FireWire 800': '#a1a1aa',
  'PS/2': '#a1a1aa',
  DB15: '#a1a1aa',
  DB37: '#a1a1aa',
  Multipin: '#a1a1aa',
  'Mini-DIN 4': '#94a3b8',
  'Mini-DIN 7': '#94a3b8',
  'Mini-DIN 8': '#94a3b8',
  'Tourine 25': '#a1a1aa',
  'Tourine 37': '#a1a1aa',
  etherCON: '#16a34a',
  RJ11: '#4ade80',
  QSFP: '#ca8a04',
  QSFP28: '#a16207',
  'Fiber Optic LC': '#eab308',
  'Fiber Optic SC': '#eab308',
  'Fiber Optic ST': '#eab308',
  'opticalCON DUO': '#fde047',
  'opticalCON QUAD': '#fde047',
  MPO: '#facc15',
  'powerCON Input': '#ea580c',
  'powerCON Output': '#f97316',
  'powerCON TRUE1': '#c2410c',
  'NEMA 5-15 (Edison)': '#dc2626',
  'NEMA L5-20': '#b91c1c',
  'NEMA L6-20': '#b91c1c',
  'NEMA L6-30': '#991b1b',
  'NEMA L21-30': '#7f1d1d',
  'Cam-Lok': '#7f1d1d',
  'IEC C15': '#ef4444',
  'IEC C20': '#ef4444',
  'DC Barrel': '#fb923c',
  'PCIe 6-pin': '#fdba74',
  'V-Mount': '#fdba74',
  'D-Tap': '#fdba74',
  SMA: '#f472b6',
  'RP-TNC': '#f472b6',
  Lemo: '#c084fc',
  Generic: '#94a3b8',
  'Blanking Panel': '#475569',
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
