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
//   - V-1HD, V-1SDI, VR-4HD, V-600UHD, XS-1HD, XS-84H, VP-42H, P-20HD: die
//     Specifications-Seiten nennen keine Anzahlen; die Zahlen stammen aus dem
//     Owner's bzw. Reference Manual (PDF auf static.roland.com). „Memory“,
//     „Preset“ und „Scene Memory“ sind gespeicherte Einstellungen, keine
//     Makros, und werden nicht gezaehlt. Keyer-, DSK- und PinP-Zahlen bleiben
//     leer, wo das Handbuch nur Effekttypen auflistet.
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

// ─── Zahlen aus dem Handbuch (Owner's / Reference Manual, PDF) ───────────
const pdf = (name: string) => `https://static.roland.com/assets/media/pdf/${name}.pdf`

/** V-1HD: „The video on channels 1 through 4 is switched“ (S. 19). Multi-View nur auf PREVIEW, kein eigener Ausgang. */
export const PROFILE_ROLAND_V1HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('V-1HD_v2_eng01_W'),
  blocks: { inputs: 4 },
}

/** V-1SDI: 4 Kanaele (S. 36), „DSK (Luminance Key, Chroma Key)“, „HDMI OUT MULTI-VIEW … x 1“. */
export const PROFILE_ROLAND_V1SDI: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('V-1SDI_v15_eng02_W'),
  blocks: { inputs: 4, downstreamKeyers: 1, multiviewers: 1 },
}

/** VR-4HD: „Automatically switch the video of channels 1–4“ (S. 19); ein Standbild von Kanal 4 (S. 20). */
export const PROFILE_ROLAND_VR4HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('VR-4HD_v21_eng01_W'),
  blocks: { inputs: 4, stills: 1 },
}

/**
 * V-600UHD: „Number of Video Channels 6 channels“ (S. 66), „three internal
 * buses (PGM, PVW, and AUX)“ (S. 15), „DSK PinP, Key“, „up to eight still
 * images“ (S. 21), ein MULTI-VIEW-Ausgang (S. 67).
 */
export const PROFILE_ROLAND_V600UHD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('V-600UHD_reference_eng07_W'),
  blocks: { inputs: 6, aux: 1, downstreamKeyers: 1, stills: 8, multiviewers: 1 },
}

/** XS-1HD: „HDMI type A x 4 (HDMI INPUT 1–4)“, „Composition (Keyer) 1“, „Still Image … Internal Memory 1“ (S. 29). */
export const PROFILE_ROLAND_XS1HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('XS-1HD_eng02_W'),
  blocks: { inputs: 4, upstreamKeyers: 1, stills: 1 },
}

/** XS-84H: „HDMI … x 8 (INPUT 1–8)“, „It can be stored up to 4 files in the internal memory“ (S. 34). */
export const PROFILE_ROLAND_XS84H: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('XS-82H_XS-83H_XS-84H_eng04_W'),
  blocks: { inputs: 8, stills: 4 },
}

/**
 * VP-42H: „INPUT HDMI 1–4“, „Layer: 4 (Picture in Picture x 4) *Layer 1 is
 * Picture in Picture with Keyer“, „Still Image … Internal Memory: 3“ (S. 33).
 */
export const PROFILE_ROLAND_VP42H: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('XS-42H_VP-42H_reference_v13_eng03_W'),
  blocks: { inputs: 4, dves: 4, upstreamKeyers: 1, stills: 3 },
}

/** P-20HD (Recorder mit Umschaltung): „INPUT 1–2 HDMI type A x 2“, Standbilder „Up to 16 files … in each project“ (S. 81). */
export const PROFILE_ROLAND_P20HD: SwitchingProfile = {
  role: 'mixer',
  manufacturerUrl: pdf('P-20HD_reference_v20_eng02_W'),
  blocks: { inputs: 2, stills: 16 },
}
