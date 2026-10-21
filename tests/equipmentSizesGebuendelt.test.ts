import { describe, expect, it } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'

// Ein generierter Plan mit 246 Geraeten liess die Arbeitsflaeche leer: beim
// ersten Oeffnen meldet ReactFlow alle Knotengroessen auf einmal, und einzeln
// geschrieben loeste das den Set-Rate-Guard aus. Die Groessen gehen jetzt in
// EINEM Schritt in den Store.
describe('setEquipmentSizes', () => {
  it('schreibt viele Groessen mit einer einzigen Store-Aenderung', () => {
    const st = useProjectStore.getState()
    const equipment = Array.from({ length: 120 }, (_, i) => ({
      id: `massen-${i}`, name: `Massen-${i}`, category: 'Other', inputs: [], outputs: [], x: i * 10, y: 0, width: 396, height: 99,
    }))
    st.loadProject({ ...st.project, equipment, cables: [], locations: [] })
    const ids = equipment.map((e) => e.id)
    const xVorher = useProjectStore.getState().project.equipment.find((x) => x.id === ids[7])!.x
    let aenderungen = 0
    const ab = useProjectStore.subscribe(() => { aenderungen++ })
    expect(() =>
      useProjectStore.getState().setEquipmentSizes(new Map(ids.map((id) => [id, { width: 220, height: 60 }]))),
    ).not.toThrow()
    ab()
    expect(aenderungen).toBe(1)
    const e = useProjectStore.getState().project.equipment.find((x) => x.id === ids[7])!
    expect([e.width, e.height, e.x]).toEqual([220, 60, xVorher])
  })
})
