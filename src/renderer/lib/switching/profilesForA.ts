// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofil For-A HVS-490 (#1240, Stufe 7). Quelle: Produktseite auf
// for-a.com. Gelesen am 26.11.2026.
//
// Eingaenge: „16 video inputs are provided, expandable to 40“; im 4K-Betrieb
// „up to 10 4K inputs“ und „1 M/E + 1 MELite“. Keyer: „4 keyers + 4
// FLEXaKEYs“ je M/E-Bus; gezaehlt werden die 4 Keyer der M/E.
//
// Bewusst LEER: Downstream-Keyer, Mediaplayer, Standbilder, DVEs, Makros
// (die Seite nennt keine Anzahl); MELites hat das Modell kein Feld (2).
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const PRODUCT = 'https://www.for-a.com/products/hvs490/'

/** „2 M/Es“, „Aux buses (12)“, „three displays of multi viewer output“. */
export const PROFILE_FORA_HVS_490: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: PRODUCT,
  blocks: { inputs: 40, mixEffects: 2, upstreamKeyersPerMe: 4, aux: 12, multiviewers: 3 },
  modes: [
    { id: 'hd', label: 'HD', limits: { inputs: 40, mixEffects: 2 } },
    { id: '4k', label: '4K', limits: { inputs: 10, mixEffects: 1 } },
  ],
}
