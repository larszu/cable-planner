import { describe, expect, it } from 'vitest'
import { blackmagicTemplates } from '../src/renderer/lib/blackmagicCatalog'
import { toPlacement } from '../src/renderer/components/Rack/rackBuilderHelpers'

const tpl = (name: string) => {
  const found = blackmagicTemplates.find((t) => t.name === name)
  if (!found) throw new Error(name)
  return found
}

describe('#1051 Rack-Hoehe und halbe Breite', () => {
  it('Universal Videohubs tragen ihre HE', () => {
    expect(tpl('Blackmagic Universal Videohub 72').rackUnits).toBe(5)
    expect(tpl('Blackmagic Universal Videohub 288').rackUnits).toBe(18)
  })

  it('HyperDeck Studio HD Plus ist halbe Breite, kein Shelf-Geraet', () => {
    const t = tpl('Blackmagic Hyperdeck Studio HD Plus')
    expect(t.rackHalfWidth).toBe(true)
    expect(t.widthMm).toBeUndefined()
    const p = toPlacement(t, 3)
    expect(p).toMatchObject({ rackHalfWidth: true, rackHalf: 'left', rackUnits: 1, startUnit: 3 })
  })

  it('volle Breite bekommt keine Haelfte', () => {
    const p = toPlacement(tpl('Blackmagic Universal Videohub 72'), 1)
    expect(p.rackHalfWidth).toBeUndefined()
    expect(p.rackHalf).toBeUndefined()
  })
})
