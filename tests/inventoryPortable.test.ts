import { describe, expect, it, beforeEach } from 'vitest'
import { serializeInventory, parseInventory, INVENTORY_FORMAT } from '../src/renderer/lib/inventoryPortable'
import { useInventoryStore } from '../src/renderer/store/inventoryStore'

const reset = () => {
  localStorage.clear()
  useInventoryStore.setState({ items: [], nodes: [], sets: [], units: [] })
}

describe('inventoryPortable — Serialisierung', () => {
  it('Round-Trip erhält die Daten', () => {
    const snap = {
      items: [{ id: 'i1', model: 'SM58', quantity: 3, createdAt: 'x', updatedAt: 'x' }],
      nodes: [{ id: 'n1', name: 'Case', kind: 'case' as const, createdAt: 'x', updatedAt: 'x' }],
      sets: [],
      units: [],
    }
    const json = serializeInventory(snap, { app: 'cable', exportedAt: '2026-07-06' })
    expect(json).toContain(INVENTORY_FORMAT)
    const parsed = parseInventory(json)
    expect(parsed?.items[0].model).toBe('SM58')
    expect(parsed?.nodes[0].name).toBe('Case')
  })

  it('lehnt fremdes/kaputtes JSON ab', () => {
    expect(parseInventory('not json')).toBeNull()
    expect(parseInventory(JSON.stringify({ format: 'foo', version: 1 }))).toBeNull()
    expect(parseInventory(JSON.stringify({ format: INVENTORY_FORMAT, version: 99 }))).toBeNull()
  })
})

describe('inventoryStore — Import/Export', () => {
  beforeEach(reset)

  it('exportSnapshot liefert den aktuellen Bestand', () => {
    const st = useInventoryStore.getState()
    st.addItem({ model: 'Cam', quantity: 2 })
    st.addNode({ name: 'Regal', kind: 'shelf' })
    const snap = useInventoryStore.getState().exportSnapshot()
    expect(snap.items).toHaveLength(1)
    expect(snap.nodes).toHaveLength(1)
  })

  it('importSnapshot replace ersetzt, merge fügt zusammen', () => {
    const st = useInventoryStore.getState()
    const existing = st.addItem({ model: 'Vorhanden', quantity: 1 })
    // replace
    const n = st.importSnapshot(
      { items: [{ id: 'imp1', model: 'Importiert', quantity: 5, createdAt: 'x', updatedAt: 'x' }] },
      'replace',
    )
    expect(n).toBe(1)
    let items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].model).toBe('Importiert')
    expect(items.some((i) => i.id === existing)).toBe(false)
    // merge (fügt hinzu, überschreibt gleiche id)
    st.importSnapshot(
      {
        items: [
          { id: 'imp1', model: 'Importiert v2', quantity: 6, createdAt: 'x', updatedAt: 'x' },
          { id: 'imp2', model: 'Neu', quantity: 1, createdAt: 'x', updatedAt: 'x' },
        ],
      },
      'merge',
    )
    items = useInventoryStore.getState().items
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === 'imp1')?.model).toBe('Importiert v2')
  })

  it('Import heilt kaputte Einträge (Pflichtfelder fehlen → verworfen)', () => {
    const st = useInventoryStore.getState()
    const n = st.importSnapshot({ items: [{ id: 'x', quantity: 1 } as unknown] }, 'replace')
    expect(n).toBe(0) // model fehlt → geheilt-verworfen
  })
})
