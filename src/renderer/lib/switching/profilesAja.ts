// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile AJA KUMO (#1240, Stufe 7). Quelle je Profil: die
// Produktseite auf aja.com („16x 12G-SDI inputs and outputs“ usw.).
// Gelesen am 26.11.2026.
//
// Eine Ebene (SDI). Bewusst LEER: Sperren und Take-Modus (nicht genannt);
// die „Eight salvos per router“ hat das Profilformat kein Feld; die
// Betriebsarten Dual/Quad-Link („ganged dual and quad port routing“) ohne
// eigene Groessenangabe.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const kumo = (model: string, n: number): SwitchingProfile => ({
  role: 'router',
  manufacturerUrl: `https://www.aja.com/products/${model}`,
  blocks: { inputs: n },
  outputs: n,
  levels: [{ id: 'video', label: 'Video' }],
})

export const PROFILE_AJA_KUMO_1616_12G = kumo('kumo-1616-12g', 16)
export const PROFILE_AJA_KUMO_3232_12G = kumo('kumo-3232-12g', 32)
export const PROFILE_AJA_KUMO_6464_12G = kumo('kumo-6464-12g', 64)
export const PROFILE_AJA_KUMO_1616 = kumo('kumo-1616', 16)
export const PROFILE_AJA_KUMO_3232 = kumo('kumo-3232', 32)
export const PROFILE_AJA_KUMO_6464 = kumo('kumo-6464', 64)
