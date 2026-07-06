import type { EquipmentTemplate, Port } from '../types/equipment'

// Ubiquiti EdgeRouter / EdgeSwitch / UniFi Switch templates based on the
// official datasheets / ui.com spec pages. Matched by name substrings so
// Rentman items like "Ubiquiti EdgeSwitch ES-24-500W" resolve to this
// template during import, and they're also seeded into the library so the
// user can drag them onto the canvas without Rentman.

const port = (name: string, connectorType: Port['connectorType'] = 'Ethernet/RJ45'): Port => ({
  id: '',
  name,
  type: connectorType,
  connectorType,
})

const rj45 = (n: number, prefix = 'Port') =>
  Array.from({ length: n }, (_, i) => port(`${prefix} ${i + 1}`, 'Ethernet/RJ45'))
const sfp = (n: number, prefix = 'SFP') =>
  Array.from({ length: n }, (_, i) => port(`${prefix} ${i + 1}`, 'Fiber'))

interface UbiquitiEntry {
  /** Stabile Geraetetyp-Identitaet (GUID, GDTF/DIN-SPEC-15800-analog:
   *  FixtureTypeID). Autoritativer Schluessel fuer Import/Aufloesung —
   *  versionsstabil, unabhaengig vom Modellnamen. */
  deviceTypeId: string
  /** Autoritative Netzwerk-Rolle laut Datenblatt (Switch/Router) — ersetzt
   *  fuer Katalog-Geraete die Namens-Heuristik in detectNetworkDevice. */
  networkKind: 'switch' | 'router'
  /** Name patterns (lowercased) that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

/** Katalog-Template inkl. seiner stabilen Geraetetyp-ID. */
const withTypeId = (e: UbiquitiEntry): EquipmentTemplate => ({
  ...e.template,
  deviceTypeId: e.deviceTypeId,
})

const NET = 'Netzwerk'

export const UBIQUITI_CATALOG: UbiquitiEntry[] = [
  // ---------- EdgeRouter ----------
  {
    match: ['edgerouter', 'x-sfp'],
    deviceTypeId: 'f945c3ab-97bf-4831-8e5f-85a70e9e335f',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter X SFP (ER-X-SFP)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [
        ...rj45(4, 'eth').slice(0, 4).map((p, i) => ({ ...p, name: `eth${i + 1}` })),
        port('eth5 SFP', 'Fiber'),
      ],
      width: 240,
      height: 200,
    },
  },
  {
    match: ['edgerouter', 'er-x'],
    deviceTypeId: 'a944d18d-b28d-4ae5-9256-cade48807bd6',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter X (ER-X)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: Array.from({ length: 4 }, (_, i) => port(`eth${i + 1}`, 'Ethernet/RJ45')),
      width: 220,
      height: 180,
    },
  },
  {
    match: ['edgerouter', 'lite'],
    deviceTypeId: 'eca7eae0-a59c-4314-8b9e-ded8148eb2ee',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter Lite (ERLite-3)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [port('eth1', 'Ethernet/RJ45'), port('eth2', 'Ethernet/RJ45')],
      width: 220,
      height: 160,
    },
  },
  {
    match: ['edgerouter', 'poe'],
    deviceTypeId: 'deaa3398-f480-4aa2-b78d-18658938ca80',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter PoE (ERPoe-5)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: Array.from({ length: 4 }, (_, i) => port(`eth${i + 1} (PoE)`, 'Ethernet/RJ45')),
      width: 240,
      height: 180,
    },
  },
  {
    match: ['edgerouter', 'er-4'],
    deviceTypeId: 'c19471db-d117-4aeb-a59d-8d923865ff18',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter 4 (ER-4)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [
        port('eth1', 'Ethernet/RJ45'),
        port('eth2', 'Ethernet/RJ45'),
        port('eth3 SFP', 'Fiber'),
      ],
      width: 240,
      height: 180,
    },
  },
  {
    match: ['edgerouter', 'er-6p'],
    deviceTypeId: 'c1e4beb7-cb31-4c08-aa3d-ef4cd57d213f',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter 6P (ER-6P)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`eth${i + 1} (PoE)`, 'Ethernet/RJ45')),
        port('eth5 SFP', 'Fiber'),
      ],
      width: 240,
      height: 200,
    },
  },
  {
    match: ['edgerouter', 'er-8'],
    deviceTypeId: 'f673d842-0fca-47b4-b78e-76dec0499180',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter 8 (ER-8)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: Array.from({ length: 7 }, (_, i) => port(`eth${i + 1}`, 'Ethernet/RJ45')),
      width: 260,
      height: 240,
    },
  },
  {
    match: ['edgerouter', 'er-12'],
    deviceTypeId: '31807207-35f8-4ac8-8618-73179b68d3e9',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter 12 (ER-12)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [
        ...Array.from({ length: 9 }, (_, i) => port(`eth${i + 1}`, 'Ethernet/RJ45')),
        port('eth10 SFP', 'Fiber'),
        port('eth11 SFP', 'Fiber'),
      ],
      width: 260,
      height: 280,
    },
  },
  {
    match: ['edgerouter', 'pro'],
    deviceTypeId: '3f75230c-f85f-44a1-8554-a0a5cf74a381',
    networkKind: 'router',
    template: {
      name: 'Ubiquiti EdgeRouter Pro (ERPro-8)',
      category: NET,
      inputs: [port('eth0 (WAN)', 'Ethernet/RJ45')],
      outputs: [
        ...Array.from({ length: 5 }, (_, i) => port(`eth${i + 1}`, 'Ethernet/RJ45')),
        port('eth6 SFP', 'Fiber'),
        port('eth7 SFP', 'Fiber'),
      ],
      width: 260,
      height: 260,
    },
  },

  // ---------- EdgeSwitch ----------
  {
    match: ['edgeswitch', 'es-5xp'],
    deviceTypeId: '9f68e56a-44a6-414d-ab4d-184aba204c4f',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 5XP (ES-5XP)',
      category: NET,
      inputs: [port('Uplink', 'Ethernet/RJ45')],
      outputs: rj45(4, 'Port'),
      width: 220,
      height: 180,
    },
  },
  {
    match: ['edgeswitch', 'es-8xp'],
    deviceTypeId: 'c29a476f-1fa8-4c94-b09c-ae24d47bb008',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 8XP (ES-8XP)',
      category: NET,
      inputs: [port('Uplink', 'Ethernet/RJ45')],
      outputs: rj45(7, 'Port'),
      width: 240,
      height: 240,
    },
  },
  {
    match: ['edgeswitch', 'es-16-xg'],
    deviceTypeId: '0a9c1fb4-d6e8-450e-8674-9ffc119dc4ab',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 16 XG (ES-16-XG)',
      category: NET,
      inputs: [],
      outputs: [...rj45(4, '10G RJ45'), ...sfp(12, 'SFP+')],
      width: 260,
      height: 340,
    },
  },
  {
    match: ['edgeswitch', 'es-16-150', '16 poe', '16-poe'],
    deviceTypeId: '87b85e9c-c7bd-4c8c-81cd-7f0ec8ead855',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 16 150W PoE (ES-16-150W)',
      category: NET,
      inputs: [],
      outputs: [...rj45(16, 'PoE Port'), ...sfp(2, 'SFP')],
      width: 260,
      height: 380,
    },
  },
  {
    match: ['edgeswitch', 'es-24-250'],
    deviceTypeId: '6633983d-82d3-444e-93e0-5090cbe958d4',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 24-250W PoE (ES-24-250W)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'PoE Port'), ...sfp(2, 'SFP')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['edgeswitch', 'es-24-500'],
    deviceTypeId: '60ef85fb-7c1f-4675-8f2e-59633d2acc0a',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 24-500W PoE (ES-24-500W)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'PoE Port'), ...sfp(2, 'SFP')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['edgeswitch', 'es-24'],
    deviceTypeId: '4e1076a5-38a7-4167-b471-099b435c7e4a',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 24 (ES-24-Lite)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'Port'), ...sfp(2, 'SFP')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['edgeswitch', 'es-48-500'],
    deviceTypeId: 'f57ae1ee-7c55-4cf3-98f1-5fc0cd996e76',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 48-500W PoE (ES-48-500W)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'PoE Port'), ...sfp(2, 'SFP'), ...sfp(2, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['edgeswitch', 'es-48-750'],
    deviceTypeId: '83cbc3bd-0beb-4744-9c5c-c1e910eb8a9f',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 48-750W PoE (ES-48-750W)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'PoE Port'), ...sfp(2, 'SFP'), ...sfp(2, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['edgeswitch', 'es-48'],
    deviceTypeId: 'ed688896-6fd4-41b8-9262-3becd47e2f4e',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch 48 (ES-48-Lite)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'Port'), ...sfp(2, 'SFP'), ...sfp(2, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['edgeswitch', 'es-xg-48'],
    deviceTypeId: '1be4883f-3092-44c1-a1fc-ffeae2feb662',
    networkKind: 'switch',
    template: {
      name: 'Ubiquiti EdgeSwitch XG 48 (ES-XG-48)',
      category: NET,
      inputs: [],
      outputs: [...sfp(48, 'SFP+'), ...sfp(6, 'QSFP+')],
      width: 320,
      height: 900,
    },
  },

  // ---------- UniFi Dream Machine ----------
  {
    match: ['unifi', 'dream', 'machine', 'pro'],
    deviceTypeId: '50d8750e-78f1-4307-8521-0f160aff2a32',
    networkKind: 'router',
    template: {
      name: 'UniFi Dream Machine Pro (UDM-Pro)',
      category: NET,
      inputs: [
        port('WAN RJ45', 'Ethernet/RJ45'),
        port('WAN SFP+', 'Fiber'),
      ],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`LAN ${i + 1}`, 'Ethernet/RJ45')),
        port('LAN 9 SFP+', 'Fiber'),
        port('LAN 10 SFP+', 'Fiber'),
      ],
      width: 280,
      height: 280,
    },
  },
  {
    match: ['unifi', 'dream', 'machine', 'se'],
    deviceTypeId: 'aa6aa69d-830a-477b-85b3-26438638e2f0',
    networkKind: 'router',
    template: {
      name: 'UniFi Dream Machine SE (UDM-SE)',
      category: NET,
      inputs: [port('WAN RJ45', 'Ethernet/RJ45'), port('WAN SFP+', 'SFP+')],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`LAN ${i + 1} (PoE)`, 'Ethernet/RJ45')),
        port('LAN 9 SFP+', 'SFP+'),
        port('LAN 10 SFP+', 'SFP+'),
      ],
      width: 280,
      height: 280,
    },
  },
  {
    match: ['unifi', 'dream', 'machine'],
    deviceTypeId: '6ce4a796-9685-476a-aa6e-376fc7bb40fa',
    networkKind: 'router',
    template: {
      name: 'UniFi Dream Machine (UDM)',
      category: NET,
      inputs: [port('WAN', 'Ethernet/RJ45')],
      outputs: Array.from({ length: 4 }, (_, i) => port(`LAN ${i + 1}`, 'Ethernet/RJ45')),
      width: 240,
      height: 200,
    },
  },

  // ---------- UniFi Switches ----------
  {
    match: ['unifi', 'switch', 'flex', 'mini'],
    deviceTypeId: '977354f3-cfee-4320-857e-729f9b4432eb',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Flex Mini (USW-Flex-Mini)',
      category: NET,
      inputs: [port('Port 1 (PoE PD)', 'Ethernet/RJ45')],
      outputs: rj45(4, 'Port').slice(1).map((p, i) => ({ ...p, name: `Port ${i + 2}` })),
      width: 220,
      height: 180,
    },
  },
  {
    match: ['unifi', 'switch', 'flex'],
    deviceTypeId: 'f701cb33-1fd5-4a34-aa0a-3fbe7a329f65',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Flex (USW-Flex)',
      category: NET,
      inputs: [port('Port 1 (PoE PD)', 'Ethernet/RJ45')],
      outputs: rj45(4, 'PoE Port').slice(1).map((p, i) => ({ ...p, name: `Port ${i + 2} PoE` })),
      width: 220,
      height: 180,
    },
  },
  {
    match: ['unifi', 'switch', 'lite', '8'],
    deviceTypeId: '124333c1-fcc6-4729-8312-6fa0f01e07b8',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Lite 8 PoE (USW-Lite-8-PoE)',
      category: NET,
      inputs: [],
      outputs: [
        ...Array.from({ length: 4 }, (_, i) => port(`Port ${i + 1} PoE`, 'Ethernet/RJ45')),
        ...Array.from({ length: 4 }, (_, i) => port(`Port ${i + 5}`, 'Ethernet/RJ45')),
      ],
      width: 240,
      height: 240,
    },
  },
  {
    match: ['unifi', 'switch', 'lite', '16'],
    deviceTypeId: '54fbdd37-4b9b-4aa3-907c-a7089e03e0cb',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Lite 16 PoE (USW-Lite-16-PoE)',
      category: NET,
      inputs: [],
      outputs: [
        ...Array.from({ length: 8 }, (_, i) => port(`Port ${i + 1} PoE`, 'Ethernet/RJ45')),
        ...Array.from({ length: 8 }, (_, i) => port(`Port ${i + 9}`, 'Ethernet/RJ45')),
      ],
      width: 260,
      height: 360,
    },
  },
  {
    match: ['unifi', 'switch', 'pro', '24', 'poe'],
    deviceTypeId: '3b8daa48-3750-4129-9014-d87fe1629773',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Pro 24 PoE (USW-Pro-24-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'PoE Port'), ...sfp(2, 'SFP+')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['unifi', 'switch', 'pro', '24'],
    deviceTypeId: '19489d15-8b15-4f55-bcfb-4405173b0978',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Pro 24 (USW-Pro-24)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'Port'), ...sfp(2, 'SFP+')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['unifi', 'switch', 'pro', '48', 'poe'],
    deviceTypeId: '42d015f3-1583-41cc-a8ca-e5ecb79fe832',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Pro 48 PoE (USW-Pro-48-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'PoE Port'), ...sfp(4, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['unifi', 'switch', 'pro', '48'],
    deviceTypeId: 'cdda87a7-168d-4033-b244-d685cdd9712a',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Pro 48 (USW-Pro-48)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'Port'), ...sfp(4, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['unifi', 'switch', 'enterprise', '24', 'poe'],
    deviceTypeId: '1dfd0c22-0d20-4bdb-9d18-62a720d32543',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Enterprise 24 PoE (USW-Enterprise-24-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, '2.5G PoE Port'), ...sfp(2, 'SFP+')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['unifi', 'switch', 'enterprise', '48', 'poe'],
    deviceTypeId: 'c090f25b-c235-43ba-b7b8-6dacbb97bb04',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Enterprise 48 PoE (USW-Enterprise-48-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, '2.5G PoE Port'), ...sfp(4, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['unifi', 'switch', 'aggregation'],
    deviceTypeId: '8de280b9-6d4d-418e-b6b8-167a27b4b72c',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch Aggregation (USW-Aggregation)',
      category: NET,
      inputs: [],
      outputs: sfp(8, 'SFP+'),
      width: 260,
      height: 260,
    },
  },
  {
    match: ['unifi', 'switch', '24', 'poe'],
    deviceTypeId: 'fae967e4-956a-48ef-bb43-b59fcb57bc62',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 24 PoE (USW-24-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'PoE Port'), ...sfp(2, 'SFP')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['unifi', 'switch', '24'],
    deviceTypeId: '3c9e9de5-47a4-499e-accd-c1fffe3546c0',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 24 (USW-24)',
      category: NET,
      inputs: [],
      outputs: [...rj45(24, 'Port'), ...sfp(2, 'SFP')],
      width: 280,
      height: 480,
    },
  },
  {
    match: ['unifi', 'switch', '48', 'poe'],
    deviceTypeId: '76b7c13a-7fcb-442d-9007-2113eb23b139',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 48 PoE (USW-48-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'PoE Port'), ...sfp(2, 'SFP'), ...sfp(2, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['unifi', 'switch', '48'],
    deviceTypeId: '19ac4352-ace2-4844-bbb4-c389099b2abf',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 48 (USW-48)',
      category: NET,
      inputs: [],
      outputs: [...rj45(48, 'Port'), ...sfp(2, 'SFP'), ...sfp(2, 'SFP+')],
      width: 300,
      height: 820,
    },
  },
  {
    match: ['unifi', 'switch', '16', 'poe'],
    deviceTypeId: '6d8f73bf-2a99-4de4-933f-9621abd4c16c',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 16 PoE (USW-16-PoE)',
      category: NET,
      inputs: [],
      outputs: [...rj45(16, 'PoE Port'), ...sfp(2, 'SFP')],
      width: 260,
      height: 360,
    },
  },
  {
    match: ['unifi', 'switch', '16'],
    deviceTypeId: 'a6c64b89-60ff-40f6-9049-3d6faa4beeca',
    networkKind: 'switch',
    template: {
      name: 'UniFi Switch 16 (USW-16)',
      category: NET,
      inputs: [],
      outputs: [...rj45(16, 'Port'), ...sfp(2, 'SFP')],
      width: 260,
      height: 360,
    },
  },
]

/** Flat list of all built-in Ubiquiti templates (seeded into the library). */
export const ubiquitiTemplates: EquipmentTemplate[] = UBIQUITI_CATALOG.map(withTypeId)

/** Return a template matching the given equipment name, or null. */
export const matchUbiquitiTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact-name match first so items copied verbatim from the built-in library
  // match regardless of the fuzzy substring list.
  for (const entry of UBIQUITI_CATALOG) {
    if (entry.template.name.toLowerCase().trim() === lower) return withTypeId(entry)
  }
  if (
    !lower.includes('ubiquiti') &&
    !lower.includes('edgerouter') &&
    !lower.includes('edgeswitch') &&
    !lower.includes('unifi')
  ) {
    return null
  }
  for (const entry of UBIQUITI_CATALOG) {
    if (entry.match.every((needle) => lower.includes(needle))) {
      return withTypeId(entry)
    }
  }
  return null
}
