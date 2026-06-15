import type { ConnectorType } from './equipment'
import type { SignalStandard } from './cableSpec'
import type { InstallStatus, CableTestResult } from './lifecycle'

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
  /** Where to show the cable label. Defaults to 'center'.
   *  v7.9.112: 'none' hinzugefuegt — Label garnicht rendern. Ersetzt den
   *  separaten labelHidden-Toggle. labelHidden=true wird beim Laden
   *  zu labelPosition='none' geheilt. */
  labelPosition?: 'center' | 'source' | 'target' | 'none'
  /** v7.9.93 — Feinjustierter Label-Slider entlang des Kabels (0..1).
   *  Überschreibt `labelPosition` wenn gesetzt. 0 = Source-Ende,
   *  0.5 = Mitte, 1 = Target-Ende. Erlaubt millimetergenaue Positionierung
   *  wenn die drei Presets center/source/target nicht reichen. */
  labelT?: number
  /** v7.9.93 — Label komplett ausblenden ohne den Namen löschen zu müssen. */
  labelHidden?: boolean
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
  /** v7.9.127 — per-cable Override fuer den globalen Endpoint-Labels-
   *  Toggle (Settings -> Editing -> "Endpoint-Labels einblenden").
   *  undefined = global folgen, 'show' = immer zeigen,
   *  'hide' = immer ausblenden. Greift in CableEdge unabhaengig vom
   *  Global-Toggle. */
  endpointLabels?: 'show' | 'hide'
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
  /** v7.9.85 / #123 — Layer-Zuordnung für Ebenen-Filter ("nur Netzwerk",
   *  "nur Video" etc.). Top-Level-Layer aus dem AV/Broadcast-Industrie-
   *  Standard: video / audio / control / network / power. User-definierte
   *  Sub-Layer werden als freier String erlaubt (z.B. "video.primary",
   *  "audio.foh"). Undefined = ungrouped / immer sichtbar. */
  layer?: string
  /** Auto-Kabelnummerierung — eindeutige Kabel-ID aus dem Projekt-Schema
   *  (`ProjectMetadata.cableNumbering`). Wird beim Anlegen automatisch
   *  vergeben (wenn das Schema aktiv ist) oder per "Alle Kabel neu
   *  nummerieren" gesetzt. Frei editierbar; undefined = keine Nummer. */
  cableNumber?: string
  /** #363 — Multicore/Snake/Loom/Trunk: mehrere logische Kabel (Adern) teilen
   *  sich ein physisches Bündel. Kabel mit demselben (nicht-leeren)
   *  `multicoreName` gehören zum selben Bündel. Jede Ader bleibt einzeln
   *  adressierbar (eigenes Kabel-Objekt), das Bündel wird in der Patchliste
   *  als eigene Spalte geführt. Freier String (z.B. "Snake-1", "FOH-Loom").
   *  Undefined = Einzelkabel. */
  multicoreName?: string
  /** #368 — Tie-Line / Festverbindung: dauerhaft installierte Verbindung
   *  (Haus-/Dauerleitung zwischen Anschlusskästen/Räumen), kein Show-Kabel.
   *  Wird in der Kabel-Stückliste getrennt ausgewiesen, damit Festverbindungen
   *  nicht mit zu konfektionierenden Kabeln vermischt werden. Undefined =
   *  normales (Show-)Kabel. */
  isTieLine?: boolean
  /** #221 — Off-Page-/Pfeil-Connector (EAGLE/ECAD-Stil). Wenn true wird das
   *  Kabel NICHT als durchgehende Linie gezeichnet, sondern an jedem Ende als
   *  kompaktes benanntes Connector-Symbol (Pfeil + Netzname + Gegenstück).
   *  Die Verbindung bleibt logisch/datentechnisch dieselbe (from/to-Ports
   *  unverändert) — nur die Darstellung quer über den Plan entfällt. */
  offPage?: boolean
  /** #221 — Netz-/Signalname. Alle Off-Page-Kabel mit identischem `netName`
   *  bilden ein gemeinsames Netz (Highlight, Endpunkt-Zählung, Navigation
   *  zum Gegenstück). Fallback wenn leer: der Kabel-`name`. */
  netName?: string
  /** #507 — Verschiebe-Offset (Flow-Koordinaten) des Off-Page-Symbols
   *  gegenüber seinem Port-Handle, je Kabelende. Erlaubt, den Connector vom
   *  Port wegzuziehen; eine dünne Linie verbindet Port und Symbol. Undefined
   *  = Symbol klebt am Port (Default). */
  offPageFromOffset?: { x: number; y: number }
  offPageToOffset?: { x: number; y: number }
  /** #507 — Optionale Wegpunkte (relativ zum Port-Handle, wie der Offset) für
   *  die Tether-Linie Port → Symbol, je Kabelende. Erlauben, die Off-Page-
   *  Verbindung wie ein Standardkabel zu routen (Punkte ziehen/hinzufügen/
   *  löschen). Undefined/leer = gerade Linie Port → Symbol. */
  offPageFromWaypoints?: { x: number; y: number }[]
  offPageToWaypoints?: { x: number; y: number }[]
  /** Festinstallation — Betriebs-Status der Verbindung (geplant…außer Betrieb).
   *  Geht über den binären Mobile-`checkState` hinaus und überlebt im
   *  As-built als lebender Status. Undefined = nicht gesetzt. */
  installStatus?: InstallStatus
  /** Festinstallation — Mantel-/Brandklasse für Pull-/Schedule-Listen
   *  (CM/CMR/CMP/LSZH). Frei editierbar. */
  jacketRating?: string
  /** Festinstallation — Trassen-/Pfad-Bezeichnung (Conduit-/Tray-ID), in der
   *  das Kabel verläuft. Erscheint in der Pull-Liste. */
  pathway?: string
  /** Festinstallation — Terminierung je Ende (T568A/B, LC/SC/MPO …). */
  terminationFrom?: string
  terminationTo?: string
  /** Festinstallation — Mess-/Zertifikats-Ergebnis (TIA-568/1152, OLTS/OTDR). */
  testResult?: CableTestResult
  /** Festinstallation — kurze stabile QR-/Lookup-ID (druckbar, ≥ 1,6 cm).
   *  Verknüpft das physische Etikett mit dem digitalen Datensatz
   *  ("Was ist dieses Kabel? Wo geht es hin?"). */
  qrId?: string
}
