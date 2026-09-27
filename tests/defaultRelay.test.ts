import { describe, expect, it } from 'vitest'
import { DEFAULT_RELAY, signalingFor } from '../src/renderer/store/collabStore'

describe('Vorgabe-Relay (#869)', () => {
  it('gilt nur ohne eigenen Eintrag und nie mit „Nur lokal"', () => {
    expect(signalingFor('', false)).toEqual([DEFAULT_RELAY, 'wss://y-webrtc-eu.fly.dev'])
    expect(signalingFor('', false, 'ws://192.168.1.5:4444')[0]).toBe('ws://192.168.1.5:4444')
    expect(signalingFor('wss://eigener.example', false)).toEqual(['wss://eigener.example'])
    expect(signalingFor('', true, 'ws://192.168.1.5:4444')).toEqual(['ws://192.168.1.5:4444'])
    expect(signalingFor('wss://eigener.example', true)).toEqual([])
  })
})
