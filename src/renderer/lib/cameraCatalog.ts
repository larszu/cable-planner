import type { EquipmentTemplate, Port } from '../types/equipment'

// Camera templates sourced from official datasheets / manufacturer spec pages.
// Covers Sony PXW/PMW cinema line, Blackmagic URSA / Pocket / Studio Camera,
// and Canon EOS Cinema range commonly found in broadcast/event rental inventories.

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

const CAM = 'Kameras'

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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
      name: 'Sony FX3',
      category: CAM,
      inputs:  [xlr('XLR Ch1 In'), xlr('XLR Ch2 In')],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 140,
    },
  },

  // ── Blackmagic Cameras ───────────────────────────────────────────────────

  // URSA Mini Pro 12K (2020)
  // Output: 12G-SDI Out, HDMI Out; Audio: 2x XLR built-in (+2 via shoulder);
  // Control: Ref In, USB-C
  {
    match: ['ursa mini pro', '12k'],
    deviceTypeId: '1b94e2d9-f987-4b76-8827-f555d88a2e10',
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
    template: {
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
