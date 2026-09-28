// ───────────────────────────────────────────────────────────────────────────
// Katalog-Typ aus dem Namen — nur wenn er EINDEUTIG ist (2026-09-28).
//
// Nutzer-Meldung: „was soll 'katalog typ' bedeuten? ist das nicht
// automatisch?" Bis hierher bekam ein Geraet seine `deviceTypeId` nur, wenn
// es aus einem Katalog-Template entstand. Alles andere — von Hand angelegt,
// Rentman, GraphML, NetBox, Bestandsaufnahme, alte Projekte — stand ohne da,
// und der Nutzer sollte sie oben in der Seitenleiste selbst aussuchen.
//
// WAS HIER ZAEHLT: ein Name, der nach dem Normalisieren GENAU einem
// Katalog-Eintrag entspricht. Normalisiert wird Schreibweise (Gross/klein,
// Satzzeichen, Akzente), nicht Bedeutung. Dazu kommen die belegten
// Nebennamen: der Modellname ohne das fuehrende Herstellerwort
// („ATEM Mini Pro" fuer „Blackmagic ATEM Mini Pro"), die Artikelnummer in
// Klammern („USW-16-PoE"), und die alten Namen aus `LEGACY_TEMPLATE_RENAMES`.
//
// WAS NICHT: Teilstring-Treffer und Aehnlichkeit. Passen zwei Eintraege,
// bleibt das Feld leer. Ein falscher Typ ist teurer als keiner — er zieht
// Datenblatt-Link, Rolle (ATEM/Videohub) und Lager-Deckung eines anderen
// Modells an das Geraet, und niemand sieht, dass es geraten war. Die
// unscharfen Treffer gibt es nur als VORSCHLAG in der Seitenleiste
// (`katalogTypVorschlaege`), den der Nutzer uebernimmt oder nicht.
// ───────────────────────────────────────────────────────────────────────────
import { listDeviceTypes, resolveDeviceType, type DeviceTypeChoice } from './deviceTypeRegistry'
import { LEGACY_TEMPLATE_RENAMES } from './templateRenames'

/** Schreibweise angleichen: klein, ohne Akzente, Satzzeichen als Leerzeichen. */
export const katalogSchluessel = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\*/g, '')
    // „Ninja V+" ist ein anderes Modell als „Ninja V": das Plus traegt Bedeutung.
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Herstellernamen, die in Fremdquellen anders heissen als im Katalog. */
const HERSTELLER_GLEICH: ReadonlyArray<[RegExp, string]> = [
  [/^blackmagic design\b/, 'blackmagic'],
  [/^bmd\b/, 'blackmagic'],
  [/^ubiquiti( networks)?\b/, 'unifi'],
]

const herstellerAngleichen = (key: string): string => {
  for (const [re, ersatz] of HERSTELLER_GLEICH) {
    if (re.test(key)) return key.replace(re, ersatz)
  }
  return key
}

/**
 * Ein Rest ist nur dann ein Name, wenn er fuer sich etwas bezeichnet: eine
 * Ziffer darin oder mindestens zwei Woerter. „Pro", „Mini", „Switch" allein
 * waeren ein Treffer auf alles.
 */
const traegtAlsName = (key: string): boolean =>
  key.length >= 3 && (/\d/.test(key) || key.split(' ').length >= 2)

let index: Map<string, Set<string>> | null = null

const eintragen = (map: Map<string, Set<string>>, key: string, id: string) => {
  if (!key) return
  const set = map.get(key) ?? new Set<string>()
  set.add(id)
  map.set(key, set)
}

// `vergeben`: die vollen Namen ALLER Katalog-Eintraege. Ein abgeleiteter
// Nebenname, der dort steht, gehoert einem anderen Eintrag — „Canon CR-N300
// (weiß)" ohne Klammer ist „Canon CR-N300", und beide hiessen sonst gleich.
const nebennamen = (name: string, vergeben?: ReadonlySet<string>): string[] => {
  const voll = katalogSchluessel(name)
  const out = [voll]
  const frei = (k: string) => !vergeben?.has(k)
  // Artikelnummer in Klammern: „UniFi Switch 16 PoE (USW-16-PoE)".
  const klammer = /\(([^)]+)\)/.exec(name)
  if (klammer) {
    const nr = katalogSchluessel(klammer[1])
    if (traegtAlsName(nr) && frei(nr)) out.push(nr)
    const ohne = katalogSchluessel(name.replace(/\([^)]*\)/g, ' '))
    if (ohne && ohne !== voll && frei(ohne)) out.push(ohne)
  }
  // Ohne das fuehrende Herstellerwort.
  for (const k of [...out]) {
    const rest = k.split(' ').slice(1).join(' ')
    if (traegtAlsName(rest) && frei(rest)) out.push(rest)
  }
  return out
}

const baueIndex = (): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>()
  const typen = listDeviceTypes()
  const idNachName = new Map<string, string[]>()
  const vergeben = new Set(typen.map((t) => katalogSchluessel(t.name)))
  for (const t of typen) {
    for (const k of nebennamen(t.name, vergeben)) eintragen(map, k, t.id)
    idNachName.set(t.name, [...(idNachName.get(t.name) ?? []), t.id])
  }
  for (const [alt, neu] of Object.entries(LEGACY_TEMPLATE_RENAMES)) {
    for (const id of idNachName.get(neu) ?? []) {
      for (const k of nebennamen(alt)) eintragen(map, k, id)
    }
  }
  return map
}

export interface KatalogAnfrage {
  name?: string
  manufacturer?: string
  model?: string
}

const anfrageSchluessel = (q: KatalogAnfrage): string[] => {
  const keys: string[] = []
  const add = (s: string | undefined) => {
    if (!s) return
    const k = katalogSchluessel(s)
    if (!k) return
    keys.push(k)
    const angeglichen = herstellerAngleichen(k)
    if (angeglichen !== k) keys.push(angeglichen)
  }
  if (q.manufacturer && q.model) add(`${q.manufacturer} ${q.model}`)
  add(q.model)
  add(q.name)
  return keys
}

/**
 * Alle Katalog-Typen, deren Name (oder belegter Nebenname) nach dem
 * Normalisieren gleich lautet. Leer, wenn nichts passt.
 */
export const katalogTypKandidaten = (q: KatalogAnfrage): string[] => {
  index ??= baueIndex()
  const ids = new Set<string>()
  for (const k of anfrageSchluessel(q)) {
    for (const id of index.get(k) ?? []) ids.add(id)
  }
  return [...ids]
}

/** Die eine `deviceTypeId`, wenn genau ein Katalog-Eintrag passt — sonst undefined. */
export const eindeutigerKatalogTyp = (q: KatalogAnfrage): string | undefined => {
  const ids = katalogTypKandidaten(q)
  return ids.length === 1 ? ids[0] : undefined
}

/**
 * Das Geraet mit Katalog-Typ, wenn es noch keinen hat und der Name eindeutig
 * ist. Sonst dasselbe Objekt (Referenz-gleich — Aufrufer koennen daran
 * erkennen, dass nichts geschah).
 *
 * Nur die IDENTITAET: Ports, Masse, Leistung bleiben, wie sie sind. Ein
 * importiertes Geraet traegt die Belegung seiner Quelle; sie still gegen das
 * Katalog-Datenblatt zu tauschen waere eine andere Aktion.
 */
export const mitKatalogTyp = <T extends { name: string; deviceTypeId?: string; subtitle?: string }>(
  item: T,
  extra?: { manufacturer?: string; model?: string },
): T => {
  if (item.deviceTypeId) return item
  const id =
    eindeutigerKatalogTyp({ name: item.name, ...extra }) ??
    // Der Untertitel traegt bei NetBox/Rentman oft das Modell, wenn der Name
    // der Standort-Name ist („Cam 1" / „URSA Broadcast G2"). Nur als zweiter
    // Versuch: der Name hat Vorrang.
    (katalogTypKandidaten({ name: item.name, ...extra }).length === 0 && item.subtitle
      ? eindeutigerKatalogTyp({ name: item.subtitle })
      : undefined)
  return id ? { ...item, deviceTypeId: id } : item
}

/**
 * Vorschlaege fuer die Seitenleiste: zuerst die exakten Kandidaten (auch
 * mehrere), dann Katalog-Namen, die im Geraetenamen vorkommen oder ihn
 * enthalten. Hoechstens `max`. NIE automatisch uebernommen.
 */
export const katalogTypVorschlaege = (
  q: KatalogAnfrage,
  max = 3,
): DeviceTypeChoice[] => {
  const alle = listDeviceTypes()
  const byId = new Map(alle.map((t) => [t.id, t]))
  const out: DeviceTypeChoice[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    const t = byId.get(id)
    if (!t || seen.has(id)) return
    seen.add(id)
    out.push(t)
  }
  for (const id of katalogTypKandidaten(q)) push(id)
  const keys = anfrageSchluessel(q).filter((k) => k.length >= 3)
  if (keys.length > 0 && out.length < max) {
    const treffer: Array<{ id: string; score: number }> = []
    for (const t of alle) {
      if (seen.has(t.id)) continue
      const namen = nebennamen(t.name).filter(traegtAlsName)
      let best = 0
      for (const n of namen) {
        for (const k of keys) {
          const enthalten = ` ${k} `.includes(` ${n} `) || ` ${n} `.includes(` ${k} `)
          if (enthalten && traegtAlsName(k)) best = Math.max(best, Math.min(n.length, k.length))
        }
      }
      if (best > 0) treffer.push({ id: t.id, score: best })
    }
    treffer.sort((a, b) => b.score - a.score)
    for (const tr of treffer) {
      if (out.length >= max) break
      push(tr.id)
    }
  }
  return out.slice(0, max)
}

/** Nur fuer Tests: den Index neu bauen (Katalog-Aenderung im selben Lauf). */
export const _resetKatalogIndex = () => {
  index = null
}

export { resolveDeviceType }
