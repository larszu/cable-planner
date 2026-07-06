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
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Autoritative Geraete-Rolle laut Datenblatt (ATEM/Videohub) — ersetzt
   *  fuer Katalog-Geraete die Namens-Heuristik in detectDeviceKind. */
  kind?: 'videohub' | 'atem'
  /** Videohubs: expliziter Preset-Key fuer den Export-Dialog (siehe
   *  exportVideohub.ts → videohubPresets). Datenblatt-Fakt statt
   *  Port-Zaehl-Schaetzung. */
  videohubPresetKey?: string
  /** Name patterns (lowercased) that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: BlackmagicEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const BLACKMAGIC_CATALOG: BlackmagicEntry[] = [
  // --- Videohubs ---------------------------------------------------------
  {
    match: ['smart videohub', '40x40', '12g'],
    deviceTypeId: 'bb1964f5-f2e2-44b7-8cb4-8d8ea3a7a742',
    kind: 'videohub',
    videohubPresetKey: 'smart-40x40-12g',
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
    deviceTypeId: '556a23a4-3565-457a-afad-556592ddd74a',
    kind: 'videohub',
    videohubPresetKey: 'smart-40x40',
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
    deviceTypeId: 'a5aa8476-ae3a-4dc3-a854-d95d9634557b',
    kind: 'videohub',
    videohubPresetKey: 'smart-20x20',
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
    deviceTypeId: 'b5ec1c47-6d5d-4f53-811e-16c67d62cc54',
    kind: 'videohub',
    videohubPresetKey: 'smart-12x12',
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
    deviceTypeId: '83750064-f7ee-4d86-b47e-704b170c552e',
    kind: 'videohub',
    videohubPresetKey: 'universal-72x72',
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
    deviceTypeId: '42fd5858-df56-46c6-a3cc-e3dd155ede23',
    kind: 'videohub',
    videohubPresetKey: 'universal-master-288x288',
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
    deviceTypeId: 'f6021c28-4e79-413b-9038-38cc1311faf3',
    kind: 'atem',
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
    deviceTypeId: '1472cfc1-df0d-41af-a5c3-b52496a20e53',
    kind: 'atem',
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
    deviceTypeId: '0be0fb87-d3bf-4e2e-a884-79b5b770b19e',
    kind: 'atem',
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
    deviceTypeId: '66258c7b-1d4e-4d4b-84b5-93b0225b4063',
    kind: 'atem',
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
    deviceTypeId: '52167ca7-7a7e-4566-843b-4b9a4d635252',
    kind: 'atem',
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
    deviceTypeId: '4622e885-df82-430e-9512-fca13b673b4d',
    kind: 'atem',
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
    deviceTypeId: '4e7edb7a-df5f-468a-bba1-ea4417867c9c',
    kind: 'atem',
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
    deviceTypeId: 'a252049d-992a-432b-8084-d1f794c79c4a',
    kind: 'atem',
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
    deviceTypeId: '652bad38-f099-4c61-a2e2-31e897ca5792',
    kind: 'atem',
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
    deviceTypeId: '736199eb-6ae0-4a30-91c8-3f645102460f',
    kind: 'atem',
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
    deviceTypeId: 'e6699d97-5974-430e-981d-2a6bad93e116',
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
    deviceTypeId: '8a508de7-9876-4f0e-9767-99d4496b0a0d',
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
    deviceTypeId: '65370da7-d825-4286-aa19-e268edce853c',
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
    deviceTypeId: 'efa08d23-505b-44f8-9a45-3d778342d87a',
    template: {
      name: 'Blackmagic Smartscope Duo 4K2',
      category: 'Monitore',
      inputs: [...sdiIn(2)],
      outputs: [],
      width: 220, height: 120,
    },
  },

  // --- Micro Converter (v7.9.72 / #189) -----------------------------------
  // BiDi-Micro converters: BNC + HDMI, jeweils in + out, gleichzeitig nutzbar.
  {
    match: ['micro converter', 'bidi', '12g'],
    deviceTypeId: 'db230d68-3b19-4160-b6dc-05c3d16ece11',
    template: {
      name: 'Blackmagic Micro Converter BiDirectional SDI/HDMI 12G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC'), port('HDMI In', 'HDMI')],
      outputs: [port('SDI Out', 'BNC'), port('HDMI Out', 'HDMI')],
      width: 200, height: 140,
    },
  },
  {
    match: ['micro converter', 'bidi', '3g'],
    deviceTypeId: '9ceddbba-980f-4bc3-99c4-f9223dd0874c',
    template: {
      name: 'Blackmagic Micro Converter BiDirectional SDI/HDMI 3G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC'), port('HDMI In', 'HDMI')],
      outputs: [port('SDI Out', 'BNC'), port('HDMI Out', 'HDMI')],
      width: 200, height: 140,
    },
  },
  {
    match: ['micro converter', 'sdi to hdmi', '12g'],
    deviceTypeId: '93078cb6-4e8c-412c-b654-f5320fe53351',
    template: {
      name: 'Blackmagic Micro Converter SDI to HDMI 12G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC')],
      outputs: [port('SDI Loop Out', 'BNC'), port('HDMI Out', 'HDMI')],
      width: 200, height: 140,
    },
  },
  {
    match: ['micro converter', 'sdi to hdmi', '3g'],
    deviceTypeId: '7ef51e97-2e2e-441f-8b19-2943c0e04d4e',
    template: {
      name: 'Blackmagic Micro Converter SDI to HDMI 3G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC')],
      outputs: [port('SDI Loop Out', 'BNC'), port('HDMI Out', 'HDMI')],
      width: 200, height: 140,
    },
  },
  {
    match: ['micro converter', 'hdmi to sdi', '12g'],
    deviceTypeId: '69195cbd-170e-4489-b623-d7290db0c68b',
    template: {
      name: 'Blackmagic Micro Converter HDMI to SDI 12G',
      category: 'Konverter',
      inputs: [port('HDMI In', 'HDMI')],
      outputs: [port('SDI Out 1', 'BNC'), port('SDI Out 2', 'BNC')],
      width: 200, height: 140,
    },
  },
  {
    match: ['micro converter', 'hdmi to sdi', '3g'],
    deviceTypeId: '65188048-59bf-46d5-8778-9d48795ccd36',
    template: {
      name: 'Blackmagic Micro Converter HDMI to SDI 3G',
      category: 'Konverter',
      inputs: [port('HDMI In', 'HDMI')],
      outputs: [port('SDI Out 1', 'BNC'), port('SDI Out 2', 'BNC')],
      width: 200, height: 140,
    },
  },

  // --- Mini Converter (zusätzliche Varianten) -----------------------------
  {
    match: ['mini converter', 'optical fiber', '12g'],
    deviceTypeId: '42b1cf91-b11e-4680-87a1-889320cbcf3f',
    template: {
      name: 'Blackmagic Mini Converter Optical Fiber 12G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC'), port('Optical In (LC)', 'Fiber')],
      outputs: [port('SDI Out', 'BNC'), port('Optical Out (LC)', 'Fiber')],
      width: 220, height: 140,
    },
  },
  {
    match: ['mini converter', 'sdi distribution', '12g'],
    deviceTypeId: 'cdf1e76f-9e49-4dfe-89dc-17d5b4608401',
    template: {
      name: 'Blackmagic Mini Converter SDI Distribution 12G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC')],
      outputs: sdiOut(8),
      width: 220, height: 220,
    },
  },
  {
    match: ['mini converter', 'sdi to hdmi', '6g'],
    deviceTypeId: '61b65209-6ef5-4bf7-a312-5fa5aa7f69bb',
    template: {
      name: 'Blackmagic Mini Converter SDI to HDMI 6G',
      category: 'Konverter',
      inputs: [port('SDI In', 'BNC')],
      outputs: [
        port('SDI Loop Out', 'BNC'),
        port('HDMI Out', 'HDMI'),
        port('XLR Audio Out 1', 'XLR'),
        port('XLR Audio Out 2', 'XLR'),
      ],
      width: 220, height: 180,
    },
  },
  {
    match: ['mini converter', 'hdmi to sdi', '6g'],
    deviceTypeId: '84b2febe-8027-4533-9ad9-ba438c9540e3',
    template: {
      name: 'Blackmagic Mini Converter HDMI to SDI 6G',
      category: 'Konverter',
      inputs: [port('HDMI In', 'HDMI'), port('XLR Audio In 1', 'XLR'), port('XLR Audio In 2', 'XLR')],
      outputs: [port('SDI Out 1', 'BNC'), port('SDI Out 2', 'BNC')],
      width: 220, height: 180,
    },
  },

  // --- IP Converter (ST 2110) ---------------------------------------------
  {
    match: ['2110 ip converter', '12g'],
    deviceTypeId: 'daeb55f2-0638-47a1-9a48-99100b9eb378',
    template: {
      name: 'Blackmagic 2110 IP Converter 12G',
      category: 'IP/NDI',
      inputs: [port('SDI In 1', 'BNC'), port('SDI In 2', 'BNC'), port('IP Network', 'Ethernet/RJ45')],
      outputs: [port('SDI Out 1', 'BNC'), port('SDI Out 2', 'BNC'), port('IP Network Loop', 'Ethernet/RJ45')],
      width: 240, height: 200,
    },
  },
  {
    match: ['2110 ip converter', 'mini'],
    deviceTypeId: '8c7117ce-9737-4f1a-aedf-6f4f636b8340',
    template: {
      name: 'Blackmagic 2110 IP Mini Converter',
      category: 'IP/NDI',
      inputs: [port('SDI In', 'BNC'), port('IP Network', 'Ethernet/RJ45')],
      outputs: [port('SDI Out', 'BNC')],
      width: 220, height: 160,
    },
  },
]

/** Flat list of all built-in Blackmagic templates (seeded into the library). */
export const blackmagicTemplates: EquipmentTemplate[] = BLACKMAGIC_CATALOG.map(withTypeId)

/** Return a template matching the given equipment name, or null. */
export const matchBlackmagicTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Prefer exact name match against the built-in templates. This means a
  // Rentman item whose name is identical to a seeded template (e.g.
  // "Blackmagic Smart Videohub 40x40 12G") is populated with the matching
  // port layout even if the fuzzy substring list doesn't align.
  for (const entry of BLACKMAGIC_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  if (!lower.includes('blackmagic') && !lower.includes('atem') && !lower.includes('videohub')) {
    return null
  }
  for (const entry of BLACKMAGIC_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
