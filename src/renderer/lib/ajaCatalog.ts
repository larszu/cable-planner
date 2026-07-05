// ───────────────────────────────────────────────────────────────────────────
// AJA-Katalog (Router, Frame-Syncs, Konverter, Recorder, Streaming)
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

interface AjaEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: AjaEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const AJA_CATALOG: AjaEntry[] = [
  // AJA KUMO 1616-12G (2019) — 12G-SDI, 4K auf einem BNC
  // Quelle: https://www.aja.com/products/kumo-1616-12g
  {
    match: ['kumo 1616', '12g'],
    deviceTypeId: 'ca069939-edff-479f-acc1-56650a5a1e8e',
    template: {
      name: 'AJA KUMO 1616-12G',
      category: 'Video Router',
      inputs: [
        ...num('12G-SDI In', 16, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('12G-SDI Out', 16, 'BNC'),
      ],
      width: 260, height: 380,
    },
  },

  // AJA KUMO 3232-12G (2019) — 12G-SDI, 2 HE
  // Quelle: https://www.aja.com/products/kumo-3232-12g
  {
    match: ['kumo 3232', '12g'],
    deviceTypeId: '2a3eed49-cc33-45be-ae0f-c5e6c89e818d',
    template: {
      name: 'AJA KUMO 3232-12G',
      category: 'Video Router',
      inputs: [
        ...num('12G-SDI In', 32, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('12G-SDI Out', 32, 'BNC'),
      ],
      width: 260, height: 636,
    },
  },

  // AJA KUMO 6464-12G (2020) — 12G-SDI 64x64
  // Quelle: https://www.aja.com/products/kumo-6464-12g
  {
    match: ['kumo 6464', '12g'],
    deviceTypeId: '40147c52-679d-4784-a009-f8211be107f9',
    template: {
      name: 'AJA KUMO 6464-12G',
      category: 'Video Router',
      inputs: [
        ...num('12G-SDI In', 64, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('12G-SDI Out', 64, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // AJA Ki Pro Ultra 12G (2019) — 4K/UHD-Recorder/Player, Multi-Channel-HD; optionale SFP-Cages
  // Quelle: https://www.aja.com/products/ki-pro-ultra-12g
  {
    match: ['ki pro', 'ultra', '12g'],
    deviceTypeId: 'ecf80e2e-5376-4f86-865f-ce146e90d032',
    template: {
      name: 'AJA Ki Pro Ultra 12G',
      category: 'Video',
      inputs: [
        { id: '', name: '12G-SDI In', type: 'BNC', connectorType: 'BNC' },
        ...num('3G-SDI In', 3, 'BNC'),
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LTC In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Analog Audio In CH1-8', type: 'DB25', connectorType: 'DB25' },
        { id: '', name: 'AES In CH1-8', type: 'DB25', connectorType: 'DB25' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        { id: '', name: '12G-SDI Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'SDI Monitor Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'LTC Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Analog Audio Out CH1-8', type: 'DB25', connectorType: 'DB25' },
        ...num('Monitor Out L/R', 2, 'Cinch/RCA'),
      ],
      width: 260, height: 236,
    },
  },

  // AJA KUMO 1616 (2015) — 3G-SDI 16x16, GVG Native Protocol via RS-422/LAN, redundantes Netzteil
  // Quelle: https://www.aja.com/products/kumo-1616
  {
    match: ['kumo 1616'],
    deviceTypeId: 'd8584156-1793-4794-a4b4-488cfe834e59',
    template: {
      name: 'AJA KUMO 1616',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 16, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 16, 'BNC'),
      ],
      width: 260, height: 380,
    },
  },

  // AJA KUMO 3232 (2015) — 3G-SDI 32x32
  // Quelle: https://www.aja.com/products/kumo-3232
  {
    match: ['kumo 3232'],
    deviceTypeId: 'd435ffb1-c471-4059-89ee-84a490f6025c',
    template: {
      name: 'AJA KUMO 3232',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 32, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 32, 'BNC'),
      ],
      width: 260, height: 636,
    },
  },

  // AJA KUMO 6464 (2016) — 3G-SDI 64x64
  // Quelle: https://www.aja.com/family/routers
  {
    match: ['kumo 6464'],
    deviceTypeId: '379c5b0a-a4b5-40d0-a66d-a3fda51b5059',
    template: {
      name: 'AJA KUMO 6464',
      category: 'Video Router',
      inputs: [
        ...num('SDI In', 64, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RS-422', type: 'DB9', connectorType: 'DB9' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('SDI Out', 64, 'BNC'),
      ],
      width: 260, height: 1000,
    },
  },

  // AJA FS-HDR (2017) — HDR/WCG-Prozessor (Colorfront), 1 HE; optionale 12G/6G-SDI-SFP-Slots (HD-BNC/LC-Fiber)
  // Quelle: https://www.aja.com/products/fs-hdr
  {
    match: ['fs-hdr'],
    deviceTypeId: 'efd29eeb-fc5a-4ad4-8f34-ec58c16d15aa',
    template: {
      name: 'AJA FS-HDR',
      category: 'Konverter',
      inputs: [
        ...num('3G-SDI In', 4, 'BNC'),
        { id: '', name: 'Ref In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Ref Loop', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('3G-SDI Out', 4, 'BNC'),
      ],
      width: 260, height: 172,
    },
  },

  // AJA HELO Plus (2022) — H.264-Streamer/Recorder bis 1080p60, SD-Karte + USB-Medien
  // Quelle: https://www.aja.com/products/helo-plus
  {
    match: ['helo', 'plus'],
    deviceTypeId: '48011180-869a-490a-a041-a6d797196acb',
    template: {
      name: 'AJA HELO Plus',
      category: 'IP/NDI',
      inputs: [
        { id: '', name: '3G-SDI In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Analog Audio In (3.5mm)', type: 'Klinke', connectorType: 'Klinke' },
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        { id: '', name: '3G-SDI Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Analog Audio Out (3.5mm)', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 140,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const ajaTemplates: EquipmentTemplate[] = AJA_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchAjaTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of AJA_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('aja') ||
    lower.includes('kumo') ||
    lower.includes('ki pro') ||
    lower.includes('helo') ||
    lower.includes('fs-hdr') ||
    lower.includes('u-tap')
  if (!isBrandKnown) return null
  for (const entry of AJA_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
