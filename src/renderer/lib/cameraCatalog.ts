import type { EquipmentTemplate, Port } from '../types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Kamera-Katalog (Sony PXW/PMW/Cinema-Line, Blackmagic URSA/Pocket/Studio,
// Canon Cinema EOS) — verbreitete Broadcast-/Event-Rental-Modelle.
//
// Belege gegen die offiziellen Hersteller-Produktseiten (pro.sony,
// blackmagicdesign.com, usa.canon.com; Recherche 2026-09, Quellen-URL je
// Eintrag). Sony- und Canon-Adressen sind Erstpartei-Hersteller-Seiten, per
// Websuche gegen die reale Domäne geprüft; Blackmagic zusätzlich per curl
// gegen die Catch-all-Fallbackseite abgegrenzt. Die 2008 eingestellte Sony
// PMW-EX3 hat keine Live-Produktseite mehr und bleibt ohne Beleg.

const port = (name: string, connectorType: Port['connectorType'] = 'BNC'): Port => ({
  id: '',
  name,
  type: connectorType,
  connectorType,
})

const sdiOut  = (n: string) => port(n, 'BNC')
const sdiIn   = (n: string) => port(n, 'BNC')
const hdmiOut = (n: string) => port(n, 'HDMI')
const hdmiIn  = (n: string) => port(n, 'HDMI')
const xlr     = (n: string) => port(n, 'XLR')
const eth     = (n = 'Ethernet') => port(n, 'Ethernet/RJ45')

const CAM = 'Cameras'

interface CameraEntry {
  /** Stabile Geraetetyp-Identitaet (GDTF/DIN-SPEC-15800-analog: FixtureTypeID).
   *  Opak + versionsstabil — der maßgebliche Schluessel fuer den Import, nicht
   *  der Modellname. Cross-App identisch: die gleichen GUIDs stehen in
   *  multicam-planner src/data/cameras.ts, sodass eine ueber die `.avplan`/
   *  camera-list uebergebene Kamera hier autoritativ (nicht per Namensraten)
   *  auf ihr echtes Datenblatt aufgeloest wird. */
  deviceTypeId: string
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: CameraEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const CAMERA_CATALOG: CameraEntry[] = [

  // ── Sony CineAlta F-Series ────────────────────────────────────────────────

  // PMW-F55 (Super35 4K Global Shutter CineAlta, 2013)
  // I/O: 2x 3G-SDI Out, HDMI Out, 2x XLR In, TC In/Out (BNC), Ref In, Ethernet
  // Match: exact Rentman name "Sony PMW-F55"
  {
    match: ['pmw-f55'],
    deviceTypeId: 'eb02ca7e-856c-40ab-9a73-d1e98110f003',
    // Quelle: https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f55
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f55',
      name: 'Sony PMW-F55',
      category: CAM,
      inputs: [
        sdiIn('Ref In (BNC)'),
        sdiIn('TC In (BNC)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('SDI Out 1 (3G)'),
        sdiOut('SDI Out 2 (3G)'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out (BNC)'),
      ],
      width: 240, height: 220,
    },
  },

  // PMW-F5 (Super35 4K Rolling Shutter CineAlta, 2013)
  // Identical I/O panel to F55, difference is internal (global vs rolling shutter)
  // Match: exact Rentman name "Sony PMW-F5"
  {
    match: ['pmw-f5'],
    deviceTypeId: 'f54cdfa3-1708-4b05-9179-4a8769c0b891',
    // Quelle: https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f5
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/digital-cinema-cameras/pmw-f5',
      name: 'Sony PMW-F5',
      category: CAM,
      inputs: [
        sdiIn('Ref In (BNC)'),
        sdiIn('TC In (BNC)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('SDI Out 1 (3G)'),
        sdiOut('SDI Out 2 (3G)'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out (BNC)'),
      ],
      width: 240, height: 220,
    },
  },

  // ── Sony Cinema Line / XDCAM ─────────────────────────────────────────────

  // PXW-FX9 (Full Frame, 6K sensor, 2019)
  // Outputs: 1x 3G-SDI, 1x HDMI; Audio: 2x XLR; Control: TC In/Out, Genlock, Ethernet
  {
    match: ['pxw-fx9'],
    deviceTypeId: '05d88e97-2f3d-4b16-868c-f13f202754c5',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/pxw-fx9
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-fx9',
      name: 'Sony PXW-FX9',
      category: CAM,
      inputs: [
        sdiIn('TC In (BNC)'),
        sdiIn('Genlock In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out (BNC)'),
      ],
      width: 240, height: 220,
    },
  },

  // PXW-FS7 Mk II (Super35, 2016)
  // Outputs: 1x 3G-SDI, 1x HDMI; Audio: 2x XLR; TC In/Out
  {
    match: ['pxw-fs7'],
    deviceTypeId: 'ff69e6b9-7a72-4eb2-ba53-df17fd8bfdf7',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/pxw-fs7m2
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-fs7m2',
      name: 'Sony PXW-FS7 Mk II',
      category: CAM,
      inputs: [
        sdiIn('TC In (BNC)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out (BNC)'),
      ],
      width: 240, height: 200,
    },
  },

  // PXW-Z280 (1/2", 3-sensor 4K, 2018)
  // Output: 1x SDI, 1x HDMI; Audio: 2x XLR; Genlock, TC In
  {
    match: ['pxw-z280'],
    deviceTypeId: 'd82a344a-ba04-4b38-99da-fb7aa1df9a39',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/pxw-z280
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-z280',
      name: 'Sony PXW-Z280',
      category: CAM,
      inputs: [
        sdiIn('Genlock In'),
        sdiIn('TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 220, height: 180,
    },
  },

  // PXW-Z90 (1" 4K run-and-gun, 2018)
  // Output: 1x SDI, 1x HDMI; Audio: 1x XLR
  {
    match: ['pxw-z90'],
    deviceTypeId: '3257348e-003e-4f17-9231-464248c3a72d',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/pxw-z90
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/pxw-z90',
      name: 'Sony PXW-Z90',
      category: CAM,
      inputs:  [xlr('XLR In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 160,
    },
  },

  // PMW-EX3 (Super35, classic rental workhorse)
  // Output: 1x SDI, 1x HDMI; Audio: 2x XLR; TC In/Out
  {
    match: ['pmw-ex3'],
    deviceTypeId: '49e01b95-3c47-4e2d-b871-134f12fd305d',
    template: {
      name: 'Sony PMW-EX3',
      category: CAM,
      inputs: [
        sdiIn('TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out'),
      ],
      width: 220, height: 180,
    },
  },

  // FX6 (Full Frame, 2020) – HDMI only, no built-in SDI
  {
    match: ['fx6', 'sony'],
    deviceTypeId: 'a823f2ff-3be9-4c45-af4e-bd4f6b13f7d7',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/ilme-fx6
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/ilme-fx6',
      name: 'Sony FX6',
      category: CAM,
      inputs: [
        sdiIn('TC In/Sync'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('USB-C'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
      ],
      width: 200, height: 160,
    },
  },

  // FX3 (Full Frame compact, 2021)
  {
    match: ['fx3', 'sony'],
    deviceTypeId: '3cd5dd2d-7d51-4af9-ad59-25860aa4baa2',
    // Quelle: https://pro.sony/ue_US/products/handheld-camcorders/ilme-fx3
    template: {
      manufacturerUrl: 'https://pro.sony/ue_US/products/handheld-camcorders/ilme-fx3',
      name: 'Sony FX3',
      category: CAM,
      inputs:  [xlr('XLR Ch1 In'), xlr('XLR Ch2 In')],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 140,
    },
  },

  // ── Blackmagic Cameras ───────────────────────────────────────────────────

  // ── Blackmagic: aus cameraBodyCatalog.ts uebernommen (2026-11) ───────────
  // Diese neun Bodies standen im erzeugten Katalog mit `portsUnknown` und
  // 0 Ein-/0 Ausgaengen. Belegt Buchse fuer Buchse gegen die offiziellen
  // Tech-Specs-Seiten (Abschnitt „Connections"), abgerufen 2026-11-11.
  // deviceTypeId und Name bleiben unveraendert, damit `katalog:uebernahme`
  // sie dort weglaesst und gespeicherte Projekte weiter aufloesen.
  // Ref und Timecode teilen sich bei PYXIS und den URSA-Modellen EINE BNC
  // (Blackmagic: „BNC timecode input"; Ambient Timecode Cable Guide: „shared
  // BNC connector for timecode and Trilevel Sync") — deshalb ein Port.
  // Gefuehrt werden die Buchsen, die man verkabelt (Video, Audio, Ref/TC,
  // Netz, Objektiv-Steuerung); Speicher-/Update-USB-C nur, wo es zugleich
  // Kamera-Steuerung oder Sucher ist.

  // URSA Broadcast G2 — 12G-SDI In (Program Return), 12G-SDI Out + Monitor
  // Out, 2x XLR (Mic/Line/AES), Ref/TC In, 12-pin Hirose Objektiv, LANC,
  // Kopfhoerer 3.5 mm (Talkback-Headset)
  {
    match: ['ursa broadcast', 'g2'],
    deviceTypeId: '2b3a40b1-55a3-5e5d-b65c-5b7bd35c69f1',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicursabroadcast/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursabroadcast/techspecs',
      name: 'Blackmagic URSA Broadcast G2',
      category: CAM,
      subtitle: 'broadcast',
      notes: 'BMD 6K (23.1×12.99) · B4 mount · 6K/4K/HD · B4 native, EF/PL via adapter. Broadcast camera with cinema sensor.',
      inputs: [
        sdiIn('12G-SDI In (Return)'),
        sdiIn('Ref/TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        port('Lens 12-pin', 'Custom'),
        port('LANC', 'Jack 2.5 mm TRS'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        sdiOut('12G-SDI Monitor Out'),
        port('Headphones', 'Jack 3.5 mm TRRS'),
      ],
      width: 240, height: 240,
    },
  },

  // Studio Camera 6K Pro — 12G-SDI In (Return), 12G-SDI Out, HDMI Out,
  // 2x XLR, 3.5 mm Stereo/TC In, 5-pin XLR Talkback, 10G Ethernet
  {
    match: ['studio camera', '6k', 'pro'],
    deviceTypeId: 'f44f3f5e-6dde-5579-ab72-0c84c04470c2',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicstudiocamera/techspecs/W-CST-11
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera/techspecs/W-CST-11',
      name: 'Blackmagic Studio Camera 6K Pro',
      category: CAM,
      subtitle: 'broadcast',
      notes: 'Super 35 (24.6×13.8) · EF mount · 6K/4K/HD',
      inputs: [
        sdiIn('12G-SDI In (Return)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        port('Stereo/TC In', 'Jack 3.5 mm TRS'),
        eth('10G Ethernet'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        hdmiOut('HDMI Out'),
        port('Talkback Headset', 'XLR'),
        port('Headphones', 'Jack 3.5 mm TRRS'),
      ],
      width: 240, height: 240,
    },
  },

  // Micro Studio Camera 4K G2 — 12G-SDI In/Out als Micro-BNC, HDMI Out,
  // 3.5 mm Stereo/TC In
  {
    match: ['micro studio camera', '4k'],
    deviceTypeId: 'b098dca6-ba66-5fe4-88bf-63199fc3c574',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicmicrostudiocamera/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicmicrostudiocamera/techspecs',
      name: 'Blackmagic Micro Studio Camera 4K G2',
      category: CAM,
      subtitle: 'broadcast',
      notes: 'Micro Four Thirds · MFT mount · 4K/HD · Micro form factor, MFT native, EF via adapter or EF Speedbooster',
      inputs: [
        port('12G-SDI In (Return)', 'Micro-BNC'),
        port('Stereo/TC In', 'Jack 3.5 mm TRS'),
      ],
      outputs: [
        port('12G-SDI Out', 'Micro-BNC'),
        hdmiOut('HDMI Out'),
      ],
      width: 220, height: 160,
    },
  },

  // Pocket Cinema Camera 6K Pro — HDMI Out, 2x Mini-XLR, 3.5 mm Stereo In
  // (alle Audio-Eingaenge auch TC), Kopfhoerer
  {
    match: ['pocket cinema', '6k', 'pro'],
    deviceTypeId: '061f2b91-763f-5a77-8ff6-280c35179329',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera/techspecs',
      name: 'Blackmagic Pocket Cinema 6K Pro',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Super 35 (24.6×13.8) · EF mount · 6K/4K/HD',
      inputs: [
        port('Mini-XLR Ch1 In', 'Mini-XLR'),
        port('Mini-XLR Ch2 In', 'Mini-XLR'),
        port('Stereo In', 'Jack 3.5 mm TRS'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 200, height: 160,
    },
  },

  // Cinema Camera 6K — gleiche Anschluesse wie die Pocket 6K Pro
  {
    match: ['blackmagic cinema camera', '6k'],
    deviceTypeId: '9f9b1e0b-7994-5e96-9132-d79e75d7a8a4',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs',
      name: 'Blackmagic Cinema Camera 6K',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Full Frame (36×24) · L mount · 6K/4K/HD · Full-frame, L-mount native; EF/PL/Nikon F via adapter',
      inputs: [
        port('Mini-XLR Ch1 In', 'Mini-XLR'),
        port('Mini-XLR Ch2 In', 'Mini-XLR'),
        port('Stereo In', 'Jack 3.5 mm TRS'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 200, height: 160,
    },
  },

  // Cinema Camera 6K L — die L-Mount-Kamera, die Blackmagic heute schlicht
  // „Cinema Camera 6K" nennt; die Quelle fuehrt sie unter zweitem Namen.
  // Dieselbe Tech-Specs-Seite, dieselben Buchsen.
  {
    match: ['cinema camera', '6k l'],
    deviceTypeId: 'cf44e80a-a65b-5ef1-8765-aa618181d4be',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagiccinemacamera/techspecs',
      name: 'Blackmagic Cinema Camera 6K L',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Full Frame (36×24) · L mount · 6K/4K',
      inputs: [
        port('Mini-XLR Ch1 In', 'Mini-XLR'),
        port('Mini-XLR Ch2 In', 'Mini-XLR'),
        port('Stereo In', 'Jack 3.5 mm TRS'),
      ],
      outputs: [
        hdmiOut('HDMI Out'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 200, height: 160,
    },
  },

  // PYXIS 6K — 12G-SDI Out, Sucher-USB-C (Video/Power/Daten), Mini-XLR,
  // 3.5 mm Stereo In, eine BNC fuer Ref (Tri-Sync/BB) ODER TC, 1G Ethernet
  {
    match: ['pyxis', '6k'],
    deviceTypeId: '4abf7ac1-0b07-5989-a224-cc92c0ef1505',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs',
      name: 'Blackmagic PYXIS 6K',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Full Frame (36×24) · L mount · 6K/4K/HD · Full-frame box-style, L-mount native',
      inputs: [
        sdiIn('Ref/TC In'),
        port('Mini-XLR In', 'Mini-XLR'),
        port('Stereo In', 'Jack 3.5 mm TRS'),
        eth('Ethernet 1G'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        port('Viewfinder USB-C', 'USB-C'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 220, height: 200,
    },
  },

  // PYXIS 12K — wie PYXIS 6K, aber 10G Ethernet
  {
    match: ['pyxis', '12k'],
    deviceTypeId: '7e8134ec-792a-55e6-847c-1ed67801f942',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpyxis/techspecs',
      name: 'Blackmagic PYXIS 12K',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Full Frame (36×24) · L mount · 12K/8K/4K',
      inputs: [
        sdiIn('Ref/TC In'),
        port('Mini-XLR In', 'Mini-XLR'),
        port('Stereo In', 'Jack 3.5 mm TRS'),
        eth('Ethernet 10G'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        port('Viewfinder USB-C', 'USB-C'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 220, height: 200,
    },
  },

  // URSA Cine 12K LF — 2x 12G-SDI Out, 2x XLR (Mic/Line/AES), Ref/TC In,
  // Sucher-USB-C + 2x USB-C Monitor, 7-pin Lemo EXT, 3-pin Fischer RS,
  // 10G Ethernet, Kopfhoerer
  {
    match: ['ursa cine', '12k'],
    deviceTypeId: '8034b39a-46c9-52e8-959c-4d50e10ac229',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicursacine
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursacine',
      name: 'Blackmagic URSA Cine 12K LF',
      category: CAM,
      subtitle: 'cinema',
      notes: 'Full Frame (36×24) · PL mount · 12K/8K/4K · FF 36×24, RGBW-Sensor',
      inputs: [
        sdiIn('Ref/TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet 10G'),
      ],
      outputs: [
        sdiOut('12G-SDI Out 1'),
        sdiOut('12G-SDI Out 2'),
        port('Viewfinder USB-C', 'USB-C'),
        port('Monitor USB-C 1', 'USB-C'),
        port('Monitor USB-C 2', 'USB-C'),
        port('EXT 7-pin Lemo', 'Custom'),
        port('RS 3-pin Fischer', 'Custom'),
        port('Headphones', 'Jack 3.5 mm TRS'),
      ],
      width: 240, height: 260,
    },
  },

  // URSA Mini Pro 12K (2020)
  // Output: 12G-SDI Out, HDMI Out; Audio: 2x XLR built-in (+2 via shoulder);
  // Control: Ref In, USB-C
  {
    match: ['ursa mini pro', '12k'],
    deviceTypeId: '1b94e2d9-f987-4b76-8827-f555d88a2e10',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicursa
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursa',
      name: 'Blackmagic URSA Mini Pro 12K',
      category: CAM,
      inputs: [
        sdiIn('Ref In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },

  // URSA Mini Pro 4.6K G2 (2019)
  {
    match: ['ursa mini pro', '4.6k'],
    deviceTypeId: '841e8039-0e83-4734-904f-bf4ffcdb8882',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicursa
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursa',
      name: 'Blackmagic URSA Mini Pro 4.6K G2',
      category: CAM,
      inputs: [
        sdiIn('Ref In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },

  // URSA Mini Pro G2 (generic match when no sensor-size string present)
  {
    match: ['ursa mini pro'],
    deviceTypeId: '26557b2a-6df5-449c-bcef-29a24e4a811e',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicursa
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicursa',
      name: 'Blackmagic URSA Mini Pro',
      category: CAM,
      inputs: [
        sdiIn('Ref In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 200,
    },
  },

  // Pocket Cinema Camera 6K G2 (2020) – HDMI only, no SDI
  {
    match: ['pocket cinema', '6k'],
    deviceTypeId: 'd073d39d-9d61-492c-8022-93676460c668',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera',
      name: 'Blackmagic Pocket Cinema Camera 6K G2',
      category: CAM,
      inputs:  [],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 120,
    },
  },

  // Pocket Cinema Camera 4K (2018)
  {
    match: ['pocket cinema', '4k'],
    deviceTypeId: 'ea3ea3d8-3a1c-4087-ab03-1ce394ec1ea5',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicpocketcinemacamera',
      name: 'Blackmagic Pocket Cinema Camera 4K',
      category: CAM,
      inputs:  [],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 120,
    },
  },

  // Studio Camera 4K Pro G2 (2022)
  // Full broadcast camera: 12G-SDI In (program return), 12G-SDI Out (main),
  // HDMI In, HDMI Out, 2x XLR, Ref In, Ethernet, Tally
  {
    match: ['studio camera', '4k', 'pro'],
    deviceTypeId: 'ca069b86-a1ce-438e-a390-28c3445254c0',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicstudiocamera
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera',
      name: 'Blackmagic Studio Camera 4K Pro G2',
      category: CAM,
      inputs: [
        sdiIn('12G-SDI In (Return)'),
        hdmiIn('HDMI In (Return)'),
        sdiIn('Ref In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('12G-SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 240, height: 220,
    },
  },

  // Studio Camera 4K Plus G2 (2022) – similar but no Ethernet or Ref
  {
    match: ['studio camera', '4k', 'plus'],
    deviceTypeId: '57621414-690f-4cd4-b43c-0cd7ccca6acf',
    // Quelle: https://www.blackmagicdesign.com/products/blackmagicstudiocamera
    template: {
      manufacturerUrl: 'https://www.blackmagicdesign.com/products/blackmagicstudiocamera',
      name: 'Blackmagic Studio Camera 4K Plus G2',
      category: CAM,
      inputs: [
        sdiIn('3G-SDI In (Return)'),
        hdmiIn('HDMI In (Return)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('3G-SDI Out'),
        hdmiOut('HDMI Out'),
      ],
      width: 230, height: 200,
    },
  },

  // ── Canon Cinema EOS ─────────────────────────────────────────────────────

  // EOS C500 Mark II (Full Frame 6K, 2019)
  // 2x 3G-SDI Out (or 12G dual link), HDMI Out, 2x XLR, TC In/Out, Ethernet
  {
    match: ['eos c500', 'mark ii'],
    deviceTypeId: '87fc07c8-7327-466d-9fd1-eac259af154e',
    // Quelle: https://www.usa.canon.com/shop/p/eos-c500-mark-ii
    template: {
      manufacturerUrl: 'https://www.usa.canon.com/shop/p/eos-c500-mark-ii',
      name: 'Canon EOS C500 Mark II',
      category: CAM,
      inputs: [
        sdiIn('TC In (BNC)'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out (BNC)'),
      ],
      width: 240, height: 220,
    },
  },

  // EOS C300 Mark III (Super35 6K, 2020)
  // 2x 3G-SDI Out, HDMI Out, 2x XLR, TC In/Out, Ethernet
  {
    match: ['eos c300', 'mark iii'],
    deviceTypeId: 'bfdc4077-32b8-4f1b-b9a5-6f875b37816c',
    // Quelle: https://www.usa.canon.com/shop/p/eos-c300-mark-iii
    template: {
      manufacturerUrl: 'https://www.usa.canon.com/shop/p/eos-c300-mark-iii',
      name: 'Canon EOS C300 Mark III',
      category: CAM,
      inputs: [
        sdiIn('TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
        eth('Ethernet'),
      ],
      outputs: [
        sdiOut('SDI Out 1'),
        sdiOut('SDI Out 2'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out'),
      ],
      width: 240, height: 220,
    },
  },

  // EOS C70 (Super35 4K, 2020) – HDMI only, no built-in SDI
  {
    match: ['eos c70'],
    deviceTypeId: 'fd8fdb1a-0927-4d70-9c8b-f40ef5ef0fdb',
    // Quelle: https://www.usa.canon.com/shop/p/eos-c70
    template: {
      manufacturerUrl: 'https://www.usa.canon.com/shop/p/eos-c70',
      name: 'Canon EOS C70',
      category: CAM,
      inputs:  [],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 120,
    },
  },

  // EOS C200 (Super35, 2017) – HDMI + SDI
  {
    match: ['eos c200'],
    deviceTypeId: 'a05f82be-4c8d-4ffd-8124-3f8b366c5d57',
    // Quelle: https://www.usa.canon.com/shop/p/eos-c200
    template: {
      manufacturerUrl: 'https://www.usa.canon.com/shop/p/eos-c200',
      name: 'Canon EOS C200',
      category: CAM,
      inputs: [
        sdiIn('TC In'),
        xlr('XLR Ch1 In'),
        xlr('XLR Ch2 In'),
      ],
      outputs: [
        sdiOut('SDI Out'),
        hdmiOut('HDMI Out'),
        sdiOut('TC Out'),
      ],
      width: 220, height: 180,
    },
  },
]

/** Flat list of all built-in camera templates (seeded into the library). */
export const cameraTemplates: EquipmentTemplate[] = CAMERA_CATALOG.map(withTypeId)

/**
 * Autoritatives Match ueber die stabile Geraetetyp-ID (GUID). Kein Raten:
 * entweder die ID ist bekannt (echtes Datenblatt) oder null. Das ist der
 * bevorzugte Import-Pfad — Namens-Heuristik nur als Fallback, wenn keine ID
 * mitkommt (Altdaten / fremde Quelle ohne Katalog-Zuordnung).
 */
export const matchCameraTemplateById = (
  deviceTypeId: string | undefined,
): EquipmentTemplate | null => {
  if (!deviceTypeId) return null
  const entry = CAMERA_CATALOG.find((e) => e.deviceTypeId === deviceTypeId)
  return entry ? withTypeId(entry) : null
}

/** Return a matching template for a given equipment name, or null. */
export const matchCameraTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact name match first
  for (const entry of CAMERA_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  // Must contain at least one known brand/model keyword
  const isBrandKnown =
    lower.includes('pxw-') ||
    lower.includes('pmw-') ||
    lower.includes('ursa') ||
    lower.includes('pocket cinema') ||
    lower.includes('studio camera') ||
    lower.includes('eos c') ||
    (lower.includes('sony') && (lower.includes('fx3') || lower.includes('fx6')))
  if (!isBrandKnown) return null
  for (const entry of CAMERA_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
