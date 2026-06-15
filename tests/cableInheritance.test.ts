import { describe, expect, it } from 'vitest'
import {
  cableTypePatchFromPorts,
  connectorToCableType,
  inheritedCableType,
  isBidirectionalCableType,
} from '../src/renderer/lib/cableInheritance'
import type { Cable } from '../src/renderer/types/cable'
import type { ConnectorType, EquipmentItem } from '../src/renderer/types/equipment'

// v7.9.125 — Cable-Typ folgt dem Port-Connector. Reine Ableitungslogik.
// (Importiert transitiv den Zustand-Store → verifiziert nebenbei, dass die
//  Renderer-Module unter happy-dom sauber laden.)

// Minimal-Fixtures: cableInheritance liest nur id/inputs/outputs/connectorType.
const eq = (id: string, ports: Array<{ id: string; connectorType: ConnectorType; out?: boolean }>): EquipmentItem => {
  const mk = (p: { id: string; connectorType: ConnectorType }) => ({
    id: p.id,
    name: p.id,
    type: 'port',
    connectorType: p.connectorType,
  })
  return {
    id,
    name: id,
    inputs: ports.filter((p) => !p.out).map(mk),
    outputs: ports.filter((p) => p.out).map(mk),
  } as unknown as EquipmentItem
}

const cable = (over: Partial<Cable>): Cable =>
  ({
    id: 'c1',
    name: 'c1',
    type: 'Custom',
    length: 1,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'a-out',
    toEquipmentId: 'B',
    toPortId: 'b-in',
    notes: '',
    ...over,
  }) as Cable

describe('connectorToCableType', () => {
  it('reicht direkte Connector→Cable-Typen durch', () => {
    expect(connectorToCableType('BNC')).toBe('BNC')
    expect(connectorToCableType('XLR')).toBe('XLR')
  })

  it('kollabiert Nicht-Kabel-Connectoren + undefined auf Custom', () => {
    expect(connectorToCableType('DIN')).toBe('Custom')
    expect(connectorToCableType('DisplayPort')).toBe('Custom')
    expect(connectorToCableType('USB')).toBe('Custom')
    expect(connectorToCableType(undefined)).toBe('Custom')
  })
})

describe('isBidirectionalCableType', () => {
  it('markiert physisch bidirektionale Typen', () => {
    expect(isBidirectionalCableType('Fiber')).toBe(true)
    expect(isBidirectionalCableType('Ethernet/RJ45')).toBe(true)
  })
  it('ist false für unidirektionale Typen', () => {
    expect(isBidirectionalCableType('BNC')).toBe(false)
    expect(isBidirectionalCableType('XLR')).toBe(false)
  })
})

describe('inheritedCableType', () => {
  const equipment = [
    eq('A', [{ id: 'a-out', connectorType: 'BNC', out: true }]),
    eq('B', [{ id: 'b-in', connectorType: 'BNC' }]),
    eq('C', [{ id: 'c-in', connectorType: 'XLR' }]),
  ]

  it('leitet aus übereinstimmenden Ports ab', () => {
    expect(inheritedCableType(cable({}), equipment)).toBe('BNC')
  })

  it('bevorzugt den Quell-Port wenn die Ports uneinig sind', () => {
    const c = cable({ toEquipmentId: 'C', toPortId: 'c-in' }) // out=BNC, in=XLR
    expect(inheritedCableType(c, equipment)).toBe('BNC')
  })

  it('liefert undefined für ein verwaistes Kabel (keine Ports auflösbar)', () => {
    const c = cable({ fromEquipmentId: 'Z', fromPortId: 'z', toEquipmentId: 'Y', toPortId: 'y' })
    expect(inheritedCableType(c, equipment)).toBeUndefined()
  })
})

describe('cableTypePatchFromPorts', () => {
  const equipment = [
    eq('A', [{ id: 'a-out', connectorType: 'Fiber', out: true }]),
    eq('B', [{ id: 'b-in', connectorType: 'Fiber' }]),
  ]

  it('liefert ein Patch inkl. bidirectional wenn sich der Typ ändert', () => {
    const patch = cableTypePatchFromPorts(cable({ type: 'BNC' }), equipment)
    expect(patch).toEqual({ type: 'Fiber', bidirectional: true })
  })

  it('liefert null wenn der Typ schon passt', () => {
    expect(cableTypePatchFromPorts(cable({ type: 'Fiber' }), equipment)).toBeNull()
  })

  it('lässt needsConverter-Kabel unangetastet (null)', () => {
    expect(cableTypePatchFromPorts(cable({ type: 'BNC', needsConverter: true }), equipment)).toBeNull()
  })
})
