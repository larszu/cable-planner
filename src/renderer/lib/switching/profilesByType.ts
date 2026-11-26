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
import * as roland from './profilesRoland'
import * as panasonic from './profilesPanasonic'
import * as fora from './profilesForA'
import * as aja from './profilesAja'

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

  // Roland (switcherCatalog, miscCatalog)
  '2983ce7e-e004-49c5-8411-709546aea466': roland.PROFILE_ROLAND_V160HD,
  'f2786473-7eea-44e7-97a8-cbe63c6d8cc4': roland.PROFILE_ROLAND_V60HD,
  '7079510f-190f-4fe2-9efb-bf7bcef97244': roland.PROFILE_ROLAND_V8HD,
  '684a1453-28b5-4026-8f5d-f77edfbd55ff': roland.PROFILE_ROLAND_V80HD,
  'fc593190-82d8-4f39-9ffe-4aa5ac636bdb': roland.PROFILE_ROLAND_VR120HD,
  'eebf5cb4-31f2-4c35-87a7-6c59c28227fb': roland.PROFILE_ROLAND_VR6HD,
  'b36b1870-fac4-4053-8f9f-5aa1efdddd26': roland.PROFILE_ROLAND_V1200HD,
  '9d9feabe-7a1d-473b-b182-d6a37e19a390': roland.PROFILE_ROLAND_XS62S,
  // Panasonic (switcherCatalog)
  'd3671648-297a-4785-a48f-9ecdcab0f934': panasonic.PROFILE_PANASONIC_AV_UHS500,
  // For-A (switcherCatalog)
  'ce02f5e9-95c8-4910-a616-6147a312998b': fora.PROFILE_FORA_HVS_490,
  // AJA (ajaCatalog)
  'ca069939-edff-479f-acc1-56650a5a1e8e': aja.PROFILE_AJA_KUMO_1616_12G,
  '2a3eed49-cc33-45be-ae0f-c5e6c89e818d': aja.PROFILE_AJA_KUMO_3232_12G,
  '40147c52-679d-4784-a009-f8211be107f9': aja.PROFILE_AJA_KUMO_6464_12G,
  'd8584156-1793-4794-a4b4-488cfe834e59': aja.PROFILE_AJA_KUMO_1616,
  'd435ffb1-c471-4059-89ee-84a490f6025c': aja.PROFILE_AJA_KUMO_3232,
  '379c5b0a-a4b5-40d0-a66d-a3fda51b5059': aja.PROFILE_AJA_KUMO_6464,
}
