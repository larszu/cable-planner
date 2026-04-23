import type { EquipmentTemplate, Port } from '../types/equipment'

// Known Blackmagic Design device templates with port counts taken from the
// official datasheets. Matched by name substrings so Rentman items like
// "Blackmagic Smart Videohub 40x40 12G" get the proper ports assigned on import.

const port = (name: string, connectorType: Port['connectorType'] = 'BNC'): Port => ({
  id: '',
  name,
  type: connectorType,
  connectorType,
})

const sdiIn = (n: number) =>
  Array.from({ length: n }, (_, i) => port(`SDI In ${i + 1}`, 'BNC'))
const sdiOut = (n: number) =>
  Array.from({ length: n }, (_, i) => port(`SDI Out ${i + 1}`, 'BNC'))

interface BlackmagicEntry {
  /** Name patterns (lowercased) that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

export const BLACKMAGIC_CATALOG: BlackmagicEntry[] = [
  // --- Videohubs ---------------------------------------------------------
  {
    match: ['smart videohub', '40x40', '12g'],
    template: {
      name: 'Blackmagic Smart Videohub 40x40 12G',
      category: 'Video Router',
      inputs: [...sdiIn(40), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(40),
      width: 260,
      height: 360,
    },
  },
  {
    match: ['smart videohub', '40x40'],
    template: {
      name: 'Blackmagic Smart Videohub 40x40',
      category: 'Video Router',
      inputs: [...sdiIn(40), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(40),
      width: 260,
      height: 360,
    },
  },
  {
    match: ['smart videohub', '20x20'],
    template: {
      name: 'Blackmagic Smart Videohub 20x20',
      category: 'Video Router',
      inputs: [...sdiIn(20), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(20),
      width: 240,
      height: 260,
    },
  },
  {
    match: ['smart videohub', '12x12'],
    template: {
      name: 'Blackmagic Smart Videohub 12x12',
      category: 'Video Router',
      inputs: [...sdiIn(12), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(12),
      width: 240,
      height: 220,
    },
  },
  {
    match: ['universal videohub', '72'],
    template: {
      name: 'Blackmagic Universal Videohub 72',
      category: 'Video Router',
      inputs: [...sdiIn(72), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(72),
      width: 260,
      height: 520,
    },
  },
  {
    match: ['universal videohub', '288'],
    template: {
      name: 'Blackmagic Universal Videohub 288',
      category: 'Video Router',
      inputs: [...sdiIn(288), port('Ethernet', 'Ethernet/RJ45')],
      outputs: sdiOut(288),
      width: 300,
      height: 1600,
    },
  },

  // --- ATEMs -------------------------------------------------------------
  {
    match: ['atem', 'constellation', '8k'],
    template: {
      name: 'Blackmagic ATEM Constellation 8K',
      category: 'Video Mixer',
      inputs: [
        ...sdiIn(40),
        port('Ref In', 'BNC'),
        port('Ethernet', 'Ethernet/RJ45'),
        port('Audio In L', 'XLR'),
        port('Audio In R', 'XLR'),
      ],
      outputs: [
        ...sdiOut(24),
        port('Multiview HDMI 1', 'HDMI'),
        port('Multiview HDMI 2', 'HDMI'),
        port('Audio Out L', 'XLR'),
        port('Audio Out R', 'XLR'),
      ],
      width: 280,
      height: 460,
    },
  },
  {
    match: ['atem', 'constellation', '2 m/e', '4k'],
    template: {
      name: 'Blackmagic ATEM 2 M/E Constellation 4K',
      category: 'Video Mixer',
      inputs: [
        ...sdiIn(20),
        port('Ref In', 'BNC'),
        port('Ethernet', 'Ethernet/RJ45'),
        port('Audio In L', 'XLR'),
        port('Audio In R', 'XLR'),
      ],
      outputs: [
        ...sdiOut(12),
        port('Multiview HDMI 1', 'HDMI'),
        port('Multiview HDMI 2', 'HDMI'),
        port('Audio Out L', 'XLR'),
        port('Audio Out R', 'XLR'),
      ],
      width: 280,
      height: 400,
    },
  },
  {
    match: ['atem', '2 m/e', 'production', '4k'],
    template: {
      name: 'Blackmagic ATEM 2 M/E Production Studio 4K',
      category: 'Video Mixer',
      inputs: [
        ...sdiIn(20),
        port('HDMI In', 'HDMI'),
        port('Ref In', 'BNC'),
        port('Ethernet', 'Ethernet/RJ45'),
        port('Audio In L', 'XLR'),
        port('Audio In R', 'XLR'),
      ],
      outputs: [
        ...sdiOut(6),
        port('Multiview HDMI', 'HDMI'),
        port('Multiview SDI', 'BNC'),
      ],
      width: 280,
      height: 320,
    },
  },
  {
    match: ['atem', '2 m/e', 'production', 'studio'],
    template: {
      name: 'Blackmagic ATEM 2 M/E Production Studio 4K',
      category: 'Video Mixer',
      inputs: [
        ...sdiIn(20),
        port('HDMI In', 'HDMI'),
        port('Ref In', 'BNC'),
        port('Ethernet', 'Ethernet/RJ45'),
        port('Audio In L', 'XLR'),
        port('Audio In R', 'XLR'),
      ],
      outputs: [
        ...sdiOut(6),
        port('Multiview HDMI', 'HDMI'),
        port('Multiview SDI', 'BNC'),
      ],
      width: 280,
      height: 320,
    },
  },
  {
    match: ['atem', '1 m/e', 'production', '4k'],
    template: {
      name: 'Blackmagic ATEM 1 M/E Production Studio 4K',
      category: 'Video Mixer',
      inputs: [
        ...sdiIn(10),
        port('Ref In', 'BNC'),
        port('Ethernet', 'Ethernet/RJ45'),
        port('Audio In L', 'XLR'),
        port('Audio In R', 'XLR'),
      ],
      outputs: [
        ...sdiOut(4),
        port('Multiview HDMI', 'HDMI'),
        port('Multiview SDI', 'BNC'),
      ],
      width: 260,
      height: 260,
    },
  },
  {
    match: ['atem', 'mini', 'extreme', 'iso'],
    template: {
      name: 'Blackmagic ATEM Mini Extreme ISO',
      category: 'Video Mixer',
      inputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI')),
        port('Mic 1', 'XLR'),
        port('Mic 2', 'XLR'),
        port('Ethernet', 'Ethernet/RJ45'),
      ],
      outputs: [
        port('HDMI Out 1', 'HDMI'),
        port('HDMI Out 2', 'HDMI'),
        port('Webcam USB', 'USB'),
      ],
      width: 260,
      height: 260,
    },
  },
  {
    match: ['atem', 'mini', 'extreme'],
    template: {
      name: 'Blackmagic ATEM Mini Extreme',
      category: 'Video Mixer',
      inputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI')),
        port('Mic 1', 'XLR'),
        port('Mic 2', 'XLR'),
        port('Ethernet', 'Ethernet/RJ45'),
      ],
      outputs: [
        port('HDMI Out 1', 'HDMI'),
        port('HDMI Out 2', 'HDMI'),
        port('Webcam USB', 'USB'),
      ],
      width: 260,
      height: 260,
    },
  },
  {
    match: ['atem', 'mini', 'pro', 'iso'],
    template: {
      name: 'Blackmagic ATEM Mini Pro ISO',
      category: 'Video Mixer',
      inputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI')),
        port('Mic 1', 'XLR'),
        port('Mic 2', 'XLR'),
        port('Ethernet', 'Ethernet/RJ45'),
      ],
      outputs: [port('HDMI Out', 'HDMI'), port('Webcam USB', 'USB')],
      width: 240,
      height: 220,
    },
  },
  {
    match: ['atem', 'mini', 'pro'],
    template: {
      name: 'Blackmagic ATEM Mini Pro',
      category: 'Video Mixer',
      inputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI')),
        port('Mic 1', 'XLR'),
        port('Mic 2', 'XLR'),
        port('Ethernet', 'Ethernet/RJ45'),
      ],
      outputs: [port('HDMI Out', 'HDMI'), port('Webcam USB', 'USB')],
      width: 240,
      height: 220,
    },
  },
  {
    match: ['atem', 'mini'],
    template: {
      name: 'Blackmagic ATEM Mini',
      category: 'Video Mixer',
      inputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`HDMI In ${i + 1}`, 'HDMI')),
        port('Mic 1', 'XLR'),
        port('Mic 2', 'XLR'),
      ],
      outputs: [port('HDMI Out', 'HDMI'), port('Webcam USB', 'USB')],
      width: 240,
      height: 200,
    },
  },

  // --- HyperDeck -----------------------------------------------------------
  {
    match: ['hyperdeck', 'hd plus'],
    template: {
      name: 'Blackmagic Hyperdeck Studio HD Plus',
      category: 'Video',
      inputs: [
        ...sdiIn(1),
        port('HDMI In', 'HDMI'),
        port('XLR L In', 'XLR'),
        port('XLR R In', 'XLR'),
      ],
      outputs: [
        ...sdiOut(1),
        port('HDMI Out', 'HDMI'),
        port('XLR L Out', 'XLR'),
        port('XLR R Out', 'XLR'),
      ],
      width: 240, height: 200,
    },
  },

  // --- Teranex Mini --------------------------------------------------------
  {
    match: ['teranex mini', 'sdi', 'audio', '12g'],
    template: {
      name: 'Blackmagic Teranex Mini SDI to Audio 12G',
      category: 'Video Converter',
      inputs: [...sdiIn(1)],
      outputs: [
        port('XLR Out 1', 'XLR'),
        port('XLR Out 2', 'XLR'),
        port('XLR Out 3', 'XLR'),
        port('XLR Out 4', 'XLR'),
      ],
      width: 200, height: 160,
    },
  },

  // --- Mini Converter / Sync Generator ------------------------------------
  {
    match: ['mini converter', 'sync'],
    template: {
      name: 'Blackmagic Mini Converter Sync Generator',
      category: 'Sync/Referenz',
      inputs: [],
      outputs: [
        port('HD Tri-Level Out 1', 'BNC'),
        port('HD Tri-Level Out 2', 'BNC'),
        port('Blackburst Out 1', 'BNC'),
        port('Blackburst Out 2', 'BNC'),
      ],
      width: 180, height: 120,
    },
  },

  // --- SmartScope ---------------------------------------------------------
  {
    match: ['smartscope'],
    template: {
      name: 'Blackmagic Smartscope Duo 4K2',
      category: 'Monitore',
      inputs: [...sdiIn(2)],
      outputs: [],
      width: 220, height: 120,
    },
  },
]

/** Flat list of all built-in Blackmagic templates (seeded into the library). */
export const blackmagicTemplates: EquipmentTemplate[] = BLACKMAGIC_CATALOG.map(
  (entry) => entry.template,
)

/** Return a template matching the given equipment name, or null. */
export const matchBlackmagicTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Prefer exact name match against the built-in templates. This means a
  // Rentman item whose name is identical to a seeded template (e.g.
  // "Blackmagic Smart Videohub 40x40 12G") is populated with the matching
  // port layout even if the fuzzy substring list doesn't align.
  for (const template of blackmagicTemplates) {
    if (template.name.toLowerCase().trim() === lower) return template
  }
  if (!lower.includes('blackmagic') && !lower.includes('atem') && !lower.includes('videohub')) {
    return null
  }
  for (const entry of BLACKMAGIC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return entry.template
    }
  }
  return null
}
