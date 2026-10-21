import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// AV Stumpfl PIXERA — Medienserver (Gen.2), Stand 2026-10-21.
//
// Quellen: die „Basic Technical Specifications" auf help.pixera.one (von den
// Produktseiten auf pixera.one verlinkt) und fuer die RS-Varianten die
// Produktseite mit der festen Rental-&-Staging-Ausstattung.
// Eingetragen ist die Standardkonfiguration; alles, was das Blatt „Optional"
// nennt (Capture-Karten, Genlock, GUI-Ausgaenge, Audio-Karten), fehlt.
//
// Nicht aufgenommen (kein Datenblatt beim Hersteller):
// PIXERA mini, PIXERA octo, PIXERA one/two Gen.1, PIXERA hub (Software),
// PIXERA control IO (Fremdgeraete IoCore2/Beckhoff, keine Buchsenliste).
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const dp = (n: number, label = 'DP 1.4a') =>
  Array.from({ length: n }, (_, i) => port(`Video Out ${i + 1} (${label})`, 'DisplayPort', 'DisplayPort'))
const usbs = (n: number, label: string) =>
  Array.from({ length: n }, (_, i) => port(`${label} ${i + 1}`, 'USB', 'USB'))
const eths = (n: number, label: string) =>
  Array.from({ length: n }, (_, i) => port(`${label} ${i + 1}`, 'Ethernet/RJ45', 'Ethernet'))
const ipmi = () => port('IPMI LAN', 'Ethernet/RJ45', 'Ethernet')
const mains = (name = 'Mains In (100–240 V)') => port(name, 'IEC 230V', 'Power')

const MS = 'Media Server'

interface PixeraEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const PIXERA_CATALOG: PixeraEntry[] = [
  // Quelle: https://help.pixera.one/en_US/pixera-one-basic-technical-specifications
  {
    match: ['avstumpflpixeraone', 'pixeraone', 'pixeraonegen2', 'px1-2-g2', 'px1-4-g2'],
    deviceTypeId: '18dbc6f7-4c23-4999-bf3f-1cab816756bb',
    template: {
      manufacturerUrl: 'https://help.pixera.one/en_US/pixera-one-basic-technical-specifications',
      name: 'AV Stumpfl PIXERA one',
      category: MS,
      inputs: [
        ...usbs(2, 'USB 3 Front'),
        ...usbs(2, 'USB 3 Rear'),
        port('USB 2 Rear', 'USB', 'USB'),
        ...eths(2, '10GbE'),
        ipmi(),
        mains(),
      ],
      outputs: [...dp(4), port('Audio Out (Stereo, sym.)', 'Jack 6.35 mm TRS', 'Audio')],
      isRackDevice: true,
      rackUnits: 1,
      notes:
        'Gen.2 Dual/Quad (PX1-2-G2 | PX1-4-G2) · 4 physische DP-1.4a-Ausgänge, 2 bzw. 4 lizenziert · Standardkonfiguration: Capture (HDMI/SDI), Genlock/Framelock, GUI-Ausgänge, Audio-Karten optional · 444 x 441 x 44,4 mm, 8,3 kg · 500 W Spitze',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://help.pixera.one/en_US/pixera-two-basic-technical-specifications
  {
    match: ['avstumpflpixeratwo', 'pixeratwo', 'pixeratwogen2', 'px2-2-g2', 'px2-4-g2'],
    deviceTypeId: '354a5e1f-de88-4b54-bd79-4a9c6e8c1703',
    template: {
      manufacturerUrl: 'https://help.pixera.one/en_US/pixera-two-basic-technical-specifications',
      name: 'AV Stumpfl PIXERA two',
      category: MS,
      inputs: [
        ...usbs(2, 'USB 3 Front'),
        ...usbs(2, 'USB 3 Rear'),
        ...usbs(2, 'USB 2 Rear'),
        ...eths(2, '10GbE'),
        ipmi(),
        mains('Mains In A (100–240 V)'),
        mains('Mains In B (100–240 V)'),
      ],
      outputs: [...dp(4), port('Audio Out (Stereo, sym.)', 'Jack 6.35 mm TRS', 'Audio')],
      isRackDevice: true,
      rackUnits: 2,
      notes:
        'Gen.2 Dual/Quad (PX2-2-G2 | PX2-4-G2) · 4 physische DP-1.4a-Ausgänge, 2 bzw. 4 lizenziert · redundantes Netzteil (Produktseite) · Standardkonfiguration: Capture, Genlock/Framelock, GUI-Ausgänge, Audio-Karten optional · 445 x 468 x 88,9 mm, 13,1 kg · 800 W Spitze',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://pixera.one/en/hardware/media-servers-1/pixera-two-gen2-rs/
  // Basis: https://help.pixera.one/en_US/pixera-two-basic-technical-specifications
  {
    match: ['avstumpflpixeratwors', 'pixeratwors', 'pixeratworsgen2'],
    deviceTypeId: '1f4c8922-945e-417c-8f50-211a630bb311',
    template: {
      manufacturerUrl: 'https://pixera.one/en/hardware/media-servers-1/pixera-two-gen2-rs/',
      name: 'AV Stumpfl PIXERA two RS',
      category: MS,
      inputs: [
        ...usbs(2, 'USB 3 Front'),
        ...usbs(2, 'USB 3 Rear'),
        ...usbs(2, 'USB 2 Rear'),
        port('12G-SDI In', 'BNC', 'SDI'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Genlock In (Nvidia Sync)', 'BNC', 'Genlock'),
        ...eths(2, '10GbE'),
        ...eths(4, '1GbE'),
        ipmi(),
        mains('Mains In A (100–240 V)'),
        mains('Mains In B (100–240 V)'),
      ],
      outputs: [
        ...dp(4),
        port('12G-SDI Out', 'BNC', 'SDI'),
        port('Audio Out (Stereo, sym.)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes:
        'Rental & Staging, feste Ausstattung: 4 Ausgänge, 12G-SDI I/O, HDMI 2.0 In, Nvidia Sync, 2x10G + 4x1G, Dante Virtual Soundcard, redundantes Netzteil · Sync-Karte: Buchsenzahl nicht angegeben, als ein Genlock-Eingang geführt',
      width: 280,
      height: 480,
    },
  },

  // Quelle: https://help.pixera.one/pixera-server-specifications/pixera-four-gen2-basic-technical-specifications
  {
    match: ['avstumpflpixerafour', 'pixerafour', 'pixerafourgen2', 'px4-0-g2', 'px4-2-g2', 'px4-4-g2'],
    deviceTypeId: '7b7d57ef-4a5b-4c77-b823-e04491516dac',
    template: {
      manufacturerUrl: 'https://help.pixera.one/pixera-server-specifications/pixera-four-gen2-basic-technical-specifications',
      name: 'AV Stumpfl PIXERA four',
      category: MS,
      inputs: [
        ...usbs(2, 'USB 3 Front'),
        port('USB-C Front', 'USB-C', 'USB'),
        ...usbs(6, 'USB 3 Rear'),
        port('USB-C Rear 1', 'USB-C', 'USB'),
        port('USB-C Rear 2', 'USB-C', 'USB'),
        ...eths(2, '10GbE'),
        ipmi(),
        port('SMPTE Timecode In 1', 'XLR', 'Timecode'),
        port('SMPTE Timecode In 2', 'XLR', 'Timecode'),
        mains(),
      ],
      outputs: [
        ...dp(4, 'DP 2.1b'),
        port('Audio Out L (sym.)', 'XLR', 'Audio'),
        port('Audio Out R (sym.)', 'XLR', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 4,
      notes:
        'Gen.2 (PX4-0/2/4-G2) · 4 physische DP-2.1b-Ausgänge, 1–2 bzw. 3–4 lizenziert · Standardkonfiguration: Capture (HDMI 2.0/2.1, 3G/12G-SDI), Genlock/Framelock, GUI-Ausgänge (4x mDP), 4x1G/2x25G, Audio-Karten optional · 437 x 533 x 176 mm, 19,6 kg · 1200/1600 W Spitze',
      width: 280,
      height: 440,
    },
  },

  // Quelle: https://pixera.one/en/hardware/media-servers-1/pixera-four-rs/
  // Basis: https://help.pixera.one/pixera-server-specifications/pixera-four-gen2-basic-technical-specifications
  {
    match: ['avstumpflpixerafourrs', 'pixerafourrs', 'pixerafourrsgen2'],
    deviceTypeId: '79398b8c-d0ed-4af9-bfb4-e51447039c1d',
    template: {
      manufacturerUrl: 'https://pixera.one/en/hardware/media-servers-1/pixera-four-rs/',
      name: 'AV Stumpfl PIXERA four RS',
      category: MS,
      inputs: [
        ...usbs(2, 'USB 3 Front'),
        port('USB-C Front', 'USB-C', 'USB'),
        ...usbs(6, 'USB 3 Rear'),
        port('USB-C Rear 1', 'USB-C', 'USB'),
        port('USB-C Rear 2', 'USB-C', 'USB'),
        port('12G-SDI In', 'BNC', 'SDI'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('Genlock In', 'BNC', 'Genlock'),
        ...eths(4, '1GbE'),
        port('25GbE 1', 'SFP28', 'Ethernet'),
        port('25GbE 2', 'SFP28', 'Ethernet'),
        ipmi(),
        port('SMPTE Timecode In 1', 'XLR', 'Timecode'),
        port('SMPTE Timecode In 2', 'XLR', 'Timecode'),
        mains(),
      ],
      outputs: [
        ...dp(4, 'DP 2.1b'),
        port('12G-SDI Out', 'BNC', 'SDI'),
        port('Audio Out L (sym.)', 'XLR', 'Audio'),
        port('Audio Out R (sym.)', 'XLR', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 4,
      notes:
        'Rental & Staging, feste Ausstattung: QUAD, 16 TB NVMe, 4x1GbE + 2x25GbE, 12G-SDI I/O (oder 4x 3G-SDI), 1x HDMI 2.0 In, Framelock/Genlock, Dante Virtual Soundcard · 25G-Buchse im Blatt nicht benannt (als SFP geführt) · ob die 2x10G der Basis bleiben, sagt die Seite nicht',
      width: 280,
      height: 600,
    },
  },

  // Quelle: https://help.pixera.one/en_US/pixera-zero-basic-technical-specifications
  {
    match: ['avstumpflpixerazero', 'pixerazero', 'pxz-0', 'pxz-2', 'pxz-4'],
    deviceTypeId: '4d01c4ca-55cd-4a3f-b450-719267d539bc',
    template: {
      manufacturerUrl: 'https://help.pixera.one/en_US/pixera-zero-basic-technical-specifications',
      name: 'AV Stumpfl PIXERA zero',
      category: MS,
      inputs: [
        port('USB 3 Front', 'USB', 'USB'),
        ...usbs(2, 'USB 3 Rear'),
        ...usbs(2, 'USB 2 Rear'),
        ...eths(2, '1GbE'),
        ipmi(),
        mains(),
      ],
      outputs: [...dp(4, 'mDP 1.4a')],
      isRackDevice: true,
      rackUnits: 2,
      notes:
        'PXZ-0/2/4 · halbe 19"-Breite, 2 HE (zwei pro Rackwanne) · 4 physische mDP-1.4a-Ausgänge, 2 bzw. 4 lizenziert · 210 x 265 x 89,3 mm, 3,72 kg · 300 W Spitze',
      width: 280,
      height: 300,
    },
  },
]
