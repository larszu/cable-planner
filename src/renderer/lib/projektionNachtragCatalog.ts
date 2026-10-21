import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Welle 4a — Nachtrag für Geräte, die frühere Recherchen übersprungen haben.
// Jeder Eintrag beruht auf einem heruntergeladenen PDF (Hersteller oder
// Händler-/Verleiher-Spiegel eines Herstellerblatts). Ports nur, wenn das
// Blatt sie nennt.
//
// Weiter übersprungen:
// - Colorlight A100, A200: kein PDF auffindbar; colorlightinside.com
//   (Produkt-/Downloadseiten) und colorlitled.com/download ohne A100/A200-Blatt,
//   sonst nur Shop-/Katalogseiten (ledwallcentral, alibaba).
// - Barco UDM-U22: kein Blatt; assets.barco.com führt nur UDM-W22 und
//   UDM-4K22 (beide bereits im Katalog).
// - Apantac HDMI-DP-UHD: Handbuch nur unter markertek.com/Attachments/Manuals/
//   APANTAC/HDM-DP-UHD-Manual.pdf (gesperrter Host); apantac.com/hdm-dp-uhd 404.
// - Ophit MSV 2: kein PDF; nur markertek-/ac-et-Produktseiten, ophit.com ohne
//   Downloads.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

interface W4aEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const PROJEKTION_NACHTRAG_CATALOG: W4aEntry[] = [
  // Quelle: https://www.novelty.fr/wp-content/uploads/downloaded/downloads/materiel_fiches_techniques/sony_pvm-a250_ft-uk.pdf
  {
    match: ['sonypvm-a250', 'pvm-a250', 'pvma250'],
    deviceTypeId: 'ac82c6f1-c916-400c-9ab0-3c77e97e2775',
    template: {
      manufacturerUrl: 'https://www.novelty.fr/wp-content/uploads/downloaded/downloads/materiel_fiches_techniques/sony_pvm-a250_ft-uk.pdf',
      name: 'Sony PVM-A250',
      category: 'Monitors',
      inputs: [
        port('3G/HD/SD-SDI In 1', 'BNC', 'SDI'),
        port('3G/HD/SD-SDI In 2', 'BNC', 'SDI'),
        port('HDMI In (HDCP)', 'HDMI', 'HDMI'),
        port('Composite In', 'BNC', 'Composite'),
        port('Audio In (Stereo-Miniklinke)', 'Jack 3.5 mm TRS', 'Audio'),
        port('Parallel Remote (RJ-45, 8-pol.)', 'Ethernet/RJ45', 'GPIO'),
        port('Serial Remote (LAN)', 'Ethernet/RJ45', 'Ethernet'),
        port('AC In (100–240 V)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('SDI Out 1', 'BNC', 'SDI'),
        port('SDI Out 2', 'BNC', 'SDI'),
        port('Composite Out (Loop-through)', 'BNC', 'Composite'),
        port('Audio Monitor Out', 'Jack 3.5 mm TRS', 'Audio'),
        port('Kopfhörer', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: false,
      notes: '25" OLED, 1.920 x 1.080 · ca. 115 W max., 80 W typ. · 100–240 V, 1,3–0,6 A · 581 x 386,6 x 65,5 mm · 6,1 kg',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.novelty.fr/wp-content/uploads/downloaded/downloads/materiel_fiches_techniques/analog-way_vio-4k_ft-uk.pdf
  {
    match: ['analogwayvio4k', 'vio4k', 'v701'],
    deviceTypeId: '550d2899-4886-4319-a4cc-f3daa986877f',
    template: {
      manufacturerUrl: 'https://www.novelty.fr/wp-content/uploads/downloaded/downloads/materiel_fiches_techniques/analog-way_vio-4k_ft-uk.pdf',
      name: 'Analog Way Vio 4K',
      category: 'Converter',
      inputs: [
        port('DisplayPort In (4K30)', 'DisplayPort', 'DisplayPort'),
        port('HDMI In (4K30)', 'HDMI', 'HDMI'),
        port('6G-SDI In', 'BNC', 'SDI'),
        port('Universal Analog In', 'DB15', 'VGA'),
        port('DVI Dual-Link In', 'DVI', 'DVI'),
        port('Optical SFP In (Käfig)', 'SFP', 'Fiber'),
        port('HDMI In 7 (Front, 2K)', 'HDMI', 'HDMI'),
        port('Audio In (Front, 3,5 mm)', 'Jack 3.5 mm TRS', 'Audio'),
        port('Genlock In', 'BNC', 'Genlock'),
        port('USB Host', 'USB', 'USB'),
        port('USB Device', 'USB', 'USB'),
        port('AC In (100–240 V)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('6G-SDI Loop-through', 'BNC', 'SDI'),
        port('Genlock Loop-through', 'BNC', 'Genlock'),
        port('DisplayPort Out (4K30)', 'DisplayPort', 'DisplayPort'),
        port('HDMI Out (4K30)', 'HDMI', 'HDMI'),
        port('6G-SDI Out', 'BNC', 'SDI'),
        port('Universal Analog Out', 'DB15', 'VGA'),
        port('DVI Dual-Link Out', 'DVI', 'DVI'),
        port('Optical SFP Out (Käfig)', 'SFP', 'Fiber'),
        port('Kopfhörer (Front, 6,35 mm)', 'Jack 6.35 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '7 Eingänge/1 Ausgang, mit Optionskarten bis 9/3 · 2 Video-Slots + 1 Audio-Slot · 482,1 x 88 x 406 mm · 100–240 V, 3,2 A · Bedienung per Web RCS/TCP (Netzwerkbuchse im Blatt nicht einzeln genannt)',
      width: 280,
      height: 460,
    },
  },

  // Quelle: https://assets.barco.com/m/6aa10463fe675d1e/original/UDX-W40-FLEX-de-Spec-sheet.pdf
  {
    match: ['barcoudx-w40', 'udx-w40', 'udxw40', 'udx-w40flex'],
    deviceTypeId: '10a0cd0e-d279-4a8d-ae08-862055923879',
    template: {
      manufacturerUrl: 'https://assets.barco.com/m/6aa10463fe675d1e/original/UDX-W40-FLEX-de-Spec-sheet.pdf',
      name: 'Barco UDX-W40',
      category: 'Projectors',
      inputs: [
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('DisplayPort 1.2 In', 'DisplayPort', 'DisplayPort'),
        port('3G/12G-SDI In 1', 'BNC', 'SDI'),
        port('3G/12G-SDI In 2', 'BNC', 'SDI'),
        port('3G/12G-SDI In 3', 'BNC', 'SDI'),
        port('3G/12G-SDI In 4', 'BNC', 'SDI'),
        port('RS232', 'Generic', 'RS232'),
        port('LAN (10/100)', 'Ethernet/RJ45', 'Ethernet'),
        port('XLR-Kabelfernbedienung', 'Generic', 'Control'),
        port('Netz (200–240 V, 20 A)', 'Generic', 'Power'),
      ],
      outputs: [],
      isRackDevice: false,
      notes: '40.000 Center-Lumen, 39.000 ANSI, 43.000 ISO · WUXGA 1.920 x 1.200 · 92 kg · 660 x 830 x 350 mm · optional Quad DP1.2 / Fiber SFP · SDI als „Quad 3G/12G SDI / BarcoLink ULTRA“',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://assets.aten.com/product/spec_sheet/vs192_194_splitter_ds_en.pdf
  {
    match: ['atenvs-194', 'vs-194', 'vs194'],
    deviceTypeId: 'f107a816-a93c-455b-b694-6bd90002d40d',
    template: {
      manufacturerUrl: 'https://assets.aten.com/product/spec_sheet/vs192_194_splitter_ds_en.pdf',
      name: 'ATEN VS-194',
      category: 'Converter',
      inputs: [
        port('DisplayPort In', 'DisplayPort', 'DisplayPort'),
        port('DC In (5 V)', 'DC Barrel', 'Power'),
      ],
      outputs: [
        port('DisplayPort Out 1', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort Out 2', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort Out 3', 'DisplayPort', 'DisplayPort'),
        port('DisplayPort Out 4', 'DisplayPort', 'DisplayPort'),
      ],
      isRackDevice: false,
      notes: 'DP-1.2a-Splitter, 4K60, HDCP 1.3 · MST/SST-Modus · DC 5 V, 3,36 W · 125 x 80 x 25 mm · 0,33 kg',
      width: 220,
      height: 200,
    },
  },

  // Quelle: https://www.lindy.co.uk/downloads/159851281842345_TDS_EN.pdf
  {
    match: ['lindy42345', '42345'],
    deviceTypeId: 'afbfca35-2822-41ef-98c2-eb504f8f06c8',
    template: {
      manufacturerUrl: 'https://www.lindy.co.uk/downloads/159851281842345_TDS_EN.pdf',
      name: 'Lindy 42345',
      category: 'Video Router',
      inputs: [
        port('PC 1 HDMI (Kabel, Stecker)', 'HDMI', 'HDMI'),
        port('PC 1 USB 2.0 A (Kabel, Stecker)', 'USB Type A', 'USB'),
        port('PC 1 Audio 3,5 mm (Kabel)', 'Jack 3.5 mm', 'Audio'),
        port('PC 2 HDMI (Kabel, Stecker)', 'HDMI', 'HDMI'),
        port('PC 2 USB 2.0 A (Kabel, Stecker)', 'USB Type A', 'USB'),
        port('PC 2 Audio 3,5 mm (Kabel)', 'Jack 3.5 mm', 'Audio'),
      ],
      outputs: [
        port('Konsole HDMI', 'HDMI', 'HDMI'),
        port('Konsole USB 2.0 A 1', 'USB Type A', 'USB'),
        port('Konsole USB 2.0 A 2', 'USB Type A', 'USB'),
        port('Konsole Audio 3,5 mm 1', 'Jack 3.5 mm', 'Audio'),
        port('Konsole Audio 3,5 mm 2', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes: '2-Port-KVM HDMI 2.0, 4K60 4:4:4, HDCP 2.2 · integrierte 1,2-m-PC-Kabel (Blatt: „2 x HDMI, USB 2.0 Type A, 2 x 3.5mm“ — Aufteilung je PC nicht genannt) · kein Netzteil laut Blatt · 97 x 25 x 82 mm',
      width: 240,
      height: 280,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/christie-captiva-series-specsheet-en.pdf
  {
    match: ['christiecaptivaduw350s', 'captivaduw350s', 'duw350s'],
    deviceTypeId: 'c99835ff-a253-49e9-8770-9c3640c71cd0',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/christie-captiva-series-specsheet-en.pdf',
      name: 'Christie Captiva DUW350S',
      category: 'Projectors',
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('VGA In 1', 'VGA', 'VGA'),
        port('VGA Audio In (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Composite In', 'Cinch/RCA', 'Composite'),
        port('Audio In L', 'Cinch/RCA', 'Audio'),
        port('Audio In R', 'Cinch/RCA', 'Audio'),
        port('Mikrofon In', 'Generic', 'Audio'),
        port('USB A (Wireless-Dongle)', 'USB Type A', 'USB'),
        port('RS-232 In', 'Generic', 'RS232'),
        port('Ethernet (100BaseT)', 'Ethernet/RJ45', 'Ethernet'),
        port('Netz', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('VGA Monitor Out (alternativ VGA In 2)', 'VGA', 'VGA'),
        port('Audio Out (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Ultrakurzdistanz 0,25:1 · 3.000 Center-/2.700 ANSI-Lumen · 1.920 x 720 (16:6) · 335 W max., 225 W Eco · 10-W-Lautsprecher · Netzbuchse im Blatt nicht typisiert',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/christie-captiva-series-specsheet-en.pdf
  {
    match: ['christiecaptivadhd400s', 'captivadhd400s', 'dhd400s'],
    deviceTypeId: '78c1e819-662f-4415-b473-14934950ada1',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/christie-captiva-series-specsheet-en.pdf',
      name: 'Christie Captiva DHD400S',
      category: 'Projectors',
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('VGA In 1', 'VGA', 'VGA'),
        port('VGA Audio In (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Composite In', 'Cinch/RCA', 'Composite'),
        port('Audio In L', 'Cinch/RCA', 'Audio'),
        port('Audio In R', 'Cinch/RCA', 'Audio'),
        port('Mikrofon In', 'Generic', 'Audio'),
        port('USB A (Wireless-Dongle)', 'USB Type A', 'USB'),
        port('RS-232 In', 'Generic', 'RS232'),
        port('Ethernet (100BaseT)', 'Ethernet/RJ45', 'Ethernet'),
        port('Netz', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('VGA Monitor Out (alternativ VGA In 2)', 'VGA', 'VGA'),
        port('Audio Out (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Ultrakurzdistanz 0,25:1 · 3.500 Center-/3.100 ANSI-Lumen · 1.920 x 1.080 · 335 W max., 225 W Eco · 10-W-Lautsprecher · Netzbuchse im Blatt nicht typisiert',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://www.christiedigital.com/globalassets/resources/public/christie-captiva-dhd410s-datasheet.pdf
  {
    match: ['christiecaptivadhd410s', 'captivadhd410s', 'dhd410s'],
    deviceTypeId: 'de4bcfd0-2775-43bf-a672-39e34a3a2011',
    template: {
      manufacturerUrl: 'https://www.christiedigital.com/globalassets/resources/public/christie-captiva-dhd410s-datasheet.pdf',
      name: 'Christie Captiva DHD410S',
      category: 'Projectors',
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('VGA In 1', 'VGA', 'VGA'),
        port('VGA Audio In (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('Composite In', 'Cinch/RCA', 'Composite'),
        port('Audio In L', 'Cinch/RCA', 'Audio'),
        port('Audio In R', 'Cinch/RCA', 'Audio'),
        port('Mikrofon In', 'Generic', 'Audio'),
        port('USB A (Wireless-Dongle)', 'USB Type A', 'USB'),
        port('RS-232 In', 'Generic', 'RS232'),
        port('Ethernet (100BaseT)', 'Ethernet/RJ45', 'Ethernet'),
        port('Netz', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('VGA Monitor Out (alternativ VGA In 2)', 'VGA', 'VGA'),
        port('Audio Out (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
      ],
      isRackDevice: false,
      notes: 'Ultrakurzdistanz-Laser · 3.600 ANSI-/4.100 ISO-Lumen · 1.920 x 1.080 · 10-W-Lautsprecher · Netzbuchse im Blatt nicht typisiert',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-Data-sheet.pdf
  {
    match: ['christiedwu960st-is', 'dwu960st-is', 'dwu960stis'],
    deviceTypeId: '097450be-1986-4406-a3ed-a762ca81a48d',
    template: {
      manufacturerUrl: 'https://christiedigital.com/globalassets/resources/public/Christie-Inspire-Series-Data-sheet.pdf',
      name: 'Christie DWU960ST-iS',
      category: 'Projectors',
      inputs: [
        port('HDMI 1.4a In', 'HDMI', 'HDMI'),
        port('HDMI 2.0 In', 'HDMI', 'HDMI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('3D Sync In', 'BNC', 'Sync'),
        port('VGA In', 'VGA', 'VGA'),
        port('Audio In (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('LAN (RJ45)', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232', 'Generic', 'RS232'),
        port('Kabelfernbedienung (3,5 mm)', 'Jack 3.5 mm', 'Control'),
        port('Netz (100–240 V)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        port('3D Sync Out', 'BNC', 'Sync'),
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('Audio Out (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('USB-A (5 V)', 'USB Type A', 'Power'),
        port('12 V Trigger', 'DC Barrel', 'Trigger'),
      ],
      isRackDevice: false,
      notes: '8.100 ANSI-/9.600 ISO-Lumen · WUXGA 1.920 x 1.200 · Kurzdistanz 0,65–0,75:1, Motorzoom · 545 W normal @ 110 V · 2 x 10-W-Lautsprecher · Netzbuchse im Blatt nicht typisiert',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://www.logando.de/wp-content/uploads/2024/04/EB-L30000U.pdf
  {
    match: ['epsoneb-l30000u', 'eb-l30000u', 'ebl30000u'],
    deviceTypeId: 'ea73bfe9-16c1-4b6e-b9a2-b0e71c3b91c1',
    template: {
      manufacturerUrl: 'https://www.logando.de/wp-content/uploads/2024/04/EB-L30000U.pdf',
      name: 'Epson EB-L30000U',
      category: 'Projectors',
      inputs: [
        port('HD-SDI In', 'BNC', 'SDI'),
        port('HDMI In (HDCP 2.2)', 'HDMI', 'HDMI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('DVI In', 'DVI', 'DVI'),
        port('VGA In', 'VGA', 'VGA'),
        port('BNC In', 'BNC', 'VGA'),
        port('Ethernet (100Base-TX/10Base-T)', 'Ethernet/RJ45', 'Ethernet'),
        port('USB A', 'USB Type A', 'USB'),
        port('USB B (nur Service)', 'USB Type B', 'USB'),
        port('Remote', 'Generic', 'Control'),
        port('Netz', 'Generic', 'Power'),
      ],
      outputs: [
        port('VGA Out', 'VGA', 'VGA'),
      ],
      isRackDevice: false,
      notes: '30.000 ANSI-Lumen · 3LCD WUXGA, 4K-Enhancement · 1.748 W normal, 2.325 W Spitze · 63,8 kg · ohne Objektiv (EB-L25000U-Objektive passen) · WLAN optional · Netzbuchse im Blatt nicht typisiert',
      width: 280,
      height: 300,
    },
  },
  // Quelle: https://www.epson.eu/en_EU/produits/projector/gamme-professionnelle/eb-xq2030b%C2%A0%3A-le-projecteur-4k-de-30%C2%A0000%C2%A0lumens-le-plus-compact-et-l%C3%A9ger-au-monde-%281%29/p/56915
  {
    match: ['epsoneb-xq2030b', 'eb-xq2030b', 'ebxq2030b'],
    deviceTypeId: '65d09745-f430-4f93-9a1e-75bbbc5cc45d',
    template: {
      manufacturerUrl: 'https://www.epson.eu/en_EU/produits/projector/gamme-professionnelle/eb-xq2030b%C2%A0%3A-le-projecteur-4k-de-30%C2%A0000%C2%A0lumens-le-plus-compact-et-l%C3%A9ger-au-monde-%281%29/p/56915',
      name: 'Epson EB-XQ2030B',
      category: 'Projectors',
      inputs: [
        port('HDMI In 1', 'HDMI', 'HDMI'),
        port('HDMI In 2', 'HDMI', 'HDMI'),
        port('HDBaseT In', 'Ethernet/RJ45', 'HDBaseT'),
        port('12G-SDI In', 'BNC', 'SDI'),
        port('Ethernet (100Base-TX/10Base-T)', 'Ethernet/RJ45', 'Ethernet'),
        port('RS-232C', 'Generic', 'RS232'),
        port('USB 2.0 1', 'USB', 'USB'),
        port('USB 2.0 2', 'USB', 'USB'),
        port('USB 2.0 B (nur Service)', 'USB Type B', 'USB'),
        port('Remote', 'Generic', 'Control'),
        port('Netz (100–240 V)', 'Generic', 'Power'),
      ],
      outputs: [
        port('HDMI Out', 'HDMI', 'HDMI'),
        port('12G-SDI Out', 'BNC', 'SDI'),
        port('Audio Out (Klinke)', 'Klinke', 'Audio'),
      ],
      isRackDevice: false,
      notes: '30.000 Lumen · 3LCD 4K · 1.851 W normal, 2.073 W Spitze · Intel-SDM-Slot · WLAN, NFC · Netzbuchse auf der Seite nicht typisiert',
      width: 280,
      height: 300,
    },
  },
]
