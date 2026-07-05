// ───────────────────────────────────────────────────────────────────────────
// Broadcast-Tools-Katalog (Decimator, Teradek, Riedel)
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

interface BroadcastToolsEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: BroadcastToolsEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const BROADCAST_TOOLS_CATALOG: BroadcastToolsEntry[] = [
  // Decimator DMON-6S (2015) — 6-Kanal-Multiviewer/Multiplexer mit aktiven Loop-Outs, USB-Konfiguration
  // Quelle: https://decimator.com/Products/MultiViewers/DMON-6S%20MultiViewer/DMON-6S.html
  {
    match: ['dmon-6s'],
    deviceTypeId: '9d653c20-d549-46ca-a735-b11754af883b',
    template: {
      name: 'Decimator DMON-6S',
      category: 'Video',
      inputs: [
        ...num('3G-SDI In', 6, 'BNC'),
      ],
      outputs: [
        ...num('SDI Loop Out', 6, 'BNC'),
        { id: '', name: 'SDI MV Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI MV Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 188,
    },
  },

  // Decimator DMON-12S (2016) — 12-Kanal-Multiviewer/Multiplexer, custom Layouts
  // Quelle: https://decimator.com/specs/DMON-12S_HARDWARE_MANUAL_FV1.3.pdf
  {
    match: ['dmon-12s'],
    deviceTypeId: '76c6b71c-9037-4fe4-9216-2498b8ed577f',
    template: {
      name: 'Decimator DMON-12S',
      category: 'Video',
      inputs: [
        ...num('3G-SDI In', 12, 'BNC'),
      ],
      outputs: [
        { id: '', name: 'SDI MV Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI MV Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 252,
    },
  },

  // Decimator MD-HX (2015) — SDI/HDMI-Cross-Konverter mit Scaler, nutzbar als 1:4-DA, LCD-Bedienung
  // Quelle: https://decimator.com/Products/MiniConverters/MD-HX%20Miniature%20Converter/MD-HX.html
  {
    match: ['md-hx'],
    deviceTypeId: 'da8513b0-c6bf-4da7-b07f-9665efb47270',
    template: {
      name: 'Decimator MD-HX',
      category: 'Konverter',
      isConverter: true,
      inputs: [
        { id: '', name: '3G-SDI In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
      ],
      outputs: [
        ...num('SDI Out', 4, 'BNC'),
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 140,
    },
  },

  // Teradek Bolt 4K 750 TX (2019) — Drahtlos-Video-Sender 4K60 10-bit, <1 ms Latenz, bis 6 Empfaenger, 750 ft
  // Quelle: https://teradek.com/products/bolt-4k-12g-sdi-750-tx-new-photos
  {
    match: ['bolt', '4k', 'tx'],
    deviceTypeId: '5436a62f-738f-4182-b84f-f42c9598f89d',
    template: {
      name: 'Teradek Bolt 4K 750 TX',
      category: 'Video',
      inputs: [
        { id: '', name: '12G-SDI In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
      ],
      outputs: [
        { id: '', name: '12G-SDI Loop Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Wireless Link', type: 'Wireless/RF', connectorType: 'Wireless/RF' },
      ],
      width: 260, height: 140,
    },
  },

  // Teradek Bolt 4K 750 RX (2019) — Drahtlos-Video-Empfaenger 4K60, 2x 12G-SDI + HDMI 2.0
  // Quelle: https://teradek.com/products/bolt-4k-750-rx-only
  {
    match: ['bolt', '4k', 'rx'],
    deviceTypeId: 'e94b3454-975a-469c-ada8-69dcd2662629',
    template: {
      name: 'Teradek Bolt 4K 750 RX',
      category: 'Video',
      inputs: [
        { id: '', name: 'Wireless Link', type: 'Wireless/RF', connectorType: 'Wireless/RF' },
      ],
      outputs: [
        ...num('12G-SDI Out', 2, 'BNC'),
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 140,
    },
  },

  // Riedel MediorNet MicroN (2016) — Media-Netzwerk-Knoten 1 HE: 12x12 SDI, 8x 10G-MediorNet-Links, 2x MADI optisch, Routing/Processing dezentral
  // Quelle: https://www.riedel.net/en/products-solutions/distributed-video-networks/mn-micron/hardware/
  {
    match: ['mediornet', 'micron'],
    deviceTypeId: 'b4793e5d-61db-45c5-ae9a-b9ea9eb60e1b',
    template: {
      name: 'Riedel MediorNet MicroN',
      category: 'Video',
      inputs: [
        ...num('3G-SDI In', 12, 'BNC'),
        { id: '', name: 'Sync Ref In/Out', type: 'BNC', connectorType: 'BNC', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('3G-SDI Out', 12, 'BNC'),
        { id: '', name: 'Sync Ref Out', type: 'BNC', connectorType: 'BNC' },
        ...num('MediorNet 10G SFP+', 8, 'SFP+', true),
        ...num('MADI (optisch)', 2, 'Fiber', true),
        { id: '', name: 'LAN', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      width: 260, height: 444,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const broadcastToolsTemplates: EquipmentTemplate[] = BROADCAST_TOOLS_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchBroadcastToolsTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of BROADCAST_TOOLS_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('decimator') ||
    lower.includes('dmon-') ||
    lower.includes('md-hx') ||
    lower.includes('teradek') ||
    lower.includes('bolt') ||
    lower.includes('mediornet') ||
    lower.includes('micron') ||
    lower.includes('riedel')
  if (!isBrandKnown) return null
  for (const entry of BROADCAST_TOOLS_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
