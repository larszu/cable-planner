import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// LANG-AG-Mietkatalog, Abschnitte „Broadcast" und „Event IT" — Geraete mit
// Signal-I/O, die noch in keinem Katalog stehen. Jeder Eintrag aus einer
// abgerufenen Herstellerseite (Recherche 2026-10-21). Steckertyp, den die
// Seite nicht nennt, steht als 'Generic'.
//
// Uebersprungen, weil keine Herstellerquelle abrufbar war oder die Seite
// die Anschluesse nicht nennt:
//   Lynx PDM 1383, PDM 1284B, PDM 1284D, PVD 1800, CHD 1812,
//     OTX 1712 / ORX 1702 (lynx-technik.com antwortet 403)
//   Blackmagic ATEM Talkback Converter 4K,
//     ATEM Television Studio Pro 4K (nicht mehr auf der Seite),
//     Teranex Mini SDI to DisplayPort 8K HDR,
//     Videohub Smart Control Pro (Seite ohne Anschlussliste)
//   AJA FiDO-12G (404)
//   Haivision Makito X4 Decoder, Makito X S-292D/S-292E (keine Anschlussliste)
//   Meinberg microSync RX801 (Familienseite ohne Anschluesse), Rosendahl MIF4 (404),
//   PHABRIX Qx (Weiterleitung auf leaderphabrix.com ohne Modellseite)
//   Matrox ConvertIP DSH/SDM (404), ConductIP (Software-Appliance)
//   NETGEAR M4350-24G4XF, M4350-24X4V (nur Haendlerseiten)
//   Sonifex AVN-DIO10 (404), Neutrik NA2-IO-DLINE (Seite nennt keine Buchsen)
//   BrightSign XD235 (nur XD236/XD1036 gelistet, ohne Anschluesse)
//   Ross Carbonite Black Solo, Carbonite Black 2S/3X Panel, TouchDrive TD3S
//     (Legacy, keine Anschlussliste)
//   Marshall CV350-10X-XLR, CV-RCP-V2, VS-PTC-IP, VAC-23SHU3 (nicht nachgeschlagen; CV350-10X-XLR: 404)
//   Magewell Pro Convert NDI to HDMI 4K (404)
//   NewTek Spark Plus IO 4K (nur Haendlerseiten), Lightware VINX 110AP/120AP
//     (Seite ohne Anschluesse), BirdDog 4K NDI 12G (Weiterleitung), Videosys
//     Epsilon, HP ProCurve 1420-8G/1820-24G (nicht nachgeschlagen),
//     Grass Valley Hybrid Power Extender (Zubehoer)
// Ausgelassen ohne Recherche: PCs/Laptops, Lizenzen, Kabel, Objektive,
// Stative, Pruefgeraete, Speichermedien, USV.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const sdi = (name: string) => port(name, 'BNC', 'SDI')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const n = (count: number, f: (i: number) => Port) => Array.from({ length: count }, (_, i) => f(i + 1))
const H = (max: number) => 120 + 20 * max

interface LangBroadcastEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const LANG_BROADCAST_CATALOG: LangBroadcastEntry[] = [
  // Quelle: https://www.blackmagicdesign.com/products/hyperdeckextreme/techspecs
  {
    match: ['hyperdeckextreme8khdr', 'hyperdeckextreme8k'],
    deviceTypeId: '1ecb993b-a3fc-4355-a006-c55c7e48299a',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/hyperdeckextreme/techspecs',
      name: 'Blackmagic HyperDeck Extreme 8K HDR',
      category: 'Video',
      inputs: [
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Component Y In', 'BNC', 'Analog Video'),
        port('Component Pb In', 'BNC', 'Analog Video'),
        port('Component Pr In', 'BNC', 'Analog Video'),
        port('Composite In', 'BNC', 'Analog Video'),
        ...n(4, (i) => port(`Analog Audio In ${i}`, 'XLR', 'Analog Audio')),
        port('Analog Audio In L (RCA)', 'Cinch/RCA', 'Analog Audio'),
        port('Analog Audio In R (RCA)', 'Cinch/RCA', 'Analog Audio'),
        port('Timecode In', 'XLR', 'LTC'),
        port('Reference In', 'BNC', 'Genlock'),
        port('RS-422 In', 'Generic', 'RS-422'),
        port('Ethernet 10G', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C 3.1 (Recording)', 'USB-C', 'USB'),
        port('USB-C (Updates)', 'USB-C', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
        port('12 V DC In', 'XLR 4 Male', 'Power'),
      ],
      outputs: [
        ...['A', 'B', 'C', 'D'].map((x) => sdi(`12G-SDI Out ${x}`)),
        sdi('3G-SDI Monitor Out'),
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        port('Timecode Out', 'XLR', 'LTC'),
        port('RS-422 Out', 'Generic', 'RS-422'),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes: '3 HE, halbe Rackbreite · 2x CFast 2.0 + M.2 NVMe · 64 Kanaele SDI-Audio',
      width: 280,
      height: H(22),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/hyperdeckstudio/techspecs
  {
    match: ['hyperdeckstudiohdmini', 'hyperdeckstudiomini'],
    deviceTypeId: '965bf85a-3908-45b7-a3bf-a076a7e98b4f',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/hyperdeckstudio/techspecs',
      name: 'Blackmagic HyperDeck Studio HD Mini',
      category: 'Video',
      inputs: [
        sdi('3G-SDI In'),
        port('Timecode In', 'BNC', 'LTC'),
        port('Reference In', 'BNC', 'Genlock'),
        port('RS-422 In', 'Generic', 'RS-422'),
        port('Ethernet 1G', 'Ethernet/RJ45', 'Ethernet'),
        port('USB-C 3.0', 'USB-C', 'USB'),
        port('USB-C 3.0 Expansion', 'USB-C', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
        port('12 V DC In (5,5 mm, verriegelnd)', 'Generic', 'Power'),
      ],
      outputs: [
        sdi('3G-SDI Out'),
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Timecode Out', 'BNC', 'LTC'),
        port('Reference Out', 'BNC', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '1/3 Rackbreite, 1 HE · 2x SD-Karte · max. 50 W',
      width: 280,
      height: H(9),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/miniconverters/techspecs/W-CONM-28
  {
    match: ['miniconverterupdowncross', 'updowncross'],
    deviceTypeId: '3ce7d062-51b2-43a8-bdde-bb24c94337e3',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/miniconverters/techspecs/W-CONM-28',
      name: 'Blackmagic Mini Converter UpDownCross HD',
      category: 'Converter',
      inputs: [
        sdi('3G-SDI In'),
        port('HDMI In', 'HDMI', 'HDMI'),
        port('Reference In', 'BNC', 'Genlock'),
        port('USB (Config)', 'USB', 'USB'),
        port('12 V DC In', 'Generic', 'Power'),
      ],
      outputs: [
        sdi('SDI Loop Out'),
        sdi('SDI Out 1'),
        sdi('SDI Out 2'),
        port('HDMI Out', 'HDMI', 'HDMI'),
      ],
      isRackDevice: false,
      notes: '6–36 V DC',
      width: 280,
      height: H(5),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/teranexmini/techspecs
  {
    match: ['teranexminihdmitosdi12g', 'teranexminihdmi20to12gsdi'],
    deviceTypeId: '0a8f6fd7-2979-4c0e-b9b1-b430ebfcfd53',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/teranexmini/techspecs',
      name: 'Blackmagic Teranex Mini HDMI to SDI 12G',
      category: 'Converter',
      inputs: [
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Analog Audio In 1', 'XLR', 'Analog Audio'),
        port('Analog Audio In 2', 'XLR', 'Analog Audio'),
        ...n(4, (i) => port(`AES/EBU In ${i}`, 'XLR', 'AES/EBU')),
        port('Ethernet (PoE+)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB (Config)', 'USB', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
      ],
      outputs: [sdi('12G-SDI Out 1'), sdi('12G-SDI Out 2')],
      isRackDevice: false,
      notes: 'IEC C14 oder PoE+ · 16 W',
      width: 280,
      height: H(10),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/atemconstellation/techspecs
  {
    match: ['atem2meadvancedpanel20', 'atem2m/eadvancedpanel20'],
    deviceTypeId: '9c8d3ce8-2728-481c-b1cb-f9e209db297b',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs',
      name: 'Blackmagic ATEM 2 M/E Advanced Panel 20',
      category: 'Control',
      inputs: [
        ...n(4, (i) => eth(`Ethernet ${i}`)),
        port('USB-C (Updates)', 'USB-C', 'USB'),
        port('AC In 1', 'IEC 230V', 'Power'),
        port('AC In 2', 'IEC 230V', 'Power'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'Ethernet mit Loop für weitere Panels · redundantes Netzteil · 100 W',
      width: 280,
      height: H(7),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/atemconstellation/techspecs
  {
    match: ['atem4meadvancedpanel40', 'atem4m/eadvancedpanel40'],
    deviceTypeId: 'ab22f61e-b47d-44c9-becb-34d0dcadb736',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/atemconstellation/techspecs',
      name: 'Blackmagic ATEM 4 M/E Advanced Panel 40',
      category: 'Control',
      inputs: [
        ...n(4, (i) => eth(`Ethernet ${i}`)),
        port('USB-C (Updates)', 'USB-C', 'USB'),
        port('AC In 1', 'IEC 230V', 'Power'),
        port('AC In 2', 'IEC 230V', 'Power'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'Ethernet mit Loop für weitere Panels · redundantes Netzteil · 250 W',
      width: 280,
      height: H(7),
    },
  },

  // Quelle: https://www.aja.com/products/ki-pro-go2
  {
    match: ['kiprogo2'],
    deviceTypeId: 'b0319db5-d7c3-465f-82c6-0f0e8e09a5d4',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ki-pro-go2',
      name: 'AJA Ki Pro GO2',
      category: 'Video',
      inputs: [
        ...n(4, (i) => sdi(`3G-SDI In ${i}`)),
        ...n(4, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        port('Analog Audio In 1 (Mic/Line, LTC)', 'XLR', 'Analog Audio'),
        port('Analog Audio In 2 (Mic/Line)', 'XLR', 'Analog Audio'),
        port('Ethernet 1G', 'Ethernet/RJ45', 'Ethernet'),
        ...n(5, (i) => port(`USB 3.2 ${i}`, 'USB', 'USB')),
        port('Power In', 'Generic', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => sdi(`3G-SDI Thru ${i}`)),
        sdi('3G-SDI Monitor Out'),
        port('HDMI Monitor Out', 'HDMI', 'HDMI'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '2 HE, halbe Rackbreite · 4-Kanal H.264/HEVC auf USB · optional redundantes Netzteil',
      width: 280,
      height: H(17),
    },
  },

  // Quelle: https://www.aja.com/products/ki-pro-go
  {
    match: ['kiprogo'],
    deviceTypeId: 'ff9e2382-478c-4e47-a3da-94b030acc0e9',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ki-pro-go',
      name: 'AJA Ki Pro GO',
      category: 'Video',
      inputs: [
        ...n(4, (i) => sdi(`3G-SDI In ${i}`)),
        ...n(4, (i) => port(`HDMI In ${i}`, 'HDMI', 'HDMI')),
        port('Analog Audio In L (LTC)', 'XLR', 'Analog Audio'),
        port('Analog Audio In R', 'XLR', 'Analog Audio'),
        port('Reference In', 'BNC', 'Genlock'),
        port('Ethernet 1G', 'Ethernet/RJ45', 'Ethernet'),
        ...n(5, (i) => port(`USB 3.2 ${i}`, 'USB', 'USB')),
        port('12–18 V DC In 1', 'XLR 4 Male', 'Power'),
        port('12–18 V DC In 2', 'XLR 4 Male', 'Power'),
      ],
      outputs: [
        ...n(5, (i) => sdi(`3G-SDI Out ${i}`)),
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Reference Loop', 'BNC', 'Genlock'),
        port('Headphone', 'Jack 3.5 mm TRS', 'Analog Audio'),
        port('Analog Audio Out L', 'Cinch/RCA', 'Analog Audio'),
        port('Analog Audio Out R', 'Cinch/RCA', 'Analog Audio'),
        port('TC Super Out', 'Generic', 'Video'),
      ],
      isRackDevice: false,
      notes: '4-Kanal H.264 auf USB · Referenz-Eingang loopend · DC redundant',
      width: 280,
      height: H(19),
    },
  },

  // Quelle: https://www.aja.com/products/ki-pro-ultra
  {
    match: ['kiproultra'],
    deviceTypeId: '0edf3625-0520-4f51-9ada-25cbac247a5a',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/ki-pro-ultra',
      name: 'AJA Ki Pro Ultra',
      category: 'Video',
      inputs: [
        ...n(4, (i) => sdi(`3G-SDI In ${i}`)),
        ...n(4, (i) => port(`Fiber In ${i} (SFP opt.)`, 'Fiber Optic LC', 'SDI')),
        port('HDMI In', 'HDMI', 'HDMI'),
        port('AES/EBU In (8 ch)', 'DB25', 'AES/EBU'),
        port('Analog Audio In (8 ch)', 'DB25', 'Analog Audio'),
        port('LTC In', 'BNC', 'LTC'),
        port('Reference In', 'BNC', 'Genlock'),
        port('RS-422', 'DB9', 'RS-422'),
        port('Ethernet 1G', 'Ethernet/RJ45', 'Ethernet'),
        port('12–18 V DC In', 'XLR 4 Male', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => sdi(`3G-SDI Out ${i}`)),
        ...n(4, (i) => port(`Fiber Out ${i} (SFP opt.)`, 'Fiber Optic LC', 'SDI')),
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('AES/EBU Out (8 ch)', 'DB25', 'AES/EBU'),
        port('Analog Audio Out (8 ch)', 'DB25', 'Analog Audio'),
        port('Analog Audio Out L', 'Cinch/RCA', 'Analog Audio'),
        port('Analog Audio Out R', 'Cinch/RCA', 'Analog Audio'),
        port('Headphone', 'Jack 3.5 mm TRS', 'Analog Audio'),
        port('LTC Out', 'BNC', 'LTC'),
        port('Reference Loop', 'BNC', 'Genlock'),
      ],
      isRackDevice: false,
      notes: 'abgekuendigt (Nachfolger Ki Pro Ultra 12G) · DB-25 TASCAM-Belegung · 2x AJA Pak',
      width: 280,
      height: H(18),
    },
  },

  // Quelle: https://www.aja.com/products/12gda
  {
    match: ['aja12gda', '12gda'],
    deviceTypeId: '2ad33a64-3a0a-4724-81f7-b533f495b732',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/12gda',
      name: 'AJA 12GDA',
      category: 'Video',
      inputs: [sdi('12G-SDI In'), port('DC In (5–20 V)', 'Generic', 'Power')],
      outputs: n(6, (i) => sdi(`12G-SDI Out ${i}`)),
      isRackDevice: false,
      notes: '1:6 Verteilverstaerker · 3 W · Netzteil im Lieferumfang',
      width: 280,
      height: H(6),
    },
  },

  // Quelle: https://www.aja.com/products/c10da
  {
    match: ['ajac10da', 'c10da'],
    deviceTypeId: '68946caf-dc9e-4363-91fd-97193792606b',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/c10da',
      name: 'AJA C10DA',
      category: 'Video',
      inputs: [port('Analog Video In', 'BNC', 'Analog Video'), port('DC In (5 V)', 'Generic', 'Power')],
      outputs: n(6, (i) => port(`Analog Video Out ${i}`, 'BNC', 'Analog Video')),
      isRackDevice: false,
      notes: '1:6 Analog-Verteilverstaerker · 2 W',
      width: 280,
      height: H(6),
    },
  },

  // Quelle: https://www.aja.com/products/12gm
  {
    match: ['aja12gm', '12gm12gsdi'],
    deviceTypeId: 'ad0f20ab-ee1c-4c2e-82d5-7d5278b8a7d0',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/12gm',
      name: 'AJA 12GM',
      category: 'Converter',
      inputs: [
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        port('USB (Config)', 'USB', 'USB'),
        port('DC In', 'Generic', 'Power'),
      ],
      outputs: n(4, (i) => sdi(`12G-SDI Out ${i}`)),
      isRackDevice: false,
      notes: '12G ↔ Quad-Link-3G Mux/Demux · 5–16 V DC, 12 W',
      width: 280,
      height: H(6),
    },
  },

  // Quelle: https://www.aja.com/products/hi5-4k-plus
  {
    match: ['hi54kplus'],
    deviceTypeId: 'ac1f2861-1059-4d85-938d-f8a0975c8093',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/hi5-4k-plus',
      name: 'AJA Hi5-4K-Plus',
      category: 'Converter',
      inputs: [
        ...n(4, (i) => sdi(`3G-SDI In ${i}`)),
        port('USB (Config)', 'USB', 'USB'),
        port('DC In (5–20 V, verriegelnd)', 'Generic', 'Power'),
      ],
      outputs: [port('HDMI 2.0b Out', 'HDMI', 'HDMI')],
      isRackDevice: false,
      notes: '12 W',
      width: 280,
      height: H(6),
    },
  },

  // Quelle: https://www.aja.com/products/u-tap-sdi
  {
    match: ['utapsdi', 'u-tapsdi'],
    deviceTypeId: 'a6680203-3f67-4ba7-b327-9c4b2c8c3126',
    template: {
      manufacturerUrl: 'https://www.aja.com/products/u-tap-sdi',
      name: 'AJA U-TAP SDI',
      category: 'Converter',
      inputs: [sdi('3G-SDI In')],
      outputs: [sdi('3G-SDI Loop Out'), port('USB 3.0 (UVC/UAC, Bus-Power)', 'USB', 'USB')],
      isRackDevice: false,
      notes: 'USB-Busversorgung, max. 4 W',
      width: 280,
      height: H(2),
    },
  },

  // Quelle: https://www.adder.com/en/kvm-solutions/adderlink-xdip
  {
    match: ['adderlinkxdip', 'xdip'],
    deviceTypeId: '98a2e927-2f0e-4381-b8df-047289c6c72a',
    template: {
      manufacturerUrl: 'https://www.adder.com/en/kvm-solutions/adderlink-xdip',
      name: 'Adder ADDERLink XDIP',
      category: 'IP/NDI',
      inputs: [
        port('HDMI In (Computer)', 'HDMI', 'HDMI'),
        port('USB B (Computer)', 'USB Type B', 'USB'),
        port('Audio In', 'Jack 3.5 mm', 'Analog Audio'),
        port('Link 1GbE (PoE 802.3af)', 'Ethernet/RJ45', 'Ethernet'),
        port('12 V DC In (3-pol)', 'Generic', 'Power'),
      ],
      outputs: [
        port('HDMI Out (Console)', 'HDMI', 'HDMI'),
        ...n(3, (i) => port(`USB A Console ${i} (HID)`, 'USB Type A', 'USB')),
        port('Audio Out', 'Jack 3.5 mm', 'Analog Audio'),
      ],
      isRackDevice: false,
      notes: 'Transceiver: als Sender oder Empfänger konfigurierbar — je Rolle nur eine Seite belegt',
      width: 280,
      height: H(5),
    },
  },

  // Quelle: https://www.rme-audio.de/fireface-ucx-ii.html
  {
    match: ['firefaceucxii', 'firefaceucx2'],
    deviceTypeId: '8715eef4-72b6-4397-a612-c0cec591afd4',
    template: {
      manufacturerUrl: 'https://www.rme-audio.de/fireface-ucx-ii.html',
      name: 'RME Fireface UCX II',
      category: 'Audio',
      inputs: [
        port('Mic/Line In 1', 'Combo XLR/Jack', 'Analog Audio'),
        port('Mic/Line In 2', 'Combo XLR/Jack', 'Analog Audio'),
        port('Line/Inst In 3', 'Jack 6.35 mm TRS', 'Analog Audio'),
        port('Line/Inst In 4', 'Jack 6.35 mm TRS', 'Analog Audio'),
        ...n(4, (i) => port(`Line In ${i + 4}`, 'Jack 6.35 mm TRS', 'Analog Audio')),
        port('S/PDIF In', 'Cinch/RCA', 'S/PDIF'),
        port('ADAT In', 'Toslink', 'ADAT'),
        port('AES/EBU In', 'XLR', 'AES/EBU'),
        port('Word Clock In', 'BNC', 'Word Clock'),
        port('MIDI In', 'MIDI', 'MIDI'),
        port('USB 2.0', 'USB', 'USB'),
        port('12 V DC In', 'Generic', 'Power'),
      ],
      outputs: [
        ...n(6, (i) => port(`Line Out ${i}`, 'Jack 6.35 mm TRS', 'Analog Audio')),
        port('Phones 7/8', 'Jack 6.35 mm TRS', 'Analog Audio'),
        port('S/PDIF Out', 'Cinch/RCA', 'S/PDIF'),
        port('ADAT Out', 'Toslink', 'ADAT'),
        port('AES/EBU Out', 'XLR', 'AES/EBU'),
        port('Word Clock Out', 'BNC', 'Word Clock'),
        port('MIDI Out', 'MIDI', 'MIDI'),
      ],
      isRackDevice: false,
      notes: 'Seite nennt Digital-I/O je als „I/O"; hier als Ein-/Ausgangspaar geführt',
      width: 280,
      height: H(15),
    },
  },

  // Quelle: https://www.rme-audio.de/fireface-802.html
  {
    match: ['fireface802'],
    deviceTypeId: '4b845e70-40f3-4688-b7b2-bd84dfc9009d',
    template: {
      manufacturerUrl: 'https://www.rme-audio.de/fireface-802.html',
      name: 'RME Fireface 802',
      category: 'Audio',
      inputs: [
        ...n(8, (i) => port(`Line In ${i}`, 'Jack 6.35 mm TRS', 'Analog Audio')),
        ...n(4, (i) => port(`Mic/Inst In ${i + 8}`, 'Combo XLR/Jack', 'Analog Audio')),
        port('AES/EBU In', 'XLR', 'AES/EBU'),
        port('ADAT In 1', 'Toslink', 'ADAT'),
        port('ADAT In 2 (opt. S/PDIF)', 'Toslink', 'ADAT'),
        port('Word Clock In', 'BNC', 'Word Clock'),
        port('MIDI In', 'Generic', 'MIDI'),
        port('USB 2.0', 'USB', 'USB'),
        port('FireWire', 'Generic', 'FireWire'),
        port('AC In', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(8, (i) => port(`Line Out ${i}`, 'Jack 6.35 mm TRS', 'Analog Audio')),
        port('Phones 9/10', 'Jack 6.35 mm TRS', 'Analog Audio'),
        port('Phones 11/12', 'Jack 6.35 mm TRS', 'Analog Audio'),
        port('AES/EBU Out', 'XLR', 'AES/EBU'),
        port('ADAT Out 1', 'Toslink', 'ADAT'),
        port('ADAT Out 2 (opt. S/PDIF)', 'Toslink', 'ADAT'),
        port('Word Clock Out', 'BNC', 'Word Clock'),
        port('MIDI Out', 'Generic', 'MIDI'),
      ],
      isRackDevice: true,
      notes: 'internes Netzteil 100–240 V · Steckertyp von MIDI/FireWire auf der Seite nicht genannt',
      width: 280,
      height: H(20),
    },
  },

  // Quelle: https://www.genelec.com/4430a
  {
    match: ['genelec4430a', '4430a'],
    deviceTypeId: '568d4767-0397-4f2e-b9a8-93e2dfd45dd2',
    template: {
      manufacturerUrl: 'https://www.genelec.com/4430a',
      name: 'Genelec 4430A',
      category: 'Audio',
      inputs: [
        port('AES67/Dante In (PoE)', 'Ethernet/RJ45', 'Dante'),
        port('Analog In (symm.)', 'Generic', 'Analog Audio'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'Installationslautsprecher · Versorgung nur per PoE+ (802.3at) bzw. PoE · Analog-Eingang Euroblock',
      width: 280,
      height: H(2),
    },
  },

  // Quelle: https://www.netgear.com/business/wired/switches/fully-managed/xsm4344c/
  {
    match: ['m435040x4c', 'xsm4344c'],
    deviceTypeId: '5acb2d94-0f0c-47a2-8e86-499f75c15edf',
    template: {
      manufacturerUrl: 'https://www.netgear.com/business/wired/switches/fully-managed/xsm4344c/',
      name: 'NETGEAR M4350-40X4C (XSM4344C)',
      category: 'Networking',
      inputs: [port('AC In (intern 750 W)', 'Generic', 'Power'), port('Modular PSU Slot', 'Generic', 'Power')],
      outputs: [
        ...n(40, (i) => port(`10G PoE++ ${i}`, 'Ethernet/RJ45', 'Ethernet')),
        ...n(4, (i) => port(`QSFP28 100G ${i}`, 'QSFP28', 'Ethernet')),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '40x 10G/Multi-Gig PoE++ (90 W/Port, Budget 196–1676 W) · 4x QSFP28 100G',
      width: 280,
      height: H(44),
    },
  },

  // Quelle: https://www.skaarhoj.com/product/eth-gpi-link
  {
    match: ['ethgpilink', 'eth-gpilink'],
    deviceTypeId: '5589fcf8-2d3a-4093-8a77-062f9e5a7fc3',
    template: {
      manufacturerUrl: 'https://www.skaarhoj.com/product/eth-gpi-link',
      name: 'SKAARHOJ ETH-GPI Link',
      category: 'Control',
      inputs: [
        port('Ethernet 100M (PoE)', 'Ethernet/RJ45', 'Ethernet'),
        port('Micro USB (Config)', 'USB', 'USB'),
        port('GPI 1–8 / GPO 1–8', 'DB25', 'GPIO'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: '8 GPI (Kontakt) + 8 GPO auf einem DB25, galvanisch getrennt · PoE 802.3af/at',
      width: 280,
      height: H(3),
    },
  },

  // Quelle: https://www.skaarhoj.com/product/eth-gpi-link
  {
    match: ['ethgpidual', 'ethgpilinkdual', 'dualethgpi'],
    deviceTypeId: '25b6d2a2-add5-471b-9d1b-7b495e709d1d',
    template: {
      manufacturerUrl: 'https://www.skaarhoj.com/product/eth-gpi-link',
      name: 'SKAARHOJ ETH-GPI Link Dual',
      category: 'Control',
      inputs: [
        port('Ethernet 100M (PoE)', 'Ethernet/RJ45', 'Ethernet'),
        port('Micro USB (Config)', 'USB', 'USB'),
        port('GPI 1–8 / GPO 1–8', 'DB25', 'GPIO'),
        port('GPI 9–16 / GPO 9–16', 'DB25', 'GPIO'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: '16 GPI + 16 GPO auf zwei DB25, galvanisch getrennt · PoE 802.3af/at',
      width: 280,
      height: H(4),
    },
  },

  // Quelle: https://www.clearcom.com/Product/Digital-Wired-Intercom/Arcadia-Central-Station
  {
    match: ['arcadiacentralstation', 'clearcomarcadia'],
    deviceTypeId: 'e76a19ee-55f1-42c1-8031-9e70a67cc89a',
    template: {
      manufacturerUrl: 'https://www.clearcom.com/Product/Digital-Wired-Intercom/Arcadia-Central-Station',
      name: 'Clear-Com Arcadia Central Station',
      category: 'Intercom',
      inputs: [
        port('Program In', 'XLR 3 Female', 'Analog Audio'),
        port('LAN 1', 'Ethernet/RJ45', 'Ethernet'),
        port('LAN 2', 'Ethernet/RJ45', 'Ethernet'),
        port('LAN 3', 'SFP', 'Ethernet'),
        port('LAN 4', 'SFP', 'Ethernet'),
        port('FreeSpeak E1 1 (RJ45/SFP)', 'Ethernet/RJ45', 'E1'),
        port('FreeSpeak E1 2 (RJ45/SFP)', 'Ethernet/RJ45', 'E1'),
        port('GPIO 1', 'DB9', 'GPIO'),
        port('GPIO 2', 'DB9', 'GPIO'),
        port('Headset', 'Generic', 'Headset'),
        port('AC In', 'IEC 230V', 'Power'),
        port('DC In (KPJX-4S-S)', 'Generic', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => port(`2-Wire ${i}`, 'XLR 3 Female', 'Partyline')),
        ...n(8, (i) => port(`4-Wire ${i}${i === 8 ? ' (PGM/SA)' : ''}`, 'Ethernet/RJ45', '4-Wire')),
        port('Stage Out', 'XLR 3 Male', 'Analog Audio'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'Dante über LAN-Ports · Headset XLR-4M oder XLR-5F je Ausführung',
      width: 280,
      height: H(13),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/multiview/techspecs
  {
    match: ['sdimultiview4', 'multiview4'],
    deviceTypeId: '854ef709-5f33-4a85-950b-92e1c3217050',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/multiview/techspecs',
      name: 'Blackmagic MultiView 4',
      category: 'Multiviewer',
      inputs: [
        ...n(4, (i) => sdi(`6G-SDI In ${i}`)),
        port('Ethernet (PoE+)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB 2.0', 'USB', 'USB'),
        port('AC In', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => sdi(`SDI Loop Out ${i}`)),
        sdi('SDI Out'),
        sdi('SDI Multiview Out'),
        port('HDMI Out', 'HDMI', 'HDMI'),
      ],
      isRackDevice: false,
      notes: 'IEC 100–240 V oder PoE+ 48 V · 16 W',
      width: 280,
      height: H(7),
    },
  },

  // Quelle: https://www.blackmagicdesign.com/products/blackmagicstreamingprocessors/techspecs
  {
    match: ['atemstreamingbridge'],
    deviceTypeId: '8a330d8b-f182-4a4d-8c96-1ae5928fabb7',
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstreamingprocessors/techspecs',
      name: 'Blackmagic ATEM Streaming Bridge',
      category: 'IP/NDI',
      inputs: [
        eth('Ethernet 1G'),
        port('USB-C (Config)', 'USB-C', 'USB'),
        port('12 V DC In', 'Generic', 'Power'),
      ],
      outputs: [sdi('3G-SDI Out 1'), sdi('3G-SDI Out 2'), port('HDMI Out', 'HDMI', 'HDMI')],
      isRackDevice: false,
      notes: 'SRT/RTMP-H.264-Decoder · 6–30 V DC, max. 6 W',
      width: 280,
      height: H(3),
    },
  },

  // Quelle: https://doc.haivision.com/MakitoX4Enc/1.9/audio-video-interfaces
  {
    match: ['makitox4encoder', 'makitox4'],
    deviceTypeId: 'd4c841b5-feb2-49aa-9c24-d0c729d36486',
    template: {
      manufacturerUrl: 'https://doc.haivision.com/MakitoX4Enc/1.9/audio-video-interfaces',
      name: 'Haivision Makito X4 Encoder',
      category: 'IP/NDI',
      inputs: [
        ...n(4, (i) => port(`SDI In ${i} (12G)`, 'HD-BNC', 'SDI')),
        port('SFP+ (ST 2110 / Netz, opt.)', 'SFP+', 'Ethernet'),
        eth('Ethernet 1G'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: 'H.264/HEVC-Encoder · Stream über Ethernet · Stromanschluss in der Doku nicht genannt · Quelle auch /system-interfaces',
      width: 280,
      height: H(6),
    },
  },

  // Quelle: https://mikrotik.com/product/crs310_1g_5s_4s_in
  {
    match: ['crs3101g5s4s+in', 'crs3101g5s4s'],
    deviceTypeId: '7bd84d73-0866-408a-8e35-f695ab088c0c',
    template: {
      manufacturerUrl: 'https://mikrotik.com/product/crs310_1g_5s_4s_in',
      name: 'MikroTik CRS310-1G-5S-4S+IN',
      category: 'Networking',
      inputs: [
        port('DC In (18–57 V)', 'Generic', 'Power'),
        port('Console', 'Ethernet/RJ45', 'Serial'),
      ],
      outputs: [
        port('Ethernet 1G (PoE-In)', 'Ethernet/RJ45', 'Ethernet'),
        ...n(5, (i) => port(`SFP 1G ${i}`, 'SFP', 'Ethernet')),
        ...n(4, (i) => port(`SFP+ 10G ${i}`, 'SFP+', 'Ethernet')),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'PoE-In 802.3af/at oder DC 18–57 V',
      width: 280,
      height: H(10),
    },
  },

  // Quelle: https://marshall-usa.com/cameras/CV355-30X-IP/
  {
    match: ['cv35530xip'],
    deviceTypeId: '1115294a-7306-4b8e-9292-3e4ab0333fef',
    template: {
      manufacturerUrl: 'https://marshall-usa.com/cameras/CV355-30X-IP/',
      name: 'Marshall CV355-30X-IP',
      category: 'Cameras',
      inputs: [
        port('Audio In', 'Generic', 'Analog Audio'),
        port('RS-232', 'Generic', 'RS-232'),
        port('12 V DC In (EIAJ-04)', 'Generic', 'Power'),
      ],
      outputs: [
        sdi('3G-SDI Out'),
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Ethernet (IP-Stream, PoE)', 'Ethernet/RJ45', 'Ethernet'),
        port('Audio Out', 'Generic', 'Analog Audio'),
      ],
      isRackDevice: false,
      notes: '30x Zoom · H.265/H.264/MJPEG, SRT/RTMP · PoE 802.3af',
      width: 280,
      height: H(4),
    },
  },
]
