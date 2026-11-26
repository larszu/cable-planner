// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile Ross Video (#1240, Stufe 7). Quelle je Profil: die
// Spezifikationsseite auf rossvideo.com bzw. der Configuration Guide (Black
// Solo, ueber einen Haendler). Gelesen am 26.11.2026.
//
// Ross nennt die Mengen meist als Hoechstausbau („Up to …“, lizenz- oder
// kartenabhaengig). Das Profil traegt diesen Hoechstwert; die Betriebsarten
// SD/HD und UHD bekommen die Grenzen, die die Tabelle je Spalte nennt.
//
// Keyer: Ross zaehlt „Keyers per Full ME: 5 (4 Full Keyers + 1 Transition
// Keyer)“. Als Upstream-Keyer zaehlen die 4 Full Keyers. „MediaStores“ sind
// Kanaele fuer Standbild und Animation und zaehlen als Mediaplayer.
//
// Bewusst LEER, weil die Seiten es nicht nennen:
//   - Downstream-Keyer (Ross hat keine eigenen; MiniMEs uebernehmen das).
//   - MiniMEs: das Modell hat kein Feld dafuer (Werte stehen im Kommentar).
//   - Aux-Busse, Farbgeneratoren, Standbild-Plaetze: keine Anzahl.
//   - Carbonite Black Plus: Mediastores und Makros je Betriebsart (nur ein
//     Wert fuer alle Spalten).
//   - Ultrix: Breakaway, Sperren, Take-Modus (die Spezifikation nennt sie nicht).
//   - NK-3G: Breakaway gilt laut Seite nur im NK-Verbund mit Audio-Routern,
//     nicht fuer das einzelne Geraet.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const CARBONITE_ULTRA = 'https://www.rossvideo.com/products/production-switchers/carbonite-ultra/carbonite-ultra-specifications/'
const CARBONITE_ULTRA_60 = 'https://www.rossvideo.com/products/production-switchers/carbonite-ultra-60/'
const CARBONITE_BLACK = 'https://www.rossvideo.com/products/production-switchers/carbonite-black/carbonite-black-specifications/'
const GRAPHITE = 'https://www.rossvideo.com/products/production-switchers/graphite/graphite-specifications/'
/** Configuration Guide v1.2 (Ross), ueber den Haendler CCI Solutions. */
const BLACK_SOLO = 'https://shop.ccisolutions.com/StoreFront/jsp/pdf/RSV-CB-SOLO-13_configurationGuide.pdf'
const ULTRIX = 'https://www.rossvideo.com/products/routing-systems/ultrix/ultrix-specifications/'
const NK_3G72 = 'https://www.rossvideo.com/products/routing-systems/nk-3g72/'
const NK_3G_SERIES = 'https://www.rossvideo.com/products/routing-systems/nk-3g-series/'

/** Carbonite Ultra: SD/HD 24 Eingaenge, 3 Full MEs (4 MiniMEs); UHD 18, 2 (2 MiniMEs). */
export const PROFILE_ROSS_CARBONITE_ULTRA: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: CARBONITE_ULTRA,
  blocks: { inputs: 24, mixEffects: 3, upstreamKeyersPerMe: 4, mediaPlayers: 4, multiviewers: 4, dves: 8, macros: 256 },
  modes: [
    { id: 'sdhd', label: 'SD/HD', limits: { inputs: 24, mixEffects: 3, mediaPlayers: 4, multiviewers: 4, dves: 8 } },
    { id: 'uhd-only', label: 'UHD', limits: { inputs: 18, mixEffects: 2, mediaPlayers: 2, multiviewers: 2, dves: 4 } },
  ],
}

/** Carbonite Ultra 60: bis 60 Eingaenge (3 I/O-Karten), „6 Keyers“ je Full ME. */
export const PROFILE_ROSS_CARBONITE_ULTRA_60: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: CARBONITE_ULTRA_60,
  blocks: { inputs: 60, mixEffects: 3, upstreamKeyersPerMe: 6, mediaPlayers: 8, multiviewers: 7, dves: 12 },
  modes: [
    { id: 'sdhd', label: 'HD/SD', limits: { inputs: 60, mixEffects: 3, mediaPlayers: 8, multiviewers: 7, dves: 12 } },
    { id: 'uhd-only', label: 'UHD', limits: { inputs: 60, mixEffects: 3, mediaPlayers: 6, multiviewers: 6, dves: 8 } },
  ],
}

/** Carbonite Black Plus, 2-ME-Ausfuehrung: SD/HD 36 Eingaenge, 5 Multiviewer; UHD 9, 1 ME. */
export const PROFILE_ROSS_CARBONITE_BLACK_PLUS_2ME: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: CARBONITE_BLACK,
  blocks: { inputs: 36, mixEffects: 2, upstreamKeyersPerMe: 4, mediaPlayers: 4, multiviewers: 5, dves: 8, macros: 256 },
  modes: [
    { id: 'sdhd', label: 'SD/HD', limits: { inputs: 36, mixEffects: 2, multiviewers: 5, dves: 8 } },
    { id: 'uhd-only', label: 'UHD', limits: { inputs: 9, mixEffects: 1, multiviewers: 1, dves: 2 } },
  ],
}

/** Graphite, groesste Ausfuehrung „13 Input, 2 ME“: 12 SDI + 1 HDMI. */
export const PROFILE_ROSS_GRAPHITE: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: GRAPHITE,
  blocks: { inputs: 13, mixEffects: 2, upstreamKeyersPerMe: 4, mediaPlayers: 4, multiviewers: 2, dves: 4, macros: 256 },
}

/** Carbonite Black Solo: „A 1 ME frame“, 6 SDI + 3 HDMI, Media-Store „Up to 4 independent channels“. */
export const PROFILE_ROSS_CARBONITE_BLACK_SOLO: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: BLACK_SOLO,
  blocks: { inputs: 9, mixEffects: 1, upstreamKeyersPerMe: 4, mediaPlayers: 4, multiviewers: 1, dves: 1 },
}

const VIDEO = { id: 'video', label: 'Video' }
const AUDIO = { id: 'audio', label: 'Audio' }

/** Ultrix: „Video Matrix Size (max)“ und „Audio Matrix Size“ (MADI) je Rahmen. */
const ultrix = (n: number): SwitchingProfile => ({
  role: 'router',
  manufacturerUrl: ULTRIX,
  blocks: { inputs: n },
  outputs: n,
  levels: [VIDEO, AUDIO],
})
export const PROFILE_ROSS_ULTRIX_FR1 = ultrix(36)
export const PROFILE_ROSS_ULTRIX_FR2 = ultrix(72)
export const PROFILE_ROSS_ULTRIX_FR5 = ultrix(160)

/** NK-3G72: „up to 72“ Ein- und Ausgaenge, SDI. */
export const PROFILE_ROSS_NK_3G72: SwitchingProfile = {
  role: 'router',
  manufacturerUrl: NK_3G72,
  blocks: { inputs: 72 },
  outputs: 72,
  levels: [VIDEO],
}

/** NK-3G16: 16 × 16, SDI. */
export const PROFILE_ROSS_NK_3G16: SwitchingProfile = {
  role: 'router',
  manufacturerUrl: NK_3G_SERIES,
  blocks: { inputs: 16 },
  outputs: 16,
  levels: [VIDEO],
}
