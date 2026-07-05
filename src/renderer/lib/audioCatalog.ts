// ───────────────────────────────────────────────────────────────────────────
// Audio-Katalog (Digitalpulte + Stageboxen)
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

interface AudioEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: AudioEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const AUDIO_CATALOG: AudioEntry[] = [
  // Behringer X32 (2012) — 40-Input/25-Bus-Digitalpult, Midas-Preamps, AES50 je 48x48 Kanaele
  // Quelle: https://www.markertek.com/Attachments/Specifications/Behringer/X32-Specifications.pdf
  {
    match: ['x32'],
    deviceTypeId: 'c6e4526b-f6f8-4b99-bf55-8b15817b42cd',
    template: {
      name: 'Behringer X32',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        ...num('Aux In', 6, 'Klinke'),
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Remote (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        ...num('Aux Out', 6, 'Klinke'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Ultranet (P16)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        ...num('Phones L/R', 2, 'Klinke'),
      ],
      width: 260, height: 732,
    },
  },

  // Behringer Wing (2020) — 48-Kanal/28-Bus-Pult, 3x AES50 (je 48x48), StageConnect (32ch ueber XLR), 64x64-Expansion-Slot
  // Quelle: https://www.behringer.com/en/wing/wing-black
  {
    match: ['behringer', 'wing'],
    deviceTypeId: '29602fb3-d6bc-44f6-8689-88cd8accc8ce',
    template: {
      name: 'Behringer Wing',
      category: 'Audio',
      inputs: [
        ...num('Midas Pro Mic In', 8, 'XLR'),
        ...num('Aux In 1-8 (TRS)', 8, 'Klinke'),
        { id: '', name: 'AES/EBU In', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 C', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'StageConnect', type: 'XLR', connectorType: 'XLR' },
        ...num('LAN', 2, 'Ethernet/RJ45', true),
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('Midas Pro Out', 8, 'XLR'),
        ...num('Aux Out 1-8 (TRS)', 8, 'Klinke'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
      ],
      width: 260, height: 444,
    },
  },

  // Midas M32 Live (2017) — 40-Input/25-Bus, Midas-Pro-Preamps, X32-Plattform, DL-Stageboxen via AES50
  // Quelle: https://www.midasconsoles.com/product.html?modelCode=0603-AAF
  {
    match: ['midas', 'm32'],
    deviceTypeId: 'f4f89c92-7ccf-48a5-8590-0504a3670ae1',
    template: {
      name: 'Midas M32 Live',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        ...num('Aux In', 6, 'Klinke'),
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Remote (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        ...num('Aux Out', 6, 'Klinke'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Ultranet', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      width: 260, height: 732,
    },
  },

  // Allen & Heath SQ-5 (2018) — 48ch/96kHz-Digitalpult, SLink fuer Stageboxen (bis 48 Mic-Inputs), I/O-Slot fuer Dante/Waves
  // Quelle: https://www.allen-heath.com/hardware/sq/sq-5/
  {
    match: ['sq-5'],
    deviceTypeId: 'c5e58caf-e376-40ec-97e7-809b0f55257e',
    template: {
      name: 'Allen & Heath SQ-5',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 16, 'XLR'),
        { id: '', name: 'SLink', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB-B', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('XLR Out', 12, 'XLR'),
        { id: '', name: 'AES Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 364,
    },
  },

  // Allen & Heath Avantis (2019) — 64ch/42-Bus-Pult (XCVI), 2x SLink, 2 I/O-Slots (Dante/gigaACE/Waves)
  // Quelle: https://www.allen-heath.com/hardware/avantis/
  {
    match: ['avantis'],
    deviceTypeId: '47bf1a7b-a072-4a19-b44d-754ea00bef35',
    template: {
      name: 'Allen & Heath Avantis',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 12, 'XLR'),
        { id: '', name: 'AES In (Stereo)', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'SLink 1', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'SLink 2', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('XLR Out', 12, 'XLR'),
        ...num('AES Out 1-2 (Stereo)', 2, 'XLR'),
      ],
      width: 260, height: 316,
    },
  },

  // Allen & Heath dLive CDM32 MixRack (2016) — C-Class-MixRack 32x16, XCVI-Core 128ch/64 Busse, 0.7 ms @96kHz, I/O-Slot (Dante/MADI/gigaACE)
  // Quelle: https://www.allen-heath.com/hardware/dlive-series/dlive-mixracks/
  {
    match: ['dlive', 'cdm32'],
    deviceTypeId: '2fc7c067-7b4b-4838-839b-7cbc3f3ad90f',
    template: {
      name: 'Allen & Heath dLive CDM32 MixRack',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        ...num('DX Link', 2, 'Ethernet/RJ45', true),
        { id: '', name: 'gigaACE/Surface Link', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        { id: '', name: 'ME/Monitor Port', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      width: 260, height: 636,
    },
  },

  // Yamaha CL5 (2012) — 72ch-Flaggschiff-Pult, Dante-nativ (Rio-Stageboxen), 3x MY-Slots, Dan-Dugan-Automixer
  // Quelle: https://usa.yamaha.com/products/proaudio/mixers/cl_series/specs.html
  {
    match: ['yamaha', 'cl5'],
    deviceTypeId: '67e29486-75dd-492b-af8a-40f12d62a5a1',
    template: {
      name: 'Yamaha CL5',
      category: 'Audio',
      inputs: [
        ...num('Omni In', 8, 'XLR'),
        { id: '', name: 'Dante Primary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Dante Secondary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Word Clock In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('Omni Out', 8, 'XLR'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Word Clock Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 252,
    },
  },

  // Yamaha QL5 (2014) — 64ch-Pult, Dante-nativ, 2x MY-Slots, Dugan-Automixer, GPI 5/5
  // Quelle: https://usa.yamaha.com/products/proaudio/mixers/ql_series/specs.html
  {
    match: ['yamaha', 'ql5'],
    deviceTypeId: '20cc630c-cd57-42b1-af70-16eb45d0c725',
    template: {
      name: 'Yamaha QL5',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        { id: '', name: 'Dante Primary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Dante Secondary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Word Clock In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        ...num('Omni Out', 16, 'XLR'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Word Clock Out', type: 'BNC', connectorType: 'BNC' },
      ],
      width: 260, height: 636,
    },
  },

  // Yamaha DM3-D (2023) — Ultrakompaktes 22ch/96kHz-Pult, Dante 16x16, 18x18-USB-Interface
  // Quelle: https://usa.yamaha.com/products/proaudio/mixers/dm3/specs.html
  {
    match: ['yamaha', 'dm3'],
    deviceTypeId: 'c8791489-fba5-4a0a-99c5-1218f6d997fd',
    template: {
      name: 'Yamaha DM3-D',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 12, 'XLR'),
        ...num('Combo In', 4, 'XLR'),
        { id: '', name: 'Dante Primary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Dante Secondary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB-C', type: 'USB-C', connectorType: 'USB-C' },
      ],
      outputs: [
        ...num('Omni Out', 8, 'XLR'),
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 380,
    },
  },

  // DiGiCo S21 (2015) — 48ch/46-Bus-Pult, 2x DMI-Slots (MADI/Dante/Waves/Analog), 96kHz-FPGA
  // Quelle: https://digico.biz/consoles/s21/
  {
    match: ['digico', 's21'],
    deviceTypeId: '053f9f56-9232-416f-80f1-c2f7f34040ca',
    template: {
      name: 'DiGiCo S21',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 24, 'XLR'),
        { id: '', name: 'Word Clock In', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Network (RJ45)', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'USB', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        ...num('XLR Out', 12, 'XLR'),
        { id: '', name: 'AES Out', type: 'XLR', connectorType: 'XLR' },
        { id: '', name: 'Word Clock Out', type: 'BNC', connectorType: 'BNC' },
        { id: '', name: 'Phones', type: 'Klinke', connectorType: 'Klinke' },
      ],
      width: 260, height: 492,
    },
  },

  // Behringer S16 (2013) — Digital-Stagebox 16x8, Midas-Preamps, AES50-Kaskade
  // Quelle: https://www.behringer.com/product.html?modelCode=0606-ABC
  {
    match: ['behringer', 's16'],
    deviceTypeId: 'd18f77b3-d775-4f93-9cf5-4242320960d3',
    template: {
      name: 'Behringer S16',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 16, 'XLR'),
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('XLR Out', 8, 'XLR'),
        { id: '', name: 'Ultranet', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        ...num('ADAT Out', 2, 'Custom'),
      ],
      width: 260, height: 348,
    },
  },

  // Behringer S32 (2016) — Digital-Stagebox 32x16, Midas-Preamps, AES50
  // Quelle: https://www.behringer.com/product.html?modelCode=0606-ACQ
  {
    match: ['behringer', 's32'],
    deviceTypeId: 'cc59f6ab-1e25-4db7-a0c8-e0ca2aab66c4',
    template: {
      name: 'Behringer S32',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        { id: '', name: 'Ultranet', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45' },
        ...num('ADAT Out', 4, 'Custom'),
      ],
      width: 260, height: 604,
    },
  },

  // Midas DL32 (2015) — Stagebox 32x16, Midas-Pro-Preamps, AES50 SuperMAC
  // Quelle: https://www.midasconsoles.com/product.html?modelCode=0605-AAC
  {
    match: ['midas', 'dl32'],
    deviceTypeId: 'd707763c-36b6-4df0-90e4-2f785580637e',
    template: {
      name: 'Midas DL32',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        { id: '', name: 'AES50 A', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'AES50 B', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        ...num('Ultranet', 2, 'Ethernet/RJ45'),
        ...num('ADAT Out', 2, 'Custom'),
        { id: '', name: 'AES/EBU Out', type: 'XLR', connectorType: 'XLR' },
      ],
      width: 260, height: 604,
    },
  },

  // Yamaha Rio3224-D2 (2017) — Dante-Stagebox 32x16+8 AES, redundantes Dante + Netzteil, CL/QL-nativ
  // Quelle: https://usa.yamaha.com/products/proaudio/interfaces/r_series_adda_2/index.html
  {
    match: ['rio3224'],
    deviceTypeId: '5fb4ef98-c63c-4dae-b872-1f7b5a29d7d3',
    template: {
      name: 'Yamaha Rio3224-D2',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 32, 'XLR'),
        { id: '', name: 'Dante Primary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
        { id: '', name: 'Dante Secondary', type: 'Ethernet/RJ45', connectorType: 'Ethernet/RJ45', direction: 'bidirectional' as const },
      ],
      outputs: [
        ...num('XLR Out', 16, 'XLR'),
        ...num('AES/EBU Out 1-4 (8ch)', 4, 'XLR'),
      ],
      width: 260, height: 604,
    },
  },

  // Allen & Heath DX168 (2018) — Portabler DX-Expander 16x8 @96kHz fuer dLive/SQ/Avantis, dual DX-Link-Redundanz
  // Quelle: https://www.allen-heath.com/hardware/everything-i-o/dx168/
  {
    match: ['dx168'],
    deviceTypeId: '9453d902-5dfc-4453-a744-b7fcd8f1500f',
    template: {
      name: 'Allen & Heath DX168',
      category: 'Audio',
      inputs: [
        ...num('Mic In', 16, 'XLR'),
        ...num('DX Link', 2, 'Ethernet/RJ45', true),
      ],
      outputs: [
        ...num('XLR Out', 8, 'XLR'),
      ],
      width: 260, height: 348,
    },
  },
]

/** Flat list of all built-in templates (seeded into the library). */
export const audioTemplates: EquipmentTemplate[] = AUDIO_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchAudioTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  for (const entry of AUDIO_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Marken-Guard: mindestens ein bekanntes Marken-/Serien-Keyword noetig,
  // damit generische Namen nicht faelschlich matchen.
  const isBrandKnown = lower.includes('x32') ||
    lower.includes('wing') ||
    lower.includes('behringer') ||
    lower.includes('midas') ||
    lower.includes('m32') ||
    lower.includes('dl32') ||
    lower.includes('allen') ||
    lower.includes('heath') ||
    lower.includes('sq-') ||
    lower.includes('dlive') ||
    lower.includes('avantis') ||
    lower.includes('yamaha') ||
    lower.includes('cl5') ||
    lower.includes('ql5') ||
    lower.includes('dm3') ||
    lower.includes('rio3224') ||
    lower.includes('dx168') ||
    lower.includes('digico') ||
    lower.includes('s21')
  if (!isBrandKnown) return null
  for (const entry of AUDIO_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
