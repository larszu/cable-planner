import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { Cable } from '../src/renderer/types/cable'

// Nach einem yEd-Import mit 159 Kabeln zeichnete sich jedes Kabel zum ersten
// Mal und speicherte seinen Weg mit einem eigenen updateCable — 81 `set` in
// 250 ms, der Set-Rate-Guard warf, die Web-Version zeigte den Fehlerschirm.
describe('erstmals berechnete Kabelwege', () => {
  it('landen fuer viele Kabel in einem einzigen set', () => {
    const cables = Array.from({ length: 300 }, (_, i) => ({ id: `c${i}` }) as Cable)
    useProjectStore.setState((s) => ({ project: { ...s.project, cables } }))
    let sets = 0
    const unsub = useProjectStore.subscribe(() => { sets += 1 })
    const byId = new Map(cables.map((c, i) => [c.id, [{ x: i, y: 0 }]]))
    expect(() => useProjectStore.getState().setCableWaypointsBatch(byId)).not.toThrow()
    unsub()
    expect(sets).toBe(1)
    expect(useProjectStore.getState().project.cables[299].waypoints).toEqual([{ x: 299, y: 0 }])
  })

  it('CableEdge persistiert ueber die Sammelaktion, nicht je Kabel', () => {
    const src = readFileSync('src/renderer/components/Canvas/CableEdge.tsx', 'utf8')
    expect(src).not.toMatch(/updateCable\(cable\.id, \{ waypoints: ausAStern/)
    expect(src).toMatch(/queueWaypointPersist\(setCableWaypointsBatch/)
  })
})
