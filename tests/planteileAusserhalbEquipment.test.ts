// ───────────────────────────────────────────────────────────────────────────
// Bedarf, der nicht in `project.equipment` steht.
//
// Gemessen 2026-09-04 (Gegenrunde): `project.drumKit` und
// `project.wirelessRig` sind eigene Projektfelder und tauchten in KEINER
// Stueckliste auf. Der Funkstrecken-Plan plant Sender-Bodies und Kapseln mit
// echter Katalog-GUID; die Drum-Mikrofonierung hat stattdessen ihre EIGENE,
// zweite Materialliste (`deriveDrumBom`), die nur in die Zwischenablage geht.
//
// Der Unterschied zum Rack-Fall: hier gibt es GUIDs, die Zeilen sind also
// TATSACHEN. Nur das Zubehoer aus `deriveDrumBom` (Stative, Clamps, XLR) hat
// keine — und genau das darf nicht wegfallen, sonst ist es derselbe stille
// Unterlauf eine Ebene tiefer.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { zusatzBedarf } from '../src/renderer/lib/planDemandExtras'
import { deriveDemand } from '../src/renderer/lib/inventoryCoverage'
import { buildPlanBom } from '../src/renderer/lib/planBom'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, StorageNode } from '../src/renderer/types/inventory'
import type { DrumKitPlan } from '../src/renderer/types/drumKit'
import type { WirelessRigPlan } from '../src/renderer/types/wirelessRig'

const SM57 = '8a940e24-1c9c-4571-a820-50cd7ce55ed1'
const SM58 = '4e75a4d0-7490-431f-8230-fef93fa265ef'
const FUNK_BODY = '17582c72-e61e-41c4-8264-53254efee398'

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

const item = (over: Partial<InventoryItem>): InventoryItem =>
  ({ id: 'i1', model: 'Modell', quantity: 1, createdAt: 't', updatedAt: 't', ...over }) as InventoryItem

const NODES: StorageNode[] = [
  { id: 'depot', name: 'Depot', kind: 'depot', createdAt: 't', updatedAt: 't' } as StorageNode,
]

const drumKit = (micIds: (string | undefined)[]): DrumKitPlan =>
  ({
    zones: [{ id: 'z1', kind: 'snare', label: 'Snare', x: 0, y: 0 }],
    mics: micIds.map((id, i) => ({
      id: `m${i}`,
      zoneId: 'z1',
      ...(id ? { micDeviceTypeId: id } : { micName: 'Unbenanntes Mic' }),
    })),
  }) as unknown as DrumKitPlan

const rig = (n: number): WirelessRigPlan => ({
  channels: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    label: `Kanal ${i + 1}`,
    bodyDeviceTypeId: FUNK_BODY,
  })),
})

describe('der Funkstrecken-Plan zaehlt', () => {
  it('drei Kanaele ergeben drei Sender-Bodies', () => {
    const z = zusatzBedarf({ wirelessRig: rig(3) })
    const body = z.find((x) => x.deviceTypeId === FUNK_BODY)
    expect(body?.quantity).toBe(3)
    expect(body?.herkunft).toBe('Funkstrecken-Plan')
  })

  it('die Zeile traegt die Katalog-Guid — sie ist eine Tatsache', () => {
    const bom = buildPlanBom([], [], NODES, [], zusatzBedarf({ wirelessRig: rig(1) }))
    expect(bom.rows[0]?.deviceTypeId).toBe(FUNK_BODY)
  })
})

describe('die Drum-Mikrofonierung zaehlt — samt Zubehoer', () => {
  const kit = drumKit([SM57, SM57, SM58])

  it('gleiche Mikrofone werden zusammengezaehlt', () => {
    const z = zusatzBedarf({ drumKit: kit })
    expect(z.find((x) => x.deviceTypeId === SM57)?.quantity).toBe(2)
    expect(z.find((x) => x.deviceTypeId === SM58)?.quantity).toBe(1)
  })

  it('Stative, Clamps und XLR fallen NICHT weg', () => {
    // Wer sechs Mikrofone kommissioniert und keine Stative, steht am
    // Aufbautag genauso da wie ohne die Mikrofone.
    const labels = zusatzBedarf({ drumKit: kit }).map((x) => x.label)
    expect(labels).toContain('XLR-Kabel (Mic → Stagebox)')
    expect(labels.some((l) => l.includes('Clamp') || l.includes('stativ'))).toBe(true)
  })

  it('das Zubehoer wird nicht doppelt gezaehlt', () => {
    // `deriveDrumBom` liefert die Mic-Zeilen ebenfalls; sie stehen oben schon.
    const z = zusatzBedarf({ drumKit: kit })
    const sm57 = z.filter((x) => x.label === 'Shure SM57')
    expect(sm57).toHaveLength(1)
    expect(sm57[0].quantity).toBe(2)
  })

  it('ein Mic ohne Katalog-Zuordnung geht ueber den Namen mit', () => {
    const z = zusatzBedarf({ drumKit: drumKit([undefined]) })
    const offen = z.find((x) => x.label === 'Unbenanntes Mic')
    expect(offen).toBeDefined()
    expect(offen?.deviceTypeId).toBeUndefined()
  })
})

describe('die Zusammenfuehrung mit dem Canvas', () => {
  it('ein Mikrofon auf dem Canvas und im Drum-Set ergibt EINE Zeile', () => {
    const d = deriveDemand(
      [eq({ id: 'a', deviceTypeId: SM57, name: 'Shure SM57' })],
      zusatzBedarf({ drumKit: drumKit([SM57]) }),
    )
    const zeile = d.filter((x) => x.deviceTypeId === SM57)
    expect(zeile).toHaveLength(1)
    expect(zeile[0].quantity).toBe(2)
    expect(zeile[0].fromPlanParts).toEqual(['Drum-Mikrofonierung'])
  })

  it('ohne Planteile bleibt alles wie vorher', () => {
    const d = deriveDemand([eq({ id: 'a', name: 'Kamera 1' })])
    expect(d).toHaveLength(1)
    expect(d[0].fromPlanParts).toBeUndefined()
  })

  it('die Stueckliste sagt, woher die Zeile stammt', () => {
    const bom = buildPlanBom(
      [],
      [item({ id: 'i1', model: 'Shure SM57', quantity: 5, deviceTypeId: SM57 })],
      NODES,
      [],
      zusatzBedarf({ drumKit: drumKit([SM57]) }),
    )
    expect(bom.rows.find((r) => r.deviceTypeId === SM57)?.reason).toContain(
      'Drum-Mikrofonierung',
    )
  })

  it('das Ergebnis haengt nicht an der Reihenfolge der Kanaele', () => {
    const a = zusatzBedarf({ wirelessRig: rig(2), drumKit: drumKit([SM57, SM58]) })
    const b = zusatzBedarf({ drumKit: drumKit([SM58, SM57]), wirelessRig: rig(2) })
    expect(a).toEqual(b)
  })
})

describe('die beiden Zaehlungen der Drum-Mics widersprechen sich nicht', () => {
  // `zusatzBedarf` zaehlt die Mikrofone selbst (es braucht die Katalog-GUIDs,
  // die `deriveDrumBom` nicht fuehrt) und nimmt von dort nur das Zubehoer.
  // Damit gibt es zwei Rechnungen ueber dieselbe Menge — genau die Lage, aus
  // der in dieser Sitzung mehrfach ein Fehler geworden ist. Der Guard haelt
  // fest, dass sie uebereinstimmen.
  it('so viele Mic-Stueck wie Mics im Plan', () => {
    for (const ids of [
      [SM57],
      [SM57, SM57, SM58],
      [SM57, undefined, SM58, undefined],
      [],
    ]) {
      const plan = drumKit(ids)
      const z = zusatzBedarf({ drumKit: plan })
      // Alles ausser dem benannten Zubehoer sind Mikrofone.
      const zubehoer = new Set(['XLR-Kabel (Mic → Stagebox)', 'Mikrofonstativ', 'Kessel-Clamp / Rim-Halter'])
      const mics = z.filter((x) => !zubehoer.has(x.label)).reduce((n, x) => n + x.quantity, 0)
      expect(mics, `bei ${ids.length} Mics`).toBe(plan.mics.length)
    }
  })

  it('so viele XLR wie Mics', () => {
    const plan = drumKit([SM57, SM58, SM57])
    const xlr = zusatzBedarf({ drumKit: plan }).find(
      (x) => x.label === 'XLR-Kabel (Mic → Stagebox)',
    )
    expect(xlr?.quantity).toBe(plan.mics.length)
  })
})
