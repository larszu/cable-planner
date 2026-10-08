import { describe, expect, it } from 'vitest'
import { overlayFreeTop } from '../src/renderer/lib/canvasViewport'
import { canArrangeInRack, selectionContainsRack } from '../src/renderer/lib/rackArrange'

// #1035 — Werkzeugleiste und Suche belegen den oberen Rand; Einpassen und
// Platzieren rechnen unterhalb davon.
describe('overlayFreeTop', () => {
  const area = { top: 100, height: 800 }

  it('ist 0 ohne schwebende Ebenen', () => {
    expect(overlayFreeTop(area, [])).toBe(0)
  })

  it('nimmt die tiefste Unterkante der oberen Ebenen', () => {
    expect(
      overlayFreeTop(area, [
        { top: 108, bottom: 170 },
        { top: 178, bottom: 220 },
      ]),
    ).toBe(120)
  })

  it('ignoriert eine nach unten gezogene Leiste', () => {
    expect(overlayFreeTop(area, [{ top: 600, bottom: 660 }])).toBe(0)
  })

  it('kappt auf die halbe Hoehe', () => {
    expect(overlayFreeTop(area, [{ top: 110, bottom: 700 }])).toBe(400)
  })
})

// #1034 — Kontextmenue und Werkzeugleiste teilen die Regel „kein Rack im Rack".
describe('canArrangeInRack', () => {
  const equipment = [{ id: 'a' }, { id: 'b' }, { id: 'rack', rackInternalSnapshot: {} }]

  it('erlaubt normale Geraete', () => {
    expect(canArrangeInRack(['a', 'b'], equipment)).toBe(true)
  })

  it('verbietet eine Auswahl mit Rack', () => {
    expect(selectionContainsRack(['a', 'rack'], equipment)).toBe(true)
    expect(canArrangeInRack(['a', 'rack'], equipment)).toBe(false)
  })

  it('verbietet eine leere Auswahl', () => {
    expect(canArrangeInRack([], equipment)).toBe(false)
  })
})
