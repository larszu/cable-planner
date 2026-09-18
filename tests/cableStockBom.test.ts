// ───────────────────────────────────────────────────────────────────────────
// #875 — die Stückelung in der Kabel-BOM.
//
// Die Rechnung selbst steht in `cableSplit.test.ts`. Diese Datei prüft die
// ANBINDUNG, und die hat zwei eigene Aussagen, die dort nicht vorkommen:
//
//   1. Ohne hinterlegte Lagerlängen wird NICHT gestückelt — und das Blatt
//      bekommt die Spalten gar nicht erst. Eine leere Spalte „Stückelung"
//      ist eine Frage an den Leser, auf die das Werkzeug die Antwort hat:
//      niemand hat gesagt, welche Trommeln es gibt.
//   2. Der Fehlbestand zählt die GANZE Zeile. Wer fünfmal denselben Lauf
//      zieht, braucht fünfmal die Stücke; eine Warnung, die nur einen Lauf
//      prüft, meldete Entwarnung für ein Lager, das beim zweiten leer ist.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { buildCableBomRows, cableBomTable } from '../src/renderer/lib/installerLists'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable, CableStockEntry } from '../src/renderer/types/cable'

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: `Cable ${id}`,
    type: 'BNC',
    length: 137,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: '',
    ...over,
  }) as Cable

const project = (cables: Cable[], cableStock?: CableStockEntry[]): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables,
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...(cableStock ? { cableStock } : {}),
  }) as CablePlannerProject

const bestand = (lengthM: number, count?: number): CableStockEntry => ({
  type: 'BNC',
  lengthM,
  ...(count === undefined ? {} : { count }),
})

describe('Stückelung in der BOM', () => {
  it('stückelt nicht, solange keine Lagerlängen hinterlegt sind', () => {
    const rows = buildCableBomRows(project([cable('c1')]))
    expect(rows[0]!.split).toBeUndefined()
    expect(cableBomTable(project([cable('c1')])).headers).not.toContain('Stückelung')
  })

  it('stückelt einen Lauf und zählt die Kupplungen', () => {
    const rows = buildCableBomRows(project([cable('c1')], [bestand(100), bestand(50), bestand(25)]))
    // 137 m aus [100, 50, 25]: 100+50 — eine Kupplung, nicht 100+25+25.
    expect(rows[0]!.split?.pieces).toEqual([
      { lengthM: 100, quantity: 1 },
      { lengthM: 50, quantity: 1 },
    ])
    expect(rows[0]!.split?.couplers).toBe(1)
  })

  it('zählt die Kupplungen der ganzen Zeile in die Tabelle', () => {
    const drei = [cable('c1'), cable('c2'), cable('c3')]
    const tabelle = cableBomTable(project(drei, [bestand(100), bestand(50)]))
    const zeile = tabelle.rows[0]!
    expect(tabelle.headers).toContain('Kupplungen')
    // Drei Läufe à eine Kupplung.
    expect(zeile[tabelle.headers.indexOf('Kupplungen')]).toBe(3)
    expect(zeile[tabelle.headers.indexOf('Stückelung')]).toBe('1 × 100 m + 1 × 50 m')
  })

  it('warnt, wenn der Bestand für die ganze Zeile nicht reicht', () => {
    const drei = [cable('c1'), cable('c2'), cable('c3')]
    const rows = buildCableBomRows(project(drei, [bestand(100, 2), bestand(50, 5)]))
    // Drei Läufe brauchen drei 100er, da sind zwei.
    expect(rows[0]!.shortfall).toEqual([{ lengthM: 100, needed: 3, available: 2 }])
  })

  it('schweigt, wenn der Bestand nicht gezählt ist — das ist nicht „null vorhanden"', () => {
    const drei = [cable('c1'), cable('c2'), cable('c3')]
    const rows = buildCableBomRows(project(drei, [bestand(100), bestand(50)]))
    expect(rows[0]!.shortfall).toBeUndefined()
  })

  it('nimmt nur die Längen DIESES Kabeltyps', () => {
    const rows = buildCableBomRows(
      project([cable('c1')], [{ type: 'XLR', lengthM: 100 }, { type: 'XLR', lengthM: 50 }]),
    )
    expect(rows[0]!.split).toBeUndefined()
  })

  it('rechnet für jeden Typ eigen, wenn beide Bestand haben', () => {
    const rows = buildCableBomRows(
      project([cable('c1'), cable('x1', { type: 'XLR', length: 30 })], [
        bestand(100),
        bestand(50),
        { type: 'XLR', lengthM: 20 },
        { type: 'XLR', lengthM: 10 },
      ]),
    )
    const bnc = rows.find((r) => r.type === 'BNC')!
    const xlr = rows.find((r) => r.type === 'XLR')!
    expect(bnc.split?.totalM).toBe(150)
    expect(xlr.split?.totalM).toBe(30)
    expect(xlr.split?.couplers).toBe(1)
  })
})
