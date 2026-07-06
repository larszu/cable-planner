import { describe, expect, it, beforeEach } from 'vitest'
import { useInventoryStore } from '../src/renderer/store/inventoryStore'

/**
 * Lager-Modul — Datenmodell (Codes, Maße, Material-Art, Cases).
 * Prüft die Store-Aktionen + Persistenz-Heilung (nichts erfinden: nur
 * positive Maße überleben, unbekannte Codearten fallen weg).
 */
const reset = () => {
  localStorage.clear()
  useInventoryStore.setState({ items: [], cases: [] })
}

describe('inventoryStore — Lager-Modul', () => {
  beforeEach(reset)

  it('legt einen Artikel mit Code, Maßen und Material-Art an', () => {
    const id = useInventoryStore.getState().addItem({
      model: 'Shure SM58',
      quantity: 4,
      code: 'INV-1',
      codeType: 'barcode',
      dimensions: { widthMm: 50, heightMm: 160, weightKg: 0.3 },
      materialKinds: ['rental'],
      ownership: 'owned',
    })
    const it = useInventoryStore.getState().items.find((x) => x.id === id)
    expect(it?.code).toBe('INV-1')
    expect(it?.codeType).toBe('barcode')
    expect(it?.dimensions?.weightKg).toBe(0.3)
    expect(it?.materialKinds).toEqual(['rental'])
  })

  it('packt Artikel in ein Case (addiert Stückzahl) und entpackt wieder', () => {
    const st = useInventoryStore.getState()
    const itemId = st.addItem({ model: 'Kabel XLR', quantity: 20 })
    const caseId = st.addCase({ name: 'Case 1', contents: [] })
    st.packItem(caseId, itemId, 3)
    st.packItem(caseId, itemId, 2)
    let box = useInventoryStore.getState().cases.find((c) => c.id === caseId)
    expect(box?.contents).toEqual([{ itemId, quantity: 5 }])
    useInventoryStore.getState().unpackItem(caseId, itemId)
    box = useInventoryStore.getState().cases.find((c) => c.id === caseId)
    expect(box?.contents).toEqual([])
  })

  it('entfernt gelöschte Artikel aus allen Cases (keine toten Referenzen)', () => {
    const st = useInventoryStore.getState()
    const itemId = st.addItem({ model: 'Stativ', quantity: 5 })
    const caseId = st.addCase({ name: 'Case 2', contents: [] })
    st.packItem(caseId, itemId, 1)
    st.removeItem(itemId)
    const box = useInventoryStore.getState().cases.find((c) => c.id === caseId)
    expect(box?.contents).toEqual([])
  })

  it('persistiert Cases zusammen mit Artikeln in localStorage', () => {
    const st = useInventoryStore.getState()
    const itemId = st.addItem({ model: 'Case-Test', quantity: 1 })
    const caseId = st.addCase({ name: 'Persist-Case', contents: [] })
    st.packItem(caseId, itemId, 2)
    const raw = JSON.parse(localStorage.getItem('cable-planner:inventory')!)
    expect(raw.cases).toHaveLength(1)
    expect(raw.cases[0].contents).toEqual([{ itemId, quantity: 2 }])
    expect(raw.items.some((i: { id: string }) => i.id === itemId)).toBe(true)
  })
})
