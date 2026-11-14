import { describe, expect, it } from 'vitest'
import { wegpunktEinfuegen } from '../src/renderer/lib/wegpunktEinfuegen'

// #1204 — Werte aus dem Browser nachgestellt: zwei Geraete nebeneinander,
// ein Stuetzpunkt unterhalb, der Weg macht ein U.
const weg = [
  { x: 223, y: 56 }, { x: 241, y: 56 }, { x: 330, y: 56 }, { x: 330, y: 200 },
  { x: 639, y: 200 }, { x: 639, y: 56 }, { x: 657, y: 56 },
]
const wps = [{ x: 330, y: 200 }]

describe('#1204 — Wegpunkt hier hinzufuegen', () => {
  it('gerade Strecke HINTER dem Stuetzpunkt: kommt danach, nicht davor', () => {
    expect(wegpunktEinfuegen(wps, weg, { x: 484.5, y: 200 })).toEqual([{ x: 330, y: 200 }, { x: 485, y: 200 }])
  })

  it('gerade Strecke VOR dem Stuetzpunkt (an der Quelle): kommt davor', () => {
    expect(wegpunktEinfuegen(wps, weg, { x: 300, y: 57 })).toEqual([{ x: 300, y: 56 }, { x: 330, y: 200 }])
  })

  it('sitzt auf dem Strich statt einen Pixel daneben', () => {
    const gerade = [{ x: 223, y: 56 }, { x: 657, y: 56 }]
    expect(wegpunktEinfuegen([], gerade, { x: 440, y: 55 })).toEqual([{ x: 440, y: 56 }])
  })

  it('mehrere Stuetzpunkte: zwischen die beiden, zwischen denen geklickt wurde', () => {
    const w = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }]
    const punkte = [{ x: 100, y: 0 }, { x: 200, y: 100 }]
    expect(wegpunktEinfuegen(punkte, w, { x: 150, y: 101 })).toEqual([{ x: 100, y: 0 }, { x: 150, y: 100 }, { x: 200, y: 100 }])
  })

  it('ohne gezeichneten Weg (gerade/geschwungene Fuehrung) haengt es an', () => {
    expect(wegpunktEinfuegen([], undefined, { x: 5, y: 5 })).toEqual([{ x: 5, y: 5 }])
    expect(wegpunktEinfuegen([{ x: 0, y: 0 }], undefined, { x: 5, y: 5 })).toEqual([{ x: 0, y: 0 }, { x: 5, y: 5 }])
  })
})
