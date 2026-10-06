import { describe, it, expect } from 'vitest'
import { atemPortSources, impliedOutputSourceId } from '../src/renderer/lib/atemPortSources'

describe('atemPortSources (#1008)', () => {
  it('leitet Eingangs-IDs aus der Position ab', () => {
    const r = atemPortSources({ inputs: [{ name: 'Kamera 1' }, { name: 'Kamera 2' }] })
    expect(r.map((p) => [p.id, p.name])).toEqual([[1, 'Kamera 1'], [2, 'Kamera 2']])
  })
  it('leitet Ausgangs-IDs aus dem Namen ab', () => {
    expect(impliedOutputSourceId('AUX 3')).toBe(8003)
    expect(impliedOutputSourceId('Program')).toBe(10010)
    expect(impliedOutputSourceId('PVW')).toBe(10011)
    expect(impliedOutputSourceId('ME 2 PGM')).toBe(10020)
    expect(impliedOutputSourceId('HDMI Out')).toBeUndefined()
  })
  it('ausdrueckliche atemSourceId gewinnt, unbenannte Ports entfallen', () => {
    const r = atemPortSources({
      inputs: [{ name: '' }, { name: 'X', atemSourceId: 7 }],
      outputs: [{ name: 'Monitor', atemSourceId: 8005 }, { name: 'Foo' }],
    })
    expect(r.map((p) => p.id)).toEqual([7, 8005])
  })
})
