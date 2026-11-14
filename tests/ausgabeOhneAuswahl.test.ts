import { afterEach, describe, expect, it } from 'vitest'
import { mitAllenElementen } from '../src/renderer/lib/alleElementeRendern'
import { setCanvasSelectionClearer } from '../src/renderer/lib/canvasViewport'
import bomSrc from '../src/renderer/components/Project/LocationBomDialog.tsx?raw'
import canvasSrc from '../src/renderer/components/Canvas/CanvasArea.tsx?raw'

// #1210 — ein markierter Raum druckte seine Markierung mit. Jede Ausgabe, die
// den Plan aus dem DOM liest, hebt vorher die Auswahl auf.

afterEach(() => setCanvasSelectionClearer(null))

describe('Ausgaben ohne Auswahl', () => {
  it('hebt die Auswahl auf, bevor gelesen wird', async () => {
    const ablauf: string[] = []
    setCanvasSelectionClearer(() => ablauf.push('auswahl weg'))
    await mitAllenElementen(async () => {
      ablauf.push('gelesen')
    })
    expect(ablauf).toEqual(['auswahl weg', 'gelesen'])
  })

  it('die Raumdokumentation liest den Plan ueber denselben Vorlauf', () => {
    expect(bomSrc).toContain('mitAllenElementen(capturePlanForLocation)')
  })

  it('der Rechtsklick auf einen Raum bietet die Raumdokumentation an', () => {
    expect(canvasSrc).toContain('openLocationBom(nodeContextMenu.nodeId)')
  })
})
