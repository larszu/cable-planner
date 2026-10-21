import type { EquipmentTemplate } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// LANG-AG-Mietkatalog, Welle 3d — Broadcast- und IT-Geräte, die in
// `langBroadcastCatalog.ts` mangels Quelle übersprungen wurden. Jetzt auch
// aus Hersteller-Datenblättern und -Handbüchern, die auf Händler- oder
// Verleiherseiten liegen (Rückansicht-Abschnitte zählen). Recherche
// 2026-10-21. Steckertyp, den die Quelle nicht nennt, steht als 'Generic'.
//
// AJA „FiDO-12G" ist eine Serie: eingetragen sind FiDO-T-12G, -R-12G und
// -TR-12G (Single-Mode LC). Meinberg RX801 nach dem Datenblatt der
// 70x/80x-Serie.
//
// Übersprungen, weil keine Hersteller-Quelle mit Anschlussliste gefunden:
//   Marshall CV350-10X / CV350-10X-XLR (Modellseite 404, kein Datenblatt)
//   Videosys Epsilon (nur Pressetexte)
//   HP ProCurve 1420-8G, 1820-24G (HPE-Datenblätter nicht abrufbar, nur
//     Shopseiten; Teilenummer J9559A ist zudem der 1410-8G)
//   NewTek Spark Plus IO 4K, BirdDog 4K NDI 12G (nur Shopseiten)
//   Haivision Makito X S-292D / S-292E (Varianten-Familie, Doku-Seiten ohne
//     Anschlussliste abrufbar)
//   PHABRIX Qx 12G (nur Shopseiten und Flyer ohne Anschlüsse)
//   Rosendahl MIF4 (nur Händlerseiten, kein PDF)
//   Ross Carbonite Black 2S / 3X Panel (kein Dokument mit Anschlüssen)
//   Blackmagic ATEM Television Studio Pro 4K (Handbuch ohne Anschlussliste,
//     Techspecs-Seite führt das Modell nicht mehr)
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

interface Wave3dEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const BROADCAST_NACHTRAG_CATALOG: Wave3dEntry[] = [
  // Quelle: https://www.meinbergglobal.com/download/docs/events/pdf/ds_ms-rx-70-80_en_meinberg.pdf
  {
    match: ['microsyncrx801', 'rx801'],
    deviceTypeId: 'a8a683bb-69d7-4860-b467-20729f190b7d',
    template: {
      manufacturerUrl: 'https://www.meinbergglobal.com/download/docs/events/pdf/ds_ms-rx-70-80_en_meinberg.pdf',
      name: 'Meinberg microSync RX801',
      category: 'Sync/Reference',
      inputs: [
        { id: '', name: 'GNSS-Antenne (SMA oder BNC je Empfänger)', type: 'RF', connectorType: 'Generic' },
        { id: '', name: 'PPS In', type: 'PPS', connectorType: 'BNC' },
        { id: '', name: 'CLK In (Word Clock)', type: 'Word Clock', connectorType: 'BNC' },
        { id: '', name: 'Black In (Black Burst)', type: 'Genlock', connectorType: 'BNC' },
        { id: '', name: 'LTC / GPIO', type: 'Timecode', connectorType: 'DB15' },
        { id: '', name: 'USB Terminal', type: 'USB', connectorType: 'USB Micro-B' },
        { id: '', name: 'USB Host', type: 'USB', connectorType: 'USB Type A' },
        { id: '', name: 'Netzteil (AD 100–240 V AC oder DC 24–48 V)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'Black Out (Black Burst / Tri-Level)', type: 'Genlock', connectorType: 'BNC' },
        { id: '', name: 'DARS Out', type: 'Word Clock', connectorType: 'BNC' },
        { id: '', name: 'Word CLK Out', type: 'Word Clock', connectorType: 'BNC' },
        { id: '', name: 'PP 1 Out', type: 'PPS', connectorType: 'BNC' },
        { id: '', name: 'PP 2 Out', type: 'PPS', connectorType: 'BNC' },
        { id: '', name: 'COM 0 Timestring (RS-232)', type: 'RS-232', connectorType: 'DB9' },
        { id: '', name: 'LAN 0 (Management/NTP)', type: 'Ethernet', connectorType: 'SFP' },
        { id: '', name: 'LAN 1 (Management/NTP)', type: 'Ethernet', connectorType: 'SFP' },
        { id: '', name: 'LAN 2 (PTP Master & Slave)', type: 'Ethernet', connectorType: 'SFP' },
        { id: '', name: 'LAN 3 (PTP Master)', type: 'Ethernet', connectorType: 'SFP' },
      ],
      isRackDevice: true,
      notes: '80x-Serie mit OLED-Display · 19" Rack · Empfänger GNS (SMA) / GPS bzw. GNS-UC (BNC) · max. 50 W · Anschlüsse laut Datenblatt 70x/80x',
      width: 280,
      height: 320,
    },
  },

  // Quelle: https://sonifex.co.uk/download/467/brochures-and-catalogues/8569/sonifex-avn-dio10-dio20-catalogue-feb23.pdf
  {
    match: ['avndio10'],
    deviceTypeId: 'cef6ac43-733a-4e25-9992-8ab383aa1017',
    template: {
      manufacturerUrl: 'https://sonifex.co.uk/download/467/brochures-and-catalogues/8569/sonifex-avn-dio10-dio20-catalogue-feb23.pdf',
      name: 'Sonifex AVN-DIO10',
      category: 'Audio',
      inputs: [
        { id: '', name: '3G/HD/SD-SDI In', type: 'SDI', connectorType: 'Generic' },
        { id: '', name: 'AoIP Primary (PoE)', type: 'Dante', connectorType: 'etherCON' },
        { id: '', name: 'AoIP Secondary (PoE)', type: 'Dante', connectorType: 'etherCON' },
      ],
      outputs: [
        { id: '', name: '3G/HD/SD-SDI Out (reclocked)', type: 'SDI', connectorType: 'Generic' },
      ],
      isRackDevice: false,
      notes: 'Dante-SDI-Embedder/De-Embedder · 16x16 Kanäle · PoE 802.3af, redundant · 140 x 136 x 42 mm · SDI-Buchsentyp im Katalog nicht genannt',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://ftp.matrox.com/pub/mga/archive/ConvertIP/2025/2025-Nov/Matrox%20ConvertIP%20Installation%20and%20User%20Guide_v.2.06.pdf
  {
    match: ['convertipdsh', 'cipdsh', 'cipdsh2'],
    deviceTypeId: '52bc13ba-de7b-4f65-8f6a-1422a53780de',
    template: {
      manufacturerUrl: 'https://ftp.matrox.com/pub/mga/archive/ConvertIP/2025/2025-Nov/Matrox%20ConvertIP%20Installation%20and%20User%20Guide_v.2.06.pdf',
      name: 'Matrox ConvertIP DSH',
      category: 'IP/NDI',
      inputs: [
        { id: '', name: 'HDMI In (HDMI 2.1)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Line In (3,5 mm, unsymmetrisch)', type: 'Analog Audio', connectorType: 'Jack 3.5 mm TRS' },
        { id: '', name: 'RS-232 (TX RX G)', type: 'RS-232', connectorType: 'Generic' },
        { id: '', name: 'SFP 1 Media/Control (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'SFP 2 Media redundant (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'Control LAN (PoE+)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Power 12 V DC (DIN4, verriegelnd)', type: 'Power', connectorType: 'DIN' },
      ],
      outputs: [
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Audio Out', type: 'Analog Audio', connectorType: 'Generic' },
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'ST 2110 / IPMX Sender oder Empfänger · 1 HE, halbe Rackbreite · max. 18 W, PoE+ oder optionales Netzteil · RS-232 laut Handbuch für künftige Version',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://ftp.matrox.com/pub/mga/archive/ConvertIP/2025/2025-Nov/Matrox%20ConvertIP%20Installation%20and%20User%20Guide_v.2.06.pdf
  {
    match: ['convertipsdm', 'cipsdm2'],
    deviceTypeId: 'c0d1cf81-8910-4405-832b-8fcda727db88',
    template: {
      manufacturerUrl: 'https://ftp.matrox.com/pub/mga/archive/ConvertIP/2025/2025-Nov/Matrox%20ConvertIP%20Installation%20and%20User%20Guide_v.2.06.pdf',
      name: 'Matrox ConvertIP SDM',
      category: 'IP/NDI',
      inputs: [
        { id: '', name: 'SFP 1 Media/Control (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'SFP 2 Media redundant (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'LAN 1 Media/Control (1/2.5G)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'LAN 2 Media redundant (1/2.5G)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'LAN Control (1G)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
      ],
      outputs: [
        { id: '', name: 'Intel SDM-Steckplatz (Video zum Monitor)', type: 'Video', connectorType: 'Generic' },
      ],
      isRackDevice: false,
      notes: 'Intel Smart Display Module (Large) · Strom über den SDM-Steckplatz des Displays · RJ45- und SFP-Media nicht gleichzeitig',
      width: 280,
      height: 220,
    },
  },

  // Quelle: https://www.magewell.com/static/tech-specs/Pro_Convert/ProConvertforNDI_to_HDMI_4K.pdf
  {
    match: ['proconvertndihdmi4k', 'proconvertforndihdmi4k'],
    deviceTypeId: '824bf4fe-4339-49eb-afa1-97838d7d365a',
    template: {
      manufacturerUrl: 'https://www.magewell.com/static/tech-specs/Pro_Convert/ProConvertforNDI_to_HDMI_4K.pdf',
      name: 'Magewell Pro Convert NDI to HDMI 4K',
      category: 'IP/NDI',
      inputs: [
        { id: '', name: 'Ethernet 1G (PoE 802.3af)', type: 'Ethernet', connectorType: 'Generic' },
        { id: '', name: 'USB 2.0 Type B (5 V / Strom, RNDIS)', type: 'USB', connectorType: 'USB Type B' },
        { id: '', name: 'USB 3.0 Type A (Tastatur/Maus)', type: 'USB', connectorType: 'USB 3 Type A' },
      ],
      outputs: [
        { id: '', name: 'HDMI Out (1.4/2.0)', type: 'HDMI', connectorType: 'HDMI' },
      ],
      isRackDevice: false,
      notes: 'NDI/SRT/RTMP-Decoder bis 4096x2160p60 · ca. 7,2 W · Strom über USB oder PoE · 117,5 x 66,7 x 23,4 mm',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf
  {
    match: ['fidot12g'],
    deviceTypeId: '75d49d9c-52b2-43d6-ac00-06cddd1ec7b8',
    template: {
      manufacturerUrl: 'https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf',
      name: 'AJA FiDO-T-12G',
      category: 'Converter',
      inputs: [
        { id: '', name: '12G-SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'DC In (5–20 V)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: '12G-SDI Loop Out (reclocked)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Fiber Out (Single-Mode, Simplex)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
      ],
      isRackDevice: false,
      notes: '12G-SDI auf Glasfaser, Sender · 1310 nm · Netzteil DWP-U-R1 im Lieferumfang',
      width: 280,
      height: 160,
    },
  },

  // Quelle: https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf
  {
    match: ['fidor12g'],
    deviceTypeId: '8ba0fdab-fe60-4c4d-9932-2464e4b9d33b',
    template: {
      manufacturerUrl: 'https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf',
      name: 'AJA FiDO-R-12G',
      category: 'Converter',
      inputs: [
        { id: '', name: 'Fiber In (Single-Mode, Simplex)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'DC In (5–20 V)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: '12G-SDI Out 1', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: '12G-SDI Out 2 (identisch)', type: 'SDI', connectorType: 'BNC' },
      ],
      isRackDevice: false,
      notes: 'Glasfaser auf 12G-SDI, Empfänger · Netzteil DWP-U-R1 im Lieferumfang',
      width: 280,
      height: 160,
    },
  },

  // Quelle: https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf
  {
    match: ['fidotr12g'],
    deviceTypeId: '6d359101-d920-426d-b93a-483b08dc00d4',
    template: {
      manufacturerUrl: 'https://www.aja.com/assets/support/files/7204/en/AJA_FiDO-12G-Series_Manual_v1.3.pdf',
      name: 'AJA FiDO-TR-12G',
      category: 'Converter',
      inputs: [
        { id: '', name: '12G-SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Fiber In (Single-Mode, Duplex-Rx)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'DC In (5–20 V)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: '12G-SDI Out', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Fiber Out (Single-Mode, Duplex-Tx)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
      ],
      isRackDevice: false,
      notes: 'Transceiver: ein Kanal hin, ein Kanal zurück · Duplex-LC oder zwei Simplex-LC · Netzteil DWP-U-R1 im Lieferumfang',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://www.rikei.co.jp/wp/wp-content/uploads/download/DS_Haivision-Makito-X4-Decoder.pdf
  {
    match: ['makitox4decoder', 'makitox4dec'],
    deviceTypeId: '4f762793-0f24-42fa-bc12-0769296483bd',
    template: {
      manufacturerUrl: 'https://www.rikei.co.jp/wp/wp-content/uploads/download/DS_Haivision-Makito-X4-Decoder.pdf',
      name: 'Haivision Makito X4 Decoder',
      category: 'IP/NDI',
      inputs: [
        { id: '', name: 'Ethernet 10/100/1000Base-T', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'SFP+ 10G (künftige Nutzung)', type: 'Ethernet', connectorType: 'SFP+' },
        { id: '', name: 'DC In 12 V', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'SDI Out 1 (bis 12G)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 2 (bis 12G)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 3 (bis 12G)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 4 (bis 12G)', type: 'SDI', connectorType: 'BNC' },
      ],
      isRackDevice: false,
      notes: 'HEVC/H.264-Decoder · 1x 2160p60 oder 4x 1080p60 · SRT · 12 V DC, 18 W · Einzel-Blade 21 x 129 x 196 mm',
      width: 280,
      height: 200,
    },
  },

  // Quelle: https://www.nies-electronic.de/produktkataloge/Product-Folder-NA2-IO-DLINE.pdf
  {
    match: ['na2iodline'],
    deviceTypeId: '83e494e0-6935-45f8-80af-ce1e0c7668d1',
    template: {
      manufacturerUrl: 'https://www.nies-electronic.de/produktkataloge/Product-Folder-NA2-IO-DLINE.pdf',
      name: 'Neutrik NA2-IO-DLINE',
      category: 'Audio',
      inputs: [
        { id: '', name: 'Line In 1 (symmetrisch)', type: 'Analog Audio', connectorType: 'XLR' },
        { id: '', name: 'Line In 2 (symmetrisch)', type: 'Analog Audio', connectorType: 'XLR' },
        { id: '', name: 'Dante / PoE', type: 'Dante', connectorType: 'etherCON' },
      ],
      outputs: [
        { id: '', name: 'Line Out 1 (symmetrisch)', type: 'Analog Audio', connectorType: 'XLR' },
        { id: '', name: 'Line Out 2 (symmetrisch)', type: 'Analog Audio', connectorType: 'XLR' },
      ],
      isRackDevice: false,
      notes: 'Dante-Interface 2 in / 2 out · PoE 802.3af/at Klasse 1 nötig · AES67 · rackmontierbar mit Zubehör',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://docs.brightsign.biz/hardware/xd235-xd1035
  {
    match: ['xd235'],
    deviceTypeId: '2a3897d3-ec64-4954-b56e-89c1544a00a1',
    template: {
      manufacturerUrl: 'https://docs.brightsign.biz/hardware/xd235-xd1035',
      name: 'BrightSign XD235',
      category: 'Media Server',
      inputs: [
        { id: '', name: 'Ethernet (PoE)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'GPIO', type: 'GPIO', connectorType: 'Generic' },
        { id: '', name: 'IR In/Out', type: 'IR', connectorType: 'Generic' },
        { id: '', name: 'DC In 12 V / 3 A', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'HDMI Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Audio Out (Kombi, 3,5 mm)', type: 'Analog Audio', connectorType: 'Jack 3.5 mm' },
      ],
      isRackDevice: false,
      notes: 'Mediaplayer bis 3840x2160p60 · microSD-Slot · 2 WLAN-Antennenanschlüsse · kein USB/Seriell (nur XD1035)',
      width: 280,
      height: 200,
    },
  },

  // Quelle: https://shop.ccisolutions.com/StoreFront/jsp/pdf/RSV-CB-SOLO-13_configurationGuide.pdf
  {
    match: ['carboniteblacksolo', 'cbsolo'],
    deviceTypeId: 'd11cf04a-c5fc-4432-ab23-4698ddc20736',
    template: {
      manufacturerUrl: 'https://shop.ccisolutions.com/StoreFront/jsp/pdf/RSV-CB-SOLO-13_configurationGuide.pdf',
      name: 'Ross Carbonite Black Solo',
      category: 'Video Mixer',
      inputs: [
        { id: '', name: 'SDI In 1', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI In 2', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI In 3', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI In 4', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI In 5', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI In 6', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'HDMI In 1 (1.4)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'HDMI In 2 (1.4)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'HDMI In 3 (1.4)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Ref In (Black Burst / Tri-Level, durchgeschleift)', type: 'Genlock', connectorType: 'BNC' },
        { id: '', name: 'GPIO (24 GPI)', type: 'GPIO', connectorType: 'Generic' },
        { id: '', name: 'Serial', type: 'RS-422', connectorType: 'Generic' },
        { id: '', name: 'UPGD', type: 'USB', connectorType: 'Generic' },
        { id: '', name: 'PS 1', type: 'Power', connectorType: 'Generic' },
        { id: '', name: 'PS 2 (redundant, opt.)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'SDI Out 1', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 2', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 3', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 4', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Out 5', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'HDMI Out 1 (1.4)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'AES Out', type: 'AES', connectorType: 'Generic' },
        { id: '', name: 'Tally (16 Relais)', type: 'Tally', connectorType: 'Generic' },
      ],
      isRackDevice: true,
      notes: '1-ME-Engine mit integriertem Bedienteil · Ref-In loopend · Steckertyp für GPIO/Tally/Serial/AES im Guide nicht genannt · Netzwerkport im Rückansicht-Plan nicht beschriftet',
      width: 280,
      height: 420,
    },
  },

  // Quelle: https://help.rossvideo.com/switcher-panels/Resources/TouchDrive-Panel-QS(4880DR-200-12).pdf
  {
    match: ['touchdrivetd3s', 'td3s', 'td3spanel'],
    deviceTypeId: 'cb6bea73-802e-4a19-b965-d969c451861f',
    template: {
      manufacturerUrl: 'https://help.rossvideo.com/switcher-panels/Resources/TouchDrive-Panel-QS(4880DR-200-12).pdf',
      name: 'Ross TouchDrive TD3S',
      category: 'Control',
      inputs: [
        { id: '', name: 'Power (PS 1–4)', type: 'Power', connectorType: 'Generic' },
        { id: '', name: 'Network (zum Switcher)', type: 'Ethernet', connectorType: 'Generic' },
        { id: '', name: 'USB 2.0', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        { id: '', name: 'Display Port (Touchscreen)', type: 'DisplayPort', connectorType: 'DisplayPort' },
        { id: '', name: 'Monitor 12V Out', type: 'Power', connectorType: 'Generic' },
      ],
      isRackDevice: false,
      notes: 'Bedienpult 3 ME · max. 173 W, 11,53 A bei 15 V · zusätzlicher USB-3.0-Port seitlich am Backsplash mancher Panels · Quickstart gilt für Serie 4882AR',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://documents.blackmagicdesign.com/UserManuals/ATEMConvertersManual.pdf
  {
    match: ['atemtalkbackconverter4k'],
    deviceTypeId: 'd9f67937-0357-4f40-9e8c-bd52002b927c',
    template: {
      manufacturerUrl: 'https://documents.blackmagicdesign.com/UserManuals/ATEMConvertersManual.pdf',
      name: 'Blackmagic ATEM Talkback Converter 4K',
      category: 'Converter',
      inputs: [
        { id: '', name: 'PGM SDI In (Tally/Talkback)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 1 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 2 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 3 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 4 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 5 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 6 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 7 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 8 SDI In', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 1 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 2 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 3 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 4 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 5 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 6 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 7 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Cam 8 Opt In/Out (SFP, opt.)', type: 'Fiber', connectorType: 'Fiber Optic LC' },
        { id: '', name: 'Mic In (XLR, Front)', type: 'Analog Audio', connectorType: 'XLR' },
        { id: '', name: 'Headset Kopfhörer (1/4" TRS, Front)', type: 'Analog Audio', connectorType: 'Jack 6.35 mm TRS' },
        { id: '', name: 'Headset Mic (0.206" TRS, Front)', type: 'Analog Audio', connectorType: 'Generic' },
        { id: '', name: 'USB Mini-B (Firmware)', type: 'USB', connectorType: 'USB Mini-B' },
        { id: '', name: 'Mains In', type: 'Power', connectorType: 'IEC 230V' },
        { id: '', name: 'DC In 12–31 V (redundant)', type: 'Power', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'PGM SDI Loop Out', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 1 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 2 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 3 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 4 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 5 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 6 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 7 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI 8 Out (zum Mischer)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 1 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 2 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 3 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 4 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 5 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 6 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 7 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Cam 8 SDI Out (PGM-Rückweg)', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Monitor Out L (RCA)', type: 'Analog Audio', connectorType: 'Cinch/RCA' },
        { id: '', name: 'Monitor Out R (RCA)', type: 'Analog Audio', connectorType: 'Cinch/RCA' },
      ],
      isRackDevice: true,
      notes: '8 Kameras bis 12G-SDI · Talkback auf SDI-Kanälen 15/16 · SFP-Module optional · zwei Netzteile redundant',
      width: 280,
      height: 580,
    },
  },

  // Quelle: https://documents.blackmagicdesign.com/UserManuals/TeranexMiniConvertersManual.pdf
  {
    match: ['teranexminisditodisplayport8khdr', 'teranexminisditodp8k'],
    deviceTypeId: 'bf6eb249-6d98-438f-993c-2d7120895605',
    template: {
      manufacturerUrl: 'https://documents.blackmagicdesign.com/UserManuals/TeranexMiniConvertersManual.pdf',
      name: 'Blackmagic Teranex Mini SDI to DisplayPort 8K HDR',
      category: 'Converter',
      inputs: [
        { id: '', name: '12G-SDI In A', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: '12G-SDI In B', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: '12G-SDI In C', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: '12G-SDI In D', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'Ethernet (Setup)', type: 'Ethernet', connectorType: 'Generic' },
        { id: '', name: 'Mains In (IEC C14, 90–240 V)', type: 'Power', connectorType: 'IEC 230V' },
      ],
      outputs: [
        { id: '', name: 'SDI Loop Out A', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Loop Out B', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Loop Out C', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'SDI Loop Out D', type: 'SDI', connectorType: 'BNC' },
        { id: '', name: 'DisplayPort 1', type: 'DisplayPort', connectorType: 'DisplayPort' },
        { id: '', name: 'DisplayPort 2', type: 'DisplayPort', connectorType: 'DisplayPort' },
        { id: '', name: 'USB-C (DisplayPort / Setup / Kalibriersonde)', type: 'DisplayPort', connectorType: 'USB-C' },
        { id: '', name: 'Analog Out L (RCA)', type: 'Analog Audio', connectorType: 'Cinch/RCA' },
        { id: '', name: 'Analog Out R (RCA)', type: 'Analog Audio', connectorType: 'Cinch/RCA' },
      ],
      isRackDevice: false,
      notes: '8K über Quad-Link 12G-SDI · 8K-Monitore teils an DP 1 + DP 2 · DP über USB-C nur mit zertifiziertem passivem Kabel',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://documents.blackmagicdesign.com/UserManuals/VideohubHardwareControl.pdf
  {
    match: ['videohubsmartcontrolpro'],
    deviceTypeId: '441fd2c5-79c9-4c81-8044-818d2ec6e4d5',
    template: {
      manufacturerUrl: 'https://documents.blackmagicdesign.com/UserManuals/VideohubHardwareControl.pdf',
      name: 'Blackmagic Videohub Smart Control Pro',
      category: 'Control',
      inputs: [
        { id: '', name: 'Ethernet (PoE+)', type: 'Ethernet', connectorType: 'Generic' },
        { id: '', name: 'AC Power', type: 'Power', connectorType: 'Generic' },
        { id: '', name: 'USB-C', type: 'USB', connectorType: 'USB-C' },
      ],
      outputs: [
        { id: '', name: 'Ethernet Loop (ohne PoE)', type: 'Ethernet', connectorType: 'Generic' },
      ],
      isRackDevice: true,
      notes: '48 programmierbare Tasten · Strom über AC oder PoE+',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://marshall-usa.com/pdf/VAC-23SHU3-manual.pdf
  {
    match: ['vac23shu3'],
    deviceTypeId: 'def2ae60-55e0-4d8c-b8b1-0ee9b11f73a7',
    template: {
      manufacturerUrl: 'https://marshall-usa.com/pdf/VAC-23SHU3-manual.pdf',
      name: 'Marshall VAC-23SHU3',
      category: 'Converter',
      inputs: [
        { id: '', name: '3G-SDI In', type: 'SDI', connectorType: 'Generic' },
        { id: '', name: 'HDMI In (2.0)', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'Firmware Update USB 2.0', type: 'USB', connectorType: 'USB' },
      ],
      outputs: [
        { id: '', name: 'SDI Loop Out', type: 'SDI', connectorType: 'Generic' },
        { id: '', name: 'HDMI Loop Out', type: 'HDMI', connectorType: 'HDMI' },
        { id: '', name: 'USB 3.0 Out zum Computer (UVC)', type: 'USB', connectorType: 'USB 3 Type B' },
      ],
      isRackDevice: false,
      notes: 'Capture-Adapter HDMI/SDI auf USB 3.0 · Strom aus dem USB-Port · Eingangswahl per Schalter',
      width: 280,
      height: 180,
    },
  },

  // Quelle: https://marshall-usa.com/pdf/Marshall_VS-PTC-IP_manualV3.pdf
  {
    match: ['vsptcip'],
    deviceTypeId: '230f7af3-e4ea-409b-9498-131203e0cb5b',
    template: {
      manufacturerUrl: 'https://marshall-usa.com/pdf/Marshall_VS-PTC-IP_manualV3.pdf',
      name: 'Marshall VS-PTC-IP',
      category: 'Control',
      inputs: [
        { id: '', name: '12 V DC Power', type: 'Power', connectorType: 'Generic' },
        { id: '', name: 'Tally / Contact', type: 'Tally', connectorType: 'Generic' },
      ],
      outputs: [
        { id: '', name: 'RS-232', type: 'RS-232', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'IP (PoE)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'RS-422 (A)', type: 'RS-422', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'RS-422 (B)', type: 'RS-422', connectorType: 'Ethernet/RJ45' },
      ],
      isRackDevice: false,
      notes: 'PTZ-Joystick · 7 Kameras RS-232, 14 RS-422, 255 IP · VISCA, Pelco D/P, ONVIF, VISCA over IP · 12 V DC oder PoE 802.3af',
      width: 280,
      height: 200,
    },
  },

  // Quelle: https://shop.ccisolutions.com/StoreFront/jsp/pdf/MEI-CVRCPV2_quickStart.pdf
  {
    match: ['cvrcpv2'],
    deviceTypeId: 'db3d28f6-23e6-4ccc-8069-303577ea1f2a',
    template: {
      manufacturerUrl: 'https://shop.ccisolutions.com/StoreFront/jsp/pdf/MEI-CVRCPV2_quickStart.pdf',
      name: 'Marshall CV-RCP-V2',
      category: 'Control',
      inputs: [
        { id: '', name: 'DC In 12 V (2,1 mm)', type: 'Power', connectorType: 'DC Barrel' },
      ],
      outputs: [
        { id: '', name: 'RS-485 Kamerasteuerung (XLR, oben)', type: 'RS-485', connectorType: 'XLR 3 Female' },
      ],
      isRackDevice: false,
      notes: '5"-Touchscreen-RCP · bis 7 Kameras per XLR-Y-Splits · laut Quickstart',
      width: 280,
      height: 140,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4350/M4350_Datasheet.pdf
  {
    match: ['m435024g4xf', 'gsm4328'],
    deviceTypeId: '9733f51a-8422-42b4-9785-3ef887c8e539',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4350/M4350_Datasheet.pdf',
      name: 'NETGEAR M4350-24G4XF',
      category: 'Networking',
      inputs: [
        { id: '', name: 'Out-of-band 1G (Rückseite)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Console USB-C', type: 'USB', connectorType: 'USB-C' },
        { id: '', name: 'Storage USB-A 1', type: 'USB', connectorType: 'USB Type A' },
        { id: '', name: 'Storage USB-A 2', type: 'USB', connectorType: 'USB Type A' },
        { id: '', name: 'Netzteil 880 W', type: 'Power', connectorType: 'IEC 230V' },
      ],
      outputs: [
        { id: '', name: 'Port 1 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 2 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 3 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 4 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 5 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 6 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 7 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 8 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 9 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 10 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 11 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 12 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 13 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 14 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 15 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 16 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 17 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 18 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 19 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 20 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 21 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 22 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 23 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 24 1G PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'SFP+ 1 (10G)', type: 'Ethernet', connectorType: 'SFP+' },
        { id: '', name: 'SFP+ 2 (10G)', type: 'Ethernet', connectorType: 'SFP+' },
        { id: '', name: 'SFP+ 3 (10G)', type: 'Ethernet', connectorType: 'SFP+' },
        { id: '', name: 'SFP+ 4 (10G)', type: 'Ethernet', connectorType: 'SFP+' },
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'AV-Line-Switch · PoE-Budget 648 W, bis 720 W · 1 Steckplatz für Modul-Netzteil · 440 x 43,2 x 400 mm',
      width: 280,
      height: 680,
    },
  },

  // Quelle: https://www.downloads.netgear.com/files/GDC/M4350/M4350_Datasheet.pdf
  {
    match: ['m435024x4v', 'xsm4328cv'],
    deviceTypeId: 'f5b6ca65-950e-4c1c-8655-a99c31c1804a',
    template: {
      manufacturerUrl: 'https://www.downloads.netgear.com/files/GDC/M4350/M4350_Datasheet.pdf',
      name: 'NETGEAR M4350-24X4V',
      category: 'Networking',
      inputs: [
        { id: '', name: 'Out-of-band 1G (Rückseite)', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Console USB-C', type: 'USB', connectorType: 'USB-C' },
        { id: '', name: 'Storage USB-A 1', type: 'USB', connectorType: 'USB Type A' },
        { id: '', name: 'Storage USB-A 2', type: 'USB', connectorType: 'USB Type A' },
        { id: '', name: 'Netzteil 880 W', type: 'Power', connectorType: 'IEC 230V' },
      ],
      outputs: [
        { id: '', name: 'Port 1 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 2 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 3 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 4 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 5 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 6 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 7 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 8 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 9 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 10 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 11 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 12 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 13 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 14 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 15 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 16 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 17 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 18 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 19 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 20 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 21 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 22 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 23 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'Port 24 10G/Multi-Gig PoE+', type: 'Ethernet', connectorType: 'Ethernet/RJ45' },
        { id: '', name: 'SFP28 1 (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'SFP28 2 (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'SFP28 3 (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
        { id: '', name: 'SFP28 4 (10/25G)', type: 'Ethernet', connectorType: 'SFP28' },
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: 'AV-Line-Switch · PoE-Budget 576 W, bis 720 W · 1 Steckplatz für Modul-Netzteil · 440 x 43,2 x 400 mm',
      width: 280,
      height: 680,
    },
  },
]
