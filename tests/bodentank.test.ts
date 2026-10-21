// #963 — Bodentanks: ein Anschlusspunkt im Boden, in 3D auf dem Boden und dort
// verschiebbar wie jedes Geraet.
import { describe, expect, it } from 'vitest'
import { canvasPositionAus3D, gebaeudeSzene } from '../src/renderer/lib/gebaeudeSzene'
import { passiveTemplates } from '../src/renderer/lib/passiveCatalog'
import { isPatchPanelDevice, patchPanelCounterpart } from '../src/renderer/lib/patchPanel'
import { istBodentank, normalisiereFrontplatte } from '../src/renderer/types/frontplatte'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const tanks = passiveTemplates.filter((t) => t.category === 'Floor boxes')
const alsGeraet = (t: (typeof tanks)[number], id: string, x = 0, y = 0): EquipmentItem => ({
  ...t,
  id,
  x,
  y,
  inputs: t.inputs.map((p, i) => ({ ...p, id: `${id}-in-${i}` })),
  outputs: t.outputs.map((p, i) => ({ ...p, id: `${id}-out-${i}` })),
})

describe('Bodentank im Katalog', () => {
  it('gibt es und ist ein Durchleiter wie ein Wandfeld', () => {
    expect(tanks.length).toBeGreaterThan(0)
    for (const t of tanks) {
      expect(istBodentank(t)).toBe(true)
      expect(isPatchPanelDevice(t)).toBe(true)
      expect(t.inputs.length).toBe(t.outputs.length)
      t.inputs.forEach((p, i) => expect(p.connectorType).toBe(t.outputs[i].connectorType))
    }
    const g = alsGeraet(tanks[0], 'bt')
    expect(patchPanelCounterpart(g, { id: 'bt-out-2' })?.id).toBe('bt-in-2')
  })

  it('ueberlebt das Laden', () => {
    expect(normalisiereFrontplatte({ art: 'bodentank' })?.art).toBe('bodentank')
  })
})

describe('Bodentank und Geraete in 3D', () => {
  const daten = {
    equipment: [alsGeraet(tanks[0], 'bt', 100, 100), { ...alsGeraet(tanks[0], 'x', 200, 100), frontplatte: undefined }],
    cables: [],
    locations: [{ id: 'r', name: 'r', x: 0, y: 0, width: 400, height: 400, color: '#38bdf8', floor: 'OG' }],
    floors: [{ name: 'OG', elevationM: 4 }],
  }
  const opt = { metersPer100px: 1, geschosshoeheM: 4 }

  it('legt den Bodentank auf den Boden, das Geraet auf Tischhoehe', () => {
    const s = gebaeudeSzene(daten, opt)
    const bt = s.geraete.find((g) => g.id === 'bt')!
    const x = s.geraete.find((g) => g.id === 'x')!
    expect(bt.bodentank).toBe(true)
    expect(bt.pos.y).toBeCloseTo(4.03)
    expect(x.bodentank).toBe(false)
    expect(x.pos.y).toBeCloseTo(4.8)
    expect(bt.bodenY).toBe(4)
  })

  it('rechnet einen gezogenen Punkt auf die Canvas-Position zurueck', () => {
    const s = gebaeudeSzene(daten, opt)
    const bt = s.geraete.find((g) => g.id === 'bt')!
    const e = daten.equipment[0]
    expect(canvasPositionAus3D(e, bt.pos.x, bt.pos.z, 1)).toEqual({ x: 100, y: 100 })
    // 1,5 m nach rechts = 150 px bei 1 m je 100 px
    expect(canvasPositionAus3D(e, bt.pos.x + 1.5, bt.pos.z, 1)).toEqual({ x: 250, y: 100 })
  })
})
