// ───────────────────────────────────────────────────────────────────────────
// Bedarf 15 — Ausgabe und Rueckgabe auf Container-Ebene.
//
// REIN: keine Uhr, kein Store, kein IO. Der Zeitstempel kommt herein, damit
// derselbe Vorgang zweimal dasselbe Ergebnis liefert.
//
// Die vier Regeln, die hier durchgesetzt werden, stehen alle im Bedarf:
//
//  1. Der INHALT FOLGT MIT, ueber beliebig viele Ebenen -- aus dem Baum
//     abgeleitet, nicht mitgeschleppt.
//  2. Was tatsaechlich drin war, wird EINGEFROREN. Nicht die Kit-Vorlage:
//     „Kits contain models, not the specific physical assets".
//  3. NICHTS GEHT ZWEIMAL RAUS. Weder derselbe Container noch einer, der in
//     einem bereits ausgegebenen liegt -- das waere dasselbe Blech in zwei
//     Vorgaengen, und beide Listen waeren falsch.
//  4. Der Unterschied bei der Rueckgabe wird BERICHTET, nicht geheilt.
// ───────────────────────────────────────────────────────────────────────────
import type {
  InventoryItem,
  InventoryUnit,
  StorageNode,
} from '../types/inventory'
import type { CheckoutLine, CheckoutRecord } from '../types/checkout'
import { descendantNodeIds, isContainerKind, nodePathLabel } from './storageTree'
import type { CsvCell, CsvTable } from './csv'
import { ownershipNote } from './ownership'

/** Der Bestand, aus dem eine Ausgabe entsteht. */
export interface InventorySnapshotIn {
  items: InventoryItem[]
  nodes: StorageNode[]
  units: InventoryUnit[]
}

/**
 * Was in `nodeId` liegt -- ueber alle Ebenen, in stabiler Reihenfolge.
 *
 * Verschachtelte Container erscheinen als eigene Zeile UND ihr Inhalt
 * einzeln. Beides, weil beide Fragen gestellt werden: „ist Case 2 wieder
 * da?" und „sind die drei Objektive aus Case 2 wieder da?". Nur den
 * Container zu fuehren waere genau das erfundene Eltern-Asset aus
 * `snipe-it#9517`, das nur fuer sich selbst Auskunft gibt.
 */
export const containerContents = (
  snap: InventorySnapshotIn,
  nodeId: string,
  /** Stichtag fuer „zurueck seit" (ISO-Datum). Von aussen, damit die
   *  Ableitung rein bleibt. */
  heute = '',
): CheckoutLine[] => {
  const inner = descendantNodeIds(snap.nodes, nodeId)
  const scope = new Set(inner)
  scope.add(nodeId)

  const lines: CheckoutLine[] = []

  for (const n of snap.nodes) {
    if (!inner.has(n.id)) continue
    lines.push({ kind: 'node', refId: n.id, label: n.name, quantity: 1, ...(n.code ? { code: n.code } : {}) })
  }
  for (const u of snap.units) {
    if (!u.locationId || !scope.has(u.locationId)) continue
    // Die Einheit unter ihrer eigenen Identitaet -- Seriennummer, wenn es eine
    // gibt, sonst der Code. Ein blosses „1 x Modell" beantwortet die Frage
    // „welche fehlt?" nicht.
    const kennung = u.serial ?? u.code ?? u.id
    // Die Einheit erbt die Herkunft ihres Artikels — eine eigene hat sie nicht.
    const einheitHerkunft = (() => {
      const it = snap.items.find((i) => i.id === u.itemId)
      return it ? ownershipNote(it, heute) : ''
    })()
    // Der Code ist das, was der Scanner findet; die Seriennummer ist das, was
    // der Mensch liest. Beide werden mitgeschrieben -- sie sind nicht
    // dasselbe, und die eine durch die andere zu ersetzen macht genau eine
    // der beiden Rollen kaputt.
    lines.push({
      kind: 'unit',
      refId: u.id,
      label: kennung,
      quantity: 1,
      ...(u.code ? { code: u.code } : {}),
      ...(einheitHerkunft ? { ownership: einheitHerkunft } : {}),
    })
  }
  for (const it of snap.items) {
    if (!it.locationId || !scope.has(it.locationId)) continue
    const herkunft = ownershipNote(it, heute)
    lines.push({
      kind: 'item',
      refId: it.id,
      label: it.model,
      quantity: it.quantity,
      ...(it.code ? { code: it.code } : {}),
      ...(herkunft ? { ownership: herkunft } : {}),
    })
  }

  // Stabil sortiert: Container, dann Einheiten, dann Mengen-Artikel; innerhalb
  // nach Bezeichnung. Ohne feste Reihenfolge waere jede zweite Ausgabeliste
  // eine andere Datei -- und der Dokument-Stempel damit wertlos.
  const rang: Record<CheckoutLine['kind'], number> = { node: 0, unit: 1, item: 2 }
  return lines.sort(
    (a, b) => rang[a.kind] - rang[b.kind] || a.label.localeCompare(b.label, 'de') || a.refId.localeCompare(b.refId),
  )
}

export type CheckoutRefusal =
  /** Der Knoten ist kein Container (Depot, Raum, Regal, Fach). */
  | 'not-a-container'
  /** Dieser Container ist bereits ausgegeben. */
  | 'already-out'
  /** Er liegt in einem bereits ausgegebenen Container. */
  | 'inside-checked-out'
  /** Es gibt ihn nicht. */
  | 'unknown-node'

/**
 * Darf `nodeId` jetzt raus? `undefined` heisst ja.
 *
 * Regel 3 hat zwei Haelften, und die zweite ist die, die man vergisst: ein
 * Case IM ausgegebenen Transport-Case ist bereits draussen. Es noch einmal
 * auszugeben ergaebe zwei Vorgaenge ueber dasselbe Blech, von denen die
 * Rueckgabe des einen den anderen stillschweigend falsch macht.
 */
export const checkoutRefusal = (
  snap: InventorySnapshotIn,
  open: CheckoutRecord[],
  nodeId: string,
): CheckoutRefusal | undefined => {
  const node = snap.nodes.find((n) => n.id === nodeId)
  if (!node) return 'unknown-node'
  if (!isContainerKind(node.kind)) return 'not-a-container'
  const offen = open.filter((r) => !r.in)
  if (offen.some((r) => r.nodeId === nodeId)) return 'already-out'
  for (const r of offen) {
    if (descendantNodeIds(snap.nodes, r.nodeId).has(nodeId)) return 'inside-checked-out'
  }
  return undefined
}

/**
 * Den Vorgang bauen. Wirft NICHT -- die Absage ist ein Rueckgabewert, denn
 * „darf nicht" ist hier eine normale Antwort und keine Ausnahme.
 */
export const buildCheckout = (
  snap: InventorySnapshotIn,
  open: CheckoutRecord[],
  nodeId: string,
  out: CheckoutRecord['out'],
  id: string,
  /** Stichtag fuer die Herkunfts-Notiz (ISO-Datum). Vorgabe: der Tag der
   *  Ausgabe selbst — sie steht ja in `out.at`, und ein anderer waere hier
   *  nicht zu begruenden. */
  heute = out.at.slice(0, 10),
): { record: CheckoutRecord } | { refusal: CheckoutRefusal } => {
  const refusal = checkoutRefusal(snap, open, nodeId)
  if (refusal) return { refusal }
  const node = snap.nodes.find((n) => n.id === nodeId)!
  return {
    record: {
      id,
      nodeId,
      nodeLabel: node.name,
      out,
      contents: containerContents(snap, nodeId, heute),
    },
  }
}

const lineKey = (l: CheckoutLine): string => `${l.kind}:${l.refId}`

/**
 * Der Unterschied zwischen Ausgabeliste und dem, was jetzt drin liegt.
 *
 * NICHT GEHEILT. Ein Werkzeug, das die fehlende Zeile beim Einchecken einfach
 * aus der Liste nimmt, meldet eine vollstaendige Rueckgabe -- und der
 * Verlust faellt erst beim naechsten Job auf, wenn niemand mehr weiss, auf
 * welcher Show es war.
 *
 * Eine kleinere Stueckzahl zaehlt als Fehlmenge in Hoehe der Differenz, keine
 * ganze Zeile: kommen von fuenf Kabeln vier zurueck, fehlt eins.
 */
export const checkinDifference = (
  record: CheckoutRecord,
  jetzt: CheckoutLine[],
): { missing: CheckoutLine[]; extra: CheckoutLine[] } => {
  const nachher = new Map(jetzt.map((l) => [lineKey(l), l]))
  const vorher = new Map(record.contents.map((l) => [lineKey(l), l]))

  const missing: CheckoutLine[] = []
  for (const l of record.contents) {
    const da = nachher.get(lineKey(l))
    const fehlt = l.quantity - (da?.quantity ?? 0)
    if (fehlt > 0) missing.push({ ...l, quantity: fehlt })
  }

  const extra: CheckoutLine[] = []
  for (const l of jetzt) {
    const war = vorher.get(lineKey(l))
    const zuviel = l.quantity - (war?.quantity ?? 0)
    if (zuviel > 0) extra.push({ ...l, quantity: zuviel })
  }

  return { missing, extra }
}

/** Den Vorgang schliessen. Liefert einen NEUEN Datensatz -- der alte bleibt
 *  unberuehrt, weil ein Beleg nicht nachtraeglich anders lauten darf. */
export const closeCheckout = (
  record: CheckoutRecord,
  jetzt: CheckoutLine[],
  at: string,
  note?: string,
): CheckoutRecord => {
  const { missing, extra } = checkinDifference(record, jetzt)
  return { ...record, in: { at, missing, extra, ...(note ? { note } : {}) } }
}

/** Offene Vorgaenge (noch nicht zurueck). */
export const openCheckouts = (records: CheckoutRecord[]): CheckoutRecord[] =>
  records.filter((r) => !r.in)

/**
 * Ueberfaellige Vorgaenge zu einem Stichtag. Ohne `dueBack` ist ein Vorgang
 * NICHT ueberfaellig -- ein fehlendes Rueckgabedatum ist keine Frist.
 */
export const overdueCheckouts = (records: CheckoutRecord[], heute: string): CheckoutRecord[] =>
  openCheckouts(records).filter((r) => r.out.dueBack !== undefined && r.out.dueBack < heute)

const ART: Record<CheckoutLine['kind'], string> = {
  node: 'Container',
  unit: 'Einheit',
  item: 'Artikel',
}

/**
 * Der Ausgabeschein: EIN Container, seine Inhaltsliste, zum Abhaken.
 * Kanonisches Deutsch -- er wandert als CSV und wird in Excel geoeffnet.
 */
export const checkoutSheet = (record: CheckoutRecord): CsvTable => ({
  // Bedarf 67: die Herkunft steht auf dem Blatt, das im Truck liegt. „Make
  // sure it survives into every printed pack list, case label and check-in
  // screen" — dies ist das dritte davon, und es war leer.
  headers: ['Art', 'Bezeichnung', 'Menge', 'Etiketten-Code', 'Herkunft', 'Abgehakt'],
  rows: record.contents.map((l): CsvCell[] => [
    ART[l.kind],
    l.label,
    l.quantity,
    // Bedarf 16 — der Code, den der Scanner am Objekt findet. Wo keiner
    // klebt, steht das da: die interne Id einzusetzen ergaebe eine Spalte,
    // die scannbar AUSSIEHT und es nicht ist.
    l.code ?? 'kein Etikett',
    // Leer bei eigenem Material: stuende in jeder Zeile „Eigen", ginge der
    // Hinweis, auf den es ankommt, darin unter.
    l.ownership ?? '',
    // Die leere Spalte fuer den Stift. Sie ist der Grund, warum das Blatt
    // ueberhaupt gedruckt wird: „works with gloves, in the dark, never logs
    // out". Ohne sie wird daneben auf dem Rand abgehakt.
    '',
  ]),
})

/**
 * Bedarf 16 — der Rueckweg des Papiers.
 *
 * Ein gescannter Code wird gegen die Ausgabeliste gehalten: gehoert er zu
 * diesem Vorgang, und welche Zeile ist es? So wird das Abhaken auf Papier zur
 * EINGABE fuer den digitalen Datensatz statt zu einem zweiten, der ihm
 * widerspricht.
 *
 * `unknown-code` ist ein eigenes Ergebnis und kein `null`: „der Code gehoert
 * nicht in dieses Case" ist die nuetzlichste Auskunft, die dieser Scan geben
 * kann -- sie faengt das Packen ins falsche Case, und zwar bevor es faehrt.
 */
export type ScanBackResult =
  | { kind: 'line'; line: CheckoutLine }
  | { kind: 'unknown-code' }

/** Normalisierung wie beim Lager-Scan: Etiketten kommen mit Leerzeichen und
 *  in wechselnder Schreibweise aus dem Lesegeraet. */
const normCode = (v: string | undefined): string => (v ?? '').trim().toLowerCase()

export const scanBackIntoCheckout = (record: CheckoutRecord, raw: string): ScanBackResult => {
  const needle = normCode(raw)
  if (!needle) return { kind: 'unknown-code' }
  const line = record.contents.find((l) => normCode(l.code) === needle)
  return line ? { kind: 'line', line } : { kind: 'unknown-code' }
}

/**
 * Was auf dem Blatt steht, aber kein Etikett traegt.
 *
 * Nicht als Fehler, sondern als ARBEITSLISTE: diese Positionen lassen sich
 * beim Rueckweg nicht scannen, also muessen sie von Hand abgeglichen werden.
 * Wer den Anteil kennt, weiss, wieviel des Bedarfs-Gewinns er heute schon
 * hat -- und welche Kisten ein Etikett brauchen.
 */
export const unlabelledLines = (record: CheckoutRecord): CheckoutLine[] =>
  record.contents.filter((l) => !l.code)

/**
 * Die Uebersicht: was ist draussen, bei wem, seit wann, bis wann.
 *
 * Der Lagerort steht als PFAD dabei und nicht als blosser Knotenname: „Case 2"
 * gibt es dreimal, „Depot › Raum 1 › Regal A3 › Case 2" einmal.
 */
export const openCheckoutsTable = (
  records: CheckoutRecord[],
  nodes: StorageNode[],
  heute: string,
): CsvTable => ({
  headers: ['Container', 'Lagerort', 'An', 'Show', 'Ausgegeben', 'Zurueck bis', 'Positionen', 'Status'],
  rows: openCheckouts(records).map((r): CsvCell[] => [
    r.nodeLabel,
    nodePathLabel(nodes, r.nodeId) || '',
    r.out.to,
    r.out.projectName ?? '',
    r.out.at,
    r.out.dueBack ?? '',
    r.contents.length,
    r.out.dueBack !== undefined && r.out.dueBack < heute ? 'ueberfaellig' : 'offen',
  ]),
})

/**
 * Der Rueckgabe-Befund: EINE ZEILE JE ABWEICHUNG, keine je Vorgang.
 *
 * Ein glatter Vorgang faellt damit von selbst heraus -- er hat weder eine
 * Fehl- noch eine Zuviel-Zeile. Hier stand zuerst zusaetzlich ein
 * `.filter(...)`, der dasselbe noch einmal behauptete; er war wirkungslos,
 * denn eine leere Liste erzeugt ohnehin keine Zeile. Die Gegenprobe, die ihn
 * entfernte, blieb gruen -- und ein Filter, den nichts prueft, mit einem
 * Kommentar, der eine Regel behauptet, ist schlimmer als keiner: der naechste
 * Leser haelt die Regel fuer bewacht.
 *
 * Bewacht ist sie jetzt an der Stelle, an der sie brechen KANN: ein Test
 * baut das Blatt aus lauter glatten Rueckgaben und verlangt, dass es leer
 * bleibt. Wer eine „alles in Ordnung"-Zeile ergaenzt, faellt darueber.
 */
export const discrepancyTable = (records: CheckoutRecord[]): CsvTable => ({
  headers: ['Container', 'An', 'Zurueck am', 'Befund', 'Art', 'Bezeichnung', 'Menge', 'Kennung'],
  rows: records
    .filter((r) => r.in)
    .flatMap((r) => [
      ...r.in!.missing.map((l): CsvCell[] => [
        r.nodeLabel, r.out.to, r.in!.at, 'fehlt', ART[l.kind], l.label, l.quantity, l.refId,
      ]),
      ...r.in!.extra.map((l): CsvCell[] => [
        r.nodeLabel, r.out.to, r.in!.at, 'zusaetzlich', ART[l.kind], l.label, l.quantity, l.refId,
      ]),
    ]),
})
