// #1190 — Kabelfuehrung im Raum: die Laenge kommt aus der gefuehrten Strecke,
// nicht aus der Luftlinie und nicht aus dem Weg auf dem Schaltbild.
import { describe, expect, it } from 'vitest'
import { fuehrungAusPunkt, punktAusFuehrung, streckenLaengeM, stuetzpunktEinfuegen } from '../src/renderer/lib/kabelFuehrung'
import { estimateAllCableLengths, estimateCableLength } from '../src/renderer/lib/cableLengthEstimate'
import { laengenKontext } from '../src/renderer/lib/laengenKontext'
import { cableRunFindings } from '../src/renderer/lib/cableRunChecks'
import { gebaeudeSzene } from '../src/renderer/lib/gebaeudeSzene'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Zwei Geraete, Mittelpunkte bei (50,50) und (550,50) px → 5 m auseinander
// bei 1 m / 100 px, beide auf Tischhoehe 0,8 m.
const geraet = (id: string, x: number): EquipmentItem =>
  ({ id, name: id, category: 'Video', inputs: [], outputs: [], x, y: 0, width: 100, height: 100 }) as EquipmentItem
const equipment = [geraet('a', 0), geraet('b', 500)]
const kabel = (over: Partial<Cable> = {}): Cable =>
  ({ id: 'k', name: 'k', type: 'SDI', color: '#f00', notes: '', fromEquipmentId: 'a', fromPortId: 'p', toEquipmentId: 'b', toPortId: 'q', ...over }) as Cable
const scheme = { metersPer100px: 1, slackPercent: 0, roundUp: false }

// Hoch an die Traverse auf 4 m, entlang, wieder hinunter: 3,2 + 5 + 3,2 m.
const traverse = [
  { x: 50, y: 50, hoeheM: 4 },
  { x: 550, y: 50, hoeheM: 4 },
]

describe('Streckenzug', () => {
  it('summiert die Abschnitte in 3D', () => {
    expect(streckenLaengeM([{ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }, { x: 3, y: 4, z: 2 }])).toBeCloseTo(7)
  })
  it('Stuetzpunkt und Szenenpunkt sind dieselbe Stelle im Massstab', () => {
    const p = { x: 120, y: 340, hoeheM: 2.5 }
    expect(punktAusFuehrung(p, 2)).toEqual({ x: 2.4, y: 2.5, z: 6.8 })
    expect(fuehrungAusPunkt(punktAusFuehrung(p, 2), 2)).toEqual(p)
  })
})

describe('stuetzpunktEinfuegen', () => {
  const von = { x: 0, y: 0, z: 0 }
  const nach = { x: 10, y: 0, z: 0 }
  it('setzt den Punkt in den Abschnitt, an dem er liegt — Klickreihenfolge egal', () => {
    let f = stuetzpunktEinfuegen([], von, nach, { x: 800, y: 0, hoeheM: 0 }, 1)
    f = stuetzpunktEinfuegen(f, von, nach, { x: 200, y: 0, hoeheM: 0 }, 1)
    f = stuetzpunktEinfuegen(f, von, nach, { x: 500, y: 0, hoeheM: 0 }, 1)
    expect(f.map((p) => p.x)).toEqual([200, 500, 800])
  })
})

describe('Laenge entlang der Fuehrung', () => {
  it('ohne Fuehrung bleibt es der Canvas-Weg', () => {
    const ctx = laengenKontext({ grundriss: undefined, intercom: undefined, equipment, cables: [kabel()] })
    expect(estimateCableLength(kabel(), new Map(equipment.map((e) => [e.id, e])), scheme, ctx)).toBeCloseTo(5)
  })

  it('mit Fuehrung zaehlt die gefuehrte Strecke mit Hoehen, nicht die Luftlinie', () => {
    const c = kabel({ fuehrung3d: traverse })
    const ctx = laengenKontext({ grundriss: undefined, intercom: undefined, equipment, cables: [c] })
    expect(estimateCableLength(c, new Map(equipment.map((e) => [e.id, e])), scheme, ctx)).toBeCloseTo(3.2 + 5 + 3.2)
  })

  it('der Zuschlag kommt obendrauf, aufgerundet fuer die Stueckliste', () => {
    const c = kabel({ fuehrung3d: traverse })
    const ctx = laengenKontext({ grundriss: undefined, intercom: undefined, equipment, cables: [c] })
    const { updates, origins } = estimateAllCableLengths([c], equipment, { metersPer100px: 1, slackPercent: 10, roundUp: true }, ctx)
    expect(updates.get('k')).toBe(13) // 11,4 m × 1,1 = 12,54 → 13
    expect(origins.get('k')!.fuehrung3d).toEqual(traverse)
  })

  it('eine geaenderte Fuehrung macht die geschaetzte Laenge ueberholt', () => {
    const c = kabel({ fuehrung3d: traverse })
    const ctx = laengenKontext({ grundriss: undefined, intercom: undefined, equipment, cables: [c] })
    const { updates, origins } = estimateAllCableLengths([c], equipment, { metersPer100px: 1, slackPercent: 0, roundUp: true }, ctx)
    const geschaetzt = { ...c, length: updates.get('k')!, lengthDerivedFrom: origins.get('k') }
    expect(cableRunFindings([geschaetzt], equipment, ctx).filter((f) => f.kind === 'derived-length-stale')).toEqual([])
    const tiefer = { ...geschaetzt, fuehrung3d: traverse.map((p) => ({ ...p, hoeheM: 6 })) }
    const ctx2 = laengenKontext({ grundriss: undefined, intercom: undefined, equipment, cables: [tiefer] })
    const befund = cableRunFindings([tiefer], equipment, ctx2).find((f) => f.kind === 'derived-length-stale')
    expect(befund?.values[1]).toBe('16') // 5,2 + 5 + 5,2
  })

  it('die 3D-Szene zeichnet denselben Weg und nennt beide Laengen', () => {
    const s = gebaeudeSzene(
      { equipment, cables: [kabel({ fuehrung3d: traverse, layer: 'video' } as Partial<Cable>)], locations: [], floors: [] },
      { metersPer100px: 1, geschosshoeheM: 4 },
    )
    const k = s.kabel[0]
    expect(k.gefuehrt).toBe(true)
    expect(k.punkte).toHaveLength(4)
    expect(k.laengeM).toBeCloseTo(11.4)
    expect(k.luftlinieM).toBeCloseTo(5)
  })
})
