// ───────────────────────────────────────────────────────────────────────────
// Die Gebaeude-Datei lesen (`avplan-facility`)
//
// Der Leser zum Format, das der `facility-planner` schreibt. Er nimmt aus der
// Datei GENAU die vier Auskuenfte, die der Plan braucht (siehe
// `types/hausAuskunft.ts`), und laesst den Rest liegen: Verteilungen,
// Stromkreise, Trassen, Maengel gehoeren dem Haus und nicht der Show.
//
// ─── WAS DIESER LESER NICHT TUT ────────────────────────────────────────────
//
//  1. ER ERFINDET NICHTS. Fehlt `dauerleistungW`, bleibt es leer — es wird
//     nicht aus `absicherungA` gerechnet. Fehlt `geschaltet`, bleibt es
//     `undefined` und wird nicht `false`. „Das Haus sagt nichts dazu" ist
//     eine andere Aussage als „nein", und im Plan-Check entscheidet der
//     Unterschied zwischen einer Warnung und Schweigen.
//  2. ER LIEST KEINE FREMDE DATEI HALB. Falscher Marker oder eine neuere
//     Fassung → `null`. Eine halb gelesene Gebaeude-Auskunft ist gefaehrlicher
//     als gar keine: die fehlenden Felder sind Angaben ueber Strom.
//  3. ER SCHREIBT NICHT ZURUECK. Es gibt in diesem Repo keinen Weg zum
//     Gebaeude; der einzige Rueckweg ist `mangelMelden` im anderen Werkzeug.
// ───────────────────────────────────────────────────────────────────────────
import type {
  HausAdressart,
  HausAnschlussart,
  HausAuskunft,
  HausKlinke,
  HausPunkt,
  HausRaum,
  HausSteuersystem,
  HausStrecke,
} from '../types/hausAuskunft'

export const FACILITY_FORMAT = 'avplan-facility'

/**
 * Die hoechste Fassung, die dieser Leser versteht.
 *
 * Sie muss mit `FACILITY_FORMAT_VERSION` im `facility-planner`
 * uebereinstimmen. Eine neuere Datei wird abgewiesen — nicht aus Strenge,
 * sondern weil die Felder, die dieser Leser dann nicht kennt, Auskuenfte
 * ueber Strom sind.
 */
export const FACILITY_FORMAT_VERSION = 1

const ANSCHLUSSARTEN: HausAnschlussart[] = ['cee63', 'cee32', 'cee16', 'powerlock', 'klemme', 'schuko']
const SYSTEME: HausSteuersystem[] = ['knx', 'dali', 'crestron', 'vissonic', 'sonstige']
const ADRESSARTEN: HausAdressart[] = ['kurz', 'gruppe', 'broadcast']

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

const zahl = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/** `undefined` bleibt `undefined` — hier NICHT auf `false` ziehen. */
const jaNein = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

const leseRaum = (roh: unknown): HausRaum | null => {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Record<string, unknown>
  const id = text(r.id)
  const name = text(r.name)
  if (!id || !name) return null
  return { id, name, hausbezeichner: text(r.hausbezeichner) ?? '' }
}

const lesePunkt = (roh: unknown): HausPunkt | null => {
  if (!roh || typeof roh !== 'object') return null
  const p = roh as Record<string, unknown>
  const id = text(p.id)
  const bezeichnung = text(p.bezeichnung)
  const raumId = text(p.raumId)
  const anschlussart = ANSCHLUSSARTEN.find((a) => a === p.anschlussart)
  const absicherungA = zahl(p.absicherungA)
  // Ohne diese fuenf ist es kein Anschlusspunkt, sondern eine Zeile.
  if (!id || !bezeichnung || !raumId || !anschlussart || absicherungA === undefined) return null
  const dauerleistungW = zahl(p.dauerleistungW)
  return {
    id,
    bezeichnung,
    art: p.art === 'dose' ? 'dose' : 'einspeisung',
    raumId,
    anschlussart,
    absicherungA,
    ...(dauerleistungW !== undefined && dauerleistungW > 0 ? { dauerleistungW } : {}),
    ...(jaNein(p.geschaltet) !== undefined ? { geschaltet: jaNein(p.geschaltet) } : {}),
    ...(jaNein(p.gedimmt) !== undefined ? { gedimmt: jaNein(p.gedimmt) } : {}),
    ...(text(p.hinweis) ? { hinweis: text(p.hinweis) } : {}),
  }
}

const leseKlinke = (roh: unknown): HausKlinke | null => {
  if (!roh || typeof roh !== 'object') return null
  const k = roh as Record<string, unknown>
  const id = text(k.id)
  const adresse = text(k.adresse)
  const bedeutung = text(k.bedeutung)
  const system = SYSTEME.find((s) => s === k.system)
  // Eine Adresse OHNE Bedeutung ist eine Nummer, die jemand schaltet, ohne zu
  // wissen, was passiert. Sie faellt weg — dieselbe Regel wie drueben, wo
  // beide Felder Pflicht sind.
  if (!id || !adresse || !bedeutung || !system) return null
  const adressart = ADRESSARTEN.find((a) => a === k.adressart)
  return {
    id,
    system,
    adresse,
    ...(adressart ? { adressart } : {}),
    richtung: k.richtung === 'lesen' ? 'lesen' : 'schalten',
    bedeutung,
  }
}

const leseStrecke = (roh: unknown): HausStrecke | null => {
  if (!roh || typeof roh !== 'object') return null
  const s = roh as Record<string, unknown>
  const id = text(s.id)
  const bezeichnung = text(s.bezeichnung)
  if (!id || !bezeichnung) return null
  return { id, bezeichnung }
}

const liste = <T>(v: unknown, lies: (roh: unknown) => T | null): T[] =>
  Array.isArray(v) ? v.map(lies).filter((x): x is T => x !== null) : []

/**
 * Eine `.avfacility`-Datei zu der Auskunft machen, die der Plan fuehrt.
 *
 * `quelle` und `gelesenAm` kommen von aussen herein: dieses Modul kennt weder
 * Uhr noch Dateisystem, und die Abschrift ohne Datum saehe aus wie der
 * Zustand von heute.
 */
export const leseHausDatei = (
  json: string,
  meta: { quelle: string; gelesenAm: string },
): HausAuskunft | null => {
  let daten: unknown
  try {
    daten = JSON.parse(json)
  } catch {
    return null
  }
  if (!daten || typeof daten !== 'object') return null
  const f = daten as Record<string, unknown>
  if (f.format !== FACILITY_FORMAT) return null
  const version = zahl(f.version)
  if (version === undefined || version > FACILITY_FORMAT_VERSION) return null
  const g = f.gebaeude
  if (!g || typeof g !== 'object') return null
  const gg = g as Record<string, unknown>
  return {
    name: text(gg.name) ?? 'Gebäude',
    gelesenAm: meta.gelesenAm,
    quelle: meta.quelle,
    raeume: liste(gg.raeume, leseRaum),
    punkte: liste(gg.punkte, lesePunkt),
    klinken: liste(gg.klinken, leseKlinke),
    strecken: liste(gg.strecken, leseStrecke),
  }
}
