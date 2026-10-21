import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// W4D — Nachtrag zu Geräten, die frühere Recherchen übersprungen haben.
//
// Jede Zeile folgt einem heruntergeladenen PDF (Handbuch, Quick Start oder
// Datenblatt). Was das PDF nicht nennt, steht nicht da — auch dann nicht,
// wenn es naheliegt.
//
// ─── WEITER OFFEN ──────────────────────────────────────────────────────────
//
// Marshall CV350-10X-XLR: kein eigenes PDF gefunden; das CV350-Quick-Start
//   nennt nur 10X/10XB. Versucht: marshall-usa.com/discontinued/cameras/CV350.php
// Videosys Epsilon 4K Head: das Datenblatt nennt nur Funkdaten, keine Buchsen.
//   Ein „Epsilon 4K TX“ existiert dort nicht — Sender ist der AEON-CC.
//   Versucht: https://videosys.tv/wp-content/uploads/2023/09/Epsilon_2023.pdf
// HP 1420-8G als J9560A: in keinem PDF belegt; J9560A erscheint bei Händlern
//   unter der 1410-Serie. Eingetragen ist die belegte JH329A.
// Blackmagic ATEM Television Studio Pro 4K: das Handbuch hat KEINE beschriftete
//   Rückseiten-Seite (Seiten 9–18 und 88–97 gerendert); Anzahl der XLR-Eingänge,
//   der Program-Return-Ausgänge und die Netzbuchse bleiben offen. Die
//   Techspecs-Seite W-APS-14 zeigt das Nachfolgemodell (HD8/4K8), nicht den Pro 4K.
//   Versucht: https://documents.blackmagicdesign.com/UserManuals/ATEM_Television_Studio_Switchers_Manual.pdf
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const sdi = (name: string) => port(name, 'BNC', 'SDI')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')

interface W4dEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const BROADCAST_NACHTRAG_B_CATALOG: W4dEntry[] = [

  // Quelle: https://marshall-usa.com/pdf/CV350-10X_Quick-Start-Guide.pdf
  {
    match: ['marshallcv35010x', 'cv35010x'],
    deviceTypeId: '1b4896a0-ca46-4de0-93a4-1780d7939859',
    template: {
      manufacturerUrl: 'https://marshall-usa.com/pdf/CV350-10X_Quick-Start-Guide.pdf',
      name: 'Marshall CV350-10X',
      category: 'Cameras',
      // Blatt: Rückseite 3G/HD-SDI (BNC), HDMI und eine 4-polige Klemme
      // (1 PWR+, 2 PWR−, 3 RS485+, 4 RS485−). Die Klemme hat keinen Typnamen.
      inputs: [
        port('Power + RS-485 (4-pol. Klemme)', 'Generic', 'Power'),
        port('RS-485 (Pelco-P/D, VISCA)', 'Generic', 'RS-485'),
      ],
      outputs: [
        sdi('3G/HD-SDI Out'),
        port('HDMI Out', 'HDMI', 'HDMI'),
      ],
      notes: '1080p50/60/25/30, 1080i50/60, 720p50/60/25/30 · 12 V DC (7–15 V), max. 6 W · 60,5 × 58 × 95 mm',
      width: 200,
      height: 160,
    },
  },

  // Quelle: https://marshall-usa.com/pdf/CV350-10X_Quick-Start-Guide.pdf
  {
    match: ['marshallcv35010xb', 'cv35010xb'],
    deviceTypeId: 'b883f813-9d1e-49cd-b89e-76691b652ad7',
    template: {
      manufacturerUrl: 'https://marshall-usa.com/pdf/CV350-10X_Quick-Start-Guide.pdf',
      name: 'Marshall CV350-10XB',
      category: 'Cameras',
      // Gleiche Rückseite wie die 10X; nur die Bildraten unterscheiden sich.
      inputs: [
        port('Power + RS-485 (4-pol. Klemme)', 'Generic', 'Power'),
        port('RS-485 (Pelco-P/D, VISCA)', 'Generic', 'RS-485'),
      ],
      outputs: [
        sdi('3G/HD-SDI Out'),
        port('HDMI Out', 'HDMI', 'HDMI'),
      ],
      notes: '1080p59.94/29.97, 1080i59.94, 720p59.94 · 12 V DC (7–15 V), max. 6 W · 60,5 × 58 × 95 mm',
      width: 200,
      height: 160,
    },
  },

  // Quelle: https://videosys.tv/wp-content/uploads/2023/09/Epsilon_2023.pdf
  {
    match: ['videosysepsilon4k', 'epsilon4k', 'epsilon4kbase'],
    deviceTypeId: '7e88c21d-22a0-4786-be9c-ce3368554c5a',
    template: {
      manufacturerUrl: 'https://videosys.tv/wp-content/uploads/2023/09/Epsilon_2023.pdf',
      name: 'Videosys Epsilon 4K',
      category: 'Wireless',
      // Blatt (Base): „4K Output: 4x 3G, 2x 6G, 1 x 12G“ — das sind Modi; als
      // Buchsen stehen die vier 3G-Ausgänge (Quad-Link) da. Audio 4 × XLR3M,
      // Genlock BNC, 2 × RJ45 (vorn + hinten), IEC. Optionsmodule: SMPTE-Fiber
      // (Lemo 3K.93C) und IF/RF (2 × BNC IF mit LNB-Speisung, XLR3F Daten).
      inputs: [
        port('Genlock (Tri-Level/Black Burst)', 'BNC', 'Genlock'),
        port('Fiber (Optionsmodul SMPTE)', 'LEMO 3K.93C (SMPTE 304M)', 'Fiber'),
        port('IF In 1 (Optionsmodul, LNB)', 'BNC', 'RF'),
        port('IF In 2 (Optionsmodul, LNB)', 'BNC', 'RF'),
        port('RS-232/RS-485 Daten (Optionsmodul)', 'XLR 3 Female', 'RS-232'),
        eth('Ethernet (vorn)'),
        eth('Ethernet (hinten)'),
        port('Mains In (100–240 V)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        sdi('SDI Out 1 (3G / 12G)'),
        sdi('SDI Out 2 (3G / 6G)'),
        sdi('SDI Out 3 (3G / 6G)'),
        sdi('SDI Out 4 (3G)'),
        port('Audio Out 1', 'XLR 3 Male', 'Audio'),
        port('Audio Out 2', 'XLR 3 Male', 'Audio'),
        port('Audio Out 3', 'XLR 3 Male', 'Audio'),
        port('Audio Out 4', 'XLR 3 Male', 'Audio'),
      ],
      isRackDevice: true,
      notes: 'Base Station (Empfänger/Decoder/CCU) · H.264/H.265 bis 2160p60 · 2 Optionsslots, einer muss belegt sein · Kamerakontrolle 403–473 MHz',
      width: 280,
      height: 340,
    },
  },

  // Quelle: https://www.netxl.com/aruba/docs/aruba-1420-series-datasheet.pdf
  {
    match: ['hpe14208g', 'officeconnect14208g', 'jh329a', 'hp14208g'],
    deviceTypeId: '71406d73-c320-440f-9bc7-56657feabb56',
    template: {
      manufacturerUrl: 'https://www.netxl.com/aruba/docs/aruba-1420-series-datasheet.pdf',
      name: 'HPE OfficeConnect 1420 8G',
      category: 'Networking',
      // Blatt (JH329A): 8 × RJ45 10/100/1000, unmanaged, internes Netzteil,
      // lüfterlos. Die Gerätebuchse für das Netzkabel nennt das Blatt nicht.
      inputs: [
        port('Netz (internes Netzteil, 100–240 V)', 'Generic', 'Power'),
      ],
      outputs: Array.from({ length: 8 }, (_, i) => eth(`Port ${i + 1} (1G)`)),
      notes: 'JH329A · unmanaged · max. 4,5 W · 158 × 105 × 27 mm, 0,5 kg',
      width: 220,
      height: 300,
    },
  },

  // Quelle: https://www.netxl.com/aruba/docs/hpe-1820-series-datasheet.pdf
  {
    match: ['hpe182024g', 'officeconnect182024g', 'j9980a', 'hp182024g'],
    deviceTypeId: '03c3875e-6a34-435f-95ca-3a77cb7f5e36',
    template: {
      manufacturerUrl: 'https://www.netxl.com/aruba/docs/hpe-1820-series-datasheet.pdf',
      name: 'HPE OfficeConnect 1820 24G',
      category: 'Networking',
      // Blatt (J9980A): 24 × RJ45 10/100/1000, 2 × SFP 100/1000, 1 HE,
      // Netzkabel C15 → Gerätebuchse IEC.
      inputs: [
        port('Mains In (C15-Kabel)', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...Array.from({ length: 24 }, (_, i) => eth(`Port ${i + 1} (1G)`)),
        port('SFP 25 (100/1000)', 'SFP', 'Ethernet'),
        port('SFP 26 (100/1000)', 'SFP', 'Ethernet'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'J9980A · Smart-Managed L2 (Web) · VLAN, RSTP, IGMP Snooping, LACP',
      width: 280,
      height: 560,
    },
  },

  // Quelle: https://www.lensrentals.com/product-assets/2751ba9a-93aa-4c44-b662-35a87f88a02f/Spark%20Plus%20IO%20Manual.pdf
  {
    match: ['newteksparkplusio4k', 'sparkplusio4k', 'nsp4kio', 'vizrtsparkplusio4k'],
    deviceTypeId: '4973864c-9c57-4778-becd-fe543d31ac14',
    template: {
      manufacturerUrl: 'https://www.lensrentals.com/product-assets/2751ba9a-93aa-4c44-b662-35a87f88a02f/Spark%20Plus%20IO%20Manual.pdf',
      name: 'NewTek Spark Plus IO 4K',
      category: 'IP/NDI',
      // Handbuch, Rückseite HDMI-Version: 1GbE mit PoE, HDMI Out, HDMI In,
      // 3,5-mm-Audio (Mic In), USB-C (Strom, 5–18 V DC).
      inputs: [
        port('HDMI In (bis 2160p60)', 'HDMI', 'HDMI'),
        port('Audio In (3,5 mm, Mic)', 'Jack 3.5 mm', 'Audio'),
        port('USB-C Power (5–18 V DC)', 'USB-C', 'Power'),
      ],
      outputs: [
        port('HDMI Out (Loop/Decode)', 'HDMI', 'HDMI'),
        port('NDI 1GbE (PoE)', 'Ethernet/RJ45', 'NDI'),
      ],
      notes: 'Encoder oder Decoder (umschaltbar) · PoE · Tally-LED',
      width: 200,
      height: 200,
    },
  },

  // Quelle: https://birddog.tv/wp-content/uploads/2022/01/BirdDog-4K-SDI_User-Guide_231017.pdf
  {
    match: ['birddog4ksdi', 'birddog4kndi12g', 'bd4ksdi'],
    deviceTypeId: 'e9f1b5a9-211e-4153-bdd4-49da56b6feed',
    template: {
      manufacturerUrl: 'https://birddog.tv/wp-content/uploads/2022/01/BirdDog-4K-SDI_User-Guide_231017.pdf',
      name: 'BirdDog 4K SDI',
      category: 'IP/NDI',
      // Handbuch S. 4: 12G SDI Input, 12G SDI Output, HDMI 2.0 Output,
      // 3,5-mm Headset/Mic, SFP+, PoE (RJ45), DC 12 V, USB 3.0.
      inputs: [
        sdi('12G-SDI In'),
        port('Headset/Mic (3,5 mm)', 'Jack 3.5 mm', 'Audio'),
        port('DC In (12 V)', 'Generic', 'Power'),
        port('USB 3.0', 'USB', 'USB'),
      ],
      outputs: [
        sdi('12G-SDI Out'),
        port('HDMI 2.0 Out', 'HDMI', 'HDMI'),
        port('NDI (PoE+)', 'Ethernet/RJ45', 'NDI'),
        port('SFP+', 'SFP+', 'NDI'),
      ],
      notes: 'NDI Encoder/Decoder · PoE+ ca. 14 W · Bi-Colour-Tally',
      width: 200,
      height: 220,
    },
  },

  // Quelle: https://doc.haivision.com/__attachments/a_53e3faf0e45e3410f18f2fd39457943b197e6ba426e06ecafb240efb1b26d822/Makito%20X%20Decoder%20Quick%20Start%20Guide-v2.3.pdf?cb=52719eb3994c3e800dcb525d64ceeb7e
  {
    match: ['haivisionmakitoxs292d', 's292dhd2', 's292d'],
    deviceTypeId: '11e6353d-2941-4558-82e1-1323c01d341b',
    template: {
      manufacturerUrl: 'https://doc.haivision.com/__attachments/a_53e3faf0e45e3410f18f2fd39457943b197e6ba426e06ecafb240efb1b26d822/Makito%20X%20Decoder%20Quick%20Start%20Guide-v2.3.pdf?cb=52719eb3994c3e800dcb525d64ceeb7e',
      name: 'Haivision Makito X S-292D',
      category: 'IP/NDI',
      // QSG S. 5, Rückseite #S-292D-HD2: Network (RJ45), Audio In/Out
      // (Mini-DIN-8), HDMI, SDI 2, SDI 1 (HD-BNC, Adapter auf BNC beiliegend),
      // Power 12 V über Conxall-3-Pin.
      inputs: [
        eth('Network (Stream In)'),
        port('Power 12 V DC (Conxall 3-pin)', 'Generic', 'Power'),
      ],
      outputs: [
        port('SDI 1 (3G)', 'HD-BNC', 'SDI'),
        port('SDI 2 (3G)', 'HD-BNC', 'SDI'),
        port('HDMI 1.4 Out', 'HDMI', 'HDMI'),
        port('Audio In/Out (Mini-DIN-8)', 'DIN', 'Audio'),
      ],
      notes: 'H.264 Decoder, 2 Kanäle · 12 V DC, 20 W · 21 × 129 × 187 mm',
      width: 200,
      height: 220,
    },
  },

  // Quelle: https://doc.haivision.com/__attachments/a_226c4d0bf3579098fcef0b1a4d69d8b5f34bce8d825ed8f10df4d8135cfa33da/Makito%20X%20Encoder%20Quick%20Start%20Guide-v2.3.pdf?cb=d76c00495f61d3f5c47cb5915e7d00b6
  {
    match: ['haivisionmakitoxs292e', 's292ehdsdi2', 's292e'],
    deviceTypeId: '86faec5c-6057-4095-ae5a-27a7caa04bab',
    template: {
      manufacturerUrl: 'https://doc.haivision.com/__attachments/a_226c4d0bf3579098fcef0b1a4d69d8b5f34bce8d825ed8f10df4d8135cfa33da/Makito%20X%20Encoder%20Quick%20Start%20Guide-v2.3.pdf?cb=d76c00495f61d3f5c47cb5915e7d00b6',
      name: 'Haivision Makito X S-292E',
      category: 'IP/NDI',
      // QSG S. 2/5, Rückseite #S-292E-HDSDI2: Network (RJ45), COM 1 (RJ45,
      // RS-232), Audio In/Out (Mini-DIN-8), 2 × CVBS/SDI (BNC), Conxall-3-Pin.
      inputs: [
        sdi('CVBS/SDI In 1'),
        sdi('CVBS/SDI In 2'),
        port('Audio In/Out (Mini-DIN-8)', 'DIN', 'Audio'),
        port('COM 1 (RS-232)', 'Ethernet/RJ45', 'RS-232'),
        port('Power 12 V DC (Conxall 3-pin)', 'Generic', 'Power'),
      ],
      outputs: [
        eth('Network (Stream Out)'),
      ],
      notes: 'H.264 Encoder, 2 Kanäle (HDSDI2) · 12 V DC, 20 W · 21 × 129 × 196 mm',
      width: 200,
      height: 220,
    },
  },

  // Quelle: https://assets.tequipment.net/assets/1/26/Phabrix_QX_IP_-_QX_12G_-_Manual_V2.2.pdf
  {
    match: ['phabrixqx12g', 'phabrixqx', 'phqx01'],
    deviceTypeId: '084f7579-bdf5-4776-8ca2-486b3aae462d',
    template: {
      manufacturerUrl: 'https://assets.tequipment.net/assets/1/26/Phabrix_QX_IP_-_QX_12G_-_Manual_V2.2.pdf',
      name: 'PHABRIX Qx 12G',
      category: 'Video',
      // Handbuch „Overview“: Generator 4 × 12G-BNC, Analyzer 4 × 12G-BNC +
      // Eye-BNC (rote Mutter), 2 × SFP+ (A, B), Ref-Loop 2 × BNC, 1G-Netz,
      // 2 × USB 2.0, SDI- und HDMI-Instrumentenausgang, Micro-USB (Service),
      // Sammelbuchse Stereo-Audio/LTC/8 GPI/4 AES (Typ ungenannt), XLR-Strom 10–18 V.
      inputs: [
        sdi('Analyzer SDI In A'),
        sdi('Analyzer SDI In B'),
        sdi('Analyzer SDI In C'),
        sdi('Analyzer SDI In D'),
        sdi('Eye/Jitter In (12G/6G/3G/HD)'),
        port('Ref Loop 1', 'BNC', 'Genlock'),
        port('Ref Loop 2', 'BNC', 'Genlock'),
        eth('Networking 10/100/1000'),
        port('USB 2.0 1', 'USB', 'USB'),
        port('USB 2.0 2', 'USB', 'USB'),
        port('Micro-USB (Service)', 'USB', 'USB'),
        port('Audio/LTC/GPI/AES (Sammelbuchse)', 'Generic', 'Data'),
        port('Power 10–18 V DC', 'XLR', 'Power'),
      ],
      outputs: [
        sdi('Generator SDI Out A'),
        sdi('Generator SDI Out B'),
        sdi('Generator SDI Out C'),
        sdi('Generator SDI Out D'),
        sdi('SDI Instrument Out'),
        port('HDMI Instrument Out (bis 1080p60)', 'HDMI', 'HDMI'),
        port('SFP+ A', 'SFP+', 'Ethernet'),
        port('SFP+ B', 'SFP+', 'Ethernet'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '1 HE, ½ Rack · Rasterizer/Analyzer/Generator 12G/6G/3G/HD-SDI · ST 2022-6/2110 über SFP+',
      width: 280,
      height: 520,
    },
  },

  // Quelle: https://archive.org/download/manualzz-id-1907020/1907020.pdf
  {
    match: ['rosendahlmif4', 'mif4'],
    deviceTypeId: 'ea5b5606-17f5-417a-a5a0-f8912baa0376',
    template: {
      manufacturerUrl: 'https://archive.org/download/manualzz-id-1907020/1907020.pdf',
      name: 'Rosendahl MIF4',
      category: 'Sync/Reference',
      // Handbuch Kap. 10: LTC In XLR3 female, LTC Out XLR3 male, MIDI In/Out
      // 5-pol. DIN, USB Typ B (MIDI-Klasse, auch Stromversorgung), Sync In BNC.
      inputs: [
        port('LTC In', 'XLR 3 Female', 'Timecode'),
        port('MIDI In', 'MIDI', 'MIDI'),
        port('Sync In (SD/HD)', 'BNC', 'Genlock'),
        port('USB (MIDI, 5 V)', 'USB Type B', 'USB'),
      ],
      outputs: [
        port('LTC Out', 'XLR 3 Male', 'Timecode'),
        port('MIDI Out', 'MIDI', 'MIDI'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'LTC/MTC-Interface und Generator · USB-Busstrom oder externes Netzteil · 168 × 44 × 110 mm, 0,6 kg',
      width: 220,
      height: 220,
    },
  },

  // Quelle: https://help.rossvideo.com/switcher-panels/Resources/Carbonite-Black-Panel-QS(4804DR-201-02).pdf
  {
    match: ['rosscarboniteblack2s', 'carboniteblack2s', 'cb2s'],
    deviceTypeId: '8a4bdf7d-ee52-418d-8271-2a22cc2d2276',
    template: {
      manufacturerUrl: 'https://help.rossvideo.com/switcher-panels/Resources/Carbonite-Black-Panel-QS(4804DR-201-02).pdf',
      name: 'Ross Carbonite Black 2S',
      category: 'Control',
      // QuickStart „Panel Ports and Connectors“: PS1, PS2, MODE-DIP,
      // PMC link 1/2, ETHERNET 1/2 (2 laut Hinweis noch ohne Funktion).
      inputs: [
        port('PS1 (12 V)', 'Generic', 'Power'),
        port('PS2 (12 V, redundant)', 'Generic', 'Power'),
        eth('Ethernet 1 (zum Frame)'),
        eth('Ethernet 2 (ohne Funktion)'),
        port('PMC Link 1', 'Ethernet/RJ45', 'PMC'),
        port('PMC Link 2', 'Ethernet/RJ45', 'PMC'),
      ],
      outputs: [],
      notes: '2-M/E-Bedienpult · max. 45 W (3,8 A bei 12 V) · Netzteil 100–120/220–240 V',
      width: 260,
      height: 260,
    },
  },

  // Quelle: https://help.rossvideo.com/switcher-panels/Resources/Carbonite-Black-Panel-QS(4804DR-201-02).pdf
  {
    match: ['rosscarboniteblack3x', 'carboniteblack3x', 'cb3x'],
    deviceTypeId: 'd862500d-45f5-451e-9a06-a8a4a902f587',
    template: {
      manufacturerUrl: 'https://help.rossvideo.com/switcher-panels/Resources/Carbonite-Black-Panel-QS(4804DR-201-02).pdf',
      name: 'Ross Carbonite Black 3X',
      category: 'Control',
      // Gleiche Anschlussleiste wie alle CB-Pulte im QuickStart.
      inputs: [
        port('PS1 (12 V)', 'Generic', 'Power'),
        port('PS2 (12 V, redundant)', 'Generic', 'Power'),
        eth('Ethernet 1 (zum Frame)'),
        eth('Ethernet 2 (ohne Funktion)'),
        port('PMC Link 1', 'Ethernet/RJ45', 'PMC'),
        port('PMC Link 2', 'Ethernet/RJ45', 'PMC'),
      ],
      outputs: [],
      notes: '3-M/E-Bedienpult, 32 Quelltasten · max. 80 W (6,7 A bei 12 V) · Netzteil 100–120/220–240 V',
      width: 260,
      height: 260,
    },
  },

  // Quelle: https://documents.blackmagicdesign.com/UserManuals/ATEM_Television_Studio_Switchers_Manual.pdf
  {
    match: ['blackmagicatemtelevisionstudiopro4k', 'atemtelevisionstudiopro4k', 'atemtvspro4k'],
    deviceTypeId: '798f7791-4769-4d97-9905-44c11d49cc8e',
    template: {
      manufacturerUrl: 'https://documents.blackmagicdesign.com/UserManuals/ATEM_Television_Studio_Switchers_Manual.pdf',
      name: 'Blackmagic ATEM Television Studio Pro 4K',
      category: 'Video Mixer',
      // Handbuch: 8 × 12G-SDI In (nur BNC), SDI Program Out, Multiview SDI +
      // HDMI, Aux SDI, XLR-Audioeingänge (Anzahl nicht beziffert, hier einer),
      // XLR-Audioausgang, Headset-Talkback, Ethernet „Control“, USB, RS-422
      // „Remote“. Program-Return-Ausgänge und Netzbuchse ohne Anzahl/Typ.
      inputs: [
        ...Array.from({ length: 8 }, (_, i) => sdi(`12G-SDI In ${i + 1}`)),
        port('XLR Audio In', 'XLR', 'Audio'),
        port('Headset (Talkback)', 'Generic', 'Audio'),
        eth('Ethernet „Control“'),
        port('USB', 'USB', 'USB'),
        port('RS-422 „Remote“', 'Generic', 'RS-422'),
      ],
      outputs: [
        sdi('SDI Program Out'),
        sdi('SDI Aux Out'),
        sdi('SDI Multiview Out'),
        port('HDMI Multiview Out', 'HDMI', 'HDMI'),
        port('XLR Audio Out', 'XLR', 'Audio'),
      ],
      notes: 'bis 2160p60 · Frame-Sync und Formatwandler auf allen 8 Eingängen · Fairlight-Audio · Advanced Chroma Key',
      width: 320,
      height: 420,
    },
  },
]
