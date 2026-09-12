import type { EquipmentTemplate, Port } from '../types/equipment'
import type { RecordingCapability } from './recording'

// Miscellaneous professional A/V equipment templates for rental catalog matching.
// Covers: Rosendahl nanosyncs sync generators, Behringer X32 digital mixers,
// Decimator SDI/HDMI converters, AJA recorders/scalers, Miranda frame sync,
// TC Electronics metering, Yamaha studio monitors.
// Verified against a professional rental-house Rentman inventory (April 2026).
//
// Belege gegen die offiziellen Hersteller-Produktseiten, wo eine von hier
// erreichbar ist (Recherche 2026-09, Quellen-URL je Eintrag): Rosendahl,
// Decimator, AJA, Yamaha Pro Audio und Blackmagic Decklink — je Modell auf
// Erreichbarkeit geprüft. Behringer X32 (behringer.com-URLs nachweislich
// schwer, vgl. die Markertek-Ausnahme in audioCatalog), Miranda/Grass Valley,
// TC Electronic, Jünger DAP8 und Sonnet bleiben ohne Beleg statt mit einer
// geratenen Adresse.

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
  /** Zeichnet dieses Modell auf, und in welcher Form (Bedarf 62)? Fehlt das
   *  Feld, ist das die Datenblatt-Aussage „zeichnet nicht auf" — siehe
   *  `recording.ts`. */
  records?: RecordingCapability
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
    // Quelle: https://www.rosendahl-studiotechnik.com/nanosyncs.html
    template: {
      manufacturerUrl: 'https://www.rosendahl-studiotechnik.com/nanosyncs.html',
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
    // Quelle: https://www.rosendahl-studiotechnik.com/nanosyncs.html
    template: {
      manufacturerUrl: 'https://www.rosendahl-studiotechnik.com/nanosyncs.html',
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
    // Quelle: https://www.rosendahl-studiotechnik.com/nanosyncs.html
    template: {
      manufacturerUrl: 'https://www.rosendahl-studiotechnik.com/nanosyncs.html',
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
    // Quelle: https://decimator.com/Products/MiniConverters/MD-CROSS/MD-CROSS.html
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MiniConverters/MD-CROSS/MD-CROSS.html',
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
    // Quelle: https://decimator.com/Products/MiniConverters/MD-HX/MD-HX.html
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MiniConverters/MD-HX/MD-HX.html',
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
    records: 'per-device',
    // Quelle: https://www.aja.com/products/ki-pro
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ki-pro',
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
    // Quelle: https://www.aja.com/products/roi
    template: {
      manufacturerUrl: 'https://www.aja.com/products/roi',
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
    // Quelle: https://www.yamahaproaudio.com/products/speakers/msp3a/index.html
    template: {
      manufacturerUrl: 'https://www.yamahaproaudio.com/products/speakers/msp3a/index.html',
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
    // Quelle: https://www.yamahaproaudio.com/products/speakers/msp3/index.html
    template: {
      manufacturerUrl: 'https://www.yamahaproaudio.com/products/speakers/msp3/index.html',
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
    // Quelle: https://decimator.com/Products/MiniConverters/MD-LX/MD-LX.html
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MiniConverters/MD-LX/MD-LX.html',
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
    // Quelle: https://decimator.com/Products/MultiViewers/DMON-12S%20MultiViewer/DMON-12S.html
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MultiViewers/DMON-12S%20MultiViewer/DMON-12S.html',
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
    // Quelle: https://decimator.com/Products/MiniConverters/12G-CROSS/12G-CROSS.html
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MiniConverters/12G-CROSS/12G-CROSS.html',
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
    // Quelle: https://www.blackmagicdesign.com/products/decklink
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/decklink',
      name: 'Blackmagic Decklink Duo 2',
      category: 'Converter',
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
    // Quelle: https://www.blackmagicdesign.com/products/decklink
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/decklink',
      name: 'Blackmagic Decklink Quad 2',
      category: 'Converter',
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
  // ── Roland V-Switcher & Teradek Encoder (Beleg: Hersteller-Produktseiten,
  //    je Modell per curl auf Erreichbarkeit geprüft, 2026-09) ──
  // Quelle: https://proav.roland.com/global/products/v-60hd
  {
    match: ['roland', 'v-60hd'],
    deviceTypeId: 'c1f1498e-a00a-4fdc-b0a8-a7a06b6cb1b2',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-60hd',
      name: 'Roland V-60HD',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        sdiOut('SDI Out 1'),
        port('USB Stream', 'USB'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-160hd
  {
    match: ['roland', 'v-160hd'],
    deviceTypeId: 'da2c9344-c217-4b6b-981c-840a32bd6fde',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-160hd',
      name: 'Roland V-160HD',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        sdiIn('SDI In 5'),
        sdiIn('SDI In 6'),
        sdiIn('SDI In 7'),
        sdiIn('SDI In 8'),
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
        hdmiIn('HDMI In 7'),
        hdmiIn('HDMI In 8'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        sdiOut('SDI Out 3'),
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
        port('USB-C Stream', 'USB'),
      ],
      width: 260, height: 300,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-1hd
  {
    match: ['roland', 'v-1hd'],
    deviceTypeId: '29eea792-d516-48bf-877b-b751d382ce4b',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-1hd',
      name: 'Roland V-1HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
      ],
      width: 220, height: 180,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-1sdi
  {
    match: ['roland', 'v-1sdi'],
    deviceTypeId: 'efa0ed3d-a66f-49f7-8126-7d6a4b404cef',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-1sdi',
      name: 'Roland V-1SDI',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
      ],
      width: 220, height: 180,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-8hd
  {
    match: ['roland', 'v-8hd'],
    deviceTypeId: '9fd7b49b-32ca-4c66-966f-0a2447506862',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-8hd',
      name: 'Roland V-8HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
        hdmiIn('HDMI In 7'),
        hdmiIn('HDMI In 8'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
      ],
      width: 240, height: 220,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-600uhd
  {
    match: ['roland', 'v-600uhd'],
    deviceTypeId: '2edf1e21-27d6-445d-a167-3cf245d4775c',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-600uhd',
      name: 'Roland V-600UHD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        sdiIn('12G-SDI In 1'),
        sdiIn('12G-SDI In 2'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
        sdiOut('12G-SDI Out 1'),
      ],
      width: 240, height: 240,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vr-4hd
  {
    match: ['roland', 'vr-4hd'],
    deviceTypeId: 'd7fd1b9c-bb9b-495d-b919-2924de639627',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vr-4hd',
      name: 'Roland VR-4HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        port('USB Stream', 'USB'),
      ],
      width: 220, height: 180,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vr-6hd
  {
    match: ['roland', 'vr-6hd'],
    deviceTypeId: 'eebf5cb4-31f2-4c35-87a7-6c59c28227fb',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vr-6hd',
      name: 'Roland VR-6HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
        port('USB-C Stream', 'USB'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://teradek.com/products/vidiu-x
  {
    match: ['teradek', 'vidiu x'],
    deviceTypeId: '243d3fda-f8ed-4412-8a8d-cec61ca9de9e',
    template: {
      manufacturerUrl: 'https://teradek.com/products/vidiu-x',
      name: 'Teradek VidiU X',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://teradek.com/products/vidiu-go
  {
    match: ['teradek', 'vidiu go'],
    deviceTypeId: '5662501d-6a9d-4d38-b109-4fb0723b8c46',
    template: {
      manufacturerUrl: 'https://teradek.com/products/vidiu-go',
      name: 'Teradek VidiU Go',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 160,
    },
  },
  // Quelle: https://teradek.com/products/vidiu-pro
  {
    match: ['teradek', 'vidiu pro'],
    deviceTypeId: 'fa797b7c-d576-4a5d-9ae9-a25a5a29f5cb',
    template: {
      manufacturerUrl: 'https://teradek.com/products/vidiu-pro',
      name: 'Teradek VidiU Pro',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://teradek.com/products/cube-755
  {
    match: ['teradek', 'cube 755'],
    deviceTypeId: 'ae018a64-1a37-48d1-bfdd-bfc974b67634',
    template: {
      manufacturerUrl: 'https://teradek.com/products/cube-755',
      name: 'Teradek Cube 755',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://teradek.com/products/cube-655
  {
    match: ['teradek', 'cube 655'],
    deviceTypeId: 'a5e581d1-553e-44bb-8a76-cb92d9e494e3',
    template: {
      manufacturerUrl: 'https://teradek.com/products/cube-655',
      name: 'Teradek Cube 655',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://teradek.com/products/serv-4k
  {
    match: ['teradek', 'serv 4k'],
    deviceTypeId: 'a7b82771-c0d0-4b82-94e7-c1a733d2560e',
    template: {
      manufacturerUrl: 'https://teradek.com/products/serv-4k',
      name: 'Teradek Serv 4K',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 160,
    },
  },
  // Quelle: https://teradek.com/products/serv-pro
  {
    match: ['teradek', 'serv pro'],
    deviceTypeId: 'fd812dc8-d5b1-44b8-877f-56576c1194b8',
    template: {
      manufacturerUrl: 'https://teradek.com/products/serv-pro',
      name: 'Teradek Serv Pro',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 160,
    },
  },
  // Quelle: https://teradek.com/products/wave
  {
    match: ['teradek', 'wave'],
    deviceTypeId: '44d19d65-6200-41b7-a620-ef780c8c299e',
    template: {
      manufacturerUrl: 'https://teradek.com/products/wave',
      name: 'Teradek Wave',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN'),
      ],
      width: 200, height: 140,
    },
  },
  // ── AJA / Blackmagic UltraStudio / Decimator (Beleg: Hersteller-Produktseiten,
  //    je Modell per curl geprüft, 2026-09) ──
  // Quelle: https://www.aja.com/products/hi5-12g
  {
    match: ['aja', 'hi5-12g'],
    deviceTypeId: '3c76d498-411e-4ac4-a9e4-80aa1886871a',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/hi5-12g',
      name: 'AJA Hi5-12G',
      category: 'Converter',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        sdiOut('SDI Loop Out'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.aja.com/products/ha5-12g
  {
    match: ['aja', 'ha5-12g'],
    deviceTypeId: 'b1a43b69-c438-4f01-a090-2d104e9d88ba',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ha5-12g',
      name: 'AJA HA5-12G',
      category: 'Converter',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.aja.com/products/ha5-4k
  {
    match: ['aja', 'ha5-4k'],
    deviceTypeId: '1ab1b696-87e5-4223-b06d-860ec965857a',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ha5-4k',
      name: 'AJA HA5-4K',
      category: 'Converter',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        sdiOut('SDI Out 3'),
        sdiOut('SDI Out 4'),
      ],
      width: 200, height: 180,
    },
  },
  // Quelle: https://www.aja.com/products/roi-hdmi
  {
    match: ['aja', 'roi-hdmi'],
    deviceTypeId: '2bbc1b6e-19c1-48d5-88cf-5f91c3853d4f',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/roi-hdmi',
      name: 'AJA ROI-HDMI',
      category: 'Converter',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out (ROI-Scaler)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.aja.com/products/fs-hdr
  {
    match: ['aja', 'fs-hdr'],
    deviceTypeId: 'b6f03080-8696-4e3b-8886-bd78ef0a96ae',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/fs-hdr',
      name: 'AJA FS-HDR',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        hdmiIn('HDMI In'),
        eth('LAN'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 220,
    },
  },
  // Quelle: https://www.aja.com/products/fs4
  {
    match: ['aja', 'fs4'],
    deviceTypeId: '24fbf338-562e-4653-9c6d-b5156394f74e',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/fs4',
      name: 'AJA FS4',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        eth('LAN'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        sdiOut('SDI Out 3'),
        sdiOut('SDI Out 4'),
        hdmiOut('HDMI Monitor'),
      ],
      width: 260, height: 240,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/ultrastudio-4k-mini
  {
    match: ['blackmagic', 'ultrastudio', '4k mini'],
    deviceTypeId: 'd93e7465-15e3-4a8f-b697-5e804ec976e2',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/ultrastudio-4k-mini',
      name: 'Blackmagic UltraStudio 4K Mini',
      category: 'Video',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
        custom('Thunderbolt 3'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        xlrIn('XLR Audio In 1'),
        xlrIn('XLR Audio In 2'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/ultrastudio-monitor-3g
  {
    match: ['blackmagic', 'ultrastudio', 'monitor'],
    deviceTypeId: '9bc37443-c79e-4ce5-9fcd-0ccbb7899879',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/ultrastudio-monitor-3g',
      name: 'Blackmagic UltraStudio Monitor 3G',
      category: 'Video',
      inputs: [
        custom('Thunderbolt 3'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/ultrastudio-recorder-3g
  {
    match: ['blackmagic', 'ultrastudio', 'recorder'],
    deviceTypeId: '4c7d84f0-991c-4d85-adf0-6cb31f05ff71',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/ultrastudio-recorder-3g',
      name: 'Blackmagic UltraStudio Recorder 3G',
      category: 'Video',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        custom('Thunderbolt 3'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://decimator.com/Products/MultiViewers/DMON-QUAD%20MultiViewer/DMON-QUAD.html
  {
    match: ['decimator', 'dmon-quad'],
    deviceTypeId: 'ce8397a6-aac5-457b-bc97-8a13e37cdf9f',
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MultiViewers/DMON-QUAD%20MultiViewer/DMON-QUAD.html',
      name: 'Decimator DMON-QUAD',
      category: 'Monitors',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 220, height: 180,
    },
  },
  // Quelle: https://decimator.com/Products/MultiViewers/DMON-4S%20MultiViewer/DMON-4S.html
  {
    match: ['decimator', 'dmon-4s'],
    deviceTypeId: 'cc024c6d-8b05-43a3-943b-8243c4c41ba5',
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MultiViewers/DMON-4S%20MultiViewer/DMON-4S.html',
      name: 'Decimator DMON-4S',
      category: 'Monitors',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 220, height: 180,
    },
  },
  // Quelle: https://decimator.com/Products/MultiViewers/DMON-6S%20MultiViewer/DMON-6S.html
  {
    match: ['decimator', 'dmon-6s'],
    deviceTypeId: 'd83dd61e-77b8-443e-8177-44e91998f654',
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MultiViewers/DMON-6S%20MultiViewer/DMON-6S.html',
      name: 'Decimator DMON-6S',
      category: 'Monitors',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        sdiIn('SDI In 5'),
        sdiIn('SDI In 6'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 220, height: 200,
    },
  },
  // Quelle: https://decimator.com/Products/MultiViewers/DMON-16S%20MultiViewer/DMON-16S.html
  {
    match: ['decimator', 'dmon-16s'],
    deviceTypeId: 'c76fd014-22f9-41cb-956f-c30855d77ced',
    template: {
      manufacturerUrl: 'https://decimator.com/Products/MultiViewers/DMON-16S%20MultiViewer/DMON-16S.html',
      name: 'Decimator DMON-16S',
      category: 'Monitors',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        sdiIn('SDI In 5'),
        sdiIn('SDI In 6'),
        sdiIn('SDI In 7'),
        sdiIn('SDI In 8'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 240,
    },
  },
  // ── Kiloview NDI-Encoder/Decoder (Beleg: kiloview.com, je Modell per curl
  //    geprüft, 2026-09) ──
  // Quelle: https://www.kiloview.com/en/ndi/n1/
  {
    match: ['kiloview', 'n1'],
    deviceTypeId: 'a577c36b-1a15-4c1d-90df-1ddb6681825c',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n1/',
      name: 'Kiloview N1',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n2/
  {
    match: ['kiloview', 'n2'],
    deviceTypeId: 'bd1d007e-ac69-46da-91d1-85b45530fd6a',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n2/',
      name: 'Kiloview N2',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n3/
  {
    match: ['kiloview', 'n3'],
    deviceTypeId: '9768ecd9-2670-462d-afa9-eaefa95eb7d1',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n3/',
      name: 'Kiloview N3',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n40/
  {
    match: ['kiloview', 'n40'],
    deviceTypeId: 'd61f8146-3ab2-4be2-9585-9e42e1dacaaa',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n40/',
      name: 'Kiloview N40',
      category: 'IP/NDI',
      inputs: [
        sdiIn('12G-SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n60/
  {
    match: ['kiloview', 'n60'],
    deviceTypeId: '483cf205-281d-41ff-b6fe-f7793af15fb0',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n60/',
      name: 'Kiloview N60',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/e1/
  {
    match: ['kiloview', 'e1'],
    deviceTypeId: '5f29d11f-98f7-43a2-abe3-1d63e1930be7',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/e1/',
      name: 'Kiloview E1',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/e2/
  {
    match: ['kiloview', 'e2'],
    deviceTypeId: '0856b42e-43fa-4bb6-bb2e-7acd0f8e279b',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/e2/',
      name: 'Kiloview E2',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/e3/
  {
    match: ['kiloview', 'e3'],
    deviceTypeId: '630b9c0b-985c-49ad-96b9-64cd2e486d94',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/e3/',
      name: 'Kiloview E3',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/p2/
  {
    match: ['kiloview', 'p2'],
    deviceTypeId: '120fbd66-ee2a-43a4-af80-090e8ff512ec',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/p2/',
      name: 'Kiloview P2',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/p3/
  {
    match: ['kiloview', 'p3'],
    deviceTypeId: '6dd278f8-0f72-4615-822b-56f750c7bb84',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/p3/',
      name: 'Kiloview P3',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/cv190/
  {
    match: ['kiloview', 'cv190'],
    deviceTypeId: 'b3372685-1aa6-4e08-8359-805de1792334',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/cv190/',
      name: 'Kiloview CV190',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
        eth('LAN (NDI)'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/d300/
  {
    match: ['kiloview', 'd300'],
    deviceTypeId: 'f87e4131-7d96-49e5-a550-0533d05a0f54',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/d300/',
      name: 'Kiloview D300',
      category: 'IP/NDI',
      inputs: [
        eth('LAN (NDI)'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        sdiOut('SDI Out'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/d350/
  {
    match: ['kiloview', 'd350'],
    deviceTypeId: 'c7aea796-86ce-4768-9eda-e44797923058',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/d350/',
      name: 'Kiloview D350',
      category: 'IP/NDI',
      inputs: [
        eth('LAN (NDI)'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        sdiOut('SDI Out'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/cube-r1/
  {
    match: ['kiloview', 'cube r1'],
    deviceTypeId: '48c08871-3218-44eb-942d-26619a2a7f97',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/cube-r1/',
      name: 'Kiloview Cube R1',
      category: 'IP/NDI',
      inputs: [
        eth('LAN (NDI)'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 140,
    },
  },
  // ── Magewell / Kiloview (Beleg: Hersteller-Produktseiten, je Modell per curl
  //    geprüft, 2026-09) ──
  // Quelle: https://www.magewell.com/products/pro-convert-hdmi-4k-plus
  {
    match: ['magewell', 'pro convert', 'hdmi 4k'],
    deviceTypeId: '82889ba3-ce5a-4bcf-b42d-ce7bbf7a76c7',
    template: {
      manufacturerUrl: 'https://www.magewell.com/products/pro-convert-hdmi-4k-plus',
      name: 'Magewell Pro Convert HDMI 4K Plus',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.magewell.com/products/pro-convert-sdi-4k-plus
  {
    match: ['magewell', 'pro convert', 'sdi 4k'],
    deviceTypeId: '0c36c579-0eaf-4f2d-a49a-44160df8bca0',
    template: {
      manufacturerUrl: 'https://www.magewell.com/products/pro-convert-sdi-4k-plus',
      name: 'Magewell Pro Convert SDI 4K Plus',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.magewell.com/products/pro-convert-hdmi-tx
  {
    match: ['magewell', 'pro convert', 'hdmi tx'],
    deviceTypeId: '486ce07d-6a71-446b-b742-ec6b8d62b419',
    template: {
      manufacturerUrl: 'https://www.magewell.com/products/pro-convert-hdmi-tx',
      name: 'Magewell Pro Convert HDMI TX',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.magewell.com/products/usb-capture-hdmi-4k-plus
  {
    match: ['magewell', 'usb capture', 'hdmi'],
    deviceTypeId: 'f1a76cac-2554-4f0e-b053-eea73ddefa70',
    template: {
      manufacturerUrl: 'https://www.magewell.com/products/usb-capture-hdmi-4k-plus',
      name: 'Magewell USB Capture HDMI 4K Plus',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        custom('USB 3.0'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.magewell.com/products/usb-capture-sdi-4k-plus
  {
    match: ['magewell', 'usb capture', 'sdi'],
    deviceTypeId: 'e88cc79a-aeda-4479-a97b-8cacffdfb2e1',
    template: {
      manufacturerUrl: 'https://www.magewell.com/products/usb-capture-sdi-4k-plus',
      name: 'Magewell USB Capture SDI 4K Plus',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        custom('USB 3.0'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n30/
  {
    match: ['kiloview', 'n30'],
    deviceTypeId: 'b712a373-503e-4005-af64-962bb8ff4132',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n30/',
      name: 'Kiloview N30',
      category: 'IP/NDI',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/n50/
  {
    match: ['kiloview', 'n50'],
    deviceTypeId: 'e4db6ef7-db02-4732-bbdc-6c45a81abe35',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/n50/',
      name: 'Kiloview N50',
      category: 'IP/NDI',
      inputs: [
        sdiIn('12G-SDI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/u40/
  {
    match: ['kiloview', 'u40'],
    deviceTypeId: '42697402-44b7-491a-bb1e-c3dca9ba228a',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/u40/',
      name: 'Kiloview U40',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        custom('USB'),
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/g2/
  {
    match: ['kiloview', 'g2'],
    deviceTypeId: '8fa254ed-e5e9-404a-a0f1-c0bc4cc507d9',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/g2/',
      name: 'Kiloview G2',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // Quelle: https://www.kiloview.com/en/ndi/m2/
  {
    match: ['kiloview', 'm2'],
    deviceTypeId: '78332a8c-fc28-4b30-80cc-5e36623a602c',
    template: {
      manufacturerUrl: 'https://www.kiloview.com/en/ndi/m2/',
      name: 'Kiloview M2',
      category: 'IP/NDI',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        eth('LAN (NDI)'),
      ],
      width: 200, height: 140,
    },
  },
  // ── Roland V-/XS-/VC-Switcher & Konverter, AJA (Beleg: Hersteller-Produkt-
  //    seiten, je Modell per curl geprüft, 2026-09) ──
  // Quelle: https://proav.roland.com/global/products/vc-1-hs/
  {
    match: ['roland', 'vc-1-hs'],
    deviceTypeId: '82ea88f0-d5b3-421b-88df-a2272bb86a8f',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vc-1-hs/',
      name: 'Roland VC-1-HS',
      category: 'Video Converter',
      inputs: [
        hdmiIn('HDMI In'),
        sdiIn('SDI In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vc-1-sc/
  {
    match: ['roland', 'vc-1-sc'],
    deviceTypeId: 'b8b73639-8048-4f91-a575-051d95dcdf20',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vc-1-sc/',
      name: 'Roland VC-1-SC',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vc-1-dl/
  {
    match: ['roland', 'vc-1-dl'],
    deviceTypeId: '68a752a9-af12-4500-baba-9e12bfb6ef56',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vc-1-dl/',
      name: 'Roland VC-1-DL',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/xs-62s/
  {
    match: ['roland', 'xs-62s'],
    deviceTypeId: '9d9feabe-7a1d-473b-b182-d6a37e19a390',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/xs-62s/',
      name: 'Roland XS-62S',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/xs-84h/
  {
    match: ['roland', 'xs-84h'],
    deviceTypeId: '4c28019c-a14e-465b-ae66-2be15d05f706',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/xs-84h/',
      name: 'Roland XS-84H',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
        hdmiIn('HDMI In 7'),
        hdmiIn('HDMI In 8'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
        hdmiOut('HDMI Out 4'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/xs-1hd/
  {
    match: ['roland', 'xs-1hd'],
    deviceTypeId: '9329823d-63cb-4d13-8f14-ace0e6a62f72',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/xs-1hd/',
      name: 'Roland XS-1HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vp-42h/
  {
    match: ['roland', 'vp-42h'],
    deviceTypeId: 'c48e7903-7c1a-44ad-9e3d-20980f78866e',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vp-42h/',
      name: 'Roland VP-42H',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-1200hd/
  {
    match: ['roland', 'v-1200hd'],
    deviceTypeId: 'b36b1870-fac4-4053-8f9f-5aa1efdddd26',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-1200hd/',
      name: 'Roland V-1200HD',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        sdiIn('SDI In 3'),
        sdiIn('SDI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
        hdmiIn('HDMI In 7'),
        hdmiIn('HDMI In 8'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        hdmiOut('HDMI Out 3'),
        hdmiOut('HDMI Out 4'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/p-20hd/
  {
    match: ['roland', 'p-20hd'],
    deviceTypeId: '319fdd22-1092-4b92-8b8f-d3ed5423db53',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/p-20hd/',
      name: 'Roland P-20HD',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        eth('LAN'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/vr-120hd/
  {
    match: ['roland', 'vr-120hd'],
    deviceTypeId: 'fc593190-82d8-4f39-9ffe-4aa5ac636bdb',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vr-120hd/',
      name: 'Roland VR-120HD',
      category: 'Video Mixer',
      inputs: [
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
      ],
      outputs: [
        hdmiOut('HDMI Out 1'),
        hdmiOut('HDMI Out 2'),
        eth('USB-C Stream'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://proav.roland.com/global/products/v-80hd/
  {
    match: ['roland', 'v-80hd'],
    deviceTypeId: '684a1453-28b5-4026-8f5d-f77edfbd55ff',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/v-80hd/',
      name: 'Roland V-80HD',
      category: 'Video Mixer',
      inputs: [
        sdiIn('SDI In 1'),
        sdiIn('SDI In 2'),
        hdmiIn('HDMI In 3'),
        hdmiIn('HDMI In 4'),
        hdmiIn('HDMI In 5'),
        hdmiIn('HDMI In 6'),
        hdmiIn('HDMI In 7'),
        hdmiIn('HDMI In 8'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        hdmiOut('HDMI Out 2'),
        hdmiOut('HDMI Out 3'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://www.aja.com/products/hdp3
  {
    match: ['aja', 'hdp3'],
    deviceTypeId: 'c8dddcaa-6f00-49a2-ad92-75cdf70c7863',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/hdp3',
      name: 'AJA Hi5 HDP3',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        sdiOut('SDI Loop Out'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://www.aja.com/products/u-tap-hdmi
  {
    match: ['aja', 'u-tap', 'hdmi'],
    deviceTypeId: 'c5ed0127-2283-4873-ab4b-f002d5a141e6',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/u-tap-hdmi',
      name: 'AJA U-TAP HDMI',
      category: 'Video',
      inputs: [
        hdmiIn('HDMI In'),
      ],
      outputs: [
        custom('USB 3.0'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://www.aja.com/products/ki-pro-ultra-12g
  {
    match: ['aja', 'ki-pro ultra'],
    deviceTypeId: '508757b6-40fb-4759-a707-fa3af5742e45',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ki-pro-ultra-12g',
      name: 'AJA Ki Pro Ultra 12G',
      category: 'Video',
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        xlrIn('XLR Audio In'),
      ],
      width: 240, height: 200,
    },
  },
  // Quelle: https://www.aja.com/products/3gm
  {
    match: ['aja', '3gm'],
    deviceTypeId: 'fe9ede87-36d3-4fbf-931a-da24cfb31ff2',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/3gm',
      name: 'AJA 3GM',
      category: 'Video Converter',
      inputs: [
        sdiIn('SDI In'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        sdiOut('SDI Out 3'),
        sdiOut('SDI Out 4'),
      ],
      width: 240, height: 200,
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
