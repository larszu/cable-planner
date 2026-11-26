// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofile (#1240): alle ATEM Constellation im Katalog (1/2/4 M/E,
// HD/4K, 4K Plus, 8K) und die Smart Videohubs.
//
// DATENREGEL (Konzept §2.3, §8): jede Zahl aus der Blackmagic-Tech-Specs-
// Seite bzw. Produktseite, mit Adresse. Was dort nicht steht, bleibt leer.
// Gelesen am 26.11.2026.
//
// Bewusst LEER, weil keine Herstellerseite es nennt:
//   - Makros (alle Modelle): die Tech-Specs fuehren keine Anzahl.
//   - 1 M/E Constellation: SuperSource (weder Tech-Specs noch Produktseite
//     nennen eine; die Produktseite fuehrt sie nur fuer 2 und 4 M/E).
//   - Constellation 8K: Boxen je SuperSource, Keyer je M/E; in der
//     Betriebsart 8K ausserdem M/E, SuperSource und Multiviewer (die Seite
//     nennt dort nur EINEN Wert ohne Aufteilung nach Betriebsart).
//   - Videohub: Take-Modus (das Ethernet-Protokoll kennt nur Sperren).
//   - Universal Videohub 72/288: kein Profil, die Herstellerseiten fuehren
//     die Modelle nicht mehr.
//   - ATEM Mini, Mini Pro (ISO), Mini Extreme (ISO): M/E-Zahl und
//     SuperSource (die Tech-Specs fuehren beides nur beim Extreme ISO G2),
//     beim ATEM Mini ausserdem der Multiviewer (hat keinen).
//   - Television Studio Pro 4K: M/E-Zahl. Production Studio 4K: die M/E-Zahl
//     kommt aus dem Modellnamen der Tech-Specs-Seite, es gibt kein eigenes
//     Feld. Farbgeneratoren beim 1 M/E und beim TVS Pro 4K; beim
//     2 M/E die Upstream-Keyer (die Tech-Specs nennen „4“ ohne Bezug auf
//     M/E-Reihe oder Summe).
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const CONSTELLATION_PRODUCT = 'https://www.blackmagicdesign.com/products/atemconstellation'
const TS_2ME_4K = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-41'
const TS_2ME_HD = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-26'
const TS_1ME_4K = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-40'
const TS_4ME_4K = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-42'
const TS_4ME_4K_PLUS = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-45'
const TS_1ME_HD = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-25'
const TS_4ME_HD = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-27'
const TS_8K = 'https://www.blackmagicdesign.com/products/atemconstellation8k/techspecs'
const PRODUCT_8K = 'https://www.blackmagicdesign.com/products/atemconstellation8k'

/** Archivierte Tech-Specs der Smart-Videohub-Reihe (die Live-Seite leitet auf die Nachfolger um). */
const TS_SMART_VIDEOHUB =
  'https://web.archive.org/web/20210507072830/https://www.blackmagicdesign.com/products/smartvideohub/techspecs/W-VHS-05'
/** Offen dokumentiertes Protokoll: „VIDEO OUTPUT LOCKS“. */
const VIDEOHUB_PROTOCOL = 'https://documents.blackmagicdesign.com/DeveloperManuals/VideohubEthernetProtocol.pdf'

/**
 * ATEM 2 M/E Constellation 4K. Tech-Specs W-APS-41; Keyer je M/E-Reihe und
 * die vier Boxen der SuperSource („4 extra DVE layers plus a background
 * layer“) von der Produktseite.
 */
export const PROFILE_ATEM_2ME_CONSTELLATION_4K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_2ME_4K,
  sources: { upstreamKeyersPerMe: CONSTELLATION_PRODUCT, superSourceBoxes: CONSTELLATION_PRODUCT },
  blocks: {
    inputs: 20,
    mixEffects: 2,
    upstreamKeyers: 8,
    upstreamKeyersPerMe: 4,
    downstreamKeyers: 2,
    superSources: 1,
    superSourceBoxes: 4,
    mediaPlayers: 2,
    stills: 40,
    clips: 2,
    colorGenerators: 2,
    aux: 12,
    multiviewers: 2,
    dves: 2,
  },
}

/**
 * ATEM 2 M/E Constellation HD. Tech-Specs W-APS-26; Keyer je M/E-Reihe,
 * SuperSource-Boxen und die DVE-Zahl („2 DVEs“) von der Produktseite.
 */
export const PROFILE_ATEM_2ME_CONSTELLATION_HD: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_2ME_HD,
  sources: {
    upstreamKeyersPerMe: CONSTELLATION_PRODUCT,
    superSourceBoxes: CONSTELLATION_PRODUCT,
    dves: CONSTELLATION_PRODUCT,
  },
  blocks: {
    inputs: 20,
    mixEffects: 2,
    upstreamKeyers: 8,
    upstreamKeyersPerMe: 4,
    downstreamKeyers: 2,
    superSources: 1,
    superSourceBoxes: 4,
    mediaPlayers: 2,
    stills: 40,
    clips: 2,
    colorGenerators: 2,
    aux: 12,
    multiviewers: 2,
    dves: 2,
  },
}

/**
 * ATEM Constellation 8K. Die Tech-Specs nennen zwei Betriebsarten („x up to
 * Ultra HD / x in 8K“); die M/E-Zahl („4 M/Es“) steht auf der Produktseite.
 */
export const PROFILE_ATEM_CONSTELLATION_8K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_8K,
  sources: { mixEffects: PRODUCT_8K },
  blocks: {
    inputs: 40,
    mixEffects: 4,
    upstreamKeyers: 16,
    downstreamKeyers: 4,
    superSources: 2,
    mediaPlayers: 4,
    stills: 64,
    clips: 4,
    colorGenerators: 2,
    aux: 24,
    multiviewers: 4,
    dves: 4,
  },
  modes: [
    {
      id: 'uhd',
      label: 'Up to Ultra HD',
      limits: { inputs: 40, upstreamKeyers: 16, downstreamKeyers: 4, mediaPlayers: 4, stills: 64, clips: 4, aux: 24, dves: 4 },
    },
    {
      id: '8k',
      label: '8K',
      limits: { inputs: 10, upstreamKeyers: 4, downstreamKeyers: 2, mediaPlayers: 1, stills: 24, clips: 2, aux: 6, dves: 1 },
    },
  ],
}

/**
 * ATEM 1 M/E Constellation 4K / HD. Tech-Specs W-APS-40 bzw. W-APS-25;
 * Keyer je M/E-Reihe und die DVE-Zahl der HD-Fassung („DVE“, ein Stueck) von
 * der Produktseite. SuperSource bleibt leer: die Tech-Specs fuehren keine,
 * und die Produktseite nennt sie nur fuer die 2- und 4-M/E-Modelle.
 */
export const PROFILE_ATEM_1ME_CONSTELLATION_4K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_1ME_4K,
  sources: { upstreamKeyersPerMe: CONSTELLATION_PRODUCT },
  blocks: {
    inputs: 10,
    mixEffects: 1,
    upstreamKeyers: 4,
    upstreamKeyersPerMe: 4,
    downstreamKeyers: 1,
    mediaPlayers: 2,
    stills: 20,
    clips: 2,
    colorGenerators: 2,
    aux: 6,
    multiviewers: 1,
    dves: 1,
  },
}

export const PROFILE_ATEM_1ME_CONSTELLATION_HD: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_1ME_HD,
  sources: { upstreamKeyersPerMe: CONSTELLATION_PRODUCT, dves: CONSTELLATION_PRODUCT },
  blocks: {
    inputs: 10,
    mixEffects: 1,
    upstreamKeyers: 4,
    upstreamKeyersPerMe: 4,
    downstreamKeyers: 1,
    mediaPlayers: 2,
    stills: 20,
    clips: 2,
    colorGenerators: 2,
    aux: 6,
    multiviewers: 1,
    dves: 1,
  },
}

/** ATEM 4 M/E Constellation 4K / 4K Plus / HD. Keyer je M/E, Boxen (und bei HD die DVE-Zahl) von der Produktseite. */
const vierMe = (url: string, inputs: number, aux: number, stills: number, hd: boolean): SwitchingProfile => ({
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: url,
  sources: {
    upstreamKeyersPerMe: CONSTELLATION_PRODUCT,
    superSourceBoxes: CONSTELLATION_PRODUCT,
    ...(hd ? { dves: CONSTELLATION_PRODUCT } : {}),
  },
  blocks: {
    inputs,
    mixEffects: 4,
    upstreamKeyers: 16,
    upstreamKeyersPerMe: 4,
    downstreamKeyers: 4,
    superSources: 2,
    superSourceBoxes: 4,
    mediaPlayers: 4,
    stills,
    clips: 4,
    colorGenerators: 2,
    aux,
    multiviewers: 4,
    dves: 4,
  },
})

export const PROFILE_ATEM_4ME_CONSTELLATION_4K = vierMe(TS_4ME_4K, 40, 24, 64, false)
export const PROFILE_ATEM_4ME_CONSTELLATION_4K_PLUS = vierMe(TS_4ME_4K_PLUS, 80, 48, 64, false)
export const PROFILE_ATEM_4ME_CONSTELLATION_HD = vierMe(TS_4ME_HD, 40, 24, 60, true)

const videohub = (n: number): SwitchingProfile => ({
  role: 'router',
  idScheme: 'videohub',
  manufacturerUrl: TS_SMART_VIDEOHUB,
  sources: { features: VIDEOHUB_PROTOCOL },
  blocks: { inputs: n },
  outputs: n,
  levels: [{ id: 'video', label: 'Video' }],
  features: { locks: true },
})

/** Smart Videohub 12G 40x40, 40x40, 20x20, 12x12 — eine Ebene. */
export const PROFILE_SMART_VIDEOHUB_40 = videohub(40)
export const PROFILE_SMART_VIDEOHUB_20 = videohub(20)
export const PROFILE_SMART_VIDEOHUB_12 = videohub(12)

// ─── ATEM Mini, Production Studio 4K, Television Studio Pro 4K ───────────
// Live-Tech-Specs fuer die Modelle, die Blackmagic noch fuehrt, sonst die
// archivierte Tech-Specs-Seite. Gelesen am 26.11.2026.

const TS_ATEM_MINI = 'https://www.blackmagicdesign.com/products/atemmini/techspecs'
/** Archiv 2021: fuehrt noch ATEM Mini und Mini Extreme ISO (erste Generation). */
const TS_ATEM_MINI_2021 =
  'https://web.archive.org/web/20211204135246/https://www.blackmagicdesign.com/products/atemmini/techspecs/W-APS-13'
/** Archiv 2019: Production-Studio-4K-Reihe. */
const TS_PRODUCTION_STUDIO_4K =
  'https://web.archive.org/web/20191212075613/https://www.blackmagicdesign.com/products/atem/techspecs'
/** Archiv 2018, Produktseite: „SuperSource … Available on the ATEM 2 M/E Production Studio 4K … 4 picture in picture DVEs“. */
const PRODUCT_ATEM_2018 = 'https://web.archive.org/web/20180523025725/https://www.blackmagicdesign.com/products/atem'
/** Archiv 2022: Television-Studio-Reihe mit dem Pro 4K. */
const TS_TVS_2022 =
  'https://web.archive.org/web/20220308050304/https://www.blackmagicdesign.com/products/atemtelevisionstudio/techspecs'

const atemMini = (url: string, extreme: boolean, multiviewers?: number): SwitchingProfile => ({
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: url,
  blocks: {
    inputs: extreme ? 8 : 4,
    upstreamKeyers: extreme ? 4 : 1,
    downstreamKeyers: extreme ? 2 : 1,
    mediaPlayers: extreme ? 2 : 1,
    stills: 20,
    colorGenerators: 2,
    aux: extreme ? 2 : 1,
    dves: extreme ? 2 : 1,
    ...(multiviewers ? { multiviewers } : {}),
  },
})

/** ATEM Mini: kein Multiviewer (Tech-Specs fuehren keinen). */
export const PROFILE_ATEM_MINI = atemMini(TS_ATEM_MINI_2021, false)
/** ATEM Mini Pro / Pro ISO: „1 x 10 Views“. */
export const PROFILE_ATEM_MINI_PRO = atemMini(TS_ATEM_MINI, false, 1)
export const PROFILE_ATEM_MINI_PRO_ISO = atemMini(TS_ATEM_MINI, false, 1)
/** ATEM Mini Extreme: „a multiview with up to 16 views“. */
export const PROFILE_ATEM_MINI_EXTREME = atemMini(TS_ATEM_MINI, true, 1)
/** ATEM Mini Extreme ISO (erste Generation, nicht G2): archivierte Tech-Specs, Multiviewer dort ohne Anzahl. */
export const PROFILE_ATEM_MINI_EXTREME_ISO = atemMini(TS_ATEM_MINI_2021, true)

/** ATEM 1 M/E Production Studio 4K: „11 with 10 active“ (gezaehlt: aktiv), „1 x 10 views“. */
export const PROFILE_ATEM_1ME_PRODUCTION_STUDIO_4K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_PRODUCTION_STUDIO_4K,
  blocks: {
    inputs: 10,
    mixEffects: 1,
    upstreamKeyers: 4,
    downstreamKeyers: 2,
    mediaPlayers: 2,
    stills: 32,
    clips: 2,
    aux: 3,
    multiviewers: 1,
    dves: 1,
  },
}

/** ATEM 2 M/E Production Studio 4K: „21 with 20 active“ (gezaehlt: aktiv), „Total Multi Views 2“. */
export const PROFILE_ATEM_2ME_PRODUCTION_STUDIO_4K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_PRODUCTION_STUDIO_4K,
  sources: { superSources: PRODUCT_ATEM_2018, superSourceBoxes: PRODUCT_ATEM_2018 },
  blocks: {
    inputs: 20,
    mixEffects: 2,
    downstreamKeyers: 2,
    superSources: 1,
    superSourceBoxes: 4,
    mediaPlayers: 2,
    stills: 32,
    clips: 2,
    colorGenerators: 2,
    aux: 6,
    multiviewers: 2,
    dves: 1,
  },
}

/** ATEM Television Studio Pro 4K: „1 x 10 Views“, „2, with non volatile flash memory“. */
export const PROFILE_ATEM_TVS_PRO_4K: SwitchingProfile = {
  role: 'mixer',
  idScheme: 'atem',
  manufacturerUrl: TS_TVS_2022,
  blocks: {
    inputs: 8,
    upstreamKeyers: 1,
    downstreamKeyers: 2,
    mediaPlayers: 2,
    stills: 20,
    clips: 2,
    aux: 1,
    multiviewers: 1,
    dves: 1,
  },
}
