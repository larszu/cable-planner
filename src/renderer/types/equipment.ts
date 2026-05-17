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
  | 'USB-C'
  | 'Triax'
  | 'Wireless/RF'
  | 'IEC 230V'
  | 'PowerCON'
  | 'Schuko 230V'
  | 'C7 Eurostecker'
  | 'Custom'

/** All valid connector type values in display order. */
export const ALL_CONNECTOR_TYPES: ConnectorType[] = [
  'XLR', 'BNC', 'HDMI', 'Ethernet/RJ45', 'Fiber', 'SFP', 'SFP+', 'DIN',
  'DisplayPort', 'USB', 'USB-C', 'Triax', 'Wireless/RF',
  'IEC 230V', 'PowerCON', 'Schuko 230V', 'C7 Eurostecker', 'Custom',
]

import type { SignalStandard } from './cableSpec'
import type { SdiCapabilities } from './videoFormat'

export interface Port {
  id: string
  name: string
  type: string
  connectorType: ConnectorType
  /** Optional side override on the node (default comes from input/output + mirror). */
  side?: 'left' | 'right'
  /** Optional signal standard declared for this port (e.g. SDI-12G on a camera out). */
  standard?: SignalStandard
  /** v7.5.0 — per-port SDI capabilities. A device with a mixed SDI port
   *  layout (e.g. some BNC are 12G level A, others 6G only, others
   *  HD-SDI) can declare each port's spec individually here. The
   *  device-level `equipment.sdiCaps` stays as a fallback default
   *  when the port doesn't override it. */
  sdiCaps?: import('./videoFormat').SdiCapabilities
  /** v7.9.7 — Quad-Link Set: vier BNC-Ports mit gleichem
   *  `quadLinkGroup`-String bilden zusammen ein 4K-Quad-Link-Bündel.
   *  Free text ID (z.B. 'QL-1', 'QL-2'); pro Gerät beliebig viele
   *  Sets möglich. UI warnt wenn eine Gruppe nicht 4 Ports hat. */
  quadLinkGroup?: string
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

/** v7.5.0 — a named operating mode for a device whose port layout
 *  changes depending on configuration (e.g. media-server boards,
 *  modular processors). Each mode owns its own ports; switching the
 *  active mode on an EquipmentItem rewrites its `inputs`/`outputs`
 *  to the mode's snapshot. */
export interface DeviceMode {
  id: string
  name: string
  /** Optional description that surfaces in the mode picker, e.g.
   *  "12G IN / 4× HDMI OUT" or "Standalone (1× SDI passthrough)". */
  description?: string
  inputs: Port[]
  outputs: Port[]
}

export interface EquipmentItem {
  id: string
  name: string
  /** Optional subtitle shown below the device name (e.g. "PGM Monitor", "Cam 1"). */
  subtitle?: string
  /** Optional background/accent color for the node header (CSS hex, e.g. "#0f4c81"). */
  nodeColor?: string
  /** When true, inputs appear on the right side and outputs on the left side. */
  portsFlipped?: boolean
  category: string
  inputs: Port[]
  outputs: Port[]
  /** v7.5.0 — operating-mode-dependent port layouts (media servers,
   *  modular processors like Pixelhue P20 / Parco S3 / Brompton Tessera).
   *  Each mode carries its own `inputs` + `outputs`. When `activeModeId`
   *  is set to a mode's id, the equipment's live `inputs`/`outputs`
   *  arrays are replaced with that mode's port set — switching mode in
   *  the UI swaps the visible ports on the canvas. Cables that no
   *  longer find their port id are left orphaned (the user can
   *  re-route them). */
  modes?: DeviceMode[]
  activeModeId?: string
  /** Explicit flag: true when this is a 19" rack device. */
  isRackDevice?: boolean
  /** Optional rack height in HE/U for future 2D rack layouts. */
  rackUnits?: number
  /** v7.9.9 — Snapshot der internen Rack-Verkabelung wenn das Item
   *  durch "Black-Box-Einfügen" auf das Canvas gelegt wurde. Wird vom
   *  EquipmentNode genutzt um die internen Verbindungen als Overlay
   *  im Karten-Body zu zeichnen, damit der User auf einen Blick sieht
   *  was im Rack passiert ohne die GroupPreset zu öffnen.
   *
   *  Items + Cables-Format ist eine vereinfachte Version der
   *  GroupPreset-Strukturen. Read-only — die echte Quelle ist nach wie
   *  vor der GroupPreset im projectStore. */
  rackInternalSnapshot?: {
    items: Array<{ name: string; startUnit: number; rackUnits: number }>
    cables: Array<{
      fromItemIndex: number
      fromPortName: string
      toItemIndex: number
      toPortName: string
      color?: string
    }>
    totalUnits: number
  }
  /** Issue #61: Sub-canvas-per-rack. When a GroupPreset with `rack`
   *  metadata is placed via `placeGroupPreset`, every equipment item
   *  spawned by that placement is tagged with the same fresh
   *  `rackInstanceId`. The sub-canvas Rack-Editor uses this tag to
   *  filter the main project down to a single rack's contents while
   *  the underlying data lives in the same project store (so undo/
   *  redo and autosave keep working). `rackInstanceLabel` is set on
   *  every member so the editor can show a human title without
   *  consulting the originating preset (which may have been deleted). */
  rackInstanceId?: string
  rackInstanceLabel?: string
  /** Position inside a rack instance — measured in rack-units from the
   *  rack's top rail. Used by the Rack-Editor to render the 19" guide
   *  rails and snap devices to whole-HU rows. Only meaningful when
   *  `rackInstanceId` is set. */
  rackInstanceStartUnit?: number
  /** Optional source path from NetBox device-type-library. */
  netboxPath?: string
  /** Optional raw image URL for the front panel asset. */
  frontPanelImageUrl?: string
  /** Optional raw image URL for the rear panel asset. */
  rearPanelImageUrl?: string
  /** Optional crop meta for front panel images (normalized 0..1 values). */
  frontPanelCrop?: { x: number; y: number; width: number; height: number }
  /** Optional crop meta for rear panel images (normalized 0..1 values). */
  rearPanelCrop?: { x: number; y: number; width: number; height: number }
  rentmanId?: string
  /** Set to true when a Rentman re-fetch no longer finds this item in the project. */
  rentmanRemoved?: boolean
  /** Stable origin id from an imported yEd / GraphML node. Lets a
   *  re-import correlate the same device across runs even when names or
   *  positions change. Set by the GraphML import flow only. */
  graphmlId?: string
  /** Tracks how the device entered the project — used by the import
   *  dialog's diff view and by Rentman / GraphML re-imports so we know
   *  which subset of devices is replaceable. */
  importSource?: 'graphml' | 'rentman' | 'netbox' | 'manual'
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
  /** v7.9.4 — User-Override für die Modell-Heuristik bzgl.
   *  Multiviewer-Capabilities. Wenn gesetzt, überschreibt es die
   *  Auto-Erkennung in getMvCapabilities(name). Use Case: User hat
   *  ein Modell wo unsere Regex nicht greift oder ATEM-Firmware-Update
   *  hat neue Layouts hinzugefügt. UI in EquipmentProperties. */
  atemMvCapabilitiesOverride?: {
    mvCount: number
    supportedLayouts: number[]
    maxWindowsPerMv: number
  }
  /**
   * Issue #45: offline-editable audio router matrix for ATEM Fairlight.
   * `sources[].mainGain` = master fader contribution in dB (-INF..+6),
   * `sources[].balance` = -100..+100, `sources[].onAir` = whether the source
   * routes to the main bus. Future work pushes this to a live ATEM via the
   * same bridge as atemMvConfig. Stored even when no ATEM is connected so
   * the user can plan audio routing offline (Fairlight-style).
   */
  atemAudioConfig?: AtemAudioConfig
  /** Mark equipment as favorite in the library (sorted to the top). */
  favorite?: boolean
  /** Hide from the library unless "Ausgeblendete zeigen" is active. */
  hidden?: boolean
  /** Pack-status checkbox used during build-up / pack-down. When true,
   *  the device is considered physically packed and ready to ship.
   *  Visualised on the canvas with a small ✓ marker on the header and
   *  surfaced as a column in the equipment BOM. (H2R parity.) */
  packed?: boolean
  /** Roadmap #76 follow-up: rated power consumption in watts (continuous).
   *  Fed into the Power-Consumption calculator and the equipment BOM
   *  totals row. Optional — only the user/data-sheet fills this in.
   *  The Properties panel can auto-derive this from `voltage` × `currentAmps`
   *  when both are supplied — but the user can also enter W directly. */
  powerConsumptionWatts?: number
  /** Nominal supply voltage in volts. Optional. When both this and
   *  `currentAmps` are present, `powerConsumptionWatts` is auto-
   *  computed (V × A) so the BOM stays accurate without manual maths. */
  voltage?: number
  /** Nominal current draw in amperes (continuous, at the rated voltage). */
  currentAmps?: number
  /**
   * Native display resolution (for monitors, multiviewers, displays).
   * Format example: "1920x1080", "3840x2160".
   */
  resolution?: string
  /** Display diagonal size in inches (monitors / displays). */
  displaySizeInch?: number
  /**
   * Optional single emoji or 1-2 character glyph rendered in the top-left
   * corner of the equipment node (issue #46). Lets users tag categories of
   * device at a glance — camera 📷, monitor 🖥, converter ⇄, etc. Empty
   * string suppresses the icon; missing means "auto" (derived from kind).
   */
  icon?: string
  /**
   * Generic reference image for the device — port layout photo, manual
   * snippet, etc. Stored as a data URI so it travels with the project file.
   * Shown as a thumbnail in the properties panel; opens fullscreen on click
   * (issue #38). For 19" rack devices, the front/rearPanelImageUrl above is
   * preferred so the rack builder can render it in-place.
   */
  imageUrl?: string
  /** Optional manufacturer / product page URL (issue #38). */
  manufacturerUrl?: string
  /** Issue #39: physical serial number, surfaces in location/frame BOM exports. */
  serialNumber?: string
  /**
   * When true, render the equipment node as a compact label-only badge
   * (icon + name only, ports as dots on the edges) instead of the full
   * port-list card. Issue #37 — useful for converters and other devices
   * where the port list is just visual noise on the canvas.
   */
  collapsed?: boolean
}

/**
 * Offline-editable ATEM Multiviewer configuration. The `layout` value maps to
 * the `MultiViewerLayout` enum documented in the ATEM protocol XML (from the
 * peschuster/LibAtem project and mirrored by `atem-connection`). `windows`
 * holds, per multiviewer, the ATEM input id that should be shown in each
 * window slot (0-based window index).
 */
/** v7.9.4 — Pro Quadrant: groß oder 4 klein. Unabhängig von ATEM's
 *  festen Patterns, damit der User jeden Quadranten einzeln togglen
 *  kann. Beim Übertragen an die echte ATEM wird das auf den nächst-
 *  besten ATEM-Layout abgebildet. */
export type AtemMvQuadrantState = 'big' | 'small'
export type AtemMvQuadrants = [
  AtemMvQuadrantState, // TL
  AtemMvQuadrantState, // TR
  AtemMvQuadrantState, // BL
  AtemMvQuadrantState, // BR
]

export interface AtemMvConfig {
  multiViewers: AtemMvDefinition[]
}

export interface AtemMvDefinition {
  /** 0-based multiviewer index on the switcher. */
  index: number
  /** MultiViewerLayout enum value (0 = Default). Wird beim Senden an
   *  die ATEM aus `quadrants` abgeleitet wenn dieses gesetzt ist. */
  layout: number
  programPreviewSwapped?: boolean
  /** window index → ATEM input id. Non-listed windows are left unchanged.
   *  v7.9.4 — neues Indexing-Schema mit quadrants-Field:
   *  - 0/1/2/3 = große Fenster für TL/TR/BL/BR
   *  - 10-13/20-23/30-33/40-43 = die 4 kleinen Zellen pro Quadrant
   *  Bei legacy-Daten ohne `quadrants` gilt das alte Schema
   *  (windowIndex 0/1 sind die big-Slots, 2-9 die small cells). */
  windows: { windowIndex: number; sourceId: number }[]
  /** v7.9.4 — Pro-Quadrant-Zustand. Wenn gesetzt ist DAS die Quelle
   *  der Wahrheit für die Darstellung; `layout` wird daraus für die
   *  ATEM-Übertragung abgeleitet. Wenn null/undefined, derives from
   *  `layout` (legacy compat). */
  quadrants?: AtemMvQuadrants
}

/**
 * Issue #45 — ATEM Profile audio configuration.
 *
 * The shape of the audio section in an ATEM Profile XML differs by switcher
 * model. We detect what's present and expose whichever (or both) the user can
 * edit:
 *
 * - `matrix` — the <AudioMapping> section (newer Fairlight-capable models, e.g.
 *   Constellation / 4 M/E). Outputs × Sources crosspoint grid: each output
 *   stores exactly ONE sourceId (0 = "No Audio").
 * - `classicMixer` — the <AudioMixer> section (older Production Studio models,
 *   e.g. ATEM 2 M/E Production Studio 4K). Per-input mixOption (Off/On/AFV)
 *   plus gain (dB) and balance (-100..+100). No routing matrix; every input
 *   bus into the program out, controlled by mixOption.
 * - `inputLabels` — friendly short/long names from <Settings><Inputs>, used
 *   by both UIs so the user sees "Cam1 / Cam1 - Jan" instead of bare ids.
 *
 * `rawXml` retains the original full Profile XML so Save can patch only the
 * attributes the user changed and round-trip every other section byte-for-byte.
 */
export interface AtemAudioConfig {
  matrix?: AtemAudioMatrix
  classicMixer?: AtemClassicMixer
  inputLabels?: Record<number, AtemInputLabel>
  rawXml?: string
}

export interface AtemAudioMatrix {
  sources: AtemAudioSource[]
  outputs: AtemAudioOutput[]
}

export interface AtemClassicMixer {
  programOutGain: number
  programOutBalance: number
  programOutFollowFadeToBlack: boolean
  audioFollowVideoCrossfadeTransition: boolean
  inputs: AtemClassicAudioInput[]
}

export interface AtemClassicAudioInput {
  id: number
  mixOption: 'Off' | 'On' | 'AudioFollowVideo'
  /** Channel-strip gain, dB. ATEM stores -inf as the literal string "-inf"
   *  in XML; we encode it as null on the JS side. */
  gain: number | null
  balance: number
}

export interface AtemAudioSource {
  /** ATEM audio source id (huge numbers like 150798336 — handled by JS Number). */
  id: number
  name: string
}

export interface AtemAudioOutput {
  id: number
  /** sourceId currently routed to this output. 0 = "No Audio". */
  sourceId: number
  name: string
}

export interface AtemInputLabel {
  shortName: string
  longName: string
  externalPortType?: string
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

