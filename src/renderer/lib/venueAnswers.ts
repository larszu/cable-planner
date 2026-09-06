// ───────────────────────────────────────────────────────────────────────────
// Die Antwort des Hauses neben der Frage (Bedarf 85, zweite Haelfte).
//
//   > The network ask is hand-written per event, reads as unreasonable to a
//   > security team, and THE OUTCOME (what was opened, what was refused, what
//   > the workaround was) IS NEVER RECORDED, so the next show at the same
//   > venue starts from zero.
//
// Die Frage steht seit Bedarf 23 (`venueNetworkRequest`). Diese Datei setzt
// die Antwort daneben — und zwar so, dass die drei Faelle, die beim naechsten
// Mal Schaden anrichten, jeder einen eigenen Namen haben.
//
// ─── DIE DREI, DIE SONST STILL DURCHRUTSCHEN ───────────────────────────────
//
// 1. ANTWORT AUS EINEM ANDEREN HAUS (`elsewhere`). Genau dafuer ist die
//    Antwort da: sie soll in die naechste Show mitfahren (Bedarf 75/91 —
//    „reusable per-venue knowledge"). Faehrt sie mit, ohne zu sagen woher,
//    dann liest jemand am Freitag in Halle B, Port 1935 sei offen — weil er
//    im Januar in Halle A offen war. Der Ort steht deshalb IN der Antwort,
//    eingefroren beim Speichern, und wird gegen den Ort dieses Projekts
//    gehalten. Nicht verworfen: gezeigt, mit dem Haus dazu.
//
// 2. ANTWORT AUF EINE FRAGE, DIE NICHT MEHR GESTELLT WIRD (`stale`). Der Plan
//    aendert sich zwischen Anfrage und Aufbau; faellt Multicast raus, ist die
//    Multicast-Zusage kein Muell, sondern eine Auskunft ueber das Haus. Sie
//    verschwindet nicht, sie steht unten und heisst so.
//
// 3. KEINE ANTWORT (`pending`). Ein fehlender Eintrag saehe aus wie ein
//    ungestellter Punkt. „Gefragt, nichts gehoert" ist die Auskunft, die vor
//    dem Aufbau zaehlt — und die einzige, nach der man noch einmal anruft.
//
// ─── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
//
// Es wird nichts geraten. Eine Antwort entsteht nur, wenn jemand sie
// eingetragen hat; aus dem Plan laesst sich nicht ableiten, was eine fremde
// IT-Abteilung erlaubt hat. Und es wird nichts an die Anforderung
// zurueckgeschrieben: das Blatt bleibt die Ableitung aus dem Plan, die
// Antwort bleibt die Aussage eines Menschen. Zwei Herkuenfte, zwei Spalten.
//
// REIN: keine Uhr, kein Store, kein IO. Der Zeitpunkt kommt herein.
// ───────────────────────────────────────────────────────────────────────────

import type { CsvCell, CsvTable } from './csv'
import type { VenueAnswer, VenueAnswerStatus } from '../types/venueAnswer'
import type { RequestItem, VenueNetworkRequest } from './venueNetworkRequest'

/**
 * Der Zustand einer Zeile im Blatt „Frage und Antwort".
 *
 * Die vier Antwort-Zustaende plus die zwei, die erst aus dem ABGLEICH
 * entstehen: `elsewhere` und `stale`. Beide sind keine Antworten, sondern
 * Aussagen ueber die Antwort — und deshalb gehoeren sie hierher und nicht in
 * `VenueAnswerStatus`.
 */
export type AnswerRowState = VenueAnswerStatus | 'elsewhere' | 'stale'

export interface AnswerRow {
  key: string
  state: AnswerRowState
  /** Der abgeleitete Wert aus dem Plan; fehlt bei einer reinen Frage. */
  planValue?: string
  /** Was das Haus gesagt hat. */
  note?: string
  by?: string
  at?: string
  /** Das Haus, fuer das die Antwort gegeben wurde. */
  venue?: string
  /**
   * Nur bei `elsewhere`: der Ort DIESES Projekts, gegen den die Antwort
   * abweicht. Ohne beide Namen ist die Warnung nicht nachpruefbar.
   */
  hier?: string
  /** Der Ausgang, den die Antwort selbst traegt — auch bei `elsewhere`/`stale`. */
  answered?: VenueAnswerStatus
}

const trimmed = (v: string | undefined): string | undefined => {
  const s = v?.trim()
  return s ? s : undefined
}

/**
 * Ein Ort ist derselbe, wenn die Namen nach Trimmen und Kleinschreibung
 * gleich sind. Mehr Klugheit waere hier falsch: „Halle A" und „Halle A,
 * Eingang Nord" KOENNEN dasselbe Haus sein, und sie als gleich zu behandeln
 * hiesse, eine Genehmigung zu uebertragen, die vielleicht nie fuer diesen
 * Bereich galt. Im Zweifel `elsewhere` — das kostet einen Anruf, der andere
 * Fehler kostet den Aufbau.
 */
// Exportiert seit Bedarf 91: die Vorlage muss dieselbe Frage stellen wie das
// Blatt („ist das dasselbe Haus?"), und zwei Antworten darauf waeren besonders
// teuer -- die eine entscheidet, was eine Vorlage mitbringt, die andere, wie
// es markiert wird.
export const sameVenue = (a: string | undefined, b: string | undefined): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

export interface MergeInput {
  request: VenueNetworkRequest
  answers: readonly VenueAnswer[]
  /** Der Ort dieses Projekts — `metadata.siteAddress`. Darf fehlen. */
  venue?: string
}

/**
 * Frage und Antwort in einer Liste: erst die Punkte, die der Plan stellt, in
 * der Reihenfolge der Anforderung; danach die Antworten, zu denen es keine
 * Frage mehr gibt.
 */
export function mergeVenueAnswers(input: MergeInput): AnswerRow[] {
  const { request, answers, venue } = input
  const hier = trimmed(venue)
  const byKey = new Map<string, VenueAnswer>()
  for (const a of answers) byKey.set(a.key, a)

  const zeileFuer = (item: RequestItem): AnswerRow => {
    const a = byKey.get(item.key)
    const basis: AnswerRow = {
      key: item.key,
      state: 'pending',
      ...(item.value ? { planValue: item.value } : {}),
    }
    if (!a) return basis

    const antwortOrt = trimmed(a.venue)
    // Ein Ort, den die Antwort nicht nennt, ist nicht „woanders" — er ist
    // unbekannt. Eine alte Antwort ohne Ortsangabe als fremd zu markieren
    // waere eine Warnung ohne Grund.
    const fremd = Boolean(antwortOrt) && Boolean(hier) && !sameVenue(antwortOrt, hier)
    return {
      ...basis,
      state: fremd ? 'elsewhere' : a.status,
      answered: a.status,
      ...(trimmed(a.note) ? { note: trimmed(a.note) } : {}),
      ...(trimmed(a.by) ? { by: trimmed(a.by) } : {}),
      ...(trimmed(a.at) ? { at: trimmed(a.at) } : {}),
      ...(antwortOrt ? { venue: antwortOrt } : {}),
      ...(fremd && hier ? { hier } : {}),
    }
  }

  const zeilen = request.items.map(zeileFuer)

  const gefragt = new Set(request.items.map((i) => i.key))
  for (const a of answers) {
    if (gefragt.has(a.key)) continue
    zeilen.push({
      key: a.key,
      state: 'stale',
      answered: a.status,
      ...(trimmed(a.note) ? { note: trimmed(a.note) } : {}),
      ...(trimmed(a.by) ? { by: trimmed(a.by) } : {}),
      ...(trimmed(a.at) ? { at: trimmed(a.at) } : {}),
      ...(trimmed(a.venue) ? { venue: trimmed(a.venue) } : {}),
    })
  }
  return zeilen
}

/** Deutsche Beschriftung je Zustand. Quell-Sprache, wie ueberall. */
export const ANSWER_STATE_LABEL: Record<AnswerRowState, string> = {
  granted: 'genehmigt',
  partial: 'mit Auflage',
  refused: 'abgelehnt',
  pending: 'keine Antwort',
  elsewhere: 'Antwort aus einem anderen Haus',
  stale: 'Antwort ohne Frage im Plan',
}

/**
 * Die Punkte, wegen denen man noch einmal anruft: nichts gehoert, abgelehnt
 * ohne Umweg, oder eine Antwort, die aus einem anderen Haus stammt.
 *
 * `partial` steht NICHT drin, solange die Auflage notiert ist — eine Auflage
 * ist eine Antwort. Ohne Notiz schon: dann steht da eine Einschraenkung, die
 * niemand kennt.
 */
export function openQuestions(rows: readonly AnswerRow[]): AnswerRow[] {
  return rows.filter((r) => {
    if (r.state === 'pending' || r.state === 'elsewhere') return true
    if (r.state === 'refused') return !r.note
    if (r.state === 'partial') return !r.note
    return false
  })
}

/**
 * Das Blatt, das mitfaehrt: die Frage aus dem Plan, die Antwort des Hauses,
 * und woher die Antwort kommt. Fuenf Spalten, weil die fuenfte („Haus") der
 * ganze Unterschied zwischen einer Erinnerung und einer Behauptung ist.
 */
export function venueAnswerTable(
  rows: readonly AnswerRow[],
  label: (key: string) => string,
): CsvTable {
  return {
    headers: ['Punkt', 'Aus dem Plan', 'Antwort', 'Auflage / Umweg', 'Haus', 'Wer', 'Wann'],
    rows: rows.map((r): CsvCell[] => [
      label(r.key),
      r.planValue ?? '',
      ANSWER_STATE_LABEL[r.state],
      r.note ?? '',
      r.venue ?? '',
      r.by ?? '',
      r.at ?? '',
    ]),
  }
}

/**
 * Die Antwort, die gespeichert wird — mit dem Ort dieses Projekts eingefroren.
 *
 * Der Ort wird BEIM SCHREIBEN gesetzt und nicht beim Lesen aufgeloest: der
 * `siteAddress` des Projekts aendert sich, wenn die Show umzieht, und dann
 * waere die Antwort ploetzlich fuer das neue Haus gegeben. Dasselbe Muster
 * wie `CheckoutLine.ownership` in Bedarf 67 — was reist, wird eingefroren.
 */
export function recordAnswer(
  key: string,
  status: VenueAnswerStatus,
  jetzt: string,
  opts: { note?: string; by?: string; venue?: string } = {},
): VenueAnswer {
  return {
    key,
    status,
    at: jetzt,
    ...(trimmed(opts.note) ? { note: trimmed(opts.note) } : {}),
    ...(trimmed(opts.by) ? { by: trimmed(opts.by) } : {}),
    ...(trimmed(opts.venue) ? { venue: trimmed(opts.venue) } : {}),
  }
}

/**
 * Eine Antwort in die Liste setzen — vorhandene zum selben Punkt wird
 * ersetzt, nicht danebengelegt. Zwei Antworten auf denselben Punkt waeren
 * zwei Wahrheiten, und die spaetere ist die, die gilt.
 */
export function upsertAnswer(
  answers: readonly VenueAnswer[],
  neu: VenueAnswer,
): VenueAnswer[] {
  const out = answers.filter((a) => a.key !== neu.key)
  out.push(neu)
  return out
}

/** Die vier gueltigen Ausgaenge — zur Pruefung beim Laden. */
const STATUS: ReadonlySet<string> = new Set(['granted', 'partial', 'refused', 'pending'])

/**
 * Beim Laden: was keine Antwort ist, wird verworfen und gemeldet.
 *
 * Eine Antwort ohne Punkt-Schluessel gehoert zu keiner Frage; eine mit einem
 * unbekannten Ausgang saehe im Blatt aus wie eine Auskunft und waere keine.
 * Doppelte zum selben Punkt fallen auf die LETZTE zusammen — dieselbe Regel
 * wie in `upsertAnswer`, damit Laden und Schreiben nicht auseinanderlaufen.
 */
export function normaliseVenueAnswers(
  raw: unknown,
  onDrop?: (drop: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): VenueAnswer[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    onDrop?.({ reason: 'missing-required', label: '' })
    return undefined
  }
  const byKey = new Map<string, VenueAnswer>()
  for (const a of raw) {
    const key = trimmed((a as VenueAnswer)?.key)
    const status = (a as VenueAnswer)?.status
    if (!key || !STATUS.has(String(status))) {
      onDrop?.({ reason: 'missing-required', label: key ?? '' })
      continue
    }
    // Die spaetere gewinnt — dieselbe Regel wie in `upsertAnswer`, damit Laden
    // und Schreiben nicht auseinanderlaufen. Gemeldet wird sie trotzdem.
    if (byKey.has(key)) onDrop?.({ reason: 'duplicate-id', label: key })
    byKey.set(key, { ...(a as VenueAnswer), key, status: status as VenueAnswerStatus })
  }
  return [...byKey.values()]
}
