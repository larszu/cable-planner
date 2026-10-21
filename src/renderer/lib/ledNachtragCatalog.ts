import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Welle 4b — LED-Kacheln, LED-Poster und Evision-Prozessoren, die eine frühere
// Recherche als „ohne Datenblatt" übersprungen hatte.
//
// Quellen: Herstellerblätter, über den LANG-AG-Katalog (catalogue.lang-ag.com,
// Datenblatt-Anhang je Artikel) bzw. das ROE-Handbuch BM2&4 V3.8 und die
// INFiLED-AR-Broschüre (gehostet bei ledwallcentral.com). roevisual.com
// liefert curl nur 502, deshalb die Spiegel.
//
// „Evision Z6" und „Evision HD102" sind KEINE Kacheln, sondern ROE-Prozessoren
// (Colorlight-basiert); sie stehen deshalb mit vielen Datenausgängen da.
//
// Ports nur, wo ein Blatt die Buchse nennt. Fehlt dort der Ausgang (V8T,
// AR3.9 plus), steht nur der Eingang — kein Ausgang aus Analogie erfunden.
// Genlock/DMX/3D-Sync der Prozessoren fehlen, weil die Blätter keinen
// Steckertyp nennen; ebenso die Netzbuchse des Z6.
//
// ─── WEITER ÜBERSPRUNGEN (keine Buchsenangabe gefunden) ────────────────────
// INFiLED AR10 — LANG-Blatt ohne Anschlüsse:
//   https://catalogue.lang-ag.com/files/21512/15502.pdf
// INFiLED DB3.4 LE — LANG-Blatt und DB-Broschüre nennen nur die
//   System-Eingänge (DVI/HDMI/DP/SDI), nicht die Kachelbuchsen:
//   https://catalogue.lang-ag.com/files/14445/9777.pdf
//   https://www.ledwallcentral.com/specs/led_wall_series_67.pdf
// INFiLED ER10pro — nur „Input signal DVI" (Systemebene):
//   https://catalogue.lang-ag.com/files/10646/7680.pdf
// INFiLED LUGH — LANG-Blatt ohne Anschlüsse:
//   https://catalogue.lang-ag.com/files/19941/14700.pdf
// Muxwave Poster M3 — nur „Processing Colorlight", keine Buchsen:
//   https://catalogue.lang-ag.com/files/20670/15800.pdf
//   https://catalogue.lang-ag.com/files/22702/16306.pdf
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const VIDEO = 'Video'

interface W4bEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const LED_NACHTRAG_CATALOG: W4bEntry[] = [

  // Quelle: https://catalogue.lang-ag.com/files/18907/14104.pdf
  {
    match: ['roeevisionz6', 'evisionz6', 'z6supercontroller'],
    deviceTypeId: 'd4e9e9a9-b4a6-4476-bc17-c2b5fc0e0363',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/18907/14104.pdf',
      name: 'ROE Visual Evision Z6',
      category: 'LED Processing',
      inputs: [
        port('3G-SDI In 1', 'BNC', 'SDI'),
        port('3G-SDI In 2', 'BNC', 'SDI'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        ...Array.from({ length: 4 }, (_, i) => port(`DVI In ${i + 1}`, 'DVI', 'DVI')),
        port('100M Ethernet (Steuerung/Art-Net)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB In (PC)', 'USB', 'USB'),
      ],
      outputs: [
        ...Array.from({ length: 16 }, (_, i) => port(`Gigabit Out ${i + 1}`, 'etherCON', 'Colorlight')),
        port('USB Out (Kaskade)', 'USB', 'USB'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: 'LED-Prozessor (Colorlight) · 2 HE · 8,3 Mio. Pixel, max. 8192 px Breite/Höhe · bis 3840x2160@60 · 80 W · 9 kg · 100–240 V AC',
      width: 280,
      height: 420,
    },
  },

  // Quelle: https://catalogue.lang-ag.com/files/16146/10921.pdf
  {
    match: ['roeevisionhd102', 'evisionhd102', 'hd102'],
    deviceTypeId: '2528c66d-ee35-4e33-9b4f-83823cbb38d5',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/16146/10921.pdf',
      name: 'ROE Visual Evision HD102',
      category: 'LED Processing',
      inputs: [
        port('DVI In', 'DVI', 'DVI'),
        port('HDMI In', 'HDMI', 'HDMI'),
        port('Ethernet (Steuerung)', 'etherCON', 'Ethernet'),
        port('USB Type B In', 'USB Type B', 'USB'),
        port('Power In', 'powerCON TRUE1', 'Power'),
      ],
      outputs: [
        port('DVI Loop', 'DVI', 'DVI'),
        port('HDMI Loop', 'HDMI', 'HDMI'),
        ...Array.from({ length: 4 }, (_, i) => port(`Data Out ${i + 1}`, 'etherCON', 'LED Data')),
        port('USB Type A Out', 'USB Type A', 'USB'),
      ],
      notes: 'LED-Prozessor · max. 1.036.800 Pixel je Port · max. 2560 px Breite / 1536 px Höhe · Glasfaser x2 optional · DMX 512 · 100–240 V 50/60 Hz',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.ledwallcentral.com/manuals/led_wall_manual_series_380.pdf
  {
    match: ['roeblackmarblebm4', 'blackmarble4', 'bm4'],
    deviceTypeId: '042638b1-1ad9-4ac9-9ff3-f28db715f521',
    template: {
      manufacturerUrl: 'https://www.ledwallcentral.com/manuals/led_wall_manual_series_380.pdf',
      name: 'ROE Visual Black Marble BM4',
      category: VIDEO,
      inputs: [
        port('Data In', 'etherCON', 'LED Data'),
        port('Power In', 'powerCON TRUE1', 'Power'),
      ],
      outputs: [
        port('Data Out', 'etherCON', 'LED Data'),
        port('Power Out', 'powerCON TRUE1', 'Power'),
      ],
      notes: 'LED-Bodenkachel · 4,76 mm · 609,6 x 609,6 x 130 mm · 128 x 128 px · 21,65 kg (Glass/Mirror), 16 kg (Matte) · max. 290 W / Ø 145 W · Brompton/Evision/MVR',
      width: 200,
      height: 200,
    },
  },

  // Quelle: https://catalogue.lang-ag.com/files/19386/15793.pdf
  {
    match: ['roevanishv8t', 'vanishv8t', 'v8t'],
    deviceTypeId: '7e0b8197-d2b3-4dda-b4ab-237c1e0ebf9a',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/19386/15793.pdf',
      name: 'ROE Visual Vanish V8T',
      category: VIDEO,
      // Blatt nennt nur die Eingänge: „Data: Ethercon, Power: Powercon (True 1 with 16A)".
      inputs: [
        port('Data In', 'etherCON', 'Colorlight'),
        port('Power In (16 A)', 'powerCON TRUE1', 'Power'),
      ],
      outputs: [],
      notes: 'Transparente LED-Kachel · 8,9 mm · 1000 x 1000 x 95 mm · 112 x 112 px · 18 kg · max. 480 W / Ø 240 W · 50 % Transparenz · Colorlight',
      width: 200,
      height: 200,
    },
  },

  // Quelle: https://www.ledwallcentral.com/specs/led_wall_series_66.pdf
  {
    match: ['infiledar39plus', 'ar391plus', 'ilrssorar391plus', 'ilrssirar391'],
    deviceTypeId: 'ad0a02d7-3279-404c-87c6-c355278936c7',
    template: {
      manufacturerUrl: 'https://www.ledwallcentral.com/specs/led_wall_series_66.pdf',
      name: 'INFiLED AR3.9 plus',
      category: VIDEO,
      // Broschüre: „Signal Input Source EtherCON 1Gpbs" — Ausgang und Netzbuchse nicht genannt.
      inputs: [
        port('Data In (1 Gbit/s)', 'etherCON', 'LED Data'),
      ],
      outputs: [],
      notes: 'LED-Kachel · 3,91 mm · 500 x 1000 x 67 mm · 128 x 256 px · 12,46 kg · max. 330 W / Ø 110 W · IP65 · 100–240 V AC',
      width: 200,
      height: 300,
    },
  },

  // Quelle: https://catalogue.lang-ag.com/files/17700/12461.pdf
  {
    match: ['qstechcriusle', 'criusle', 'crius'],
    deviceTypeId: '96d54807-f904-48d3-8968-5b62eb85b512',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/17700/12461.pdf',
      name: 'QSTECH CRIUS LE',
      category: VIDEO,
      inputs: [
        port('HDMI In', 'HDMI', 'HDMI'),
        port('USB (Zuspielung)', 'USB', 'USB'),
      ],
      outputs: [],
      notes: 'LED-Poster · 1,9 mm · Anzeige 619 x 1771 x 84,5 mm, gesamt 619 x 1917,5 x 500 mm · 320 x 900 px · 60 kg · max. 445 W / Ø 178 W · WLAN, interner Speicher',
      width: 200,
      height: 320,
    },
  },

  // Quelle: https://catalogue.lang-ag.com/files/16491/11662.pdf
  {
    match: ['fledscreen108', 'fled108', 'fled108pro'],
    deviceTypeId: 'ace90919-86fa-4570-adc6-c573ee3a0f8a',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/16491/11662.pdf',
      name: 'fLED Screen 108"',
      category: VIDEO,
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('USB', 'USB', 'USB'),
      ],
      outputs: [],
      notes: 'All-in-One-LED auf Lift · 1,25 mm · Anzeige 2418 x 1368 x 104 mm · 1920 x 1080 px · Anzeige 171 kg, mit Lift 345 kg · max. 2,88 kW / Ø 0,96 kW',
      width: 280,
      height: 200,
    },
  },

  // Quelle: https://catalogue.lang-ag.com/files/16487/11661.pdf
  {
    match: ['fledscreen136', 'fled136', 'fled136m4'],
    deviceTypeId: 'ff89e827-07a3-4cf4-85fa-b99ce97259bf',
    template: {
      manufacturerUrl: 'https://catalogue.lang-ag.com/files/16487/11661.pdf',
      name: 'fLED Screen 136"',
      category: VIDEO,
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('USB', 'USB', 'USB'),
      ],
      outputs: [],
      notes: 'All-in-One-LED auf Lift · 1,56 mm · Anzeige 3018 x 1705,5 x 104,5 mm · 1920 x 1080 px · Anzeige 225 kg, mit Lift 430 kg · max. 4,5 kW / Ø 1,5 kW',
      width: 280,
      height: 200,
    },
  },
]

/** Die Vorlagen allein — für die Bibliotheks-Saat in `projectStore`. */
export const w4bTemplates: EquipmentTemplate[] = LED_NACHTRAG_CATALOG.map((e) => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
}))
