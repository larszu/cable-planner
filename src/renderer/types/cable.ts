import type { ConnectorType } from './equipment'
import type { SignalStandard } from './cableSpec'

export type CableType = Exclude<ConnectorType, 'DIN' | 'DisplayPort' | 'USB'> | 'Custom'

export type CableRouting = 'orthogonal' | 'straight' | 'curved'

export interface CableWaypoint {
  x: number
  y: number
}

export interface Cable {
  id: string
  name: string
  type: CableType
  length: number
  color: string
  fromEquipmentId: string
  fromPortId: string
  toEquipmentId: string
  toPortId: string
  notes: string
  /** Reference to a CableSpec from the catalog (or custom id). */
  cableSpecId?: string
  /** Chosen signal standard if applicable (e.g. SDI-12G). */
  standard?: SignalStandard
  /** true if the planner flagged this connection as incompatible/needing a converter. */
  needsConverter?: boolean
  /** Line routing style. Defaults to orthogonal. */
  routing?: CableRouting
  /** Stroke width in pixels. */
  strokeWidth?: number
  /** Draw dashed line. */
  dashed?: boolean
  /** Draw arrow marker at start. */
  arrowStart?: boolean
  /** Draw arrow marker at end (default true). */
  arrowEnd?: boolean
  /** Marks the cable as carrying signal in both directions (USB, Ethernet,
   *  Fibre, …). When true the CableEdge renders arrow markers on BOTH
   *  ends regardless of arrowStart/arrowEnd. Auto-enabled for inherently
   *  bidirectional cable types (issue #67). */
  bidirectional?: boolean
  /** Optional user-placed bend points (flow coordinates). */
  waypoints?: CableWaypoint[]
  /** Where to show the cable label. Defaults to 'center'. */
  labelPosition?: 'center' | 'source' | 'target'
  /** When true, this is a wireless link (no physical cable). */
  wireless?: boolean
  /** RF/WiFi frequency string for wireless links, e.g. "5.8 GHz", "600 MHz". */
  frequency?: string
  /** WiFi/wireless channel, e.g. "6", "36", "149", "100-140 DFS". */
  wifiChannel?: string
  /** v7.9.68 / #182 — Maximale Reichweite des Wireless-Links in Metern.
   *  Ersetzt für wireless-Kabel das `length`-Feld in der UI (Länge ergibt
   *  bei Funk keinen Sinn — Reichweite schon). Optional, weil viele
   *  Bestands-Kabel das nicht gesetzt haben. */
  maxRange?: number
  /** Stable origin id from an imported yEd / GraphML edge. Lets a
   *  re-import correlate the same cable across runs. Set by the GraphML
   *  import flow only. */
  graphmlEdgeId?: string
  /** v7.8.7 — per-cable override for the global cable-bumps setting.
   *  v7.9.5: 'auto' wurde entfernt — undefined bedeutet jetzt
   *  "Global folgen", 'on' / 'off' überschreibt explizit für DIESES
   *  Kabel. Legacy-Daten mit bumpStyle: 'auto' werden wie undefined
   *  behandelt. Set via the right-click context menu on the cable. */
  bumpStyle?: 'on' | 'off'
  /** v7.9.54 — Marker für Kabel, die NICHT vom Planer am Desktop, sondern
   *  spontan vor Ort über die Mobile-Viewer-App hinzugefügt wurden (z.B.
   *  weil der Techniker am Gerät steht und merkt dass ein Patch fehlt).
   *  Canvas rendert dafür ein "📱"-Badge, damit der Planer sieht welche
   *  Verbindungen aus dem Feld nachgepflegt wurden. */
  addedFromMobile?: boolean
}
