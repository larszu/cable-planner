import { describe, expect, it, beforeEach } from 'vitest'
import { mergeById, mergeDefined } from '../src/renderer/lib/inventoryMerge'
import { useInventoryStore } from '../src/renderer/store/inventoryStore'

// ADR-005, Inkrement 4, Regel 2 — eine Projektion darf nicht ueberschreiben.
//
// Der Lager-Import nahm im Modus „merge" den eingehenden Datensatz als
// GANZES (`byId.set(x.id, x)`). Eine v1-Datei aus der Zeit vor ADR-002 traegt
// keine `deviceTypeId`; stand im lokalen Lager derselbe Artikel MIT
// bestaetigter Typ-Identitaet, war sie nach dem Import weg.
//
// Der Kopf von inventoryPortable.ts hatte die Gefahr sogar benannt — aber nur
// fuer die andere Richtung (eine zu NEUE Datei, die der Stand nicht kennt).
// Die aeltere Datei, die etwas WEGNIMMT, stand nirgends.

interface Item {
  id: string
  model: string
  deviceTypeId?: string
  notes?: string
  updatedAt?: string
}

describe('mergeDefined — was die Datei nicht sagt, loescht nichts', () => {
  it('haelt den vorhandenen Wert, wenn der eingehende undefined ist', () => {
    const base = { id: 'a', model: 'X', deviceTypeId: 'dt-1' }
    const over = { id: 'a', model: 'X', deviceTypeId: undefined }
    expect(mergeDefined(base, over).deviceTypeId).toBe('dt-1')
  })

  it('uebernimmt einen gesetzten Wert — auch einen leeren String', () => {
    // Leerer String ist eine Aussage („der Nutzer hat die Notiz geleert"),
    // undefined ist keine. Der Unterschied ist der ganze Punkt.
    const base = { id: 'a', model: 'X', notes: 'alt' }
    const over = { id: 'a', model: 'X', notes: '' }
    expect(mergeDefined(base, over).notes).toBe('')
  })

  it('uebernimmt auch 0 und false', () => {
    const base = { quantity: 5, locked: true }
    const over = { quantity: 0, locked: false }
    expect(mergeDefined(base, over)).toEqual({ quantity: 0, locked: false })
  })

  it('fasst die Eingaben nicht an', () => {
    const base = { id: 'a', model: 'X', deviceTypeId: 'dt-1' }
    const over = { id: 'a', model: 'Y', deviceTypeId: undefined }
    const before = JSON.stringify([base, over])
    mergeDefined(base, over)
    expect(JSON.stringify([base, over])).toBe(before)
  })
})

describe('mergeById — der eigentliche Fall', () => {
  const local: Item[] = [
    { id: 'i1', model: 'ULXD2', deviceTypeId: 'dt-shure-ulxd2', notes: 'Regal A3' },
    { id: 'i2', model: 'SM58' },
  ]

  it('eine aeltere v1-Datei loescht die bestaetigte deviceTypeId NICHT mehr', () => {
    // Genau der Fehler: healItem setzt fehlende Felder ausdruecklich auf
    // undefined, der eingehende Artikel traegt sie also als gesetzte
    // Schluessel. Ein `{ ...alt, ...neu }` haette hier ebenfalls geloescht.
    const v1: Item[] = [{ id: 'i1', model: 'ULXD2', deviceTypeId: undefined, notes: undefined }]
    const out = mergeById(local, v1)
    const merged = out.find((x) => x.id === 'i1')!
    expect(merged.deviceTypeId).toBe('dt-shure-ulxd2')
    expect(merged.notes).toBe('Regal A3')
  })

  it('haengt unbekannte Artikel an, statt sie zu verwerfen', () => {
    const out = mergeById(local, [{ id: 'i9', model: 'Neu' }])
    expect(out.map((x) => x.id)).toEqual(['i1', 'i2', 'i9'])
  })

  it('schreibt gesetzte Felder fort — der Import bleibt ein Import', () => {
    const out = mergeById(local, [
      { id: 'i1', model: 'ULXD2', notes: 'Case 7', updatedAt: '2026-01-01' },
    ])
    const merged = out.find((x) => x.id === 'i1')!
    expect(merged.notes).toBe('Case 7')
    expect(merged.updatedAt).toBe('2026-01-01')
    // ... und die Typ-Identitaet ueberlebt trotzdem.
    expect(merged.deviceTypeId).toBe('dt-shure-ulxd2')
  })

  it('haelt die Reihenfolge des Bestands', () => {
    const out = mergeById(local, [{ id: 'i2', model: 'SM58' }, { id: 'i0', model: 'Vorne' }])
    expect(out.map((x) => x.id)).toEqual(['i1', 'i2', 'i0'])
  })
})

describe('importSnapshot merge — der Weg, auf dem es wirklich passiert', () => {
  // Die Tests oben pruefen den neuen Helfer; der existierte am alten Stand
  // nicht. DIESER Test geht durch den Store und faellt am alten Code.
  beforeEach(() => {
    localStorage.clear()
    useInventoryStore.setState({ items: [], nodes: [], sets: [], units: [] })
  })

  it('eine v1-Datei nimmt dem lokalen Artikel die deviceTypeId nicht weg', () => {
    const st = useInventoryStore.getState()
    const id = st.addItem({ model: 'ULXD2', quantity: 4, deviceTypeId: 'dt-shure-ulxd2' })
    expect(useInventoryStore.getState().items[0].deviceTypeId).toBe('dt-shure-ulxd2')

    // So sieht ein Artikel aus einer Datei VOR ADR-002 aus: dasselbe Geraet,
    // dieselbe Id, nur ohne Typ-Identitaet.
    const report = useInventoryStore.getState().importSnapshot(
      { items: [{ id, model: 'ULXD2', quantity: 6 }] },
      'merge',
    )
    expect(report.imported).toBe(1)

    const after = useInventoryStore.getState().items
    expect(after).toHaveLength(1)
    expect(after[0].quantity).toBe(6) // die Datei hat etwas zu sagen: uebernommen
    expect(after[0].deviceTypeId).toBe('dt-shure-ulxd2') // und sie nimmt nichts weg
  })

  it("'replace' ersetzt weiterhin vollstaendig — dafuer ist der Modus da", () => {
    const st = useInventoryStore.getState()
    const id = st.addItem({ model: 'ULXD2', quantity: 4, deviceTypeId: 'dt-shure-ulxd2' })
    useInventoryStore.getState().importSnapshot(
      { items: [{ id, model: 'ULXD2', quantity: 6 }] },
      'replace',
    )
    expect(useInventoryStore.getState().items[0].deviceTypeId).toBeUndefined()
  })
})
