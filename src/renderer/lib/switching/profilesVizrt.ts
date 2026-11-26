// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile Vizrt TriCaster (#1240, Stufe 7). Quelle je Profil: die
// archivierte Tech-Specs-Seite auf vizrt.com (die Live-Seiten sind
// umgezogen). Gelesen am 26.11.2026.
//
// Bewusst LEER: Upstream-Keyer (die Seiten zaehlen „input keyers“ je
// Quelle und „M/E keyers“ ohne Bezug auf Reihe oder Summe), Aux,
// Standbilder (nur „media buffers“), Makros (ohne Anzahl).
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const TS_2_ELITE =
  'https://web.archive.org/web/20251205210709/https://www.vizrt.com/products/tricaster/tricaster-2-elite/tech-specs/'
const TS_MINI_4K =
  'https://web.archive.org/web/20250125084503/https://www.vizrt.com/products/tricaster/tricaster-mini-4k/tech-specs/'

/** „32 x simultaneous external video inputs“, „8 x M/E buses“, „4 x DSK channels“, „5 x media players“, „4 x multiviewer outputs“. */
export const PROFILE_TRICASTER_2_ELITE: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: TS_2_ELITE,
  blocks: { inputs: 32, mixEffects: 8, downstreamKeyers: 4, mediaPlayers: 5, multiviewers: 4 },
}

/** „8 x IP video inputs via NDI“, „4 x M/E buses“, „2 x DSK channels“, „4 x media players“. */
export const PROFILE_TRICASTER_MINI_4K: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: TS_MINI_4K,
  blocks: { inputs: 8, mixEffects: 4, downstreamKeyers: 2, mediaPlayers: 4 },
}
