import type { EquipmentTemplate, Port } from '../types/equipment'

// GreenGo intercom equipment templates for rental catalog matching.
// Covers the GreenGo product line: MCX station, XTBB/XTBD beltpacks,
// BPXSP beltpack X, WBPX wireless beltpack X, and Antenna X.
// The XLR-5 bus connector is mapped to 'Custom' (not a standard
// broadcast connector), labelled clearly in the port name.

const port = (
  name: string,
  connectorType: Port['connectorType'] = 'Custom',
): Port => ({ id: '', name, type: connectorType, connectorType })

const xlr5 = (name: string) => port(name, 'Custom')   // 5-pin XLR bus
const xlr   = (name: string) => port(name, 'XLR')     // 3-pin XLR headset/line
const eth   = (name: string) => port(name, 'Ethernet/RJ45')

const INTERCOM = 'Intercom'

interface GreenGoEntry {
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

export const GREENGO_CATALOG: GreenGoEntry[] = [

  // ── GreenGo MCX – MultiChannel Extension (main station, 19" 1U) ─────────
  // Central controller of a GreenGo system.
  // 8× XLR-5 beltpack bus ports, 2× Ethernet, 4× XLR analog, GPIO DB-9.
  // Rentman names: "GreenGo MCX", "GreenGo Multi-Channel Extension"
  {
    match: ['greengo', 'mcx'],
    template: {
      name: 'GreenGo MCX',
      category: INTERCOM,
      inputs: [
        xlr5('XLR-5 Bus 1 (Beltpack In)'),
        xlr5('XLR-5 Bus 2 (Beltpack In)'),
        xlr5('XLR-5 Bus 3 (Beltpack In)'),
        xlr5('XLR-5 Bus 4 (Beltpack In)'),
        xlr5('XLR-5 Bus 5 (Beltpack In)'),
        xlr5('XLR-5 Bus 6 (Beltpack In)'),
        xlr5('XLR-5 Bus 7 (Beltpack In)'),
        xlr5('XLR-5 Bus 8 (Beltpack In)'),
        xlr('Analog In 1 (XLR)'),
        xlr('Analog In 2 (XLR)'),
        eth('Ethernet Management'),
      ],
      outputs: [
        xlr5('XLR-5 Bus 1 (Beltpack Out)'),
        xlr5('XLR-5 Bus 2 (Beltpack Out)'),
        xlr5('XLR-5 Bus 3 (Beltpack Out)'),
        xlr5('XLR-5 Bus 4 (Beltpack Out)'),
        xlr5('XLR-5 Bus 5 (Beltpack Out)'),
        xlr5('XLR-5 Bus 6 (Beltpack Out)'),
        xlr5('XLR-5 Bus 7 (Beltpack Out)'),
        xlr5('XLR-5 Bus 8 (Beltpack Out)'),
        xlr('Analog Out 1 (XLR)'),
        xlr('Analog Out 2 (XLR)'),
      ],
      width: 240, height: 360,
    },
  },

  // ── GreenGo XTBB / XTBD – Compact beltpack ──────────────────────────────
  // Belt-worn (XTBB) or desktop (XTBD) beltpack with encoder wheel.
  // Rentman: "GreenGo XTBB", "GreenGo XTBD", "GreenGo Extension Telephone"
  {
    match: ['greengo', 'xtbb'],
    template: {
      name: 'GreenGo XTBB',
      category: INTERCOM,
      inputs: [
        xlr5('XLR-5 Bus (von MCX)'),
      ],
      outputs: [
        xlr('Headset Out (XLR-3)'),
      ],
      width: 180, height: 120,
    },
  },
  {
    match: ['greengo', 'xtbd'],
    template: {
      name: 'GreenGo XTBD',
      category: INTERCOM,
      inputs: [
        xlr5('XLR-5 Bus (von MCX)'),
      ],
      outputs: [
        xlr('Headset Out (XLR-3)'),
        xlr('Speaker Out (XLR-3)'),
      ],
      width: 180, height: 140,
    },
  },

  // ── GreenGo BPXSP – Beltpack X Special ──────────────────────────────────
  // Larger multi-button desktop/belt beltpack with GPIO and line I/O.
  // Rentman: "GreenGo BPXSP", "GreenGo Beltpack X"
  {
    match: ['greengo', 'bpxsp'],
    template: {
      name: 'GreenGo BPXSP',
      category: INTERCOM,
      inputs: [
        xlr5('XLR-5 Bus (von MCX)'),
        xlr('Line In (XLR-3)'),
      ],
      outputs: [
        xlr('Headset Out 1 (XLR-3)'),
        xlr('Headset Out 2 (XLR-3)'),
        xlr('Line Out (XLR-3)'),
      ],
      width: 200, height: 200,
    },
  },

  // ── GreenGo WBPX – Wireless Beltpack X ──────────────────────────────────
  // DECT wireless beltpack; no cable ports, connects via Antenna X.
  // Rentman: "GreenGo WBPX", "GreenGo Wireless Beltpack"
  {
    match: ['greengo', 'wbpx'],
    template: {
      name: 'GreenGo WBPX',
      category: INTERCOM,
      inputs: [],
      outputs: [
        xlr('Headset Out (XLR-3)'),
      ],
      width: 180, height: 100,
    },
  },
  {
    match: ['greengo', 'wireless beltpack'],
    template: {
      name: 'GreenGo Wireless Beltpack X',
      category: INTERCOM,
      inputs: [],
      outputs: [
        xlr('Headset Out (XLR-3)'),
      ],
      width: 200, height: 100,
    },
  },

  // ── GreenGo Antenna X – DECT antenna ────────────────────────────────────
  // Wireless antenna unit for WBPX beltpacks.
  // Rentman: "GreenGo Antenna", "GreenGo Antenna X"
  {
    match: ['greengo', 'antenna'],
    template: {
      name: 'GreenGo Antenna X',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (Netzwerk)'),
      ],
      outputs: [
        eth('Ethernet (Netzwerk)'),
      ],
      width: 180, height: 100,
    },
  },
]

/** Flat list of EquipmentTemplate objects, suitable for library seeding. */
export const greengoTemplates: EquipmentTemplate[] = GREENGO_CATALOG.map((e) => e.template)

/**
 * Try to match an equipment name against the GreenGo catalog.
 * Returns the first matching template or undefined.
 */
export const matchGreenGoTemplate = (name: string): EquipmentTemplate | undefined => {
  const lower = name.toLowerCase()
  return GREENGO_CATALOG.find((entry) =>
    entry.match.every((fragment) => lower.includes(fragment)),
  )?.template
}
