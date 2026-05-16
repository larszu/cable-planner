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
  /** Stable origin id from an imported yEd / GraphML edge. Lets a
   *  re-import correlate the same cable across runs. Set by the GraphML
   *  import flow only. */
  graphmlEdgeId?: string
  /** v7.8.7 — per-cable override for the global cable-bumps (#65 / #106)
   *  setting. 'auto' (default) follows uiStore.cableBumps; 'on' always
   *  draws bumps where this cable crosses another orthogonal segment;
   *  'off' suppresses bumps for this cable specifically. Set via the
   *  right-click context menu on the cable. */
  bumpStyle?: 'auto' | 'on' | 'off'
}
