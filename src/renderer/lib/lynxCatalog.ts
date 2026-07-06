// ───────────────────────────────────────────────────────────────────────────
// LYNX-Technik-Katalog (yellobrik-Konverter, Sync, greenMachine)
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

interface LynxEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: LynxEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const LYNX_CATALOG: LynxEntry[] = [
  // Lynx Technik yellobrik CDH 1813 (2015) — SDI zu HDMI Monitoring-Konverter, 3G Level A/B, optionaler Fiber-SFP
  // Quelle: https://lynx-technik.com/p/cdh-1813/
  {
    match: ['cdh', '1813'],
    deviceTypeId: 'ba941ff8-e5b0-41e7-a82b-a305042fe471',
    template: {
      name: 'Lynx Technik yellobrik CDH 1813',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        { id: '', name: '3G-SDI In', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        { id: '', name: 'SDI Loop Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'AES/Analog Audio Out', type: 'Custom', connectorType: 'Custom' },
      ],
      width: 260, height: 140,
    },
  },

  // Lynx Technik yellobrik CHD 1802 (2015) — HDMI zu SDI, bis 1080p60, 8ch Embedded Audio, optionaler Fiber-SFP (OH-TX-1)
  // Quelle: https://lynx-technik.com/p/chd-1802/
  {
    match: ['chd', '1802'],
    deviceTypeId: '58869e00-5679-49ce-a783-4f95485974e3',
    template: {
      name: 'Lynx Technik yellobrik CHD 1802',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
      ],
      outputs: [
        ...num('3G-SDI Out', 2, 'BNC'),
      ],
      width: 260, height: 140,
    },
  },

  // Lynx Technik yellobrik OTX 1812 (2015) — SDI zu LWL-Sender, bis 10 km Singlemode, reclocking; LC/ST/SC-Varianten
  // Quelle: https://lynx-technik.com/p/otx-1812/
  {
    match: ['otx', '1812'],
    deviceTypeId: 'e8379cf4-705f-4cdb-86cb-370464448e3b',
    template: {
      name: 'Lynx Technik yellobrik OTX 1812',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        { id: '', name: '3G-SDI In', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        { id: '', name: 'SDI Loop Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Fiber Out (LC)', type: 'Fiber', connectorType: 'Fiber' },
      ],
      width: 260, height: 140,
    },
  },

  // Lynx Technik yellobrik ORX 1802 (2015) — LWL zu SDI-Empfaenger, reclocking, 1260-1620 nm; LC/ST/SC-Varianten
  // Quelle: https://lynx-technik.com/p/orx-1802/
  {
    match: ['orx', '1802'],
    deviceTypeId: '4893e659-7dd0-4971-98f0-3c6a8e0e0d23',
    template: {
      name: 'Lynx Technik yellobrik ORX 1802',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        { id: '', name: 'Fiber In (LC)', type: 'Fiber', connectorType: 'Fiber' },
      ],
      outputs: [
        ...num('3G-SDI Out', 2, 'BNC'),
      ],
      width: 260, height: 140,
    },
  },

  // Lynx Technik yellobrik SPG 1707 (2016) — Sync-Pulse-Generator mit Genlock, 2 ppm standalone; SD-Ausgaenge auch Colorbars
  // Quelle: https://lynx-technik.com/p/spg-1707/
  {
    match: ['spg', '1707'],
    deviceTypeId: '5418624a-0c12-4e3d-b2ba-bc2a898206ed',
    template: {
      name: 'Lynx Technik yellobrik SPG 1707',
      category: 'Sync/Referenz',
      inputs: [
        { id: '', name: 'Genlock Ref In', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        ...num('Tri-Level Sync Out', 3, 'BNC'),
        ...num('Blackburst Sync Out', 3, 'BNC'),
        { id: '', name: 'Word Clock/DARS Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 172,
    },
  },

  // Lynx Technik yellobrik DVD 1817 (2015) — 1x7 reclocking SDI-Verteilverstaerker, 3G Level A/B + DVB-ASI
  // Quelle: https://lynx-technik.com/p/dvd-1817/
  {
    match: ['dvd', '1817'],
    deviceTypeId: '55cf940f-9dd8-4f0b-a839-8a05b07cce22',
    template: {
      name: 'Lynx Technik yellobrik DVD 1817',
      category: 'Video',
      isDistributionAmp: true,
      inputs: [
        { id: '', name: '3G-SDI In', type: 'BNC', connectorType: 'BNC' },
      ],
      outputs: [
        ...num('SDI Out', 7, 'BNC'),
      ],
      width: 260, height: 172,
    },
  },

  // Lynx Technik greenMachine callisto+ (2022) — Dual-Channel Up/Down/Cross + Frame-Sync, halbe 19"-Breite, GPI/GPO, LynxCentraal-Steuerung; optional Fiber
  // Quelle: https://lynx-technik.com/p/gm-6825/
  {
    match: ['greenmachine', 'callisto'],
    deviceTypeId: '52cf25a3-9efd-4f87-a54a-a420376e50b5',
    template: {
      name: 'Lynx Technik greenMachine callisto+',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        ...num('3G-SDI In', 2, 'BNC'),
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
        ...num('AES/Analog Audio In', 4, 'Custom'),
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('3G-SDI Out', 2, 'BNC'),
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        ...num('AES/Analog Audio Out', 4, 'Custom'),
      ],
      width: 260, height: 188,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const lynxTemplates: EquipmentTemplate[] = LYNX_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchLynxTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of LYNX_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('lynx') ||
    lower.includes('yellobrik') ||
    lower.includes('greenmachine')
  if (!isBrandKnown) return null
  for (const entry of LYNX_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
