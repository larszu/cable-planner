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
  | 'USB-2.0'
  | 'USB-3.x'
  | 'Power-230V'
  | 'Fiber-SM'
  | 'Fiber-MM'
  | 'Generic'

/** All valid signal standard values in display order. */
export const ALL_SIGNAL_STANDARDS: SignalStandard[] = [
  'SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G',
  'HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1',
  'DP-1.2', 'DP-1.4', 'DP-2.0',
  'Eth-100', 'Eth-1G', 'Eth-10G',
  'Analog-Audio', 'AES3', 'USB-2.0', 'USB-3.x',
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
  notes?: string
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
    notes: 'Balanced analog audio or AES3 (digital). Gender: male → female.',
  },
  {
    id: 'sdi-3g',
    name: 'SDI 3G (1080p50/60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G'],
    maxLengthMeters: 100,
    color: '#f59e0b',
    notes: 'Works for SD/HD/3G. Use 75Ω coax (Belden 1694A or similar).',
  },
  {
    id: 'sdi-6g',
    name: 'SDI 6G (4K30 4:2:0)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G'],
    maxLengthMeters: 70,
    color: '#f97316',
    notes: '6G needs higher-quality coax; mix with 3G only via down-converter.',
  },
  {
    id: 'sdi-12g',
    name: 'SDI 12G (4K60)',
    connectorType: 'BNC',
    standards: ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G'],
    maxLengthMeters: 50,
    color: '#ef4444',
    notes: 'Use 4K-rated 12G coax (e.g. Belden 4694R). Downscale to 3G requires a scaler/converter.',
  },
  {
    id: 'hdmi-2.0',
    name: 'HDMI 2.0 (4K60 4:4:4)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0'],
    maxLengthMeters: 10,
    color: '#a855f7',
    notes: 'Passive copper limited to ~10 m; use optical HDMI for longer runs.',
  },
  {
    id: 'hdmi-2.1',
    name: 'HDMI 2.1 (8K/4K120)',
    connectorType: 'HDMI',
    standards: ['HDMI-1.4', 'HDMI-2.0', 'HDMI-2.1'],
    maxLengthMeters: 5,
    color: '#c084fc',
    notes: 'Ultra-high speed cables required; pairing with HDMI 1.4 device limits to 1.4.',
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
    notes: 'Required for 10GBASE-T over full 100 m runs.',
  },
  {
    id: 'fiber-sm-lc',
    name: 'Fiber SM (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-SM'],
    maxLengthMeters: 10000,
    color: '#eab308',
    notes: 'Single-mode (yellow jacket). Long distance (>300 m).',
  },
  {
    id: 'fiber-mm-lc',
    name: 'Fiber MM OM4 (LC)',
    connectorType: 'Fiber',
    standards: ['Fiber-MM'],
    maxLengthMeters: 400,
    color: '#facc15',
    notes: 'Multi-mode (aqua jacket). Short haul in racks/venue.',
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
    notes: 'Standard device power cable ("kettle lead").',
  },
  {
    id: 'powercon-tru1',
    name: 'powerCON TRUE1',
    connectorType: 'PowerCON',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#0ea5e9',
    notes: 'Locking, touring-grade power. Do not mix with classic powerCON (grey/blue).',
  },
  {
    id: 'schuko-230v',
    name: 'Schuko 230V',
    connectorType: 'Schuko 230V',
    standards: ['Power-230V'],
    maxLengthMeters: 25,
    color: '#334155',
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
