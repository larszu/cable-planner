import type { ConnectorType } from './equipment'

/**
 * Signal sub-standards for the same physical connector (e.g. 3G vs 12G SDI on BNC).
 * Mismatched sub-standards on compatible connectors usually need a converter/scaler.
 */
export type SignalStandard =
  | 'SDI-SD'
  | 'SDI-HD'
  | 'SDI-3G'
  | 'SDI-6G'
  | 'SDI-12G'
  | 'HDMI-1.4'
  | 'HDMI-2.0'
  | 'HDMI-2.1'
  | 'DP-1.2'
  | 'DP-1.4'
  | 'DP-2.0'
  | 'Eth-100'
  | 'Eth-1G'
  | 'Eth-10G'
  | 'Analog-Audio'
  | 'AES3'
  | 'AES3id'
  | 'USB-2.0'
  | 'USB-3.x'
  | 'Power-230V'
  | 'Fiber-SM'
  | 'Fiber-MM'
  | 'Thunderbolt-3'
  | 'Thunderbolt-4'
  | 'MADI'
  | 'DVB-ASI'
  | 'SMPTE-297'
  | 'SMPTE-304M'
  | 'SMPTE-311M'
  | 'NDI'
  | 'NDI-HX'
  | 'Dante'
  | 'AES67'
  | 'ST2110-20'
  | 'ST2110-30'
  | 'ST2110-40'
  | 'Blackburst'
  | 'Tri-Level'
  | 'Word-Clock'
  | 'PTP'
  | 'LTC'
  | 'RF-UHF'
  | 'RF-VHF'
  | 'RF-2.4G'
  | 'RF-5G'
  | 'RS-232'
  | 'RS-422'
  | 'RS-485'
  | 'DMX512'
  | 'RDM'
  | 'Art-Net'
  | 'sACN'
  | 'CVBS'
  | 'Y/C'
  | 'YPbPr'
  | 'RGBHV'
  | 'MTC'
  | 'Tally'
  | 'GPI/GPO'
  | 'HDBaseT'
  | 'Generic'

/** All valid signal standard values in display order. */
export const ALL_SIGNAL_STANDARDS: SignalStandard[] = [
  'SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G',
  'HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1',
  'DP-1.2', 'DP-1.4', 'DP-2.0',
  'Eth-100', 'Eth-1G', 'Eth-10G',
  'Analog-Audio', 'AES3', 'AES3id', 'USB-2.0', 'USB-3.x',
  'Thunderbolt-3', 'Thunderbolt-4',
  'MADI', 'DVB-ASI', 'SMPTE-297', 'SMPTE-304M', 'SMPTE-311M',
  'NDI', 'NDI-HX', 'Dante', 'AES67', 'ST2110-20', 'ST2110-30', 'ST2110-40',
  'Blackburst', 'Tri-Level', 'Word-Clock', 'PTP', 'LTC',
  'RF-UHF', 'RF-VHF', 'RF-2.4G', 'RF-5G',
  'RS-232', 'RS-422', 'RS-485', 'DMX512', 'RDM', 'Art-Net', 'sACN',
  'CVBS', 'Y/C', 'YPbPr', 'RGBHV', 'MTC', 'Tally', 'GPI/GPO', 'HDBaseT',
  'Power-230V', 'Fiber-SM', 'Fiber-MM', 'Generic',
]

/** SDI standards ordered from lowest to highest bandwidth. */
export const SDI_STANDARDS: SignalStandard[] = ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G']

/**
 * Returns the highest applicable SDI standard from the given list,
 * or the last element if no SDI standard is found.
 */
export const pickHighestSdiStandard = (standards: SignalStandard[]): SignalStandard | undefined =>
  [...SDI_STANDARDS].reverse().find((s) => standards.includes(s)) ?? standards[standards.length - 1]

export interface CableSpec {
  id: string
  name: string
  connectorType: ConnectorType
  /** Connectors this cable can also mate with directly (same physical connector). */
  compatibleConnectors?: ConnectorType[]
  standards: SignalStandard[]
  /** Typical maximum cable length in meters (signal integrity). */
  maxLengthMeters?: number
  color: string
  /**
   * User-supplied notes (free text). Used for custom CableSpec definitions the
   * user adds via the catalog UI — they own this string and it stays in
   * whatever language they typed it.
   */
  notes?: string
  /**
   * Built-in catalog entries use a translation key instead of an inline
   * `notes` string. Consumers should resolve it via `t(spec.notesKey, '')`
   * so the description follows the active UI language without changing the
   * underlying portable spec definition.
   */
  notesKey?: string
}

/**
 * Built-in catalogue of common A/V & power cables.
 * These serve as presets when creating cable connections and carry the spec
 * info needed for compatibility checks.
 */
export const cableCatalog: CableSpec[] = [
  {
    id: 'xlr-3pin-audio',
    name: 'XLR 3-pin Audio',
    connectorType: 'XLR',
    standards: ['Analog-Audio', 'AES3'],
    maxLengthMeters: 100,
    color: '#38bdf8',
    notesKey: 'catalog.cable.xlr-3pin-audio.notes',
  },
  {
    id: 'sdi-3g',
    name: 'SDI 3G (1080p50/60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 100,
    color: '#f59e0b',
    notesKey: 'catalog.cable.sdi-3g.notes',
  },
  {
    id: 'sdi-6g',
    name: 'SDI 6G (4K30 4:2:0)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G'],
    maxLengthMeters: 70,
    color: '#f97316',
    notesKey: 'catalog.cable.sdi-6g.notes',
  },
  {
    id: 'sdi-12g',
    name: 'SDI 12G (4K60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'],
    maxLengthMeters: 50,
    color: '#ef4444',
    notesKey: 'catalog.cable.sdi-12g.notes',
  },
  {
    id: 'hdmi-2.0',
    name: 'HDMI 2.0 (4K60 4:4:4)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0'],
    maxLengthMeters: 10,
    color: '#a855f7',
    notesKey: 'catalog.cable.hdmi-2.0.notes',
  },
  {
    id: 'hdmi-2.1',
    name: 'HDMI 2.1 (8K/4K120)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
    maxLengthMeters: 5,
    color: '#c084fc',
    notesKey: 'catalog.cable.hdmi-2.1.notes',
  },
  {
    id: 'dp-1.4',
    name: 'DisplayPort 1.4',
    connectorType: 'DisplayPort',
    standards: ['DP-1.2', 'DP-1.4'],
    maxLengthMeters: 3,
    color: '#8b5cf6',
  },
  {
    id: 'cat6',
    name: 'Ethernet Cat6 (1G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G'],
    maxLengthMeters: 100,
    color: '#22c55e',
  },
  {
    id: 'cat6a',
    name: 'Ethernet Cat6a (10G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Eth-10G'],
    maxLengthMeters: 100,
    color: '#16a34a',
    notesKey: 'catalog.cable.cat6a.notes',
  },
  {
    id: 'ndi-cat6a',
    name: 'NDI über Cat6a (1G/10G)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-1G', 'Eth-10G', 'NDI', 'NDI-HX'],
    maxLengthMeters: 100,
    color: '#22c55e',
    notesKey: 'catalog.cable.ndi-cat6a.notes',
  },
  {
    id: 'dante-cat6',
    name: 'Dante / AES67 (Cat6)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Dante', 'AES67'],
    maxLengthMeters: 100,
    color: '#14b8a6',
    notesKey: 'catalog.cable.dante-cat6.notes',
  },
  {
    id: 'st2110-fiber',
    name: 'SMPTE ST 2110 (Fiber)',
    connectorType: 'Fiber',
    standards: ['Fiber-SM', 'Fiber-MM', 'ST2110-20', 'ST2110-30', 'ST2110-40'],
    maxLengthMeters: 300,
    color: '#0ea5e9',
    notesKey: 'catalog.cable.st2110-fiber.notes',
  },
  {
    id: 'blackburst-bnc',
    name: 'Referenz Blackburst / Tri-Level (BNC)',
    connectorType: 'BNC',
    standards: ['Blackburst', 'Tri-Level'],
    maxLengthMeters: 100,
    color: '#64748b',
    notesKey: 'catalog.cable.blackburst-bnc.notes',
  },
  {
    id: 'wordclock-bnc',
    name: 'Word Clock (BNC)',
    connectorType: 'BNC',
    standards: ['Word-Clock'],
    maxLengthMeters: 50,
    color: '#94a3b8',
    notesKey: 'catalog.cable.wordclock-bnc.notes',
  },
  {
    id: 'ltc-bnc',
    name: 'LTC Timecode (BNC)',
    connectorType: 'BNC',
    standards: ['LTC'],
    maxLengthMeters: 100,
    color: '#94a3b8',
    notesKey: 'catalog.cable.ltc-bnc.notes',
  },
  {
    id: 'ptp-cat6',
    name: 'PTP / Referenz (Ethernet)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-1G', 'PTP'],
    maxLengthMeters: 100,
    color: '#0891b2',
    notesKey: 'catalog.cable.ptp-cat6.notes',
  },
  {
    id: 'fiber-sm-lc',
    name: 'Fiber SM (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-SM'],
    maxLengthMeters: 10000,
    color: '#eab308',
    notesKey: 'catalog.cable.fiber-sm-lc.notes',
  },
  {
    id: 'fiber-mm-lc',
    name: 'Fiber MM OM4 (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-MM'],
    maxLengthMeters: 400,
    color: '#facc15',
    notesKey: 'catalog.cable.fiber-mm-lc.notes',
  },
  {
    id: 'usb3',
    name: 'USB 3.x',
    connectorType: 'USB',
    standards: ['USB-2.0', 'USB-3.x'],
    maxLengthMeters: 3,
    color: '#64748b',
  },
  {
    id: 'iec-230v',
    name: 'IEC C13/C14 230V',
    connectorType: 'IEC 230V',
    standards: ['Power-230V'],
    maxLengthMeters: 5,
    color: '#475569',
    notesKey: 'catalog.cable.iec-230v.notes',
  },
  {
    id: 'powercon-tru1',
    name: 'powerCON TRUE1',
    connectorType: 'PowerCON',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#0ea5e9',
    notesKey: 'catalog.cable.powercon-tru1.notes',
  },
  {
    id: 'schuko-230v',
    name: 'Schuko 230V',
    connectorType: 'Schuko 230V',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#334155',
  },
  {
    id: 'thunderbolt-3',
    name: 'Thunderbolt 3 (40Gbps)',
    connectorType: 'USB-C',
    standards: ['Thunderbolt-3', 'USB-2.0', 'USB-3.x'],
    maxLengthMeters: 2,
    color: '#7c3aed',
    notesKey: 'catalog.cable.thunderbolt-3.notes',
  },
  {
    id: 'thunderbolt-4',
    name: 'Thunderbolt 4 (40Gbps, zertifiziert)',
    connectorType: 'USB-C',
    standards: ['Thunderbolt-4', 'Thunderbolt-3', 'USB-2.0', 'USB-3.x'],
    maxLengthMeters: 2,
    color: '#6d28d9',
    notesKey: 'catalog.cable.thunderbolt-4.notes',
  },
  {
    id: 'madi-bnc',
    name: 'MADI Koax (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['MADI', 'AES3'],
    maxLengthMeters: 200,
    color: '#0891b2',
    notesKey: 'catalog.cable.madi-bnc.notes',
  },
  {
    id: 'aes3id-bnc',
    name: 'AES3id (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['AES3id'],
    maxLengthMeters: 100,
    color: '#0891b2',
    notesKey: 'catalog.cable.aes3id-bnc.notes',
  },
  {
    id: 'dvb-asi',
    name: 'DVB-ASI (BNC, 75Ω)',
    connectorType: 'BNC',
    standards: ['DVB-ASI'],
    maxLengthMeters: 100,
    color: '#2563eb',
    notesKey: 'catalog.cable.dvb-asi.notes',
  },
  {
    id: 'madi-optical',
    name: 'MADI Optisch (ST/SC Fiber)',
    connectorType: 'Fiber',
    standards: ['MADI', 'Fiber-MM'],
    maxLengthMeters: 2000,
    color: '#06b6d4',
    notesKey: 'catalog.cable.madi-optical.notes',
  },
  {
    id: 'smpte-297',
    name: 'SMPTE ST 297 — Optisches SDI (Glasfaser)',
    connectorType: 'Fiber',
    standards: ['SMPTE-297', 'SDI-HD', 'SDI-3G', 'Fiber-SM'],
    maxLengthMeters: 10000,
    color: '#f59e0b',
    notesKey: 'catalog.cable.smpte-297.notes',
  },
  // #376 — SMPTE 304M (Hybrid-Fiber-Kamerakabel) ist KEIN Triax. Triax ist
  // ein analog-orientiertes Single-Coax-System (Damar & Hagen, Fischer),
  // SMPTE 304M traegt Fiber+Strom+Steuerung in einem genormten Stecker
  // (LEMO 3K.93C/311 oder Neutrik Dragonfly). Beide werden jetzt separat
  // gefuehrt.
  {
    id: 'smpte-304m-lemo',
    name: 'SMPTE 304M Hybrid-Fiber (LEMO 3K.93C / 311)',
    connectorType: 'LEMO 3K.93C (SMPTE 304M)',
    standards: ['SMPTE-304M', 'SMPTE-311M', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 2000,
    color: '#d97706',
    notesKey: 'catalog.cable.smpte-304m-lemo.notes',
  },
  {
    id: 'smpte-304m-dragonfly',
    name: 'SMPTE 304M Hybrid-Fiber (Neutrik Dragonfly)',
    connectorType: 'Neutrik Dragonfly (SMPTE 304M)',
    standards: ['SMPTE-304M', 'SMPTE-311M', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 2000,
    color: '#b45309',
    notesKey: 'catalog.cable.smpte-304m-dragonfly.notes',
  },
  {
    id: 'triax-dh',
    name: 'Triax (Damar & Hagen)',
    connectorType: 'Triax (Damar & Hagen)',
    standards: ['SDI-HD', 'Analog-Audio'],
    maxLengthMeters: 1500,
    color: '#a16207',
    notesKey: 'catalog.cable.triax-dh.notes',
  },
  {
    id: 'triax-fischer',
    name: 'Triax (Fischer)',
    connectorType: 'Triax (Fischer)',
    standards: ['SDI-HD', 'Analog-Audio'],
    maxLengthMeters: 1500,
    color: '#854d0e',
    notesKey: 'catalog.cable.triax-fischer.notes',
  },
  {
    id: 'triax-camera',
    name: 'Triax-Kamerakabel (analog/koaxial)',
    connectorType: 'Triax',
    standards: ['Generic'],
    maxLengthMeters: 300,
    color: '#b45309',
    notesKey: 'catalog.cable.triax-camera.notes',
  },
  {
    id: 'serial-rs422',
    name: 'Serielle Steuerung RS-232/422/485 (DB9)',
    connectorType: 'DB9',
    standards: ['RS-232', 'RS-422', 'RS-485'],
    maxLengthMeters: 1200,
    color: '#fbbf24',
    notesKey: 'catalog.cable.serial-rs422.notes',
  },
  {
    id: 'vga-de15',
    name: 'VGA (DE-15)',
    connectorType: 'VGA',
    standards: ['RGBHV'],
    maxLengthMeters: 15,
    color: '#6366f1',
    notesKey: 'catalog.cable.vga-de15.notes',
  },
  {
    id: 'dvi-cable',
    name: 'DVI (Single/Dual-Link)',
    connectorType: 'DVI',
    standards: ['RGBHV', 'Generic'],
    maxLengthMeters: 5,
    color: '#818cf8',
    notesKey: 'catalog.cable.dvi-cable.notes',
  },
  {
    id: 'dsub-db25-audio',
    name: 'DB25 Mehrkanal-Audio (AES59 / TASCAM)',
    connectorType: 'DB25',
    standards: ['Analog-Audio', 'AES3'],
    maxLengthMeters: 30,
    color: '#fb7185',
    notesKey: 'catalog.cable.dsub-db25-audio.notes',
  },
  {
    id: 'dmx-5pin',
    name: 'DMX512 / RDM (5-pol XLR)',
    connectorType: 'DMX 5-pol (XLR)',
    compatibleConnectors: ['DMX 3-pol (XLR)'],
    standards: ['DMX512', 'RDM'],
    maxLengthMeters: 300,
    color: '#fb923c',
    notesKey: 'catalog.cable.dmx-5pin.notes',
  },
  {
    id: 'artnet-sacn',
    name: 'Art-Net / sACN (Ethernet)',
    connectorType: 'Ethernet/RJ45',
    standards: ['Eth-100', 'Eth-1G', 'Art-Net', 'sACN'],
    maxLengthMeters: 100,
    color: '#fdba74',
    notesKey: 'catalog.cable.artnet-sacn.notes',
  },
  {
    id: 'composite-cinch',
    name: 'Composite / FBAS (Cinch)',
    connectorType: 'Cinch/RCA',
    compatibleConnectors: ['BNC'],
    standards: ['CVBS'],
    maxLengthMeters: 50,
    color: '#eab308',
    notesKey: 'catalog.cable.composite-cinch.notes',
  },
  {
    id: 's-video',
    name: 'S-Video (Y/C)',
    connectorType: 'S-Video',
    standards: ['Y/C'],
    maxLengthMeters: 10,
    color: '#ca8a04',
    notesKey: 'catalog.cable.s-video.notes',
  },
  {
    id: 'component-ypbpr',
    name: 'Component YPbPr (3× Cinch/BNC)',
    connectorType: 'Cinch/RCA',
    compatibleConnectors: ['BNC'],
    standards: ['YPbPr'],
    maxLengthMeters: 30,
    color: '#a16207',
    notesKey: 'catalog.cable.component-ypbpr.notes',
  },
  {
    id: 'tally-gpi',
    name: 'Tally / GPI-GPO (DB9 / Kontakt)',
    connectorType: 'DB9',
    standards: ['Tally', 'GPI/GPO'],
    maxLengthMeters: 100,
    color: '#f59e0b',
    notesKey: 'catalog.cable.tally-gpi.notes',
  },
  {
    id: 'hdbaset-cat6a',
    name: 'HDBaseT (Video/Audio/Steuerung/PoH über Cat)',
    connectorType: 'Ethernet/RJ45',
    standards: ['HDBaseT', 'Eth-1G'],
    maxLengthMeters: 100,
    color: '#2dd4bf',
    notesKey: 'catalog.cable.hdbaset-cat6a.notes',
  },
  {
    id: 'hdmi-aoc',
    name: 'HDMI AOC (Active Optical, bis ~100 m)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
    maxLengthMeters: 100,
    color: '#a855f7',
    notesKey: 'catalog.cable.hdmi-aoc.notes',
  },
  {
    id: 'dp-aoc',
    name: 'DisplayPort AOC (Active Optical, bis ~50 m)',
    connectorType: 'DisplayPort',
    standards: ['DP-1.2', 'DP-1.4', 'DP-2.0'],
    maxLengthMeters: 50,
    color: '#8b5cf6',
    notesKey: 'catalog.cable.dp-aoc.notes',
  },
  {
    id: 'usbc-aoc',
    name: 'USB-C AOC (Active Optical, bis ~30 m)',
    connectorType: 'USB-C',
    standards: ['USB-3.x'],
    maxLengthMeters: 30,
    color: '#7c3aed',
    notesKey: 'catalog.cable.usbc-aoc.notes',
  },
]

/** Same physical connector families that can be connected directly without an adapter. */
const CONNECTOR_FAMILIES: ConnectorType[][] = [
  ['IEC 230V', 'PowerCON', 'Schuko 230V', 'C7 Eurostecker'], // all 230V, but NOT directly compatible without adapter
]

/** Connectors that are physically identical and plug into each other directly. */
const DIRECTLY_MATING: ConnectorType[][] = [
  // BNC and historic 'SDI' were separate entries; they are now unified under 'BNC'.
]

export const connectorsAreDirectlyMating = (a: ConnectorType, b: ConnectorType): boolean => {
  if (a === b) return true
  return DIRECTLY_MATING.some((group) => group.includes(a) && group.includes(b))
}

export const connectorsShareFamily = (a: ConnectorType, b: ConnectorType): boolean => {
  if (a === b) return true
  return CONNECTOR_FAMILIES.some((group) => group.includes(a) && group.includes(b))
}

export type CompatibilityLevel = 'ok' | 'warn' | 'error'

export interface CompatibilityResult {
  level: CompatibilityLevel
  message: string
}

/**
 * Decide whether a cable can connect the two given connector types and whether
 * a converter/scaler is likely required.
 */
export const checkCableCompatibility = (
  from: ConnectorType,
  to: ConnectorType,
  cable: CableSpec,
): CompatibilityResult => {
  const cableConnector = cable.connectorType
  const acceptable = new Set<ConnectorType>([cableConnector, ...(cable.compatibleConnectors ?? [])])

  const fromOk = acceptable.has(from)
  const toOk = acceptable.has(to)

  if (!fromOk || !toOk) {
    return {
      level: 'error',
      message: `Cable "${cable.name}" (${cableConnector}) cannot connect ${from} to ${to}.`,
    }
  }

  if (!connectorsAreDirectlyMating(from, to)) {
    return {
      level: 'warn',
      message: `${from} and ${to} use similar signalling but need an adapter.`,
    }
  }

  return { level: 'ok', message: `${cable.name} matches ${from} ↔ ${to}.` }
}

/**
 * For SDI specifically: flag speed mismatches that require a scaler.
 */
export const checkSdiStandardMismatch = (
  fromStandard: SignalStandard | undefined,
  toStandard: SignalStandard | undefined,
): CompatibilityResult | null => {
  const sdi = new Set<SignalStandard>(['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'])
  if (!fromStandard || !toStandard) return null
  if (!sdi.has(fromStandard) || !sdi.has(toStandard)) return null
  if (fromStandard === toStandard) return { level: 'ok', message: `${fromStandard} matched.` }

  const rank: Record<string, number> = {
    'SDI-SD': 1,
    'SDI-HD': 2,
    'SDI-3G': 3,
    'SDI-6G': 4,
    'SDI-12G': 5,
  }
  const a = rank[fromStandard]
  const b = rank[toStandard]
  if (a !== b) {
    return {
      level: 'warn',
      message: `SDI speed mismatch (${fromStandard} ↔ ${toStandard}). A scaler/converter is required.`,
    }
  }
  return null
}

/**
 * #390 — Nenn-Impedanz eines Signalstandards in Ω.
 *  75  = SDI / DVB-ASI / Video-BNC / AES3id / optisches SDI (SMPTE-297)
 *  50  = HF / Antenne (RF-*)
 *  110 = AES3 (AES/EBU über XLR)
 *  undefined = nicht impedanz-relevant (HDMI, Ethernet, Power, …).
 */
export const impedanceForStandard = (s: SignalStandard | undefined): 50 | 75 | 110 | undefined => {
  if (!s) return undefined
  if (
    s.startsWith('SDI') ||
    s === 'DVB-ASI' ||
    s === 'AES3id' ||
    s === 'CVBS' ||
    s === 'Y/C' ||
    s === 'YPbPr' ||
    s === 'SMPTE-297'
  )
    return 75
  if (s.startsWith('RF-')) return 50
  if (s === 'AES3') return 110
  return undefined
}

/**
 * #346 — Grobe Brutto-Bandbreite (Mbps) eines IP-/Netzwerk-Mediensignals,
 * für das Projekt-Netzwerk-Budget. Nur Standards, die sich ein Ethernet-/
 * IP-Netz teilen, liefern einen Wert; punkt-zu-punkt-Signale (SDI/HDMI/USB)
 * und Strom/Analog → undefined (zählen nicht ins Netzwerk-Budget).
 * Werte sind Richtwerte (1080p50/60, 48 kHz, 64 Kanäle).
 */
export const bandwidthMbpsForStandard = (s: SignalStandard | undefined): number | undefined => {
  switch (s) {
    case 'NDI':
      return 250 // NDI Full 1080p ~125–250
    case 'NDI-HX':
      return 20
    case 'Dante':
    case 'AES67':
    case 'ST2110-30':
      return 49 // 64ch @48k/24bit
    case 'ST2110-40':
      return 2 // ANC/Metadaten
    case 'ST2110-20':
      return 3000 // 1080p unkomprimiert (≈2160p → 12000)
    case 'Eth-100':
      return 100
    case 'Eth-1G':
      return 1000
    case 'Eth-10G':
      return 10000
    default:
      return undefined
  }
}

/**
 * #367 — Praktische passive Maximal-Länge (m) je Signalstandard auf
 * Kupfer/Standardkabel. Darüber drohen Ausfälle → aktive Lösung (AOC,
 * HDBaseT, Extender, Glasfaser). undefined = keine relevante Längengrenze
 * (z. B. Netzwerk/Glasfaser/Strom/Analog-Audio). Richtwerte aus der Praxis.
 */
export const maxPassiveLengthM = (s: SignalStandard | undefined): number | undefined => {
  switch (s) {
    case 'HDMI-1.4':
      return 15
    case 'HDMI-2.0':
      return 10
    case 'HDMI-2.1':
      return 5
    case 'DP-1.2':
      return 5
    case 'DP-1.4':
      return 3
    case 'DP-2.0':
      return 2
    case 'USB-2.0':
      return 5
    case 'USB-3.x':
      return 3
    case 'Thunderbolt-3':
    case 'Thunderbolt-4':
      return 2 // passiv ~0,8 m, aktiv bis ~2 m
    case 'SDI-12G':
      return 70
    case 'SDI-6G':
      return 90
    case 'SDI-3G':
      return 120
    case 'SDI-HD':
      return 140
    default:
      return undefined
  }
}

/**
 * #390 — Warnung bei Impedanz-Mismatch entlang einer Verbindung
 * (z. B. 50Ω-HF-Kabel an 75Ω-SDI → Reflexionen/Return-Loss).
 */
export const checkImpedanceMismatch = (
  fromStandard: SignalStandard | undefined,
  toStandard: SignalStandard | undefined,
): CompatibilityResult | null => {
  const a = impedanceForStandard(fromStandard)
  const b = impedanceForStandard(toStandard)
  if (a == null || b == null || a === b) return null
  return {
    level: 'warn',
    message: `Impedance mismatch: ${a}Ω ↔ ${b}Ω. Reflections/return loss — use a matching cable/adapter.`,
  }
}

/**
 * #380 — Symmetrie eines Audio-Anschlusses: balanced (XLR/Mini-XLR/TT-Bantam)
 * vs. unbalanced (Cinch/SCART). Klinke ist bewusst undefined (TRS=symm. /
 * TS=unsymm. mehrdeutig). undefined = nicht audio-symmetrie-relevant.
 */
export const balanceForConnector = (
  c: ConnectorType | undefined,
): 'balanced' | 'unbalanced' | undefined => {
  if (!c) return undefined
  if (c === 'XLR' || c === 'Mini-XLR' || c === 'TT/Bantam') return 'balanced'
  if (c === 'Cinch/RCA' || c === 'SCART') return 'unbalanced'
  return undefined
}

/**
 * #380 — Warnung beim Übergang symmetrisch ↔ unsymmetrisch (Brumm-/Pegel-
 * Probleme; ein DI/Übertrager wird empfohlen).
 */
export const checkBalanceMismatch = (
  from: ConnectorType | undefined,
  to: ConnectorType | undefined,
): CompatibilityResult | null => {
  const a = balanceForConnector(from)
  const b = balanceForConnector(to)
  if (!a || !b || a === b) return null
  return {
    level: 'warn',
    message: `Balanced ↔ unbalanced transition (${from} ↔ ${to}). Use a DI box / transformer to avoid hum and level loss.`,
  }
}
