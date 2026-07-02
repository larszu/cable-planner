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
  /** Generic Triax-Single-Coax (analoge HDTV-Kamerakabel-Strecke). */
  | 'Triax'
  /** #376 — Triax-Subtypes je System/Hersteller. Mechanisch teilweise
   *  inkompatibel zueinander, deshalb separat gefuehrt damit die
   *  BOM/Patch-Liste den richtigen Stecker zeigt. */
  | 'Triax (Damar & Hagen)'
  | 'Triax (Fischer)'
  /** #376 — SMPTE 304M Hybrid-Fiber-Kamerakabel-Stecker. Mechanisch
   *  unabhaengig vom (analogen) Triax. Lemo 3K.93C/311 ist der EBU-
   *  Industrie-Standard; Neutrik OpticalCON Dragonfly ist eine
   *  Touring/Stage-Variante. */
  | 'LEMO 3K.93C (SMPTE 304M)'
  | 'Neutrik Dragonfly (SMPTE 304M)'
  | 'Wireless/RF'
  | 'VGA'
  | 'DVI'
  | 'DB9'
  | 'DB25'
  | 'Klinke'
  | 'Mini-XLR'
  | 'HD-BNC'
  | 'Mini-HDMI'
  | 'F-Connector'
  | 'GG45'
  | 'Kleeblatt'
  | 'IEC 230V'
  | 'PowerCON'
  | 'Schuko 230V'
  | 'C7 Eurostecker'
  | 'CEE16'
  | 'CEE32'
  | 'CEE63'
  | 'Powerlock'
  | 'Socapex'
  | 'Harting'
  /** Licht (DMX), Legacy-Analog-Video und Patchbay/Coax-Varianten. */
  | 'DMX 5-pol (XLR)'
  | 'DMX 3-pol (XLR)'
  | 'Cinch/RCA'
  | 'SCART'
  | 'S-Video'
  | 'TT/Bantam'
  | 'Mini-BNC'
  | 'Micro-BNC'
  | 'Custom'

/** All valid connector type values in display order. */
export const ALL_CONNECTOR_TYPES: ConnectorType[] = [
  'XLR', 'Mini-XLR', 'Klinke', 'BNC', 'HD-BNC', 'HDMI', 'Mini-HDMI', 'Ethernet/RJ45', 'GG45', 'Fiber', 'SFP', 'SFP+', 'DIN',
  'DisplayPort', 'VGA', 'DVI', 'USB', 'USB-C',
  'Triax', 'Triax (Damar & Hagen)', 'Triax (Fischer)',
  'LEMO 3K.93C (SMPTE 304M)', 'Neutrik Dragonfly (SMPTE 304M)',
  'F-Connector', 'DB9', 'DB25', 'Wireless/RF',
  'DMX 5-pol (XLR)', 'DMX 3-pol (XLR)', 'Cinch/RCA', 'SCART', 'S-Video', 'TT/Bantam', 'Mini-BNC', 'Micro-BNC',
  'IEC 230V', 'PowerCON', 'Schuko 230V', 'C7 Eurostecker',
  'CEE16', 'CEE32', 'CEE63', 'Powerlock', 'Socapex', 'Harting', 'Kleeblatt', 'Custom',
]

import type { SignalStandard } from './cableSpec'
import type { SdiCapabilities } from './videoFormat'
import type { InstallStatus, ServiceRecord } from './lifecycle'

export interface Port {
  id: string
  name: string
  /** v7.9.113 / Issue #232 — Original Template-Name. Wird beim Anlegen
   *  vom Library-Template gesetzt und NICHT vom User editiert. Genutzt
   *  beim Cable-Reconnect mit Label-Swap-Feature: alter Port wird auf
   *  seinen originalName zurueckgesetzt, der vom User vergebene Name
   *  wandert mit dem Kabel auf den neuen Port. */
  originalName?: string
  /** v7.9.130 / Issue #251 — Anzeige-Nummer unabhaengig vom Label.
   *  Default ist die Position im Array (1-basiert), kann aber pro
   *  Port ueberschrieben werden. Anwendungsfaelle:
   *  - User loescht Port 3 — die uebrigen behalten ihre Original-
   *    Nummern (4 wird nicht zu 3).
   *  - Videohub-Hardware ist anders nummeriert als unser Slot-Array.
   *  - Doppelte Nummern werden vermeidbar weil der User explizit
   *    festlegt, was angezeigt wird.
   *  WICHTIG: Das Wire-Protokoll (Videohub, ATEM) nutzt weiter den
   *  Array-Index — `portNumber` ist nur fuer die ANZEIGE. */
  portNumber?: number
  /** v7.9.124 / Bug-2 + Bug-3 — Optionale ATEM-Source-ID-Ueberschreibung.
   *  Wenn gesetzt: dieser CP-Port wird im MV-Config-Dialog mit dieser
   *  Source-ID adressiert (statt idx+1). Ermoeglicht offline-Setup
   *  fuer AUX (8001+), Color-Gens (2001+), Media-Player (3010/3020),
   *  PGM (10011) und PVW (10010) — also alles was nicht ein physischer
   *  ATEM-Input ist. Wird ignoriert wenn der ATEM live verbunden ist
   *  (dann gewinnt die echte state.inputs-Liste). */
  atemSourceId?: number
  type: string
  connectorType: ConnectorType
  /** Optional side override on the node (default comes from input/output + mirror). */
  side?: 'left' | 'right'
  /** Optional signal standard declared for this port (e.g. SDI-12G on a camera out). */
  standard?: SignalStandard
  /** #286 — Inhaltliches Label fuer das gefuehrte Signal: "PGM", "PVW",
   *  "MV1", "Cam1" etc. Trennt die Information "WAS geht hier durch?"
   *  vom Hardware-Standard (SDI 3G/12G) und vom Hauptnamen. Wenn gesetzt,
   *  wird es auf dem Canvas als Haupt-Label gerendert und in ATEM-/
   *  Videohub-Exports bevorzugt (vor `port.name`). Bleibt undefined wenn
   *  der Port nur einen Standard / Hardware-Anschluss repraesentiert. */
  contentLabel?: string
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
  /** #370 — Dual-Link Set: zwei BNC-Ports mit gleichem `dualLinkGroup`-
   *  String bilden zusammen ein Dual-Link-Paar (HD/3G, SMPTE 372M).
   *  Free text ID (z.B. 'DL-1'); UI warnt wenn eine Gruppe nicht genau
   *  2 Ports hat. Analog zu `quadLinkGroup`. */
  dualLinkGroup?: string
  /** v7.9.14 — Wenn dieses Equipment ein Black-Box-Rack ist, markiert
   *  jeder externe Port aus welchem internen Rack-Gerät er stammt
   *  (Index in rackInternalSnapshot.items). EquipmentNode nutzt diese
   *  Info um Ports nach Gerät zu gruppieren (Color-Band + aligned
   *  In/Out auf gleicher Höhe). Read-only — bei Nicht-Rack-Items oder
   *  legacy-Rack-Items ohne Snapshot ignoriert. */
  rackOriginDeviceIndex?: number
  rackOriginDeviceName?: string
  /** v7.9.17 — Ursprünglicher Port-Name im Quell-Gerät (also OHNE
   *  "Device · "-Präfix). Wird genutzt um interne Cable-Endpunkte
   *  aus rackInternalSnapshot.cables (by-name) auf reale Port-Handles
   *  zu mappen. */
  rackOriginPortName?: string
  /** v7.9.17 — Markiert dass dieser Port intern im Rack mit einem
   *  anderen Port verbunden ist (also nicht "extern frei"). Vorher
   *  wurden solche Ports gefiltert; jetzt zeigen wir sie ausgegraut +
   *  non-connectable, damit der User sieht WELCHE Ports intern belegt
   *  sind und WIE die Verkabelung im Rack läuft. */
  rackInternallyConnected?: boolean
  /**
   * Direction of the port. Defaults to the array it lives in (`inputs` → 'in',
   * `outputs` → 'out'). A port marked `bidirectional` (e.g. an RJ45 network
   * port) can be used as both source and target for cables.
   */
  direction?: 'in' | 'out' | 'bidirectional'
  /**
   * #410 — Steckverbinder-Geschlecht (male/female). Optional; alte Projekte
   * heilen zu undefined. Wird als ♂/♀ am Port-Handle gezeigt und in
   * Patchliste/Etiketten durchgereicht — relevant fuer die Kabel-Konfektion
   * (welches Kabelende braucht welchen Stecker). Unabhaengig von `direction`
   * (Signal-Richtung) und `connectorType` (Bauform).
   */
  gender?: 'male' | 'female'
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
  /**
   * #362 — Optischer Steckverbinder-Subtyp eines Fiber-Ports/-Kabels
   * (LC / SC / ST / FC / E2000 / MPO-MTP / opticalCON / LEMO). Unabhängig
   * vom SFP-Formfaktor (`sfpType`). Erscheint in Properties + BOM/Etiketten.
   */
  fiberConnector?: string
  /**
   * #362 — Faserklasse: Multimode OM1–OM5 bzw. Singlemode OS1/OS2.
   * Bestimmt die Default-Reichweite/Bandbreite der Faser.
   */
  fiberClass?: string
  /**
   * v7.9.77 / #170 — Manual position override of the port-dot on the
   * device's rack-panel (front oder rear). Normalized 0..1 across the
   * panel face (0=links/oben, 1=rechts/unten). Wenn nicht gesetzt,
   * verteilt der Renderer die Ports gleichmäßig (Default-Layout).
   * Wird interaktiv per Drag in 2D-Rack-Preview / 3D-View gesetzt, damit
   * die Dots zu importierten Front-/Rear-Panel-Fotos passen.
   */
  panelPosX?: number
  panelPosY?: number
  /**
   * v7.9.81 / #170 — Auf welcher Rack-Face (Front/Rear) der Port
   * physisch sitzt. Unabhängig davon ob Input/Output (das ist die
   * Signal-Richtung). Default-Annahme bei fehlendem Wert: 'rear' —
   * weil bei den meisten Rack-Geräten ALLE Anschlüsse hinten sind
   * (Patchblenden + 2-seitige Geräte sind die Ausnahme).
   * User kann Ports einzeln oder in Bulk auf die andere Seite flippen
   * (Rack-Builder Placement-Properties).
   */
  rackSide?: 'front' | 'rear'
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
  /** #124 — Optionale Ressourcen-Werte pro Modus. Wenn gesetzt,
   *  überschreiben sie beim Aktivieren des Modus die gleichnamigen
   *  Geräte-Felder (z. B. höhere Leistung im 4K-Modus). `undefined`
   *  lässt den Geräte-Wert unverändert. */
  powerWatts?: number
  weightKg?: number
}

export interface EquipmentItem {
  id: string
  name: string
  /** Stabile Geraetetyp-Identitaet (GDTF/DIN-SPEC-15800-analog: FixtureTypeID)
   *  — opake, versionsstabile GUID des Geraete-MODELLS (nicht dieser Instanz;
   *  die Instanz-Identitaet ist `id`). Erlaubt es, ein Geraet ueber App-Grenzen
   *  (`.avplan`/camera-list) autoritativ auf sein Datenblatt/Ports aufzuloesen,
   *  statt ueber Namens-Substrings zu raten. Optional — manuell angelegte oder
   *  aus Rentman/GraphML importierte Geraete ohne Katalog-Zuordnung haben es
   *  nicht. */
  deviceTypeId?: string
  /** v7.9.127 — Optional Short-Form-Name fuer platzbegrenzte Kontexte
   *  wie Cable-Endpoint-Labels und Patchlisten. Wenn nicht gesetzt,
   *  wird er bei Bedarf aus `name` per `generateShortName()` abgeleitet.
   *  User kann ihn in den Properties ueberschreiben. Beispiel:
   *  "ATEM Constellation 8K" -> Auto "ATEM8K", User-Override frei. */
  shortName?: string
  /** Optional subtitle shown below the device name (e.g. "PGM Monitor", "Cam 1"). */
  subtitle?: string
  /** Optional background/accent color for the node header (CSS hex, e.g. "#0f4c81"). */
  nodeColor?: string
  /** When true, inputs appear on the right side and outputs on the left side. */
  portsFlipped?: boolean
  category: string
  inputs: Port[]
  outputs: Port[]
  /** Explizit-Unbekannt-Marker fuer die Port-Belegung. Wird gesetzt, wenn ein
   *  Geraet aus einer fremden Domaene (z.B. MultiCam-Kamera-Import) uebernommen
   *  wurde, dessen reale I/O wir NICHT aus einem Datenblatt kennen. Statt eine
   *  plausible-aber-falsche Belegung zu erfinden (die still in BOM/Patchliste/
   *  Verkabelung eingeht), fuehren wir die Ports als leer + markiert und der
   *  Plan-Check fordert die Datenblatt-Ergaenzung ein. Sobald der User Ports
   *  ergaenzt, entfernt die Properties-Sektion das Flag. */
  portsUnknown?: boolean
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
    /** #335 — `rentmanId` pro Inhalt: ein als Rack importiertes Black-Box-Rack
     *  behält die individuellen Rentman-IDs seiner Geräte im Snapshot. */
    items: Array<{ name: string; startUnit: number; rackUnits: number; rentmanId?: string }>
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
  /** #373 — Kategorie-spezifische Fachdaten (Brennweite, PoE-Budget,
   *  Lichtstrom, Phasen, …). Schema je Kategorie in `lib/categorySchemas.ts`;
   *  hier nur die rohen Werte, damit sie mit Projekt-Datei und Library-Template
   *  mitwandern. Optional — Bestands-Geräte haben es nicht. */
  categoryProps?: Record<string, string | number | boolean>
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
  /** #345 — Feste Phasen-Zuordnung (L1/L2/L3) für die Stromverteilung.
   *  Wenn gesetzt, wird das Gerät im Strom-Rechner auf diese Phase
   *  fixiert; nicht gesetzte Geräte verteilt der Balancer automatisch. */
  powerPhase?: 1 | 2 | 3
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
  /**
   * v7.9.33 — Reference to the central library file this equipment was
   * placed from. The project compares this against the library folder
   * on open and offers updates if the folder has a newer revision.
   * `kind` discriminates: 'device' = single .cpdevice, 'group' = part
   * of a placed .cpgroup (all items spawned by one placeGroupPreset
   * call share the same group ref).
   * `name` is the template/preset name at placement time — that's the
   * lookup key against the live library; the on-disk file name is
   * derived via sanitization and may differ from this string.
   * Equipment without a libraryRef is a standalone canvas-only item
   * (e.g. typed directly, imported from Rentman, etc.).
   */
  libraryRef?: {
    kind: 'device' | 'group'
    name: string
    fileVersion: number
    modifiedAt: string
  }
  /** v7.9.67 / #178 — When true the canvas drag handle is disabled for
   *  this device. Toggled per device via Rechtsklick → "Position sperren".
   *  Persists in the project file, independent of the global toolbar-mode
   *  lock from #177. */
  positionLocked?: boolean
  /** v7.9.70 / #167 — Engineering-Daten aus dem Rentman-Katalog (oder
   *  manuell gepflegt). Werden in den Properties angezeigt und vom
   *  3D-Rack-Builder (Issue #170) für die Tiefen-Visualisierung genutzt.
   *  Alle Werte sind optional, damit alte Datenstände kompatibel bleiben. */
  powerWatts?: number
  weightKg?: number
  /** #354 — Optionaler Stückpreis bzw. Tagesmietpreis in EUR. Wird im
   *  Angebots-Export (BOM × Preis) genutzt. Kein Pflichtfeld — alte
   *  Projekte und Geräte ohne Preis bleiben gültig. */
  priceEUR?: number
  /** Tiefe in mm. Wird vom 3D-Rack genutzt um zu prüfen ob ein Patchblende
   *  noch hinter das Gerät passt. Default beim Rendering: 400 mm. */
  depthMm?: number
  /** #420 — Mietpreis (pro Tag). Wird beim Rentman-Import aus dem
   *  Equipment-Endpoint gezogen (Felder `price`, `rentprice`,
   *  `rental_price`, `price_per_day`) — kann manuell ueberschrieben
   *  werden. Waehrung optional; Default ist EUR wenn aus Rentman ohne
   *  Currency-Tag kommt. */
  rentPricePerDay?: number
  rentCurrency?: string
  /** v7.9.80 / #170 — Physische Breite in mm (für Non-19″-Geräte auf
   *  Rack-Shelves). Wird vom 3D-Renderer als reale Box-Breite genutzt.
   *  Unterscheidet sich von `width` (Pixel-Größe für Canvas-Rendering). */
  widthMm?: number
  /** v7.9.80 / #170 — Physische Höhe in mm (für Non-19″-Geräte auf Shelves). */
  heightMm?: number
  /** v7.9.73 / #170 — Optionale STL-Datei (als data:application/octet-stream
   *  base64-URI) für das 3D-Modell des Geräts. Wenn vorhanden, rendert der
   *  3D-Rack-Builder die echte Geometrie statt einer prozeduralen Box.
   *  Größenbegrenzung: ~5 MB damit der Projekt-Save nicht explodiert. */
  stlDataUri?: string
  /** v7.9.75 / #170 — Patchblende-Marker. Wird vom Rack-Builder gesetzt
   *  wenn das Template über den "Patchblende anlegen"-Dialog erzeugt wurde.
   *  Beeinflusst die Darstellung (kleines "PP"-Badge, thin-depth in 3D
   *  default) und das Filtering in den View-Modi. */
  isPatchPanel?: boolean
  /** v7.9.75 / #170 — Rack-Shelf-Marker. Geräte mit diesem Flag rendern
   *  als flache Plattform im Rack; auf sie können Non-19"-Items "gestellt"
   *  werden. Die HE-Höhe bleibt die volle Höhe (1HU = klassisches Single-
   *  Shelf), die echte Plattform liegt oben in dieser HE-Range. */
  isRackShelf?: boolean
  /** #285 — Wandler-Marker. Geraete mit diesem Flag werden in der
   *  Patchliste "durchgereicht": statt Kabel-A endet-bei-Wandler zu
   *  zeigen, folgt die Patchliste dem Output-Kabel des Wandlers und
   *  zeigt das naechste echte Gerät an ("Kamera -> Konverter -> ATEM").
   *  Heuristik: nur eindeutige 1-In/1-Out-Wandler werden auto-verfolgt;
   *  bei mehrdeutigen Out-Kabeln zeigt die Patchliste den Wandler weiter
   *  als normales Ziel. Optional — bleibt undefined fuer normale Geraete. */
  isConverter?: boolean
  /**
   * #359 — Timecode-Rolle: 'source' = TC-Generator/Master, 'sink' = Gerät
   * das TC empfängt (Kamera/Recorder/Pult). Der Plan-Check warnt, wenn es
   * TC-Senken, aber keine TC-Quelle im Projekt gibt.
   */
  tcRole?: 'source' | 'sink'
  /**
   * #360 — Tally-Rolle: 'source' = Mischer/Tally-Hub, 'sink' = Kamera/
   * Monitor/CCU. Plan-Check warnt bei Tally-Senken ohne Tally-Quelle.
   */
  tallyRole?: 'source' | 'sink'
  /**
   * #366 — Embedder/De-Embedder-Rolle für in SDI eingebettetes Audio
   * (SMPTE ST 299/272). Informativ — kennzeichnet, wo Audio ins SDI
   * eingebettet bzw. herausgelöst wird (Patch-/Audio-Input-Liste).
   */
  embedderRole?: 'embedder' | 'deembedder'
  /**
   * #372 — Verteilverstärker (Distribution Amplifier): 1 Eingang wird aktiv
   * auf N Ausgänge derselben Quelle verteilt. Marker analog zu isConverter;
   * der Plan-Check warnt, wenn ein als DA markiertes Gerät <2 Ausgänge hat
   * (verteilt dann faktisch nichts).
   */
  isDistributionAmp?: boolean
  /** Festinstallation — Betriebs-Status des Geräts (geplant…außer Betrieb). */
  installStatus?: InstallStatus
  /** Festinstallation — Inventar-/Asset-Nummer für das Asset-Register. */
  assetTag?: string
  /** Festinstallation — kurze stabile QR-/Lookup-ID (Etikett → Datensatz). */
  qrId?: string
  /** Festinstallation — Garantie-Ablauf (ISO-Datum) für die Betreiber-Doku. */
  warrantyUntil?: string
  /** Festinstallation — Wartungsintervall in Tagen (preventive maintenance). */
  maintenanceIntervalDays?: number
  /** Festinstallation — zeitgestempelte Service-/Wartungs-Historie. Macht aus
   *  der Doku ein CMMS-artiges Asset-Register. Undefined/[] = keine Einträge. */
  serviceHistory?: ServiceRecord[]
  /** Lager (Phase 0) — Eigentumsverhältnis: eigenes Gerät, angemietet oder
   *  Sub-Hire (von Dritten weitervermietet). Steuert später die
   *  Verfügbarkeits-/Mietkalkulation; schon jetzt für Asset-Register/BOM. */
  ownership?: 'owned' | 'rented' | 'subhire'
  /** Lager (Phase 0) — Lagerort/Stellplatz (z.B. „Lager A · Regal 3.2"). */
  stockLocation?: string
  /** Lager (Phase 0) — Anschaffungsdatum (ISO) für Inventar/Abschreibung. */
  purchaseDate?: string
  /** Lager (Phase 0) — Lieferant/Bezugsquelle (Inventar-Herkunft). */
  supplier?: string
}

/** Lager (Phase 0) — Eigentumsverhältnis eines Geräts. */
export type EquipmentOwnership = 'owned' | 'rented' | 'subhire'

/** Anzeige-Reihenfolge + deutsche Default-Labels (UI heilt EN via i18n). */
export const EQUIPMENT_OWNERSHIPS: EquipmentOwnership[] = ['owned', 'rented', 'subhire']
export const EQUIPMENT_OWNERSHIP_LABEL: Record<EquipmentOwnership, string> = {
  owned: 'Eigenbestand',
  rented: 'Angemietet',
  subhire: 'Sub-Hire',
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
    /** #335 — Rentman-Equipment-ID der physischen Kombination, aus der dieses
     *  Rack importiert wurde. Das Rack als Einheit trägt die Kombi-ID; die
     *  einzelnen Inhalte behalten ihre eigene `rentmanId` (siehe items). */
    rentmanId?: string
    /** v7.9.73 / #170 — Rack-Tiefe in mm (Default 800 mm beim Rendering).
     *  Wird vom 3D/Split-Builder genutzt um zu prüfen ob Patchblenden hinter
     *  full-depth-Geräten passen. */
    depthMm?: number
    placements: Array<{
      itemIndex: number
      startUnit: number
      heightUnits: number
      /** v7.9.73 / #170 — Wo das Gerät montiert ist: 'front' = nur Frontschienen
       *  (z.B. 1HE Patchblende vorne), 'rear' = nur Rückschienen (z.B.
       *  Patchblende hinter einem vorderen Gerät), 'full' = beide Tiefen
       *  belegt (Default für klassische Server). Fehlt → 'full'. */
      mountSide?: 'front' | 'rear' | 'full'
      /** v7.9.82 / #170 — Shelf-Devices: horizontale Position innerhalb der
       *  Rack-Mount-Breite (mm vom linken Rail, 0 = ganz links). Default 0. */
      shelfOffsetX?: number
      /** v7.9.82 / #170 — Shelf-Devices: Tiefen-Position innerhalb des Racks
       *  (mm von der Front, 0 = ganz vorne). Default 0. */
      shelfOffsetZ?: number
    }>
    /** v7.9.14 — Canvas-Positionen für den RackInternalCanvas. Wird
     *  vom Rack-Builder beim Speichern befüllt, falls der User Geräte
     *  in der Internal-Verkabelungs-Ansicht frei verschoben hat.
     *  Keyed by itemIndex. Wenn ein Eintrag fehlt, fällt der Canvas
     *  auf die Default-Position aus startUnit zurück. */
    internalCanvasPositions?: Record<number, { x: number; y: number }>
  }
  items: Array<
    EquipmentTemplate & {
      offsetX: number
      offsetY: number
      /** #335 — Rentman-ID dieses Rack-Inhalts. Beim Platzieren (placeGroupPreset)
       *  per Spread auf das EquipmentItem übernommen, sodass jedes Gerät im Rack
       *  seine individuelle Rentman-ID behält. */
      rentmanId?: string
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
    /** v7.9.115 / Issue #223 — User-Waypoints im internen Rack-Canvas.
     *  Vorher wurden Waypoints beim Save in den Preset verloren →
     *  beim Re-Open hat A* alles neu geroutet und der User merkte
     *  'Kabel verlieren ihre Position'. Optional — Presets ohne
     *  Waypoints behalten ihr Auto-Routing-Verhalten. */
    waypoints?: Array<{ x: number; y: number }>
  }>
}

