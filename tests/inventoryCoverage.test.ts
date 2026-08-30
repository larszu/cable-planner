import { describe, expect, it } from 'vitest'
import {
  deriveDemand,
  normaliseName,
  resolveCoverage,
} from '../src/renderer/lib/inventoryCoverage'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem } from '../src/renderer/types/inventory'

/** Echter Katalog-Eintrag, damit der Modellname aus der Registry kommt. */
const F55_ID = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
const F55_MODEL = 'Sony PMW-F55'

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
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
})

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'i1',
  model: 'Modell',
  quantity: 1,
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

describe('deriveDemand', () => {
  it('zählt zwei Geräte desselben Typs zu EINER Zeile mit Menge 2', () => {
    // Genau der Fehler, den seedFromEquipment heute macht: "Kamera 1" und
    // "Kamera 2" werden dort zu zwei Positionen à 1 Stück.
    const demand = deriveDemand([
      eq({ id: 'a', name: 'Kamera 1', deviceTypeId: F55_ID }),
      eq({ id: 'b', name: 'Kamera 2', deviceTypeId: F55_ID }),
    ])
    expect(demand).toHaveLength(1)
    expect(demand[0]).toMatchObject({ quantity: 2, label: F55_MODEL, labelIsDeviceName: false })
    expect(demand[0].equipmentIds).toEqual(['a', 'b'])
  })

  it('nimmt den Modellnamen aus dem Katalog, nicht den Instanznamen', () => {
    const demand = deriveDemand([eq({ name: 'Kamera 1', deviceTypeId: F55_ID })])
    expect(demand[0].label).toBe(F55_MODEL)
  })

  it('markiert eine Zeile, deren Label nur der Gerätename ist', () => {
    const demand = deriveDemand([eq({ name: 'Kamera 1' })])
    expect(demand[0]).toMatchObject({ label: 'Kamera 1', labelIsDeviceName: true })
    expect(demand[0].deviceTypeId).toBeUndefined()
  })

  it('trennt gleichnamige Geräte verschiedener Kategorien', () => {
    const demand = deriveDemand([
      eq({ id: 'a', name: 'MS-1', category: 'Kameras' }),
      eq({ id: 'b', name: 'MS-1', category: 'Audio' }),
    ])
    expect(demand).toHaveLength(2)
  })

  it('überspringt Geräte ohne jeden Namen', () => {
    expect(deriveDemand([eq({ name: '   ' })])).toEqual([])
  })
})

describe('resolveCoverage — matched-by-type', () => {
  it('deckt über die Katalog-GUID, nicht über den Namen', () => {
    const res = resolveCoverage(
      [eq({ name: 'Kamera 1', deviceTypeId: F55_ID })],
      [item({ id: 'inv1', model: 'Ganz anders benannt', quantity: 3, deviceTypeId: F55_ID })],
    )
    expect(res.lines[0]).toMatchObject({
      outcome: 'matched-by-type',
      itemId: 'inv1',
      available: 3,
    })
    expect(res.matched).toBe(1)
  })

  it('meldet die Fehlmenge, wenn der Bestand nicht reicht', () => {
    const res = resolveCoverage(
      [
        eq({ id: 'a', name: 'Kamera 1', deviceTypeId: F55_ID }),
        eq({ id: 'b', name: 'Kamera 2', deviceTypeId: F55_ID }),
        eq({ id: 'c', name: 'Kamera 3', deviceTypeId: F55_ID }),
      ],
      [item({ id: 'inv1', model: F55_MODEL, quantity: 2, deviceTypeId: F55_ID })],
    )
    expect(res.lines[0]).toMatchObject({ outcome: 'matched-by-type', short: 1 })
  })

  it('lässt short weg, wenn genug da ist', () => {
    const res = resolveCoverage(
      [eq({ deviceTypeId: F55_ID })],
      [item({ quantity: 5, deviceTypeId: F55_ID })],
    )
    expect(res.lines[0].short).toBeUndefined()
  })
})

describe('resolveCoverage — proposed-by-name', () => {
  it('schlägt eine Position ohne Typ-Identität bei gleichem Modellnamen vor', () => {
    const res = resolveCoverage(
      [eq({ name: 'Kamera 1', deviceTypeId: F55_ID })],
      [item({ id: 'inv1', model: F55_MODEL, quantity: 4 })],
    )
    expect(res.lines[0]).toMatchObject({ outcome: 'proposed-by-name', itemId: 'inv1' })
    expect(res.lines[0].reason).toContain('keine Typ-Identitaet')
    expect(res.proposed).toBe(1)
  })

  it('schlägt auch bei kleiner Abweichung vor — mit Begründung', () => {
    const res = resolveCoverage(
      [eq({ deviceTypeId: F55_ID })],
      [item({ id: 'inv1', model: 'Sony PMW-F56', quantity: 1 })],
    )
    expect(res.lines[0].outcome).toBe('proposed-by-name')
    expect(res.lines[0].reason).toContain('weicht um')
  })

  it('befördert einen Vorschlag NIE zur Deckung', () => {
    // Der Kern der Regel: ein Namenstreffer bleibt ein Vorschlag, egal wie
    // gut er aussieht. Sonst wird die Liste geglaubt statt gelesen.
    const res = resolveCoverage(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 99 })],
    )
    expect(res.matched).toBe(0)
    expect(res.lines[0].outcome).toBe('proposed-by-name')
  })

  it('schlägt keine Position vor, die bereits eine ANDERE Typ-Identität trägt', () => {
    // Gleicher Name, andere GUID ist kein Treffer, sondern ein Widerspruch.
    const res = resolveCoverage(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 9, deviceTypeId: 'dt-fremd' })],
    )
    expect(res.lines[0].outcome).toBe('unmatched')
  })

  it('vergleicht Namen unabhängig von Schreibweise und Leerraum', () => {
    const res = resolveCoverage(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: '  sony   pmw-f55 ', quantity: 1 })],
    )
    expect(res.lines[0].outcome).toBe('proposed-by-name')
  })

  it('rät nicht bei sehr kurzen Namen', () => {
    const res = resolveCoverage([eq({ name: 'Mic' })], [item({ model: 'Mix', quantity: 1 })])
    expect(res.lines[0].outcome).toBe('unmatched')
  })
})

describe('resolveCoverage — unmatched', () => {
  it('meldet ehrlich, was im Lager fehlt', () => {
    const res = resolveCoverage([eq({ name: 'Blackmagic URSA' })], [])
    expect(res.lines[0]).toMatchObject({ outcome: 'unmatched' })
    expect(res.lines[0].itemId).toBeUndefined()
    expect(res.unmatched).toBe(1)
  })

  it('bleibt bei leerem Plan leer, statt etwas zu erfinden', () => {
    expect(resolveCoverage([], [item({})])).toMatchObject({
      lines: [],
      matched: 0,
      proposed: 0,
      unmatched: 0,
    })
  })
})

describe('normaliseName', () => {
  it('macht Schreibweise und Leerraum vergleichbar', () => {
    expect(normaliseName('  Sony   PMW-F55 ')).toBe('sony pmw-f55')
  })
})
