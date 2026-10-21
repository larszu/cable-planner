import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Lang-Mietliste, Abschnitt „Image Processing" — Bildverarbeitung, Matrizen,
// Verteiler, Wandcontroller.
//
// Ohne gelesene Herstellerquelle uebersprungen:
//   Analog Way Vio 4K (Seite ohne Anschlussliste), Lightware MX2-48x48,
//   MX2-32x32, MX2-8x8-Audio-L (A&E-PDF 403), MX65x65, MX33x33
//   (Herstellerseiten ohne lesbare Spezifikation), IDK FDX-32x32-HDMI2.0,
//   IDK IMP-S41U, Ophit MSV 2, ATEN VS-194, Lindy 42345, Lindy HDMI2.0 4x2
//   Matrix, Apantac HDMI-DP-UHD, HDFury Vertex (nur Vertex²-Seite gefunden),
//   Panasonic PressIT TY-WPS1.
// Nicht aufgenommen (Zubehoer/Adapter/Bedienpulte/USV oder schon vorhanden):
//   Barco (alle), Lightware Taurus, APC, Logitech, Elgato, Loupedeck,
//   Analog Way RC400T/SB80-2, Club 3D-Adapter.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: Port['connectorType'], type: string): Port => ({
  id: '',
  name,
  type,
  connectorType,
})

const hdmi = (name: string) => port(name, 'HDMI', 'HDMI')
const sdi = (name: string) => port(name, 'BNC', 'SDI')
const eth = (name: string) => port(name, 'Ethernet/RJ45', 'Ethernet')
const n = <T,>(count: number, f: (i: number) => T) => Array.from({ length: count }, (_, i) => f(i + 1))

interface LangImageEntry {
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

export const LANG_IMAGE_CATALOG: LangImageEntry[] = [
  // Quelle: https://www.analogway.com/products/zenith-200
  {
    match: ['analogwayzenith200', 'zenith200'],
    deviceTypeId: '7c7febaf-2020-4266-87ea-aeace63547c2',
    template: {
      manufacturerUrl: 'https://www.analogway.com/products/zenith-200',
      name: 'Analog Way Zenith 200',
      category: 'Video Mixer',
      inputs: [
        ...n(8, (i) => hdmi(`HDMI 2.0 In ${i}`)),
        ...n(4, (i) => port(`DP 1.2 In ${i}`, 'DisplayPort', 'DisplayPort')),
        ...n(2, (i) => sdi(`12G-SDI In ${i}`)),
        ...n(2, (i) => hdmi(`HDMI 1.4 In ${i} (alt. 3G-SDI)`)),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN (Neutrik RJ45)'),
        port('USB Host', 'USB Type A', 'USB'),
        port('Line In (Dante-Karte)', 'Jack 3.5 mm TRS', 'Audio'),
        eth('Dante Primary'),
        eth('Dante Secondary'),
      ],
      outputs: [
        ...n(6, (i) => hdmi(`HDMI 2.0 Out ${i}`)),
        ...n(6, (i) => sdi(`12G-SDI Out ${i}`)),
        ...n(4, (i) => port(`SFP+ Out ${i + 2}`, 'SFP+', 'SDI')),
        hdmi('Multiviewer HDMI 1.4'),
        sdi('Multiviewer 3G-SDI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
        port('Line Out (Dante-Karte)', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 3,
      notes: '3 HE · mit Dante-Option (32x32 @ 48 kHz) · SDI je Ausgang gespiegelt zu HDMI, SFP+ an Ausgang 3–6 · Netzteil laut Seite nicht angegeben',
      width: 280,
      height: 540,
    },
  },

  // Quelle: https://www.analogway.com/products/eikos-4k
  {
    match: ['analogwayeikos4k', 'eikos4k'],
    deviceTypeId: '6f5f005f-8405-4835-8488-ebe44762c093',
    template: {
      manufacturerUrl: 'https://www.analogway.com/products/eikos-4k',
      name: 'Analog Way Eikos 4K',
      category: 'Video Mixer',
      inputs: [
        ...n(4, (i) => hdmi(`HDMI 2.0 In ${i}`)),
        ...n(2, (i) => port(`DP 1.2 In ${i}`, 'DisplayPort', 'DisplayPort')),
        ...n(2, (i) => sdi(`12G-SDI In ${i}`)),
        ...n(2, (i) => hdmi(`HDMI 1.4 In ${i} (alt. 3G-SDI)`)),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN (Neutrik RJ45)'),
        port('USB Host', 'USB Type A', 'USB'),
        port('Line In (Dante-Option)', 'Jack 3.5 mm TRS', 'Audio'),
        eth('Dante Primary (Option)'),
        eth('Dante Secondary (Option)'),
      ],
      outputs: [
        ...n(2, (i) => hdmi(`HDMI 2.0 Out ${i}`)),
        ...n(2, (i) => sdi(`12G-SDI Out ${i} (gespiegelt)`)),
        hdmi('Multiviewer HDMI 1.4'),
        sdi('Multiviewer 3G-SDI'),
        port('Genlock Loop', 'BNC', 'Genlock'),
        port('Line Out (Dante-Option)', 'Jack 3.5 mm TRS', 'Audio'),
      ],
      isRackDevice: true,
      rackUnits: 2,
      notes: '2 HE · Dante-Ports und Line I/O nur mit optionaler Audiokarte · Netzteil laut Seite nicht angegeben',
      width: 280,
      height: 440,
    },
  },

  // Quelle: https://proav.roland.com/global/products/vc-100uhd/specifications/
  {
    match: ['rolandvc100uhd', 'vc100uhd', 'vc-100uhd'],
    deviceTypeId: 'e2180264-5d3b-4ffa-8a8a-9c481bb693ff',
    template: {
      manufacturerUrl: 'https://proav.roland.com/global/products/vc-100uhd/specifications/',
      name: 'Roland VC-100UHD',
      category: 'Converter',
      inputs: [
        sdi('12G-SDI In'),
        hdmi('HDMI 2.0 In'),
        port('Reference In', 'BNC', 'Genlock'),
        port('Audio In (DB-25, symm.)', 'DB25', 'Audio'),
        port('Line In L', 'Cinch/RCA', 'Audio'),
        port('Line In R', 'Cinch/RCA', 'Audio'),
        eth('Remote (LAN)'),
        port('USB Host (Stick)', 'USB Type A', 'USB'),
        port('DC In 24 V', 'DC Barrel', 'Power'),
      ],
      outputs: [
        sdi('12G-SDI Out'),
        sdi('12G-SDI Thru'),
        hdmi('HDMI 2.0 Out'),
        port('Reference Thru/Out', 'BNC', 'Genlock'),
        port('Audio Out (DB-25, symm.)', 'DB25', 'Audio'),
        port('Line Out L', 'Cinch/RCA', 'Audio'),
        port('Line Out R', 'Cinch/RCA', 'Audio'),
        port('USB Streaming (UVC)', 'USB 3 Type B', 'USB'),
      ],
      isRackDevice: true,
      rackUnits: 1,
      notes: '½ 19" · 4K-Scaler · externes Netzteil 24 V DC',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.datapath.co.uk/datapath-products/video-wall-controllers/datapath-fx4-hdr/
  {
    match: ['datapathfx4hdr', 'fx4hdr', 'fx4-hdr'],
    deviceTypeId: '19c49c0a-a8b9-4e30-a2be-bf9ee7fcd31b',
    template: {
      manufacturerUrl: 'https://www.datapath.co.uk/datapath-products/video-wall-controllers/datapath-fx4-hdr/',
      name: 'Datapath Fx4-HDR',
      category: 'Video Mixer',
      inputs: [
        hdmi('HDMI 2.0 In'),
        hdmi('HDMI 1.4 In 1'),
        hdmi('HDMI 1.4 In 2'),
        port('Genlock In', 'BNC', 'Genlock'),
        eth('LAN 1'),
        eth('LAN 2 (Loop)'),
        port('USB 2.0', 'USB Type B', 'USB'),
        port('Mains In', 'IEC 230V', 'Power'),
      ],
      outputs: [
        ...n(4, (i) => hdmi(`HDMI 1.4 Out ${i}`)),
        hdmi('HDMI 2.0 Loop Out'),
      ],
      isRackDevice: false,
      notes: 'Display-Wall-Controller · 100–240 V, 35 W',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://ruassets.aten.com/product/spec_sheet/CS1822-CS1824-2-4-Port-USB-3.0-4K-HDMI-KVMP™-Switch-Datasheet-tc.pdf
  {
    match: ['atencs1824', 'cs1824'],
    deviceTypeId: '38992581-234c-47c6-aeab-275f866ce1c6',
    template: {
      manufacturerUrl: 'https://ruassets.aten.com/product/spec_sheet/CS1822-CS1824-2-4-Port-USB-3.0-4K-HDMI-KVMP™-Switch-Datasheet-tc.pdf',
      name: 'ATEN CS1824',
      category: 'Video Router',
      inputs: [
        ...n(4, (i) => hdmi(`PC ${i} HDMI`)),
        ...n(4, (i) => port(`PC ${i} USB 3.1`, 'USB 3 Type B', 'USB')),
        ...n(4, (i) => port(`PC ${i} Audio`, 'Jack 3.5 mm', 'Audio')),
        port('RS-232', 'RJ11', 'RS-232'),
        port('DC In', 'DC Barrel', 'Power'),
      ],
      outputs: [
        hdmi('Konsole HDMI'),
        port('Konsole USB (Tastatur)', 'USB Type A', 'USB'),
        port('Konsole USB (Maus)', 'USB Type A', 'USB'),
        port('Konsole Audio (vorn)', 'Jack 3.5 mm', 'Audio'),
        port('Konsole Audio (hinten)', 'Jack 3.5 mm', 'Audio'),
        port('USB 3.1 Hub (vorn)', 'USB 3 Type A', 'USB'),
        port('USB 3.1 Hub (hinten)', 'USB 3 Type A', 'USB'),
      ],
      isRackDevice: false,
      notes: '4-Port-KVMP · 4096×2160@60',
      width: 280,
      height: 400,
    },
  },

  // Quelle: https://www.idkav.com/products/product_detail/?model=VAC-S18U
  {
    match: ['idkvacs18u', 'vacs18u', 'vac-s18u'],
    deviceTypeId: '3680e652-c6d6-42c5-a149-4291152cef79',
    template: {
      manufacturerUrl: 'https://www.idkav.com/products/product_detail/?model=VAC-S18U',
      name: 'IDK VAC-S18U',
      category: 'Converter',
      inputs: [hdmi('HDMI In'), eth('LAN'), port('DC In 12 V', 'DC Barrel', 'Power')],
      outputs: [...n(8, (i) => hdmi(`HDMI Out ${i}`)), port('Audio Out (unsymm. L/R)', 'Phoenix/Euroblock', 'Audio')],
      isRackDevice: true,
      rackUnits: 1,
      notes: '1:8-Verteiler 4K60 4:4:4 · ½ 19", 1 HE · externes Netzteil 12 V · DC-Buchse laut Seite nicht benannt',
      width: 280,
      height: 300,
    },
  },

  // Quelle: https://www.idkav.com/products/product_detail/?model=VAC-S16U
  {
    match: ['idkvacs16u', 'vacs16u', 'vac-s16u'],
    deviceTypeId: '0510e7bf-85d1-4361-b25e-0fe8317cc293',
    template: {
      manufacturerUrl: 'https://www.idkav.com/products/product_detail/?model=VAC-S16U',
      name: 'IDK VAC-S16U',
      category: 'Converter',
      inputs: [hdmi('HDMI In'), eth('LAN'), port('DC In 12 V', 'DC Barrel', 'Power')],
      outputs: [...n(6, (i) => hdmi(`HDMI Out ${i}`)), port('Audio Out (unsymm. L/R)', 'Phoenix/Euroblock', 'Audio')],
      isRackDevice: false,
      notes: '1:6-Verteiler 4K60 4:4:4 · externes Netzteil 12 V · DC-Buchse laut Seite nicht benannt',
      width: 280,
      height: 260,
    },
  },

  // Quelle: https://www.idkav.com/products/product_detail/?model=VAC-S14U
  {
    match: ['idkvacs14u', 'vacs14u', 'vac-s14u'],
    deviceTypeId: '64ff1f68-b53b-47e1-9dd2-ac3e075f29a4',
    template: {
      manufacturerUrl: 'https://www.idkav.com/products/product_detail/?model=VAC-S14U',
      name: 'IDK VAC-S14U',
      category: 'Converter',
      inputs: [hdmi('HDMI In'), eth('LAN'), port('DC In 12 V', 'DC Barrel', 'Power')],
      outputs: [...n(4, (i) => hdmi(`HDMI Out ${i}`)), port('Audio Out (unsymm. L/R)', 'Phoenix/Euroblock', 'Audio')],
      isRackDevice: false,
      notes: '1:4-Verteiler 4K60 4:4:4 · OUT1 mit Down-Converter · externes Netzteil 12 V',
      width: 280,
      height: 220,
    },
  },

  // Quelle: https://gefen.com/products/ultra-hd-600-mhz-1-8-splitter-for-hdmi-w-hdr-ext-uhd600-18
  {
    match: ['gefenextuhd60018', 'extuhd60018', 'ext-uhd600-18'],
    deviceTypeId: 'fb1d4f5e-2f5e-40f5-80d9-c97ce3da078c',
    template: {
      manufacturerUrl: 'https://gefen.com/products/ultra-hd-600-mhz-1-8-splitter-for-hdmi-w-hdr-ext-uhd600-18',
      name: 'Gefen EXT-UHD600-18',
      category: 'Converter',
      inputs: [hdmi('HDMI In'), port('USB (Service)', 'USB Mini-B', 'USB'), port('DC In 5 V', 'DC Barrel', 'Power')],
      outputs: n(8, (i) => hdmi(`HDMI Out ${i}`)),
      isRackDevice: true,
      rackUnits: 1,
      notes: '1:8-Verteiler 4K60 HDR · Out 1+2 mit Long Reach Power · 5 V DC verriegelnd',
      width: 280,
      height: 280,
    },
  },

  // Quelle: https://gefen.com/products/ultra-hd-600-mhz-1-4-splitter-for-hdmi-w-hdr-ext-uhd600-14
  {
    match: ['gefenextuhd60014', 'extuhd60014', 'ext-uhd600-14'],
    deviceTypeId: '08185c01-0faa-46b7-abee-3a2b3fa5d1e6',
    template: {
      manufacturerUrl: 'https://gefen.com/products/ultra-hd-600-mhz-1-4-splitter-for-hdmi-w-hdr-ext-uhd600-14',
      name: 'Gefen EXT-UHD600-14',
      category: 'Converter',
      inputs: [hdmi('HDMI In'), port('USB (Service)', 'USB Mini-B', 'USB'), port('DC In 5 V', 'DC Barrel', 'Power')],
      outputs: n(4, (i) => hdmi(`HDMI Out ${i}`)),
      isRackDevice: false,
      notes: '1:4-Verteiler 4K60 HDR · Out 1+2 mit Long Reach Power · Rackmontage mit EXT-RACK-1U-GRY',
      width: 280,
      height: 200,
    },
  },
  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-24x24-HDMI20-R_AE_Specification.pdf
  {
    match: ['lightwaremx224x24hdmi20r', 'mx224x24hdmi20r', 'mx2-24x24'],
    deviceTypeId: 'd1ff1f5c-356c-40da-8000-27688926e7e1',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-24x24-HDMI20-R_AE_Specification.pdf',
      name: 'Lightware MX2-24x24-HDMI20-R',
      category: 'Video Router',
      inputs: [
        ...n(24, (i) => hdmi(`HDMI 2.0 In ${i}`)),
        eth('LAN (etherCON)'),
        port('RS-232', 'DB9', 'RS-232'),
        port('USB (LDC)', 'USB Mini-B', 'USB'),
        port('Mains In PSU 1', 'PowerCON', 'Power'),
        port('Mains In PSU 2', 'PowerCON', 'Power'),
      ],
      outputs: n(24, (i) => hdmi(`HDMI 2.0 Out ${i}`)),
      isRackDevice: true,
      rackUnits: 4,
      notes: '4 HE · redundante Netzteile (2x powerCON) · 100–240 V AC',
      width: 280,
      height: 700,
    },
  },

  // Quelle: https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-16x16-HDMI20-R_AE_Specification.pdf
  {
    match: ['lightwaremx216x16hdmi20r', 'mx216x16hdmi20r', 'mx2-16x16'],
    deviceTypeId: '1b6664b5-a57a-4a2d-a83e-ca40a1efb635',
    template: {
      manufacturerUrl: 'https://assets.prod.pim.lightware.com/assets/File-Downloads/Technical-Documents/A%26E-Specifications/MX2-16x16-HDMI20-R_AE_Specification.pdf',
      name: 'Lightware MX2-16x16-HDMI20-R',
      category: 'Video Router',
      inputs: [
        ...n(16, (i) => hdmi(`HDMI 2.0 In ${i}`)),
        eth('LAN'),
        port('RS-232', 'DB9', 'RS-232'),
        port('USB (LDC)', 'USB Mini-B', 'USB'),
        port('Mains In PSU 1', 'PowerCON', 'Power'),
        port('Mains In PSU 2', 'PowerCON', 'Power'),
      ],
      outputs: n(16, (i) => hdmi(`HDMI 2.0 Out ${i}`)),
      isRackDevice: true,
      notes: 'redundante Netzteile (2x powerCON) · 47/83 W · Höhe laut Blatt nicht angegeben',
      width: 280,
      height: 540,
    },
  },
]
