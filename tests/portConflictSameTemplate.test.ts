import { describe, expect, it, beforeEach } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

/**
 * #595 — Zwei Geraete aus derselben Vorlage. Ihre Port-IDs sind identisch,
 * weil `sanitizePort` eine vorhandene ID beim Platzieren behaelt. Ein Kabel in
 * Geraet A darf den gleichnamigen Eingang von Geraet B nicht belegen.
 *
 * Ende-zu-Ende ueber den Store, weil der Fehler genau in der Kette
 * queueConnection -> portConflict sass.
 */

const port = (id: string, name: string): Port => ({
  id,
  name,
  originalName: name,
  type: 'XLR',
  connectorType: 'XLR',
})

// Beide Boxen kommen aus derselben Vorlage: gleiche Port-IDs, andere Geraete-Id.
const boxFromTemplate = (id: string, name: string): EquipmentItem => ({
  id,
  name,
  type: 'Speaker',
  category: 'Audio',
  x: 0,
  y: 0,
  inputs: [port('in-1-xlr', 'Input 1 XLR')],
  outputs: [port('out-1-xlr', 'Output 1')],
})

const amp: EquipmentItem = {
  id: 'amp',
  name: 'the t.amp E-1200',
  type: 'Amp',
  category: 'Audio',
  x: 0,
  y: 0,
  inputs: [],
  outputs: [port('xlr-out-a', 'XLR Out A'), port('xlr-out-b', 'XLR Out B')],
}

const existingCable: Cable = {
  id: 'cable-1',
  name: 'XLR 1',
  type: 'XLR',
  length: 10,
  color: '#ffffff',
  fromEquipmentId: 'amp',
  fromPortId: 'xlr-out-a',
  toEquipmentId: 'box-a',
  toPortId: 'in-1-xlr',
  notes: '',
}

const seed = (cables: Cable[]) => {
  const state = useProjectStore.getState()
  useProjectStore.setState({
    project: {
      ...state.project,
      equipment: [amp, boxFromTemplate('box-a', 'Achat 204 A'), boxFromTemplate('box-b', 'Achat 204 A')],
      cables,
    },
    portConflict: undefined,
    pendingConnection: undefined,
    showCableDialog: false,
  })
}

describe('#595 — Port-Konflikt bei Geraeten aus derselben Vorlage', () => {
  beforeEach(() => seed([existingCable]))

  it('laesst das Kabel zum zweiten Geraet durch', () => {
    useProjectStore.getState().queueConnection({
      source: 'amp',
      sourceHandle: 'xlr-out-b',
      target: 'box-b',
      targetHandle: 'in-1-xlr',
    })
    const state = useProjectStore.getState()
    expect(state.portConflict).toBeUndefined()
    expect(state.showCableDialog).toBe(true)
    expect(state.pendingConnection?.target).toBe('box-b')
  })

  it('meldet den Konflikt weiterhin am wirklich belegten Port', () => {
    useProjectStore.getState().queueConnection({
      source: 'amp',
      sourceHandle: 'xlr-out-b',
      target: 'box-a',
      targetHandle: 'in-1-xlr',
    })
    const state = useProjectStore.getState()
    expect(state.portConflict?.conflictingCableIds).toEqual(['cable-1'])
    expect(state.showCableDialog).toBe(false)
  })

  it('nennt im Konflikt nur die Kabel dieses einen Geraets', () => {
    seed([
      existingCable,
      { ...existingCable, id: 'cable-2', fromPortId: 'xlr-out-b', toEquipmentId: 'box-b' },
    ])
    useProjectStore.getState().queueConnection({
      source: 'amp',
      sourceHandle: 'xlr-out-a',
      target: 'box-b',
      targetHandle: 'in-1-xlr',
    })
    expect(useProjectStore.getState().portConflict?.conflictingCableIds).toEqual(['cable-2'])
  })

  it('ueberspringt beim Bulk-Anlegen nicht das zweite Geraet', () => {
    const draft = {
      name: '',
      type: 'XLR' as const,
      length: 5,
      color: '#ffffff',
      notes: '',
      fromEquipmentId: 'amp',
      fromPortId: 'xlr-out-b',
      toEquipmentId: 'box-b',
      toPortId: 'in-1-xlr',
    }
    const result = useProjectStore.getState().addCablesBulk([draft])
    expect(result).toMatchObject({ created: 1, skipped: 0 })
    expect(useProjectStore.getState().project.cables).toHaveLength(2)
  })

  it('ueberspringt beim Bulk-Anlegen den wirklich belegten Ziel-Port', () => {
    const draft = {
      name: '',
      type: 'XLR' as const,
      length: 5,
      color: '#ffffff',
      notes: '',
      fromEquipmentId: 'amp',
      fromPortId: 'xlr-out-b',
      toEquipmentId: 'box-a',
      toPortId: 'in-1-xlr',
    }
    const result = useProjectStore.getState().addCablesBulk([draft])
    expect(result).toMatchObject({ created: 0, skipped: 1 })
  })

  it('blockt einen Ausgang nicht — der darf mehrere Kabel speisen', () => {
    useProjectStore.getState().queueConnection({
      source: 'box-a',
      sourceHandle: 'out-1-xlr',
      target: 'box-b',
      targetHandle: 'in-1-xlr',
    })
    expect(useProjectStore.getState().portConflict).toBeUndefined()
  })
})
