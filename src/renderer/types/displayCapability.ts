// ───────────────────────────────────────────────────────────────────────────
// DAS VIRTUELLE EDID (B-47).
//
// Wunsch des Eigentuemers, 2026-09-08: „Auch sind Monitore noch nicht
// intelligent. Man braeuchte quasi auch ein virtuelles EDID."
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS GEMESSEN WURDE
// ═══════════════════════════════════════════════════════════════════════════
//
// Der Begriff EDID kam im gesamten Quelltext NULL mal vor. Ein Monitor trug
// genau ein Feld zu dem, was er kann: `resolution?: string` — eine
// Zeichenkette, mit der nichts gerechnet wird. `types/videoFormat.ts` kennt
// Formate und `SdiCapabilities` fuer die SDI-Seite; fuer Displays gab es kein
// Gegenstueck.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS DAS HIER IST — UND WAS AUSDRUECKLICH NICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// Es ersetzt NICHT die Aushandlung am Kabel; die passiert zwischen zwei
// Geraeten und nicht in einer Planungssoftware. Es beantwortet die Frage, die
// man VORHER stellt: kommt das Bild dort an, das ich schicken will?
//
// UND ES LIEST KEINE EDID-DATEI. Eine ausgelesene EDID ist eine 128-Byte-
// Struktur mit Erweiterungsblocken, und ihre Feldbedeutungen stehen in einer
// Spezifikation, die aus dieser Umgebung nicht erreichbar ist. Sie aus dem
// Gedaechtnis zu entziffern waere genau der Fehler, den Invariante 18 benennt
// — nur schlimmer als bei einem Protokoll: ein falsch gelesenes Byte ergibt
// keine Fehlermeldung, sondern eine plausible Zahl. Ein Geraet bekaeme
// „unterstuetzt 2160p60", weil ein Offset um eins daneben lag, und der Plan
// zeigte einen gruenen Haken auf eine Strecke, die schwarz bleibt.
//
// Also: die Faehigkeiten werden ERKLAERT, von Hand, mit `herkunft` im
// Klartext. `tests/edid.test.ts` haelt fest, dass hier nichts entziffert
// wird, und nennt den Grund — sonst baut der naechste Durchgang einen Parser
// aus dem Gedaechtnis nach und haelt das fuer eine Verbesserung.
//
// ═══════════════════════════════════════════════════════════════════════════
// DREI URTEILE, WIE BEIM ADAPTER
// ═══════════════════════════════════════════════════════════════════════════
//
// `passt` / `passt-nicht` / `offen` — dieselbe Form wie in `types/adapter.ts`
// und aus demselben Grund (Invariante 21). Ein Monitor ohne erklaertes Profil
// ist NICHT „kann alles" und auch nicht „kann nichts": ueber ihn ist nichts
// bekannt, und der Plan sagt genau das.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { VIDEO_FORMATS, type VideoFormatId } from './videoFormat'

/** Bits je Farbkanal. */
export type Farbtiefe = 8 | 10 | 12

export const FARBTIEFEN: Farbtiefe[] = [8, 10, 12]

export const istFarbtiefe = (v: unknown): v is Farbtiefe =>
  typeof v === 'number' && (FARBTIEFEN as number[]).includes(v)

/** Abtastung und Farbmodell, wie sie am Anschluss anliegen. */
export type Farbraum = 'RGB' | 'YCbCr 4:4:4' | 'YCbCr 4:2:2' | 'YCbCr 4:2:0'

export const FARBRAEUME: Farbraum[] = ['RGB', 'YCbCr 4:4:4', 'YCbCr 4:2:2', 'YCbCr 4:2:0']

export const istFarbraum = (v: unknown): v is Farbraum =>
  typeof v === 'string' && (FARBRAEUME as string[]).includes(v)

/** Welche Dynamik-Fassung die Senke annimmt. */
export type Dynamik = 'SDR' | 'HDR10' | 'HLG' | 'Dolby Vision'

export const DYNAMIKEN: Dynamik[] = ['SDR', 'HDR10', 'HLG', 'Dolby Vision']

export const istDynamik = (v: unknown): v is Dynamik =>
  typeof v === 'string' && (DYNAMIKEN as string[]).includes(v)

/**
 * Ein Format, das die Senke erklaertermassen annimmt — mit den Fassungen,
 * in denen sie es annimmt.
 *
 * Die drei Listen sind bewusst NICHT optional-mit-Vorgabe: eine leere Liste
 * heisst „dazu ist nichts erklaert" und fuehrt zu `offen`, nicht zu einem
 * stillen „na klar, 8 Bit RGB SDR". Genau diese Bequemlichkeit waere die
 * geratene Angabe, die wie eine gepruefte aussieht.
 */
export interface SenkenFormat {
  formatId: VideoFormatId
  farbtiefen: Farbtiefe[]
  farbraeume: Farbraum[]
  dynamik: Dynamik[]
}

/**
 * Was eine Senke annimmt. Steht am Geraet unter `senkenprofil`.
 *
 * `herkunft` ist PFLICHT und Klartext — dieselbe Regel wie bei der Farbnorm
 * (Invariante 22) und den Protokoll-Vorlagen (Invariante 18). Ohne sie kann
 * niemand nachsehen, ob das Profil zu dem Geraet gehoert, das dort steht:
 * „aus dem Handbuch, Seite 41" und „hat der Kollege mal gesagt" sind zwei
 * verschiedene Auskuenfte, und die Anzeige zeigt beide gleich.
 */
export interface Senkenprofil {
  /** Woher die Angaben stammen. Klartext, kein Verweis. */
  herkunft: string
  formate: SenkenFormat[]
  notiz?: string
}

/** Was am Anschluss anliegen soll. */
export interface Bildwunsch {
  formatId: VideoFormatId
  /** Nicht gesetzt heisst „nicht festgelegt" — dann wird darueber nicht geurteilt. */
  farbtiefe?: Farbtiefe
  farbraum?: Farbraum
  dynamik?: Dynamik
}

export type BildUrteilArt = 'passt' | 'passt-nicht' | 'offen'

export interface BildUrteil {
  art: BildUrteilArt
  text: string
}

/**
 * Nimmt diese Senke dieses Bild an?
 *
 * REIHENFOLGE WIE BEIM ADAPTER: zuerst das, was ein BEFUND ist (das Format
 * steht nicht im Profil, die verlangte Fassung fehlt), dann das, was nur eine
 * fehlende ANGABE ist. Sonst verdeckte ein nicht eingetragener Farbraum ein
 * Format, das die Senke gar nicht kennt.
 */
export const beurteileBild = (
  profil: Senkenprofil | undefined,
  wunsch: Bildwunsch,
  senkenName: string,
): BildUrteil => {
  if (!profil) {
    return {
      art: 'offen',
      text: `${senkenName}: es ist nicht erklärt, welche Formate dieses Gerät annimmt. Ob ${wunsch.formatId} ankommt, weiss der Plan nicht.`,
    }
  }

  const treffer = profil.formate.find((f) => f.formatId === wunsch.formatId)
  if (!treffer) {
    return {
      art: 'passt-nicht',
      text: `${senkenName} nimmt ${wunsch.formatId} nicht an — im erklärten Profil steht es nicht (${profil.formate.length} Format(e) erklärt).`,
    }
  }

  // Die drei Fassungen. Je Achse gilt: nichts gewuenscht -> nicht geurteilt;
  // nichts erklaert -> `offen`; erklaert und nicht dabei -> Befund.
  const achsen: Array<[string, string | number | undefined, Array<string | number>]> = [
    ['Farbtiefe', wunsch.farbtiefe, treffer.farbtiefen],
    ['Farbraum', wunsch.farbraum, treffer.farbraeume],
    ['Dynamik', wunsch.dynamik, treffer.dynamik],
  ]

  for (const [name, gewuenscht, erklaert] of achsen) {
    if (gewuenscht === undefined) continue
    if (erklaert.length === 0) continue
    if (!erklaert.includes(gewuenscht)) {
      return {
        art: 'passt-nicht',
        text: `${senkenName} nimmt ${wunsch.formatId} an, aber nicht mit ${name} ${gewuenscht} — erklärt sind: ${erklaert.join(', ')}.`,
      }
    }
  }

  for (const [name, gewuenscht, erklaert] of achsen) {
    if (gewuenscht === undefined) continue
    if (erklaert.length === 0) {
      return {
        art: 'offen',
        text: `${senkenName} nimmt ${wunsch.formatId} an, aber zur ${name} ist nichts erklärt. Ob ${gewuenscht} ankommt, weiss der Plan nicht.`,
      }
    }
  }

  return { art: 'passt', text: `${senkenName} nimmt ${wunsch.formatId} an.` }
}

// ─── SCHEMA-HEILUNG ────────────────────────────────────────────────────────
//
// Wie beim Adapter (B-46) und bei der Farbnorm (B-45): ein halber Datensatz
// darf NICHT in die freundliche Richtung fallen. Ein Profil ohne `herkunft`
// wird verworfen — es stuende sonst am Geraet wie eine gepruefte Angabe, und
// niemand koennte nachlesen, woher sie kommt.

/**
 * Die gueltigen Format-Ids — direkt aus dem Katalog.
 *
 * DIE ERSTE FASSUNG WAR EINE MODUL-NEBENWIRKUNG: `videoFormat.ts` rief beim
 * Laden `setzeBekannteFormate(...)`. Das greift nur, wenn jenes Modul vorher
 * geladen wurde — und wo nicht, nahm die Heilung JEDES Format an, still und
 * in die freundliche Richtung. Ein Verweis auf den Katalog kann das nicht.
 */
const bekannteFormate = new Set<string>(VIDEO_FORMATS.map((f) => f.id))

export const normalisiereSenkenFormat = (roh: unknown): SenkenFormat | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (typeof o.formatId !== 'string') return undefined
  // Ein Format, das dieser Stand nicht kennt, faellt weg: die Anzeige
  // schluege sonst in `videoFormatById` ins Leere und zeigte eine Zeile ohne
  // Namen — die aussaehe, als koenne das Geraet etwas Unbenanntes.
  if (!bekannteFormate.has(o.formatId)) return undefined
  return {
    formatId: o.formatId as VideoFormatId,
    farbtiefen: Array.isArray(o.farbtiefen) ? o.farbtiefen.filter(istFarbtiefe) : [],
    farbraeume: Array.isArray(o.farbraeume) ? o.farbraeume.filter(istFarbraum) : [],
    dynamik: Array.isArray(o.dynamik) ? o.dynamik.filter(istDynamik) : [],
  }
}

export const normalisiereSenkenprofil = (roh: unknown): Senkenprofil | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  if (typeof o.herkunft !== 'string' || !o.herkunft.trim()) return undefined
  const formate = Array.isArray(o.formate)
    ? o.formate
        .map(normalisiereSenkenFormat)
        .filter((f): f is SenkenFormat => !!f)
    : []
  return {
    herkunft: o.herkunft.trim(),
    formate,
    ...(typeof o.notiz === 'string' && o.notiz.trim() ? { notiz: o.notiz.trim() } : {}),
  }
}
