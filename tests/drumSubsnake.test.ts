import { describe, it, expect } from 'vitest'
import {
  applyTechnique,
  emptyDrumKit,
  deriveDrumChannels,
  drumPatchTable,
  drumLabelRows,
  drumSubsnakeOverflow,
} from '../src/renderer/lib/drumMicing'
import type { DrumKitPlan } from '../src/renderer/types/drumKit'

let n = 0
const kit = (): DrumKitPlan => {
  const base = emptyDrumKit()
  const { placements } = applyTechnique(base, 'closeFull', (z) => `m-${z}-${n++}`)
  return { ...base, mics: placements, technique: 'closeFull' }
}

describe('#1001 drum subsnake patch', () => {
  it('patches channel n to subsnake input n by default', () => {
    const d = deriveDrumChannels(kit())
    expect(d.channelCount).toBeGreaterThan(2)
    d.channels.forEach((c) => expect(c.subsnakeInput).toBe(c.channel))
  })

  it('honours firstInput and flags overflow', () => {
    const plan = { ...kit(), subsnake: { name: 'SB', inputs: 4, firstInput: 3 } }
    const d = deriveDrumChannels(plan)
    expect(d.channels[0].subsnakeInput).toBe(3)
    expect(d.channels[1].subsnakeInput).toBe(4)
    expect(d.channels[2].subsnakeInput).toBeUndefined()
    expect(drumSubsnakeOverflow(plan)).toBe(d.channelCount - 2)
  })

  it('builds a patch list table with one row per channel', () => {
    const plan = kit()
    const t = drumPatchTable(plan)
    expect(t.headers).toContain('Subsnake')
    expect(t.rows).toHaveLength(plan.mics.length)
    expect(t.rows[0][3]).toBe('Drum Sub')
    expect(t.rows[0][4]).toBe(1)
  })

  it('creates two labels per channel (mic end + subsnake end)', () => {
    const plan = kit()
    const labels = drumLabelRows(plan)
    expect(labels).toHaveLength(plan.mics.length * 2)
    expect(labels[0].label1).toMatch(/^01 /)
    expect(labels[0].label2).toBe('-> Drum Sub 1')
  })
})
