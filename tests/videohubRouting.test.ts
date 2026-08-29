import { describe, it, expect } from 'vitest'
import {
  emptyVideohubRouting,
  normaliseCrosspoints,
  normaliseSalvo,
  normaliseVideohubRouting,
  mergeLegacySalvos,
  legacySalvoKey,
  danglingCrosspoints,
} from '../src/renderer/lib/videohubRouting'

describe('normaliseCrosspoints', () => {
  it('nimmt String-Keys, wie sie aus JSON kommen', () => {
    expect(normaliseCrosspoints({ '0': 3, '1': 0 })).toEqual({ 0: 3, 1: 0 })
  })

  it('wirft alles weg, was kein Paar nicht-negativer Ganzzahlen ist', () => {
    // Ein falscher Kreuzpunkt geht live auf Sendung — lieber verlieren als raten.
    expect(normaliseCrosspoints({ 0: 1.5, 1: -2, '-1': 0, x: 4, 2: null, 3: 7 })).toEqual({ 3: 7 })
  })

  it('behandelt Unsinn als leer statt zu werfen', () => {
    for (const bad of [null, undefined, 42, 'nope', [1, 2]]) {
      expect(normaliseCrosspoints(bad)).toEqual({})
    }
  })
})

describe('normaliseSalvo', () => {
  it('wandelt den alten Zahl-Zeitstempel in ISO', () => {
    const s = normaliseSalvo({ id: 'a', name: 'Teil 1', routing: { 0: 2 }, createdAt: 0 }, 'fb')
    expect(s?.createdAt).toBe(new Date(0).toISOString())
    expect(s?.routing).toEqual({ 0: 2 })
  })

  it('vergibt eine Ersatz-Id, wenn keine da ist', () => {
    expect(normaliseSalvo({ name: 'X' }, 'fallback-7')?.id).toBe('fallback-7')
  })

  it('verwirft Salvos ohne Namen — ein namenloser Snapshot ist nicht aufrufbar', () => {
    expect(normaliseSalvo({ name: '   ', routing: { 0: 1 } }, 'fb')).toBeNull()
    expect(normaliseSalvo({ routing: { 0: 1 } }, 'fb')).toBeNull()
  })
})

describe('normaliseVideohubRouting', () => {
  it('liefert fuer fehlende Daten einen gueltigen leeren Block', () => {
    expect(normaliseVideohubRouting(undefined)).toEqual(emptyVideohubRouting())
  })

  it('filtert kaputte Salvos heraus, behaelt die guten', () => {
    const r = normaliseVideohubRouting({
      planned: { 0: 1 },
      salvos: [{ name: 'gut', routing: { 1: 2 } }, { name: '' }, null, 5],
    })
    expect(r.planned).toEqual({ 0: 1 })
    expect(r.salvos).toHaveLength(1)
    expect(r.salvos[0].name).toBe('gut')
  })
})

describe('mergeLegacySalvos', () => {
  it('uebernimmt Salvos aus dem alten localStorage-Format', () => {
    const { routing, imported } = mergeLegacySalvos(emptyVideohubRouting(), [
      { id: 'l1', name: 'Vorband', routing: { 0: 1 }, createdAt: 1700000000000 },
    ])
    expect(imported).toBe(1)
    expect(routing.salvos[0].name).toBe('Vorband')
    expect(routing.salvos[0].createdAt).toBe(new Date(1700000000000).toISOString())
  })

  it('laesst dem Projekt den Vortritt und meldet, was wirklich kam', () => {
    const current = { planned: {}, salvos: [{ id: 'p', name: 'Vorband', routing: { 9: 9 }, createdAt: 'x' }] }
    const { routing, imported } = mergeLegacySalvos(current, [
      { name: 'Vorband', routing: { 0: 0 } },
      { name: 'Hauptact', routing: { 0: 1 } },
    ])
    expect(imported).toBe(1)
    expect(routing.salvos.find((s) => s.name === 'Vorband')?.routing).toEqual({ 9: 9 })
    expect(routing.salvos.map((s) => s.name)).toEqual(['Vorband', 'Hauptact'])
  })

  it('ist ein no-op ohne Altdaten und meldet das ehrlich', () => {
    const cur = emptyVideohubRouting()
    expect(mergeLegacySalvos(cur, null)).toEqual({ routing: cur, imported: 0 })
    expect(mergeLegacySalvos(cur, []).imported).toBe(0)
  })
})

describe('legacySalvoKey', () => {
  it('trifft den Schluessel, unter dem vor ADR-001 gespeichert wurde', () => {
    expect(legacySalvoKey('dev-1')).toBe('cable-planner.videohub.salvos.dev-1')
    expect(legacySalvoKey('')).toBe('cable-planner.videohub.salvos._')
  })
})

describe('danglingCrosspoints', () => {
  it('findet Routen, die ins Leere zeigen, wenn das Geraet schrumpft', () => {
    const d = danglingCrosspoints({ 0: 1, 5: 0, 1: 9 }, 4, 4)
    expect(d).toEqual([{ output: 1, input: 9 }, { output: 5, input: 0 }])
  })

  it('meldet nichts bei sauberem Routing', () => {
    expect(danglingCrosspoints({ 0: 1, 1: 0 }, 2, 2)).toEqual([])
  })
})
