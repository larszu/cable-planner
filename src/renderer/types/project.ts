import type { Cable } from './cable'
import type { EquipmentItem } from './equipment'
import type { GreenGoConfig } from './greengo'
import type { LocationFrame } from './location'
import type { VenueAnswer } from './venueAnswer'
import type { VideoFormatId } from './videoFormat'
import type { PowerStandardId } from './powerStandard'
import type { ChangeLogEntry, PendingChange } from './lifecycle'

/**
 * Auto-Kabelnummerierung — Schema fuer automatisch vergebene Kabel-IDs.
 * Wandert mit dem Projekt (in `ProjectMetadata`), damit "Neu nummerieren"
 * reproduzierbar bleibt und ein erneutes Oeffnen die gleiche Logik nutzt.
 *
 * Format der erzeugten Nummer:
 *   - ohne `perLayer`: `{prefix}{separator}{NNN}`  (z.B. "C-001")
 *   - mit `perLayer`:  `{prefix}{layerCode}{separator}{NNN}` (z.B. "V-001")
 * Bei leerem `prefix` faellt der Separator vor der Zahl weg.
 */
export interface CableNumberingScheme {
  /** Master-Schalter. Wenn false, werden beim Anlegen keine Nummern
   *  automatisch vergeben (manuelles "Neu nummerieren" geht trotzdem). */
  enabled: boolean
  /** Festes Praefix vor der Nummer, z.B. "C" oder "CBL". Leer erlaubt. */
  prefix: string
  /** Eigener, bei `start` beginnender Zaehler je Top-Level-Layer
   *  (video/audio/control/network/power) plus Layer-Kuerzel im Code. */
  perLayer: boolean
  /** Trennzeichen zwischen Praefix/Layer und laufender Nummer. Default "-". */
  separator: string
  /** Nullstellen-Breite der laufenden Nummer (3 -> 001). Default 3. */
  padding: number
  /** Start-Nummer des Zaehlers. Default 1. */
  start: number
}

export interface ProjectMetadata {
  name: string
  description: string
  createdAt: string
  updatedAt: string
  /** Default SDI video format for the project (e.g. 1080p50). */
  defaultVideoFormat?: VideoFormatId
  /** Default mains/power standard for the project (drives the power calculator
   *  voltage — 230 V EU, 120 V North America, …). Default: EU 230 V. */
  defaultPowerStandard?: PowerStandardId
  /** Default lighting-control transport for the project (DMX512 over 5-pin XLR,
   *  Art-Net or sACN over Ethernet). Used as the suggested protocol for new
   *  lighting/control links. Default: DMX512. */
  defaultLightingControl?: 'dmx512' | 'artnet' | 'sacn'
  /** Planner / author of the project file. */
  author?: string
  /** Client name (end customer). */
  client?: string
  /** Contractor / company executing the job. */
  contractor?: string
  /** Optional free-form project number / job code. */
  projectNumber?: string
  /** Company / contractor logo, stored as a data URI (PNG/JPEG) so it travels with the project. */
  companyLogo?: string
  /** Client / project logo, stored as a data URI. */
  clientLogo?: string
  /**
   * Planned cable quantities imported / manually tracked for Rentman.
   * Key format: `${type}|${length}` (e.g. "BNC|1" for SDI 1m cables).
   */
  rentmanCablePlan?: Record<string, number>
  /**
   * Mapping from cable bucket (`${type}|${length}`) to the Rentman equipment
   * id that represents this cable in the Rentman master catalogue. Filled
   * automatically when cable quantities are imported from a Rentman project,
   * and manually when a bucket is mapped via the Rentman cable export dialog.
   * Also remembers the last quantity that was pushed to Rentman so the export
   * can compute deltas.
   *
   * ADR-003 — `lastSentQty` heisst so, weil es genau das ist: die Menge, die
   * abgeschickt wurde. Rentman bestaetigt sie nicht zurueck. Wer hier einen
   * geplanten Wert hineinschreibt, verrechnet jede folgende Differenz.
   */
  rentmanCableMap?: Record<
    string,
    {
      rentmanEquipmentId: string
      lastSentQty?: number
      /**
       * ADR-005 — Die uebrigen Rentman-Positionen, die in denselben Eimer
       * gefallen sind. Ein Eimer ist `typ|laenge`; zwei Marken desselben
       * BNC-10m sind zwei Rentman-Stammartikel, aber ein Eimer. Gebucht wird
       * auf genau eine Id, und das bleibt so — die Menge auf mehrere Artikel
       * aufzuteilen ist eine Entscheidung, die der Nutzer treffen muss, nicht
       * der Import. Bisher wurden die anderen Ids beim Import aber schlicht
       * weggeworfen: `bucket.rows[0]` gewann, der Rest verschwand. Der
       * Export-Dialog konnte deshalb gar nicht sagen, dass er auf einen von
       * mehreren Artikeln bucht — die Information war zu diesem Zeitpunkt
       * nicht mehr da. Sie wird jetzt aufgehoben.
       */
      mergedEquipmentIds?: string[]
    }
  >
  /** Rentman project ID currently linked to this cable planner project. */
  rentmanProjectId?: string
  /** Human-readable name of the linked Rentman project. */
  rentmanProjectName?: string
  /** #597 — Verknüpfte NetBox-Quelle. Wird beim Import gesetzt und vom
   *  „Aktualisieren"-Button wiederverwendet, damit der Nutzer Instanz und
   *  Site/Rack nicht erneut auswählen muss. */
  netboxSourceUrl?: string
  netboxScope?: 'site' | 'rack'
  netboxScopeId?: number
  netboxScopeName?: string
  /** ISO-Zeitpunkt des letzten NetBox-Imports/Abgleichs. */
  netboxLastSyncAt?: string
  /** Auto-Kabelnummerierungs-Schema. Undefined = noch nie konfiguriert
   *  (Defaults siehe `DEFAULT_CABLE_NUMBERING` in `lib/cableNumbering`). */
  cableNumbering?: CableNumberingScheme
  /** #412 — Label der zuletzt festgeschriebenen Revision. Wird beim
   *  Festschreiben gesetzt und im PDF-Titelblock als „Revision" gestempelt. */
  revision?: string
  /** #350 — Längen-Schätzung aus Canvas-Geometrie. */
  lengthEstimation?: LengthEstimationScheme
  /** Festinstallation — Standort/Adresse der Anlage (Übergabe-Doku). */
  siteAddress?: string
  /**
   * Bedarf 85 — was die Haus-IT auf das Anforderungsblatt geantwortet hat.
   *
   * Liegt am Projekt und nicht am Gerät: die Frage ist eine Frage an das Haus,
   * nicht an eine Kiste. Jede Antwort trägt den Ort, für den sie gegeben wurde,
   * eingefroren beim Speichern — damit eine aus einer Vorlage mitgereiste
   * Antwort sagt, aus welchem Haus sie stammt, statt eine Genehmigung zu
   * behaupten, die es hier nie gab.
   */
  venueAnswers?: VenueAnswer[]
  /** Festinstallation — Übergabe-/Abnahme-Datum (ISO). */
  handoverDate?: string
  /** Festinstallation — wartender Dienstleister / Servicekontakt. */
  serviceProvider?: string
  /** Festinstallation — Notfall-/Servicekontakt (Telefon/E-Mail). */
  emergencyContact?: string
  /** Lager (Phase 1) — Beginn des Einsatz-/Miet-Zeitraums (ISO-Datum). Basis
   *  für die spätere projektübergreifende Verfügbarkeits-/Konflikt-Rechnung. */
  eventStart?: string
  /** Lager (Phase 1) — Ende des Einsatz-/Miet-Zeitraums (ISO-Datum). */
  eventEnd?: string
}

/** #350 — Konfiguration für die geometrische Kabellängen-Schätzung. */
export interface LengthEstimationScheme {
  /** Maßstab: wie viele Meter entsprechen 100 px Canvas-Distanz. */
  metersPer100px: number
  /** Reserve-/Slack-Aufschlag in Prozent (z.B. 15 = +15 %). */
  slackPercent: number
  /** Auf ganze Meter aufrunden (true) oder eine Nachkommastelle (false). */
  roundUp: boolean
}

export interface CanvasState {
  x: number
  y: number
  zoom: number
}

export interface CablePlannerProject {
  metadata: ProjectMetadata
  equipment: EquipmentItem[]
  cables: Cable[]
  canvasState: CanvasState
  locations?: LocationFrame[]
  /** GreenGo intercom planning configuration (users, groups, system settings). */
  greengoConfig?: GreenGoConfig
  /** v7.9.3 — Aufbau-Status: welche Ports / Kabel der Field-Tech bereits
   *  physikalisch gesteckt hat. Wird vom Mobile-Viewer (handy.html) via
   *  POST /checks zurückgespielt und im Haupt-Canvas als kleines Häkchen
   *  am Port angezeigt. Port-Key: `${deviceId}|${portId}`, Cable-Key:
   *  Cable-ID. Optional damit alte Projekte beim Laden nicht crashen. */
  checkState?: {
    ports: Record<string, boolean>
    cables: Record<string, boolean>
  }
  /** v7.9.3 — Lock-Status des Projekts:
   *   - 'editing' (Default): voll bearbeitbar
   *   - 'finalized': "Planung abgeschlossen", Canvas read-only,
   *     kann vom Planer wieder auf 'editing' zurückgesetzt werden
   *   - 'viewer': permanent read-only (entstanden durch Import einer
   *     .cpviewer-Datei); nur Annotations können hinzugefügt werden */
  mode?: 'editing' | 'finalized' | 'viewer'
  /** v7.9.3 — Anmerkungen von externen Reviewern (z.B. Freelancer beim
   *  Aufbau). Werden im Viewer-Modus erstellt und können vom Planer
   *  zurück ins Original gemerged werden. */
  annotations?: ProjectAnnotation[]
  /** v7.9.3 — Im Viewer-Modus gespeicherter Reviewer-Name. Wird beim
   *  Öffnen der .cpviewer-Datei einmalig abgefragt und ist Author für
   *  alle in dieser Session erstellten Anmerkungen. */
  viewerSession?: {
    author: string
    startedAt: string
  }
  /** #412 — Benannte Projekt-Stände (Revisionen/Snapshots). Jede Revision
   *  hält einen vollständigen Snapshot des Plans, sodass ein früherer Stand
   *  wiederhergestellt werden kann. Optional → alte Projekte laden sauber. */
  revisions?: ProjectRevision[]
  /** Festinstallation — attribuiertes Änderungsprotokoll (MAC/IMACD). Jede
   *  Move/Add/Change/Service-Aktion landet hier mit wer/was/wann, sodass der
   *  Plan ein nachvollziehbares lebendes Dokument bleibt. Optional → alte
   *  Projekte heilen zu []. */
  changelog?: ChangeLogEntry[]
  /** Feld-Rückkanal — vom Mobile-Companion/Viewer gemeldete, noch nicht
   *  übernommene Änderungen (Längen-Korrektur, Problem-Meldung …). Der
   *  Planer übernimmt/verwirft sie am Desktop; beim Übernehmen wandert die
   *  Änderung ins `changelog`. Optional → alte Projekte heilen zu []. */
  pendingChanges?: PendingChange[]
  /** .avplan-Passthrough — fremde Domaenen (geteilter Raum + Kamera- + Licht-
   *  Planung), die der Cable-Planner nicht bearbeitet, aber verlustfrei sowohl
   *  in der gemeinsamen .avplan als auch im eigenen Projektfile aufbewahrt,
   *  damit beim App-uebergreifenden Austausch nichts verloren geht. Optional. */
  /**
   * Fremde `.avplan`-Domaenen, die diese App nicht selbst bearbeitet, hier
   * aber aufbewahrt, damit sie ein natives `.cp`-Speichern ueberleben.
   *
   * `unknownDomains` sind Slots, die das FORMAT nicht benennt — eine
   * kuenftige Audio- oder Rigging-Domaene, eine App, die es noch nicht gibt.
   * Sie werden beim Import ausdruecklich abgefragt (siehe
   * `lib/unknownDomainsDialog`) und standardmaessig unveraendert
   * mitgefuehrt; vorher gingen sie in jeder Richtung still verloren.
   */
  avForeign?: {
    venue?: unknown
    cameras?: unknown
    lighting?: unknown
    unknownDomains?: Record<string, unknown>
  }
  /** Drum-Mikrofonierung — visuelles Schlagzeug mit platzierten Mikrofonen.
   *  Optional → alte Projekte laden sauber. Verlustfrei in der .avplan. */
  drumKit?: import('./drumKit').DrumKitPlan
  /** Wireless-Rig — Funkstrecken-Kanalplan (Body + Kapsel/Headset + Frequenz).
   *  Optional → alte Projekte laden sauber. Verlustfrei in der .avplan. */
  wirelessRig?: import('./wirelessRig').WirelessRigPlan
  /**
   * Bedarf 114 — wer traegt in WELCHER Vorstellung welche Strecke.
   *
   * Getrennt vom `wirelessRig`, und das ist der ganze Punkt: der Rig-Plan
   * gehoert der PRODUKTION (Kanal, Sender, Kapsel, Frequenz), die Zuordnung
   * der VORSTELLUNG. Der Beleg nennt sie „the only audio artefact that
   * recurs per performance rather than per production". Beides in ein Objekt
   * zu legen hiesse, den Kanalplan je Vorstellung zu kopieren — und die
   * Kopien laufen auseinander, sobald jemand am Plan etwas aendert.
   *
   * Optional → alte Projekte heilen zu einem leeren Plan.
   */
  micPlot?: import('./micAssignment').MicPlot
  /** ADR-001 — Signalquellen als Rollen („Kamera 1"), an denen die Anker
   *  haengen, die keine Runtime besitzt (heute: die TSL-UMD-Adresse). Geraete
   *  verweisen ueber `EquipmentItem.sourceIdentityId` darauf. Optional → alte
   *  Projekte heilen zu []. */
  sourceIdentities?: import('./sourceIdentity').SourceIdentity[]
  /** Bedarf 105 — das Tally JE POSITION: ueber welchen Weg es kommt, wo die
   *  Lampe sitzt, und was bei der letzten Sichtpruefung zu sehen war. Haengt
   *  an der Rolle und nicht am Geraet, weil die Lampe am Platz haengt.
   *  Optional -> alte Projekte heilen zu []. Ein Datensatz ohne passende
   *  Rolle wird beim Laden verworfen: er zeigte ins Leere und saehe auf dem
   *  Blatt aus wie eine gepruefte Position. */
  tallyPositions?: import('./tallyPosition').TallyPosition[]
  /** Bedarf 116 — die Segmente: welche VLAN wofuer da ist, welche Zeit darin
   *  laeuft und wie man hineinkommt. Die VLAN-Id steht seit Bedarf 19/24 an
   *  jeder Schnittstelle; hier bekommt sie eine Bedeutung. Optional -> alte
   *  Projekte heilen zu []. Ein Segment mit einem Gateway-Zeiger ins Leere
   *  verliert den Zeiger beim Laden: er saehe auf dem Blatt aus wie ein Weg
   *  hinein. */
  networkSegments?: import('./networkSegment').NetworkSegment[]
  /** Initiative 9 — die Ausspielung: wohin gesendet wird, mit welchen
   *  Parametern, und welcher Weg der Ausweichweg ist. Optional → alte
   *  Projekte heilen zu []. **Ohne Stream-Keys** — die liegen im
   *  OS-Schluesselbund, siehe `types/delivery.ts`. */
  deliveryDestinations?: import('./delivery').DeliveryDestination[]
  /**
   * Bedarf 90 — die Antwort auf „wo liegt die unabhängige Archiv-Aufzeichnung
   * und wovon ist sie getrennt".
   *
   * Am Projekt und nicht am Ziel: die Archiv-Kopie gehört der Show, nicht
   * einer einzelnen Ausspielung. Zwei Ziele teilen sich dieselbe Aufzeichnung.
   */
  archiveRecording?: import('./delivery').ArchiveRecording
  /**
   * Bedarf 88 — die Angaben zur Veranstaltung (Titel, Beschreibung, Beginn,
   * Sichtbarkeit, Vorschaubild) einmal, plus die ausdrücklichen Abweichungen
   * je Ziel.
   *
   * Am Projekt und nicht am Ziel: der Bedarf ist „entered ONCE and reconciled
   * across platforms". Ein Feld je Ziel wäre genau das Retippen, das eine
   * ganze Produktkategorie als Kaufgrund verkauft.
   */
  eventMetadata?: import('./eventMetadata').EventMetadataPlan
  /**
   * Bedarf 87 — der Sendebericht: was die Übertragung getan hat, soweit ein
   * Mensch es aufgeschrieben hat.
   *
   * Ausdrücklich KEINE Telemetrie. Der Bedarf zieht die Grenze selbst
   * („not live telemetry capture"), und jede Zeile trägt deshalb ihre
   * Herkunft — siehe `types/transmissionRecord.ts`.
   */
  transmissionRecord?: import('./transmissionRecord').TransmissionRecord
  /**
   * Bedarf 79 — der Vergleich Plan gegen Ist: Kostenpositionen mit Schätzung
   * und Ist-Wert, plus Währung und Toleranz.
   *
   * KEINE Projektsumme. Sie wird gerechnet (`costTotals`), nicht gespeichert —
   * eine gespeicherte Summe ist genau der Defekt aus dem Beleg
   * (frappe/erpnext#34127): sie wird einmal eingetippt, die Positionen wandern
   * weiter, und ab da widersprechen sich zwei Zahlen im selben System.
   */
  costPlan?: import('./costLines').CostPlan
  /**
   * Bedarf 74 — die Namensregel dieses Projekts (Rolle-Ort-Nummer).
   *
   * Am Projekt und nicht in den App-Einstellungen: eine Namenskonvention
   * gehört der Show und reist mit ihr. Zwei Trucks derselben Firma benennen
   * verschieden, und die Datei muss beim Empfänger dieselben Namen ergeben
   * wie beim Absender.
   */
  namingScheme?: import('./namingScheme').NamingScheme
  /**
   * Bedarf 72 — der Multicast-Adressplan: aus welchem Pool vergeben wird und
   * welche Gruppe welcher Sende-Port belegt.
   *
   * Nur die VERGABEN stehen hier. Welche Flüsse es gibt, leitet
   * `collectFlows` aus dem Kabelgraph ab — ein zweites Feld dafür wäre ab dem
   * ersten umgesteckten Kabel falsch. Die Adresse dagegen muss stehen
   * bleiben: sie ist verteilt worden, und eine, die sich beim nächsten Öffnen
   * neu berechnet, sieht aus wie die alte und ist es nicht.
   */
  multicast?: import('./multicast').MulticastConfig
  /**
   * Bedarf 89 — das Sicherheitsnetz: Schwellen, Szenennamen, welches Ziel
   * geschützt wird, und wo der Wächter läuft.
   *
   * Am Projekt und nicht am Ziel: die Szenenliste des Encoders und die
   * Maschine, auf der der Wächter steht, gelten für die ganze Show. Ein Feld
   * je Ziel müsste sie vervielfachen — und der Namensabgleich verglich dann
   * gegen die falsche Kopie.
   */
  fallback?: import('./fallback').FallbackPlan
}

/** #412 — Ein festgeschriebener Projekt-Stand. */
export interface ProjectRevision {
  id: string
  /** Kurzes Label wie "A", "B", "Rev 2" oder "As-Built". */
  label: string
  /** Freitext-Notiz: was sich gegenüber dem vorigen Stand geändert hat. */
  note: string
  createdAt: string
  /** Markiert diese Revision als As-Built (gebauter Endzustand). */
  asBuilt: boolean
  /** Vollständiger Snapshot des Plans zum Zeitpunkt des Festschreibens.
   *  Enthält selbst KEINE `revisions` (kein rekursives Wachstum). */
  snapshot: RevisionSnapshot
}

/** Der in einer Revision gespeicherte Plan-Stand (Project ohne `revisions`). */
export type RevisionSnapshot = Omit<CablePlannerProject, 'revisions'>

/** v7.9.3 — Anmerkung eines Reviewers an einem Canvas-Element. */
export interface ProjectAnnotation {
  id: string
  author: string
  createdAt: string
  text: string
  status: 'open' | 'built' | 'resolved'
  anchor:
    | { type: 'device'; deviceId: string }
    | { type: 'port'; deviceId: string; portId: string }
    | { type: 'cable'; cableId: string }
    | { type: 'free'; x: number; y: number }
}
