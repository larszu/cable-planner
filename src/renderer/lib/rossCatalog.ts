// ───────────────────────────────────────────────────────────────────────────
// Ross-Video-Katalog (Carbonite/Graphite-Mischer, Ultrix/NK-Router)
//
// Alle Port-Belegungen stammen aus offiziellen Hersteller-Datenblaettern /
// Produktseiten (Recherche 2026-07, Quellen-URL je Eintrag). Grundsatz:
// KEINE erfundenen Ports — unsichere Geraete wurden nicht aufgenommen.
// deviceTypeId = stabile Geraetetyp-GUID (GDTF/DIN-SPEC-15800-analog),
// einmalig gemintet, versionsstabil.
// HINWEIS: Ross-Router bekommen KEIN kind 'videohub' — der Videohub-Export
// spricht das Blackmagic-Protokoll (Port 9990), Ultrix/NK nicht.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentTemplate, Port } from '../types/equipment'

const num = (base: string, n: number, connectorType: Port['connectorType'], bidi = false): Port[] =>
  Array.from({ length: n }, (_, i) => ({
    id: '',
    name: `${base} ${i + 1}`,
    type: connectorType,
    connectorType,
    ...(bidi ? { direction: 'bidirectional' as const } : {}),
  }))

interface RossEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: RossEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const ROSS_CATALOG: RossEntry[] = [
  // Ross Video Carbonite Ultra 60 (2022) — Modulares 3-HE-Frame, BIS ZU 60x25 (I/O-Boards nachruestbar), 3 M/E, HD/12G-UHD, RAVE-Audio-Engine — dargestellt ist die Vollbestueckung
  // Quelle: https://www.rossvideo.com/live-production/production-switchers/carbonite-ultra-60/
  {
    match: ['carbonite', 'ultra', '60'],
    deviceTypeId: '279f9af4-2f91-469e-87a3-3911f321f45a',
    template: {
      name: 'Ross Video Carbonite Ultra 60',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 60, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 25, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // Ross Video Carbonite Black Plus 2 M/E (2017) — 2 M/E Produktionsmischer, 36x25-Chassis; 12G-Variante verfuegbar; GPI/Tally via DB-Anschluesse
  // Quelle: https://www.rossvideo.com/products/production-switchers/carbonite-black/carbonite-black-specifications/
  {
    match: ['carbonite', 'black', 'plus'],
    deviceTypeId: '0ad93ca1-31b3-455f-ba6c-8d3872a5e344',
    template: {
      name: 'Ross Video Carbonite Black Plus 2 M/E',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 36, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 25, 'BNC'),
      ],
      width: 260, height: 668,
    },
  },

  // Ross Video Carbonite Ultra (2018) — Ultra Engine 24x14, 4K/HD, 1 HE; Frame Syncs + Format-Konverter onboard
  // Quelle: https://www.rossvideo.com/live-production/production-switchers/carbonite-ultra/specifications/
  {
    match: ['carbonite', 'ultra'],
    deviceTypeId: 'e0366446-6a23-472a-ad8d-92f3b6bf4db7',
    template: {
      name: 'Ross Video Carbonite Ultra',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 24, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 14, 'BNC'),
      ],
      width: 260, height: 476,
    },
  },

  // Ross Video Graphite (2017) — All-in-One 4 HE: Carbonite-Mischer + RAVE-48ch-Audiomischer (XLR-Analog-I/O) + XPression-Grafik + Clip-Player; 24 GPI, 16 Tally
  // Quelle: https://www.rossvideo.com/products/production-switchers/graphite/graphite-specifications/
  {
    match: ['ross', 'graphite'],
    deviceTypeId: '5c62f236-ef20-423f-b27f-a803148be416',
    template: {
      name: 'Ross Video Graphite',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 12, 'BNC'),
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 6, 'BNC'),
        ...num('HDMI Out', 2, 'HDMI'),
      ],
      width: 260, height: 300,
    },
  },

  // Ross Video Ultrix FR1 (2017) — Hyperkonvergente Routing-Plattform, 1 HE, modular (SDI/ST2110/NDI/Dante/MADI-Blades), 12G via Ultrispeed-Lizenz — dargestellt: 32x32-SDI-Bestueckung
  // Quelle: https://www.rossvideo.com/products/routing-systems/ultrix/ultrix-specifications/
  {
    match: ['ultrix', 'fr1'],
    deviceTypeId: '37276fa0-ee91-4334-98e7-b9a34e97b005',
    template: {
      name: 'Ross Video Ultrix FR1',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 32, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 32, 'BNC'),
      ],
      width: 260, height: 604,
    },
  },

  // Ross Video Ultrix FR2 (2017) — 2-HE-Frame, modular; HD-Dichte je Bestueckung bis 72x72 (HDIO-Blades), 12G via Ultrispeed — dargestellt: 64x64
  // Quelle: https://www.rossvideo.com/products/routing-systems/ultrix/ultrix-specifications/
  {
    match: ['ultrix', 'fr2'],
    deviceTypeId: '0035f21b-bc95-40a6-bcf2-6f93cb9fb33b',
    template: {
      name: 'Ross Video Ultrix FR2',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 64, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 64, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // Ross Video Ultrix FR5 (2019) — 5-HE-Frame, modular, bis 144x144; SDI/IP-Mischbestueckung — dargestellt: SDI-Vollbestueckung
  // Quelle: https://www.rossvideo.com/products/routing-systems/ultrix/ultrix-specifications/
  {
    match: ['ultrix', 'fr5'],
    deviceTypeId: 'aa1dd919-e9ed-4170-a8cb-a6ac7c1bf975',
    template: {
      name: 'Ross Video Ultrix FR5',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 144, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 144, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // Ross Video NK-3G72 (2016) — Skalierbarer 72x72 3G/HD/SD-Utility-Router, 3 HE, Input-EQ + Reclocking, T-Bus-Steuerung
  // Quelle: https://www.rossvideo.com/infrastructure/routing-systems/nk-3g72/
  {
    match: ['ross', 'nk-3g72'],
    deviceTypeId: '9f3f125f-823b-48c1-9e4e-8960a0cc6c49',
    template: {
      name: 'Ross Video NK-3G72',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 72, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'T-Bus', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 72, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // Ross Video NK-3G16 (2016) — Kompakter 16x16 3G/HD/SD-Utility-Router, 1 HE, T-Bus-Steuerung
  // Quelle: https://www.rossvideo.com/infrastructure/routing-systems/nk-3g-series/
  {
    match: ['ross', 'nk-3g16'],
    deviceTypeId: '2e14ed1e-284b-4b5d-bc76-caa07a433d8c',
    template: {
      name: 'Ross Video NK-3G16',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 16, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'T-Bus', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 16, 'BNC'),
      ],
      width: 260, height: 348,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const rossTemplates: EquipmentTemplate[] = ROSS_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchRossTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of ROSS_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('ross') ||
    lower.includes('carbonite') ||
    lower.includes('ultrix') ||
    lower.includes('graphite') ||
    lower.includes('opengear') ||
    lower.includes('ogx')
  if (!isBrandKnown) return null
  for (const entry of ROSS_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
