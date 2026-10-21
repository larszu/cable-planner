import { describe, expect, it } from 'vitest'
import { searchCommands } from '../src/renderer/lib/commandSearch'

const cmds = [
  { id: 'docs', title: 'Fixed install: docs & handover…', group: 'Tools', note: 'Asset register, QR labels', keywords: 'etikett' },
  { id: 'power', title: 'Calculate power consumption…', group: 'Tools', keywords: 'strom watt' },
  { id: 'patch', title: 'Patch list…', group: 'Tools' },
  { id: 'plan', title: 'Plan check…', group: 'Tools', note: 'Finds gaps in the patch' },
]
const ids = (q: string) => searchCommands(cmds, q).map((c) => c.id)

describe('searchCommands (#1025)', () => {
  it('returns everything for an empty query', () => {
    expect(ids('  ')).toEqual(['docs', 'power', 'patch', 'plan'])
  })
  it('finds through synonyms and descriptions', () => {
    expect(ids('Etikett')).toEqual(['docs'])
    expect(ids('qr')).toEqual(['docs'])
    expect(ids('strom')).toEqual(['power'])
  })
  it('requires every word', () => {
    expect(ids('power watt')).toEqual(['power'])
    expect(ids('power rack')).toEqual([])
  })
  it('ranks title matches before description matches', () => {
    expect(ids('patch')).toEqual(['patch', 'plan'])
  })
  it('ignores case and accents', () => {
    expect(ids('ÉTIKETT')).toEqual(['docs'])
  })
})
