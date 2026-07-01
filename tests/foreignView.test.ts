import { describe, expect, it } from 'vitest'
import { summarizeForeign, hasForeign } from '../src/renderer/lib/foreignView'

describe('foreignView (Cable read-only Uebersicht der fremden .avplan-Domaenen)', () => {
  it('fasst Raum, Kameras und Lampen zusammen', () => {
    const avForeign = {
      venue: { name: 'Halle A', walls: [{}, {}], persons: [{}], stageObjects: [] },
      cameras: { cameras: [{ id: 'c1', label: 'CAM 1' }, { id: 'c2', label: 'CAM 2' }] },
      lighting: { fixtures: [{ id: 'f1', fixture: { name: 'ETC S4' }, purpose: 'Key', dimming: 0.8, currentColorTemp: 3200 }] },
    }
    const s = summarizeForeign(avForeign)
    expect(s.venueName).toBe('Halle A')
    expect(s.counts).toEqual({ walls: 2, persons: 1, stage: 0 })
    expect(s.cameras.map((c) => c.label)).toEqual(['CAM 1', 'CAM 2'])
    expect(s.fixtures[0]).toMatchObject({ name: 'ETC S4', purpose: 'Key', dimming: 0.8, colorTemp: 3200 })
  })

  it('hasForeign / summarize sind robust gegen Muell', () => {
    expect(hasForeign(undefined)).toBe(false)
    expect(hasForeign({})).toBe(false)
    expect(hasForeign({ cameras: { cameras: [{ id: 'c1', label: 'X' }] } })).toBe(true)
    const empty = summarizeForeign(undefined)
    expect(empty.cameras).toEqual([])
    expect(empty.fixtures).toEqual([])
    expect(summarizeForeign({ lighting: { fixtures: 'nope' } }).fixtures).toEqual([])
  })
})
