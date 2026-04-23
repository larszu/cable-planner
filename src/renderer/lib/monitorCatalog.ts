import type { EquipmentTemplate, Port } from '../types/equipment'

// Broadcast monitor / monitor-recorder templates sourced from official datasheets.
// Matched by name substrings so Rentman items resolve to the correct port layout
// on import. All templates are also seeded into the built-in library.

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

const MON = 'Monitore'

interface MonitorEntry {
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

export const MONITOR_CATALOG: MonitorEntry[] = [

  // ── Blackmagic Video Assist ──────────────────────────────────────────────

  {
    match: ['video assist', '7', '12g'],
    template: {
      name: 'Blackmagic Video Assist 7" 12G HDR',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI In'), xlrIn('XLR L In'), xlrIn('XLR R In')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI Out')],
      width: 220, height: 160,
    },
  },
  {
    match: ['video assist', '5', '12g'],
    template: {
      name: 'Blackmagic Video Assist 5" 12G HDR',
      category: MON,
      inputs:  [sdiIn('12G-SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('12G-SDI Out'), hdmiOut('HDMI Out')],
      width: 200, height: 140,
    },
  },
  {
    match: ['video assist', '7', '3g'],
    template: {
      name: 'Blackmagic Video Assist 7" 3G',
      category: MON,
      inputs:  [sdiIn('3G-SDI In'), hdmiIn('HDMI In'), xlrIn('XLR L In'), xlrIn('XLR R In')],
      outputs: [sdiOut('3G-SDI Out'), hdmiOut('HDMI Out')],
      width: 220, height: 160,
    },
  },
  {
    match: ['video assist', '5', '3g'],
    template: {
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
    template: {
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
    template: {
      name: 'Atomos Ninja V',
      category: MON,
      inputs:  [hdmiIn('HDMI In')],
      outputs: [hdmiOut('HDMI Out')],
      width: 180, height: 120,
    },
  },

  // ── SmallHD ──────────────────────────────────────────────────────────────

  // SmallHD 2403 HDR (24", 4x 12G-SDI, reference monitor)
  {
    match: ['smallhd', '2403'],
    template: {
      name: 'SmallHD 2403 HDR',
      category: MON,
      inputs: [
        sdiIn('12G-SDI In 1'), sdiIn('12G-SDI In 2'),
        sdiIn('12G-SDI In 3'), sdiIn('12G-SDI In 4'),
        hdmiIn('HDMI In'),
        sdiIn('Ref In'),
      ],
      outputs: [
        sdiOut('12G-SDI Out 1'), sdiOut('12G-SDI Out 2'),
        sdiOut('12G-SDI Out 3'), sdiOut('12G-SDI Out 4'),
      ],
      width: 260, height: 280,
    },
  },
  // SmallHD 1703 P3X HDR (17", 2x 12G-SDI)
  {
    match: ['smallhd', '1703'],
    template: {
      name: 'SmallHD 1703 P3X HDR',
      category: MON,
      inputs: [
        sdiIn('12G-SDI In 1'), sdiIn('12G-SDI In 2'),
        hdmiIn('HDMI In'),
        sdiIn('Ref In'),
      ],
      outputs: [sdiOut('12G-SDI Out 1'), sdiOut('12G-SDI Out 2')],
      width: 240, height: 200,
    },
  },
  // SmallHD 702 Bright (7")
  {
    match: ['smallhd', '702'],
    template: {
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
    template: {
      name: 'SmallHD Cine 18',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        sdiIn('SDI In 3'), sdiIn('SDI In 4'),
        hdmiIn('HDMI In'),
        sdiIn('Ref In'),
      ],
      outputs: [sdiOut('SDI Out')],
      width: 250, height: 240,
    },
  },
  // SmallHD Cine 13 (13", 2x SDI in)
  {
    match: ['smallhd', 'cine', '13'],
    template: {
      name: 'SmallHD Cine 13',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In'), sdiIn('Ref In')],
      outputs: [sdiOut('SDI Out')],
      width: 230, height: 180,
    },
  },
  // SmallHD Cine 7 (7")
  {
    match: ['smallhd', 'cine', '7'],
    template: {
      name: 'SmallHD Cine 7',
      category: MON,
      inputs:  [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (Loop)')],
      width: 200, height: 140,
    },
  },
  // SmallHD 503 OLED (5", 2x SDI in)
  {
    match: ['smallhd', '503'],
    template: {
      name: 'SmallHD 503 OLED',
      category: MON,
      inputs:  [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out')],
      width: 200, height: 140,
    },
  },
  // SmallHD 502 (5")
  {
    match: ['smallhd', '502'],
    template: {
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
    template: {
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
  // LUM-215G (21.5", 2x 3G-SDI in/out, Ref)
  {
    match: ['tvlogic', 'lum-215'],
    template: {
      name: 'TVLogic LUM-215G',
      category: MON,
      inputs: [
        sdiIn('SDI In 1'), sdiIn('SDI In 2'),
        hdmiIn('HDMI In'), sdiIn('Ref In'),
      ],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2'), hdmiOut('HDMI Out')],
      width: 240, height: 200,
    },
  },
  // LUM-170G (17", SDI in/out, HDMI in/out, Ref)
  {
    match: ['tvlogic', 'lum-170'],
    template: {
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
    template: {
      name: 'TVLogic LVM-246W',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out'), hdmiOut('HDMI Out')],
      width: 240, height: 200,
    },
  },
  // LVM-171W (17", 2x SDI in, SDI out loop, HDMI in)
  {
    match: ['tvlogic', 'lvm-171'],
    template: {
      name: 'TVLogic LVM-171W',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out (Loop)')],
      width: 230, height: 180,
    },
  },
  // LVM-075W (7", 2x SDI in loop, HDMI in)
  {
    match: ['tvlogic', 'lvm-075'],
    template: {
      name: 'TVLogic LVM-075W',
      category: MON,
      inputs: [sdiIn('SDI In (Loop 1)'), sdiIn('SDI In (Loop 2)'), hdmiIn('HDMI In')],
      outputs: [],
      width: 200, height: 140,
    },
  },
  // XVM-245W (24.5", 4K UHD — 2x 3G-SDI in, 3G-SDI out loop, 2x HDMI 2.0 in, DisplayPort in, Ref In)
  {
    match: ['tvlogic', 'xvm-245'],
    template: {
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

  // V-LCD241 (24.5", 2x SDI in/out, HDMI in)
  {
    match: ['marshall', 'v-lcd241'],
    template: {
      name: 'Marshall V-LCD241',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Out 1'), sdiOut('SDI Out 2')],
      width: 240, height: 200,
    },
  },
  // V-LCD173 (17.3", 2x SDI in, SDI loop, HDMI in)
  {
    match: ['marshall', 'v-lcd173'],
    template: {
      name: 'Marshall V-LCD173',
      category: MON,
      inputs: [sdiIn('SDI In 1'), sdiIn('SDI In 2'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Loop Out')],
      width: 230, height: 180,
    },
  },
  // V-LCD70 (7", SDI in, SDI loop, HDMI in) – many variant suffixes
  {
    match: ['marshall', 'v-lcd7'],
    template: {
      name: 'Marshall V-LCD70',
      category: MON,
      inputs: [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Loop Out')],
      width: 200, height: 140,
    },
  },
  // V-LCD56 (5.6", SDI in, SDI loop, HDMI in)
  {
    match: ['marshall', 'v-lcd56'],
    template: {
      name: 'Marshall V-LCD56',
      category: MON,
      inputs: [sdiIn('SDI In'), hdmiIn('HDMI In')],
      outputs: [sdiOut('SDI Loop Out')],
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
    template: {
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
    template: {
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
export const monitorTemplates: EquipmentTemplate[] = MONITOR_CATALOG.map((e) => e.template)

/** Return a matching template for a given equipment name, or null. */
export const matchMonitorTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact name match first
  for (const t of monitorTemplates) {
    if (t.name.toLowerCase().trim() === lower) return t
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
      return entry.template
    }
  }
  return null
}
