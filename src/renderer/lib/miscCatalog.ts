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
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

export const MISC_CATALOG: MiscEntry[] = [

  // ── Rosendahl nanosyncs ───────────────────────────────────────────────────

  // nanosyncs DDS — Direct Digital Synthesis, SD sync generator
  // Outputs: 4× Blackburst, 2× Word Clock, LTC In/Out
  // Rentman: "Rosendahl nanosyncs DDS Audio Clock and Video sync reference generator"
  {
    match: ['rosendahl', 'nanosyncs', 'dds'],
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
]

/** Flat list of all built-in misc templates (seeded into the library). */
export const miscTemplates: EquipmentTemplate[] = MISC_CATALOG.map((e) => e.template)

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
  for (const t of miscTemplates) {
    if (t.name.toLowerCase() === lower) return t
  }
  for (const entry of MISC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return entry.template
    }
  }
  return null
}
