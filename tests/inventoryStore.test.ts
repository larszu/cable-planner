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

describe('inventoryStore — Typ-Identität (ADR-002)', () => {
  beforeEach(reset)

  it('trägt deviceTypeId durch die Heilung', () => {
    // Genau hier ginge das Feld sonst verloren: healItem baut den Artikel
    // Feld für Feld neu auf, unbekannte Schlüssel fallen weg.
    const st = useInventoryStore.getState()
    st.importSnapshot(
      { items: [{ id: 'i1', model: 'ULXD2', quantity: 2, deviceTypeId: 'dt-0001' } as never] },
      'replace',
    )
    expect(useInventoryStore.getState().items[0].deviceTypeId).toBe('dt-0001')
  })

  it('verwirft eine leere Typ-Identität, statt sie als Schlüssel zu führen', () => {
    const st = useInventoryStore.getState()
    st.importSnapshot(
      { items: [{ id: 'i1', model: 'ULXD2', quantity: 1, deviceTypeId: '  ' } as never] },
      'replace',
    )
    expect(useInventoryStore.getState().items[0].deviceTypeId).toBeUndefined()
  })
})

describe('inventoryStore — seedFromEquipment (ADR-002, Inkrement 3)', () => {
  beforeEach(reset)

  const F55_ID = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
  const F55_MODEL = 'Sony PMW-F55'
  const dev = (over: Record<string, unknown>) =>
    ({
      id: 'e1',
      name: 'Gerät',
      category: 'Kameras',
      inputs: [],
      outputs: [],
      x: 0,
      y: 0,
      width: 200,
      height: 160,
      ...over,
    }) as never

  it('macht aus zwei Geräten EINES Typs eine Position mit Menge 2', () => {
    // Der Fehler, den diese Funktion vorher hatte: Sie gruppierte über den
    // Instanznamen, also wurden "Kamera 1" und "Kamera 2" zu zwei
    // Positionen à 1 Stück — und der Instanzname landete im model-Feld.
    const st = useInventoryStore.getState()
    const created = st.seedFromEquipment([
      dev({ id: 'a', name: 'Kamera 1', deviceTypeId: F55_ID }),
      dev({ id: 'b', name: 'Kamera 2', deviceTypeId: F55_ID }),
    ])
    expect(created).toBe(1)
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      model: F55_MODEL,
      quantity: 2,
      deviceTypeId: F55_ID,
    })
  })

  it('nimmt für Geräte ohne Katalog-Typ weiter den Namen', () => {
    const st = useInventoryStore.getState()
    st.seedFromEquipment([dev({ id: 'a', name: 'Sonderbau XY' })])
    const items = useInventoryStore.getState().items
    expect(items[0]).toMatchObject({ model: 'Sonderbau XY', quantity: 1 })
    expect(items[0].deviceTypeId).toBeUndefined()
  })

  it('legt eine vorhandene Position nicht doppelt an, sondern hebt die Menge', () => {
    const st = useInventoryStore.getState()
    st.addItem({ model: F55_MODEL, quantity: 1, deviceTypeId: F55_ID })
    st.seedFromEquipment([
      dev({ id: 'a', deviceTypeId: F55_ID }),
      dev({ id: 'b', deviceTypeId: F55_ID }),
    ])
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
  })

  it('trägt die Typ-Identität an einer namensgleichen Position nach', () => {
    // Ein zweiter Artikel gleichen Namens wäre schlimmer als die
    // Verknüpfung — und danach muss sie nie wieder über den Namen gefunden
    // werden.
    const st = useInventoryStore.getState()
    st.addItem({ model: F55_MODEL, quantity: 5 })
    st.seedFromEquipment([dev({ id: 'a', deviceTypeId: F55_ID })])
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ deviceTypeId: F55_ID, quantity: 5 })
  })

  it('senkt eine vorhandene Menge nicht ab', () => {
    const st = useInventoryStore.getState()
    st.addItem({ model: F55_MODEL, quantity: 9, deviceTypeId: F55_ID })
    st.seedFromEquipment([dev({ id: 'a', deviceTypeId: F55_ID })])
    expect(useInventoryStore.getState().items[0].quantity).toBe(9)
  })
})

describe('inventoryStore — seedFromEquipment, Grenzfälle des Namens-Fallbacks', () => {
  beforeEach(reset)

  const F55_ID = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
  const F55_MODEL = 'Sony PMW-F55'
  const dev = (over: Record<string, unknown>) =>
    ({
      id: 'e1',
      name: 'Gerät',
      category: 'Kameras',
      inputs: [],
      outputs: [],
      x: 0,
      y: 0,
      width: 200,
      height: 160,
      ...over,
    }) as never

  it('verknüpft NICHT, wenn der Modellname mehrdeutig ist', () => {
    // Zwei gleichnamige Positionen: jede Wahl wäre geraten, also lieber keine.
    const st = useInventoryStore.getState()
    st.addItem({ model: F55_MODEL, quantity: 2, category: 'Kameras' })
    st.addItem({ model: F55_MODEL, quantity: 3, category: 'Miete' })
    st.seedFromEquipment([dev({ id: 'a', deviceTypeId: F55_ID })])
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(3)
    expect(items.filter((i) => i.deviceTypeId === F55_ID)).toHaveLength(1)
  })

  it('verschluckt den Bedarf nicht an einer fremd-typisierten Namensgleichheit', () => {
    // Gleicher Name, andere Identität ist ein Widerspruch, kein Treffer.
    // Würde er als Treffer zählen, bliebe die fremde Position unverändert
    // UND es entstünde keine neue — der Bedarf wäre spurlos verschwunden.
    const st = useInventoryStore.getState()
    st.addItem({ model: F55_MODEL, quantity: 4, deviceTypeId: 'dt-fremd' })
    const created = st.seedFromEquipment([dev({ id: 'a', deviceTypeId: F55_ID })])
    expect(created).toBe(1)
    const items = useInventoryStore.getState().items
    expect(items.find((i) => i.deviceTypeId === 'dt-fremd')?.quantity).toBe(4)
    expect(items.find((i) => i.deviceTypeId === F55_ID)?.quantity).toBe(1)
  })
})
