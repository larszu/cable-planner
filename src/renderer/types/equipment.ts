export type ConnectorType =
  | 'XLR'
  | 'BNC'
  | 'HDMI'
  | 'Ethernet/RJ45'
  | 'Fiber'
  | 'SFP'
  | 'SFP+'
  | 'DIN'
  | 'DisplayPort'
  | 'USB'
  | 'IEC 230V'
  | 'PowerCON'
  | 'Schuko 230V'
  | 'C7 Eurostecker'
  | 'Custom'

/** All valid connector type values in display order. */
export const ALL_CONNECTOR_TYPES: ConnectorType[] = [
  'XLR', 'BNC', 'HDMI', 'Ethernet/RJ45', 'Fiber', 'SFP', 'SFP+', 'DIN',
  'DisplayPort', 'USB', 'IEC 230V', 'PowerCON', 'Schuko 230V', 'C7 Eurostecker', 'Custom',
]

import type { SignalStandard } from './cableSpec'
import type { SdiCapabilities } from './videoFormat'

export interface Port {
  id: string
  name: string
  type: string
  connectorType: ConnectorType
  /** Optional signal standard declared for this port (e.g. SDI-12G on a camera out). */
  standard?: SignalStandard
  /**
   * Direction of the port. Defaults to the array it lives in (`inputs` → 'in',
   * `outputs` → 'out'). A port marked `bidirectional` (e.g. an RJ45 network
   * port) can be used as both source and target for cables.
   */
  direction?: 'in' | 'out' | 'bidirectional'
  /**
   * For Fiber ports: SFP module form-factor (e.g. "SFP", "SFP+", "QSFP+", "SFP28").
   * Only shown in the UI when connectorType === 'Fiber'.
   */
  sfpType?: string
  /**
   * For Fiber ports: transceiver standard / reach designation
   * (e.g. "1G-LX", "10G-SR", "10G-LR", "25G-SR").
   */
  sfpStandard?: string
  /**
   * For Fiber ports: wavelength in nm as a string (e.g. "850", "1310", "1550").
   */
  sfpWavelength?: string
  /**
   * For Fiber ports: module vendor (e.g. "Cisco", "Aruba", "Ubiquiti", "FS.com").
   */
  sfpVendor?: string
}

export interface EquipmentItem {
  id: string
  name: string
  category: string
  inputs: Port[]
  outputs: Port[]
  /** Optional rack height in HE/U for future 2D rack layouts. */
  rackUnits?: number
  /** Optional source path from NetBox device-type-library. */
  netboxPath?: string
  /** Optional raw image URL for the front panel asset. */
  frontPanelImageUrl?: string
  /** Optional raw image URL for the rear panel asset. */
  rearPanelImageUrl?: string
  rentmanId?: string
  /** Set to true when a Rentman re-fetch no longer finds this item in the project. */
  rentmanRemoved?: boolean
  x: number
  y: number
  width: number
  height: number
  /** Optional network/access info for devices that have it (cameras, switches, servers). */
  ipAddress?: string
  subnetMask?: string
  macAddress?: string
  username?: string
  password?: string
  notes?: string
  /** Optional network-device config (switches, routers). */
  vlans?: VlanDef[]
  managementVlanId?: number
  gateway?: string
  dnsServers?: string
  mgmtUrl?: string
  firmware?: string
  /** Per-port VLAN assignments, keyed by port id. */
  portVlans?: Record<string, PortVlanAssignment>
  /** SDI capabilities (Level A/B, Quad Link 3G, single-link max). */
  sdiCaps?: SdiCapabilities
  /**
   * Stored ATEM Multiviewer configuration. Only meaningful for ATEM devices.
   * Lets the user design MV window assignments offline; the same structure is
   * pushed to a live ATEM when connected. Shape mirrors the fields we get back
   * in the live state (see `AtemMvConfig`).
   */
  atemMvConfig?: AtemMvConfig
  /** Mark equipment as favorite in the library (sorted to the top). */
  favorite?: boolean
  /** Hide from the library unless "Ausgeblendete zeigen" is active. */
  hidden?: boolean
  /**
   * Native display resolution (for monitors, multiviewers, displays).
   * Format example: "1920x1080", "3840x2160".
   */
  resolution?: string
  /** Display diagonal size in inches (monitors / displays). */
  displaySizeInch?: number
}

/**
 * Offline-editable ATEM Multiviewer configuration. The `layout` value maps to
 * the `MultiViewerLayout` enum documented in the ATEM protocol XML (from the
 * peschuster/LibAtem project and mirrored by `atem-connection`). `windows`
 * holds, per multiviewer, the ATEM input id that should be shown in each
 * window slot (0-based window index).
 */
export interface AtemMvConfig {
  multiViewers: AtemMvDefinition[]
}

export interface AtemMvDefinition {
  /** 0-based multiviewer index on the switcher. */
  index: number
  /** MultiViewerLayout enum value (0 = Default). */
  layout: number
  programPreviewSwapped?: boolean
  /** window index → ATEM input id. Non-listed windows are left unchanged. */
  windows: { windowIndex: number; sourceId: number }[]
}

export interface VlanDef {
  id: number
  name: string
  notes?: string
}

export interface PortVlanAssignment {
  /** Untagged / access / native VLAN id. */
  untagged?: number
  /** Comma-separated tagged VLAN ids, kept as string for easier UI editing. */
  tagged?: string
}

export type EquipmentTemplate = Omit<EquipmentItem, 'id' | 'x' | 'y'> & {
  /**
   * Set to the Rentman project-ID string when this template was imported from
   * Rentman. Used to filter the library to "Rentman" items only.
   */
  rentmanSource?: string
  /**
   * Human-readable name of the Rentman project this template was imported
   * from. Used by the library UI to group templates by project even when
   * multiple Rentman projects have been imported.
   */
  rentmanProjectName?: string
}

/**
 * A named set of pre-wired equipment items that can be placed as a unit.
 * Positions are stored as offsets from the bounding-box top-left corner.
 * Cables are recorded by item-index + port-name so they can be recreated with
 * new IDs when the group is instantiated.
 */
export interface GroupPreset {
  id: string
  name: string
  /** Optional rack metadata when this group was authored in the 2D rack builder. */
  rack?: {
    totalUnits: number
    placements: Array<{
      itemIndex: number
      startUnit: number
      heightUnits: number
    }>
  }
  items: Array<
    EquipmentTemplate & {
      offsetX: number
      offsetY: number
    }
  >
  cables: Array<{
    fromItemIndex: number
    fromPortName: string
    toItemIndex: number
    toPortName: string
    name: string
    type: string
    length: number
    color?: string
    standard?: string
  }>
}

