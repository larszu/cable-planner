import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// #1199 — Kramer, Blackmagic, Magewell und Sony aus der Datenblatt-Liste des
// Issues. Jede Zeile folgt der abgerufenen Herstellerseite bzw. dem
// Herstellerblatt (abgerufen 2026-11-14). Was die Quelle nicht nennt, steht
// nicht da: ein Steckertyp, den die Seite nicht benennt, ist 'Generic'.
//
// Blackmagic 2110 IP: Anzahlen und Leistung aus der Techspecs-Seite, die
// Steckertypen (BNC fuer SDI und Referenz, RJ45/SFP fuer Ethernet) aus dem
// Handbuch documents.blackmagicdesign.com/UserManuals/
// Blackmagic2110IPConvertersManual.pdf, Abschnitte „Connectors"/„Rear Panel".
//
// ─── OFFEN ─────────────────────────────────────────────────────────────────
//
// DeckLink 8K Pro G2: die Techspecs nennen keinen Steckertyp fuer SDI, Sync
//   und RS-422; das Desktop-Video-Handbuch beschreibt die G2 nicht.
// UltraStudio 4K Mini (miscCatalog): Analog-Video-Eingang ohne Buchsenzahl.
// HyperDeck ISO Recorder 100G: Leistungsaufnahme „TBC", SDI-Steckertyp ungenannt.
// Mehrere 2110-Modelle: Leistungsaufnahme „TBC"/„TBA" auf der Seite.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})
const bidi = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  ...port(name, connectorType, type),
  direction: 'bidirectional',
})

const sdi = (name: string) => port(name, 'BNC', 'SDI')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const n = (count: number, f: (i: number) => Port) => Array.from({ length: count }, (_, i) => f(i + 1))

interface Nachtrag1199Entry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}


export const GERAETE_NACHTRAG_1199_CATALOG: Nachtrag1199Entry[] = [
  // ── Kramer ────────────────────────────────────────────────────────────────

  // Quelle: https://www1.kramerav.com/de/product/vm-4ux
  {
    match: ['kramervm4ux', 'vm4ux'],
    deviceTypeId: '055f2434-b73f-44dc-bf7a-50a098e75d79',
    template: {
      manufacturerUrl: 'https://www1.kramerav.com/de/product/vm-4ux',
      name: 'Kramer VM-4UX',
      category: 'Converter',
      inputs: [
        sdi('12G-SDI In'),
        port('5 V DC In', 'Generic', 'Power'),
      ],
      outputs: n(4, (i) => sdi(`12G-SDI Out ${i}`)),
      isRackDevice: false,
      notes: '1:4 12G-SDI distribution amplifier, reclocking · 5 V DC, 250 mA (PSU 5.2 V/4 A) · 12 x 7.1 x 2.4 cm · 0.18 kg',
      width: 240,
      height: 200,
    },
  },

  // Quelle: https://www1.kramerav.com/de/product/MC3-2S-2S
  {
    match: ['kramermc32s2s', 'mc32s2s'],
    deviceTypeId: '75e4139a-cd93-4120-8701-015514651f57',
    template: {
      manufacturerUrl: 'https://www1.kramerav.com/de/product/MC3-2S-2S',
      name: 'Kramer MC3-2S-2S',
      category: 'Video Router',
      inputs: [sdi('12G-SDI In 1'), sdi('12G-SDI In 2')],
      outputs: [sdi('12G-SDI Out 1 (scaled)'), sdi('12G-SDI Out 2 (scaled)')],
      isRackDevice: false,
      notes: 'Input/output card for Kramer modular matrices (any card slot) · 12G 4K60 4:2:2 · 1–2 frames latency',
      width: 240,
      height: 160,
    },
  },

  // Quelle: https://www1.kramerav.com/de/product/VP-475UX
  {
    match: ['kramervp475ux', 'vp475ux'],
    deviceTypeId: '64c38354-5b9a-4db8-b26a-6a9b54798b5f',
    template: {
      manufacturerUrl: 'https://www1.kramerav.com/de/product/VP-475UX',
      name: 'Kramer VP-475UX',
      category: 'Converter',
      inputs: [
        sdi('12G-SDI In 1'),
        sdi('12G-SDI In 2'),
        eth('Ethernet (LAN, web UI)'),
        port('Mini USB (firmware)', 'USB Mini-B', 'USB'),
        port('AC In (100–240 V)', 'Generic', 'Power'),
      ],
      outputs: [
        port('HDMI Out 1', 'HDMI', 'HDMI'),
        port('HDMI Out 2', 'HDMI', 'HDMI'),
        sdi('SDI Loop Out 1'),
        sdi('SDI Loop Out 2'),
        port('Audio Out 1 (balanced / AES)', 'XLR', 'Audio'),
        port('Audio Out 2 (balanced / AES)', 'XLR', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'Dual-channel 12G-SDI to HDMI 2.0 scaler, 4K60 4:4:4 · 19", 1 RU · 58 VA max · ~50 ms latency',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://cdn.kramerav.com/web/downloads/manuals/kramer_zeevee-z4k12gsdiencc3u-data-sheet.pdf
  {
    match: ['kramerz4k12gsdiencc3u', 'z4k12gsdiencc3u'],
    deviceTypeId: '25efc4fb-26e4-4a64-a15d-3853592dd3b1',
    template: {
      manufacturerUrl: 'https://cdn.kramerav.com/web/downloads/manuals/kramer_zeevee-z4k12gsdiencc3u-data-sheet.pdf',
      name: 'Kramer ZyPer4K Z4K12GSDIENCC3U',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        bidi('Audio In/Out (3.5 mm stereo)', 'Jack 3.5 mm TRS', 'Audio'),
        port('IR In (3.5 mm)', 'Jack 3.5 mm', 'IR'),
        bidi('RS-232 (9-pin D-sub)', 'DB9', 'RS-232'),
        port('USB 2.0 (Type B)', 'USB Type B', 'USB'),
        port('AC In (Neutrik NAC3MPX)', 'powerCON Input', 'Power'),
      ],
      outputs: [
        sdi('SDI Loop Out'),
        port('IR Out (3.5 mm)', 'Jack 3.5 mm', 'IR'),
        bidi('10 Gb Ethernet (media)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('1 Gb Ethernet (utility)', 'Ethernet/RJ45', 'Ethernet'),
      ],
      isRackDevice: false,
      notes: 'ZyPer4K AVoIP encoder (copper), needs a ZyPer4K decoder · 120/240 V AC · ~9 W · 220 x 199 x 71 mm · 2.1 kg',
      width: 280,
      height: 300,
    },
  },

  // ── Blackmagic: DeckLink, Teranex Mini 8K, HyperDeck ISO ─────────────────

  // Quelle: https://www.blackmagicdesign.com/products/decklink/techspecs/W-DLK-45
  {
    match: ['blackmagicdecklink8kprog2', 'decklink8kprog2'],
    deviceTypeId: '9f0fa076-3a00-4517-a518-29bc5a05c5af',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/decklink/techspecs/W-DLK-45',
      name: 'Blackmagic DeckLink 8K Pro G2',
      category: 'Converter',
      inputs: [
        ...n(4, (i) => bidi(`12G-SDI ${i} (bi-directional)`, 'Generic', 'SDI')),
        port('HDMI 2.1 In', 'HDMI', 'HDMI'),
        port('Sync In (Tri-Sync / Black Burst)', 'Generic', 'Genlock'),
      ],
      outputs: [
        port('HDMI 2.1 Out', 'HDMI', 'HDMI'),
        port('RS-422 Out', 'Generic', 'RS-422'),
      ],
      isRackDevice: false,
      notes: 'PCIe Gen 3 x8 card (2 slots, needs computer PSU connection) · HDMI via supplied mezzanine card · 30 W · SDI connector type not stated by Blackmagic',
      width: 260,
      height: 240,
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/teranexmini8k/techspecs
  // Steckertypen: TeranexMiniConvertersManual.pdf, „Teranex Mini – SDI to HDMI 8K HDR", Connectors.
  {
    match: ['blackmagicteranexminisditohdmi8khdr', 'teranexminisditohdmi8khdr', 'teranexminisditohdmi8k'],
    deviceTypeId: 'dfa71dec-c536-4d40-85c9-f0422d25c193',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/teranexmini8k/techspecs',
      name: 'Blackmagic Teranex Mini SDI to HDMI 8K HDR',
      category: 'Converter',
      inputs: [
        ...['A', 'B', 'C', 'D'].map((c) => sdi(`12G-SDI In ${c}`)),
        port('Ethernet (PoE+, setup)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup / calibration probe)', 'USB-C', 'USB'),
        port('AC In (IEC C14, 100–240 V)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...['A', 'B', 'C', 'D'].map((c) => sdi(`SDI Loop Out ${c}`)),
        ...['A', 'B', 'C', 'D'].map((c) => port(`HDMI 2.0 Out ${c}`, 'HDMI', 'HDMI')),
        port('Analog Out L (RCA)', 'Cinch/RCA', 'Audio'),
        port('Analog Out R (RCA)', 'Cinch/RCA', 'Audio'),
      ],
      isRackDevice: false,
      notes: '8K via quad-link 12G-SDI to quad HDMI · HD/UHD from HDMI A · IEC C14 or PoE+ · 25 W',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/hyperdeckisorecorder100g/techspecs
  {
    match: ['blackmagichyperdeckisorecorder100g', 'hyperdeckisorecorder100g'],
    deviceTypeId: '46b6eb28-2dfd-4d65-be18-36cde67ef996',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/hyperdeckisorecorder100g/techspecs',
      name: 'Blackmagic HyperDeck ISO Recorder 100G',
      category: 'Video',
      inputs: [
        bidi('100G 2110 (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G 2110 (QSFP28) 2', 'QSFP28', 'Ethernet'),
        bidi('10G Control 1 (NMOS)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('10G Control 2 (NMOS)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('Reference Network 1 (PTP)', 'Ethernet/RJ45', 'PTP'),
        bidi('Reference Network 2 (PTP)', 'Ethernet/RJ45', 'PTP'),
        bidi('1G Management', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('SDI Monitor Out 1', 'Generic', 'SDI'),
        port('SDI Monitor Out 2', 'Generic', 'SDI'),
        port('HDMI Monitor Out', 'HDMI', 'HDMI'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: '8-channel ST 2110 ProRes recorder to network storage · ST 2022-7 over two 100G networks · two internal 100–240 V PSUs · power usage TBC',
      width: 280,
      height: 320,
    },
  },

  // ── Blackmagic 2110 IP ────────────────────────────────────────────────────

  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipconverter3x3g', '2110ipconverter3x3g'],
    deviceTypeId: '41996dbf-06db-4dd1-82d2-67ee3a60cf04',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Converter 3x3G',
      category: 'IP/NDI',
      inputs: [
        ...n(3, (i) => sdi(`3G-SDI In ${i}`)),
        bidi('10G Ethernet 2110 (PoE+)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(3, (i) => sdi(`3G-SDI Loop Out ${i}`)),
        ...n(3, (i) => sdi(`3G-SDI Out ${i}`)),
        port('Reference Out', 'BNC', 'Genlock'),
      ],
      isRackDevice: false,
      notes: '3 x 1080p60 in and out over one 10G link · IEC C14 or PoE+ · 20 W',
      width: 280,
      height: 280,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipsditohdmi12g', '2110ipsditohdmi12g'],
    deviceTypeId: 'c5095886-68f3-4e3f-a511-ecfc4c88428f',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP SDI to HDMI 12G',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        bidi('10G Ethernet 2110', 'Ethernet/RJ45', 'Ethernet'),
        port('Remote (audio level, 1/4" jack)', 'Jack 6.35 mm TRS', 'Control'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
        port('12 V DC In (locking 5.5 mm)', 'DC Barrel', 'Power'),
      ],
      outputs: [
        sdi('12G-SDI Loop Out'),
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        port('Analog Out L (XLR)', 'XLR', 'Audio'),
        port('Analog Out R (XLR)', 'XLR', 'Audio'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
        port('USB-C (webcam out / setup)', 'USB-C', 'USB'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '1/3 rack width, 1 RU · IEC C14 plus 12 V DC backup · power usage TBC',
      width: 280,
      height: 260,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipminiiptohdmi', '2110ipminiiptohdmi'],
    deviceTypeId: '31409e5d-ffab-4350-8b47-1121af077e64',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Mini IP to HDMI',
      category: 'IP/NDI',
      inputs: [
        port('10G Ethernet 2110 (PoE++)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('12 V DC In (locking 5.5 mm)', 'DC Barrel', 'Power'),
      ],
      outputs: [port('HDMI Out', 'HDMI', 'HDMI')],
      isRackDevice: false,
      notes: '12 V DC (12–16 V) or PoE++ · 18 W',
      width: 220,
      height: 160,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipminiiptohdmisfp', '2110ipminiiptohdmisfp'],
    deviceTypeId: 'c7399f2b-e75c-406d-9d84-5bdc68cd9838',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Mini IP to HDMI SFP',
      category: 'IP/NDI',
      inputs: [
        port('10G SFP (2110 or optical SDI)', 'SFP+', 'Fiber'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('12 V DC In (locking 5.5 mm)', 'DC Barrel', 'Power'),
      ],
      outputs: [port('HDMI Out', 'HDMI', 'HDMI')],
      isRackDevice: false,
      notes: '12 V DC (12–16 V) · power usage TBA',
      width: 220,
      height: 160,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipminibidirect12g', '2110ipminibidirect12g'],
    deviceTypeId: 'c1d47280-94d2-417d-a21e-548a20b2731d',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Mini BiDirect 12G',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        bidi('10G Ethernet 2110 (PoE++)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('Talkback (5-pin XLR)', 'XLR 5 Female', 'Audio'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('12 V DC In (locking 5.5 mm)', 'DC Barrel', 'Power'),
      ],
      outputs: [sdi('12G-SDI Out')],
      isRackDevice: false,
      notes: '12 V DC (12–16 V) or PoE++ · 18 W',
      width: 240,
      height: 200,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipminibidirect12gsfp', '2110ipminibidirect12gsfp'],
    deviceTypeId: '8607fdda-2fb4-4317-8735-c36c8eab722d',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Mini BiDirect 12G SFP',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        bidi('10G SFP (2110 or optical SDI)', 'SFP+', 'Fiber'),
        bidi('Talkback (5-pin XLR)', 'XLR 5 Female', 'Audio'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('12 V DC In (locking 5.5 mm)', 'DC Barrel', 'Power'),
      ],
      outputs: [sdi('12G-SDI Out')],
      isRackDevice: false,
      notes: '12 V DC (12–16 V) · 18 W',
      width: 240,
      height: 200,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipconverter4x12gpwr', '2110ipconverter4x12gpwr'],
    deviceTypeId: '351cf1be-efd0-4031-b5f4-2f0cf93c024e',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Converter 4x12G PWR',
      category: 'IP/NDI',
      inputs: [
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        sdi('12G-SDI PGM In'),
        ...n(4, (i) => bidi(`10G Ethernet 2110 ${i} (PoE out)`, 'Ethernet/RJ45', 'Ethernet')),
        bidi('1G Ethernet (setup)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => sdi(`12G-SDI Out ${i}`)),
        sdi('12G-SDI PGM Loop Out'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '4 bi-directional 12G-SDI/2110 channels, powers downstream devices (4 x 90 W PoE) · redundant PSUs · 410 W max incl. PoE',
      width: 280,
      height: 400,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipconverter8x12gsfp', '2110ipconverter8x12gsfp'],
    deviceTypeId: 'db7f9a2d-de03-44d9-aa14-84660e16ee13',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Converter 8x12G SFP',
      category: 'IP/NDI',
      inputs: [
        ...n(8, (i) => sdi(`12G-SDI In ${i}`)),
        sdi('12G-SDI PGM In'),
        ...n(8, (i) => bidi(`10G SFP ${i} (2110 or optical SDI)`, 'SFP+', 'Fiber')),
        bidi('1G Ethernet (setup)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(8, (i) => sdi(`12G-SDI Out ${i}`)),
        sdi('12G-SDI PGM Loop Out'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '8 bi-directional 12G-SDI channels, SFP modules for 2110 or optical SDI · redundant PSUs · 70 W max',
      width: 280,
      height: 560,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipupdowncross12g', '2110ipupdowncross12g'],
    deviceTypeId: '6b970f9c-6a3a-42a5-893a-2701217f021b',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP UpDownCross 12G',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Reference In', 'BNC', 'Genlock'),
        bidi('10G Ethernet 2110', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
        port('12 V DC In', 'Generic', 'Power'),
      ],
      outputs: [
        sdi('12G-SDI Loop Out'),
        sdi('12G-SDI Out 1'),
        sdi('12G-SDI Out 2'),
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        port('Reference Out', 'BNC', 'Genlock'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Standards converter SDI/HDMI/2110 · 30 W max',
      width: 280,
      height: 300,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ippresentationconverter', '2110ippresentationconverter'],
    deviceTypeId: 'caea6605-9ec5-488e-8171-d1a0492b7db0',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP Presentation Converter',
      category: 'IP/NDI',
      inputs: [
        port('PC Video In (front USB-C)', 'USB-C', 'USB'),
        port('PC Video In (rear USB-C, 45 W charging)', 'USB-C', 'USB'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Mic/Line In 1 (XLR/TRS combo)', 'Combo XLR/Jack', 'Audio'),
        port('Mic/Line In 2 (XLR/TRS combo)', 'Combo XLR/Jack', 'Audio'),
        bidi('10G Ethernet 2110', 'Ethernet/RJ45', 'Ethernet'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        sdi('12G-SDI Out'),
        port('Analog Out L (XLR)', 'XLR', 'Audio'),
        port('Analog Out R (XLR)', 'XLR', 'Audio'),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Computer via USB-C into 2110/SDI/HDMI · +48 V phantom on combo inputs · power usage TBA',
      width: 280,
      height: 300,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagic2110ipsditohdmi12g10', '2110ipsditohdmi12g10'],
    deviceTypeId: '03d59bf3-fd83-4ea1-8bf0-fe81a6064db8',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic 2110 IP SDI to HDMI 12G-10',
      category: 'IP/NDI',
      inputs: [
        sdi('12G-SDI In'),
        bidi('10G Ethernet 2110 (media 1)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('10G Ethernet 2110 (media 2)', 'Ethernet/RJ45', 'Ethernet'),
        bidi('1G Control Network', 'Ethernet/RJ45', 'Ethernet'),
        port('Remote (audio level, 1/4" jack)', 'Jack 6.35 mm TRS', 'Control'),
        port('AC In (IEC C14)', 'IEC 230V', 'Power'),
        port('12 V DC In (4-pin XLR)', 'XLR 4 Male', 'Power'),
      ],
      outputs: [
        sdi('12G-SDI Loop Out'),
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        ...n(10, (i) => port(`Analog Out ${i} (XLR)`, 'XLR', 'Audio')),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
        port('USB-C (webcam out / setup)', 'USB-C', 'USB'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'Two 10G media ports for redundancy, separate 1G management · IEC C14 plus 12 V DC · power usage TBC',
      width: 280,
      height: 460,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagicstudiobridge10gpwr', 'studiobridge10gpwr'],
    deviceTypeId: '302a8e29-416c-4846-b79b-4e49d0a71275',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic StudioBridge 10G PWR',
      category: 'IP/NDI',
      inputs: [
        bidi('100G 2110 (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G 2110 (QSFP28) 2', 'QSFP28', 'Ethernet'),
        ...n(8, (i) => bidi(`10G 2110 ${i} (PoE++)`, 'Ethernet/RJ45', 'Ethernet')),
        bidi('1G Control Network', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [],
      isRackDevice: true,
      rackUnits: 2,
      notes: '100G to 8 x 10G bridge, 8 x 90 W PoE to downstream devices · redundant PSUs · power usage TBC',
      width: 280,
      height: 380,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagicstudiobridge100g', 'studiobridge100g'],
    deviceTypeId: '15d56977-ed02-470d-bc28-3cd0eee7472e',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic StudioBridge 100G',
      category: 'IP/NDI',
      inputs: [
        bidi('100G Network (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G Network (QSFP28) 2', 'QSFP28', 'Ethernet'),
        bidi('100G Camera (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G Camera (QSFP28) 2', 'QSFP28', 'Ethernet'),
        bidi('10G SFP 1', 'SFP+', 'Fiber'),
        bidi('10G SFP 2', 'SFP+', 'Fiber'),
        bidi('10G Ethernet 1', 'Ethernet/RJ45', 'Ethernet'),
        bidi('10G Ethernet 2', 'Ethernet/RJ45', 'Ethernet'),
        bidi('1G Control Network', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'Bridges 100G URSA Cine cameras into a 2110 network · redundant PSUs · power usage TBC',
      width: 280,
      height: 400,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagicsdiexpander8x12g', 'sdiexpander8x12g'],
    deviceTypeId: 'aaecfe63-990f-4e44-9e98-f0cc22f1e047',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic SDI Expander 8x12G',
      category: 'IP/NDI',
      inputs: [
        ...n(8, (i) => port(`12G-SDI In ${i}`, 'Generic', 'SDI')),
        bidi('100G 2110 (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G 2110 (QSFP28) 2', 'QSFP28', 'Ethernet'),
        bidi('1G Control Network', 'Ethernet/RJ45', 'Ethernet'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(8, (i) => port(`12G-SDI Out ${i}`, 'Generic', 'SDI')),
        port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '8 x 12G-SDI in/out to 100G 2110 (e.g. for HyperDeck ISO Recorder 100G) · SDI connector type not stated · power usage TBC',
      width: 280,
      height: 420,
    },
  },
  // Quelle: https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs
  {
    match: ['blackmagicupdowncross100g', 'updowncross100g'],
    deviceTypeId: '15951b88-5eee-4bd9-b1fa-f6f8cfe66a76',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagic2110ipconverter/techspecs',
      name: 'Blackmagic UpDownCross 100G',
      category: 'IP/NDI',
      inputs: [
        bidi('100G 2110 (QSFP28) 1', 'QSFP28', 'Ethernet'),
        bidi('100G 2110 (QSFP28) 2', 'QSFP28', 'Ethernet'),
        bidi('1G Control Network', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (setup)', 'USB-C', 'USB'),
        port('AC In 1 (IEC C14)', 'IEC 230V', 'Power'),
        port('AC In 2 (IEC C14)', 'IEC 230V', 'Power'),
      ],
      outputs: [port('Headphones (6.35 mm)', 'Jack 6.35 mm TRS', 'Audio')],
      isRackDevice: true,
      rackUnits: 1,
      notes: '8-channel UHD/HD standards conversion inside a 100G 2110 network · redundant PSUs · power usage TBC',
      width: 280,
      height: 260,
    },
  },

  // ── Magewell ──────────────────────────────────────────────────────────────

  // Quelle: https://www.magewell.com/tech-specs/eco-capture-12g-sdi-4k-plus-m2
  {
    match: ['magewellecocapture12gsdi4kplusm2', 'ecocapture12gsdi4kplusm2'],
    deviceTypeId: '5db084a1-3833-4118-ab86-133cdee8a4e5',
    template: {
      manufacturerUrl: 'https://www.magewell.com/tech-specs/eco-capture-12g-sdi-4k-plus-m2',
      name: 'Magewell Eco Capture 12G SDI 4K Plus M.2',
      category: 'Converter',
      inputs: [
        sdi('3G-SDI In 1 (BNC via H.FL cable)'),
        sdi('3G-SDI In 2 (BNC via H.FL cable)'),
        sdi('12G-SDI In 1 (BNC via DFL cable)'),
        sdi('12G-SDI In 2 (BNC via DFL cable)'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'M.2 2280 capture card, PCIe Gen3 x4 · BNC adapters and micro-coax cables supplied · ~6.5 W at 3.3 V',
      width: 240,
      height: 200,
    },
  },
  // Quelle: https://www.magewell.com/tech-specs/eco-capture-dual-sdi-m2
  {
    match: ['magewellecocapturedualsdim2', 'ecocapturedualsdim2'],
    deviceTypeId: '9d50abe5-b960-481e-8ae1-6b0559c339d6',
    template: {
      manufacturerUrl: 'https://www.magewell.com/tech-specs/eco-capture-dual-sdi-m2',
      name: 'Magewell Eco Capture Dual SDI M.2',
      category: 'Converter',
      inputs: [
        port('3G-SDI In 1 (MMCX)', 'Custom', 'SDI'),
        port('3G-SDI In 2 (MMCX)', 'Custom', 'SDI'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'M.2 2280 capture card, PCIe Gen2 x2 · 2 x MMCX-to-BNC cables (32 cm) supplied · ~3.38 W at 3.3 V',
      width: 220,
      height: 160,
    },
  },
  // Quelle: https://www.magewell.com/tech-specs/ultra-encode-sdi-plus-module
  {
    match: ['magewellultraencodesdiplusmodule', 'ultraencodesdiplusmodule'],
    deviceTypeId: '3d76e029-298f-41e4-aa39-2e93d2fe6b45',
    template: {
      manufacturerUrl: 'https://www.magewell.com/tech-specs/ultra-encode-sdi-plus-module',
      name: 'Magewell Ultra Encode SDI Plus Module',
      category: 'IP/NDI',
      inputs: [
        sdi('3G-SDI In'),
        port('Line In (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        bidi('Ethernet (1 GbE)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C (configuration)', 'USB-C', 'USB'),
        port('USB-A (storage / modem)', 'USB Type A', 'USB'),
      ],
      outputs: [
        sdi('3G-SDI Loop Out'),
        port('Line Out (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Encoder module for the Modator 2U chassis (hot-swappable), power via chassis · H.264/H.265, NDI HX2/HX3, SRT, RTMP · micro-SD 128 GB · 14.42 W max',
      width: 240,
      height: 220,
    },
  },

  // ── Sony ──────────────────────────────────────────────────────────────────

  // Quelle: https://www.sony.jp/professional/support/catalog_pdf/monitor/LMDseries_2203.pdf
  {
    match: ['sonylmda220', 'lmda220'],
    deviceTypeId: 'c7a7c6fa-59b9-4653-8d9e-c73484ce51d6',
    template: {
      manufacturerUrl: 'https://www.sony.jp/professional/support/catalog_pdf/monitor/LMDseries_2203.pdf',
      name: 'Sony LMD-A220',
      category: 'Monitors',
      inputs: [
        sdi('3G/HD/SD-SDI In 1'),
        sdi('3G/HD/SD-SDI In 2'),
        port('HDMI In (HDCP)', 'HDMI', 'HDMI'),
        port('Composite In (NTSC/PAL)', 'BNC', 'Composite'),
        port('Audio In (stereo mini jack)', 'Jack 3.5 mm TRS', 'Audio'),
        port('Parallel Remote (RJ-45, 8-pin)', 'Ethernet/RJ45', 'GPIO'),
        port('Serial Remote (LAN, 10/100BASE-T)', 'Ethernet/RJ45', 'Ethernet'),
        port('DC In (XLR 4-pin, 12–17 V)', 'XLR 4 Male', 'Power'),
        port('AC In (100–240 V)', 'Generic', 'Power'),
      ],
      outputs: [
        sdi('SDI Out 1'),
        sdi('SDI Out 2'),
        port('Composite Out (loop-through)', 'BNC', 'Composite'),
        port('Audio Monitor Out (stereo mini jack)', 'Jack 3.5 mm TRS', 'Audio'),
        port('Headphones (stereo mini jack)', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: '21.5" LCD, 1920 x 1080 · AC 100–240 V 0.5–0.4 A or DC 12–17 V 3.4–2.4 A · ~47 W max, ~43 W typ. · 517.8 x 338.0 x 67.2 mm · 5.4 kg',
      width: 280,
      height: 300,
    },
  },
]

/** Flache Liste der Vorlagen samt Geraetetyp-ID. */
export const geraeteNachtrag1199Templates: EquipmentTemplate[] = GERAETE_NACHTRAG_1199_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
