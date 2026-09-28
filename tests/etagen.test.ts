// #911 — Etagen als Liste statt Freitext.
import { describe, expect, it } from 'vitest'
import { etageVon, etagenIndex, heileEtagen, rahmenAufEtage } from '../src/renderer/lib/etagen'

describe('heileEtagen', () => {
  it('macht aus Freitext-Etagen alter Rahmen eine Liste, in Reihenfolge des Auftretens', () => {
    expect(heileEtagen(undefined, [{ floor: 'EG' }, { floor: '1.OG' }, { floor: ' eg ' }, {}])).toEqual([
      { name: 'EG' },
      { name: '1.OG' },
    ])
  })

  it('behaelt Reihenfolge und Hoehe der Liste und haengt nur Fehlendes an', () => {
    const liste = [{ name: 'UG', elevationM: -3.5 }, { name: 'EG', elevationM: 0 }]
    expect(heileEtagen(liste, [{ floor: '3.OG' }, { floor: 'eg' }])).toEqual([
      { name: 'UG', elevationM: -3.5 },
      { name: 'EG', elevationM: 0 },
      { name: '3.OG' },
    ])
  })

  it('wirft Ungueltiges und Doppeltes weg, erfindet keine Hoehe', () => {
    expect(heileEtagen([null, { name: '' }, { name: 'A', elevationM: 'hoch' }, { name: 'a' }], [])).toEqual([{ name: 'A' }])
  })

  it('ist idempotent', () => {
    const einmal = heileEtagen([{ name: 'EG' }], [{ floor: '2.OG' }])
    expect(heileEtagen(einmal, [{ floor: '2.OG' }])).toEqual(einmal)
  })
})

describe('Zuordnung', () => {
  const floors = [{ name: 'EG', elevationM: 0 }, { name: '3.OG', elevationM: 10.5 }]
  it('findet die Etage eines Rahmens ohne Ruecksicht auf Schreibweise', () => {
    expect(etageVon({ floor: '3.og' }, floors)).toEqual({ name: '3.OG', elevationM: 10.5 })
    expect(etageVon({}, floors)).toBeUndefined()
    // Nicht in der Liste: der Name gilt trotzdem, nur ohne Hoehe.
    expect(etageVon({ floor: 'Dach' }, floors)).toEqual({ name: 'Dach' })
  })
  it('Index und Rahmenzahl', () => {
    expect(etagenIndex('3.OG', floors)).toBe(1)
    expect(etagenIndex('Dach', floors)).toBe(-1)
    expect(rahmenAufEtage('eg', [{ floor: 'EG' }, { floor: 'EG ' }, { floor: '3.OG' }])).toBe(2)
  })
})
