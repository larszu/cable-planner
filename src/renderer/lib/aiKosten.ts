// ───────────────────────────────────────────────────────────────────────────
// Was die KI-Abfragen gekostet haben (#1172).
//
// WARUM DAS MITLAEUFT. Die Meldung, die den Umbau ausgeloest hat, lautete
// „ca 2,50 dollar pro 10 geraete" — eine Zahl von der Abrechnung des
// Anbieters, einen Tag spaeter und ohne Bezug darauf, welcher Klick sie
// verursacht hat. Ohne eigene Zaehlung ist jede Sparmassnahme ein Glaube:
// man sieht erst am Monatsende, ob sie gewirkt hat.
//
// Jede Antwort der drei Anbieter bringt ihre Token-Zahlen mit. Die werden
// hier verbucht, mit der Preistabelle aus `aiModus.ts` multipliziert und in
// `localStorage` gehalten — die letzten 200 Abfragen, damit die Oberflaeche
// „12 Abfragen, ca. $0,09" sagen kann und nicht „sollte jetzt guenstiger
// sein".
//
// Die Token-Zahlen sind gemessen, die Preise geschaetzt (siehe `AI_PREISE`).
// Darum heisst das Feld `usd` und nicht `betrag`, und in der Oberflaeche
// steht immer „ca.".
// ───────────────────────────────────────────────────────────────────────────
import { preisFuer, type AiProvider } from './aiModus'

export interface AiVerbrauch {
  /** Zeitpunkt in ms seit Epoch. */
  zeit: number
  provider: AiProvider
  modell: string
  /** Eingabe-Token zum vollen Preis. */
  ein: number
  /** Ausgabe-Token (bei Claude einschliesslich der Denk-Token). */
  aus: number
  /** Aus dem Prompt-Cache gelesene Token. */
  cache: number
  /** In den Prompt-Cache geschriebene Token. */
  cacheNeu: number
  /** Ausgefuehrte Websuchen. */
  suchen: number
  /** Geschaetzte Kosten in USD. Undefined, wenn das Modell keinen Preis hat. */
  usd?: number
}

export type AiVerbrauchRoh = Omit<AiVerbrauch, 'zeit' | 'usd'>

const STORAGE_VERBRAUCH = 'cable-planner:ai-verbrauch'
const MAX_EINTRAEGE = 200

/** Die Oberflaeche hoert darauf, statt im Takt nachzusehen. */
export const AI_VERBRAUCH_EVENT = 'cable-planner:ai-verbrauch'

/**
 * Kosten einer Abfrage. Cache-Schreiben kostet bei Anthropic 1,25x Eingabe;
 * die anderen Anbieter rechnen es nicht getrennt ab, dort ist das Feld 0 und
 * der Faktor damit wirkungslos.
 */
export const kostenSchaetzen = (v: AiVerbrauchRoh): number | undefined => {
  const p = preisFuer(v.modell)
  if (!p) return undefined
  return (
    (v.ein / 1e6) * p.ein +
    (v.aus / 1e6) * p.aus +
    (v.cache / 1e6) * p.cache +
    (v.cacheNeu / 1e6) * p.ein * 1.25 +
    v.suchen * p.suche
  )
}

const lies = (): AiVerbrauch[] => {
  try {
    const roh = localStorage.getItem(STORAGE_VERBRAUCH)
    const liste = roh ? (JSON.parse(roh) as unknown) : []
    return Array.isArray(liste) ? (liste as AiVerbrauch[]) : []
  } catch {
    return []
  }
}

const schreib = (liste: AiVerbrauch[]): void => {
  try {
    localStorage.setItem(STORAGE_VERBRAUCH, JSON.stringify(liste.slice(-MAX_EINTRAEGE)))
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(AI_VERBRAUCH_EVENT))
  } catch {
    /* kein window (Test, Node) */
  }
}

/** Eine gelaufene Abfrage verbuchen. Liefert den Eintrag samt Schaetzung. */
export const verbuchen = (roh: AiVerbrauchRoh): AiVerbrauch => {
  const eintrag: AiVerbrauch = { ...roh, zeit: Date.now(), usd: kostenSchaetzen(roh) }
  schreib([...lies(), eintrag])
  return eintrag
}

export const verbrauchListe = (): AiVerbrauch[] => lies()

export const letzterVerbrauch = (): AiVerbrauch | undefined => lies().at(-1)

export interface AiVerbrauchSumme {
  abfragen: number
  ein: number
  aus: number
  cache: number
  cacheNeu: number
  suchen: number
  usd: number
  /** Modelle ohne Preis in der Tabelle — dann ist `usd` eine Untergrenze. */
  unvollstaendig: boolean
}

export const verbrauchSumme = (liste: AiVerbrauch[] = lies()): AiVerbrauchSumme =>
  liste.reduce<AiVerbrauchSumme>(
    (s, v) => ({
      abfragen: s.abfragen + 1,
      ein: s.ein + v.ein,
      aus: s.aus + v.aus,
      cache: s.cache + v.cache,
      cacheNeu: s.cacheNeu + v.cacheNeu,
      suchen: s.suchen + v.suchen,
      usd: s.usd + (v.usd ?? 0),
      unvollstaendig: s.unvollstaendig || v.usd === undefined,
    }),
    { abfragen: 0, ein: 0, aus: 0, cache: 0, cacheNeu: 0, suchen: 0, usd: 0, unvollstaendig: false },
  )

export const verbrauchLeeren = (): void => schreib([])

/** „$0,0043" bzw. „$1,27" — immer mit „ca." davor in der Oberflaeche. */
export const usdFormat = (usd: number): string =>
  usd >= 1 ? `$${usd.toFixed(2)}` : `$${usd.toFixed(4)}`
