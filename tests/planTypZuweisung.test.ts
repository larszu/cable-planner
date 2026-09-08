import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { deriveDemand } from '../src/renderer/lager/lib/inventoryCoverage'
import { buildPlanBom } from '../src/renderer/lager/lib/planBom'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, StorageNode } from '../src/renderer/lager/types/inventory'
import type { ZusatzBedarf } from '../src/renderer/lib/planDemandExtras'

// ───────────────────────────────────────────────────────────────────────────
// ADR-002, „Was offen bleibt" — die PLAN-Haelfte des Auswegs.
//
// Der Ausweg aus `proposed-by-name` hatte bisher nur eine Haelfte: Ein
// Vorschlag liess sich auf der LAGER-Position bestaetigen (`useTypBestaetigen`,
// Knopf „Bestaetigen"). Die andere Haelfte — einem PLAN-Geraet den Katalog-Typ
// geben — stand nur im Eigenschaften-Panel, Geraet fuer Geraet. Wer die
// Stueckliste las und dort „(ohne Katalog-Typ)" sah, musste das Geraet auf dem
// Canvas suchen und einzeln zuweisen; bei drei gleichen Kameras dreimal.
//
// Die Zeile weiss, welche Geraete sie ausmachen. Was ihr fehlte, war der Weg
// von der Zeile zu diesen Ids — und zwar zu DEN RICHTIGEN: `equipmentIds`
// enthaelt bei einem Rack-Innenleben die Id des RACKS, nicht die des Geraets
// darin. Deshalb `typeTargetIds`, und deshalb diese Datei.
// ───────────────────────────────────────────────────────────────────────────

/** Echte Katalog-Eintraege, damit die Registry den Modellnamen liefert. */
const F55_ID = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
const F55_MODEL = 'Sony PMW-F55'

const eq = (over: Partial<EquipmentItem>): EquipmentItem =>
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
  }) as EquipmentItem

const rack = (name: string, namen: string[]): EquipmentItem =>
  eq({
    id: `rack-${name}`,
    name,
    category: 'Rack',
    rackInternalSnapshot: {
      items: namen.map((n, i) => ({ name: n, startUnit: i + 1, rackUnits: 1 })),
      cables: [],
      totalUnits: namen.length,
    },
  })

const item = (over: Partial<InventoryItem>): InventoryItem =>
  ({ id: 'i1', model: 'Modell', quantity: 1, createdAt: 't', updatedAt: 't', ...over }) as InventoryItem

const NODES: StorageNode[] = [
  { id: 'depot', name: 'Depot', kind: 'depot', createdAt: 't', updatedAt: 't' } as StorageNode,
]

describe('typeTargetIds — wem die Zeile einen Katalog-Typ geben darf', () => {
  it('nennt das Canvas-Geraet, das die Zeile ausmacht', () => {
    const d = deriveDemand([eq({ id: 'a', name: 'Kamera links' })])
    expect(d).toHaveLength(1)
    expect(d[0].typeTargetIds).toEqual(['a'])
  })

  it('nennt ALLE Geraete der Zeile, nicht nur das erste', () => {
    // Der Bedarf ist der Typ, gezaehlt. Wer nur das erste Geraet zuwiese,
    // zerlegte die Zeile beim naechsten Abgleich in eine Tatsache und zwei
    // Vermutungen — genau die Aufspaltung, gegen die der Resolver drei
    // Ausgaenge hat.
    const d = deriveDemand([
      eq({ id: 'a', name: 'URSA' }),
      eq({ id: 'b', name: 'URSA' }),
      eq({ id: 'c', name: 'URSA' }),
    ])
    expect(d).toHaveLength(1)
    expect(d[0].quantity).toBe(3)
    expect(d[0].typeTargetIds).toEqual(['a', 'b', 'c'])
  })

  it('bleibt beim Rack-Innenleben LEER — dort gibt es kein Geraet zum Zuweisen', () => {
    // DIE Zeile, an der ein Griff nach `equipmentIds` auffliegt: Dort steht
    // die Id des Racks. Wer daraus zuwiese, schriebe dem Rack den Typ des
    // Geraets in seinem Bauch — die Behauptung, das FOH-Rack SEI eine CL5.
    const d = deriveDemand([rack('FOH Rack', ['Yamaha CL5'])])
    const cl5 = d.find((x) => x.label === 'Yamaha CL5')
    expect(cl5).toBeDefined()
    expect(cl5!.equipmentIds).toEqual(['rack-FOH Rack'])
    expect(cl5!.typeTargetIds).toEqual([])
  })

  it('bleibt bei Zusatz-Bedarfen LEER — Drum-Kit und Funkstrecke sind keine EquipmentItems', () => {
    const zusatz: ZusatzBedarf[] = [
      { label: 'Mikrofonstativ kurz', quantity: 4, herkunft: 'Drum-Mikrofonierung' },
    ]
    const d = deriveDemand([], zusatz)
    const stativ = d.find((x) => x.label === 'Mikrofonstativ kurz')
    expect(stativ).toBeDefined()
    expect(stativ!.typeTargetIds).toEqual([])
  })

  it('mischt nicht: eine Zeile aus Canvas-Geraet UND Rack-Inhalt nennt nur das Canvas-Geraet', () => {
    // Dieselbe CL5 liegt einmal auf dem Canvas und steckt einmal im Rack.
    // Der Bedarf ist 2 — aber zuweisen laesst sich nur dem einen, das es im
    // Plan wirklich als Geraet gibt.
    const d = deriveDemand([
      eq({ id: 'pult', name: 'Yamaha CL5', category: '' }),
      rack('FOH Rack', ['Yamaha CL5']),
    ])
    const cl5 = d.find((x) => x.label === 'Yamaha CL5')
    expect(cl5).toBeDefined()
    expect(cl5!.quantity).toBe(2)
    expect(cl5!.typeTargetIds).toEqual(['pult'])
  })

  it('ist auch bei einer Zeile gesetzt, die den Typ schon hat', () => {
    // Damit ein spaeteres Umsetzen (falscher Typ zugewiesen) moeglich bleibt.
    const d = deriveDemand([eq({ id: 'a', name: 'Kamera 1', deviceTypeId: F55_ID })])
    expect(d[0].label).toBe(F55_MODEL)
    expect(d[0].typeTargetIds).toEqual(['a'])
  })
})

describe('die Stueckliste traegt die Ids bis in die Zeile', () => {
  it('gibt sie an PlanBomRow weiter', () => {
    const bom = buildPlanBom([eq({ id: 'a', name: 'Kamera links' })], [], NODES)
    expect(bom.rows).toHaveLength(1)
    expect(bom.rows[0].modelIsDeviceName).toBe(true)
    expect(bom.rows[0].typeTargetIds).toEqual(['a'])
  })

  it('liefert fuer Rack-Inhalt eine Zeile OHNE Ziel', () => {
    const bom = buildPlanBom([rack('FOH Rack', ['Yamaha CL5'])], [], NODES)
    const cl5 = bom.rows.find((r) => r.model === 'Yamaha CL5')
    expect(cl5).toBeDefined()
    expect(cl5!.typeTargetIds).toEqual([])
  })

  it('macht aus einem Fehlbestand eine Deckung, sobald der Typ steht', () => {
    // Der ganze Zweck der Zuweisung, an der Deckung gemessen. Und der Fall
    // ist haerter, als er klingt: Der Namensvergleich greift NUR, wenn die
    // LAGER-Position selbst keine Typ-Identitaet traegt. Ein sauber gepflegtes
    // Lager (Position mit GUID) und ein Plan-Geraet ohne Typ ergeben deshalb
    // nicht einmal einen Vorschlag, sondern „nicht im Lager" — die Kamera
    // steht im Regal und fehlt auf der Liste. Genau diese Zeile loest die
    // Zuweisung auf.
    const lager = [item({ id: 'i1', model: F55_MODEL, quantity: 2, deviceTypeId: F55_ID })]

    const vorher = buildPlanBom(
      [eq({ id: 'a', name: F55_MODEL }), eq({ id: 'b', name: F55_MODEL })],
      lager,
      NODES,
    )
    expect(vorher.rows[0].outcome).toBe('unmatched')
    expect(vorher.rows[0].typeTargetIds).toEqual(['a', 'b'])

    // Genau das, was der Griff in der Tabelle tut: `deviceTypeId` auf ALLE
    // Ids der Zeile schreiben.
    const nachher = buildPlanBom(
      vorher.rows[0].typeTargetIds.map((id) => eq({ id, name: F55_MODEL, deviceTypeId: F55_ID })),
      lager,
      NODES,
    )
    expect(nachher.rows).toHaveLength(1)
    expect(nachher.rows[0].outcome).toBe('matched-by-type')
    expect(nachher.rows[0].modelIsDeviceName).toBe(false)
  })

  it('bliebe halb offen, wenn nur das erste Geraet den Typ bekaeme', () => {
    // Die Gegenprobe zur vorigen Zeile: Zwei Geraete, nur eines zugewiesen —
    // aus einer Zeile werden zwei, und eine davon meldet weiterhin einen
    // Fehlbestand fuer Technik, die im Regal steht. Das ist der Zustand, den
    // die Zuweisung ueber ALLE Ids verhindert.
    const lager = [item({ id: 'i1', model: F55_MODEL, quantity: 2, deviceTypeId: F55_ID })]
    const halb = buildPlanBom(
      [eq({ id: 'a', name: F55_MODEL, deviceTypeId: F55_ID }), eq({ id: 'b', name: F55_MODEL })],
      lager,
      NODES,
    )
    expect(halb.rows).toHaveLength(2)
    expect(halb.rows.map((r) => r.outcome).sort()).toEqual(['matched-by-type', 'unmatched'])
  })

  it('deckt den Vorschlags-Fall mit ab: ungetypte Lager-Position, ungetypter Plan', () => {
    // Traegt die Lager-Position keine Identitaet, greift der Namensvergleich —
    // und die Zeile ist ein VORSCHLAG. Auch hier ist die Zuweisung im Plan der
    // halbe Weg; den Rest macht „Bestaetigen" auf der Lager-Position.
    const lager = [item({ id: 'i1', model: F55_MODEL, quantity: 2 })]
    const bom = buildPlanBom([eq({ id: 'a', name: F55_MODEL })], lager, NODES)
    expect(bom.rows[0].outcome).toBe('proposed-by-name')
    expect(bom.rows[0].typeTargetIds).toEqual(['a'])
  })
})

describe('die Tabelle bietet den Griff an — und nur, wo er trifft', () => {
  const src = readFileSync('src/renderer/components/Export/ExportDialog.tsx', 'utf8')

  it('zeigt das Auswahlfeld nur bei einer Zeile ohne Typ UND mit Ziel', () => {
    // Ohne die zweite Bedingung stuende bei jedem Rack-Innenleben ein
    // Auswahlfeld, das ins Leere schreibt.
    expect(src).toMatch(/row\.modelIsDeviceName && row\.typeTargetIds\.length > 0/)
  })

  it('schreibt an ALLE Ids der Zeile, nicht an eine', () => {
    const aufruf = src.match(/typZuweisen\(([^)]*)\)/)
    expect(aufruf).not.toBeNull()
    expect(aufruf![1]).toContain('row.typeTargetIds')
    expect(aufruf![1]).not.toMatch(/typeTargetIds\[\d\]/)
  })

  it('schreibt in den PLAN, nicht ins Lager', () => {
    // `typBestaetigen` schreibt auf die Lager-Position; das hier ist die
    // andere Haelfte und muss ueber `updateEquipment` gehen, sonst behauptet
    // die Zeile eine Deckung, die im Plan nicht steht.
    const koerper = src.slice(src.indexOf('const typZuweisen'))
    const ende = koerper.indexOf('\n  }')
    expect(koerper.slice(0, ende)).toMatch(/updateEquipment\([^)]*\{ deviceTypeId \}\)/)
  })

  it('nimmt die Auswahl aus dem Katalog, nicht aus einer eigenen Liste', () => {
    expect(src).toMatch(/listDeviceTypes\(\)/)
  })
})
