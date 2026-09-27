// ───────────────────────────────────────────────────────────────────────────
// Funkstrecken-Katalog (Drahtlos-Mikrofonie + IEM)
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

interface WirelessAudioEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: WirelessAudioEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const WIRELESS_AUDIO_CATALOG: WirelessAudioEntry[] = [
  // Sennheiser EW IEM G4 (SR) (2018) — Stereo-IEM-Sender, RF bis 50 mW, Rackmount halbe 19 Zoll
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-iem-g4
  {
    match: ['iem', 'g4'],
    deviceTypeId: '17582c72-e61e-41c4-8264-53254efee398',
    template: {
      manufacturerUrl: 'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-iem-g4',
      name: 'Sennheiser EW IEM G4 (SR)',
      category: 'Wireless',
      inputs: [
        ...num('Audio In L/R (Combo XLR/TRS)', 2, 'XLR'),
      ],
      outputs: [
        ...num('Loop Out L/R', 2, 'Klinke'),
        { id: '', name: 'Antenne Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 140,
    },
  },

  // Sennheiser EW 500 G4 (EM 300-500) (2018) — True-Diversity-Empfaenger, 88 MHz Schaltbandbreite, WSM-Steuerung ueber LAN
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-500-g4
  {
    match: ['g4', '500'],
    deviceTypeId: '6d10c291-7122-456b-9e36-ad19e4e30581',
    template: {
      manufacturerUrl: 'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-500-g4',
      name: 'Sennheiser EW 500 G4 (EM 300-500)',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenne A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenne B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        { id: '', name: 'XLR Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Line Out (6.3mm)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
      ],
      width: 260, height: 140,
    },
  },

  // Sennheiser EW-DX EM 2 Dante (2023) — 2-Kanal-Digitalempfaenger, AES-256, PoE, Dante (Single/Split/Redundanz-Modus)
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-dx-em-2-dante
  {
    match: ['ew-dx', 'em 2'],
    deviceTypeId: '2c20ec58-4eec-4e6f-98a6-017379da8fda',
    template: {
      manufacturerUrl: 'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/ew-dx-em-2-dante',
      name: 'Sennheiser EW-DX EM 2 Dante',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenne A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenne B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Dante/PoE (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Control (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('XLR Out', 2, 'XLR'),
        ...num('Line Out 1-2 (6.3mm)', 2, 'Jack 6.35 mm'),
      ],
      width: 260, height: 140,
    },
  },

  // Sennheiser Digital 6000 (EM 6000) (2016) — 2-Kanal-Digitalempfaenger (Long Range), Antennen-Kaskade, Dante an Bord
  // Quelle: https://www.sennheiser.com/en-us/catalog/products/wireless-systems/digital-6000
  {
    match: ['em 6000'],
    deviceTypeId: '989c3a28-d8af-4d0a-8ed6-c6093d7d2dc0',
    template: {
      manufacturerUrl: 'https://www.sennheiser.com/en-us/catalog/products/wireless-systems/digital-6000',
      name: 'Sennheiser Digital 6000 (EM 6000)',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenne A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenne B', type: 'BNC', connectorType: 'BNC' },
        ...num('Dante/Control 1-2 (RJ45)', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('XLR Out', 2, 'XLR'),
        ...num('AES3 Out', 2, 'XLR'),
      ],
      width: 260, height: 140,
    },
  },

  // Shure QLXD4 (2015) — Digital-Diversity-Empfaenger, AES-256, Wireless Workbench ueber LAN
  // Quelle: https://www.shure.com/en-US/products/wireless-systems/qlx-d_digital_wireless
  {
    match: ['qlxd4'],
    deviceTypeId: 'c5f97ce0-2bb5-4da3-b210-d7ed00e42b5f',
    template: {
      manufacturerUrl: 'https://www.shure.com/en-US/products/wireless-systems/qlx-d_digital_wireless',
      name: 'Shure QLXD4',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenne A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenne B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        { id: '', name: 'XLR Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Line Out (6.3mm)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
      ],
      width: 260, height: 140,
    },
  },

  // Shure ULXD4Q (2015) — Quad-Digitalempfaenger 1 HE, Dante, Antennen-Kaskade fuer 2. Empfaenger, AES-256
  // Quelle: https://www.shure.com/en-US/products/wireless-systems/ulx-d_digital_wireless/ulxd4q
  {
    match: ['ulxd4q'],
    deviceTypeId: 'fc7e6880-2377-4015-8855-f69c9bfbb9a8',
    template: {
      manufacturerUrl: 'https://www.shure.com/en-US/products/wireless-systems/ulx-d_digital_wireless/ulxd4q',
      name: 'Shure ULXD4Q',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenne A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenne B', type: 'BNC', connectorType: 'BNC' },
        ...num('Dante/Network 1-2 (RJ45)', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('XLR Out', 4, 'XLR'),
        ...num('RF Cascade A/B', 2, 'BNC'),
      ],
      width: 260, height: 156,
    },
  },

  // Shure PSM 1000 (P10T) (2015) — Dual-Stereo-IEM-Rack-Sender, 100 mW, Wireless Workbench, IEC-Kaskade
  // Quelle: https://www.shure.com/en-US/products/in-ear-monitoring/psm1000/p10t
  {
    match: ['p10t'],
    deviceTypeId: '5504f8e6-dd18-46e9-8c00-f6283c34d2cd',
    template: {
      manufacturerUrl: 'https://www.shure.com/en-US/products/in-ear-monitoring/psm1000/p10t',
      name: 'Shure PSM 1000 (P10T)',
      category: 'Wireless',
      inputs: [
        ...num('Audio In 1-4 (Combo XLR/TRS)', 4, 'XLR'),
        ...num('Network 1-2 (RJ45)', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('Loop Out', 4, 'Klinke'),
        { id: '', name: 'Antenne Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Monitor Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 156,
    },
  },

  // Shure UA844+SWB (470–960 MHz) — aktiver Antennenverteiler fuer bis zu fuenf
  // Empfaenger (vier Ausgaenge je Zweig + Kaskade, laut Anschlussbild), vier
  // DC-Ausgaenge (14–18 V) fuer die Empfaenger. Steckertyp der DC-Buchsen
  // nennt das Blatt nicht → Custom.
  // Quelle: https://pubs.shure.com/view/guide/UA844SWBplus/en-US.pdf
  {
    match: ['ua844'],
    deviceTypeId: '560c54d0-b31b-4a87-be2d-5e14acf24aaa',
    template: {
      manufacturerUrl: 'https://pubs.shure.com/view/guide/UA844SWBplus/en-US.pdf',
      name: 'Shure UA844+SWB',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenna A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenna B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'DC In (15 V)', type: 'Custom', connectorType: 'Custom' },
      ],
      outputs: [
        ...num('RF Out A', 4, 'BNC'),
        ...num('RF Out B', 4, 'BNC'),
        ...num('Cascade', 2, 'BNC'),
        ...num('DC Out (14–18 V)', 4, 'Custom'),
      ],
      width: 260, height: 156,
    },
  },

  // Sennheiser ASA 214-UHF (470–870 MHz; ASA 214-1G8 gleiche Buchsen) —
  // Antennensplitter 2 x 1:4, A1–A4 fuehren 12 V fuer die Empfaenger,
  // RF OUT A zum Kaskadieren eines zweiten ASA 214.
  // Quelle: https://www.sennheiser.com/globalassets/digizuite/41635-en-sp_1186_v1.0_asa_214_product_specification_en.pdf
  {
    match: ['asa 214'],
    deviceTypeId: 'dcfaa89f-b12e-4892-80b1-3e7325a5393e',
    template: {
      manufacturerUrl: 'https://www.sennheiser.com/globalassets/digizuite/41635-en-sp_1186_v1.0_asa_214_product_specification_en.pdf',
      name: 'Sennheiser ASA 214-UHF',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'ANT RF In A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'ANT RF In B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'DC In (13.8 V)', type: 'Custom', connectorType: 'Custom' },
      ],
      outputs: [
        ...num('RF Out A', 4, 'BNC'),
        ...num('RF Out B', 4, 'BNC'),
        { id: '', name: 'RF Out A (Cascade)', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 156,
    },
  },

  // Shure AD4D (Axient Digital, 2 Kanaele) — Antenne A/B und Kaskade C/D auf
  // BNC, 2x XLR + 2x 6,35 mm trafosymmetrisch, AES3, Word Clock In/Thru,
  // 4x Ethernet (2 Dante, 2 Steuerung mit PoE). AES3- und Word-Clock-Buchse
  // nennt das Blatt nicht → Custom. Leistung: „Maximum 23 W … Idle 15 W".
  // Quelle: https://pubs.shure.com/view/guide/AD4D/en-US.pdf
  {
    match: ['ad4d'],
    deviceTypeId: '3d8575b1-57ab-4738-a430-b014cb47bab1',
    template: {
      manufacturerUrl: 'https://pubs.shure.com/view/guide/AD4D/en-US.pdf',
      name: 'Shure AD4D',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenna A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenna B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Word Clock In', type: 'Custom', connectorType: 'Custom' },
        ...num('Dante', 2, 'Ethernet/RJ45', true),
        ...num('Control (PoE)', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('XLR Out', 2, 'XLR'),
        ...num('Line Out (6.35 mm)', 2, 'Jack 6.35 mm'),
        { id: '', name: 'AES3 Out', type: 'Custom', connectorType: 'Custom' },
        { id: '', name: 'RF Cascade C', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RF Cascade D', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Word Clock Thru', type: 'Custom', connectorType: 'Custom' },
        { id: '', name: 'Phones (front)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
      ],
      powerConsumptionWatts: 23,
      width: 260, height: 156,
    },
  },

  // Shure AD4Q (Axient Digital, 4 Kanaele) — wie AD4D, 4x XLR (3 und 4
  // umschaltbar auf AES3) und 4x 6,35 mm. Leistung: „Maximum 31 W … Idle 21 W".
  // Quelle: https://pubs.shure.com/view/guide/AD4Q/en-US.pdf
  {
    match: ['ad4q'],
    deviceTypeId: '43ecc5c9-7501-4c30-982e-1d52633d19a3',
    template: {
      manufacturerUrl: 'https://pubs.shure.com/view/guide/AD4Q/en-US.pdf',
      name: 'Shure AD4Q',
      category: 'Wireless',
      inputs: [
        { id: '', name: 'Antenna A', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Antenna B', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Word Clock In', type: 'Custom', connectorType: 'Custom' },
        ...num('Dante', 2, 'Ethernet/RJ45', true),
        ...num('Control (PoE)', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('XLR Out', 4, 'XLR'),
        ...num('Line Out (6.35 mm)', 4, 'Jack 6.35 mm'),
        { id: '', name: 'RF Cascade C', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'RF Cascade D', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Word Clock Thru', type: 'Custom', connectorType: 'Custom' },
        { id: '', name: 'Phones (front)', type: 'Jack 6.35 mm', connectorType: 'Jack 6.35 mm' },
      ],
      powerConsumptionWatts: 31,
      width: 260, height: 170,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const wirelessAudioTemplates: EquipmentTemplate[] = WIRELESS_AUDIO_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchWirelessAudioTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of WIRELESS_AUDIO_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('sennheiser') ||
    lower.includes('shure') ||
    lower.includes('ew-dx') ||
    lower.includes('qlxd') ||
    lower.includes('ulxd') ||
    lower.includes('psm') ||
    lower.includes('p10t') ||
    lower.includes('em 6000') ||
    lower.includes('iem') ||
    lower.includes('ew ') ||
    lower.includes('axient') ||
    lower.includes('ua844') ||
    lower.includes('asa 214')
  if (!isBrandKnown) return null
  for (const entry of WIRELESS_AUDIO_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
