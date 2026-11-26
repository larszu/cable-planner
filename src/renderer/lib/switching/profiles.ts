// ───────────────────────────────────────────────────────────────────────────
// Erste Geraeteprofile (#1240, Stufe 1): ATEM Constellation aus dem Katalog
// und die Smart Videohubs.
//
// DATENREGEL (Konzept §2.3, §8): jede Zahl aus der Blackmagic-Tech-Specs-
// Seite bzw. Produktseite, mit Adresse. Was dort nicht steht, bleibt leer.
// Gelesen am 26.11.2026.
//
// Bewusst LEER, weil keine Herstellerseite es nennt:
//   - Makros (alle Modelle): die Tech-Specs fuehren keine Anzahl.
//   - Constellation 8K: Boxen je SuperSource, Keyer je M/E; in der
//     Betriebsart 8K ausserdem M/E, SuperSource und Multiviewer (die Seite
//     nennt dort nur EINEN Wert ohne Aufteilung nach Betriebsart).
//   - Videohub: Take-Modus (das Ethernet-Protokoll kennt nur Sperren).
//   - Universal Videohub 72/288: kein Profil, die Herstellerseiten fuehren
//     die Modelle nicht mehr.
// ───────────────────────────────────────────────────────────────────────────
import type { SwitchingProfile } from './types'

const CONSTELLATION_PRODUCT = 'https://www.blackmagicdesign.com/products/atemconstellation'
const TS_2ME_4K = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-41'
const TS_2ME_HD = 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs/W-APS-26'
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
