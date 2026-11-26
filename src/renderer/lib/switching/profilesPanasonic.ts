// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofil Panasonic AV-UHS500 (#1240, Stufe 7). Quellen: Spec-Seite
// und Produktseite auf pro-av.panasonic.net. Gelesen am 26.11.2026.
//
// Eingaenge: „SDI IN 1 to SDI IN 8 … 8 lines“, HDMI IN 1/2 schliessen SDI
// IN 1/2 aus („SDI IN 1/2 excludes HDMI IN 1/2“) — gleichzeitig nutzbar
// sind damit 8 (ohne Options-Karte).
//
// Bewusst LEER: M/E-Zahl, Upstream-Keyer („Five Keyers“ ohne Aufteilung),
// Mediaplayer, Standbilder, Makros.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const SPEC = 'https://pro-av.panasonic.net/en/products/av-uhs500/spec.html'
const PRODUCT = 'https://pro-av.panasonic.net/en/products/av-uhs500/'

/** „AUX1 to AUX4“, „MV1 to MV2“ (Spec); „DSK 1 and 2“ (Produktseite). */
export const PROFILE_PANASONIC_AV_UHS500: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: SPEC,
  sources: { downstreamKeyers: PRODUCT },
  blocks: { inputs: 8, downstreamKeyers: 2, aux: 4, multiviewers: 2 },
}

// ─── AV-HS410 und AV-HS6000 (#1240, Stufe 7) ─────────────────────────────
// AV-HS410: Operating Instructions „Basics“ (PDF, Panasonic). AV-HS6000:
// Spec- und Features-Seite auf pro-av.panasonic.net. Gelesen am 26.11.2026.
//
// Bewusst LEER: Keyer-Zahl des AV-HS410 (nur Key-Arten genannt),
// Farbgeneratoren, Makros/Events, Mediaplayer (Panasonic zaehlt Still- und
// Clip-Speicher getrennt, das Modell kennt nur Mediaplayer), DVEs des
// AV-HS6000 (nur „for each ME“ ohne Summe). AV-UHS5M1G ist eine
// Eingangskarte des AV-UHS500, kein eigener Mischer.

const HS6000_FEATURES = 'https://pro-av.panasonic.net/en/products/av-hs6000/features.html'

/**
 * AV-HS410: „ME number 1ME“, „Video inputs (13 signal lines, maximum)“, „One
 * DSK line“, „two PinP lines and four AUX bus lines“, „One channel is
 * provided for the multi view display function“.
 */
export const PROFILE_PANASONIC_AV_HS410: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://eww.pass.panasonic.co.jp/pro-av/support/dload/hs410_ver201/operation_base_e.pdf',
  blocks: { inputs: 13, mixEffects: 1, downstreamKeyers: 1, dves: 2, aux: 4, multiviewers: 1 },
}

/**
 * AV-HS6000: „ME Number 2 ME“ (Spec); „34 inputs in total, with 32 SDI and
 * two DVI inputs“, „4ch per ME (8ch in total), plus 4ch of DSK“, Tabelle je
 * Betriebsart Standard / 3G / 4K: SDI-Eingaenge 32/16/8, DSK 4/2/2,
 * MultiViewer 4/2/2, AUX 16/8/8; die ME2-Funktionen sind in 3G und 4K
 * „Not possible“ (Features).
 */
export const PROFILE_PANASONIC_AV_HS6000: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: 'https://pro-av.panasonic.net/en/products/av-hs6000/spec.html',
  sources: {
    inputs: HS6000_FEATURES,
    upstreamKeyersPerMe: HS6000_FEATURES,
    downstreamKeyers: HS6000_FEATURES,
    aux: HS6000_FEATURES,
    multiviewers: HS6000_FEATURES,
  },
  blocks: { inputs: 34, mixEffects: 2, upstreamKeyersPerMe: 4, downstreamKeyers: 4, aux: 16, multiviewers: 4 },
  modes: [
    { id: 'standard', label: 'Standard', limits: { inputs: 34, downstreamKeyers: 4, aux: 16, multiviewers: 4 } },
    { id: '3g', label: '3G', limits: { inputs: 16, mixEffects: 1, downstreamKeyers: 2, aux: 8, multiviewers: 2 } },
    { id: '4k', label: '4K', limits: { inputs: 8, mixEffects: 1, downstreamKeyers: 2, aux: 8, multiviewers: 2 } },
  ],
}
