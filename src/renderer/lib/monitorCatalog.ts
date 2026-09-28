import type { EquipmentTemplate, Port } from '../types/equipment'
import type { RecordingCapability } from './recording'

// ───────────────────────────────────────────────────────────────────────────
// Broadcast-Monitor-/Monitor-Recorder-Katalog. Matched by name substrings so
// Rentman items resolve to the correct port layout on import; auch eingesät.
//
// Belege gegen die offiziellen Hersteller-Produktseiten, wo eine erreichbar
// ist (Recherche 2026-09, Quellen-URL je Eintrag): Blackmagic Video Assist
// (blackmagicdesign.com) und die SmallHD-Cine-Serie (smallhd.com), beide per
// curl gegen die Fallbackseite geprüft. Die übrigen Einträge (Atomos, TVLogic,
// Marshall V-LCD, JVC DT-V, NEC MultiSync, ältere SmallHD) sind eingestellt
// oder liegen auf Domänen, die von hier nachweislich nicht erreichbar sind
// (Atomos: 403 auf curl wie WebFetch). Sie bleiben ohne Beleg statt mit einer
// geratenen Adresse — das ist die ehrliche Auskunft, kein Versäumnis.
// 2026-09-27: Marshall V-LCD173HR/V-LCD56MD-3G, TVLogic LVM-075A und SmallHD
// 2403/1703 auf die echten Herstellermodelle umgestellt und belegt (Ports am
// Datenblatt korrigiert); V-LCD241, V-LCD70 und LVM-171W bleiben unbelegt.

const port = (name: string, connectorType: Port['connectorType'] = 'BNC'): Port => ({
  id: '',
  name,
  type: connectorType,
  connectorType,
})

const sdiIn  = (n: string) => port(n, 'BNC')
const sdiOut = (n: string) => port(n, 'BNC')
const hdmiIn  = (n: string) => port(n, 'HDMI')
const hdmiOut = (n: string) => port(n, 'HDMI')
const xlrIn  = (n: string) => port(n, 'XLR')
const eth    = (n = 'Ethernet') => port(n, 'Ethernet/RJ45')

const MON = 'Monitors'

interface MonitorEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Zeichnet dieses Modell auf, und in welcher Form (Bedarf 62)? Fehlt das
   *  Feld, ist das die Datenblatt-Aussage „zeichnet nicht auf" — siehe
   *  `recording.ts`. */
  records?: RecordingCapability
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: MonitorEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const MONITOR_CATALOG: MonitorEntry[] = [

  // ── Blackmagic Video Assist ──────────────────────────────────────────────

  {
    match: ['video assist', '7', '12g'],
    deviceTypeId: '8084865f-8629-4256-9ab9-afc426b1d3c8',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicvideoassist
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicvideoassist',
      name: 'Blackmagic Video Assist 7" 12G HDR',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI In'), xlrIn('XLR L In'), xlrIn('XLR R In')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI Out')],
      width: 220, height: 160,
    },
  },
  {
    match: ['video assist', '5', '12g'],
    deviceTypeId: '67412da8-5f5f-40f6-94c8-dc5a7aa88afb',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicvideoassist
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicvideoassist',
      name: 'Blackmagic Video Assist 5" 12G HDR',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },
  {
    match: ['video assist', '7', '3g'],
    deviceTypeId: '7f67f2bb-2ad0-43c2-8f88-91bef51fa46e',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicvideoassist
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicvideoassist',
      name: 'Blackmagic Video Assist 7" 3G',
      category: MON,
      inputs:  [sdiIn('3G-SDI In'), hdmiIn('HDMI In'), xlrIn('XLR L In'), xlrIn('XLR R In')],
      outputs: [sdiOut('3G-SDI Out'), hdmiOut('HDMI Out')],
      width: 220, height: 160,
    },
  },
  {
    match: ['video assist', '5', '3g'],
    deviceTypeId: 'f928632f-7e91-4198-9031-f0d8a8146dad',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicvideoassist
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicvideoassist',
      name: 'Blackmagic Video Assist 5" 3G',
      category: MON,
      inputs:  [sdiIn('3G-SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('3G-SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },

  // ── Atomos ───────────────────────────────────────────────────────────────

  // Shogun Ultra (2023, 7", 2000 nit, AtomOS 11)
  {
    match: ['shogun', 'ultra'],
    deviceTypeId: '37ca86f0-451a-4e6a-85aa-80e23beb6a3f',
    records: 'per-device',
    // Quelle: https://www.atomos.com/wp-content/uploads/2025/02/SHOGUN_ULTRA_QSG_2025.pdf
    template: {
      manufacturerUrl: 'https://www.atomos.com/wp-content/uploads/2025/02/SHOGUN_ULTRA_QSG_2025.pdf',
      name: 'Atomos Shogun Ultra',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI 2.0 In'), eth('Ethernet 1G')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI 2.0 Out')],
      width: 220, height: 160,
    },
  },
  // Shogun Connect (2022, 7", network streaming)
  {
    match: ['shogun', 'connect'],
    deviceTypeId: '2e9c5687-76b7-4e8f-9262-a50b92bbe064',
    records: 'per-device',
    template: {
      name: 'Atomos Shogun Connect',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI 2.0 In'), eth('Ethernet 1G')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI 2.0 Out')],
      width: 220, height: 160,
    },
  },
  // Shogun Inferno (2016, 7", legacy – still widely rented)
  {
    match: ['shogun', 'inferno'],
    deviceTypeId: 'a37271a6-a807-49f3-ba22-a4486ebed9a7',
    records: 'per-device',
    template: {
      name: 'Atomos Shogun Inferno',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('12G-SDI Out (Loop)'), hdmiOut('HDMI Out')],
      width: 220, height: 160,
    },
  },
  // Sumo 19M (2020, 4x 12G-SDI in/out, multitrack HDR monitor-recorder)
  {
    match: ['sumo', '19m'],
    deviceTypeId: '02b44704-82d1-4b1d-89b1-ae107832ea78',
    records: 'per-device',
    template: {
      name: 'Atomos Sumo 19M',
      category: MON,
      inputs: [
        sdiIn('12G-SDI In 1'), sdiIn('12G-SDI In 2'),
        sdiIn('12G-SDI In 3'), sdiIn('12G-SDI In 4'),
        hdmiIn('HDMI In'),
        xlrIn('XLR L'), xlrIn('XLR R'),
      ],
      outputs: [
        sdiOut('12G-SDI Out 1'), sdiOut('12G-SDI Out 2'),
        sdiOut('12G-SDI Out 3'), sdiOut('12G-SDI Out 4'),
        hdmiOut('HDMI Out'),
      ],
      width: 260, height: 260,
    },
  },
  // Sumo 19 (2017, 4x 3G-SDI in/out, classic rental workhorse)
  {
    match: ['sumo', '19'],
    deviceTypeId: 'e44ee4b8-842c-4bad-a628-e6c0d71ae782',
    records: 'per-device',
    template: {
      name: 'Atomos Sumo 19',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        sdiIn('SDI In 3'), sdiIn('SDI In 4'),
        hdmiIn('HDMI In'),
        xlrIn('XLR L'), xlrIn('XLR R'),
      ],
      outputs: [
        sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), hdmiOut('HDMI Out'),
      ],
      width: 260, height: 240,
    },
  },
  // Ninja V+ (5", SDI only via breakout, 12G over HDMI RAW)
  {
    match: ['ninja', 'v+'],
    deviceTypeId: '86bc69fc-7c67-4a72-b454-e3b9be3ed099',
    records: 'per-device',
    template: {
      name: 'Atomos Ninja V+',
      category: MON,
      inputs:  [hdmiIn('HDMI 2.0 In')],
      outputs: [hdmiOut('HDMI 2.0 Out')],
      width: 180, height: 120,
    },
  },
  // Ninja V (5", HDMI only)
  {
    match: ['ninja', 'v'],
    deviceTypeId: 'bbf307e6-9e91-4991-822e-9f089ef44e10',
    records: 'per-device',
    template: {
      name: 'Atomos Ninja V',
      category: MON,
      inputs:  [hdmiIn('HDMI In')],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 120,
    },
  },

  // ── SmallHD ──────────────────────────────────────────────────────────────

  // SmallHD 2403 HDR Production Monitor (24") — 3G, kein Ref-Eingang. Die
  // vorherige Portliste (4x 12G, Ref) war die der Vision/Cine 24. Die
  // Herstellerseite ist abgeschaltet („no longer available"); Beleg ist ihre
  // Archivkopie.
  {
    match: ['smallhd', '2403'],
    deviceTypeId: '516d1c7d-4edf-468d-b0ab-5bb4e12f1819',
    // Quelle: https://web.archive.org/web/20170710135919/http://store.smallhd.com/products/2400-series/2403-HDR-Production-Monitor
    template: {
      manufacturerUrl: 'https://web.archive.org/web/20170710135919/http://store.smallhd.com/products/2400-series/2403-HDR-Production-Monitor',
      name: 'SmallHD 2403 HDR Production Monitor',
      category: MON,
      inputs: [sdiIn('3G-SDI In 1'), sdiIn('3G-SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('3G-SDI Out 1'), sdiOut('3G-SDI Out 2'), hdmiOut('HDMI Out')],
      width: 260, height: 280,
    },
  },
  // SmallHD 1703 P3X (17") — „1703 P3X HDR" vermischte zwei Namen; 1703 P3X
  // und 1703 HDR haben dieselben Anschluesse: 2x 3G-SDI in/out, HDMI in/out,
  // kein Ref-Eingang.
  {
    match: ['smallhd', '1703'],
    deviceTypeId: '2a0e71a1-8505-457d-88db-8f1902f94eeb',
    // Quelle: https://smallhd.com/products/1703-p3x-production-monitor
    template: {
      manufacturerUrl: 'https://smallhd.com/products/1703-p3x-production-monitor',
      name: 'SmallHD 1703 P3X',
      category: MON,
      inputs: [sdiIn('3G-SDI In 1'), sdiIn('3G-SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('3G-SDI Out 1'), sdiOut('3G-SDI Out 2'), hdmiOut('HDMI Out')],
      width: 240, height: 200,
    },
  },
  // SmallHD 702 Bright (7")
  {
    match: ['smallhd', '702'],
    deviceTypeId: '1100c1ea-5170-4e24-8673-7478ef82658c',
    // Quelle: https://guide.smallhd.com/m/shd702bright
    template: {
      manufacturerUrl: 'https://guide.smallhd.com/m/shd702bright',
      name: 'SmallHD 702 Bright',
      category: MON,
      inputs:  [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },
  // SmallHD Cine 18 (18", 4x SDI in)
  {
    match: ['smallhd', 'cine', '18'],
    deviceTypeId: 'aaf51407-a8ee-49b4-adf5-78d497eefa71',
    // Quelle: https://smallhd.com/products/cine-18
    template: {
      manufacturerUrl: 'https://smallhd.com/products/cine-18',
      name: 'SmallHD Cine 18',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        sdiIn('SDI In 3'), sdiIn('SDI In 4'),
        hdmiIn('HDMI In'),
        sdiIn('Ref In'),
      ],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), sdiOut('SDI Out 3'), sdiOut('SDI Out 4'), hdmiOut('HDMI Out')],
      width: 250, height: 240,
    },
  },
  // SmallHD Cine 13 (13", 2x SDI in)
  {
    match: ['smallhd', 'cine', '13'],
    deviceTypeId: '7318c360-c091-4508-a198-064f535db356',
    // Quelle: https://smallhd.com/products/cine-13
    template: {
      manufacturerUrl: 'https://smallhd.com/products/cine-13',
      name: 'SmallHD Cine 13',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), sdiIn('SDI In 3'), sdiIn('SDI In 4'), hdmiIn('HDMI In'), sdiIn('Ref In')],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), sdiOut('SDI Out 3'), sdiOut('SDI Out 4'), hdmiOut('HDMI Out')],
      width: 230, height: 180,
    },
  },
  // SmallHD Cine 7 (7")
  {
    match: ['smallhd', 'cine', '7'],
    deviceTypeId: '61e184b2-e14c-4fa9-9308-3c74adc53018',
    // Quelle: https://smallhd.com/products/cine-7
    template: {
      manufacturerUrl: 'https://smallhd.com/products/cine-7',
      name: 'SmallHD Cine 7',
      category: MON,
      inputs:  [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (Loop)'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },
  // SmallHD 503 UltraBright (5")
  {
    match: ['smallhd', '503'],
    deviceTypeId: '9a91a6a2-f264-49fd-8fe0-4a5da6f37c65',
    // Quelle: https://smallhd.com/products/503-ultra-bright-professional-on-camera-field-monitor
    template: {
      manufacturerUrl: 'https://smallhd.com/products/503-ultra-bright-professional-on-camera-field-monitor',
      name: 'SmallHD 503 UltraBright',
      category: MON,
      inputs:  [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out')],
      width: 200, height: 140,
    },
  },
  // SmallHD 502 (5")
  {
    match: ['smallhd', '502'],
    deviceTypeId: 'dc6f1c1a-8280-4dc5-9fa7-dacccb8a97d0',
    // Quelle: https://smallhd.com/pages/502-bright-on-camera-monitor
    template: {
      manufacturerUrl: 'https://smallhd.com/pages/502-bright-on-camera-monitor',
      name: 'SmallHD 502',
      category: MON,
      inputs:  [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },

  // ── TVLogic ──────────────────────────────────────────────────────────────

  // LUM-240G (24", 2x 3G-SDI in/out, Ref)
  {
    match: ['tvlogic', 'lum-240'],
    deviceTypeId: '863ddb0c-c350-4440-b2d6-25943d37efce',
    // Quelle: https://www.tvlogic.tv/new/M_Spec.asp?sidx=77
    template: {
      manufacturerUrl: 'https://www.tvlogic.tv/new/M_Spec.asp?sidx=77',
      name: 'TVLogic LUM-240G',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        hdmiIn('HDMI In'), sdiIn('Ref In'),
      ],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), hdmiOut('HDMI Out')],
      width: 240, height: 220,
    },
  },
  // LUM-170G (17", SDI in/out, HDMI in/out, Ref)
  {
    match: ['tvlogic', 'lum-170'],
    deviceTypeId: '37731c4c-20d4-44f1-94c0-d55e8774bb38',
    // Quelle: https://www.tvlogic.tv/new/M_Spec.asp?sidx=76
    template: {
      manufacturerUrl: 'https://www.tvlogic.tv/new/M_Spec.asp?sidx=76',
      name: 'TVLogic LUM-170G',
      category: MON,
      inputs: [sdiIn('SDI In'), hdmiIn('HDMI In'), sdiIn('Ref In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 230, height: 180,
    },
  },
  // LVM-246W (24", 2x SDI in, SDI out, HDMI in/out)
  {
    match: ['tvlogic', 'lvm-246'],
    deviceTypeId: 'a361bec1-f781-4f47-9a79-a0c9050307fd',
    // Quelle: https://www.tvlogic.tv/new/M_Spec.asp?sidx=55
    template: {
      manufacturerUrl: 'https://www.tvlogic.tv/new/M_Spec.asp?sidx=55',
      name: 'TVLogic LVM-246W',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 240, height: 200,
    },
  },
  // LVM-171W (17", 2x SDI in, SDI out loop, HDMI in) — UNBELEGT (2026-09-27):
  // das Modell gab es (Handbuch bei Dritten), eine Herstellerseite nicht,
  // auch nicht im Archiv. Die Ports decken sich mit dem LVM-171A
  // (tvlogic.tv sidx=81), der zusaetzlich DVI, Composite und Ethernet hat —
  // aber ein anderes Modell ist.
  {
    match: ['tvlogic', 'lvm-171'],
    deviceTypeId: '925e8461-77be-4540-80f8-58b825494270',
    template: {
      name: 'TVLogic LVM-171W',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (Loop)')],
      width: 230, height: 180,
    },
  },
  // LVM-075A (7") — das einzige LVM-075 des Herstellers.
  {
    match: ['tvlogic', 'lvm-075'],
    deviceTypeId: 'eb21053a-3a43-4d36-99d1-d07beea487cf',
    // Quelle: https://www.tvlogic.tv/new/M_Spec.asp?sidx=75
    template: {
      manufacturerUrl: 'https://www.tvlogic.tv/new/M_Spec.asp?sidx=75',
      name: 'TVLogic LVM-075A',
      category: MON,
      inputs: [
        sdiIn('3G-SDI In A'),
        sdiIn('3G-SDI In B'),
        hdmiIn('HDMI In'),
        port('Component Y', 'Cinch/RCA'),
        port('Component Pb', 'Cinch/RCA'),
        port('Component Pr', 'Cinch/RCA'),
      ],
      outputs: [sdiOut('SDI Loop Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },
  // XVM-245W (24.5", 4K UHD — 2x 3G-SDI in, 3G-SDI out loop, 2x HDMI 2.0 in, DisplayPort in, Ref In)
  {
    match: ['tvlogic', 'xvm-245'],
    deviceTypeId: '4b72d161-b295-4f4f-b3ed-9ca1717154d9',
    // Quelle: https://www.tvlogic.tv/new/M_Spec.asp?sidx=22
    template: {
      manufacturerUrl: 'https://www.tvlogic.tv/new/M_Spec.asp?sidx=22',
      name: 'TVLogic XVM-245W',
      category: MON,
      inputs: [
        sdiIn('3G-SDI In 1'),
        sdiIn('3G-SDI In 2'),
        hdmiIn('HDMI In 1'),
        hdmiIn('HDMI In 2'),
        port('DisplayPort In', 'DisplayPort'),
        sdiIn('Ref In'),
      ],
      outputs: [sdiOut('3G-SDI Out (Loop)')],
      width: 240, height: 220,
    },
  },

  // ── Marshall Electronics ─────────────────────────────────────────────────

  // V-LCD241 (24.5", 2x SDI in/out, HDMI in) — UNBELEGT (2026-09-27): den
  // Namen ohne Suffix fuehrt Marshall nicht. Es gab V-LCD241MD (nur HDMI in/
  // out) und V-LCD241MD-3G (dazu 1x 3G-SDI in + Loop ueber das MD-3GE-
  // Modul) — zwei Varianten mit verschiedenen Anschluessen, keine passt zur
  // Portliste hier. Welche im Bestand steht, entscheidet das Typenschild.
  {
    match: ['marshall', 'v-lcd241'],
    deviceTypeId: '43423cbc-280b-42a6-99ba-c2b735da7913',
    template: {
      name: 'Marshall V-LCD241',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2')],
      width: 240, height: 200,
    },
  },
  // V-LCD173HR (17.3") — der einzige V-LCD173 des Herstellers (-DT ist die
  // Tischfassung). SDI, HDMI und Composite je mit Loop Out, Tally HD-15.
  {
    match: ['marshall', 'v-lcd173'],
    deviceTypeId: 'ca65efb5-0357-4aad-a9c7-8a21b49fd058',
    // Quelle: https://marshall-usa.com/monitors/model/V-LCD173HR.php
    template: {
      manufacturerUrl: 'https://marshall-usa.com/monitors/model/V-LCD173HR.php',
      name: 'Marshall V-LCD173HR',
      category: MON,
      inputs: [
        sdiIn('SDI In'),
        hdmiIn('HDMI In'),
        port('Composite In', 'BNC'),
        port('Audio In L', 'Cinch/RCA'),
        port('Audio In R', 'Cinch/RCA'),
        port('Tally (HD-15)', 'Custom'),
        port('USB-A (Firmware)', 'USB'),
      ],
      outputs: [sdiOut('SDI Loop Out'), hdmiOut('HDMI Loop Out'), port('Composite Loop Out', 'BNC')],
      width: 230, height: 180,
    },
  },
  // V-LCD70 (7", SDI in, SDI loop, HDMI in) — UNBELEGT (2026-09-27): sechs
  // Varianten (XHB-3GSDI, XP-HDI, XHB-HDIPT, MD, -AFHD, W-SH) mit sehr
  // verschiedenen Anschluessen; am naechsten liegt V-LCD70-AFHD. Ohne
  // Suffix nicht eindeutig.
  {
    match: ['marshall', 'v-lcd7'],
    deviceTypeId: '8629ac16-f864-4668-8af2-2c6335a0a089',
    template: {
      name: 'Marshall V-LCD70',
      category: MON,
      inputs: [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Loop Out')],
      width: 200, height: 140,
    },
  },
  // V-LCD56MD-3G (5.6") — HDMI mit Pass-Through, SDI ueber das MD-3GE-Modul
  // mit Loop. Der andere 5,6-Zoll-Marshall (V-LCD5.6-PRO) hat nur CVBS.
  {
    match: ['marshall', 'v-lcd56'],
    deviceTypeId: 'd10b5f2c-e09d-479c-9906-3853b5c0ad45',
    // Quelle: https://marshall-usa.com/discontinued/camera-top-monitors/V-LCD56MD.php
    template: {
      manufacturerUrl: 'https://marshall-usa.com/discontinued/camera-top-monitors/V-LCD56MD.php',
      name: 'Marshall V-LCD56MD-3G',
      category: MON,
      inputs: [sdiIn('3G-SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('3G-SDI Loop Out'), hdmiOut('HDMI Pass-Through')],
      width: 180, height: 120,
    },
  },

  // ── JVC Broadcast Monitors ───────────────────────────────────────────────

  // DT-V24G1 (24", 3G-SDI, 2013)
  // Inputs: 2× SDI (3G/HD/SD), 1× HDMI, Ref In (BNC), XLR L/R
  // Outputs: SDI Loop Out
  // Rentman: "JVC DT-V24G1 3G-SDI"
  {
    match: ['jvc', 'dt-v24g'],
    deviceTypeId: 'bfab2e39-b0b3-439a-8546-6fc3f813e9b5',
    // Quelle: https://www.jvc.com/jp/pro/monitor/lineup/dt-v24g1/spec/
    template: {
      manufacturerUrl: 'https://www.jvc.com/jp/pro/monitor/lineup/dt-v24g1/spec/',
      name: 'JVC DT-V24G1',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        hdmiIn('HDMI In'),
        sdiIn('Ref In (BNC)'),
        xlrIn('XLR L In'), xlrIn('XLR R In'),
      ],
      outputs: [sdiOut('SDI Loop Out')],
      width: 230, height: 200,
    },
  },

  // DT-V24L3D (24", HD-SDI 3D monitor, 2011)
  // Inputs: 2× HD/SD-SDI, 2× HDMI, XLR L/R
  // Outputs: 2× SDI Loop Out
  // Rentman: "JVC DT-V24L3D"
  {
    match: ['jvc', 'dt-v24l'],
    deviceTypeId: '307f04da-ff4f-438d-8144-2662bccdec61',
    template: {
      name: 'JVC DT-V24L3D',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        hdmiIn('HDMI In 1'), hdmiIn('HDMI In 2'),
        xlrIn('XLR L In'), xlrIn('XLR R In'),
      ],
      outputs: [sdiOut('SDI Loop Out 1'), sdiOut('SDI Loop Out 2')],
      width: 230, height: 200,
    },
  },

  // ── NEC MultiSync Large Format Displays ──────────────────────────────────

  // MultiSync P402 (40") / P461 (46") — HDMI, DisplayPort, DVI-D
  // Rentman: "NEC MultiSync P402", "NEC MultiSync P461"
  {
    match: ['nec', 'p402'],
    deviceTypeId: 'fb049046-2318-42e9-929c-2baacca958d9',
    template: {
      name: 'NEC MultiSync P402',
      category: MON,
      inputs: [
        hdmiIn('HDMI In'),
        port('DisplayPort In', 'DisplayPort'),
        port('DVI-D In', 'Custom'),
      ],
      outputs: [port('DisplayPort Out', 'DisplayPort')],
      width: 240, height: 160,
    },
  },
  {
    match: ['nec', 'p461'],
    deviceTypeId: '574a8e44-89d1-45a8-867f-8a0784151116',
    template: {
      name: 'NEC MultiSync P461',
      category: MON,
      inputs: [
        hdmiIn('HDMI In'),
        port('DisplayPort In', 'DisplayPort'),
        port('DVI-D In', 'Custom'),
      ],
      outputs: [port('DisplayPort Out', 'DisplayPort')],
      width: 240, height: 160,
    },
  },

  // MultiSync X401S (40") / X461S (46") — HDMI, DVI-D (×2), Component In
  // Rentman: "NEC MultiSync X401S", "NEC MultiSync X461S"
  {
    match: ['nec', 'x401'],
    deviceTypeId: '744f9954-fbc6-4362-b13b-9da86b45021d',
    // Quelle: https://sharp-displays.jp.sharp/dl/en/dp_manual/x401s.html
    template: {
      manufacturerUrl: 'https://sharp-displays.jp.sharp/dl/en/dp_manual/x401s.html',
      name: 'NEC MultiSync X401S',
      category: MON,
      inputs: [
        hdmiIn('HDMI In'),
        port('DVI-D In 1', 'Custom'),
        port('DVI-D In 2', 'Custom'),
        sdiIn('Component In (BNC)'),
      ],
      outputs: [],
      width: 240, height: 160,
    },
  },
  {
    match: ['nec', 'x461'],
    deviceTypeId: '19381105-1fcb-4e71-b9ab-998624709257',
    template: {
      name: 'NEC MultiSync X461S',
      category: MON,
      inputs: [
        hdmiIn('HDMI In'),
        port('DVI-D In 1', 'Custom'),
        port('DVI-D In 2', 'Custom'),
        sdiIn('Component In (BNC)'),
      ],
      outputs: [],
      width: 240, height: 160,
    },
  },
]

/** Flat list of all built-in monitor templates (seeded into the library). */
export const monitorTemplates: EquipmentTemplate[] = MONITOR_CATALOG.map(withTypeId)

/** Return a matching template for a given equipment name, or null. */
export const matchMonitorTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact name match first
  for (const entry of MONITOR_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Must contain at least one known brand keyword to avoid false positives
  const isBrandKnown =
    lower.includes('video assist') ||
    lower.includes('shogun') ||
    lower.includes('ninja') ||
    lower.includes('sumo') ||
    lower.includes('smallhd') ||
    lower.includes('small hd') ||
    lower.includes('tvlogic') ||
    lower.includes('tv logic') ||
    lower.includes('lvm-') ||
    lower.includes('lum-') ||
    lower.includes('xvm-') ||
    (lower.includes('marshall') && (lower.includes('v-lcd') || lower.includes('monitor'))) ||
    (lower.includes('jvc') && (lower.includes('dt-v') || lower.includes('monitor'))) ||
    lower.includes('nec multisync')
  if (!isBrandKnown) return null
  for (const entry of MONITOR_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
