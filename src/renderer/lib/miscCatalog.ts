import type { EquipmentTemplate, Port } from '../types/equipment'

// Miscellaneous professional A/V equipment templates for rental catalog matching.
// Covers: Rosendahl nanosyncs sync generators, Behringer X32 digital mixers,
// Decimator SDI/HDMI converters, AJA recorders/scalers, Miranda frame sync,
// TC Electronics metering, Yamaha studio monitors.
// Verified against talentwerk filmproduktion Rentman account (April 2026).

const port = (name: string, connectorType: Port['connectorType'] = 'BNC'): Port => ({
  id: '',
  name,
  type: connectorType,
  connectorType,
})

const sdiIn  = (n: string) => port(n, 'BNC')
const sdiOut = (n: string) => port(n, 'BNC')
const hdmiIn  = (n: string) => port(n, 'HDMI')
const hdmiOut = (n: string) => port(n, 'HDMI')
const xlrIn  = (n: string) => port(n, 'XLR')
const xlrOut = (n: string) => port(n, 'XLR')
const eth    = (n: string) => port(n, 'Ethernet/RJ45')
const custom = (n: string) => port(n, 'Custom')

const SYNC  = 'Sync/Referenz'
const AUDIO = 'Audio'
const VIDEO = 'Video'

interface MiscEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: MiscEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const MISC_CATALOG: MiscEntry[] = [

  // ── Rosendahl nanosyncs ───────────────────────────────────────────────────

  // nanosyncs DDS — Direct Digital Synthesis, SD sync generator
  // Outputs: 4× Blackburst, 2× Word Clock, LTC In/Out
  // Rentman: "Rosendahl nanosyncs DDS Audio Clock and Video sync reference generator"
  {
    match: ['rosendahl', 'nanosyncs', 'dds'],
    deviceTypeId: '05ddafe7-7f90-40df-895b-701c86927f6f',
    template: {
      name: 'Rosendahl nanosyncs DDS',
      category: SYNC,
      inputs: [
        sdiIn('LTC In (BNC)'),
        sdiIn('Ref In (BNC)'),
      ],
      outputs: [
        sdiOut('Blackburst Out 1'),
        sdiOut('Blackburst Out 2'),
        sdiOut('Blackburst Out 3'),
        sdiOut('Blackburst Out 4'),
        sdiOut('Word Clock Out 1 (BNC)'),
        sdiOut('Word Clock Out 2 (BNC)'),
        sdiOut('LTC Out (BNC)'),
      ],
      width: 220, height: 260,
    },
  },

  // nanosyncs HD — HD/SD multistandard sync generator
  // Outputs: 4× HD Tri-Level, 4× Blackburst, Word Clock, LTC In/Out
  // Rentman: "Rosendahl nanosyncs hd Multistandard Sync Engine"
  {
    match: ['rosendahl', 'nanosyncs', 'hd'],
    deviceTypeId: '7e663a57-fa24-4239-b093-8ad60c62039c',
    template: {
      name: 'Rosendahl nanosyncs HD',
      category: SYNC,
      inputs: [
        sdiIn('LTC In (BNC)'),
        sdiIn('Ref In (BNC)'),
      ],
      outputs: [
        sdiOut('HD Tri-Level Out 1'),
        sdiOut('HD Tri-Level Out 2'),
        sdiOut('HD Tri-Level Out 3'),
        sdiOut('HD Tri-Level Out 4'),
        sdiOut('Blackburst Out 1'),
        sdiOut('Blackburst Out 2'),
        sdiOut('Blackburst Out 3'),
        sdiOut('Blackburst Out 4'),
        sdiOut('Word Clock Out (BNC)'),
        sdiOut('LTC Out (BNC)'),
      ],
      width: 220, height: 340,
    },
  },

  // Generic Nanosync / nanosyncs (catch-all)
  // Rentman: "Nanosync"
  {
    match: ['nanosync'],
    deviceTypeId: '284e7133-0c24-40cf-a701-3b3e5a025a39',
    template: {
      name: 'Nanosync',
      category: SYNC,
      inputs: [sdiIn('Ref In (BNC)')],
      outputs: [
        sdiOut('Blackburst Out 1'),
        sdiOut('Blackburst Out 2'),
        sdiOut('Tri-Level Out 1'),
        sdiOut('Tri-Level Out 2'),
      ],
      width: 200, height: 160,
    },
  },

  // ── Behringer X32 ─────────────────────────────────────────────────────────

  // X32 Compact — 40-input, 16 mic/line preamps, 2U
  // Rentman: "Behringer X32 Compact"
  {
    match: ['behringer', 'x32', 'compact'],
    deviceTypeId: 'f3b3574c-477b-466e-85c6-4e3b9d832ba7',
    template: {
      name: 'Behringer X32 Compact',
      category: AUDIO,
      inputs: [
        ...Array.from({ length: 16 }, (_, i) => xlrIn(`Ch ${i + 1} In`)),
        xlrIn('AES/EBU In L'),
        xlrIn('AES/EBU In R'),
        eth('AES50-A (EtherCon)'),
        eth('AES50-B (EtherCon)'),
      ],
      outputs: [
        xlrOut('Main L Out'),
        xlrOut('Main R Out'),
        ...Array.from({ length: 6 }, (_, i) => xlrOut(`Bus ${i + 1} Out`)),
        xlrOut('AES/EBU Out L'),
        xlrOut('AES/EBU Out R'),
        eth('AES50-A Out (EtherCon)'),
        eth('AES50-B Out (EtherCon)'),
      ],
      width: 280, height: 560,
    },
  },

  // X32 Rack — same I/O as Compact, rack-mount
  // Rentman: "Behringer X32 Rack"
  {
    match: ['behringer', 'x32', 'rack'],
    deviceTypeId: 'd8243024-8bcc-4de3-9f72-3b0f4e4e9a5e',
    template: {
      name: 'Behringer X32 Rack',
      category: AUDIO,
      inputs: [
        ...Array.from({ length: 16 }, (_, i) => xlrIn(`Ch ${i + 1} In`)),
        xlrIn('AES/EBU In L'),
        xlrIn('AES/EBU In R'),
        eth('AES50-A (EtherCon)'),
        eth('AES50-B (EtherCon)'),
      ],
      outputs: [
        xlrOut('Main L Out'),
        xlrOut('Main R Out'),
        ...Array.from({ length: 6 }, (_, i) => xlrOut(`Bus ${i + 1} Out`)),
        xlrOut('AES/EBU Out L'),
        xlrOut('AES/EBU Out R'),
        eth('AES50-A Out (EtherCon)'),
        eth('AES50-B Out (EtherCon)'),
      ],
      width: 280, height: 560,
    },
  },

  // ── Decimator ─────────────────────────────────────────────────────────────

  // MD-Cross V2 — bidirectional SDI/HDMI cross converter
  // Rentman: "Decimator MD-Cross V2"
  {
    match: ['decimator', 'md-cross'],
    deviceTypeId: '9fcfada5-8fc8-43bc-8eb4-9e0c6e9e1f99',
    template: {
      name: 'Decimator MD-Cross V2',
      category: VIDEO,
      inputs: [
        sdiIn('SDI In (3G/HD/SD)'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out (3G/HD/SD)'),
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 140,
    },
  },

  // MD-HX — HDMI/SDI bidirectional converter
  // Rentman: "Decimator MD-HX"
  {
    match: ['decimator', 'md-hx'],
    deviceTypeId: '58a5d7ab-3b87-4fdf-9156-db58f04fc600',
    template: {
      name: 'Decimator MD-HX',
      category: VIDEO,
      inputs: [
        sdiIn('SDI In (3G/HD/SD)'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 140,
    },
  },

  // ── AJA ───────────────────────────────────────────────────────────────────

  // KiPro Recorder — ProRes/DNxHD field recorder
  // Rentman: "AJA KiPro Recorder"
  {
    match: ['aja', 'kipro'],
    deviceTypeId: '17528d76-a3d0-4002-afee-e164d50509f0',
    template: {
      name: 'AJA KiPro Recorder',
      category: VIDEO,
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
        xlrIn('XLR L In'),
        xlrIn('XLR R In'),
        sdiIn('LTC In (BNC)'),
      ],
      outputs: [
        sdiOut('SDI Out (Monitor)'),
        hdmiOut('HDMI Out'),
        eth('Ethernet'),
      ],
      width: 220, height: 200,
    },
  },

  // ROI-DVI Scaler — DVI/HDMI → SDI with region-of-interest scaling
  // Rentman: "Aja ROI-DVI Scaler"
  {
    match: ['aja', 'roi'],
    deviceTypeId: 'c3ecd98d-e10c-4797-a671-84721f38095a',
    template: {
      name: 'AJA ROI-DVI Scaler',
      category: VIDEO,
      inputs: [
        hdmiIn('HDMI/DVI In'),
        sdiIn('Component In (BNC)'),
      ],
      outputs: [
        sdiOut('SDI Out (HD/SD)'),
        sdiOut('Component Out (BNC)'),
      ],
      width: 200, height: 160,
    },
  },

  // ── Miranda ───────────────────────────────────────────────────────────────

  // Miranda mini Densite 3G HDSD LKG — Logo Keyer / frame sync card
  // Rentman: "Miranda mini Densite 3G HDSD LKG"
  {
    match: ['miranda', 'densite'],
    deviceTypeId: 'af5b45e9-6152-45a3-8177-347bd4ca9f32',
    template: {
      name: 'Miranda mini Densite 3G HDSD LKG',
      category: VIDEO,
      inputs: [
        sdiIn('SDI In (3G/HD/SD)'),
        sdiIn('Ref In (BNC)'),
      ],
      outputs: [
        sdiOut('SDI Out (3G/HD/SD)'),
      ],
      width: 200, height: 120,
    },
  },

  // ── TC Electronics ────────────────────────────────────────────────────────

  // Clarity M Stereo — stereo/surround loudness metering display
  // Rentman: "TC Electronics Clarity M Stereo"
  {
    match: ['clarity m', 'stereo'],
    deviceTypeId: 'eba83ff5-bd49-4043-ab51-5b83fa842bd0',
    template: {
      name: 'TC Electronics Clarity M Stereo',
      category: AUDIO,
      inputs: [
        xlrIn('AES/EBU In L'),
        xlrIn('AES/EBU In R'),
        custom('S/PDIF In (RCA)'),
        hdmiIn('HDMI ARC In'),
      ],
      outputs: [
        custom('USB'),
      ],
      width: 200, height: 160,
    },
  },

  // ── Yamaha ────────────────────────────────────────────────────────────────

  // MSP3A — active near-field studio monitor (2021 revision)
  // Rentman: "Yamaha MSP3A"
  // MSP3A must be listed before MSP3 — 'msp3a' contains 'msp3'
  {
    match: ['yamaha', 'msp3a'],
    deviceTypeId: '596f2276-e86e-421b-98d2-e773ad006689',
    template: {
      name: 'Yamaha MSP3A',
      category: AUDIO,
      inputs: [
        xlrIn('XLR Balanced In'),
        custom('TRS 1/4" In'),
      ],
      outputs: [],
      width: 160, height: 100,
    },
  },

  // MSP3 — active near-field studio monitor (original)
  // Rentman: "Yamaha MSP3"
  {
    match: ['yamaha', 'msp3'],
    deviceTypeId: '22913e16-4812-4435-8136-019dbc778d4c',
    template: {
      name: 'Yamaha MSP3',
      category: AUDIO,
      inputs: [
        xlrIn('XLR Balanced In'),
        custom('TRS 1/4" In'),
      ],
      outputs: [],
      width: 160, height: 100,
    },
  },

  // ── Jünger Audio ──────────────────────────────────────────────────────────

  // DAP8 — 8-channel digital audio processor (loudness, dynamics, EQ)
  // Not in Rentman — added as library template for manual use.
  // I/O: 8× AES/EBU XLR In, 8× AES/EBU XLR Out, Word Clock In/Out (BNC),
  //      LTC In (BNC), Ethernet (remote control), optional SDI embedding.
  {
    match: ['dap8'],
    deviceTypeId: 'afdf7ac4-95bc-43cd-afae-ee9abb15efa8',
    template: {
      name: 'Jünger Audio DAP8',
      category: AUDIO,
      inputs: [
        xlrIn('AES/EBU In 1'),
        xlrIn('AES/EBU In 2'),
        xlrIn('AES/EBU In 3'),
        xlrIn('AES/EBU In 4'),
        xlrIn('AES/EBU In 5'),
        xlrIn('AES/EBU In 6'),
        xlrIn('AES/EBU In 7'),
        xlrIn('AES/EBU In 8'),
        sdiIn('Word Clock In (BNC)'),
        sdiIn('LTC In (BNC)'),
      ],
      outputs: [
        xlrOut('AES/EBU Out 1'),
        xlrOut('AES/EBU Out 2'),
        xlrOut('AES/EBU Out 3'),
        xlrOut('AES/EBU Out 4'),
        xlrOut('AES/EBU Out 5'),
        xlrOut('AES/EBU Out 6'),
        xlrOut('AES/EBU Out 7'),
        xlrOut('AES/EBU Out 8'),
        sdiOut('Word Clock Out (BNC)'),
      ],
      width: 240, height: 360,
    },
  },

  // d*ap8 variant name (Jünger uses asterisk in product line branding)
  {
    match: ['d*ap'],
    deviceTypeId: 'ed37b542-67a3-4344-8d85-2387f0322611',
    template: {
      name: 'Jünger Audio DAP8',
      category: AUDIO,
      inputs: [
        xlrIn('AES/EBU In 1'),
        xlrIn('AES/EBU In 2'),
        xlrIn('AES/EBU In 3'),
        xlrIn('AES/EBU In 4'),
        xlrIn('AES/EBU In 5'),
        xlrIn('AES/EBU In 6'),
        xlrIn('AES/EBU In 7'),
        xlrIn('AES/EBU In 8'),
        sdiIn('Word Clock In (BNC)'),
        sdiIn('LTC In (BNC)'),
      ],
      outputs: [
        xlrOut('AES/EBU Out 1'),
        xlrOut('AES/EBU Out 2'),
        xlrOut('AES/EBU Out 3'),
        xlrOut('AES/EBU Out 4'),
        xlrOut('AES/EBU Out 5'),
        xlrOut('AES/EBU Out 6'),
        xlrOut('AES/EBU Out 7'),
        xlrOut('AES/EBU Out 8'),
        sdiOut('Word Clock Out (BNC)'),
      ],
      width: 240, height: 360,
    },
  },

  // ── Decimator (zusätzliche Modelle, v7.9.72 / #189) ──────────────────
  // Decimator MD-LX — günstigster HDMI/SDI Bi-Direktional
  {
    match: ['decimator', 'md-lx'],
    deviceTypeId: '7bfc5316-f5cd-40b5-98b1-176faff75484',
    template: {
      name: 'Decimator MD-LX',
      category: VIDEO,
      inputs: [sdiIn('SDI In (3G/HD/SD)'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (3G/HD/SD)'), hdmiOut('HDMI Out')],
      width: 200, height: 120,
    },
  },
  // Decimator DMON-12S — 12G SDI/HDMI Multi-Viewer mit 12 Inputs
  {
    match: ['decimator', 'dmon-12s'],
    deviceTypeId: '162a03cf-2ffd-4af5-bf3b-adf3b5ef0898',
    template: {
      name: 'Decimator DMON-12S 12G Multi-Viewer',
      category: VIDEO,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'), sdiIn('SDI In 3'), sdiIn('SDI In 4'),
        sdiIn('SDI In 5'), sdiIn('SDI In 6'), sdiIn('SDI In 7'), sdiIn('SDI In 8'),
        sdiIn('SDI In 9'), sdiIn('SDI In 10'), sdiIn('SDI In 11'), sdiIn('SDI In 12'),
      ],
      outputs: [sdiOut('SDI MV Out 1'), sdiOut('SDI MV Out 2'), hdmiOut('HDMI MV Out')],
      width: 280, height: 420,
    },
  },
  // Decimator 12G Cross Converter
  {
    match: ['decimator', '12g cross'],
    deviceTypeId: '6f7aabc4-a35a-407d-a85b-3065fb3711d8',
    template: {
      name: 'Decimator 12G Cross Converter',
      category: VIDEO,
      inputs: [sdiIn('SDI In (12G/6G/3G/HD/SD)'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (12G/6G/3G/HD/SD)'), hdmiOut('HDMI Out')],
      width: 220, height: 140,
    },
  },

  // ── Sonnet Thunderbolt PCIe-Gehäuse + Decklink ───────────────────────
  // Sonnet Echo Express III-D (Thunderbolt 3 → 3 PCIe Slots) — gängige
  // Hülle für BMD Decklink. Ports + Kapazität: 1× TB3 In, 1× TB3 Loop,
  // 3× PCIe-Slot intern.
  {
    match: ['sonnet', 'echo express'],
    deviceTypeId: 'a98ad03b-aa1c-42c6-af53-45a9b9920216',
    template: {
      name: 'Sonnet Echo Express III-D (TB3, 3× PCIe)',
      category: 'IT/Server',
      inputs: [port('Thunderbolt 3 In (USB-C)', 'USB-C')],
      outputs: [port('Thunderbolt 3 Out (USB-C)', 'USB-C')],
      width: 240, height: 160,
      notes: 'Bestückbar mit 3× PCIe-Karten, z.B. BMD Decklink Duo 2 / Quad 2 / 8K Pro.',
    },
  },
  // Sonnet xMac mini Server (1HE 19" Gehäuse für Mac Mini + 2 PCIe)
  {
    match: ['sonnet', 'xmac mini'],
    deviceTypeId: '714a8c95-758d-463b-8da0-3e7cb0b4c3c5',
    template: {
      name: 'Sonnet xMac mini Server (1HE, TB, 2× PCIe)',
      category: 'IT/Server',
      inputs: [port('Thunderbolt In (USB-C)', 'USB-C'), port('LAN', 'Ethernet/RJ45')],
      outputs: [port('Thunderbolt Out (USB-C)', 'USB-C'), port('USB-A 1', 'USB')],
      width: 240, height: 200,
      isRackDevice: true,
      rackUnits: 1,
      notes: 'Bestückbar mit 2× PCIe-Karten + Mac Mini.',
    },
  },
  // BMD Decklink Duo 2 — typische PCIe-Karte für Sonnet-Gehäuse
  {
    match: ['decklink', 'duo 2'],
    deviceTypeId: '9c1a3037-70ba-4cd7-b50d-7dcc1cc0eed2',
    template: {
      name: 'Blackmagic Decklink Duo 2',
      category: 'Konverter',
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), sdiIn('SDI In 3'), sdiIn('SDI In 4')],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), sdiOut('SDI Out 3'), sdiOut('SDI Out 4')],
      width: 240, height: 220,
      notes: 'PCIe-Karte — in Sonnet Echo Express oder Mac Pro montieren.',
    },
  },
  // BMD Decklink Quad 2
  {
    match: ['decklink', 'quad 2'],
    deviceTypeId: '3453db03-4c07-4d3f-af40-34576266be6c',
    template: {
      name: 'Blackmagic Decklink Quad 2',
      category: 'Konverter',
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'), sdiIn('SDI In 3'), sdiIn('SDI In 4'),
        sdiIn('SDI In 5'), sdiIn('SDI In 6'), sdiIn('SDI In 7'), sdiIn('SDI In 8'),
      ],
      outputs: [
        sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), sdiOut('SDI Out 3'), sdiOut('SDI Out 4'),
        sdiOut('SDI Out 5'), sdiOut('SDI Out 6'), sdiOut('SDI Out 7'), sdiOut('SDI Out 8'),
      ],
      width: 240, height: 360,
      notes: 'PCIe-Karte — in Sonnet Echo Express oder Mac Pro montieren.',
    },
  },
]

/** Flat list of all built-in misc templates (seeded into the library). */
export const miscTemplates: EquipmentTemplate[] = MISC_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchMiscTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Brand guard: must mention a known brand/keyword to avoid false positives
  const isBrandKnown =
    lower.includes('rosendahl') ||
    lower.includes('nanosync') ||
    lower.includes('behringer') ||
    lower.includes('decimator') ||
    lower.includes('aja') ||
    lower.includes('miranda') ||
    (lower.includes('tc electronic') && lower.includes('clarity')) ||
    (lower.includes('yamaha') && lower.includes('msp')) ||
    lower.includes('dap8') ||
    lower.includes('d*ap') ||
    (lower.includes('j') && lower.includes('nger') && lower.includes('audio'))
  if (!isBrandKnown) return null
  // Exact name match first
  for (const entry of MISC_CATALOG) {
    if (entry.template.name.toLowerCase() === lower) return withTypeId(entry)
  }
  for (const entry of MISC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
