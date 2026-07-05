// ───────────────────────────────────────────────────────────────────────────
// Videomischer-/Router-Katalog weiterer Hersteller (Panasonic, For-A, Roland, NewTek, Sony, Analog Way, Barco)
//
// Alle Port-Belegungen stammen aus offiziellen Hersteller-Datenblaettern /
// Produktseiten (Recherche 2026-07, Quellen-URL je Eintrag). Grundsatz:
// KEINE erfundenen Ports — unsichere Geraete wurden nicht aufgenommen.
// deviceTypeId = stabile Geraetetyp-GUID (GDTF/DIN-SPEC-15800-analog),
// einmalig gemintet, versionsstabil.
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

interface SwitcherEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: SwitcherEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const SWITCHER_CATALOG: SwitcherEntry[] = [
  // Panasonic AV-UHS500 (2020) — Kompakter 4K/12G-SDI-Mischer; per Options-Units bis 16 SDI-In / 13 SDI-Out erweiterbar
  // Quelle: https://pro-av.panasonic.net/en/products/av-uhs500/spec.html
  {
    match: ['panasonic', 'av-uhs500'],
    deviceTypeId: 'd3671648-297a-4785-a48f-9ecdcab0f934',
    template: {
      name: 'Panasonic AV-UHS500',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 8, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 5, 'BNC'),
        ...num('HDMI Out', 2, 'HDMI'),
      ],
      width: 260, height: 252,
    },
  },

  // For-A HVS-490 (2016) — HANABI 2 M/E, 3G/HD/SD; Frame-Sync auf allen Inputs; erweiterbar bis 40 In / 22 Out
  // Quelle: https://www.for-a.com/products/hvs490/
  {
    match: ['for-a', 'hvs-490'],
    deviceTypeId: 'ce02f5e9-95c8-4910-a616-6147a312998b',
    template: {
      name: 'For-A HVS-490',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 16, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 8, 'BNC'),
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 348,
    },
  },

  // Roland V-8HD (2019) — Kompakter reiner HDMI-Mischer bis 1080p60, 18ch-Audiomischer
  // Quelle: https://proav.roland.com/global/products/v-8hd/
  {
    match: ['roland', 'v-8hd'],
    deviceTypeId: '7079510f-190f-4fe2-9efb-bf7bcef97244',
    template: {
      name: 'Roland V-8HD',
      category: 'Video Mixer',
      inputs: [
        ...num('HDMI In', 8, 'HDMI'),
        { id: '', name: 'Audio In (3.5mm)', type: 'Klinke', connectorType: 'Klinke' },
        { id: '', name: 'USB (Control)', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('HDMI Out', 3, 'HDMI'),
        { id: '', name: 'Phones (3.5mm)', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 220,
    },
  },

  // Roland V-60HD (2017) — Multi-Format-HD-Mischer, Smart Tally ueber LAN
  // Quelle: https://proav.roland.com/global/products/v-60hd/
  {
    match: ['roland', 'v-60hd'],
    deviceTypeId: 'f2786473-7eea-44e7-97a8-cbe63c6d8cc4',
    template: {
      name: 'Roland V-60HD',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 4, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        ...num('Audio In 1-2 (Combo XLR/TRS)', 2, 'XLR'),
        { id: '', name: 'LAN (Smart Tally)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 2, 'BNC'),
        ...num('HDMI Out', 2, 'HDMI'),
        { id: '', name: 'HDMI Multiview Out', type: 'HDMI', connectorType: 'HDMI' },
        ...num('Audio Out L/R', 2, 'XLR'),
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 204,
    },
  },

  // Roland V-160HD (2021) — Hybrid-Streaming-Mischer 8x SDI + 8x HDMI, 40ch-Audiomischer, USB-C-Streaming
  // Quelle: https://proav.roland.com/global/products/v-160hd/
  {
    match: ['roland', 'v-160hd'],
    deviceTypeId: '2983ce7e-e004-49c5-8411-709546aea466',
    template: {
      name: 'Roland V-160HD',
      category: 'Video Mixer',
      inputs: [
        ...num('SDI In', 8, 'BNC'),
        ...num('HDMI In', 8, 'HDMI'),
        ...num('Audio In 1-2 (Combo XLR/TRS)', 2, 'XLR'),
        ...num('Audio In 3/4 (RCA)', 2, 'Cinch/RCA'),
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 3, 'BNC'),
        ...num('HDMI Out', 3, 'HDMI'),
        { id: '', name: 'USB-C Stream Out', type: 'USB-C', connectorType: 'USB-C' },
        ...num('Audio Out L/R', 2, 'XLR'),
        ...num('Audio Out (RCA) L/R', 2, 'Cinch/RCA'),
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 396,
    },
  },

  // Sony MCX-500 (2016) — 8-Input-Streaming-/Recording-Mischer, Frame-Sync je Input, RCP-Steuerung
  // Quelle: https://pro.sony/ue_US/products/video-switchers/mcx-500
  {
    match: ['sony', 'mcx-500'],
    deviceTypeId: 'ee3a295e-5ef1-44e1-96c3-5866ea062431',
    template: {
      name: 'Sony MCX-500',
      category: 'Video Mixer',
      inputs: [
        ...num('3G-SDI In', 4, 'BNC'),
        ...num('HDMI In', 2, 'HDMI'),
        ...num('Composite In', 2, 'Cinch/RCA'),
        ...num('Audio In L/R', 2, 'XLR'),
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        { id: '', name: 'SDI PGM Out', type: 'BNC', connectorType: 'BNC' },
        ...num('HDMI Out', 2, 'HDMI'),
      ],
      width: 260, height: 236,
    },
  },

  // Vizrt (NewTek) TriCaster 2 Elite (2019) — 32 externe Inputs gesamt (NDI + SDI), bis UHD60p; 2x UHD via Quad-Link-Gruppierung; Live Call Connect
  // Quelle: https://www.vizrt.com/products/tricaster/
  {
    match: ['tricaster', 'elite'],
    deviceTypeId: '3cc4a0b1-735f-46b8-b08b-7a2692c89135',
    template: {
      name: 'Vizrt (NewTek) TriCaster 2 Elite',
      category: 'Video Mixer',
      inputs: [
        ...num('3G-SDI In', 8, 'BNC'),
        { id: '', name: 'LAN (NDI)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('3G-SDI Out', 8, 'BNC'),
      ],
      width: 260, height: 204,
    },
  },

  // Barco E2 Gen 2 (2019) — Screen-Management/Praesentations-Switcher, 4 HE; Standardbestueckung (kartenbasiert, BTO abweichend); bis 4K60 4:4:4, verlinkbar mit S3-4K/Ex
  // Quelle: https://assets.barco.com/m/1da1a218bfbbede6/original/E2-Gen-2-en-Spec-sheet.pdf
  {
    match: ['barco', 'e2'],
    deviceTypeId: '3c49815f-6ce9-4792-8818-a1e70d2c3f97',
    template: {
      name: 'Barco E2 Gen 2',
      category: 'Video Mixer',
      inputs: [
        ...num('HDMI In', 12, 'HDMI'),
        ...num('DisplayPort In', 12, 'DisplayPort'),
        ...num('SDI In', 4, 'BNC'),
        { id: '', name: 'Genlock In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Genlock Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('HDMI Out', 13, 'HDMI'),
        { id: '', name: 'DisplayPort Out', type: 'DisplayPort', connectorType: 'DisplayPort' },
        ...num('SDI Out', 4, 'BNC'),
      ],
      width: 260, height: 556,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const switcherTemplates: EquipmentTemplate[] = SWITCHER_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchSwitcherTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of SWITCHER_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('panasonic av-') ||
    lower.includes('av-uhs') ||
    lower.includes('av-hs') ||
    lower.includes('for-a') ||
    lower.includes('hvs-') ||
    lower.includes('roland v-') ||
    lower.includes('v-160hd') ||
    lower.includes('v-60hd') ||
    lower.includes('v-8hd') ||
    lower.includes('tricaster') ||
    lower.includes('mcx-500') ||
    lower.includes('aquilon') ||
    lower.includes('barco e2') ||
    lower.includes('barco s3')
  if (!isBrandKnown) return null
  for (const entry of SWITCHER_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
