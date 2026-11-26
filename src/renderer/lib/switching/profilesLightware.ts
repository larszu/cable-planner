// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile Lightware MX2 (#1240, Stufe 7). Quelle je Profil: die
// A&E-Spezifikation (PDF) von Lightware. Gelesen am 26.11.2026.
//
// „Matrix size: n inputs x n outputs“; Bedienfeld mit „Take/Autotake
// switching, output lock“. Eine Ebene: das 24x24-Blatt sagt ausdruecklich
// „there is no independent audio layer“; die anderen beiden nennen keine
// eigene Audio-Ebene.
//
// Bewusst LEER: Breakaway (nicht genannt).
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const mx2 = (model: string, n: number): SwitchingProfile => ({
  role: 'router',
  manufacturerUrl: `https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/${model}_AE_Specification.pdf`,
  blocks: { inputs: n },
  outputs: n,
  levels: [{ id: 'video', label: 'Video' }],
  features: { locks: true, takeMode: true },
})

export const PROFILE_LIGHTWARE_MX2_16 = mx2('MX2-16x16-HDMI20-R', 16)
export const PROFILE_LIGHTWARE_MX2_24 = mx2('MX2-24x24-HDMI20-R', 24)
export const PROFILE_LIGHTWARE_MX2_48 = mx2('MX2-48x48-HDMI20-A-R', 48)
