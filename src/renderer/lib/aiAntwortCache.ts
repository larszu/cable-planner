// ───────────────────────────────────────────────────────────────────────────
// Dieselbe Frage kostet nur einmal (#1172).
//
// Der billigste Hebel gegen die Rechnung ist die Abfrage, die gar nicht
// stattfindet. „Blackmagic ATEM 4 M/E" hat heute dieselben Buchsen wie
// vorgestern — aber der Knopf fragte das Modell jedes Mal neu: beim zweiten
// Anlegen desselben Geraets, nach einem Undo, nach dem Verwerfen des
// Dialogs, und beim Durchprobieren der Kategorie.
//
// Darum liegt die Antwort hier, verschluesselt mit nichts und gueltig fuer
// 30 Tage, adressiert ueber Anbieter + Modell + Prompt. Das Modell gehoert in
// den Schluessel: wer von `sparsam` auf `genau` umstellt, will eine neue
// Antwort und nicht die alte aus dem Haiku-Lauf.
//
// Bilder und Datenblaetter bleiben draussen (siehe `cacheSchluessel`): ein
// Datenblatt als Data-URI sprengt den `localStorage`, und zwei Fotos
// derselben Front sind nie byteweise gleich — der Treffer kaeme also nie,
// der Platz waere trotzdem weg.
// ───────────────────────────────────────────────────────────────────────────
import type { AiProvider } from './aiModus'

const STORAGE_CACHE = 'cable-planner:ai-antwort-cache'
const STORAGE_AKTIV = 'cable-planner:ai-cache-aktiv'
const MAX_EINTRAEGE = 80
const MAX_ZEICHEN = 20000
const HALTBAR_MS = 30 * 24 * 60 * 60 * 1000

interface CacheEintrag {
  /** Zeitpunkt der Antwort. */
  t: number
  /** Die Antwort im Rohtext, so wie der Aufrufer sie parst. */
  v: string
}

type CacheInhalt = Record<string, CacheEintrag>

export const cacheAktiv = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_AKTIV) !== 'aus'
  } catch {
    return true
  }
}

export const setCacheAktiv = (aktiv: boolean): void => {
  try {
    localStorage.setItem(STORAGE_AKTIV, aktiv ? 'ein' : 'aus')
  } catch {
    /* ignore */
  }
}

/** FNV-1a, 32 bit — reicht fuer einen Cache-Schluessel und braucht kein Paket. */
const hash = (text: string): string => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * Der Schluessel — oder `undefined`, wenn diese Abfrage nicht gecacht wird.
 *
 * Nicht gecacht wird, was Anhaenge mitbringt: Fotos und Datenblaetter sind
 * zu gross fuer den `localStorage` und byteweise selten identisch.
 */
export const cacheSchluessel = (
  provider: AiProvider,
  modell: string,
  prompt: string,
  anhaenge: number,
  system = '',
): string | undefined => {
  if (anhaenge > 0) return undefined
  return `${provider}:${modell}:${hash(system)}:${hash(prompt)}:${prompt.length}`
}

const lies = (): CacheInhalt => {
  try {
    const roh = localStorage.getItem(STORAGE_CACHE)
    const inhalt = roh ? (JSON.parse(roh) as unknown) : {}
    return inhalt && typeof inhalt === 'object' ? (inhalt as CacheInhalt) : {}
  } catch {
    return {}
  }
}

const schreib = (inhalt: CacheInhalt): void => {
  try {
    localStorage.setItem(STORAGE_CACHE, JSON.stringify(inhalt))
  } catch {
    /* Quota voll: dann lieber ohne Cache weiterarbeiten. */
  }
}

export const antwortAusCache = (schluessel: string | undefined): string | undefined => {
  if (!schluessel || !cacheAktiv()) return undefined
  const eintrag = lies()[schluessel]
  if (!eintrag) return undefined
  if (Date.now() - eintrag.t > HALTBAR_MS) return undefined
  return eintrag.v
}

export const antwortInCache = (schluessel: string | undefined, text: string): void => {
  if (!schluessel || !cacheAktiv()) return
  if (!text || text.length > MAX_ZEICHEN) return
  const inhalt = lies()
  inhalt[schluessel] = { t: Date.now(), v: text }
  // Aelteste zuerst raus, damit der Platz nicht am aeltesten Eintrag haengt.
  const paare = Object.entries(inhalt).sort((a, b) => a[1].t - b[1].t)
  const behalten = paare.slice(Math.max(0, paare.length - MAX_EINTRAEGE))
  schreib(Object.fromEntries(behalten))
}

export const cacheGroesse = (): number => Object.keys(lies()).length

export const cacheLeeren = (): void => schreib({})
