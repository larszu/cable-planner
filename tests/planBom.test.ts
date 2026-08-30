import { describe, expect, it } from 'vitest'
import { buildPlanBom, outcomeLabel, pickListCsv, planBomCsv } from '../src/renderer/lib/planBom'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, StorageNode } from '../src/renderer/types/inventory'

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

const node = (over: Partial<StorageNode>): StorageNode => ({
  id: 'n1',
  name: 'Knoten',
  kind: 'shelf',
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const NODES = [
  node({ id: 'depot', name: 'Depot', kind: 'depot' }),
  node({ id: 'regal', name: 'Regal A3', kind: 'shelf', parentId: 'depot' }),
]

describe('buildPlanBom', () => {
  it('zeigt Menge, Modell, Deckung und Lagerort für eine echte Deckung', () => {
    const bom = buildPlanBom(
      [eq({ id: 'a', deviceTypeId: F55_ID }), eq({ id: 'b', deviceTypeId: F55_ID })],
      [item({ id: 'i1', model: F55_MODEL, quantity: 4, deviceTypeId: F55_ID, locationId: 'regal' })],
      NODES,
    )
    expect(bom.rows[0]).toMatchObject({
      quantity: 2,
      model: F55_MODEL,
      outcome: 'matched-by-type',
      available: 4,
      location: 'Depot › Regal A3',
    })
    expect(bom.matched).toBe(1)
    expect(bom.missing).toEqual([])
  })

  it('zählt eine Unterdeckung zu den fehlenden, obwohl sie gedeckt ist', () => {
    const bom = buildPlanBom(
      [
        eq({ id: 'a', deviceTypeId: F55_ID }),
        eq({ id: 'b', deviceTypeId: F55_ID }),
        eq({ id: 'c', deviceTypeId: F55_ID }),
      ],
      [item({ model: F55_MODEL, quantity: 1, deviceTypeId: F55_ID })],
      NODES,
    )
    expect(bom.rows[0].short).toBe(2)
    expect(bom.missing).toHaveLength(1)
  })

  it('nennt bei einem Vorschlag KEINEN Lagerort', () => {
    // Ein Regalplatz liest sich wie eine Zusage; bei einem Vorschlag ist
    // noch gar nicht sicher, dass es diese Position ist.
    const bom = buildPlanBom(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 9, locationId: 'regal' })],
      NODES,
    )
    expect(bom.rows[0].outcome).toBe('proposed-by-name')
    expect(bom.rows[0].location).toBe('')
    expect(bom.rows[0].reason).toBeTruthy()
  })

  it('zählt einen Vorschlag NICHT als gedeckt', () => {
    const bom = buildPlanBom(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 9 })],
      NODES,
    )
    expect(bom.matched).toBe(0)
    expect(bom.proposed).toBe(1)
    expect(bom.missing).toHaveLength(1)
  })

  it('markiert eine Zeile, deren Modellname nur der Gerätename ist', () => {
    const bom = buildPlanBom([eq({ name: 'Sonderbau XY' })], [], NODES)
    expect(bom.rows[0]).toMatchObject({ modelIsDeviceName: true, outcome: 'unmatched' })
  })

  it('bleibt bei leerem Plan leer', () => {
    expect(buildPlanBom([], [item({})], NODES)).toMatchObject({
      rows: [],
      missing: [],
      matched: 0,
    })
  })
})

describe('planBomCsv', () => {
  it('schreibt den Deckungszustand im Klartext', () => {
    const bom = buildPlanBom(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 2, deviceTypeId: F55_ID })],
      NODES,
    )
    const lines = planBomCsv(bom).split('\r\n')
    expect(lines[0]).toContain('Deckung')
    expect(lines[1]).toContain('gedeckt')
  })

  it('macht einen Vorschlag auch auf Papier als solchen kenntlich', () => {
    const bom = buildPlanBom(
      [eq({ deviceTypeId: F55_ID })],
      [item({ model: F55_MODEL, quantity: 2 })],
      NODES,
    )
    const line = planBomCsv(bom).split('\r\n')[1]
    expect(line).toContain('VORSCHLAG')
    expect(line).toContain('Typ-Identitaet')
  })

  it('erklärt eine Zeile ohne Katalog-Typ', () => {
    const bom = buildPlanBom([eq({ name: 'Sonderbau XY' })], [], NODES)
    expect(planBomCsv(bom)).toContain('Ohne Katalog-Typ')
  })
})

describe('pickListCsv', () => {
  it('enthält nur sicher gedeckte Zeilen', () => {
    const bom = buildPlanBom(
      [eq({ id: 'a', deviceTypeId: F55_ID }), eq({ id: 'b', name: 'Vorschlagsware' })],
      [
        item({ id: 'i1', model: F55_MODEL, quantity: 3, deviceTypeId: F55_ID, locationId: 'regal' }),
        item({ id: 'i2', model: 'Vorschlagsware', quantity: 1 }),
      ],
      NODES,
    )
    const csv = pickListCsv(bom)
    expect(csv).toContain(F55_MODEL)
    expect(csv).not.toContain('Vorschlagsware')
  })

  it('sortiert nach Lagerort, damit man den Weg einmal geht', () => {
    const nodes = [
      ...NODES,
      node({ id: 'regal-z', name: 'Regal Z9', kind: 'shelf', parentId: 'depot' }),
    ]
    const bom = buildPlanBom(
      [eq({ id: 'a', deviceTypeId: F55_ID }), eq({ id: 'b', name: 'Zweitgerät' })],
      [
        item({ id: 'i1', model: F55_MODEL, quantity: 1, deviceTypeId: F55_ID, locationId: 'regal-z' }),
        item({ id: 'i2', model: 'Zweitgerät', quantity: 1, locationId: 'regal' }),
      ],
      nodes,
    )
    // Nur die typisierte Zeile ist gedeckt; die zweite ist ein Vorschlag und
    // gehört nicht auf die Kommissionier-Liste.
    const rows = pickListCsv(bom).split('\r\n').slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('Regal Z9')
  })
})

describe('outcomeLabel', () => {
  it('unterscheidet die drei Zustände im Klartext', () => {
    expect(outcomeLabel('matched-by-type')).toBe('gedeckt')
    expect(outcomeLabel('proposed-by-name')).toBe('VORSCHLAG')
    expect(outcomeLabel('unmatched')).toBe('nicht im Lager')
  })
})

describe('PlanBomRow — was eine Bestätigung braucht', () => {
  it('trägt bei einem Vorschlag Position UND Katalog-Identität mit', () => {
    // Beides zusammen ist alles, was die Bestätigung braucht: die Identität
    // auf die Position schreiben, dann ist die Deckung eine Tatsache.
    const bom = buildPlanBom(
      [eq({ deviceTypeId: F55_ID })],
      [item({ id: 'i1', model: F55_MODEL, quantity: 2 })],
      NODES,
    )
    expect(bom.rows[0]).toMatchObject({
      outcome: 'proposed-by-name',
      itemId: 'i1',
      deviceTypeId: F55_ID,
    })
  })

  it('lässt die Identität weg, wo der Bedarf keine hat', () => {
    // Ohne Katalog-Typ im Plan gibt es nichts zu bestätigen — die Zeile darf
    // dann auch keinen Knopf anbieten.
    const bom = buildPlanBom(
      [eq({ name: 'Sonderbau XY' })],
      [item({ id: 'i1', model: 'Sonderbau XY', quantity: 1 })],
      NODES,
    )
    expect(bom.rows[0].deviceTypeId).toBeUndefined()
  })
})
