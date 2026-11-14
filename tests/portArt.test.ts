import { describe, expect, it } from 'vitest'
import { ordnePortArten } from '../src/renderer/lib/portArt'
import { inZeichenrichtung } from '../src/renderer/lib/connectionDirection'
import { portAmKoerper } from '../src/renderer/lib/portAmKoerper'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// #1228 — Eingang / Ausgang / bidirektional steht nur noch an einer Stelle.
const port = (id: string, direction?: Port['direction']): Port => ({
  id,
  name: id,
  type: 'RJ45',
  connectorType: 'Ethernet/RJ45',
  ...(direction ? { direction } : {}),
})

describe('#1228 — ordnePortArten (Migration)', () => {
  it('laesst saubere Daten unangetastet (gleiche Referenz)', () => {
    const g = { inputs: [port('a'), port('b', 'bidirectional')], outputs: [port('c')] }
    expect(ordnePortArten(g)).toBe(g)
  })

  it('streicht die doppelte Angabe, die der Liste entspricht', () => {
    const r = ordnePortArten({ inputs: [port('a', 'in')], outputs: [port('c', 'out')] })
    expect(r.inputs[0]).not.toHaveProperty('direction')
    expect(r.outputs[0]).not.toHaveProperty('direction')
  })

  it('verschiebt einen Port, dessen Feld der Liste widersprach, und behaelt seine Id', () => {
    const r = ordnePortArten({ inputs: [port('a'), port('x', 'out')], outputs: [port('y', 'in'), port('c')] })
    expect(r.inputs.map((p) => p.id)).toEqual(['a', 'y'])
    expect(r.outputs.map((p) => p.id)).toEqual(['c', 'x'])
    expect([...r.inputs, ...r.outputs].some((p) => p.direction)).toBe(false)
  })

  it('behaelt bidirektional, egal in welcher Liste', () => {
    const r = ordnePortArten({ inputs: [port('a', 'in'), port('b', 'bidirectional')], outputs: [port('o', 'bidirectional')] })
    expect(r.inputs[1].direction).toBe('bidirectional')
    expect(r.outputs[0].direction).toBe('bidirectional')
  })
})

describe('#1228 — Kabel zwischen zwei bidirektionalen Ports', () => {
  it('beginnt dort, wo man zu ziehen anfing (ReactFlow vertauscht beim Start an einem Eingang)', () => {
    // Start an Geraet A (ein Eingang, also ein target-Griff): ReactFlow
    // liefert die Enden vertauscht.
    const vonReactFlow = { source: 'b', sourceHandle: 'io', target: 'a', targetHandle: 'io' }
    expect(inZeichenrichtung(vonReactFlow, { nodeId: 'a', handleId: 'io' })).toMatchObject({
      source: 'a',
      sourceHandle: 'io',
      target: 'b',
      targetHandle: 'io',
    })
  })

  it('laesst eine Verbindung, die schon in Zeichenrichtung kommt, wie sie ist', () => {
    const c = { source: 'a', sourceHandle: 'o', target: 'b', targetHandle: 'i' }
    expect(inZeichenrichtung(c, { nodeId: 'a', handleId: 'o' })).toBe(c)
    expect(inZeichenrichtung(c, null)).toBe(c)
  })

  it('legt auf dem Koerper keinen Ausgang an, wenn die Quelle bidirektional ist', () => {
    const ziel: EquipmentItem = { id: 'g', name: 'Neu', category: 'Other', inputs: [], outputs: [], x: 0, y: 0, portsUnknown: true }
    const r = portAmKoerper(ziel, 'output', { connectorType: 'Ethernet/RJ45', type: 'RJ45', direction: 'bidirectional' })!
    expect(r.patch.outputs).toBeUndefined()
    expect(r.patch.inputs![0]).toMatchObject({ id: r.portId, direction: 'bidirectional' })
  })
})

describe('#1228 — Migration beim Laden', () => {
  it('raeumt die alte Richtung in Geraeten und Modi auf, das Kabel bleibt stecken', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().loadProject({
      metadata: { name: 'Alt' },
      equipment: [
        {
          id: 'g', name: 'G', category: 'Other', x: 0, y: 0,
          inputs: [port('i', 'in'), port('x', 'out')],
          outputs: [port('o')],
          modes: [{ id: 'm', name: 'M', inputs: [port('mi', 'in')], outputs: [] }],
        },
      ],
      cables: [{ id: 'k', name: '', type: 'RJ45', length: 1, color: '#fff', fromEquipmentId: 'g', fromPortId: 'x', toEquipmentId: 'g', toPortId: 'i', notes: '' }],
      canvasState: { x: 0, y: 0, zoom: 1 },
    } as never)
    const g = useProjectStore.getState().project.equipment[0]
    expect(g.inputs.map((p) => p.id)).toEqual(['i'])
    expect(g.outputs.map((p) => p.id)).toEqual(['o', 'x'])
    expect(g.inputs[0]).not.toHaveProperty('direction')
    expect(g.modes![0].inputs[0]).not.toHaveProperty('direction')
    expect(useProjectStore.getState().project.cables[0]).toMatchObject({ fromPortId: 'x', toPortId: 'i' })
  })
})
