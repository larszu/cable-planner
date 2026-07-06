import { describe, expect, it } from 'vitest'
import { resolveInventoryCode } from '../src/renderer/lib/inventoryScan'
import { derivePackList, packListToText, packListTotalCount } from '../src/renderer/lib/packList'
import { buildInventoryReport } from '../src/renderer/lib/inventoryReport'
import type { InventoryItem, StorageNode, InventoryUnit } from '../src/renderer/types/inventory'

const now = '2026-07-06T00:00:00.000Z'
const item = (over: Partial<InventoryItem> & { id: string; model: string }): InventoryItem => ({
  quantity: 1,
  createdAt: now,
  updatedAt: now,
  ...over,
})
const node = (id: string, kind: StorageNode['kind'], parentId?: string, code?: string): StorageNode => ({
  id,
  name: id,
  kind,
  parentId,
  code,
  createdAt: now,
  updatedAt: now,
})
const unit = (over: Partial<InventoryUnit> & { id: string; itemId: string }): InventoryUnit => ({
  condition: 'ok',
  history: [],
  createdAt: now,
  updatedAt: now,
  ...over,
})

describe('inventoryScan — Code-Auflösung', () => {
  const items = [item({ id: 'i1', model: 'SM58', code: 'ITEM-1' })]
  const nodes = [node('n1', 'case', undefined, 'CASE-1')]
  const units = [unit({ id: 'u1', itemId: 'i1', code: 'UNIT-1', serial: 'SN-999' })]

  it('findet Einheit per Code und per Seriennummer', () => {
    expect(resolveInventoryCode('UNIT-1', { items, nodes, units })).toMatchObject({ kind: 'unit' })
    expect(resolveInventoryCode('sn-999', { items, nodes, units })).toMatchObject({ kind: 'unit' })
  })
  it('findet Knoten und Artikel per Code', () => {
    expect(resolveInventoryCode('CASE-1', { items, nodes, units })).toMatchObject({ kind: 'node' })
    expect(resolveInventoryCode('ITEM-1', { items, nodes, units })).toMatchObject({ kind: 'item' })
  })
  it('liefert null bei leer/unbekannt', () => {
    expect(resolveInventoryCode('', { items, nodes, units })).toBeNull()
    expect(resolveInventoryCode('XXX', { items, nodes, units })).toBeNull()
  })
})

describe('packList — rekursiver Container-Inhalt', () => {
  // Transport-Case > Case; Bulk-Artikel im Case, Einheit im Transport-Case.
  const nodes = [node('tcase', 'transportCase'), node('case', 'case', 'tcase')]
  const items = [
    item({ id: 'kabel', model: 'XLR', quantity: 5, locationId: 'case' }),
    item({ id: 'stativ', model: 'Stativ', quantity: 2, locationId: 'case' }),
  ]
  const units = [unit({ id: 'u1', itemId: 'kabel', serial: 'SN1', locationId: 'tcase', condition: 'defect' })]

  it('sammelt verschachtelten Inhalt tiefen-zuerst', () => {
    const list = derivePackList('tcase', { items, nodes, units })
    expect(list.map((n) => n.node.id)).toEqual(['tcase', 'case'])
    // Transport-Case hat direkt die Einheit, Case die zwei Bulk-Artikel.
    expect(list[0].units).toHaveLength(1)
    expect(list[1].items.map((i) => `${i.qty}x${i.model}`)).toEqual(['2xStativ', '5xXLR'])
  })

  it('zählt Gesamtstückzahl (Bulk + Units) und rendert Text', () => {
    const list = derivePackList('tcase', { items, nodes, units })
    expect(packListTotalCount(list)).toBe(5 + 2 + 1)
    const text = packListToText(list)
    expect(text).toContain('5x XLR')
    expect(text).toContain('[defect]')
  })

  it('unbekannte Wurzel → leer', () => {
    expect(derivePackList('nope', { items, nodes, units })).toEqual([])
  })
})

describe('inventoryReport — Bestandskennzahlen', () => {
  const nodes = [node('depot', 'depot'), node('shelf', 'shelf', 'depot')]
  const items = [
    item({ id: 'a', model: 'Cam', quantity: 3, category: 'Kameras', ownership: 'owned', rentPricePerDay: 100, locationId: 'shelf', materialKinds: ['rental'] }),
    item({ id: 'b', model: 'Tape', quantity: 10, category: 'Verbrauch', ownership: 'owned', materialKinds: ['consumable'] }),
  ]
  const units = [
    unit({ id: 'u1', itemId: 'a', condition: 'ok' }),
    unit({ id: 'u2', itemId: 'a', condition: 'inRepair' }),
  ]

  it('summiert Stückzahlen, Miet-Volumen und fehlende Preise', () => {
    const r = buildInventoryReport(items, nodes, units)
    expect(r.itemCount).toBe(2)
    expect(r.totalUnits).toBe(13)
    expect(r.serializedCount).toBe(2)
    expect(r.dailyRentalValue).toBe(300) // 100 × 3, Tape hat keinen Preis
    expect(r.itemsWithoutPrice).toBe(1)
  })

  it('gruppiert nach Lagerort (Wurzel) und Zustand', () => {
    const r = buildInventoryReport(items, nodes, units)
    // Cam liegt im shelf → Wurzel depot; Tape ohne Lagerort.
    expect(r.byLocation.find((x) => x.key === 'depot')?.units).toBe(3)
    expect(r.byLocation.find((x) => x.key === 'ohne Lagerort')?.units).toBe(10)
    expect(r.unitsByCondition.find((x) => x.key === 'inRepair')?.units).toBe(1)
  })
})
