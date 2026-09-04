// ───────────────────────────────────────────────────────────────────────────
// Ein Rack mit zwoelf Geraeten war eine Zeile mit Menge 1.
//
// Gemessen 2026-09-04 (Gegenrunde): `groupPresetSpawnSlice` legt fuer ein
// eingefuegtes Black-Box-Rack GENAU EIN EquipmentItem an (Kategorie „Rack",
// ohne deviceTypeId); die enthaltenen Geraete leben nur im
// `rackInternalSnapshot`. `deriveDemand` las ausschliesslich `equipment` —
// „rack" und „rackInternalSnapshot" kamen in planBom.ts und
// inventoryCoverage.ts kein einziges Mal vor.
//
// Ein 12-Geraete-Rack erschien damit als „1x FOH Rack (Rack) — nicht im
// Lager", ohne jeden Hinweis, dass zwoelf Positionen darunter verschwinden.
// Stiller Unterlauf des Bedarfs, in genau der Liste, mit der jemand ins Lager
// geht.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { deriveDemand } from '../src/renderer/lib/inventoryCoverage'
import { buildPlanBom } from '../src/renderer/lib/planBom'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, StorageNode } from '../src/renderer/types/inventory'

const eq = (over: Partial<EquipmentItem>): EquipmentItem =>
  ({
    id: 'e1',
    name: 'Gerät',
    category: 'Sonstiges',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 160,
    ...over,
  }) as EquipmentItem

const inhalt = (name: string, startUnit: number) => ({ name, startUnit, rackUnits: 1 })

const rack = (name: string, namen: string[]): EquipmentItem =>
  eq({
    id: `rack-${name}`,
    name,
    category: 'Rack',
    rackInternalSnapshot: {
      items: namen.map((n, i) => inhalt(n, i + 1)),
      cables: [],
      totalUnits: namen.length,
    },
  })

const item = (over: Partial<InventoryItem>): InventoryItem =>
  ({ id: 'i1', model: 'Modell', quantity: 1, createdAt: 't', updatedAt: 't', ...over }) as InventoryItem

const NODES: StorageNode[] = [
  { id: 'depot', name: 'Depot', kind: 'depot', createdAt: 't', updatedAt: 't' } as StorageNode,
]

describe('das Innenleben eines Racks zaehlt mit', () => {
  it('drei Geraete im Rack ergeben drei zusaetzliche Bedarfszeilen', () => {
    const d = deriveDemand([rack('FOH Rack', ['Yamaha CL5', 'Shure UR4D', 'Yamaha CL5'])])
    const labels = d.map((x) => `${x.label}=${x.quantity}`).sort()
    expect(labels).toEqual(['FOH Rack=1', 'Shure UR4D=1', 'Yamaha CL5=2'])
  })

  it('das Rack selbst bleibt eine eigene Zeile — es ist auch ein Ding', () => {
    const d = deriveDemand([rack('FOH Rack', ['Yamaha CL5'])])
    expect(d.find((x) => x.label === 'FOH Rack')?.quantity).toBe(1)
  })

  it('gleiche Geraete in zwei Racks werden zusammengezaehlt', () => {
    const d = deriveDemand([rack('Rack A', ['Yamaha CL5']), rack('Rack B', ['Yamaha CL5'])])
    const zeile = d.find((x) => x.label === 'Yamaha CL5')
    expect(zeile?.quantity).toBe(2)
    expect(zeile?.fromRacks).toEqual(['Rack A', 'Rack B'])
  })

  it('ein frei stehendes Geraet und ein gleichnamiges im Rack zaehlen zusammen', () => {
    const d = deriveDemand([
      eq({ id: 'frei', name: 'Yamaha CL5' }),
      rack('Rack A', ['Yamaha CL5']),
    ])
    expect(d.find((x) => x.label === 'Yamaha CL5')?.quantity).toBe(2)
  })

  it('leere Namen im Snapshot werden uebersprungen', () => {
    const d = deriveDemand([rack('Rack A', ['', '  ', 'Yamaha CL5'])])
    expect(d.map((x) => x.label).sort()).toEqual(['Rack A', 'Yamaha CL5'])
  })

  it('ein Geraet ohne Snapshot verhaelt sich unveraendert', () => {
    const d = deriveDemand([eq({ id: 'a', name: 'Kamera 1' })])
    expect(d).toHaveLength(1)
    expect(d[0].fromRacks).toBeUndefined()
  })

  it('die Stueckliste sagt, dass die Zeile aus einem Rack kommt', () => {
    // Ohne diesen Hinweis sieht die Position aus wie ein frei stehendes
    // Geraet — und wer sie im Regal sucht, findet sie nicht, weil sie im Rack
    // schon verbaut ist.
    const bom = buildPlanBom(
      [rack('FOH Rack', ['Yamaha CL5'])],
      [item({ id: 'i1', model: 'Yamaha CL5', quantity: 1 })],
      NODES,
    )
    const zeile = bom.rows.find((r) => r.model === 'Yamaha CL5')
    expect(zeile?.reason).toContain('FOH Rack')
  })

  it('Rack-Inhalte sind Vorschlaege, keine Tatsachen', () => {
    // Der Snapshot traegt nur einen Namen, keine Katalog-Guid. Alles andere
    // waere eine Zusage, die die Daten nicht hergeben.
    const bom = buildPlanBom(
      [rack('FOH Rack', ['Yamaha CL5'])],
      [item({ id: 'i1', model: 'Yamaha CL5', quantity: 1 })],
      NODES,
    )
    expect(bom.rows.find((r) => r.model === 'Yamaha CL5')?.outcome).toBe('proposed-by-name')
  })
})

describe('das Ergebnis haengt am Plan, nicht an der Array-Reihenfolge', () => {
  it('Rack zuerst oder Geraet zuerst ergibt dasselbe', () => {
    const frei = eq({ id: 'frei', name: 'Yamaha CL5' })
    const r = rack('Rack A', ['Yamaha CL5'])
    const a = deriveDemand([frei, r]).map((x) => `${x.label}=${x.quantity}`)
    const b = deriveDemand([r, frei]).map((x) => `${x.label}=${x.quantity}`)
    expect(a).toEqual(b)
  })
})
