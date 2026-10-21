import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// LANG-Liste, Abschnitt „LED" — NovaStar-Prozessoren mit Hersteller-Blatt.
//
// Ausgaenge zu den Kacheln stehen wie im Brompton-Katalog als Signaltyp
// `NovaStar` (Empfangskarten-Protokoll, kein Netzwerk) auf `Ethernet/RJ45`
// (Neutrik etherCON-Huelse, RJ45 passt).
//
// Uebersprungen (bereits vorhanden): Brompton SX40, Brompton XD10G,
// NovaStar MX40 Pro.
// Uebersprungen (kein Hersteller-Blatt mit Anschluessen gefunden):
// NovaStar CVT8-5GS, MX6000 Pro LE, MX2000 Pro LE (modular, Kartenbestueckung
// offen); Colorlight A100, A200; ROE Evision Z6, Evision HD102; Analog Way
// Vio 4K; ROE BM4 (Blatt ohne Steckerangaben), ROE V8T; INFiLED AR3.9 plus
// (alle Varianten), AR10, DB3.4 LE, ER10pro, LUGH; Muxwave Poster M3;
// QSTECH CRIUS LE; fLED Screen 108"/136"; Lang-Eigennamen ohne Hersteller
// (AURA, LIAM, ENKI, ARUNA, LUCY, LUNA, JUPITER, VENUS, AVORA, MERI,
// FOLDSTER, LEDgend).
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

/** Ausgang zu den Empfangskarten. etherCON-Buchse, NovaStar-Protokoll. */
const nova = (name: string) => port(name, 'Ethernet/RJ45', 'NovaStar')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const mains = () => port('Mains In (100–240 V)', 'IEC 230V', 'Power')

const LED = 'LED Processing'

interface LangLedEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const LANG_LED_CATALOG: LangLedEntry[] = [
  // Quelle: https://www.rentex.com/wp-content/uploads/2018/02/Novastar-Controller-MCTRL660-Specifications-V1.3.1.pdf
  {
    match: ['novastarmctrl660', 'mctrl660'],
    deviceTypeId: '5a8fa2ad-d451-43a5-967c-c64ade9cb482',
    template: {
      manufacturerUrl: 'https://www.rentex.com/wp-content/uploads/2018/02/Novastar-Controller-MCTRL660-Specifications-V1.3.1.pdf',
      name: 'NovaStar MCTRL660',
      category: LED,
      // Blatt nennt Audio-Eingang und UART ohne Steckertyp.
      inputs: [
        port('HDMI In', 'HDMI', 'HDMI'),
        port('DVI In', 'DVI', 'DVI'),
        port('Audio In', 'Jack 3.5 mm', 'Audio'),
        port('USB (PC-Steuerung)', 'USB Type B', 'USB'),
        port('UART In (Kaskade)', 'Ethernet/RJ45', 'UART'),
        mains(),
      ],
      outputs: [
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('DVI Out', 'DVI', 'DVI'),
        ...Array.from({ length: 4 }, (_, i) => nova(`LED Out ${i + 1}`)),
        port('UART Out (Kaskade)', 'Ethernet/RJ45', 'UART'),
      ],
      isRackDevice: true,
      notes: '19" 1,5 HE · max. 1920×1200@60 · 100–240 V AC, 16 W · 3,6 kg',
      width: 280,
      height: 240,
    },
  },

  // Quelle: https://www.rentex.com/wp-content/uploads/2018/02/NovaStar-Controller-MCTRL4K-Specifications-Rev1.0.1.pdf
  {
    match: ['novastarmctrl4k', 'mctrl4k'],
    deviceTypeId: '2a25c252-25a6-49fb-b711-936183f1a7be',
    template: {
      manufacturerUrl: 'https://www.rentex.com/wp-content/uploads/2018/02/NovaStar-Controller-MCTRL4K-Specifications-Rev1.0.1.pdf',
      name: 'NovaStar MCTRL4K',
      category: LED,
      inputs: [
        port('DP 1.2 In', 'DisplayPort', 'DisplayPort'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Dual-Link DVI-D 1', 'DVI', 'DVI'),
        port('Dual-Link DVI-D 2', 'DVI', 'DVI'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('Ethernet (Steuerung)'),
        port('USB (Steuerung)', 'USB', 'USB'),
        mains(),
      ],
      outputs: [
        port('Genlock Loop', 'BNC', 'Genlock'),
        ...Array.from({ length: 16 }, (_, i) => nova(`LED Out ${i + 1}`)),
        ...Array.from({ length: 4 }, (_, i) => port(`OPT ${i + 1}`, 'Fiber', 'NovaStar')),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '19" 2 HE · max. 3840×2160@60 · Glasfaser LC Singlemode; OPT und Ethernet nicht gleichzeitig · 100–240 V AC, 30 W',
      width: 280,
      height: 540,
    },
  },

  // Quelle: https://goknight.com/content/documentation/MCTRL-R5-LED-Display-Controller-Specifications-V1.0.4.pdf
  {
    match: ['novastarmctrlr5', 'mctrlr5'],
    deviceTypeId: '913656d5-2980-43a0-a233-cad2c9d324ad',
    template: {
      manufacturerUrl: 'https://goknight.com/content/documentation/MCTRL-R5-LED-Display-Controller-Specifications-V1.0.4.pdf',
      name: 'NovaStar MCTRL R5',
      category: LED,
      inputs: [
        port('6G-SDI In', 'BNC', 'SDI'),
        port('HDMI 1.4 In', 'HDMI', 'HDMI'),
        port('DL-DVI In', 'DVI', 'DVI'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('Ethernet (Steuerung)'),
        port('USB In (Kaskade)', 'USB Type B', 'USB'),
        port('USB (Front, Update)', 'USB Type A', 'USB'),
        mains(),
      ],
      outputs: [
        port('Genlock Loop', 'BNC', 'Genlock'),
        port('USB Out (Kaskade)', 'USB Type A', 'USB'),
        ...Array.from({ length: 8 }, (_, i) => nova(`LED Out ${i + 1}`)),
        port('OPT 1 (10G)', 'Fiber', 'NovaStar'),
        port('OPT 2 (10G, Kopie)', 'Fiber', 'NovaStar'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '19" 1 HE · 482,6 × 334,6 × 52 mm · max. 3840×1080@60 · 100–240 V AC, 25 W · 4,3 kg',
      width: 280,
      height: 380,
    },
  },

  // Quelle: https://audioeffetti.com/product/documents/NOV/CX40PRO-01.pdf
  {
    match: ['novastarcx40pro', 'cx40pro'],
    deviceTypeId: '76996a7d-6981-4b9f-a6d7-786ffb1f9ab7',
    template: {
      manufacturerUrl: 'https://audioeffetti.com/product/documents/NOV/CX40PRO-01.pdf',
      name: 'NovaStar CX40 Pro',
      category: LED,
      inputs: [
        port('HDMI 2.0-1 In', 'HDMI', 'HDMI'),
        port('HDMI 2.0-2 In', 'HDMI', 'HDMI'),
        port('DP 1.2 In', 'DisplayPort', 'DisplayPort'),
        port('12G-SDI In 1', 'BNC', 'SDI'),
        port('12G-SDI In 2', 'BNC', 'SDI'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('Ethernet (Steuerung) 1'),
        eth('Ethernet (Steuerung) 2'),
        port('USB 2.0', 'USB', 'USB'),
        mains(),
      ],
      outputs: [
        port('HDMI 2.0-1 Loop', 'HDMI', 'HDMI'),
        port('HDMI 2.0-2 Loop', 'HDMI', 'HDMI'),
        port('12G-SDI Loop 1', 'BNC', 'SDI'),
        port('12G-SDI Loop 2', 'BNC', 'SDI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
        ...Array.from({ length: 6 }, (_, i) => nova(`LED Out 5G ${i + 1}`)),
        port('OPT 40G', 'Fiber', 'NovaStar'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '19" 2 HE · 482,6 × 94,4 × 472 mm · 4096×2160@60, 9 Mio. Pixel · nur CA50E/CA50C/XA50-Empfangskarten · 105 W',
      width: 280,
      height: 360,
    },
  },
]
