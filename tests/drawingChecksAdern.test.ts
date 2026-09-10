import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { Cable } from '../src/renderer/types/cable'
import type { Anschluss, Farbnorm } from '../src/renderer/types/conductor'

// ---------------------------------------------------------------------------
// B-45, Check 22 — der Anschluss im Plan-Check.
//
// Die SCHWERE ist hier die eigentliche Aussage: eine fehlende Ader ist eine
// Leitung, die auf der Baustelle nicht liegt; eine fehlende Farbnorm ist eine
// Angabe, die niemand eingetragen hat. Wer beide gleich zeigt, laesst die
// erste in der zweiten untergehen.
// ---------------------------------------------------------------------------

const kabel = (id: string, rolle: string, over: Partial<Cable> = {}): Cable => ({
  id,
  name: id,
  type: 'Powerlock',
  length: 25,
  color: '#000',
  fromEquipmentId: 'e1',
  fromPortId: 'p1',
  toEquipmentId: 'e2',
  toPortId: 'p2',
  notes: '',
  anschlussId: 'b1',
  adern: [{ id: `a-${id}`, rolle: rolle as never }],
  ...over,
})

const norm: Farbnorm = {
  id: 'n1',
  name: 'Hausstandard',
  herkunft: 'Vom Eigentümer festgelegt',
  farben: { L1: 'braun', L2: 'schwarz', L3: 'grau', N: 'blau', PE: 'grün-gelb' },
}

const anschluss: Anschluss = {
  id: 'b1',
  name: '400 A',
  soll: ['L1', 'L2', 'L3', 'N', 'PE'],
  farbnormId: 'n1',
}

const alle = () =>
  ['L1', 'L2', 'L3', 'N', 'PE'].map((r) => kabel(`c-${r}`, r))

describe('Check 22 — was fehlt, ist ein Fehler; was nicht erklärt ist, ein Hinweis', () => {
  it('die fehlende fünfte Leitung ist ein error', () => {
    const { findings } = runDrawingChecks({
      equipment: [],
      cables: alle().filter((c) => c.id !== 'c-N'),
      anschlussListe: [anschluss],
      farbnormen: [norm],
    })
    const f = findings.filter((x) => x.category === 'Wire bundle')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('error')
    expect(f[0].message).toContain('N')
  })

  it('die fehlende Farbnorm ist nur ein info — und geht nicht unter', () => {
    const { findings } = runDrawingChecks({
      equipment: [],
      cables: alle(),
      anschlussListe: [{ ...anschluss, farbnormId: undefined }],
      farbnormen: [],
    })
    const f = findings.filter((x) => x.category === 'Wire bundle')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('info')
  })

  it('beides zusammen: der Fehler steht vor dem Hinweis', () => {
    const { findings } = runDrawingChecks({
      equipment: [],
      cables: alle().filter((c) => c.id !== 'c-PE'),
      anschlussListe: [{ ...anschluss, farbnormId: undefined }],
      farbnormen: [],
    })
    const f = findings.filter((x) => x.category === 'Wire bundle')
    expect(f).toHaveLength(2)
    expect(f[0].severity).toBe('error')
    expect(f[1].severity).toBe('info')
  })

  it('eine widersprechende Farbe zeigt auf ihre Leitung', () => {
    const cables = alle().map((c) =>
      c.id === 'c-N' ? { ...c, adern: [{ id: 'x', rolle: 'N' as const, farbe: 'braun' }] } : c,
    )
    const { findings } = runDrawingChecks({
      equipment: [],
      cables,
      anschlussListe: [anschluss],
      farbnormen: [norm],
    })
    const f = findings.filter((x) => x.category === 'Wire bundle')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('error')
    expect(f[0].cableId).toBe('c-N')
  })

  it('ein vollständiger Anschluss mit Norm erzeugt gar keinen Befund', () => {
    const { findings } = runDrawingChecks({
      equipment: [],
      cables: alle(),
      anschlussListe: [anschluss],
      farbnormen: [norm],
    })
    expect(findings.filter((x) => x.category === 'Wire bundle')).toEqual([])
  })

  it('ohne Anschlüsse im Projekt läuft der Check gar nicht an', () => {
    const { findings } = runDrawingChecks({ equipment: [], cables: alle() })
    expect(findings.some((x) => x.category === 'Wire bundle')).toBe(false)
  })
})
