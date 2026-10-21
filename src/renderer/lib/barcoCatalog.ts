import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Barco — Projektoren und Bildverarbeitung (Event Master) fuer ProAV/Events.
//
// Nur Modelle mit geladenem Hersteller-Datenblatt (assets.barco.com).
// E2 Gen 2 steht schon in switcherCatalog.ts. ClickShare gehoert nicht hierher.
//
// Kartenbasierte Prozessoren (Encore3, Ex): die Blaetter nennen nur
// „bis zu"-Bestueckungen, deshalb stehen nur die festen Buchsen da
// (Genlock, LAN, Netz); die Video-I/O haengt an den Karten.
// RS232 und DMX der Projektoren ohne Steckerangabe im Blatt → nur in notes.
//
// Ausgelassen (kein Datenblatt gefunden bzw. nicht mehr aktuell):
// UDX-W/U-Varianten, UDM-W/U-Varianten, F90, F400, weitere F80-/G-Modelle
// (G62-W14, G50), XDX-4K40 (PDF defekt), XDM, Galaxy, I600, E3,
// HDX-4K20 FLEX (Xenon, abgekuendigt), ImagePRO-II, Encore (alt),
// S3-4K Jr Gen 1.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const mains = (name = 'Mains In') => port(name, 'IEC 230V', 'Power')
const sdi = (n: number, label: string) =>
  Array.from({ length: n }, (_, i) => port(`${label} ${i + 1}`, 'BNC', 'SDI'))

/** Gemeinsame Eingänge der UDX/UDM-Plattform laut Blatt. */
const udPlatformInputs = (): Port[] => [
  port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
  port('HDMI 2.0 In', 'HDMI', 'HDMI'),
  port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
  ...sdi(4, '3G/12G-SDI In'),
  eth('LAN (10/100)'),
  mains(),
]

const PROJ = 'Projectors'
const MIX = 'Video Mixer'

interface BarcoEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const BARCO_CATALOG: BarcoEntry[] = [
  // Quelle: https://assets.barco.com/m/5860ce9046d5b527/original/UDX-4K40-FLEX-en-Spec-sheet.pdf
  {
    match: ['barcoudx-4k40', 'udx-4k40', 'udx4k40', 'udx-4k40flex'],
    deviceTypeId: '7916ad81-f613-4f91-9ec6-090dbc3f0825',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/5860ce9046d5b527/original/UDX-4K40-FLEX-en-Spec-sheet.pdf',
      name: 'Barco UDX-4K40 FLEX',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '37.500 (WQ)/36.500 (4K UHD) Center-Lumen, 40.000 ISO · nativ 2.560 x 1.600, 4K UHD 3.840 x 2.400 · Laser B+R, Phosphor · 92 kg · max. 3.750 W · 200–240 V, 20 A · optional Quad DP1.2 / Fiber SFP · RS232, DMX 512, XLR-Remote',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/68e96a3b1d09716e/original/UDX-4K32-en-Spec-sheet.pdf
  {
    match: ['barcoudx-4k32', 'udx-4k32', 'udx4k32'],
    deviceTypeId: '6e783036-c1a3-4928-aa74-f29275be180e',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/68e96a3b1d09716e/original/UDX-4K32-en-Spec-sheet.pdf',
      name: 'Barco UDX-4K32',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '31.000 (WQ)/30.000 (4K UHD) Center-Lumen, 33.000 ISO · nativ 2.560 x 1.600, 4K UHD 3.840 x 2.400 · Laser B+R, Phosphor · 92 kg · 2.900 W nom./3.100 W max. · 200–240 V, 20 A · optional Quad DP1.2 / Fiber SFP · RS232, DMX 512, XLR-Remote',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/5baeef26d9138bb3/original/UDM-4K22-en-Spec-sheet.pdf
  {
    match: ['barcoudm-4k22', 'udm-4k22', 'udm4k22'],
    deviceTypeId: 'e205435a-dbe5-4d5f-a9d3-567e9f0cd961',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/5baeef26d9138bb3/original/UDM-4K22-en-Spec-sheet.pdf',
      name: 'Barco UDM-4K22',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '20.000 Center-Lumen, 19.000 ANSI, 22.000 ISO · nativ 2.560 x 1.600, 4K UHD 3.840 x 2.400 · Laser B + Rot-Kompensator, Phosphor · 48 kg · 1.800 W nom./2.200 W max. @ 230 V · optional Quad DP1.2 / Fiber SFP · RS232, DMX 512, XLR-Remote',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/asset/5eed7188-f7e6-422c-ac98-16af50de77c6/G62-W11-de-Spec-sheet.pdf
  {
    match: ['barcog62-w11', 'g62-w11', 'g62w11'],
    deviceTypeId: 'e5c8be28-69ce-4021-837d-a02573338552',
    template: {
      manufacturerUrl: 'https://assets.barco.com/asset/5eed7188-f7e6-422c-ac98-16af50de77c6/G62-W11-de-Spec-sheet.pdf',
      name: 'Barco G62-W11',
      category: PROJ,
      inputs: [
        port('HDMI 2.0 In 1', 'HDMI', 'HDMI'),
        port('HDMI 2.0 In 2', 'HDMI', 'HDMI'),
        port('DVI-D In', 'DVI', 'DVI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('3G-SDI In', 'BNC', 'SDI'),
        port('RS232', 'DB9', 'RS232'),
        eth('LAN'),
        port('USB Typ A', 'USB', 'USB'),
        mains(),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '10.000 ANSI-Lumen, 10.600 Center, 11.000 ISO · WUXGA 1.920 x 1.200 · Laser-Phosphor · 22,7 kg ohne Objektiv · 835 W ±15 % @ 110 V · 3D-Sync-In, Wired-Remote 3,5 mm',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://assets.barco.com/m/6e004d92f3d4cae4/original/S3-4K-es-Spec-sheet.pdf
  {
    match: ['barcos3-4k', 's3-4k', 's34k'],
    deviceTypeId: '73f8a25f-1b0b-4b58-8a40-e6688940a064',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/6e004d92f3d4cae4/original/S3-4K-es-Spec-sheet.pdf',
      name: 'Barco S3-4K',
      category: MIX,
      // Standardbestueckung laut Blatt; kartenbasiert, BTO abweichend.
      inputs: [
        ...sdi(4, '3G-SDI In'),
        ...Array.from({ length: 4 }, (_, i) => port(`HDMI 1.4a In ${i + 1}`, 'HDMI', 'HDMI')),
        ...Array.from({ length: 4 }, (_, i) => port(`DisplayPort 1.1 In ${i + 1}`, 'DisplayPort', 'DisplayPort')),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN (1G)'),
        mains('Mains In A'),
        mains('Mains In B'),
      ],
      outputs: [
        ...sdi(4, '3G-SDI Out'),
        ...Array.from({ length: 4 }, (_, i) => port(`HDMI 1.4a Out ${i + 1}`, 'HDMI', 'HDMI')),
        port('Multiviewer HDMI 1', 'HDMI', 'HDMI'),
        port('Multiviewer HDMI 2', 'HDMI', 'HDMI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes: '19" 3 HE · 24 kg · 100–240 V AC, 826 W · redundante Netzteile · abgekuendigt, Nachfolger S3-4K BTO',
      width: 280,
      height: 440,
    },
  },

  // Quelle: https://assets.barco.com/m/3e8cdadf32d467c1/original/ImagePRO-4K-en-Spec-sheet.pdf
  {
    match: ['barcoimagepro-4k', 'imagepro-4k', 'imagepro4k'],
    deviceTypeId: '17de2a2f-36c6-4469-9d9e-6c6ea0942d3f',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/3e8cdadf32d467c1/original/ImagePRO-4K-en-Spec-sheet.pdf',
      name: 'Barco ImagePRO-4K',
      category: MIX,
      inputs: [
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
        ...sdi(4, '12G/3G-SDI In'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN (1G)'),
        mains(),
      ],
      outputs: [
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 Out', 'DisplayPort', 'DisplayPort'),
        ...sdi(4, '12G/3G-SDI Out'),
        port('Reference Out', 'BNC', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      // Tri-Combo-Karte: 2x 12G ODER 4x 3G auf denselben vier BNC.
      notes: '19" 1 HE · 6,8 kg · 100–240 V AC, 125 W · Tri-Combo-Karten ab Werk · 2x 12G-SDI oder 4x 3G-SDI',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://assets.barco.com/m/551c7b03df99bf34/original/Ex-en-Spec-sheet.pdf
  {
    match: ['barcoex', 'eventmasterex', 'barcoeventmasterex'],
    deviceTypeId: '34f59d34-5a9a-43d3-85dc-fa17823d7de3',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/551c7b03df99bf34/original/Ex-en-Spec-sheet.pdf',
      name: 'Barco Event Master Ex',
      category: MIX,
      inputs: [port('Genlock In', 'BNC', 'Genlock'), eth('LAN (1G)'), mains()],
      outputs: [port('Reference Out', 'BNC', 'Genlock')],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        '19" 1 HE · 5,53 kg · 100–240 V AC, 125 W · 2 Kartenslots (Ein- oder Ausgang, je bis 8 I/O) · Erweiterung für E2/S3-4K per Link',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://assets.barco.com/m/3dde766e9029e7f4/original/ENCORE3-en-Spec-sheet.pdf
  {
    match: ['barcoencore3', 'encore3'],
    deviceTypeId: '8209d7d5-2a32-45a5-bf03-29fc1dc07326',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/3dde766e9029e7f4/original/ENCORE3-en-Spec-sheet.pdf',
      name: 'Barco Encore3',
      category: MIX,
      inputs: [port('Genlock In', 'BNC', 'Genlock'), eth('LAN (1G)'), mains('Mains In A'), mains('Mains In B')],
      outputs: [port('Genlock Out', 'BNC', 'Genlock')],
      isRackDevice: true,
      rackUnits: 4,
      notes:
        '19" 4 HE · 29 kg (Standard) · 100–240 V AC, 1.100 W, redundante Netzteile · bis 7 Eingangs-/4 Ausgangskarten (Event Master Gen2), Standard 16x 4K60 In / 8x 4K60 Out · Link 4x QSFP28 100G',
      width: 280,
      height: 200,
    },
  },
  // Quelle: https://assets.barco.com/m/67e917d0a461ec71/original/UDX-4K26-de-Spec-sheet.pdf
  {
    match: ['barcoudx-4k26', 'udx-4k26', 'udx4k26'],
    deviceTypeId: '44254bef-a137-4ac8-8d24-226f917f4e85',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/67e917d0a461ec71/original/UDX-4K26-de-Spec-sheet.pdf',
      name: 'Barco UDX-4K26',
      category: PROJ,
      // Anders als 4K32/4K40: Dual HDBaseT.
      inputs: [
        port('HDBaseT In 1', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDBaseT In 2', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
        ...sdi(4, '3G/12G-SDI In'),
        eth('LAN (10/100)'),
        mains(),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '26.000 (WQ)/25.000 (4K UHD) Center-Lumen, 28.000 ISO · nativ 2.560 x 1.600, 4K UHD 3.840 x 2.400 · Laser-Phosphor · 92 kg · 2.450 W nom./2.650 W max. · 200–240 V, 20 A · optional Quad DP1.2 · RS232, XLR-Remote',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://assets.barco.com/m/16ccc15c68f20821/original/F80-4K12-de-Spec-sheet.pdf
  {
    match: ['barcof80-4k12', 'f80-4k12', 'f804k12'],
    deviceTypeId: '209be820-0078-4a3d-938b-d8c928a87c9b',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/16ccc15c68f20821/original/F80-4K12-de-Spec-sheet.pdf',
      name: 'Barco F80-4K12',
      category: PROJ,
      inputs: [
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In 1', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort 1.2 In 2', 'DisplayPort', 'DisplayPort'),
        port('12G-SDI In', 'BNC', 'SDI'),
        port('DVI-D Dual Link In 1', 'DVI', 'DVI'),
        port('DVI-D Dual Link In 2', 'DVI', 'DVI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        eth('LAN (10/100)'),
        mains(),
      ],
      outputs: [port('12G-SDI Loop Out', 'BNC', 'SDI')],
      isRackDevice: false,
      notes:
        '11.300 Center-Lumen · 4K UHD 3.840 x 2.400 / nativ 2.716 x 1.600 · Laser-Phosphor · 26,8 kg ohne Objektiv · 1.050 W nom./1.200 W max. · RS232, XLR-Remote',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://assets.barco.com/m/2a92abdcf2ed3e3a/original/G100-W22-fr-Spec-sheet.pdf
  {
    match: ['barcog100-w22', 'g100-w22', 'g100w22'],
    deviceTypeId: 'b15d9a69-05ef-4cf2-bf6b-a11c943faaad',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/2a92abdcf2ed3e3a/original/G100-W22-fr-Spec-sheet.pdf',
      name: 'Barco G100-W22',
      category: PROJ,
      inputs: [
        port('HDMI 2.0b In 1', 'HDMI', 'HDMI'),
        port('HDMI 2.0b In 2', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2a In', 'DisplayPort', 'DisplayPort'),
        port('DVI-D In', 'DVI', 'DVI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('3G-SDI In', 'BNC', 'SDI'),
        port('VGA In', 'VGA', 'VGA'),
        eth('LAN (10/100)'),
        port('USB Typ A', 'USB', 'USB'),
        mains(),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '22.000 ISO-Lumen, 20.600 Center, 18.500 ANSI · WUXGA 1.920 x 1.200 · Laser-Phosphor · 54 kg ohne Objektiv · 1.200 W nom./1.380 W max. @ 220 V · RS232',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://assets.barco.com/m/2fac2dfba29b28f9/original/XDL-4K75-en-Spec-sheet.pdf
  {
    match: ['barcoxdl-4k75', 'xdl-4k75', 'xdl4k75'],
    deviceTypeId: '7ca69cc5-4943-4f44-bcf3-5736c42f9548',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/2fac2dfba29b28f9/original/XDL-4K75-en-Spec-sheet.pdf',
      name: 'Barco XDL-4K75',
      category: PROJ,
      // Drehstrom-Anschluss ohne Steckerangabe (nur Kabelquerschnitt) → kein Power-Port.
      inputs: [
        port('HDBaseT In 1', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDBaseT In 2', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
        ...sdi(4, '3G/12G-SDI In'),
        eth('LAN (10/100)'),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        'bis 70.000 (HC-Objektive)/75.000 (HB) Center-Lumen · nativ 4.096 x 2.160 bis 120 Hz · RGB-Laser 3P · 235 kg + 2 Chiller à ~115 kg · 6,7 kW + Chiller 3,0 kW · 200–240/346–415 V 3~ 16 A · RS232, XLR-Remote',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://assets.barco.com/m/4df3a7f38a8d49a9/original/S3-4K-Jr-Gen-2-en-Spec-sheet.pdf
  {
    match: ['barcos3-4kjrgen2', 's3-4kjrgen2', 's34kjrgen2', 's3-4kjr'],
    deviceTypeId: '7e7a49f2-4604-4b42-b777-f26be083a74d',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/4df3a7f38a8d49a9/original/S3-4K-Jr-Gen-2-en-Spec-sheet.pdf',
      name: 'Barco S3-4K Jr Gen 2',
      category: MIX,
      inputs: [
        ...sdi(4, '12G-SDI In'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN (1G)'),
        mains(),
      ],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`HDMI 2.0 Out ${i + 1}`, 'HDMI', 'HDMI')),
        port('Genlock Loop', 'BNC', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes:
        '19" 3 HE · 21 kg · 100–240 V AC, 826 W · ein Netzteil, zweites optional · 2 Ausgangskarten à 4x HDMI 2.0, Multiviewer-Karte 4x HDMI · Link-Karte optional',
      width: 280,
      height: 300,
    },
  },

]

/** Die Vorlagen allein — für die Bibliotheks-Saat in `projectStore`. */
export const barcoTemplates: EquipmentTemplate[] = BARCO_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
