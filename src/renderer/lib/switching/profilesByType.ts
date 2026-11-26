// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile (#1240) fuer Katalog-Eintraege ausserhalb von
// `blackmagicCatalog.ts`: Schluessel ist die stabile Geraetetyp-ID, der
// Modellname steht als Kommentar daneben. Die Registry haengt das Profil an
// (`deviceTypeRegistry.ts`), die Katalogdateien bleiben unveraendert.
//
// DATENREGEL wie in `profiles.ts`: jede Zahl aus Datenblatt oder Tech-Specs
// des Herstellers, mit Adresse; nicht belegte Werte bleiben leer.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'
import { PROFILE_ATEM_TVS_PRO_4K } from './profiles'

export const SWITCHING_PROFILES_BY_TYPE: Readonly<Record<string, SwitchingProfile>> = {
  /** Blackmagic ATEM Television Studio Pro 4K (broadcastNachtragBCatalog) */
  '798f7791-4769-4d97-9905-44c11d49cc8e': PROFILE_ATEM_TVS_PRO_4K,
}
