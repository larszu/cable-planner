// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile Roland (#1240, Stufe 7). Quelle je Profil: die Seite
// „Specifications“ auf proav.roland.com. Gelesen am 26.11.2026.
//
// Zuordnung: „Number of Video Channels“ = Eingaenge; „Keyer x n“ =
// Upstream-Keyer; „DSK x n“ (ohne Zahl: einer) = Downstream-Keyer;
// „PinP x n“ = DVE-Ebenen; „stored up to n files in the internal memory“
// (Abschnitt Still Image) = Standbild-Plaetze; „Macro Control (n types)“ =
// Makros.
//
// Bewusst LEER, weil die Seiten es nicht nennen:
//   - M/E-Zahl (ausser V-1200HD), Mediaplayer, Farbgeneratoren.
//   - Aux und Multiviewer, wo die Seite nur „Multi-View (3 types)“ oder
//     „Aux“ ohne Anzahl nennt.
//   - V-1200HD: Eingaenge (haengen an den XI-Erweiterungskarten).
//   - Kein Profil (Seite nennt keine Anzahl): V-1HD, V-1SDI, VR-4HD,
//     V-600UHD, XS-1HD, XS-84H, VP-42H, P-20HD.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const spec = (model: string) => `https://proav.roland.com/global/products/${model}/specifications/`

/** V-160HD: 16 Kanaele, „PinP x 4 … Keyer x 4 … DSK x 2“, 16 Standbilder, „three Aux buses“. */
export const PROFILE_ROLAND_V160HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('v-160hd'),
  blocks: { inputs: 16, upstreamKeyers: 4, downstreamKeyers: 2, dves: 4, stills: 16, aux: 3, macros: 100 },
}

/** V-8HD: 8 Kanaele, „PinP x 2, Keyer x 2, DSK“, 8 Standbilder. */
export const PROFILE_ROLAND_V8HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('v-8hd'),
  blocks: { inputs: 8, upstreamKeyers: 2, downstreamKeyers: 1, dves: 2, stills: 8, macros: 100 },
}

/** V-80HD: 8 Kanaele, „PinP x 2, Keyer x 2, DSK“, 32 Standbilder. */
export const PROFILE_ROLAND_V80HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('v-80hd'),
  blocks: { inputs: 8, upstreamKeyers: 2, downstreamKeyers: 1, dves: 2, stills: 32, macros: 100 },
}

/** VR-120HD: 12 Kanaele, „PinP x 4, Keyer x 4, DSK x 2“, 16 Standbilder, „three total Aux buses“. */
export const PROFILE_ROLAND_VR120HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('vr-120hd'),
  blocks: { inputs: 12, upstreamKeyers: 4, downstreamKeyers: 2, dves: 4, stills: 16, aux: 3, macros: 100 },
}

/** VR-6HD: 6 Kanaele, „PinP x 2, Keyer x 2, DSK“, 16 Standbilder. */
export const PROFILE_ROLAND_VR6HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('vr-6hd'),
  blocks: { inputs: 6, upstreamKeyers: 2, downstreamKeyers: 1, dves: 2, stills: 16, macros: 100 },
}

/**
 * V-1200HD: „M/E: 1M/E, 1.5M/E, 2M/E“, „Composition (Keyer): 4“, „AUX: 2“,
 * „Internal Memory: 16“, zwei Multi-View-Ausgaenge. Die 4:4:4-Stufe hat
 * eigene Grenzen (1 M/E, 1 Keyer, 4 Eingaenge).
 */
export const PROFILE_ROLAND_V1200HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('v-1200hd'),
  blocks: { mixEffects: 2, upstreamKeyers: 4, aux: 2, stills: 16, multiviewers: 2 },
  modes: [
    { id: '422', label: '4:2:2 Processing', limits: { mixEffects: 2, upstreamKeyers: 4, aux: 2 } },
    { id: '444', label: '4:4:4 Processing', limits: { inputs: 4, mixEffects: 1, upstreamKeyers: 1 } },
  ],
}

/** V-60HD: „six video sources and two still images“, „a DSK“, „1 Multiview output“. */
export const PROFILE_ROLAND_V60HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('v-60hd'),
  blocks: { inputs: 6, downstreamKeyers: 1, stills: 2, multiviewers: 1 },
}

/** XS-62S: „six inputs … along with two still images“, „1 HDMI Output (Multi-View/Scaler)“. */
export const PROFILE_ROLAND_XS62S: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: spec('xs-62s'),
  blocks: { inputs: 6, stills: 2 },
}
