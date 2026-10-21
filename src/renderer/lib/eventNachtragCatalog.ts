import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Welle 3a — bisher übersprungene Geräte (Barco, AV Stumpfl, HDFury, NovaStar).
//
// Quellen sind Herstellerblätter. Neu zugelassen: ein Hersteller-PDF, das auf
// einer Händler- oder Verleiher-Seite liegt (NovaStar-Handbücher bei
// audioeffetti.com, NovaStar-Blatt bei luxwave.vn). Shop-Produktseiten zählen
// nicht.
//
// Steckertypen: wo das Blatt die Buchse nicht nennt (Netzanschluss der
// Projektoren, RS232, DMX, Genlock der NovaStar-Steuerkarte), steht 'Generic'.
//
// MX6000 Pro / MX2000 Pro sind modular. Eingetragen ist die Beispiel-
// bestückung aus dem Handbuch (MX6000 Pro: vier Eingangskarten + eine
// 4x10G-Fiber-Ausgangskarte; MX2000 Pro: zwei Eingangskarten + eine
// 4x10G-Fiber-Ausgangskarte). Die Art der Eingangskarte nennt das Beispiel
// nicht; angenommen ist MX_4xHDMI 2.0. Fest am Chassis sind nur Steuerkarte
// (2x Ethernet, Genlock IN/LOOP) und Netz.
//
// ÜBERSPRUNGEN:
// - Barco UDX-W40 (FLEX): einziges gefundenes Blatt (zh) liefert kein PDF.
// - Barco UDM-U-Varianten, UDM-W15 u. a.: kein Herstellerblatt gefunden.
// - Barco UDX-4K32, G62-W11, ImagePRO-4K, PIXERA one/two/four/zero: schon im
//   Katalog.
// - Barco E3: kein Gerät dieses Namens mit Blatt auffindbar (nur E2/Ex/S3).
// - Analog Way Vio 4K: Hersteller-Kurzanleitung liefert HTML statt PDF, die
//   übrigen Blätter sind Verleiher-eigene Datenblätter.
// - Sony PVM-A250: pro.sony-PDF gesperrt (403), sonst nur Shopseiten.
// - Colorlight A100, A200: kein Herstellerblatt gefunden.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const usb = (name: string) => port(name, 'USB', 'USB')
const mains = (name = 'Mains In') => port(name, 'Generic', 'Power')
const sdi = (n: number, label: string) =>
  Array.from({ length: n }, (_, i) => port(`${label} ${i + 1}`, 'BNC', 'SDI'))

/** Eingänge der UDX/UDM-Plattform laut Blatt (Single HDBaseT, HDMI 2.0, DP 1.2, Quad 3G/12G-SDI). */
const udPlatformInputs = (): Port[] => [
  port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
  port('HDMI 2.0 In', 'HDMI', 'HDMI'),
  port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
  ...sdi(4, '3G/12G-SDI In'),
  port('RS232', 'Generic', 'RS232'),
  port('DMX 512', 'Generic', 'DMX'),
  mains(),
]

const PROJ = 'Projectors'
const MIX = 'Video Mixer'
const MS = 'Media Server'
const LED = 'LED Processing'
const CONV = 'Converter'

interface Wave3aEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const EVENT_NACHTRAG_CATALOG: Wave3aEntry[] = [

  // Quelle: https://assets.barco.com/m/b4dff8a6139799a/original/UDX-W32-en-Spec-sheet.pdf
  {
    match: ['barcoudx-w32', 'udx-w32', 'udxw32'],
    deviceTypeId: '5812b1f2-d18a-46be-9604-26484467f707',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/b4dff8a6139799a/original/UDX-W32-en-Spec-sheet.pdf',
      name: 'Barco UDX-W32',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '32.000 Center-Lumen, 31.000 ANSI, 34.000 ISO · WUXGA 1.920 x 1.200 · 92 kg · 2.900 W nom./3.100 W max. · 200–240 V, 20 A · optional Quad DP1.2 / Fiber SFP · Steuerung XLR-Remote, IR, RS232',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/192e03ffedbe6d59/original/UDX-U32-zh-Spec-sheet.pdf
  {
    match: ['barcoudx-u32', 'udx-u32', 'udxu32'],
    deviceTypeId: 'bcb2b212-f120-4063-b34a-cb6cb06343c9',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/192e03ffedbe6d59/original/UDX-U32-zh-Spec-sheet.pdf',
      name: 'Barco UDX-U32',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '30.000 Center-Lumen, 29.000 ANSI, 32.000 ISO · UXGA · 92 kg · 2.900 W nom./3.100 W max. · Steuerung XLR-Remote, IR, RS232 · Blatt nur chinesisch gefunden',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/13300e4141ff86fb/original/UDX-U40-en-Spec-sheet.pdf
  {
    match: ['barcoudx-u40', 'udx-u40', 'udxu40'],
    deviceTypeId: '7f21b7f2-3a47-49a1-acaa-a71ca723958b',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/13300e4141ff86fb/original/UDX-U40-en-Spec-sheet.pdf',
      name: 'Barco UDX-U40',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '37.500 Center-Lumen, 36.500 ANSI, 40.000 ISO · UXGA 1.600 x 1.200 · 92 kg · 3.750 W max. · 200–240 V, 20 A · optional Quad DP1.2 / Fiber SFP · Steuerung XLR-Remote, IR, RS232',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/467da972b341cb32/original/UDM-W22-en-Spec-sheet.pdf
  {
    match: ['barcoudm-w22', 'udm-w22', 'udmw22'],
    deviceTypeId: '6a0ae5be-fb6b-472f-b4e4-8ed844e97283',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/467da972b341cb32/original/UDM-W22-en-Spec-sheet.pdf',
      name: 'Barco UDM-W22',
      category: PROJ,
      inputs: udPlatformInputs(),
      outputs: [],
      isRackDevice: false,
      notes:
        '21.000 Center-Lumen, 20.000 ANSI, 22.000 ISO · WUXGA 1.920 x 1.200 · 48 kg · 1.800 W nom./2.200 W max. @ 230 V · optional Quad DP1.2 / Fiber SFP · Steuerung XLR-Remote, IR, RS232',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.barco.com/m/17ac00a41ab5b5fc/original/F90-4K13-nl-Spec-sheet.pdf
  {
    match: ['barcof90-4k13', 'f90-4k13', 'f904k13'],
    deviceTypeId: 'f033715b-fc6e-43f5-8eaa-b065f2104b12',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/17ac00a41ab5b5fc/original/F90-4K13-nl-Spec-sheet.pdf',
      name: 'Barco F90-4K13',
      category: PROJ,
      inputs: [
        port('HD-SDI In', 'BNC', 'SDI'),
        port('DisplayPort In 1', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort In 2', 'DisplayPort', 'DisplayPort'),
        port('DVI-D Dual Link In 1', 'DVI', 'DVI'),
        port('DVI-D Dual Link In 2', 'DVI', 'DVI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        eth('LAN (10/100)'),
        port('DMX In', 'Generic', 'DMX'),
        port('RS232 In', 'Generic', 'RS232'),
        usb('USB 1'),
        usb('USB 2'),
        mains(),
      ],
      outputs: [
        port('DMX Out', 'Generic', 'DMX'),
        port('12 V Out', 'Generic', 'Power'),
      ],
      isRackDevice: false,
      notes:
        '11.700 Center-Lumen, 10.500 ANSI, 11.800 ISO · 4K UHD · 44,5 kg · 575 x 730 x 295 mm · HDMI 2.0 und DMX im Blatt mit Sternchen markiert',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://assets.barco.com/m/2ed82c7492965834/original/F400-4K-nl-Spec-sheet.pdf
  {
    match: ['barcof400-4k', 'f400-4k', 'f4004k'],
    deviceTypeId: '4270f814-8459-4d15-a1aa-91154e8572c4',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/2ed82c7492965834/original/F400-4K-nl-Spec-sheet.pdf',
      name: 'Barco F400-4K',
      category: PROJ,
      inputs: [
        port('DisplayPort 1.4 In', 'DisplayPort', 'DisplayPort'),
        port('HDMI 2.1 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In 1', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort 1.2 In 2', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort 1.2 In 3', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort 1.2 In 4', 'DisplayPort', 'DisplayPort'),
        eth('LAN (10/100/1000)'),
        mains(),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '5.400 ANSI-Lumen, 5.750 Center · WQXGA nativ 2.560 x 1.600, bis 120 Hz · Simulation/Training · 31 kg ohne Objektiv · 815 W typ./1.200 W max. · 100–240 V',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://assets.barco.com/asset/37b1d0ce-aa23-4ca8-a311-f4d0a664c328/G62-W14-de-Spec-sheet.pdf
  {
    match: ['barcog62-w14', 'g62-w14', 'g62w14'],
    deviceTypeId: '8b9e876f-04e0-4aae-9276-593dfac88554',
    template: {
      manufacturerUrl: 'https://assets.barco.com/asset/37b1d0ce-aa23-4ca8-a311-f4d0a664c328/G62-W14-de-Spec-sheet.pdf',
      name: 'Barco G62-W14',
      category: PROJ,
      inputs: [
        port('HDMI 2.0 In 1', 'HDMI', 'HDMI'),
        port('HDMI 2.0 In 2', 'HDMI', 'HDMI'),
        port('DVI-D In', 'DVI', 'DVI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('3G-SDI In', 'BNC', 'SDI'),
        port('3D Sync In', 'Generic', 'Sync'),
        port('RS232', 'Generic', 'RS232'),
        port('Wired Remote (3,5 mm)', 'Jack 3.5 mm', 'Control'),
        eth('LAN (10/100)'),
        mains(),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '11.500 ANSI-Lumen, 12.800 Center, 13.600 ISO · WUXGA · 22,7 kg ohne Objektiv · 810 W nom./970 W max. · 100–240 V',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://assets.barco.com/asset/26413f32-75ad-431c-bad0-6f7be4166769/G50-W8-en-Spec-sheet.pdf
  {
    match: ['barcog50-w8', 'g50-w8', 'g50w8', 'barcog50'],
    deviceTypeId: '7ae2f3b6-67ed-4dc7-8f6a-2bb7ca5deb5b',
    template: {
      manufacturerUrl: 'https://assets.barco.com/asset/26413f32-75ad-431c-bad0-6f7be4166769/G50-W8-en-Spec-sheet.pdf',
      name: 'Barco G50-W8',
      category: PROJ,
      inputs: [
        port('HDMI 2.0b In 1', 'HDMI', 'HDMI'),
        port('HDMI 2.0b In 2', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2a In', 'DisplayPort', 'DisplayPort'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('3D Sync In', 'Generic', 'Sync'),
        port('RS232', 'DB9', 'RS232'),
        eth('LAN (10/100)'),
        mains(),
      ],
      outputs: [
        port('HDMI Out (Loop)', 'HDMI', 'HDMI'),
        port('3D Sync Out', 'Generic', 'Sync'),
        port('DC 12 V Out', 'Generic', 'Power'),
        port('Audio Out', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes:
        '7.500 ANSI-Lumen, 8.300 Center, 8.900 ISO · WUXGA · 13 kg ohne Objektiv · 500 W @ 110 V / 490 W @ 220 V · 100–240 V',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://assets.barco.com/m/6ed7ab822bfdc545/original/XDX-4K40-en-Spec-sheet.pdf
  {
    match: ['barcoxdx-4k40', 'xdx-4k40', 'xdx4k40'],
    deviceTypeId: 'c372e896-c516-4e62-92b5-79ff4b73c629',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/6ed7ab822bfdc545/original/XDX-4K40-en-Spec-sheet.pdf',
      name: 'Barco XDX-4K40',
      category: PROJ,
      inputs: [port('HDMI 2.0 In', 'HDMI', 'HDMI'), mains()],
      outputs: [],
      isRackDevice: false,
      notes:
        '40.000 Lumen typ. · nativ 4K 4.096 x 2.160 · RGB-Laser · 206 kg im Rahmen · 3,9 kW · ein- oder dreiphasig 200–240 V, 20 A · Blatt nennt nur HDMI 2.0 als Eingang',
      width: 280,
      height: 220,
    },
  },

  // Quelle: https://assets.barco.com/m/6fc1adfc3deff041/original/XDM-4K25-nl-Spec-sheet.pdf
  {
    match: ['barcoxdm-4k25', 'xdm-4k25', 'xdm4k25', 'barcoxdm'],
    deviceTypeId: '4ccdbbe0-a2b8-4416-8849-2f664e9548d6',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/6fc1adfc3deff041/original/XDM-4K25-nl-Spec-sheet.pdf',
      name: 'Barco XDM-4K25',
      category: PROJ,
      inputs: [port('HDMI 2.0 In', 'HDMI', 'HDMI'), mains()],
      outputs: [],
      isRackDevice: false,
      notes:
        '23.500 Lumen typ. · nativ 4K 4.096 x 2.160 · RGB-Laser · 140 kg im Rahmen · 710 x 1.070 x 547 mm · Blatt nennt nur HDMI 2.0 als Eingang',
      width: 280,
      height: 220,
    },
  },

  // Quelle: https://assets.barco.com/m/537ad459e5c7a704/original/Galaxy-4K-32-en-Spec-sheet.pdf
  {
    match: ['barcogalaxy4k-32', 'galaxy4k-32', 'galaxy4k32', 'barcogalaxy4k'],
    deviceTypeId: '71445026-e2f1-4925-89d8-43ed1075a407',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/537ad459e5c7a704/original/Galaxy-4K-32-en-Spec-sheet.pdf',
      name: 'Barco Galaxy 4K-32',
      category: PROJ,
      inputs: [
        port('DVI In 1 (Single Link)', 'DVI', 'DVI'),
        port('DVI In 2 (Single Link)', 'DVI', 'DVI'),
        eth('Ethernet'),
        port('GPIO (8x)', 'Generic', 'GPIO'),
        port('RS232', 'Generic', 'RS232'),
        mains('Mains In (3W+N+PE 230/400 V, 16 A)'),
      ],
      outputs: [],
      isRackDevice: false,
      notes:
        '33.000 Lumen (6,5-kW-Lampe) · 4.096 x 2.160 · aktives 3D-Stereo · 141 kg · 604 x 754 x 1.129 mm · Drehstrom 230/400 V 16 A oder 208 V 27 A',
      width: 280,
      height: 240,
    },
  },

  // Quelle: https://assets.barco.com/m/12f5f465c4351fac/original/I600-4K10-de-Spec-sheet.pdf
  {
    match: ['barcoi600-4k10', 'i600-4k10', 'i6004k10', 'barcoi600'],
    deviceTypeId: 'e2ba49bc-bf85-41fc-ac1e-4bd49fb920ca',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/12f5f465c4351fac/original/I600-4K10-de-Spec-sheet.pdf',
      name: 'Barco I600-4K10',
      category: PROJ,
      inputs: [
        port('HDMI 2.1 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.4 In', 'DisplayPort', 'DisplayPort'),
        eth('LAN (10/100/1000)'),
        usb('USB (5 V)'),
        port('3D Sync In', 'BNC', 'Sync'),
        mains(),
      ],
      outputs: [
        port('3D Sync Out', 'BNC', 'Sync'),
        port('12 V Out', 'Generic', 'Power'),
      ],
      isRackDevice: false,
      notes:
        '10.000 ISO-Lumen · 4K UHD 3.840 x 2.400 · 23,6 kg ohne Objektiv · 860 W typ. · optionaler Eingangssteckplatz: HDBaseT (Lite)/HDMI/Quad 3G/12G/DMX, optional 4x DP 1.2',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://assets.barco.com/m/33318b193cf7d6c1/original/ImagePRO-II-zh-Spec-sheet.pdf
  {
    match: ['barcoimagepro-ii', 'imagepro-ii', 'imageproii', 'imagepro2'],
    deviceTypeId: '9066cd0f-1ce3-4f3a-be38-054cbbd30f2d',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/33318b193cf7d6c1/original/ImagePRO-II-zh-Spec-sheet.pdf',
      name: 'Barco ImagePRO-II',
      category: MIX,
      inputs: [
        port('DVI-I Dual Link In', 'DVI', 'DVI'),
        port('HD-15 (VGA) In', 'VGA', 'VGA'),
        port('HDMI 1.4 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.1 In', 'DisplayPort', 'DisplayPort'),
        port('3G-SDI In', 'BNC', 'SDI'),
        port('Genlock In', 'BNC', 'Genlock'),
        port('Ethernet', 'etherCON', 'Ethernet'),
        mains(),
      ],
      outputs: [
        port('Composite Out (NTSC/PAL)', 'BNC', 'Composite'),
        port('DVI-I Dual Link Out', 'DVI', 'DVI'),
        port('HD-15 (VGA) Out', 'VGA', 'VGA'),
        port('HDMI 1.4 Out', 'HDMI', 'HDMI'),
        port('DisplayPort 1.1 Out', 'DisplayPort', 'DisplayPort'),
        port('3G-SDI Out', 'BNC', 'SDI'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        'Skalierer/Scan-Converter/Umschalter · Standardmodell: 5 Eingänge, 6 Ausgänge (Dual-Output-Option: +1 SDI In/Out, 3D-Sync DIN) · Loop-through für Analog, DVI, SDI und Genlock laut Blatt · ImagePRO-II Jr ohne HDMI/DP · Blatt nur chinesisch gefunden',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://pixera.helpjuice.com/pixera-mini-technical-specifications
  {
    match: ['avstumpflpixeramini', 'pixeramini', 'pxm-2', 'pxm-4'],
    deviceTypeId: '60f56934-e5f7-4dfe-8728-f474bd6ee9f9',
    template: {
      manufacturerUrl: 'https://pixera.helpjuice.com/pixera-mini-technical-specifications',
      name: 'AV Stumpfl PIXERA mini',
      category: MS,
      inputs: [
        usb('USB 2 Front'),
        usb('USB 3 Rear 1'),
        usb('USB 3 Rear 2'),
        usb('USB 3 Rear 3'),
        usb('USB 3 Rear 4'),
        eth('1GbE 1'),
        eth('1GbE 2'),
        port('DC In (externes Netzteil, 100–240 V)', 'Generic', 'Power'),
      ],
      outputs: [
        port('Video Out 1 (mDP 1.4)', 'Mini-DisplayPort', 'DisplayPort'),
        port('Video Out 2 (mDP 1.4)', 'Mini-DisplayPort', 'DisplayPort'),
        port('Video Out 3 (mDP 1.4)', 'Mini-DisplayPort', 'DisplayPort'),
        port('Video Out 4 (mDP 1.4)', 'Mini-DisplayPort', 'DisplayPort'),
        port('Audio Out (Stereo, unsym.)', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes:
        'Dual (PXM-2) / Quad (PXM-4) · 4 physische mDP-1.4-Ausgänge, 2 bzw. 4 lizenziert · 215 x 230 x 44,4 mm, 2,5 kg + Netzteil 0,6 kg · 150 W Spitze',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://pixera.helpjuice.com/pixera-two-technical-specifications-converted-1
  {
    match: ['avstumpflpixeraocto', 'pixeraocto', 'pixeratwoocto', 'px2-8'],
    deviceTypeId: '86428aa1-60e1-456d-b10d-ea592cf282b7',
    template: {
      manufacturerUrl: 'https://pixera.helpjuice.com/pixera-two-technical-specifications-converted-1',
      name: 'AV Stumpfl PIXERA two Octo',
      category: MS,
      inputs: [
        usb('USB 3 Front 1'),
        usb('USB 3 Front 2'),
        usb('USB 3 Rear 1'),
        usb('USB 3 Rear 2'),
        usb('USB 2 Rear 1'),
        usb('USB 2 Rear 2'),
        eth('10GbE 1'),
        eth('10GbE 2'),
        eth('IPMI LAN'),
        port('Genlock', 'Generic', 'Genlock'),
        mains('Mains In A (100–240 V)'),
        mains('Mains In B (100–240 V)'),
      ],
      outputs: [
        port('Video Out 1 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 2 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 3 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 4 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 5 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 6 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 7 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Video Out 8 (DP 1.4)', 'DisplayPort', 'DisplayPort'),
        port('Audio Out (Stereo, unsym.)', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes:
        'PX2-8 · 8 physische DP-1.4-Ausgänge, 5–8 lizenziert · Genlock/Framelock ja (Buchse nicht genannt) · optional: 2x GUI-mDP, Capture HDMI/3G-SDI, Audio-Karten · redundantes Hot-Plug-Netzteil, 800 W Spitze · 445 x 468 x 88,9 mm, 13,1 kg',
      width: 280,
      height: 380,
    },
  },

  // Quelle: https://www.hdfury.com/docs/HDfuryVertex.pdf
  {
    match: ['hdfuryvertex', 'vertex', '4kvertex'],
    deviceTypeId: '4b8a4b5c-a429-45f2-99f3-8fd2a6196650',
    template: {
      manufacturerUrl: 'https://www.hdfury.com/docs/HDfuryVertex.pdf',
      name: 'HDFury Vertex',
      category: CONV,
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('RS232', 'Generic', 'RS232'),
        port('Power In (5 V DC, Mini-USB)', 'USB Mini-B', 'Power'),
      ],
      outputs: [
        port('HDMI Out TX0 (unten)', 'HDMI', 'HDMI'),
        port('HDMI Out TX1 (oben, Downscale)', 'HDMI', 'HDMI'),
        port('Audio Out (Analog L/R / Mini-Toslink)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes:
        'HDMI 2.0b, 18 Gbit/s, HDCP 2.2 · Splitter/Matrix 2x2, Skalierung, EDID, Audio-De-Embedder · Steuerung IR, USB-GUI, RS232, Bluetooth · Netzteil 5 V/2 A',
      width: 240,
      height: 200,
    },
  },

  // Quelle: https://luxwave.vn/downloads/novastar/novastar-cvt8-5g-m-spec.pdf
  {
    match: ['novastarcvt8-5gs', 'cvt8-5gs', 'cvt85gs'],
    deviceTypeId: '50ec7480-0093-4603-85fc-fdc515c2c90c',
    template: {
      manufacturerUrl: 'https://luxwave.vn/downloads/novastar/novastar-cvt8-5g-m-spec.pdf',
      name: 'NovaStar CVT8-5GS',
      category: LED,
      inputs: [
        port('OPT 40G (Single-Mode)', 'Fiber Optic LC', 'Fiber'),
        port('USB Type-B (Steuerung)', 'USB Type B', 'USB'),
        port('Power In (100–240 V)', 'PowerCON', 'Power'),
      ],
      outputs: Array.from({ length: 8 }, (_, i) => port(`5G Ethernet ${i + 1}`, 'Ethernet/RJ45', 'Ethernet')),
      isRackDevice: true,
      rackUnits: 1,
      notes:
        'Glasfaser-Wandler für den 5G-Weg (MX 1x40G-Ausgangskarte, CX40/CX80) · Single-Mode OS1/OS2, 1310 nm, bis 10 km · 8x 5G BaseT, CAT6 bis 100 m · halbe 19"-Breite, 1 HE · 33 W · 2,26 kg · Blatt deckt CVT8-5GS und -5GM ab',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://audioeffetti.com/product/documents/NOV/MX6000PRO-01.pdf
  {
    match: ['novastarmx6000pro', 'mx6000pro', 'mx6000'],
    deviceTypeId: '021a2b4b-a2fd-47e8-82dd-c2bb51772c36',
    template: {
      manufacturerUrl: 'https://audioeffetti.com/product/documents/NOV/MX6000PRO-01.pdf',
      name: 'NovaStar MX6000 Pro',
      category: LED,
      // Modular: Beispielbestückung aus dem Handbuch — vier Eingangskarten
      // (hier MX_4xHDMI 2.0 angenommen) und eine MX_4x10G-Fiber-Ausgangskarte.
      inputs: [
        ...Array.from({ length: 16 }, (_, i) => port(`HDMI 2.0 In ${i + 1} (Karte ${Math.floor(i / 4) + 1})`, 'HDMI', 'HDMI')),
        eth('Ethernet 1 (Steuerkarte)'),
        eth('Ethernet 2 (Steuerkarte)'),
        port('Genlock In', 'Generic', 'Genlock'),
        usb('USB 2.0 (Front, Diagnose)'),
        mains('AC In 1'),
        mains('AC In 2'),
      ],
      outputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`10G SFP+ Out ${i + 1}`, 'SFP+', 'Fiber')),
        port('Genlock Loop', 'Generic', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 6,
      notes:
        'Modular, Standard-/Beispielbestückung laut Handbuch: 4 Eingangskarten (hier 4x HDMI 2.0 angenommen) + 1x 4x10G-Fiber-Ausgangskarte · 8 IN-, 8 OUT-Steckplätze, MVR, CTRL · bis 32x 4K@60 / 8x 8K@30, 141 Mio. Pixel · AUX (RS232) und SPDIF reserviert · 100–127/200–240 V, 15/10 A',
      width: 280,
      height: 560,
    },
  },

  // Quelle: https://audioeffetti.com/product/documents/NOV/MX2000PRO-01.pdf
  {
    match: ['novastarmx2000pro', 'mx2000pro', 'mx2000'],
    deviceTypeId: 'cb059740-f9a2-4161-a5de-bccd06492395',
    template: {
      manufacturerUrl: 'https://audioeffetti.com/product/documents/NOV/MX2000PRO-01.pdf',
      name: 'NovaStar MX2000 Pro',
      category: LED,
      // Modular: Beispielbestückung aus dem Handbuch — zwei Eingangskarten
      // (hier MX_4xHDMI 2.0 angenommen) und eine MX_4x10G-Fiber-Ausgangskarte.
      inputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`HDMI 2.0 In ${i + 1} (Karte ${Math.floor(i / 4) + 1})`, 'HDMI', 'HDMI')),
        eth('Ethernet 1 (Steuerkarte)'),
        eth('Ethernet 2 (Steuerkarte)'),
        port('Genlock In', 'Generic', 'Genlock'),
        usb('USB 2.0 (Front, Diagnose)'),
        mains('AC In'),
      ],
      outputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`10G SFP+ Out ${i + 1}`, 'SFP+', 'Fiber')),
        port('Genlock Loop', 'Generic', 'Genlock'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes:
        'Modular, Standard-/Beispielbestückung laut Handbuch: 2 Eingangskarten (hier 4x HDMI 2.0 angenommen) + 1x 4x10G-Fiber-Ausgangskarte · bis 8x 4K@60 / 4x 8K@30, 35,38 Mio. Pixel · Alternative Ausgangskarte 1x40G QSFP+ (5G-Weg, CVT8-5G) · AUX (RS232) und SPDIF reserviert · 100–240 V',
      width: 280,
      height: 420,
    },
  },
]
