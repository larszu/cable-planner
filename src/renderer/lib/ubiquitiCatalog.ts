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
  /** Name patterns (lowercased) that must ALL appear in the source name. */
  match: string[]
  template: EquipmentTemplate
}

const NET = 'Netzwerk'

export const UBIQUITI_CATALOG: UbiquitiEntry[] = [
  // ---------- EdgeRouter ----------
  {
    match: ['edgerouter', 'x-sfp'],
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
export const ubiquitiTemplates: EquipmentTemplate[] = UBIQUITI_CATALOG.map(
  (entry) => entry.template,
)

/** Return a template matching the given equipment name, or null. */
export const matchUbiquitiTemplate = (name: string): EquipmentTemplate | null => {
  const lower = name.toLowerCase().trim()
  if (!lower) return null
  // Exact-name match first so items copied verbatim from the built-in library
  // match regardless of the fuzzy substring list.
  for (const template of ubiquitiTemplates) {
    if (template.name.toLowerCase().trim() === lower) return template
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
      return entry.template
    }
  }
  return null
}
