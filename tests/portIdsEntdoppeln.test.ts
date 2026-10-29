import { describe, it, expect } from 'vitest'
import { entdoppelePortIds } from '../src/renderer/lib/portIdsEntdoppeln'
import type { CablePlannerProject } from '../src/renderer/types/project'

const geraet = (id: string) => ({
  id, name: 'Audio to SDI', category: 'Other', x: 0, y: 0, width: 100, height: 50,
  inputs: [{ id: 'in1', name: 'Input 1', type: 'BNC' }],
  outputs: [{ id: 'out1', name: 'Output 1', type: 'BNC' }],
})

describe('entdoppelePortIds', () => {
  it('gibt Doppelgaengern neue Ids und zieht deren Kabel mit', () => {
    const p = {
      equipment: [geraet('a'), geraet('b')],
      cables: [
        { id: 'k1', fromEquipmentId: 'a', fromPortId: 'out1', toEquipmentId: 'x', toPortId: 'z' },
        { id: 'k2', fromEquipmentId: 'b', fromPortId: 'out1', toEquipmentId: 'x', toPortId: 'z' },
      ],
    } as unknown as CablePlannerProject
    const r = entdoppelePortIds(p)
    const alle = r.equipment.flatMap((e) => [...e.inputs, ...e.outputs].map((q) => q.id))
    expect(new Set(alle).size).toBe(4)
    expect(r.cables[0].fromPortId).toBe('out1')
    expect(r.cables[1].fromPortId).toBe(r.equipment[1].outputs[0].id)
  })
  it('laesst eindeutige Plaene unveraendert', () => {
    const p = { equipment: [geraet('a')], cables: [] } as unknown as CablePlannerProject
    expect(entdoppelePortIds(p)).toBe(p)
  })
})
