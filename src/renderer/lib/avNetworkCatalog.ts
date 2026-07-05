// ───────────────────────────────────────────────────────────────────────────
// AV-Netzwerk-Katalog (AV-Switches, NDI-Konverter, Dante)
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

interface AvNetworkEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Autoritative Netzwerk-Rolle laut Datenblatt (Switch/Router). */
  networkKind?: 'switch' | 'router'
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: AvNetworkEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const AVNETWORK_CATALOG: AvNetworkEntry[] = [
  // Netgear M4250-10G2F-PoE+ (2021) — AV Line Managed Switch, 8x1G PoE+ (125 W) + 2x1G + 2xSFP, AV-Profile (Dante/NDI/AES67)
  // Quelle: https://www.netgear.com/support/product/gsm4212p
  {
    match: ['netgear', 'm4250-10g2f-poe+'],
    deviceTypeId: '92dcba31-e2aa-4ba3-bbca-83375fdbb97c',
    networkKind: 'switch',
    template: {
      name: 'Netgear M4250-10G2F-PoE+',
      category: 'Netzwerk',
      categoryProps: { poeBudgetW: 125 },
      inputs: [
        // keine
      ],
      outputs: [
        ...num('RJ45 PoE+', 8, 'Ethernet/RJ45', true),
        ...num('RJ45', 2, 'Ethernet/RJ45', true),
        ...num('SFP', 2, 'SFP', true),
      ],
      width: 260, height: 252,
    },
  },

  // Netgear M4250-26G4F-PoE+ (2021) — AV Line Managed Switch, 24x1G PoE+ (300 W) + 2x1G + 4xSFP, AV-Profile (Dante/NDI/AES67)
  // Quelle: https://support.netgear.com/support/product/gsm4230p
  {
    match: ['netgear', 'm4250-26g4f-poe+'],
    deviceTypeId: 'af2817ec-1604-4b72-9d6c-fc385edf8b74',
    networkKind: 'switch',
    template: {
      name: 'Netgear M4250-26G4F-PoE+',
      category: 'Netzwerk',
      categoryProps: { poeBudgetW: 300 },
      inputs: [
        // keine
      ],
      outputs: [
        ...num('RJ45 PoE+', 24, 'Ethernet/RJ45', true),
        ...num('RJ45', 2, 'Ethernet/RJ45', true),
        ...num('SFP', 4, 'SFP', true),
      ],
      width: 260, height: 540,
    },
  },

  // Luminex GigaCore 16Xt (2018) — Touring-AV-Switch (etherCON), Dante/AES67/sACN/Art-Net-Profile, PoE-Option bis 180 W, RLinkX-Redundanz
  // Quelle: https://www.luminex.be/products/gigacore/
  {
    match: ['gigacore', '16xt'],
    deviceTypeId: '41806ac2-4515-4c94-922a-72a17e9f7332',
    networkKind: 'switch',
    template: {
      name: 'Luminex GigaCore 16Xt',
      category: 'Netzwerk',
      inputs: [
        // keine
      ],
      outputs: [
        ...num('etherCON', 12, 'Ethernet/RJ45', true),
        ...num('SFP', 4, 'SFP', true),
      ],
      width: 260, height: 316,
    },
  },

  // BirdDog Flex 4K IN (2021) — HDMI zu Full-NDI-Encoder bis UHD 4K30/1080p60, PoE, Tally/Comms/PTZ-Steuerung, 15W-DC-Ausgang
  // Quelle: https://birddog.tv/flex-overview/flex-techspecs/
  {
    match: ['flex', '4k in'],
    deviceTypeId: 'f472514c-647b-4956-9b61-92b9bc1ad996',
    template: {
      name: 'BirdDog Flex 4K IN',
      category: 'IP/NDI',
      isConverter: true,
      inputs: [
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Audio In/Out (3.5mm, Dante)', type: 'Klinke', connectorType: 'Klinke' },
      ],
      outputs: [
        { id: '', name: 'NDI/PoE (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      width: 260, height: 140,
    },
  },

  // BirdDog Flex 4K OUT (2021) — Full-NDI zu HDMI-Decoder bis 4K, PoE, Tally/Comms
  // Quelle: https://birddog.tv/flex-overview/flex-techspecs/
  {
    match: ['flex', '4k out'],
    deviceTypeId: 'b23e0c0e-92e0-48a2-a855-3812b775983c',
    template: {
      name: 'BirdDog Flex 4K OUT',
      category: 'IP/NDI',
      isConverter: true,
      inputs: [
        { id: '', name: 'NDI/PoE (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Audio In/Out (3.5mm, Dante)', type: 'Klinke', connectorType: 'Klinke' },
      ],
      outputs: [
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
      ],
      width: 260, height: 140,
    },
  },

  // Magewell Pro Convert HDMI 4K Plus (2019) — HDMI-2.0 zu Full-NDI-Encoder bis DCI-4K60, 8ch Embedded Audio, PoE
  // Quelle: https://www.magewell.com/products/pro-convert-hdmi-4k-plus
  {
    match: ['pro convert', 'hdmi', '4k'],
    deviceTypeId: '60b05acc-b521-4a32-82ea-8c44f7709c70',
    template: {
      name: 'Magewell Pro Convert HDMI 4K Plus',
      category: 'IP/NDI',
      isConverter: true,
      inputs: [
        { id: '', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' },
      ],
      outputs: [
        { id: '', name: 'HDMI Loop Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'NDI (RJ45 GbE)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      width: 260, height: 140,
    },
  },

  // Luminex GigaCore 10t (2022) — Touring-Switch, PoE++ (802.3af/at/bt) auf jedem Kupfer-Port, Dante/AES67/sACN/Art-Net-Profile
  // Quelle: https://www.luminex.be/products/gigacore/gigacore-10t/
  {
    match: ['gigacore', '10t'],
    deviceTypeId: '605c86c2-344b-4652-92e6-7eceeb2b26ab',
    networkKind: 'switch',
    template: {
      name: 'Luminex GigaCore 10t',
      category: 'Netzwerk',
      inputs: [
        // keine
      ],
      outputs: [
        ...num('etherCON', 8, 'Ethernet/RJ45', true),
        ...num('SFP', 2, 'SFP', true),
      ],
      width: 260, height: 220,
    },
  },

  // Luminex GigaCore 26i (2019) — Install-AV-Switch 24x RJ45 + 6x SFP, PoE-Variante verfuegbar, Dante/AES67-Profile
  // Quelle: https://www.luminex.be/products/gigacore/
  {
    match: ['gigacore', '26i'],
    deviceTypeId: 'b70cec7b-17f9-4a60-b417-a4052ef6ee48',
    networkKind: 'switch',
    template: {
      name: 'Luminex GigaCore 26i',
      category: 'Netzwerk',
      inputs: [
        // keine
      ],
      outputs: [
        ...num('RJ45', 24, 'Ethernet/RJ45', true),
        ...num('SFP', 6, 'SFP', true),
      ],
      width: 260, height: 540,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const avNetworkTemplates: EquipmentTemplate[] = AVNETWORK_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchAvNetworkTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of AVNETWORK_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('netgear m42') ||
    lower.includes('netgear m43') ||
    lower.includes('m4250') ||
    lower.includes('m4300') ||
    lower.includes('m4350') ||
    lower.includes('gigacore') ||
    lower.includes('luminex') ||
    lower.includes('birddog') ||
    lower.includes('magewell') ||
    lower.includes('kiloview') ||
    lower.includes('dante avio') ||
    lower.includes('avio')
  if (!isBrandKnown) return null
  for (const entry of AVNETWORK_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
