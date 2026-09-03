import { v4 as uuidv4 } from 'uuid'
import type { Cable, CableType } from '../types/cable'
import type { ConnectorType, EquipmentItem, Port } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import { bitsToMask, maskToBits } from './subnet'
import type {
  NetboxCable,
  NetboxComponent,
  NetboxDevice,
  NetboxRack,
  NetboxRef,
  NetboxSnapshot,
  NetboxTermination,
} from '../types/netbox'

/**
 * NetBox-Instanz → Cable-Planner-Plan (#597).
 *
 * Reines Daten-Modul ohne React/Store-Bezug, damit es unit-testbar bleibt
 * (`tests/netboxMapping.test.ts`). Der Import-Dialog ruft ausschliesslich
 * `buildNetboxImportPlan` und reicht das Ergebnis an den projectStore.
 *
 * ## Warum „nur hinzufügen"
 * NetBox ist die Wahrheit über die *Verkabelung*, der Cable Planner die
 * Wahrheit über die *Darstellung*: Positionen, Farben, Wegpunkte, Labels,
 * Multicore-Bündel. Ein Re-Import darf diese Arbeit nie überschreiben.
 * Deshalb ist der Abgleich additiv — bereits importierte Geräte, Ports und
 * Kabel (erkannt an ihrer NetBox-ID) bleiben unverändert; nur in NetBox
 * neu hinzugekommene Elemente landen im Plan. In NetBox gelöschte Elemente
 * werden gemeldet, aber nicht automatisch entfernt.
 */

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Node-Geometrie — gleiche Werte wie beim device-type-library-Import. */
const NODE_WIDTH = 260
const NODE_BASE_HEIGHT = 80
const NODE_PORT_ROW_HEIGHT = 22
/** Horizontaler Abstand zwischen zwei Rack-Spalten. */
const COLUMN_GAP = 140
/** Vertikaler Abstand zwischen zwei Geräten derselben Spalte. */
const ROW_GAP = 40
/** Innenabstand des Rack-Rahmens um seine Geräte. */
const FRAME_PADDING = 32
/** Kopfbereich des Rack-Rahmens (Titelzeile). */
const FRAME_HEADER = 44

/** Fallback-Kabelfarbe, wenn NetBox keine hinterlegt hat. */
const DEFAULT_CABLE_COLOR = '#94a3b8'

/** Rahmenfarben für die Rack-Frames (rotierend). */
const FRAME_COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6']

/**
 * NetBox-Komponententyp → Signalrichtung im Cable Planner.
 *
 * NetBox modelliert Interfaces als richtungslos (ein RJ45 ist Ein- und
 * Ausgang zugleich); Cable Planner trennt `inputs`/`outputs`, weil daraus
 * Canvas-Seite und Kabelrichtung folgen. Richtungslose Komponenten werden
 * deshalb als gespiegeltes In/Out-Paar angelegt — beide Ports tragen
 * dieselbe `netboxId`, und die Kabelauflösung greift sich je Kabelende die
 * passende Hälfte. Alles, was in NetBox eine echte Richtung hat (Strom,
 * Konsole, Patchfeld), bekommt genau einen Port.
 */
const DIRECTION_BY_OBJECT_TYPE: Record<string, 'in' | 'out' | 'bidirectional'> = {
  interface: 'bidirectional',
  // Patchfeld: vorne zum Raum (Eingang), hinten zur Festverkabelung (Ausgang).
  frontport: 'in',
  rearport: 'out',
  // Konsole: der Geräte-Port ist DTE (Eingang), der Konsolenserver DCE.
  consoleport: 'in',
  consoleserverport: 'out',
  // Strom: das Gerät zieht (Eingang), die PDU speist (Ausgang).
  powerport: 'in',
  poweroutlet: 'out',
}

/** Anzeige-Reihenfolge der Ports am importierten Gerät. */
const OBJECT_TYPE_ORDER = [
  'interface',
  'frontport',
  'rearport',
  'consoleport',
  'consoleserverport',
  'powerport',
  'poweroutlet',
]

/** NetBox-Rollen-Slug (Substring) → Cable-Planner-Kategorie. Erster
 *  Treffer gewinnt, daher stehen spezifische Muster oben. */
const ROLE_CATEGORY_RULES: Array<{ match: RegExp; category: string }> = [
  { match: /camera|kamera/, category: 'Kameras' },
  { match: /monitor|display|screen|beamer|projector/, category: 'Monitore' },
  { match: /switch|router|firewall|access-?point|wlan|wifi|patch|network|netzwerk/, category: 'Netzwerk' },
  { match: /pdu|ups|power|strom|usv/, category: 'Strom' },
  { match: /mic|mikro/, category: 'Mikrofone' },
  { match: /mixer|mischpult|console|desk/, category: 'Mischpult' },
  { match: /audio|dante|intercom/, category: 'Audio' },
  { match: /light|licht|dmx|fixture/, category: 'Licht' },
  { match: /server|storage|nas|workstation|pc|compute/, category: 'PC' },
  { match: /video|sdi|encoder|decoder|matrix|scaler|converter/, category: 'Video' },
]

const FALLBACK_CATEGORY = 'Sonstiges'

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

export interface NetboxMappingOptions {
  /** Basis-URL der Instanz — landet auf jedem Gerät, damit gleiche IDs aus
   *  verschiedenen Instanzen (Test/Produktion) unterscheidbar bleiben. */
  baseUrl: string
  /**
   * Nur Komponenten importieren, an denen in NetBox ein Kabel hängt.
   *
   * Default `true`, und zwar bewusst: ein 48-Port-Switch erzeugt sonst
   * (gespiegelt) 96 Handles am Knoten, von denen im typischen Rack sechs
   * verkabelt sind. Für einen lesbaren Kabelplan sind die belegten Ports
   * das Interessante. Wer die Reserve-Kapazität sehen will, schaltet es ab.
   */
  onlyConnectedPorts?: boolean
  /** Auch Kabel importieren (aus). Wenn false, kommen nur die Geräte. */
  includeCables?: boolean
  /** Einen Rahmen je Rack anlegen. Default true. */
  createRackFrames?: boolean
  /** Linke obere Ecke des Import-Blocks auf dem Canvas. */
  origin?: { x: number; y: number }
}

/** Warum ein NetBox-Objekt nicht in den Plan gewandert ist. */
export interface NetboxSkip {
  kind: 'device' | 'cable' | 'port'
  /** NetBox-ID des übersprungenen Objekts. */
  netboxId: number
  label: string
  reason: string
}

export interface NetboxImportPlan {
  /** Neu anzulegende Geräte (mit fertigen uuids, direkt einfügbar). */
  newEquipment: EquipmentItem[]
  /** Neu anzulegende Kabel — referenzieren neue UND bestehende Geräte. */
  newCables: Cable[]
  /** Ports, die an bereits vorhandenen Geräten ergänzt werden müssen
   *  (NetBox-Interface nachträglich angelegt). Patch je Gerät. */
  portAdditions: Array<{
    equipmentId: string
    deviceName: string
    inputs: Port[]
    outputs: Port[]
  }>
  /** Rack-Rahmen, die es im Plan noch nicht gibt. */
  newLocations: LocationFrame[]
  /** Bereits vorhandene, unverändert gelassene Geräte (NetBox-ID). */
  unchangedDeviceIds: number[]
  /** Bereits vorhandene, unverändert gelassene Kabel (NetBox-ID). */
  unchangedCableIds: number[]
  /** Im Plan vorhandene NetBox-Geräte, die die Instanz nicht mehr kennt.
   *  Werden NICHT gelöscht — nur gemeldet, damit der Planer entscheidet. */
  staleDeviceIds: number[]
  staleCableIds: number[]
  skipped: NetboxSkip[]
  /** Zähler für die Vorschau im Dialog. */
  stats: {
    devicesInNetbox: number
    cablesInNetbox: number
    componentsInNetbox: number
    componentsImported: number
  }
}

// ---------------------------------------------------------------------------
// Kleine Helfer
// ---------------------------------------------------------------------------

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  return null
}

/** Zieht den Anzeigenamen aus einem NetBox-Brief-Objekt. */
const refName = (ref: NetboxRef | undefined | null): string =>
  (ref?.name ?? ref?.display ?? ref?.slug ?? '').trim()

/** NetBox liefert `type` mal als `{value,label}`, mal als blanken String. */
const typeSlug = (value: NetboxComponent['type']): string => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return String(value.value ?? value.label ?? '')
  return ''
}

/** Hängt an einer Komponente ein Kabel? `cable` ist je nach NetBox-Version
 *  ein Brief-Objekt, eine blanke ID oder null. */
const componentCableId = (component: NetboxComponent): number | null => {
  const cable = component.cable
  if (cable == null) return null
  if (typeof cable === 'number') return cable
  if (typeof cable === 'object') return asNumber(cable.id)
  return null
}

/**
 * NetBox-Port-/Interface-Typ → Cable-Planner-Steckertyp.
 *
 * Bewertet wird der NetBox-`type`-Slug zuerst (der ist maschinell gepflegt
 * und eindeutig), erst danach der freie Name. So gewinnt `1000base-t`
 * gegen ein Interface, das jemand „SDI-Uplink" genannt hat.
 */
export const netboxConnectorType = (
  objectType: string,
  name: string,
  rawType: NetboxComponent['type'],
): ConnectorType => {
  const slug = typeSlug(rawType).toLowerCase()
  const haystack = `${slug} ${name}`.toLowerCase()

  // --- Strom: der Slug ist hier besonders aussagekräftig. -------------------
  if (objectType === 'powerport' || objectType === 'poweroutlet') {
    if (/powercon|nac3/.test(haystack)) return 'PowerCON'
    if (/cee-?7-?7|cee-?7-?4|schuko/.test(haystack)) return 'Schuko 230V'
    if (/c5|cloverleaf|kleeblatt/.test(haystack)) return 'Kleeblatt'
    if (/c7|figure-?8|euro/.test(haystack)) return 'C7 Eurostecker'
    if (/iec|c13|c14|c15|c19|c20|nema/.test(haystack)) return 'IEC 230V'
    if (/cee.*16|iec-?60309.*16|16a/.test(haystack)) return 'CEE16'
    if (/cee.*32|32a/.test(haystack)) return 'CEE32'
    if (/cee.*63|63a/.test(haystack)) return 'CEE63'
    if (/powerlock/.test(haystack)) return 'Powerlock'
    return 'IEC 230V'
  }

  // --- Konsole ------------------------------------------------------------
  if (objectType === 'consoleport' || objectType === 'consoleserverport') {
    if (/usb-?c/.test(haystack)) return 'USB-C'
    if (/usb/.test(haystack)) return 'USB'
    if (/de-?9|db-?9|rs-?232/.test(haystack)) return 'DB9'
    return 'Ethernet/RJ45'
  }

  // --- Optik / Kupfer / Video ---------------------------------------------
  if (/qsfp|sfp28|sfp56|sfp\+|sfpp|xfp/.test(haystack)) return 'SFP+'
  if (/\bsfp\b/.test(haystack)) return 'SFP'
  if (/\blc\b|\bsc\b|\bst\b|\bmpo\b|\bmtp\b|fiber|fibre|lwl|base-?[lsex]\b/.test(haystack)) {
    return 'Fiber'
  }
  if (/hd-?bnc/.test(haystack)) return 'HD-BNC'
  if (/mini-?bnc/.test(haystack)) return 'Mini-BNC'
  if (/\bbnc\b|\bsdi\b|coax/.test(haystack)) return 'BNC'
  if (/mini-?hdmi/.test(haystack)) return 'Mini-HDMI'
  if (/hdmi/.test(haystack)) return 'HDMI'
  if (/displayport|\bdp\b/.test(haystack)) return 'DisplayPort'
  if (/\bdvi\b/.test(haystack)) return 'DVI'
  if (/\bvga\b/.test(haystack)) return 'VGA'
  if (/xlr/.test(haystack)) return 'XLR'
  if (/\bdmx\b/.test(haystack)) return 'DMX 5-pol (XLR)'
  if (/usb-?c/.test(haystack)) return 'USB-C'
  if (/\busb\b/.test(haystack)) return 'USB'
  if (/\bf-?connector\b|\bcatv\b/.test(haystack)) return 'F-Connector'
  if (/8p8c|base-?t\b|rj-?45|ethernet|1000base|10gbase|2\.5gbase|5gbase/.test(haystack)) {
    return 'Ethernet/RJ45'
  }
  // `virtual`, `lag`, `ieee802.11…` haben keinen physischen Stecker.
  if (/virtual|\blag\b|bridge|ieee802\.11|wireless|\bwlan\b/.test(haystack)) return 'Wireless/RF'
  return 'Custom'
}

/** Steckertyp → Kabeltyp. `CableType` schliesst drei Steckerformen aus,
 *  die es als Kabelsorte im Planer nicht gibt. */
export const connectorToCableType = (connector: ConnectorType): CableType => {
  if (connector === 'DIN' || connector === 'DisplayPort' || connector === 'USB') return 'Custom'
  return connector
}

/** NetBox-Rolle → Cable-Planner-Kategorie. */
export const netboxCategoryForRole = (device: NetboxDevice): string => {
  const role = device.role ?? device.device_role
  const haystack = `${role?.slug ?? ''} ${role?.name ?? ''}`.toLowerCase()
  if (!haystack.trim()) return FALLBACK_CATEGORY
  for (const rule of ROLE_CATEGORY_RULES) {
    if (rule.match.test(haystack)) return rule.category
  }
  return FALLBACK_CATEGORY
}

/** NetBox-Farbe (`"f44336"`, ohne Raute) → CSS-Hex. */
const netboxColor = (raw: string | undefined): string | null => {
  const value = (raw ?? '').trim().replace(/^#/, '')
  return /^[0-9a-f]{6}$/i.test(value) ? `#${value}` : null
}

/** Kabellänge in Metern. NetBox speichert Wert + Einheit getrennt. */
export const netboxCableLength = (cable: NetboxCable): number => {
  const raw = asNumber(cable.length)
  if (raw === null || raw <= 0) return 0
  const unit = typeof cable.length_unit === 'string'
    ? cable.length_unit
    : String(cable.length_unit?.value ?? '')
  switch (unit.toLowerCase()) {
    case 'km':
      return raw * 1000
    case 'cm':
      return raw / 100
    case 'mm':
      return raw / 1000
    case 'ft':
      return raw * 0.3048
    case 'in':
      return raw * 0.0254
    case 'mi':
      return raw * 1609.344
    default:
      // 'm' und alles Unbekannte: als Meter lesen.
      return raw
  }
}

/**
 * Normalisiert die Kabelenden über NetBox-Versionen hinweg.
 *
 * Ab NetBox 3.3 liegen sie als `a_terminations`/`b_terminations`-Arrays vor
 * (Mehrfach-Terminierung), davor als einzelne `termination_a_*`-Felder. Wir
 * werten je Seite genau die erste Terminierung aus: der Cable Planner kennt
 * pro Kabelende genau einen Port, und Mehrfach-Terminierungen sind in der
 * AV-Praxis die Ausnahme (sie werden unten als Hinweis gemeldet).
 */
export const netboxTerminations = (
  cable: NetboxCable,
  side: 'a' | 'b',
): NetboxTermination[] => {
  const modern = side === 'a' ? cable.a_terminations : cable.b_terminations
  if (Array.isArray(modern) && modern.length > 0) return modern
  const legacyType = side === 'a' ? cable.termination_a_type : cable.termination_b_type
  const legacyId = side === 'a' ? cable.termination_a_id : cable.termination_b_id
  const legacyObj = side === 'a' ? cable.termination_a : cable.termination_b
  if (legacyType && legacyId != null) {
    return [{ object_type: legacyType, object_id: legacyId, object: legacyObj }]
  }
  return []
}

/** `"dcim.interface"` → `"interface"`. */
const terminationObjectType = (termination: NetboxTermination): string =>
  String(termination.object_type ?? '').split('.').pop()?.toLowerCase() ?? ''

// ---------------------------------------------------------------------------
// Port-Aufbau
// ---------------------------------------------------------------------------

/** Interner Marker, mit dem wir den object_type an der Komponente führen,
 *  ohne den Snapshot-Typ aufzublähen. */
type TaggedComponent = NetboxComponent & { __objectType?: string }

const makePort = (
  component: NetboxComponent,
  objectType: string,
  direction: 'in' | 'out' | 'bidirectional',
  connectorType: ConnectorType,
): Port => {
  const label = (component.label ?? '').trim()
  const name = (component.name ?? '').trim() || label || `Port ${component.id ?? ''}`.trim()
  return {
    id: uuidv4(),
    name,
    originalName: name,
    type: connectorType,
    connectorType,
    direction,
    netboxId: asNumber(component.id) ?? undefined,
    netboxObjectType: objectType,
    ...(label && label !== name ? { contentLabel: label } : {}),
  }
}

/**
 * Baut die Ports eines Geräts aus seinen NetBox-Komponenten.
 *
 * Richtungslose Komponenten (Interfaces) erzeugen ein gespiegeltes Paar:
 * je einen Eintrag in `inputs` und `outputs` mit gleicher `netboxId`. Damit
 * kann jedes Kabel als Ausgang→Eingang gezeichnet werden, was der Canvas
 * für die Kantendarstellung braucht.
 */
const buildPortsForDevice = (
  components: TaggedComponent[],
  onlyConnected: boolean,
): { inputs: Port[]; outputs: Port[]; imported: number; skippedUnconnected: number } => {
  const inputs: Port[] = []
  const outputs: Port[] = []
  let imported = 0
  let skippedUnconnected = 0

  const ordered = [...components].sort((a, b) => {
    const typeA = OBJECT_TYPE_ORDER.indexOf(a.__objectType ?? '')
    const typeB = OBJECT_TYPE_ORDER.indexOf(b.__objectType ?? '')
    if (typeA !== typeB) return typeA - typeB
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), undefined, { numeric: true })
  })

  for (const component of ordered) {
    const objectType = String(component.__objectType ?? '')
    if (onlyConnected && componentCableId(component) === null) {
      skippedUnconnected++
      continue
    }
    const direction = DIRECTION_BY_OBJECT_TYPE[objectType] ?? 'bidirectional'
    const connectorType = netboxConnectorType(objectType, String(component.name ?? ''), component.type)
    if (direction === 'in') {
      inputs.push(makePort(component, objectType, 'in', connectorType))
    } else if (direction === 'out') {
      outputs.push(makePort(component, objectType, 'out', connectorType))
    } else {
      inputs.push(makePort(component, objectType, 'bidirectional', connectorType))
      outputs.push(makePort(component, objectType, 'bidirectional', connectorType))
    }
    imported++
  }

  return { inputs, outputs, imported, skippedUnconnected }
}

const nodeHeight =(inputs: Port[], outputs: Port[]): number =>
  NODE_BASE_HEIGHT + Math.max(inputs.length, outputs.length, 3) * NODE_PORT_ROW_HEIGHT

// ---------------------------------------------------------------------------
// Haupt-Einstieg
// ---------------------------------------------------------------------------

/**
 * Baut aus einem NetBox-Snapshot den additiven Import-/Abgleich-Plan.
 *
 * `existingEquipment`/`existingCables` sind der aktuelle Projektstand. Beim
 * Erstimport sind sie leer, beim „Aktualisieren" enthalten sie die bereits
 * importierten Elemente — der Plan enthält dann nur noch das Delta.
 */
export const buildNetboxImportPlan = (
  snapshot: NetboxSnapshot,
  existingEquipment: EquipmentItem[],
  existingCables: Cable[],
  options: NetboxMappingOptions,
): NetboxImportPlan => {
  const {
    baseUrl,
    onlyConnectedPorts = true,
    includeCables = true,
    createRackFrames = true,
    origin = { x: 0, y: 0 },
  } = options

  const skipped: NetboxSkip[] = []

  // --- 1. Komponenten je Gerät bündeln -------------------------------------
  const componentsByDevice = new Map<number, TaggedComponent[]>()
  let componentsInNetbox = 0
  for (const [objectType, list] of Object.entries(snapshot.components ?? {})) {
    for (const component of list ?? []) {
      const deviceId = asNumber(component.device?.id)
      if (deviceId === null) continue
      componentsInNetbox++
      const bucket = componentsByDevice.get(deviceId) ?? []
      bucket.push({ ...component, __objectType: objectType })
      componentsByDevice.set(deviceId, bucket)
    }
  }

  // --- 2. Bestand indizieren ------------------------------------------------
  // Nur Geräte derselben Instanz zählen als „schon importiert". Ältere
  // Importe ohne gespeicherte URL werden mitgenommen (Rückwärtskompat).
  const sameInstance = (item: EquipmentItem): boolean =>
    !item.netboxSourceUrl || item.netboxSourceUrl === baseUrl

  const existingByNetboxId = new Map<number, EquipmentItem>()
  for (const item of existingEquipment) {
    if (typeof item.netboxId === 'number' && sameInstance(item)) {
      existingByNetboxId.set(item.netboxId, item)
    }
  }
  const existingCableIds = new Set<number>()
  for (const cable of existingCables) {
    if (typeof cable.netboxId === 'number') existingCableIds.add(cable.netboxId)
  }

  // --- 3. Geräte abarbeiten -------------------------------------------------
  const newEquipment: EquipmentItem[] = []
  const portAdditions: NetboxImportPlan['portAdditions'] = []
  const unchangedDeviceIds: number[] = []
  let componentsImported = 0

  /** NetBox-Device-ID → { equipmentId, Port-Index }. Deckt neue UND
   *  bestehende Geräte ab, damit Kabel zwischen beiden auflösbar sind. */
  interface PortLookup {
    equipmentId: string
    /** `${netboxId}` → Ports dieser Komponente, getrennt nach Seite. */
    byComponent: Map<number, { input?: Port; output?: Port }>
  }
  const lookup = new Map<number, PortLookup>()

  const indexPorts = (equipmentId: string, inputs: Port[], outputs: Port[]): PortLookup => {
    const byComponent = new Map<number, { input?: Port; output?: Port }>()
    for (const port of inputs) {
      if (typeof port.netboxId !== 'number') continue
      const entry = byComponent.get(port.netboxId) ?? {}
      entry.input = port
      byComponent.set(port.netboxId, entry)
    }
    for (const port of outputs) {
      if (typeof port.netboxId !== 'number') continue
      const entry = byComponent.get(port.netboxId) ?? {}
      entry.output = port
      byComponent.set(port.netboxId, entry)
    }
    return { equipmentId, byComponent }
  }

  for (const device of snapshot.devices ?? []) {
    const netboxId = asNumber(device.id)
    if (netboxId === null) continue
    const deviceName =
      (device.name ?? '').trim() ||
      refName(device.device_type) ||
      device.device_type?.model ||
      `NetBox-Gerät ${netboxId}`
    const components = componentsByDevice.get(netboxId) ?? []
    const built = buildPortsForDevice(components, onlyConnectedPorts)
    componentsImported += built.imported

    const existing = existingByNetboxId.get(netboxId)
    if (existing) {
      // Bereits im Plan: Gerät bleibt wie es ist, nur in NetBox neu
      // hinzugekommene Ports werden ergänzt.
      unchangedDeviceIds.push(netboxId)
      const knownComponentIds = new Set(
        [...existing.inputs, ...existing.outputs]
          .map((p) => p.netboxId)
          .filter((id): id is number => typeof id === 'number'),
      )
      const addInputs = built.inputs.filter(
        (p) => typeof p.netboxId === 'number' && !knownComponentIds.has(p.netboxId),
      )
      const addOutputs = built.outputs.filter(
        (p) => typeof p.netboxId === 'number' && !knownComponentIds.has(p.netboxId),
      )
      if (addInputs.length > 0 || addOutputs.length > 0) {
        portAdditions.push({
          equipmentId: existing.id,
          deviceName: existing.name,
          inputs: addInputs,
          outputs: addOutputs,
        })
      }
      // Für die Kabelauflösung zählen bestehende UND neue Ports.
      lookup.set(
        netboxId,
        indexPorts(
          existing.id,
          [...existing.inputs, ...addInputs],
          [...existing.outputs, ...addOutputs],
        ),
      )
      continue
    }

    const manufacturer = refName(device.device_type?.manufacturer)
    const model = device.device_type?.model ?? refName(device.device_type)
    const uHeight = asNumber(device.device_type?.u_height) ?? 0
    const primaryIp = device.primary_ip?.address ?? device.primary_ip4?.address ?? ''
    const noteParts = [
      `Importiert aus NetBox (${baseUrl}), Gerät #${netboxId}.`,
      manufacturer || model ? `Typ: ${[manufacturer, model].filter(Boolean).join(' ')}` : '',
      device.serial ? `Seriennummer: ${device.serial}` : '',
      device.asset_tag ? `Asset-Tag: ${device.asset_tag}` : '',
      (device.description ?? '').trim(),
    ].filter(Boolean)

    const item: EquipmentItem = {
      id: uuidv4(),
      name: deviceName,
      ...(model && model !== deviceName ? { subtitle: model } : {}),
      category: netboxCategoryForRole(device),
      inputs: built.inputs,
      outputs: built.outputs,
      // Position wird in Schritt 4 gesetzt (Rack-Layout).
      x: origin.x,
      y: origin.y,
      width: NODE_WIDTH,
      height: nodeHeight(built.inputs, built.outputs),
      ...(uHeight > 0 ? { isRackDevice: true, rackUnits: Math.max(1, Math.round(uHeight)) } : {}),
      // NetBox liefert `10.0.5.7/26`. Die Praefixlaenge wurde hier
      // weggeworfen — und Pruefung 17 rechnete danach auf einer erfundenen
      // /24 (`e.subnetMask || '255.255.255.0'`). Sie stand die ganze Zeit in
      // der Antwort; sie mitzunehmen kostet nichts.
      ...(primaryIp ? { ipAddress: primaryIp.split('/')[0] } : {}),
      ...(primaryIp && primaryIp.includes('/')
        ? (() => {
            const mask = bitsToMask(maskToBits(primaryIp.split('/')[1]))
            return mask ? { subnetMask: mask } : {}
          })()
        : {}),
      importSource: 'netbox',
      netboxId,
      netboxSourceUrl: baseUrl,
      notes: noteParts.join('\n'),
      // Ein Gerät ohne jede Komponente hätte sonst still eine leere
      // Port-Liste — der Plan-Check soll das Datenblatt einfordern.
      ...(built.inputs.length === 0 && built.outputs.length === 0 ? { portsUnknown: true } : {}),
    }
    newEquipment.push(item)
    lookup.set(netboxId, indexPorts(item.id, item.inputs, item.outputs))
  }

  // --- 4. Layout: eine Spalte je Rack, Reihenfolge wie in der Elevation ----
  const rackById = new Map<number, NetboxRack>()
  for (const rack of snapshot.racks ?? []) {
    const id = asNumber(rack.id)
    if (id !== null) rackById.set(id, rack)
  }

  const newLocations = layoutNewEquipment(
    newEquipment,
    snapshot,
    rackById,
    origin,
    createRackFrames,
    existingEquipment,
  )

  // --- 5. Kabel -------------------------------------------------------------
  const newCables: Cable[] = []
  const unchangedCableIds: number[] = []
  const seenCableIds = new Set<number>()

  if (includeCables) {
    for (const cable of snapshot.cables ?? []) {
      const netboxId = asNumber(cable.id)
      if (netboxId === null) continue
      seenCableIds.add(netboxId)
      const label = (cable.label ?? '').trim() || `Kabel #${netboxId}`

      if (existingCableIds.has(netboxId)) {
        unchangedCableIds.push(netboxId)
        continue
      }

      const aTerms = netboxTerminations(cable, 'a')
      const bTerms = netboxTerminations(cable, 'b')
      if (aTerms.length === 0 || bTerms.length === 0) {
        skipped.push({
          kind: 'cable',
          netboxId,
          label,
          reason: 'Kabel hat in NetBox nur ein belegtes Ende.',
        })
        continue
      }
      if (aTerms.length > 1 || bTerms.length > 1) {
        skipped.push({
          kind: 'cable',
          netboxId,
          label,
          reason:
            'Mehrfach-Terminierung: nur das jeweils erste Ende wurde übernommen.',
        })
      }

      const endA = resolveEnd(aTerms[0], lookup)
      const endB = resolveEnd(bTerms[0], lookup)
      if (!endA || !endB) {
        skipped.push({
          kind: 'cable',
          netboxId,
          label,
          reason: 'Mindestens ein Kabelende liegt außerhalb des importierten Bereichs.',
        })
        continue
      }

      // Ausgang → Eingang. Passt die natürliche A→B-Richtung nicht (z. B.
      // weil NetBox die PDU als B-Seite führt), drehen wir das Kabel um.
      let from = endA
      let to = endB
      if (!(endA.ports.output && endB.ports.input)) {
        if (endB.ports.output && endA.ports.input) {
          from = endB
          to = endA
        } else {
          skipped.push({
            kind: 'cable',
            netboxId,
            label,
            reason:
              'Keine gültige Ausgang→Eingang-Richtung: beide Enden sind gleichgerichtet (z. B. zwei Strom-Eingänge).',
          })
          continue
        }
      }
      const fromPort = from.ports.output
      const toPort = to.ports.input
      if (!fromPort || !toPort) continue

      const connector = fromPort.connectorType
      newCables.push({
        id: uuidv4(),
        name: label,
        type: connectorToCableType(connector),
        length: netboxCableLength(cable),
        color: netboxColor(cable.color) ?? DEFAULT_CABLE_COLOR,
        fromEquipmentId: from.equipmentId,
        fromPortId: fromPort.id,
        toEquipmentId: to.equipmentId,
        toPortId: toPort.id,
        notes: `NetBox-Kabel #${netboxId}${cable.description ? ` — ${cable.description}` : ''}`,
        netboxId,
        bidirectional: fromPort.direction === 'bidirectional',
      })
    }
  }

  // --- 6. Verwaiste Elemente melden (nicht löschen) -------------------------
  const snapshotDeviceIds = new Set(
    (snapshot.devices ?? []).map((d) => asNumber(d.id)).filter((id): id is number => id !== null),
  )
  const staleDeviceIds = [...existingByNetboxId.keys()].filter((id) => !snapshotDeviceIds.has(id))
  const staleCableIds = includeCables
    ? [...existingCableIds].filter((id) => !seenCableIds.has(id))
    : []

  return {
    newEquipment,
    newCables,
    portAdditions,
    newLocations,
    unchangedDeviceIds,
    unchangedCableIds,
    staleDeviceIds,
    staleCableIds,
    skipped,
    stats: {
      devicesInNetbox: (snapshot.devices ?? []).length,
      cablesInNetbox: (snapshot.cables ?? []).length,
      componentsInNetbox,
      componentsImported,
    },
  }
}

/** Löst ein NetBox-Kabelende auf einen Cable-Planner-Port auf. */
const resolveEnd = (
  termination: NetboxTermination | undefined,
  lookup: Map<number, { equipmentId: string; byComponent: Map<number, { input?: Port; output?: Port }> }>,
): { equipmentId: string; ports: { input?: Port; output?: Port } } | null => {
  if (!termination) return null
  const objectType = terminationObjectType(termination)
  // Circuit-/Powerfeed-Terminierungen hängen an keinem Gerät und haben im
  // Kabelplan kein Gegenstück.
  if (!DIRECTION_BY_OBJECT_TYPE[objectType]) return null
  const componentId = asNumber(termination.object_id) ?? asNumber(termination.object?.id)
  if (componentId === null) return null
  const deviceId = asNumber(termination.object?.device?.id)

  // Direkter Weg: das Kabelende nennt sein Gerät.
  if (deviceId !== null) {
    const entry = lookup.get(deviceId)
    const ports = entry?.byComponent.get(componentId)
    if (entry && ports) return { equipmentId: entry.equipmentId, ports }
    if (entry) return null
  }
  // Fallback für schlanke Terminierungs-Objekte ohne `device`: die
  // Komponenten-ID ist NetBox-weit eindeutig, also über alle Geräte suchen.
  for (const entry of lookup.values()) {
    const ports = entry.byComponent.get(componentId)
    if (ports) return { equipmentId: entry.equipmentId, ports }
  }
  return null
}

/**
 * Positioniert die neu importierten Geräte: eine Spalte je Rack, innerhalb
 * der Spalte von oben nach unten in Rack-Reihenfolge (höchste HE zuerst).
 *
 * Bewusst gestapelt statt HE-proportional: die Knotenhöhe hängt an der
 * Port-Anzahl, eine maßstäbliche Elevation würde deshalb überlappen. Die
 * Reihenfolge bleibt die des Racks, was für die Montage das Relevante ist.
 *
 * Der Block wird rechts neben bereits vorhandene Geräte gesetzt, damit ein
 * Import einen bestehenden Plan nie überdeckt.
 */
const layoutNewEquipment = (
  newEquipment: EquipmentItem[],
  snapshot: NetboxSnapshot,
  rackById: Map<number, NetboxRack>,
  origin: { x: number; y: number },
  createRackFrames: boolean,
  existingEquipment: EquipmentItem[],
): LocationFrame[] => {
  if (newEquipment.length === 0) return []

  const deviceById = new Map<number, NetboxDevice>()
  for (const device of snapshot.devices ?? []) {
    const id = asNumber(device.id)
    if (id !== null) deviceById.set(id, device)
  }

  /** Rack-ID (oder null für „ohne Rack") → Geräte. */
  const columns = new Map<number | null, EquipmentItem[]>()
  for (const item of newEquipment) {
    const device = item.netboxId != null ? deviceById.get(item.netboxId) : undefined
    const rackId = asNumber(device?.rack?.id)
    const key = rackId ?? null
    const bucket = columns.get(key) ?? []
    bucket.push(item)
    columns.set(key, bucket)
  }

  // Innerhalb einer Spalte: höchste Höheneinheit zuerst (Rack-Ansicht von
  // oben), Geräte ohne Position hinten, dann alphabetisch.
  for (const bucket of columns.values()) {
    bucket.sort((a, b) => {
      const posA = asNumber(deviceById.get(a.netboxId ?? -1)?.position)
      const posB = asNumber(deviceById.get(b.netboxId ?? -1)?.position)
      if (posA !== null && posB !== null && posA !== posB) return posB - posA
      if (posA === null && posB !== null) return 1
      if (posA !== null && posB === null) return -1
      return a.name.localeCompare(b.name, undefined, { numeric: true })
    })
  }

  // Spalten-Reihenfolge: Racks nach Namen, „ohne Rack" ganz rechts.
  const orderedKeys = [...columns.keys()].sort((a, b) => {
    if (a === null) return 1
    if (b === null) return -1
    return refName(rackById.get(a)).localeCompare(refName(rackById.get(b)), undefined, {
      numeric: true,
    })
  })

  // Startpunkt rechts neben dem Bestand, damit nichts überdeckt wird.
  const existingRight = existingEquipment.reduce(
    (max, item) => Math.max(max, item.x + (item.width || NODE_WIDTH)),
    Number.NEGATIVE_INFINITY,
  )
  const startX = Number.isFinite(existingRight)
    ? Math.max(origin.x, existingRight + COLUMN_GAP * 2)
    : origin.x
  const startY = origin.y

  const frames: LocationFrame[] = []
  let cursorX = startX
  let frameIndex = 0

  for (const key of orderedKeys) {
    const bucket = columns.get(key) ?? []
    if (bucket.length === 0) continue
    const columnX = cursorX + (createRackFrames ? FRAME_PADDING : 0)
    let cursorY = startY + (createRackFrames ? FRAME_HEADER : 0)
    for (const item of bucket) {
      item.x = columnX
      item.y = cursorY
      cursorY += item.height + ROW_GAP
    }
    const columnHeight = cursorY - ROW_GAP - startY

    if (createRackFrames) {
      const rack = key === null ? undefined : rackById.get(key)
      frames.push({
        id: uuidv4(),
        name: rack ? refName(rack) || `Rack ${key}` : 'Ohne Rack',
        x: cursorX,
        y: startY,
        width: NODE_WIDTH + FRAME_PADDING * 2,
        height: columnHeight + FRAME_PADDING,
        color: FRAME_COLORS[frameIndex % FRAME_COLORS.length],
        notes: rack
          ? `NetBox-Rack #${key}${rack.u_height ? ` (${rack.u_height} HE)` : ''} — ${snapshot.siteName}`
          : `Geräte ohne Rack-Zuordnung — ${snapshot.siteName}`,
        moveContents: true,
      })
      cursorX += NODE_WIDTH + FRAME_PADDING * 2 + COLUMN_GAP
    } else {
      cursorX += NODE_WIDTH + COLUMN_GAP
    }
    frameIndex++
  }

  return frames
}
