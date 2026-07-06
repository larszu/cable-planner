import { describe, expect, it, beforeEach } from 'vitest'
import { useInventoryStore } from '../src/renderer/store/inventoryStore'

/**
 * Lager-Modul — LPN-Baum (Lagerplätze + Container) + Sets.
 * Prüft die Store-Aktionen: Lagerort zuweisen (= einpacken), verschachtelte
 * Container, Löschen mit Kind-Hochzug, Set-CRUD.
 */
const reset = () => {
  localStorage.clear()
  useInventoryStore.setState({ items: [], nodes: [], sets: [] })
}

describe('inventoryStore — LPN-Baum', () => {
  beforeEach(reset)

  it('weist einem Artikel einen Container als Lagerort zu (= einpacken)', () => {
    const st = useInventoryStore.getState()
    const itemId = st.addItem({ model: 'SM58', quantity: 4 })
    const caseId = st.addNode({ name: 'Case 1', kind: 'case' })
    st.setItemLocation(itemId, caseId)
    const it = useInventoryStore.getState().items.find((x) => x.id === itemId)
    expect(it?.locationId).toBe(caseId)
  })

  it('verschachtelt Container (Case in Transport-Case) via parentId', () => {
    const st = useInventoryStore.getState()
    const tcase = st.addNode({ name: 'TCase', kind: 'transportCase' })
    const inner = st.addNode({ name: 'Case', kind: 'case', parentId: tcase })
    const node = useInventoryStore.getState().nodes.find((n) => n.id === inner)
    expect(node?.parentId).toBe(tcase)
  })

  it('moveNode wehrt Zyklen ab (Container in eigenen Nachfahren)', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'A', kind: 'case' })
    const b = st.addNode({ name: 'B', kind: 'case', parentId: a })
    st.moveNode(a, b) // A unter seinen Nachfahren B → verboten
    const node = useInventoryStore.getState().nodes.find((n) => n.id === a)
    expect(node?.parentId).toBeUndefined()
  })

  it('removeNode zieht Kinder hoch und löst Artikel-Lagerort', () => {
    const st = useInventoryStore.getState()
    const parent = st.addNode({ name: 'Regal', kind: 'shelf' })
    const child = st.addNode({ name: 'Case', kind: 'case', parentId: parent })
    const itemId = st.addItem({ model: 'Kabel', quantity: 10, locationId: parent })
    st.removeNode(parent)
    const s2 = useInventoryStore.getState()
    // Kind rückt zur Wurzel (parent des gelöschten war undefined)
    expect(s2.nodes.find((n) => n.id === child)?.parentId).toBeUndefined()
    // Artikel verliert seinen Lagerort
    expect(s2.items.find((i) => i.id === itemId)?.locationId).toBeUndefined()
  })

  it('legt Sets an und entfernt gelöschte Artikel aus Komponenten', () => {
    const st = useInventoryStore.getState()
    const a = st.addItem({ model: 'Cam', quantity: 3 })
    const b = st.addItem({ model: 'Lens', quantity: 5 })
    const setId = st.addSet({ name: 'Cam-Kit', components: [{ itemId: a, quantity: 1 }, { itemId: b, quantity: 2 }] })
    st.removeItem(b)
    const s = useInventoryStore.getState().sets.find((x) => x.id === setId)
    expect(s?.components).toEqual([{ itemId: a, quantity: 1 }])
  })

  it('persistiert items/nodes/sets in localStorage', () => {
    const st = useInventoryStore.getState()
    const itemId = st.addItem({ model: 'X', quantity: 1 })
    const caseId = st.addNode({ name: 'C', kind: 'case' })
    st.setItemLocation(itemId, caseId)
    const raw = JSON.parse(localStorage.getItem('cable-planner:inventory')!)
    expect(raw.nodes).toHaveLength(1)
    expect(raw.items.find((i: { id: string }) => i.id === itemId).locationId).toBe(caseId)
  })
})
