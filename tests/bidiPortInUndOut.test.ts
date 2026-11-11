import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

/**
 * #1212 — Ein bidirektionaler Port nimmt ein Kabel herein UND gibt eins
 * hinaus. Steckt schon ein ankommendes Kabel, darf eine weitere Verbindung
 * zu einem anderen bidirektionalen Port nicht als Konflikt enden, sondern
 * geht von diesem Port ab.
 */

const bidi = (id: string): Port => ({
  id,
  name: id,
  originalName: id,
  type: 'RJ45',
  connectorType: 'RJ45',
  direction: 'bidirectional',
})

const geraet = (id: string): EquipmentItem => ({
  id,
  name: id,
  type: 'Device',
  category: 'Network',
  x: 0,
  y: 0,
  inputs: [bidi('io')],
  outputs: [],
})

const herein: Cable = {
  id: 'cable-1',
  name: '',
  type: 'RJ45',
  length: 5,
  color: '#ffffff',
  fromEquipmentId: 'a',
  fromPortId: 'io',
  toEquipmentId: 'b',
  toPortId: 'io',
  notes: '',
}

const seed = (cables: Cable[]) => {
  const state = useProjectStore.getState()
  useProjectStore.setState({
    project: { ...state.project, equipment: [geraet('a'), geraet('b'), geraet('c')], cables },
    portConflict: undefined,
    pendingConnection: undefined,
    showCableDialog: false,
  })
}

describe('#1212 — bidirektionaler Port: ein Kabel herein, eins hinaus', () => {
  beforeEach(() => seed([herein]))

  it('dreht die Verbindung, statt am belegten Ziel einen Konflikt zu melden', () => {
    useProjectStore.getState().queueConnection({ source: 'c', sourceHandle: 'io', target: 'b', targetHandle: 'io' })
    const state = useProjectStore.getState()
    expect(state.portConflict).toBeUndefined()
    expect(state.showCableDialog).toBe(true)
    expect(state.pendingConnection).toMatchObject({ source: 'b', sourceHandle: 'io', target: 'c', targetHandle: 'io' })
  })

  it('meldet den Konflikt, wenn beide Enden schon ein ankommendes Kabel tragen', () => {
    seed([herein, { ...herein, id: 'cable-2', fromEquipmentId: 'a', toEquipmentId: 'c' }])
    useProjectStore.getState().queueConnection({ source: 'c', sourceHandle: 'io', target: 'b', targetHandle: 'io' })
    expect(useProjectStore.getState().portConflict?.conflictingCableIds).toEqual(['cable-1'])
  })
})
