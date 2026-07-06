import { describe, expect, it } from 'vitest'
import {
  nodePath,
  nodePathLabel,
  rootLocation,
  descendantNodeIds,
  itemsInNode,
  wouldCreateCycle,
  availabilityOfSet,
  isContainerKind,
} from '../src/renderer/lib/storageTree'
import type { StorageNode, InventoryItem, InventorySet } from '../src/renderer/types/inventory'

const now = '2026-07-06T00:00:00.000Z'
const node = (id: string, kind: StorageNode['kind'], parentId?: string): StorageNode => ({
  id,
  name: id,
  kind,
  parentId,
  createdAt: now,
  updatedAt: now,
})
const item = (id: string, quantity: number, locationId?: string): InventoryItem => ({
  id,
  model: id,
  quantity,
  locationId,
  createdAt: now,
  updatedAt: now,
})

// Baum: Depot › Raum › Regal › Transport-Case › Case
const nodes: StorageNode[] = [
  node('depot', 'depot'),
  node('room', 'room', 'depot'),
  node('shelf', 'shelf', 'room'),
  node('tcase', 'transportCase', 'shelf'),
  node('case', 'case', 'tcase'),
]

describe('storageTree — LPN-Baum-Resolver', () => {
  it('nodePath liefert Wurzel→Knoten in Reihenfolge', () => {
    expect(nodePath(nodes, 'case').map((n) => n.id)).toEqual([
      'depot',
      'room',
      'shelf',
      'tcase',
      'case',
    ])
    expect(nodePathLabel(nodes, 'case')).toBe('depot › room › shelf › tcase › case')
  })

  it('rootLocation ist der oberste Vorfahr (physischer Lagerort)', () => {
    expect(rootLocation(nodes, 'case')?.id).toBe('depot')
  })

  it('descendantNodeIds sammelt transitiv über alle Ebenen', () => {
    expect(descendantNodeIds(nodes, 'shelf')).toEqual(new Set(['tcase', 'case']))
  })

  it('itemsInNode recursive zählt Artikel in verschachtelten Containern', () => {
    const items = [
      item('a', 1, 'case'), // tief im Case
      item('b', 1, 'tcase'), // direkt im Transport-Case
      item('c', 1, 'room'), // woanders
    ]
    expect(itemsInNode(items, nodes, 'tcase').map((i) => i.id)).toEqual(['b'])
    expect(itemsInNode(items, nodes, 'tcase', { recursive: true }).map((i) => i.id).sort()).toEqual([
      'a',
      'b',
    ])
  })

  it('wouldCreateCycle wehrt Selbst- und Nachfahr-Parent ab', () => {
    expect(wouldCreateCycle(nodes, 'tcase', 'tcase')).toBe(true) // in sich selbst
    expect(wouldCreateCycle(nodes, 'tcase', 'case')).toBe(true) // in eigenen Nachfahren
    expect(wouldCreateCycle(nodes, 'case', 'room')).toBe(false) // erlaubt
    expect(wouldCreateCycle(nodes, 'case', undefined)).toBe(false) // Wurzel
  })

  it('availabilityOfSet ist das Minimum über Komponenten', () => {
    const items = [item('drill', 3), item('chuck', 9), item('trafo', 20)]
    const set: InventorySet = {
      id: 's',
      name: 'Drill-Kit',
      components: [
        { itemId: 'drill', quantity: 1 },
        { itemId: 'chuck', quantity: 2 },
        { itemId: 'trafo', quantity: 1 },
      ],
      createdAt: now,
      updatedAt: now,
    }
    // drill: 3/1=3, chuck: 9/2=4, trafo: 20/1=20 → min 3
    expect(availabilityOfSet(items, set)).toBe(3)
  })

  it('availabilityOfSet ist 0 bei fehlender Komponente oder leerem Set', () => {
    const items = [item('drill', 3)]
    expect(
      availabilityOfSet(items, {
        id: 's',
        name: 'x',
        components: [{ itemId: 'missing', quantity: 1 }],
        createdAt: now,
        updatedAt: now,
      }),
    ).toBe(0)
    expect(
      availabilityOfSet(items, { id: 's', name: 'x', components: [], createdAt: now, updatedAt: now }),
    ).toBe(0)
  })

  it('isContainerKind unterscheidet Container von Lagerplätzen', () => {
    expect(isContainerKind('case')).toBe(true)
    expect(isContainerKind('transportCase')).toBe(true)
    expect(isContainerKind('shelf')).toBe(false)
    expect(isContainerKind('depot')).toBe(false)
  })
})
