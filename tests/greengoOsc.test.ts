import { describe, expect, it } from 'vitest'
import { decodeOsc, encodeOsc } from '../src/main/services/osc'
import { applyGreengoState, emptyGreengoState } from '../src/renderer/lib/greengoLive'

describe('Green-GO OSC', () => {
  it('encodes a command the way the Companion module sends it', () => {
    const b = encodeOsc('/ggo/cmd/channel/listen', [1, 3])
    // "/ggo/cmd/channel/listen\0" padded to 24, ",ii\0", two int32
    expect(b.length).toBe(24 + 4 + 8)
    expect(b.subarray(0, 23).toString('ascii')).toBe('/ggo/cmd/channel/listen')
    expect(b.subarray(24, 27).toString('ascii')).toBe(',ii')
    expect(b.readInt32BE(28)).toBe(1)
    expect(b.readInt32BE(32)).toBe(3)
  })

  it('round-trips and survives junk', () => {
    expect(decodeOsc(encodeOsc('/ggo/state/level/main', [-12]))).toEqual({ address: '/ggo/state/level/main', args: [-12] })
    expect(decodeOsc(Buffer.from('garbage'))).toBeNull()
    expect(decodeOsc(encodeOsc('/ggo/state/channel/talk', [2]).subarray(0, 30))).toBeNull()
  })

  it('folds state messages into a per-channel picture and ignores the rest', () => {
    let s = emptyGreengoState()
    s = applyGreengoState(s, '/ggo/state/channel/talk', [2, 3], 1000)
    s = applyGreengoState(s, '/ggo/state/channel/listen', [0, 3], 1000)
    s = applyGreengoState(s, '/ggo/state/channel/level', [-6, 3], 1000)
    s = applyGreengoState(s, '/ggo/state/level/main', [-10], 1000)
    s = applyGreengoState(s, '/ggo/state/channel/talk', [2, 9], 1000)
    s = applyGreengoState(s, '/ggo/state/heartbeat', [1], 2000)
    expect(s.channels[3]).toEqual({ talk: 2, listen: 0, level: -6 })
    expect(s.channels[9]).toBeUndefined()
    expect(s.mainLevel).toBe(-10)
    expect(s.lastHeard).toBe(2000)
  })
})
