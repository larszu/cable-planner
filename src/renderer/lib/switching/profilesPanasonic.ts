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
