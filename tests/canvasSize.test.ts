import { afterEach, describe, expect, it } from 'vitest'
import { getCanvasSize, setCanvasSizeGetter } from '../src/renderer/lib/canvasViewport'

// Canvas-Groessen-Bridge: CanvasArea meldet die real gemessene Canvas-Flaeche,
// damit Zoom-to-fit nach einem Import auf die TATSAECHLICHE Mitte zentriert
// statt auf den geratenen 1200x700-Fallback. Wichtig ist, dass ein fehlender
// oder unbrauchbarer Messwert sauber als `null` durchkommt — der Aufrufer
// (projectStore) faellt dann auf VIEWPORT_DEFAULTS zurueck, statt durch 0 zu
// teilen oder auf NaN zu zentrieren.
describe('getCanvasSize', () => {
  afterEach(() => setCanvasSizeGetter(null))

  it('liefert null, solange keine Canvas registriert ist', () => {
    expect(getCanvasSize()).toBeNull()
  })

  it('liefert die gemessene Groesse der registrierten Canvas', () => {
    setCanvasSizeGetter(() => ({ width: 2560, height: 1400 }))
    expect(getCanvasSize()).toEqual({ width: 2560, height: 1400 })
  })

  it('meldet eine noch nicht gelayoutete Canvas (0 px) als null', () => {
    // Erster Render: der Wrapper hat noch keine Breite. Ohne diese Wache
    // wuerde fitZoom durch 0 geteilt bzw. auf 0/0 zentriert.
    setCanvasSizeGetter(() => ({ width: 0, height: 0 }))
    expect(getCanvasSize()).toBeNull()

    setCanvasSizeGetter(() => ({ width: 800, height: 0 }))
    expect(getCanvasSize()).toBeNull()
  })

  it('meldet negative Werte als null', () => {
    setCanvasSizeGetter(() => ({ width: -10, height: 700 }))
    expect(getCanvasSize()).toBeNull()
  })

  it('schluckt einen werfenden Getter (unmountete Canvas) statt zu crashen', () => {
    setCanvasSizeGetter(() => {
      throw new Error('wrapper weg')
    })
    expect(getCanvasSize()).toBeNull()
  })

  it('gibt nach dem Abmelden wieder null zurueck', () => {
    setCanvasSizeGetter(() => ({ width: 1920, height: 1080 }))
    expect(getCanvasSize()).not.toBeNull()
    setCanvasSizeGetter(null)
    expect(getCanvasSize()).toBeNull()
  })
})
