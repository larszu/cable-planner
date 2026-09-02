import { describe, expect, it } from 'vitest'
import { normaliseSourceIdentities } from '../src/renderer/lib/sourceIdentity'
import { hasDrops } from '../src/renderer/types/loadReport'
import type { LoadDrop } from '../src/renderer/types/loadReport'

// ADR-005, Regel 3 — „Wer nicht bewahren kann, sagt es an der Stelle, an der es
// passiert."
//
// Auf dem Lade-Pfad war das strukturell unmoeglich: healProjectPositions ist
// eine reine Funktion ohne Weg zur Oberflaeche, also verschwand alles, was sie
// verwarf, definitionsgemaess still. Aufgefallen an den Rollen aus ADR-001:
// eine Rolle ohne Namen wurde wortlos entfernt, und clearDanglingIdentity
// strich danach die Verweise der Geraete darauf — eine Kamera verlor ihre
// TSL-Adresse, ohne dass irgendwo etwas stand.

const collect = (raw: unknown) => {
  const drops: LoadDrop[] = []
  const kept = normaliseSourceIdentities(raw, (d) => drops.push(d))
  return { kept, drops }
}

describe('normaliseSourceIdentities — meldet, was sie verwirft (ADR-005)', () => {
  it('meldet eine Rolle ohne Namen mit ihrer Id als Griff', () => {
    const { kept, drops } = collect([{ id: 'cam-4' }])
    expect(kept).toEqual([])
    expect(drops).toEqual([{ kind: 'source-identity', reason: 'missing-required', label: 'cam-4' }])
  })

  it('meldet eine doppelte Id und behaelt den ersten Eintrag', () => {
    const { kept, drops } = collect([
      { id: 'a', name: 'Kamera 1', umdAddress: 4 },
      { id: 'a', name: 'Kamera 1 (Kopie)', umdAddress: 9 },
    ])
    expect(kept).toHaveLength(1)
    expect(kept[0].umdAddress).toBe(4)
    expect(drops).toEqual([
      { kind: 'source-identity', reason: 'duplicate-id', label: 'Kamera 1 (Kopie)' },
    ])
  })

  it('meldet nichts, wenn alles mitkommt', () => {
    const { kept, drops } = collect([
      { id: 'a', name: 'Kamera 1' },
      { id: 'b', name: 'Kamera 2' },
    ])
    expect(kept).toHaveLength(2)
    expect(drops).toEqual([])
  })

  it('kommt ohne Griff aus, statt den Verlust zu verschweigen', () => {
    // Ein Rohsatz ohne name UND ohne id gibt keinen Griff her. Der Bericht
    // sagt trotzdem, dass es ihn gab — das ist der Punkt der Regel.
    const { drops } = collect([{ umdAddress: 7 }])
    expect(drops).toHaveLength(1)
    expect(drops[0].label).toBe('')
  })

  it('bleibt ohne Sammler funktionsgleich', () => {
    // Der Kanal ist optional; bestehende Aufrufer aendern ihr Verhalten nicht.
    expect(normaliseSourceIdentities([{ id: 'a', name: 'Kamera 1' }, { id: 'a', name: 'X' }])).toEqual(
      [{ id: 'a', name: 'Kamera 1' }],
    )
  })
})

describe('hasDrops', () => {
  it('ist nur wahr, wenn es wirklich etwas zu melden gibt', () => {
    expect(hasDrops(null)).toBe(false)
    expect(hasDrops(undefined)).toBe(false)
    expect(hasDrops({ drops: [] })).toBe(false)
    expect(hasDrops({ drops: [{ kind: 'source-identity', reason: 'duplicate-id', label: 'x' }] })).toBe(
      true,
    )
  })
})
