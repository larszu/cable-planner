// ---------------------------------------------------------------------------
// Roadmap-Initiative 5, Inkrement 2 — der Vergleich zweier Plan-Staende.
//
// WARUM DIESER ZUSCHNITT. `INITIATIVE-5-SCOPING.md` hat gemessen, dass die
// eigentlich gewuenschte Frage („welches meiner ausgedruckten Blaetter ist
// jetzt hin") ein Register der ausgegebenen Dokumente braucht, das es nicht
// gibt — und dass drei der vier Fragen daran das Dateiformat aendern. Uebrig
// blieb genau ein Stueck, das nichts entscheidet: der Vergleich zweier
// *gegebener* Staende. Das ist zugleich der Fall, den der Nutzer heute von
// Hand macht — „der Kollege hat mir eine ueberarbeitete Datei geschickt, was
// ist anders?" — und fuer den es im untersuchten Markt kein Werkzeug gibt.
//
// ARBEITSTEILUNG MIT `changeImpact`. Diese Datei sagt WAS sich geaendert hat
// (in den Begriffen der Domaene), `changeImpact` sagt WELCHE BLAETTER damit
// ueberholt sind. Der Aufrufer zeigt beides. Absichtlich KEINE Zuordnung
// „Feld X -> Dokument Y": der Stand eines Dokuments haengt an seiner
// Ableitung, nicht an den angefassten Feldern, und `changeImpact` rechnet ihn
// aus statt ihn zu raten. Eine Heuristik daneben waere die schlechtere
// Antwort.
//
// DIE TRAGENDE ENTSCHEIDUNG: NICHTS FAELLT STILL UNTER DEN TISCH.
//
// Ein handgeschriebener Vergleich („wir schauen auf Endpunkte, Typ und Laenge")
// haette 146 Felder auf acht reduziert und die anderen 138 als „keine
// Aenderung" ausgewiesen. Das ist keine Vereinfachung, das ist eine
// Falschaussage — und zwar die gefaehrliche Richtung, weil sie wie eine
// Freigabe aussieht (ADR-005). Darum ist der Vergleich hier auf DREI Ebenen
// gegen stilles Weglassen gesperrt:
//
//   1. Projekt-Ebene — jeder Schluessel von `CablePlannerProject`, der nicht
//      Eintrag-fuer-Eintrag aufgeschluesselt wird, wird grob gemeldet
//      (`sections`). Der Guard in tests/planDiff.test.ts prueft, dass kein
//      Schluessel in keiner der beiden Kategorien steht.
//   2. Feld-Ebene — jedes Feld von `Cable`/`EquipmentItem` ist klassifiziert.
//      Ein unklassifiziertes Feld wird als Aenderung gemeldet und in
//      `unclassified` benannt, aber OHNE Werte: unbekanntes Feld heisst auch
//      „ich weiss nicht, ob da ein Geheimnis drinsteht".
//   3. Wert-Ebene — Listen und Objekte werden als „geaendert" gemeldet, aber
//      nur mit ihrer Form (`Liste (12)`), nicht mit Inhalt. Ein Blatt ist
//      nicht der Ort fuer einen JSON-Dump; welcher Port sich geaendert hat,
//      kann dieser Vergleich noch nicht sagen und behauptet es auch nicht.
//
// ZWEI BEFUNDE AUS DEM AUFZAEHLEN, die ein Feld-Auszug nicht gebracht haette:
//
//   * `EquipmentItem` hat `username` und `password` — Geraete-Zugangsdaten,
//     die im Projekt-File stehen (die Properties-Sektion hat sogar einen
//     Verbergen-Schalter). Ein Vergleich, der Werte druckt, haette sie auf das
//     Papier geschrieben. Sie sind als `sensitive` klassifiziert: die
//     Aenderung wird gemeldet, die Werte nie.
//   * Der erste Anlauf des Feld-Auszugs fuer den Test-Guard hat drei Felder
//     STILL verschluckt (`libraryRef`, `rackInternalSnapshot`,
//     `atemMvCapabilitiesOverride`) — alle drei die mit mehrzeiligem
//     Objekt-Literal. Gemessen, nicht ueberlegt: 94 statt 97. Genau der
//     Fehlermodus, gegen den diese Datei geschrieben ist, im eigenen Werkzeug.
// ---------------------------------------------------------------------------

import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'
import { cableLabelId } from './docIds'
import { csvFromTable, planFingerprint } from './documentStamp'
import type { CsvCell, CsvTable } from './csv'

/**
 * Was eine Feld-Aenderung fuer die Arbeit bedeutet.
 *
 * Die Klassen sind keine Sortierhilfe, sie sind Aussagen. `cosmetic` heisst
 * ausdruecklich „daran muss niemand nochmal ran"; wer ein Feld falsch dort
 * eintraegt, erzeugt genau die stille Freigabe, die diese Datei verhindern
 * soll.
 */
export type FieldClass =
  /** Der Schluessel, ueber den verglichen wird. Wird nie als Aenderung gemeldet. */
  | 'identity'
  /** Aendert die physische Arbeit oder den Inhalt eines Dokuments. */
  | 'substantive'
  /** Nur Darstellung — Farbe, Linienfuehrung, Label-Position, Canvas-Layout. */
  | 'cosmetic'
  /** Herkunft/Korrelation: Import-IDs, Provenienz-Marker. Keine Arbeit daran,
   *  aber auch nicht bloss Optik — der naechste Import-Lauf liest sie. */
  | 'bookkeeping'
  /** Zugangsdaten. Die Aenderung wird gemeldet, der Wert nie gezeigt. */
  | 'sensitive'

/**
 * Klassifizierung aller Felder von `Cable`.
 *
 * Vollstaendigkeit ist Vertrag, nicht Fleiss: der Guard in
 * tests/planDiff.test.ts liest die Feldnamen zur Laufzeit aus
 * `types/cable.ts` und faellt, sobald eines fehlt oder eines zuviel steht.
 */
export const CABLE_FIELD_CLASS: Record<string, FieldClass> = {
  id: 'identity',

  // Was gepatcht, gezogen und beschriftet wird.
  name: 'substantive',
  cableNumber: 'substantive',
  netName: 'substantive',
  type: 'substantive',
  standard: 'substantive',
  cableSpecId: 'substantive',
  length: 'substantive',
  fromEquipmentId: 'substantive',
  fromPortId: 'substantive',
  toEquipmentId: 'substantive',
  toPortId: 'substantive',
  layer: 'substantive',
  pathway: 'substantive',
  jacketRating: 'substantive',
  terminationFrom: 'substantive',
  terminationTo: 'substantive',
  isTieLine: 'substantive',
  multicoreName: 'substantive',
  needsConverter: 'substantive',
  installStatus: 'substantive',
  testResult: 'substantive',
  notes: 'substantive',
  // Funk: „Laenge" ist bei Funk sinnlos, Reichweite und Kanal sind es nicht.
  wireless: 'substantive',
  frequency: 'substantive',
  wifiChannel: 'substantive',
  maxRange: 'substantive',
  // Beide Richtungen ist eine Aussage ueber das Signal, nicht ueber die Pfeile.
  bidirectional: 'substantive',
  // Steht auf dem Etikett und loest den Scan auf: aendert sich das, findet ein
  // gedrucktes Etikett seinen Datensatz nicht mehr.
  qrId: 'substantive',

  // Darstellung. `offPage` sagt es im eigenen Docstring: „Die Verbindung
  // bleibt logisch/datentechnisch dieselbe — nur die Darstellung entfaellt."
  color: 'cosmetic',
  routing: 'cosmetic',
  strokeWidth: 'cosmetic',
  dashed: 'cosmetic',
  arrowStart: 'cosmetic',
  arrowEnd: 'cosmetic',
  waypoints: 'cosmetic',
  labelPosition: 'cosmetic',
  labelT: 'cosmetic',
  labelHidden: 'cosmetic',
  endpointLabels: 'cosmetic',
  bumpStyle: 'cosmetic',
  offPage: 'cosmetic',
  offPageFromOffset: 'cosmetic',
  offPageFromWaypoints: 'cosmetic',
  offPageToOffset: 'cosmetic',
  offPageToWaypoints: 'cosmetic',

  // Herkunft.
  graphmlEdgeId: 'bookkeeping',
  netboxId: 'bookkeeping',
  addedFromMobile: 'bookkeeping',
}

/**
 * Klassifizierung aller Felder von `EquipmentItem`.
 *
 * `username`/`password` sind `sensitive` — siehe Kopf dieser Datei.
 */
export const EQUIPMENT_FIELD_CLASS: Record<string, FieldClass> = {
  id: 'identity',

  // Identitaet und Bestueckung.
  name: 'substantive',
  shortName: 'substantive',
  subtitle: 'substantive',
  category: 'substantive',
  deviceTypeId: 'substantive',
  sourceIdentityId: 'substantive',
  inputs: 'substantive',
  outputs: 'substantive',
  portsUnknown: 'substantive',
  modes: 'substantive',
  activeModeId: 'substantive',
  categoryProps: 'substantive',
  qrId: 'substantive',

  // Rolle im Signalfluss — der Plan-Check liest sie.
  tallyRole: 'substantive',
  tcRole: 'substantive',
  embedderRole: 'substantive',
  isConverter: 'substantive',
  isDistributionAmp: 'substantive',
  isPatchPanel: 'substantive',
  videohubRouting: 'substantive',
  atemMvConfig: 'substantive',
  atemMvCapabilitiesOverride: 'substantive',
  atemAudioConfig: 'substantive',
  sdiCaps: 'substantive',

  // Rack und Mechanik.
  isRackDevice: 'substantive',
  isRackShelf: 'substantive',
  rackUnits: 'substantive',
  rackInstanceId: 'substantive',
  rackInstanceLabel: 'substantive',
  rackInstanceStartUnit: 'substantive',
  widthMm: 'substantive',
  heightMm: 'substantive',
  depthMm: 'substantive',
  weightKg: 'substantive',

  // Netz und Zugang.
  ipAddress: 'substantive',
  subnetMask: 'substantive',
  macAddress: 'substantive',
  gateway: 'substantive',
  dnsServers: 'substantive',
  vlans: 'substantive',
  portVlans: 'substantive',
  managementVlanId: 'substantive',
  mgmtUrl: 'substantive',
  firmware: 'substantive',

  // Strom.
  powerConsumptionWatts: 'substantive',
  powerWatts: 'substantive',
  voltage: 'substantive',
  currentAmps: 'substantive',
  powerPhase: 'substantive',

  // Bild/Display als Geraetedaten (nicht Darstellung).
  resolution: 'substantive',
  displaySizeInch: 'substantive',

  // Asset-Register und Lager — Inhalt der Uebergabe-Doku.
  installStatus: 'substantive',
  assetTag: 'substantive',
  serialNumber: 'substantive',
  ownership: 'substantive',
  stockLocation: 'substantive',
  packed: 'substantive',
  supplier: 'substantive',
  purchaseDate: 'substantive',
  warrantyUntil: 'substantive',
  maintenanceIntervalDays: 'substantive',
  serviceHistory: 'substantive',
  priceEUR: 'substantive',
  rentPricePerDay: 'substantive',
  rentCurrency: 'substantive',
  notes: 'substantive',

  // Zugangsdaten: Aenderung ja, Werte nie.
  username: 'sensitive',
  password: 'sensitive',

  // Darstellung. `x`/`y` gehoeren hierher, obwohl die Zeichnung sich damit
  // aendert: verschoben ist nicht umgebaut. Wenn die Laengen-Schaetzung aus
  // der Geometrie mitlaeuft, erscheint das an `length` DES KABELS — dort, wo
  // es die Arbeit betrifft — und der Plan-Stand selbst wird von
  // `changeImpact` ohnehin als ueberholt gemeldet.
  x: 'cosmetic',
  y: 'cosmetic',
  width: 'cosmetic',
  height: 'cosmetic',
  nodeColor: 'cosmetic',
  portsFlipped: 'cosmetic',
  collapsed: 'cosmetic',
  hidden: 'cosmetic',
  favorite: 'cosmetic',
  positionLocked: 'cosmetic',
  icon: 'cosmetic',
  imageUrl: 'cosmetic',
  frontPanelImageUrl: 'cosmetic',
  rearPanelImageUrl: 'cosmetic',
  frontPanelCrop: 'cosmetic',
  rearPanelCrop: 'cosmetic',
  stlDataUri: 'cosmetic',

  // Herkunft und Korrelation.
  importSource: 'bookkeeping',
  graphmlId: 'bookkeeping',
  netboxId: 'bookkeeping',
  netboxPath: 'bookkeeping',
  netboxSourceUrl: 'bookkeeping',
  rentmanId: 'bookkeeping',
  rentmanRemoved: 'bookkeeping',
  manufacturerUrl: 'bookkeeping',
  libraryRef: 'bookkeeping',
  rackInternalSnapshot: 'bookkeeping',
  verifiedBy: 'bookkeeping',
}

/**
 * Projekt-Schluessel, die dieser Vergleich Eintrag-fuer-Eintrag
 * aufschluesselt. Alles andere landet grob in `sections` — der Guard prueft,
 * dass es keinen dritten Fall gibt.
 */
export const ITEMISED_SECTIONS = ['equipment', 'cables'] as const

export interface FieldChange {
  field: string
  klass: FieldClass
  /** Fehlt bei `sensitive` und bei unklassifizierten Feldern. */
  before?: string
  after?: string
}

export interface EntityChange {
  kind: 'equipment' | 'cable'
  id: string
  /** Lesbare Bezeichnung: Geraetename bzw. Kabel-Label-ID. */
  label: string
  change: 'added' | 'removed' | 'modified'
  /** Nur bei `modified` gefuellt. */
  fields: FieldChange[]
}

export interface SectionChange {
  section: string
  /** Was sich grob geaendert hat — Schluessel bzw. Anzahl vorher/nachher. */
  detail: string
}

export interface PlanDiff {
  entities: EntityChange[]
  /** Projekt-Teile, die nicht aufgeschluesselt werden, sich aber geaendert haben. */
  sections: SectionChange[]
  /** Angetroffene Feldnamen ohne Klassifizierung. Leer heisst: Klassen aktuell. */
  unclassified: string[]
  /**
   * HINWEIS, KEINE BEHAUPTUNG. Namen, die sowohl im Zu- als auch im Abgang
   * stehen. Das ist meist ein neu angelegtes statt geaendertes Geraet (andere
   * `id`), es kann aber genauso gut ein echter Austausch sein. Dieser
   * Vergleich kann das nicht unterscheiden und tut auch nicht so: Zu- und
   * Abgang bleiben beide in der Liste stehen.
   */
  recreationHints: string[]
  substantive: number
  cosmetic: number
}

/** Deterministische Serialisierung — Schluessel-Reihenfolge darf nichts aendern. */
const stableJson = (value: unknown): string => {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`
}

/**
 * Wie ein Wert im Bericht steht.
 *
 * Skalare im Klartext; alles andere nur mit seiner Form. Der Grund ist nicht
 * Platz, sondern Ehrlichkeit: ein „Liste (12)" behauptet nichts darueber,
 * welcher der zwoelf Ports sich geaendert hat. Ein JSON-Dump auf einem Blatt
 * wuerde vorgeben, die Antwort zu enthalten.
 */
const renderValue = (value: unknown): string => {
  if (value === undefined) return '-'
  if (value === null) return 'leer'
  if (typeof value === 'string') return value === '' ? '(leer)' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `Liste (${value.length})`
  return 'Objekt'
}

const CLASS_OF: Record<EntityChange['kind'], Record<string, FieldClass>> = {
  equipment: EQUIPMENT_FIELD_CLASS,
  cable: CABLE_FIELD_CLASS,
}

const compareFields = (
  kind: EntityChange['kind'],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  unclassified: Set<string>,
): FieldChange[] => {
  const classes = CLASS_OF[kind]
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  const changes: FieldChange[] = []
  for (const field of [...fields].sort()) {
    const klass = classes[field]
    if (klass === 'identity') continue
    if (stableJson(before[field]) === stableJson(after[field])) continue
    if (!klass) {
      // Unbekanntes Feld: gemeldet, aber ohne Werte. Wir wissen nicht, ob da
      // ein Geheimnis drinsteht — und `substantive` ist die vorsichtige
      // Einordnung, weil sie sichtbar bleibt.
      unclassified.add(field)
      changes.push({ field, klass: 'substantive' })
      continue
    }
    if (klass === 'sensitive') {
      changes.push({ field, klass })
      continue
    }
    changes.push({
      field,
      klass,
      before: renderValue(before[field]),
      after: renderValue(after[field]),
    })
  }
  return changes
}

const equipmentLabel = (e: EquipmentItem): string =>
  e.name?.trim() || `(ohne Namen) ${e.id.slice(0, 8)}`

/** Reihenfolge im Bericht: erst was fehlt, dann was neu ist, dann Aenderungen. */
const CHANGE_ORDER: Record<EntityChange['change'], number> = {
  removed: 0,
  added: 1,
  modified: 2,
}

/**
 * Grobe Beschreibung einer nicht aufgeschluesselten Aenderung.
 */
const sectionDetail = (before: unknown, after: unknown): string => {
  if (Array.isArray(before) || Array.isArray(after)) {
    const b = Array.isArray(before) ? before.length : 0
    const a = Array.isArray(after) ? after.length : 0
    return b === a ? `${a} Eintraege, Inhalt geaendert` : `${b} -> ${a} Eintraege`
  }
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null
  if (isObj(before) || isObj(after)) {
    const b = isObj(before) ? before : {}
    const a = isObj(after) ? after : {}
    const changed = [...new Set([...Object.keys(b), ...Object.keys(a)])]
      .filter((k) => stableJson(b[k]) !== stableJson(a[k]))
      .sort()
    return changed.length > 0 ? changed.join(', ') : 'geaendert'
  }
  return `${renderValue(before)} -> ${renderValue(after)}`
}

/**
 * Namen, die gleichzeitig im Ab- und im Zugang stehen. Siehe
 * `PlanDiff.recreationHints` — ein Hinweis, damit „12 weg, 12 neu" nicht
 * unkommentiert dasteht, und ausdruecklich keine Zusammenfuehrung.
 */
const hintsForRecreation = (entities: EntityChange[]): string[] => {
  const removed = new Set(
    entities.filter((e) => e.change === 'removed').map((e) => `${e.kind} ${e.label}`),
  )
  const hits = new Set<string>()
  for (const e of entities) {
    if (e.change !== 'added') continue
    if (removed.has(`${e.kind} ${e.label}`)) hits.add(e.label)
  }
  return [...hits].sort()
}

/**
 * Was sich zwischen zwei Plan-Staenden geaendert hat.
 *
 * Verglichen wird ueber `id` — die Instanz-Identitaet, die beide Dateien
 * mitbringen. Wer ein Geraet loescht und neu anlegt, erscheint darum als Ab-
 * und Zugang; `recreationHints` sagt, wo das plausibel ist, ohne es zu
 * behaupten.
 */
export const planDiff = (
  before: CablePlannerProject,
  after: CablePlannerProject,
): PlanDiff => {
  const unclassified = new Set<string>()
  const entities: EntityChange[] = []

  const beforeEq = new Map(before.equipment.map((e) => [e.id, e]))
  const afterEq = new Map(after.equipment.map((e) => [e.id, e]))
  for (const [id, e] of beforeEq) {
    if (!afterEq.has(id)) {
      entities.push({
        kind: 'equipment',
        id,
        label: equipmentLabel(e),
        change: 'removed',
        fields: [],
      })
    }
  }
  for (const [id, e] of afterEq) {
    const old = beforeEq.get(id)
    if (!old) {
      entities.push({
        kind: 'equipment',
        id,
        label: equipmentLabel(e),
        change: 'added',
        fields: [],
      })
      continue
    }
    const fields = compareFields(
      'equipment',
      old as unknown as Record<string, unknown>,
      e as unknown as Record<string, unknown>,
      unclassified,
    )
    if (fields.length > 0) {
      entities.push({
        kind: 'equipment',
        id,
        label: equipmentLabel(e),
        change: 'modified',
        fields,
      })
    }
  }

  const beforeCa = new Map(before.cables.map((c) => [c.id, c]))
  const afterCa = new Map(after.cables.map((c) => [c.id, c]))
  for (const [id, c] of beforeCa) {
    if (!afterCa.has(id)) {
      entities.push({
        kind: 'cable',
        id,
        label: cableLabelId(c),
        change: 'removed',
        fields: [],
      })
    }
  }
  for (const [id, c] of afterCa) {
    const old = beforeCa.get(id)
    if (!old) {
      entities.push({
        kind: 'cable',
        id,
        label: cableLabelId(c),
        change: 'added',
        fields: [],
      })
      continue
    }
    const fields = compareFields(
      'cable',
      old as unknown as Record<string, unknown>,
      c as unknown as Record<string, unknown>,
      unclassified,
    )
    if (fields.length > 0) {
      entities.push({
        kind: 'cable',
        id,
        label: cableLabelId(c),
        change: 'modified',
        fields,
      })
    }
  }

  entities.sort((a, b) => {
    const byChange = CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change]
    if (byChange !== 0) return byChange
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.label.localeCompare(b.label) || a.id.localeCompare(b.id)
  })

  // Alles, was nicht aufgeschluesselt wird, aber trotzdem nicht verschwiegen
  // werden darf. Grob, benannt, mit Grund erkennbar.
  const sections: SectionChange[] = []
  const itemised = new Set<string>(ITEMISED_SECTIONS)
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of [...keys].sort()) {
    if (itemised.has(key)) continue
    const b = (before as unknown as Record<string, unknown>)[key]
    const a = (after as unknown as Record<string, unknown>)[key]
    if (stableJson(b) === stableJson(a)) continue
    sections.push({ section: key, detail: sectionDetail(b, a) })
  }

  const fieldChanges = entities.flatMap((e) => e.fields)
  return {
    entities,
    sections,
    unclassified: [...unclassified].sort(),
    recreationHints: hintsForRecreation(entities),
    substantive:
      fieldChanges.filter((f) => f.klass === 'substantive' || f.klass === 'sensitive')
        .length + entities.filter((e) => e.change !== 'modified').length,
    cosmetic: fieldChanges.filter((f) => f.klass === 'cosmetic').length,
  }
}

/** Einzeiler fuer eine Meldung; der Aufrufer uebersetzt (wie `changeImpact`). */
export const planDiffSummary = (diff: PlanDiff): string => {
  const parts: string[] = []
  if (diff.substantive > 0) parts.push(`${diff.substantive} inhaltlich`)
  if (diff.cosmetic > 0) parts.push(`${diff.cosmetic} nur Darstellung`)
  if (diff.sections.length > 0) parts.push(`${diff.sections.length} weitere Bereiche`)
  if (diff.unclassified.length > 0) {
    parts.push(`${diff.unclassified.length} unklassifizierte Felder`)
  }
  return parts.length > 0 ? parts.join(', ') : 'kein Unterschied'
}

const CHANGE_LABEL: Record<EntityChange['change'], string> = {
  removed: 'entfaellt',
  added: 'neu',
  modified: 'geaendert',
}

const KIND_LABEL: Record<EntityChange['kind'], string> = {
  equipment: 'Geraet',
  cable: 'Kabel',
}

const CLASS_LABEL: Record<FieldClass, string> = {
  identity: 'Identitaet',
  substantive: 'inhaltlich',
  cosmetic: 'Darstellung',
  bookkeeping: 'Herkunft',
  sensitive: 'Zugangsdaten',
}

/**
 * Der Vergleich als Tabelle — damit er auf Papier kann.
 *
 * OHNE `DocumentStamp`, und das ist Absicht. Ein Stempel gehoert zu EINEM
 * Plan: `buildDocumentStamp` liest Projektname und Revision aus genau einem
 * Projekt und sagt, ob es von seiner Revision abweicht. Ein Vergleich hat
 * zwei Bezugspunkte, und einen davon zu stempeln waere die halbe Wahrheit.
 * Stattdessen stehen BEIDE Plan-Staende als eigene Zeilen im Blatt — das ist
 * dieselbe Idee (ADR-004: der Stand gehoert auf das Papier), nur richtig
 * angewandt: wer das Blatt in der Hand hat, kann nachrechnen, welche zwei
 * Dateien hier verglichen wurden.
 *
 * Jeder Teil des Berichts steht in der Tabelle, auch die unangenehmen:
 * nicht aufgeschluesselte Bereiche, der Neuanlage-Hinweis und
 * unklassifizierte Felder. Ein Blatt, das nur die schoenen Zeilen zeigt,
 * ist der Fehler, gegen den diese Datei geschrieben ist.
 */
export const planDiffTable = (
  before: CablePlannerProject,
  after: CablePlannerProject,
): CsvTable => {
  const diff = planDiff(before, after)
  const headers = ['Art', 'Typ', 'Bezeichnung', 'Feld', 'Klasse', 'Vorher', 'Nachher']
  const rows: CsvCell[][] = [
    ['Stand', 'vorher', planFingerprint(before), '', '', '', ''],
    ['Stand', 'nachher', planFingerprint(after), '', '', '', ''],
  ]

  for (const entity of diff.entities) {
    if (entity.fields.length === 0) {
      rows.push([
        CHANGE_LABEL[entity.change],
        KIND_LABEL[entity.kind],
        entity.label,
        '',
        '',
        '',
        '',
      ])
      continue
    }
    for (const field of entity.fields) {
      rows.push([
        CHANGE_LABEL[entity.change],
        KIND_LABEL[entity.kind],
        entity.label,
        field.field,
        CLASS_LABEL[field.klass],
        field.before ?? '',
        field.after ?? '',
      ])
    }
  }

  for (const section of diff.sections) {
    rows.push(['Bereich', 'nicht aufgeschluesselt', section.section, '', '', section.detail, ''])
  }
  for (const hint of diff.recreationHints) {
    rows.push([
      'Hinweis',
      'gleicher Name in Ab- und Zugang',
      hint,
      '',
      '',
      'nicht unterscheidbar: neu angelegt oder ausgetauscht',
      '',
    ])
  }
  for (const field of diff.unclassified) {
    rows.push([
      'Hinweis',
      'Feld ohne Klassifizierung',
      field,
      '',
      '',
      'Werte werden nicht gezeigt',
      '',
    ])
  }

  return { headers, rows }
}

export const planDiffCsv = (
  before: CablePlannerProject,
  after: CablePlannerProject,
): string => csvFromTable(planDiffTable(before, after))
