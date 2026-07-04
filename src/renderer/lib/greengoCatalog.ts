import type { EquipmentTemplate, Port } from '../types/equipment'

// GreenGo intercom equipment templates for rental catalog matching.
// GreenGo is a fully IP-based intercom system — all devices connect via
// standard Ethernet. The MCX/MCXD provide analog program I/O via XLR-3.
// Belt packs connect to the network (wired via RJ45, wireless via DECT).
// The 5-pin XLR (XLR-5) is used only for headset connections on beltpacks.

const port = (
  name: string,
  connectorType: Port['connectorType'] = 'Custom',
): Port => ({ id: '', name, type: connectorType, connectorType })

const xlr5 = (name: string) => port(name, 'Custom')   // 5-pin XLR headset
const xlr   = (name: string) => port(name, 'XLR')     // 3-pin XLR analog
const eth   = (name: string) => port(name, 'Ethernet/RJ45')

const INTERCOM = 'Intercom'

interface GreenGoEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Lowercase substrings that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: GreenGoEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

export const GREENGO_CATALOG: GreenGoEntry[] = [

  // ── GreenGo MCXD – MultiChannel Extension Desktop ───────────────────────
  // Desktop station/master unit. IP-based, connects via Ethernet.
  // Has display, encoder wheel, 2× RJ45, 2× XLR-3 analog I/O.
  // MUST be listed BEFORE MCX so 'mcxd' does not match the 'mcx' entry.
  // Rentman names: "GreenGo MCXD"
  {
    match: ['greengo', 'mcxd'],
    deviceTypeId: '45db5d78-2270-4e5f-8b5e-da2212d15c33',
    template: {
      name: 'GreenGo MCXD',
      category: INTERCOM,
      inputs: [
        eth('Ethernet 1 (RJ45)'),
        eth('Ethernet 2 (RJ45)'),
        xlr('Analog In 1 (XLR-3)'),
        xlr('Analog In 2 (XLR-3)'),
        xlr5('Headset (XLR-5)'),
      ],
      outputs: [
        xlr('Analog Out 1 (XLR-3)'),
        xlr('Analog Out 2 (XLR-3)'),
      ],
      width: 220, height: 220,
    },
  },

  // ── GreenGo MCX – MultiChannel Extension (19" 1U rack) ──────────────────
  // Central IP-based controller/master unit. Connects via Ethernet.
  // Provides program analog I/O. Devices join the system over the network.
  // Rentman names: "GreenGo MCX", "GreenGo Multi-Channel Extension"
  {
    match: ['greengo', 'mcx'],
    deviceTypeId: '3f91811f-8b35-498c-8abe-9b7dcacd9658',
    template: {
      name: 'GreenGo MCX',
      category: INTERCOM,
      inputs: [
        eth('Ethernet 1 (RJ45)'),
        eth('Ethernet 2 (RJ45)'),
        xlr('Analog In 1 (XLR-3)'),
        xlr('Analog In 2 (XLR-3)'),
      ],
      outputs: [
        xlr('Analog Out 1 (XLR-3)'),
        xlr('Analog Out 2 (XLR-3)'),
      ],
      width: 220, height: 200,
    },
  },

  // ── GreenGo BPX – Beltpack X (wired) ────────────────────────────────────
  // Multi-button wired beltpack, connects via Ethernet RJ45.
  // Headset via XLR-5 (5-pin). Up to 18 assignable talk buttons.
  // Rentman names: "GreenGo BPX", "GreenGo Beltpack X"
  {
    match: ['greengo', 'bpx'],
    deviceTypeId: '6438a81a-49b3-48da-a1f2-476b71b040cc',
    template: {
      name: 'GreenGo BPX',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (RJ45)'),
      ],
      outputs: [
        xlr5('Headset (XLR-5)'),
      ],
      width: 180, height: 120,
    },
  },

  // ── GreenGo BPXSP – Beltpack X Special ──────────────────────────────────
  // Extended wired beltpack with GPIO and line I/O, connects via Ethernet.
  // Rentman: "GreenGo BPXSP"
  {
    match: ['greengo', 'bpxsp'],
    deviceTypeId: '278c8bd0-77d7-4ab2-80cf-c66b8440beb4',
    template: {
      name: 'GreenGo BPXSP',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (RJ45)'),
        xlr('Line In (XLR-3)'),
      ],
      outputs: [
        xlr5('Headset 1 (XLR-5)'),
        xlr5('Headset 2 (XLR-5)'),
        xlr('Line Out (XLR-3)'),
      ],
      width: 200, height: 200,
    },
  },

  // ── GreenGo WBPX – Wireless Beltpack X ──────────────────────────────────
  // DECT wireless beltpack. No cable to the network — connects wirelessly
  // via an Antenna X. Headset via XLR-5.
  // Rentman: "GreenGo WBPX", "GreenGo Wireless Beltpack"
  {
    match: ['greengo', 'wbpx'],
    deviceTypeId: '3a3159c7-713a-4e9c-9441-3b6b62655f10',
    template: {
      name: 'GreenGo WBPX',
      category: INTERCOM,
      inputs: [],
      outputs: [
        xlr5('Headset (XLR-5)'),
      ],
      width: 180, height: 100,
    },
  },
  {
    match: ['greengo', 'wireless beltpack'],
    deviceTypeId: '18772c9b-8d92-4e80-a7b2-d51ad09dc727',
    template: {
      name: 'GreenGo Wireless Beltpack X',
      category: INTERCOM,
      inputs: [],
      outputs: [
        xlr5('Headset (XLR-5)'),
      ],
      width: 200, height: 100,
    },
  },

  // ── GreenGo XTBB / XTBD – Compact beltpack ──────────────────────────────
  // Belt-worn (XTBB) or desktop (XTBD) compact beltpack, encoder wheel.
  // Rentman: "GreenGo XTBB", "GreenGo XTBD"
  {
    match: ['greengo', 'xtbb'],
    deviceTypeId: '44b2c619-ff85-43bf-aef5-4b7e246c1b1d',
    template: {
      name: 'GreenGo XTBB',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (RJ45)'),
      ],
      outputs: [
        xlr5('Headset (XLR-5)'),
      ],
      width: 180, height: 120,
    },
  },
  {
    match: ['greengo', 'xtbd'],
    deviceTypeId: 'da0967cd-057c-415f-95fd-5d353b072a8f',
    template: {
      name: 'GreenGo XTBD',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (RJ45)'),
      ],
      outputs: [
        xlr5('Headset (XLR-5)'),
        xlr('Speaker Out (XLR-3)'),
      ],
      width: 180, height: 140,
    },
  },

  // ── GreenGo Antenna X – DECT antenna ────────────────────────────────────
  // Wireless access point for WBPX beltpacks. Connects to the network via RJ45.
  // Rentman: "GreenGo Antenna", "GreenGo Antenna X"
  {
    match: ['greengo', 'antenna'],
    deviceTypeId: '63bec60d-8447-4062-9ea0-1cf79b5bb493',
    template: {
      name: 'GreenGo Antenna X',
      category: INTERCOM,
      inputs: [
        eth('Ethernet (RJ45)'),
      ],
      outputs: [
        eth('Ethernet (RJ45, Daisy-Chain)'),
      ],
      width: 180, height: 120,
    },
  },
]

/** Flat list of EquipmentTemplate objects, suitable for library seeding. */
export const greengoTemplates: EquipmentTemplate[] = GREENGO_CATALOG.map(withTypeId)

/**
 * Try to match an equipment name against the GreenGo catalog.
 * Returns the first matching template or undefined.
 */
export const matchGreenGoTemplate = (name: string): EquipmentTemplate | undefined => {
  const lower = name.toLowerCase()
  const entry = GREENGO_CATALOG.find((e) =>
    e.match.every((fragment) => lower.includes(fragment)),
  )
  return entry ? withTypeId(entry) : undefined
}
