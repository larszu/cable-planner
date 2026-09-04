// ───────────────────────────────────────────────────────────────────────────
// Dasselbe Modell an mehreren Lagerorten.
//
// Ein Lager fuehrt das taeglich: ein Artikel traegt genau EINE `locationId`,
// gleiches Modell in zwei Cases erzwingt also zwei Positionen, und `addItem`
// dedupliziert nicht. Bis 2026-09-04 gewann im Resolver die erste Position und
// die zweite wurde verworfen — nichts wurde addiert.
//
// Gemessen an genau diesem Fall: Plan braucht 5, Lager hat 3 in Case 1 und 3
// in Case 2. Die Liste meldete "Bestand 3, Fehlmenge 2" und schickte den
// Kommissionierer mit "Menge 5" nach Case 1. Es waren sechs da, und Case 2 kam
// in der Liste nicht vor.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { buildPlanBom, pickListCsv } from '../src/renderer/lib/planBom'
import { resolveCoverage } from '../src/renderer/lib/inventoryCoverage'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, StorageNode } from '../src/renderer/types/inventory'

const TYP = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
const MODELL = 'Sony PMW-F55'

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
  model: MODELL,
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
  node({ id: 'c1', name: 'Case 1', kind: 'case', parentId: 'depot' }),
  node({ id: 'c2', name: 'Case 2', kind: 'case', parentId: 'depot' }),
]

const plan = (n: number) => Array.from({ length: n }, (_, i) => eq({ id: `e${i}`, deviceTypeId: TYP }))

const zweiOrte = (a: number, b: number) => [
  item({ id: 'i1', model: MODELL, quantity: a, deviceTypeId: TYP, locationId: 'c1' }),
  item({ id: 'i2', model: MODELL, quantity: b, deviceTypeId: TYP, locationId: 'c2' }),
]

describe('der Bestand wird ueber Lagerpositionen summiert', () => {
  it('3 + 3 sind 6, nicht 3', () => {
    const res = resolveCoverage(plan(5), zweiOrte(3, 3))
    expect(res.lines[0]).toMatchObject({ outcome: 'matched-by-type', available: 6 })
    expect(res.lines[0].short).toBeUndefined()
  })

  it('beide Positionen stehen als Quelle drin', () => {
    const res = resolveCoverage(plan(5), zweiOrte(3, 3))
    expect(res.lines[0].sources).toEqual([
      { itemId: 'i1', model: MODELL, available: 3, locationId: 'c1' },
      { itemId: 'i2', model: MODELL, available: 3, locationId: 'c2' },
    ])
  })

  it('die Zeile gilt nicht mehr als fehlend', () => {
    expect(buildPlanBom(plan(5), zweiOrte(3, 3), NODES).missing).toEqual([])
  })

  it('eine echte Fehlmenge bleibt eine Fehlmenge', () => {
    // 2 + 2 = 4 bei Bedarf 5: hier fehlt wirklich eines.
    const res = resolveCoverage(plan(5), zweiOrte(2, 2))
    expect(res.lines[0]).toMatchObject({ available: 4, short: 1 })
  })
})

describe('die Kommissionier-Liste teilt auf die Lagerorte auf', () => {
  it('eine Zeile je Ort, mit der dort zu entnehmenden Menge', () => {
    const bom = buildPlanBom(plan(5), zweiOrte(3, 3), NODES)
    expect(pickListCsv(bom).split('\r\n').slice(1)).toEqual([
      'Depot › Case 1;3;Sony PMW-F55;3;',
      'Depot › Case 2;2;Sony PMW-F55;3;',
    ])
  })

  it('die Aufteilung haengt nicht an der Reihenfolge der Positionen', () => {
    const vorwaerts = buildPlanBom(plan(5), zweiOrte(3, 3), NODES)
    const rueckwaerts = buildPlanBom(plan(5), zweiOrte(3, 3).reverse(), NODES)
    expect(pickListCsv(vorwaerts)).toBe(pickListCsv(rueckwaerts))
  })

  it('die Fehlmenge steht drin statt zu verschwinden', () => {
    // Frueher: eine Zeile "Depot › Case 1;5;Sony PMW-F55;3" — volle
    // Bedarfsmenge an einem Ort, an dem drei liegen, ohne jeden Hinweis.
    const bom = buildPlanBom(plan(5), [
      item({ id: 'i1', model: MODELL, quantity: 3, deviceTypeId: TYP, locationId: 'c1' }),
    ], NODES)
    expect(pickListCsv(bom).split('\r\n').slice(1)).toEqual([
      ';0;Sony PMW-F55;0;2',
      'Depot › Case 1;3;Sony PMW-F55;3;',
    ])
  })

  it('die Liste nennt nie mehr, als am Ort liegt', () => {
    const bom = buildPlanBom(plan(5), zweiOrte(3, 3), NODES)
    for (const zeile of pickListCsv(bom).split('\r\n').slice(1)) {
      const [, menge, , bestand] = zeile.split(';')
      expect(Number(menge)).toBeLessThanOrEqual(Number(bestand))
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Serialisierte Einheiten in Reparatur zaehlen nicht zum nutzbaren Bestand.
//
// Gemessen 2026-09-04 (Gegenrunde): `resolveCoverage` nahm `units` gar nicht
// entgegen. Vier Geraete im Bestand, zwei davon in Reparatur — die Liste sagte
// „gedeckt, Bestand 4" und schickte jemanden nach vier. Dass der Zustand
// Lager-Information ist, weiss `packList.ts` (traegt `condition` in die
// Packliste) und `inventoryReport.ts` (zaehlt nach Zustand). Nur die Liste,
// die INS LAGER GEHT, tat es nicht.
// ───────────────────────────────────────────────────────────────────────────

const unit = (id: string, itemId: string, condition: string) =>
  ({
    id,
    itemId,
    condition,
    history: [],
    createdAt: 't',
    updatedAt: 't',
  }) as unknown as import('../src/renderer/types/inventory').InventoryUnit

describe('nicht einsatzbereite Einheiten zaehlen nicht', () => {
  const vier = [item({ id: 'i1', model: MODELL, quantity: 4, deviceTypeId: TYP, locationId: 'c1' })]

  it('zwei in Reparatur machen aus vier zwei', () => {
    const res = resolveCoverage(plan(4), vier, [
      unit('u1', 'i1', 'inRepair'),
      unit('u2', 'i1', 'inRepair'),
      unit('u3', 'i1', 'ok'),
    ])
    expect(res.lines[0]).toMatchObject({ available: 2, short: 2 })
  })

  it('defekt und ausgemustert zaehlen genauso', () => {
    const res = resolveCoverage(plan(4), vier, [
      unit('u1', 'i1', 'defect'),
      unit('u2', 'i1', 'retired'),
    ])
    expect(res.lines[0]).toMatchObject({ available: 2 })
  })

  it('ok-Einheiten aendern nichts', () => {
    const res = resolveCoverage(plan(4), vier, [unit('u1', 'i1', 'ok'), unit('u2', 'i1', 'ok')])
    expect(res.lines[0]).toMatchObject({ available: 4 })
    expect(res.lines[0].short).toBeUndefined()
  })

  it('ohne Einheiten bleibt es beim alten Verhalten', () => {
    expect(resolveCoverage(plan(4), vier).lines[0]).toMatchObject({ available: 4 })
  })

  it('mehr Unbrauchbare als Bestand ergeben nicht weniger als null', () => {
    // Widerspruechlicher Datenstand; eine negative Menge in einer
    // Kommissionier-Liste waere schlimmer als eine zu kleine.
    const res = resolveCoverage(plan(1), [
      item({ id: 'i1', model: MODELL, quantity: 1, deviceTypeId: TYP, locationId: 'c1' }),
    ], [unit('u1', 'i1', 'defect'), unit('u2', 'i1', 'defect')])
    expect(res.lines[0].sources?.[0].available).toBe(0)
  })

  it('die Stueckliste NENNT die unbrauchbaren, statt sie still abzuziehen', () => {
    // Ein stiller Abzug sieht aus wie ein zu kleiner Bestand, und der naechste
    // Mensch sucht die fehlenden Stuecke im Regal statt in der Werkstatt.
    const bom = buildPlanBom(plan(4), vier, NODES, [
      unit('u1', 'i1', 'inRepair'),
      unit('u2', 'i1', 'inRepair'),
    ])
    expect(bom.rows[0]).toMatchObject({ available: 2, unusable: 2 })
  })

  it('die Kommissionier-Liste nennt nie mehr, als einsatzbereit ist', () => {
    const bom = buildPlanBom(plan(4), vier, NODES, [unit('u1', 'i1', 'inRepair')])
    for (const zeile of pickListCsv(bom).split('\r\n').slice(1)) {
      const [, menge, , bestand] = zeile.split(';')
      expect(Number(menge)).toBeLessThanOrEqual(Number(bestand))
    }
  })
})
