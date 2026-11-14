import { describe, expect, it } from 'vitest'
import { countCablesByLayer, isCableVisibleByLayer, soloLayerVisibility, STANDARD_LAYERS } from '../src/renderer/lib/cableLayers'

// #1189 — Zahl je Ebene und Einsam-Schalten.
describe('countCablesByLayer', () => {
  it('zaehlt Unterebenen bei der Hauptebene und Kabel ohne Ebene bei other', () => {
    const counts = countCablesByLayer([
      { layer: 'video' },
      { layer: 'video.backup' },
      { layer: 'power' },
      { layer: undefined },
      { layer: 'intercom' },
    ])
    expect(counts).toEqual({ video: 2, power: 1, other: 1, intercom: 1 })
  })
})

describe('soloLayerVisibility', () => {
  const layers = [...STANDARD_LAYERS, 'intercom']

  it('laesst nur die gewaehlte Ebene sichtbar', () => {
    const next = soloLayerVisibility(layers, {}, 'audio')
    for (const l of layers) expect(next[l]).toBe(l === 'audio')
    expect(isCableVisibleByLayer({ layer: 'audio.foh' }, next)).toBe(true)
    expect(isCableVisibleByLayer({ layer: 'video' }, next)).toBe(false)
  })

  it('macht eine ausgeblendete Ebene beim Einsam-Schalten sichtbar', () => {
    const next = soloLayerVisibility(layers, { power: false }, 'power')
    expect(next.power).toBe(true)
    expect(next.video).toBe(false)
  })

  it('kehrt beim zweiten Mal zu allen sichtbar zurueck', () => {
    const einsam = soloLayerVisibility(layers, {}, 'intercom')
    const zurueck = soloLayerVisibility(layers, einsam, 'intercom')
    for (const l of layers) expect(zurueck[l]).toBe(true)
  })
})
