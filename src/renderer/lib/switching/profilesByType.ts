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
import * as ross from './profilesRoss'

export const SWITCHING_PROFILES_BY_TYPE: Readonly<Record<string, SwitchingProfile>> = {
  /** Blackmagic ATEM Television Studio Pro 4K (broadcastNachtragBCatalog) */
  '798f7791-4769-4d97-9905-44c11d49cc8e': PROFILE_ATEM_TVS_PRO_4K,

  // Ross Video (rossCatalog, Black Solo in broadcastNachtragCatalog)
  '279f9af4-2f91-469e-87a3-3911f321f45a': ross.PROFILE_ROSS_CARBONITE_ULTRA_60,
  '0ad93ca1-31b3-455f-ba6c-8d3872a5e344': ross.PROFILE_ROSS_CARBONITE_BLACK_PLUS_2ME,
  'e0366446-6a23-472a-ad8d-92f3b6bf4db7': ross.PROFILE_ROSS_CARBONITE_ULTRA,
  '5c62f236-ef20-423f-b27f-a803148be416': ross.PROFILE_ROSS_GRAPHITE,
  'd11cf04a-c5fc-4432-ab23-4698ddc20736': ross.PROFILE_ROSS_CARBONITE_BLACK_SOLO,
  '37276fa0-ee91-4334-98e7-b9a34e97b005': ross.PROFILE_ROSS_ULTRIX_FR1,
  '0035f21b-bc95-40a6-bcf2-6f93cb9fb33b': ross.PROFILE_ROSS_ULTRIX_FR2,
  'aa1dd919-e9ed-4170-a8cb-a6ac7c1bf975': ross.PROFILE_ROSS_ULTRIX_FR5,
  '9f3f125f-823b-48c1-9e4e-8960a0cc6c49': ross.PROFILE_ROSS_NK_3G72,
  '2e14ed1e-284b-4b5d-bc76-caa07a433d8c': ross.PROFILE_ROSS_NK_3G16,
}
