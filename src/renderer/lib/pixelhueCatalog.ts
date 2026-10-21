import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// PixelHue — Presentation Switcher (P10, P20, P20-DS, P80, Q8, F4, F8),
// Live-Switcher S16, Media-Server X400 (G1), 4K ViewPro, Event Controller U3,
// HDMI-Splitter HDMI 4K 1-4. Stand pixelhue.com 2026-10-21.
//
// Kartengeraete (Q8, F4, F8, X400) stehen voll bestueckt mit EINER
// Kartensorte; welche, steht in `notes`.
//
// NICHT AUFGENOMMEN (keine Port-Anzahlen in Datenblatt oder Produktseite):
// U5, U5 Pro (Datenblatt nennt nur „abundant I/O"), U5 MINI (nur Strom-
// angaben), EP4T/R Pro (Steckertypen ohne Anzahl), drei weitere Extender
// unter catid/50 (id 19/25/26, Seiten liefern keinen Inhalt), F4 Lite (im
// Handbuch, nicht mehr auf der Website).
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const n = (count: number, f: (i: number) => Port): Port[] => Array.from({ length: count }, (_, i) => f(i + 1))
const hdmi = (name: string) => port(name, 'HDMI', 'HDMI')
const dp = (name: string) => port(name, 'DisplayPort', 'DisplayPort')
const sdi = (name: string) => port(name, 'BNC', 'SDI')
const dvi = (name: string) => port(name, 'DVI', 'DVI')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const usb = (name: string) => port(name, 'USB', 'USB')
const opt = (name: string) => port(name, 'SFP+', 'Fiber')
const dante = (name: string) => port(name, 'Ethernet/RJ45', 'Dante')
const genIn = () => port('Genlock In', 'BNC', 'Genlock')
const genLoop = () => port('Genlock Loop', 'BNC', 'Genlock')
const mains = (name = 'Mains In (100–240 V)') => port(name, 'IEC 230V', 'Power')

const MIX = 'Video Mixer'

interface PixelhueEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const PIXELHUE_CATALOG: PixelhueEntry[] = [
  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf
  {
    match: ['pixelhuep10', 'p10'],
    deviceTypeId: '12f04fd0-a50c-4670-9a46-996d9d5c0505',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf',
      name: 'PixelHue P10',
      category: MIX,
      // Je Eingang DP 1.2 ODER HDMI 2.0 — nur eine Buchse des Paars aktiv.
      inputs: [
        ...n(4, (i) => hdmi(`In ${i} HDMI 2.0`)),
        ...n(4, (i) => dp(`In ${i} DP 1.2`)),
        ...n(2, (i) => sdi(`12G-SDI In ${i}`)),
        port('Audio Line In 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line In 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genIn(),
        eth('Ethernet 1 (primary)'),
        eth('Ethernet 2 (backup)'),
        mains(),
      ],
      outputs: [
        ...n(2, (i) => hdmi(`Out ${i} HDMI 2.0`)),
        ...n(6, (i) => hdmi(`Out HDMI 1.3 ${i}`)),
        ...n(4, (i) => opt(`OPT 10G ${i} (copy)`)),
        ...n(2, (i) => sdi(`12G-SDI Loop ${i}`)),
        ...n(2, (i) => hdmi(`AUX ${i} HDMI 1.3`)),
        hdmi('Multiviewer HDMI 1.3'),
        port('Audio Line Out 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line Out 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '19" 2 HE · 100–240 V~ 50/60 Hz · 6 DL-Layer · Audio laut Blatt erst per Update aktiv',
      width: 280,
      height: 520,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf
  {
    match: ['pixelhuep20', 'p20'],
    deviceTypeId: '83ba575c-6960-45ce-b0dd-7c5ad3554cab',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf',
      name: 'PixelHue P20',
      category: MIX,
      inputs: [
        ...n(8, (i) => hdmi(`In ${i} HDMI 2.0`)),
        ...n(8, (i) => dp(`In ${i} DP 1.2`)),
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        port('Audio Line In 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line In 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genIn(),
        eth('Ethernet 1 (primary)'),
        eth('Ethernet 2 (backup)'),
        mains(),
      ],
      outputs: [
        ...n(8, (i) => hdmi(`Out ${i} HDMI 2.0`)),
        ...n(8, (i) => opt(`OPT 10G ${i} (copy)`)),
        ...n(4, (i) => sdi(`12G-SDI Loop ${i}`)),
        ...n(4, (i) => hdmi(`AUX ${i} HDMI 1.3`)),
        hdmi('Multiviewer HDMI 1.3'),
        port('Audio Line Out 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line Out 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes: '19" 3 HE · 100–240 V~ 50/60 Hz, 3.0–1.5 A · 12 DL-Layer · DP/HDMI je Eingang alternativ',
      width: 280,
      height: 680,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf
  {
    match: ['pixelhuep20ds', 'p20ds'],
    deviceTypeId: '807736e3-879b-4f32-896d-b6fb1be6082d',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/P%20Series%204K%20Presentation%20Switchers%20Datasheet-V1.6.0.pdf',
      name: 'PixelHue P20-DS',
      category: MIX,
      // Anders als P20: SDI-Eingaenge ohne Loop, dafuer 4x 12G-SDI-Ausgang + Dante.
      inputs: [
        ...n(8, (i) => hdmi(`In ${i} HDMI 2.0`)),
        ...n(8, (i) => dp(`In ${i} DP 1.2`)),
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        port('Audio Line In 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line In 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        dante('Dante Primary'),
        dante('Dante Secondary'),
        genIn(),
        eth('Ethernet 1 (primary)'),
        eth('Ethernet 2 (backup)'),
        mains(),
      ],
      outputs: [
        ...n(8, (i) => hdmi(`Out ${i} HDMI 2.0`)),
        ...n(4, (i) => sdi(`12G-SDI Out ${i}`)),
        ...n(8, (i) => opt(`OPT 10G ${i} (copy)`)),
        ...n(4, (i) => hdmi(`AUX ${i} HDMI 1.3`)),
        hdmi('Multiviewer HDMI 1.3'),
        port('Audio Line Out 1 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Audio Line Out 2 (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes: '19" 3 HE · 100–240 V~ 50/60 Hz, 3.0–1.5 A · Dante 32x32 (AES67)',
      width: 280,
      height: 680,
    },
  },

  // Quelle: https://www.pixelhue.com/index.php/Content/products_detail/catid/64/id/29.html
  {
    match: ['pixelhuep80', 'p80'],
    deviceTypeId: '014c7a81-a9f1-410c-82ab-58adcd60c89f',
    template: {
      manufacturerUrl: 'https://www.pixelhue.com/index.php/Content/products_detail/catid/64/id/29.html',
      name: 'PixelHue P80',
      category: MIX,
      inputs: [
        ...n(4, (i) => hdmi(`In ${i} HDMI 2.0`)),
        ...n(4, (i) => hdmi(`In ${i + 4} HDMI 2.0`)),
        ...n(4, (i) => dp(`In ${i + 4} DP 1.2`)),
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        dante('Dante Primary'),
        dante('Dante Secondary'),
        genIn(),
        eth('Ethernet 1 (primary)'),
        eth('Ethernet 2 (backup)'),
        mains('Mains In'),
      ],
      outputs: [
        ...n(8, (i) => hdmi(`Main Out ${i} HDMI 2.0`)),
        ...n(8, (i) => opt(`SFP 10G ${i} (copy)`)),
        ...n(4, (i) => hdmi(`Flex Out ${i} HDMI 2.0`)),
        ...n(4, (i) => sdi(`12G-SDI Matrix Out ${i}`)),
        ...n(2, (i) => hdmi(`Multiviewer ${i} HDMI 2.0`)),
        genLoop(),
      ],
      isRackDevice: true,
      notes: 'Produktseite nennt weder HE noch Netzdaten · Eingänge 5–8 DP/HDMI alternativ',
      width: 280,
      height: 660,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Q8%20Seamless%20Switcher%20Specifications-V2.0.0.pdf
  {
    match: ['pixelhueq8', 'q8'],
    deviceTypeId: 'f17c0472-3ed8-4043-89dc-ee17a8ab4c70',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Q8%20Seamless%20Switcher%20Specifications-V2.0.0.pdf',
      name: 'PixelHue Q8',
      category: MIX,
      inputs: [
        ...n(48, (i) => hdmi(`In ${i} HDMI 2.0`)),
        ...n(24, (i) => sdi(`12G-SDI In ${i}`)),
        port('Audio In (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        dante('Dante Primary'),
        dante('Dante Secondary'),
        genIn(),
        eth('Control Ethernet 1 (etherCON)'),
        eth('Control Ethernet 2 (etherCON)'),
        usb('USB 3.0'),
        mains('Mains In 1 (primary)'),
        mains('Mains In 2 (primary)'),
        mains('Mains In 3 (backup)'),
      ],
      outputs: [
        ...n(16, (i) => hdmi(`Out ${i} HDMI 2.0`)),
        ...n(16, (i) => sdi(`12G-SDI Out ${i}`)),
        ...n(32, (i) => opt(`OPT 10G ${i}`)),
        ...n(2, (i) => hdmi(`MVR ${i} HDMI 2.0`)),
        port('Audio Out (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 7,
      notes: '19" 7 HE · max. bestückt: 6x Input-Karte 8xHDMI2.0+4x12G-SDI, 4x Output-Karte 4xHDMI2.0+4x12G-SDI+8xOPT · 100–240 V~, 10–5 A, max. 1400 W · 2+1 Netzteile · LINK-/QSFP-Kaskadierung nicht abgebildet',
      width: 280,
      height: 1760,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf
  {
    match: ['pixelhuef8', 'f8', 'flexviewf8'],
    deviceTypeId: 'f9d3e95c-05fe-4482-b7fb-9116c9f636a1',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf',
      name: 'PixelHue F8',
      category: MIX,
      inputs: [
        ...n(32, (i) => hdmi(`In ${i} HDMI 1.4`)),
        eth('Control Ethernet (100M)'),
        usb('USB-A 1'),
        usb('USB-A 2'),
        usb('USB-B'),
        genIn(),
        mains('Mains In 1'),
        mains('Mains In 2'),
      ],
      outputs: [
        // Karte 8, Buchsen 1+2 sind per Default Multiviewer (1080p60).
        ...n(32, (i) => hdmi(`Out ${i} HDMI 1.4`)),
        ...n(4, (i) => hdmi(`AUX ${i} HDMI 1.3`)),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 8,
      notes: '19", H 354.9 mm (8 HE) · voll bestückt: 8x F_4xHDMI1.4 Input, 8x F_4xHDMI1.4 Output, 1x F_4xAUX_HDMI1.3 · 100–240 V~, 10–5 A, max. 700 W',
      width: 280,
      height: 880,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf
  {
    match: ['pixelhuef4', 'f4', 'flexviewf4'],
    deviceTypeId: '13b5a005-4baf-4686-a31a-3b2a447c79db',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf',
      name: 'PixelHue F4',
      category: MIX,
      inputs: [
        ...n(32, (i) => hdmi(`In ${i} HDMI 1.4`)),
        eth('Control Ethernet (100M)'),
        usb('USB-A 1'),
        usb('USB-A 2'),
        usb('USB-B'),
        genIn(),
        mains('Mains In 1'),
        mains('Mains In 2'),
      ],
      outputs: [
        ...n(24, (i) => hdmi(`Out ${i} HDMI 1.4`)),
        ...n(4, (i) => hdmi(`AUX ${i} HDMI 1.3`)),
        genLoop(),
      ],
      isRackDevice: true,
      rackUnits: 5,
      notes: '19", H 212.2 mm (5 HE) · voll bestückt: 8x F_4xHDMI1.4 Input, 6x F_4xHDMI1.4 Output, 1x F_4xAUX_HDMI1.3 · Control-Karte wie F8 (Handbuch) · 100–240 V~, 10–5 A, max. 600 W',
      width: 280,
      height: 860,
    },
  },

  // Quelle: https://www.pixelhue.com/index.php/Content/products_detail/catid/69/id/28.html
  {
    match: ['pixelhues16', 's16'],
    deviceTypeId: '5aeef912-ca2b-400d-a47b-3d4f0dad064e',
    template: {
      manufacturerUrl: 'https://www.pixelhue.com/index.php/Content/products_detail/catid/69/id/28.html',
      name: 'PixelHue S16',
      category: MIX,
      // 16 aus 20 Eingaengen gleichzeitig nutzbar.
      inputs: [
        ...n(16, (i) => sdi(`12G-SDI In ${i}`)),
        ...n(4, (i) => hdmi(`In ${i} HDMI 2.0`)),
        port('Audio In 1 (XLR/TRS)', 'XLR', 'Audio'),
        port('Audio In 2 (XLR/TRS)', 'XLR', 'Audio'),
        mains(),
      ],
      outputs: [
        hdmi('PGM 1 HDMI 2.0'),
        sdi('PGM 1 12G-SDI (copy)'),
        hdmi('PGM 2 HDMI 2.0'),
        sdi('PGM 2 12G-SDI (copy)'),
        hdmi('Multiviewer HDMI 2.0'),
        sdi('Multiviewer 12G-SDI'),
        ...n(8, (i) => sdi(`AUX ${i} 12G-SDI`)),
        ...n(4, (i) => hdmi(`AUX ${i + 8} HDMI 2.0`)),
        port('Streaming USB 3.0', 'USB-C', 'USB'),
        port('Audio Out 1 (XLR)', 'XLR', 'Audio'),
        port('Audio Out 2 (XLR)', 'XLR', 'Audio'),
        port('Monitor Out (TRS)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Pultgerät 600 x 390.7 x 232.3 mm · 100–240 V~, 10 A, max. 175 W · Dante optional (nicht abgebildet)',
      width: 280,
      height: 560,
    },
  },

  // Quelle: https://www.pixelhue.com/index.php/Content/products_detail/catid/75/id/30.html
  {
    match: ['pixelhuex400', 'x400', 'x400g1'],
    deviceTypeId: '913710d8-176e-439d-bf12-7635e664b6c3',
    template: {
      manufacturerUrl: 'https://www.pixelhue.com/index.php/Content/products_detail/catid/75/id/30.html',
      name: 'PixelHue X400 (G1)',
      category: MIX,
      inputs: [
        ...n(4, (i) => sdi(`12G-SDI In ${i}`)),
        ...n(4, (i) => hdmi(`In ${i + 4} HDMI 2.0`)),
        port('Framelock In 1', 'Ethernet/RJ45', 'Framelock'),
        port('Framelock In 2', 'Ethernet/RJ45', 'Framelock'),
        port('Genlock In 1', 'BNC', 'Genlock'),
        port('Genlock In 2', 'BNC', 'Genlock'),
        ...n(4, (i) => usb(`USB rear ${i}`)),
        port('Audio In (XLR)', 'XLR', 'Audio'),
        port('Audio In (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
        mains('Mains In'),
      ],
      outputs: [
        ...n(4, (i) => hdmi(`Out ${i} HDMI 2.0`)),
        ...n(4, (i) => dp(`Out ${i} DP 1.2 (copy)`)),
        hdmi('UI HDMI 1.3'),
        dp('UI DP 1.2'),
        port('Genlock Loop 1', 'BNC', 'Genlock'),
        port('Genlock Loop 2', 'BNC', 'Genlock'),
        port('Audio Out L (XLR)', 'XLR', 'Audio'),
        port('Audio Out R (XLR)', 'XLR', 'Audio'),
        port('Audio Out (3.5 mm)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 4,
      notes: 'Media-Server, 4 HE · Bestückung: X_4x12G SDI + X_4xHDMI2.0 Input, 4x X_1xDP1.2+1xHDMI2.0 Output, X_2xRJ45+2xGenLock · 10GbE-Ports ohne Anzahl auf der Seite, daher nicht abgebildet · redundante Netzteile (Anzahl Buchsen nicht genannt)',
      width: 280,
      height: 520,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/4K%20ViewPro%20Video%20Processor%20Datasheet-V1.3.0.pdf
  {
    match: ['pixelhue4kviewpro', '4kviewpro', 'viewpro'],
    deviceTypeId: '6b528ca7-5f80-4f33-b818-b55fa4d6bcd0',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/4K%20ViewPro%20Video%20Processor%20Datasheet-V1.3.0.pdf',
      name: 'PixelHue 4K ViewPro',
      category: 'LED Processing',
      inputs: [
        sdi('12G-SDI In 1'),
        sdi('12G-SDI In 2'),
        hdmi('HDMI 2.0 In'),
        dp('DP 1.2 In'),
        dvi('Dual-Link DVI In 1'),
        dvi('Dual-Link DVI In 2'),
        genIn(),
        mains(),
      ],
      outputs: [
        sdi('12G-SDI Loop 1'),
        sdi('12G-SDI Loop 2'),
        hdmi('HDMI 2.0 Out'),
        dp('DP 1.2 Out'),
        sdi('12G-SDI Out'),
      ],
      isRackDevice: true,
      notes: 'Scaler/Converter, 482.6 x 50.5 x 295.5 mm · 100–240 V AC, 55 W · Web-Steuerung (Netzbuchse im Blatt nicht genannt)',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf
  {
    match: ['pixelhueu3', 'u3'],
    deviceTypeId: '7387e212-d22f-4046-9eea-52473a2d89dc',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/Flex-View%20Event%20Presentation%20Switching%20Solution%20User%20Manual-V2.5.0.pdf',
      name: 'PixelHue U3',
      category: 'Control',
      inputs: [
        dvi('DVI In 1 (Multiviewer)'),
        dvi('DVI In 2 (Input View)'),
        eth('Ethernet 1'),
        eth('Ethernet 2'),
        ...n(4, (i) => usb(`USB ${i}`)),
        mains('Mains In 1'),
        mains('Mains In 2'),
      ],
      outputs: [dvi('DVI Loop Out (In 1)')],
      isRackDevice: false,
      notes: 'Event Controller für F-Serie · 1100 x 674.8 x 388.8 mm · 2x 21.5" Touch',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/HDMI%204K%201-4%20Video%20Splitter%20Specifications.pdf
  {
    match: ['pixelhuehdmi4k14', 'hdmi4k14'],
    deviceTypeId: '17b2b571-40a4-4de8-a332-1229168a782b',
    template: {
      manufacturerUrl: 'https://en-pixelhue001.oss-us-east-1.aliyuncs.com/Specifications/HDMI%204K%201-4%20Video%20Splitter%20Specifications.pdf',
      name: 'PixelHue HDMI 4K 1-4',
      category: 'Converter',
      inputs: [hdmi('HDMI 2.0 In'), usb('USB (Update)'), port('DC 12 V In', 'DC Barrel', 'Power')],
      outputs: n(4, (i) => hdmi(`HDMI 2.0 Out ${i}`)),
      isRackDevice: false,
      notes: '1→4 HDMI-2.0-Splitter · 185 x 118.1 x 28.9 mm · DC 12 V, 2 W',
      width: 280,
      height: 200,
    },
  },
]
