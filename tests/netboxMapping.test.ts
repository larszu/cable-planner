import { describe, it, expect } from 'vitest'
import {
  buildNetboxImportPlan,
  connectorToCableType,
  netboxCableLength,
  netboxCategoryForRole,
  netboxConnectorType,
  netboxTerminations,
} from '../src/renderer/lib/netboxMapping'
import type { NetboxSnapshot } from '../src/renderer/types/netbox'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const BASE_URL = 'https://netbox.example.test'

/** Baut einen minimalen, aber realistischen Snapshot:
 *  Rack "R1" mit Switch (2 Interfaces) und PDU (1 Outlet, 1 Port am Switch),
 *  verbunden durch zwei Kabel. */
const makeSnapshot = (overrides: Partial<NetboxSnapshot> = {}): NetboxSnapshot => ({
  scope: 'rack',
  scopeId: 10,
  scopeName: 'R1',
  siteName: 'Studio A',
  netboxVersion: '4.1.0',
  racks: [{ id: 10, name: 'R1', u_height: 42, site: { id: 1, name: 'Studio A' } }],
  devices: [
    {
      id: 100,
      name: 'sw-core',
      device_type: { id: 5, model: 'EX2300', manufacturer: { id: 2, name: 'Juniper' }, u_height: 1 },
      role: { id: 3, name: 'Access Switch', slug: 'access-switch' },
      rack: { id: 10, name: 'R1' },
      position: 40,
      primary_ip: { address: '10.0.0.2/24' },
    },
    {
      id: 200,
      name: 'pdu-1',
      device_type: { id: 6, model: 'PDU-16', manufacturer: { id: 3, name: 'APC' }, u_height: 1 },
      role: { id: 4, name: 'PDU', slug: 'pdu' },
      rack: { id: 10, name: 'R1' },
      position: 1,
    },
  ],
  components: {
    interface: [
      { id: 1001, device: { id: 100 }, name: 'ge-0/0/0', type: { value: '1000base-t' }, cable: { id: 900 } },
      { id: 1002, device: { id: 100 }, name: 'ge-0/0/1', type: { value: '1000base-t' }, cable: null },
    ],
    powerport: [{ id: 1100, device: { id: 100 }, name: 'PSU0', type: { value: 'iec-60320-c14' }, cable: { id: 901 } }],
    poweroutlet: [{ id: 1200, device: { id: 200 }, name: 'Out-1', type: { value: 'iec-60320-c13' }, cable: { id: 901 } }],
  },
  cables: [
    {
      id: 900,
      label: 'Uplink',
      color: 'f44336',
      length: 3,
      length_unit: { value: 'm' },
      a_terminations: [{ object_type: 'dcim.interface', object_id: 1001, object: { id: 1001, device: { id: 100 } } }],
      // Gegenstelle liegt ausserhalb des Racks → muss übersprungen werden.
      b_terminations: [{ object_type: 'dcim.interface', object_id: 5001, object: { id: 5001, device: { id: 999 } } }],
    },
    {
      id: 901,
      label: 'Power PSU0',
      // A = Verbraucher-Eingang, B = PDU-Ausgang → Kabel muss gedreht werden.
      a_terminations: [{ object_type: 'dcim.powerport', object_id: 1100, object: { id: 1100, device: { id: 100 } } }],
      b_terminations: [{ object_type: 'dcim.poweroutlet', object_id: 1200, object: { id: 1200, device: { id: 200 } } }],
    },
  ],
  ...overrides,
})

describe('netboxConnectorType', () => {
  it('erkennt Kupfer-Ethernet am NetBox-Slug', () => {
    expect(netboxConnectorType('interface', 'ge-0/0/0', { value: '1000base-t' })).toBe('Ethernet/RJ45')
  })

  it('erkennt SFP+/QSFP als SFP+', () => {
    expect(netboxConnectorType('interface', 'xe-0/0/0', { value: '10gbase-x-sfpp' })).toBe('SFP+')
    expect(netboxConnectorType('interface', 'et-0/0/0', { value: '100gbase-x-qsfp28' })).toBe('SFP+')
  })

  it('mappt Strom-Slugs auf die passende Steckerform', () => {
    expect(netboxConnectorType('powerport', 'PSU0', { value: 'iec-60320-c14' })).toBe('IEC 230V')
    expect(netboxConnectorType('poweroutlet', 'Out-1', { value: 'cee-7-7' })).toBe('Schuko 230V')
    expect(netboxConnectorType('poweroutlet', 'Stage', { value: 'neutrik-powercon-32' })).toBe('PowerCON')
  })

  it('erkennt BNC/SDI und Glasfaser', () => {
    expect(netboxConnectorType('frontport', 'SDI 1', { value: 'bnc' })).toBe('BNC')
    expect(netboxConnectorType('rearport', 'Trunk', { value: 'lc' })).toBe('Fiber')
  })

  it('führt virtuelle Interfaces nicht als physischen Stecker', () => {
    expect(netboxConnectorType('interface', 'ae0', { value: 'lag' })).toBe('Wireless/RF')
  })
})

describe('connectorToCableType', () => {
  it('bildet nicht-kabelfähige Steckertypen auf Custom ab', () => {
    expect(connectorToCableType('DisplayPort')).toBe('Custom')
    expect(connectorToCableType('USB')).toBe('Custom')
    expect(connectorToCableType('BNC')).toBe('BNC')
  })
})

describe('netboxCableLength', () => {
  it('rechnet die NetBox-Einheit in Meter um', () => {
    expect(netboxCableLength({ length: 3, length_unit: { value: 'm' } })).toBe(3)
    expect(netboxCableLength({ length: 250, length_unit: { value: 'cm' } })).toBe(2.5)
    expect(netboxCableLength({ length: 10, length_unit: 'ft' })).toBeCloseTo(3.048, 3)
    expect(netboxCableLength({ length: null })).toBe(0)
  })
})

describe('netboxTerminations', () => {
  it('liest das moderne a_terminations-Array', () => {
    const terms = netboxTerminations(
      { a_terminations: [{ object_type: 'dcim.interface', object_id: 7 }] },
      'a',
    )
    expect(terms).toHaveLength(1)
    expect(terms[0].object_id).toBe(7)
  })

  it('fällt auf die alten termination_a_*-Felder zurück (NetBox ≤ 3.2)', () => {
    const terms = netboxTerminations({ termination_a_type: 'dcim.interface', termination_a_id: 9 }, 'a')
    expect(terms[0].object_id).toBe(9)
    expect(terms[0].object_type).toBe('dcim.interface')
  })
})

describe('netboxCategoryForRole', () => {
  it('mappt bekannte Rollen auf Cable-Planner-Kategorien', () => {
    expect(netboxCategoryForRole({ role: { slug: 'access-switch' } })).toBe('Netzwerk')
    expect(netboxCategoryForRole({ role: { slug: 'pdu' } })).toBe('Strom')
    expect(netboxCategoryForRole({ device_role: { slug: 'broadcast-camera' } })).toBe('Kameras')
  })

  it('fällt ohne Rolle auf Sonstiges zurück', () => {
    expect(netboxCategoryForRole({})).toBe('Sonstiges')
  })
})

describe('buildNetboxImportPlan — Erstimport', () => {
  const plan = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })

  it('legt je NetBox-Gerät genau ein Equipment an', () => {
    expect(plan.newEquipment).toHaveLength(2)
    expect(plan.newEquipment.map((e) => e.netboxId).sort()).toEqual([100, 200])
    expect(plan.newEquipment.every((e) => e.importSource === 'netbox')).toBe(true)
    expect(plan.newEquipment.every((e) => e.netboxSourceUrl === BASE_URL)).toBe(true)
  })

  it('importiert per Default nur verkabelte Ports', () => {
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    const portIds = [...sw.inputs, ...sw.outputs].map((p) => p.netboxId)
    // ge-0/0/1 (1002) hat kein Kabel und darf nicht auftauchen.
    expect(portIds).not.toContain(1002)
    expect(portIds).toContain(1001)
  })

  it('spiegelt richtungslose Interfaces als In/Out-Paar, Strom-Ports nicht', () => {
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    // Interface 1001 einmal als Input und einmal als Output.
    expect(sw.inputs.filter((p) => p.netboxId === 1001)).toHaveLength(1)
    expect(sw.outputs.filter((p) => p.netboxId === 1001)).toHaveLength(1)
    // Der Power-Port ist nur Eingang.
    expect(sw.inputs.some((p) => p.netboxId === 1100)).toBe(true)
    expect(sw.outputs.some((p) => p.netboxId === 1100)).toBe(false)
  })

  it('dreht das Strom-Kabel auf Ausgang→Eingang', () => {
    const power = plan.newCables.find((c) => c.netboxId === 901)
    expect(power).toBeDefined()
    const pdu = plan.newEquipment.find((e) => e.netboxId === 200)!
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    // Quelle muss die PDU (Outlet) sein, Ziel der Switch (Power-Eingang).
    expect(power!.fromEquipmentId).toBe(pdu.id)
    expect(power!.toEquipmentId).toBe(sw.id)
  })

  it('überspringt Kabel, deren Gegenstelle ausserhalb des Bereichs liegt', () => {
    expect(plan.newCables.some((c) => c.netboxId === 900)).toBe(false)
    expect(plan.skipped.some((s) => s.netboxId === 900 && s.kind === 'cable')).toBe(true)
  })

  it('legt einen Rahmen je Rack an und stapelt Geräte nach Höheneinheit', () => {
    expect(plan.newLocations).toHaveLength(1)
    expect(plan.newLocations[0].name).toBe('R1')
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    const pdu = plan.newEquipment.find((e) => e.netboxId === 200)!
    // Switch steht auf HE 40, PDU auf HE 1 → Switch gehört nach oben.
    expect(sw.y).toBeLessThan(pdu.y)
    expect(sw.x).toBe(pdu.x)
  })

  it('übernimmt Farbe, Länge und IP aus NetBox', () => {
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    expect(sw.ipAddress).toBe('10.0.0.2')
    expect(sw.rackUnits).toBe(1)
    expect(sw.isRackDevice).toBe(true)
  })
})

describe('buildNetboxImportPlan — Aktualisieren (nur hinzufügen)', () => {
  it('legt bereits importierte Geräte und Kabel nicht erneut an', () => {
    const first = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })
    const existingEquipment = first.newEquipment as EquipmentItem[]
    const existingCables = first.newCables as Cable[]

    const second = buildNetboxImportPlan(makeSnapshot(), existingEquipment, existingCables, {
      baseUrl: BASE_URL,
    })

    expect(second.newEquipment).toHaveLength(0)
    expect(second.newCables).toHaveLength(0)
    expect(second.portAdditions).toHaveLength(0)
    expect(second.unchangedDeviceIds.sort()).toEqual([100, 200])
    expect(second.unchangedCableIds).toEqual([901])
  })

  it('ergänzt an bestehenden Geräten nur die in NetBox neu hinzugekommenen Ports', () => {
    const first = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })

    // In NetBox kommt ein weiteres, verkabeltes Interface am Switch dazu.
    const grown = makeSnapshot()
    grown.components.interface = [
      ...grown.components.interface,
      { id: 1003, device: { id: 100 }, name: 'ge-0/0/2', type: { value: '1000base-t' }, cable: { id: 902 } },
    ]

    const second = buildNetboxImportPlan(
      grown,
      first.newEquipment as EquipmentItem[],
      first.newCables as Cable[],
      { baseUrl: BASE_URL },
    )

    expect(second.newEquipment).toHaveLength(0)
    expect(second.portAdditions).toHaveLength(1)
    const addition = second.portAdditions[0]
    expect(addition.equipmentId).toBe(first.newEquipment.find((e) => e.netboxId === 100)!.id)
    // Gespiegeltes Paar für das neue Interface.
    expect(addition.inputs.map((p) => p.netboxId)).toEqual([1003])
    expect(addition.outputs.map((p) => p.netboxId)).toEqual([1003])
  })

  it('legt ein neues Gerät samt Kabel zum Bestand an', () => {
    const first = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })

    const grown = makeSnapshot()
    grown.devices = [
      ...grown.devices,
      {
        id: 300,
        name: 'sw-edge',
        device_type: { id: 5, model: 'EX2300', u_height: 1 },
        role: { slug: 'access-switch' },
        rack: { id: 10, name: 'R1' },
        position: 20,
      },
    ]
    grown.components.interface = [
      ...grown.components.interface,
      { id: 3001, device: { id: 300 }, name: 'ge-0/0/0', type: { value: '1000base-t' }, cable: { id: 903 } },
    ]
    // Neues Kabel zwischen dem bestehenden Switch-Port 1002 und dem neuen Gerät.
    grown.components.interface = grown.components.interface.map((i) =>
      i.id === 1002 ? { ...i, cable: { id: 903 } } : i,
    )
    grown.cables = [
      ...grown.cables,
      {
        id: 903,
        label: 'Core→Edge',
        a_terminations: [{ object_type: 'dcim.interface', object_id: 1002, object: { id: 1002, device: { id: 100 } } }],
        b_terminations: [{ object_type: 'dcim.interface', object_id: 3001, object: { id: 3001, device: { id: 300 } } }],
      },
    ]

    const second = buildNetboxImportPlan(
      grown,
      first.newEquipment as EquipmentItem[],
      first.newCables as Cable[],
      { baseUrl: BASE_URL },
    )

    expect(second.newEquipment.map((e) => e.netboxId)).toEqual([300])
    const newCable = second.newCables.find((c) => c.netboxId === 903)
    expect(newCable).toBeDefined()
    // Quelle ist der bestehende Switch (dessen Port 1002 jetzt ergänzt wird).
    expect(newCable!.fromEquipmentId).toBe(first.newEquipment.find((e) => e.netboxId === 100)!.id)
    expect(newCable!.toEquipmentId).toBe(second.newEquipment[0].id)
  })

  it('meldet in NetBox verschwundene Elemente, entfernt sie aber nicht', () => {
    const first = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })

    const shrunk = makeSnapshot()
    shrunk.devices = shrunk.devices.filter((d) => d.id !== 200)
    shrunk.cables = []

    const second = buildNetboxImportPlan(
      shrunk,
      first.newEquipment as EquipmentItem[],
      first.newCables as Cable[],
      { baseUrl: BASE_URL },
    )

    expect(second.staleDeviceIds).toEqual([200])
    expect(second.staleCableIds).toEqual([901])
    expect(second.newEquipment).toHaveLength(0)
  })

  it('behandelt eine andere Instanz mit gleichen IDs als fremd', () => {
    const first = buildNetboxImportPlan(makeSnapshot(), [], [], { baseUrl: BASE_URL })

    const second = buildNetboxImportPlan(makeSnapshot(), first.newEquipment as EquipmentItem[], [], {
      baseUrl: 'https://netbox-test.example.test',
    })

    // Gleiche NetBox-IDs, andere Instanz → wird neu angelegt, nicht gemerged.
    expect(second.newEquipment).toHaveLength(2)
  })
})

describe('buildNetboxImportPlan — Optionen', () => {
  it('importiert auf Wunsch auch unverkabelte Ports', () => {
    const plan = buildNetboxImportPlan(makeSnapshot(), [], [], {
      baseUrl: BASE_URL,
      onlyConnectedPorts: false,
    })
    const sw = plan.newEquipment.find((e) => e.netboxId === 100)!
    expect([...sw.inputs, ...sw.outputs].map((p) => p.netboxId)).toContain(1002)
  })

  it('lässt Kabel und Rahmen auf Wunsch weg', () => {
    const plan = buildNetboxImportPlan(makeSnapshot(), [], [], {
      baseUrl: BASE_URL,
      includeCables: false,
      createRackFrames: false,
    })
    expect(plan.newCables).toHaveLength(0)
    expect(plan.newLocations).toHaveLength(0)
  })

  it('setzt den Import-Block rechts neben bestehende Geräte', () => {
    const existing: EquipmentItem[] = [
      {
        id: 'manual-1',
        name: 'Bestand',
        category: 'Video',
        inputs: [],
        outputs: [],
        x: 0,
        y: 0,
        width: 300,
        height: 100,
      },
    ]
    const plan = buildNetboxImportPlan(makeSnapshot(), existing, [], { baseUrl: BASE_URL })
    expect(plan.newEquipment.every((e) => e.x > 300)).toBe(true)
  })
})
