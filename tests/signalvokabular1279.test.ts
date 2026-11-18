import { describe, expect, it } from 'vitest'
import { ALL_SIGNAL_STANDARDS, bandwidthMbpsForStandard, cableCatalog } from '../src/renderer/types/cableSpec'
import type { SignalStandard } from '../src/renderer/types/cableSpec'
import { essenceOf } from '../src/renderer/lib/multicastPlan'

// #1279 — Signalvokabular gegen EasySchematic.
const NEU: SignalStandard[] = ['AVB', 'AES50', 'S/PDIF', 'ADAT', 'MIDI', 'Speaker-Level', 'RTSP', 'MPEG-TS']

describe('Signalvokabular (#1279)', () => {
  it('steht in der Auswahl und hat je ein Kabel', () => {
    for (const s of NEU) {
      expect(ALL_SIGNAL_STANDARDS).toContain(s)
      expect(cableCatalog.some((c) => c.standards.includes(s))).toBe(true)
    }
  })

  it('behauptet keine Bandbreite und keinen IP-Multicast, wo es keinen belegten Wert gibt', () => {
    for (const s of NEU) {
      expect(bandwidthMbpsForStandard(s)).toBeUndefined()
      // AVB ist Schicht 2 (MAAP statt IP-Multicast), der Rest punkt-zu-punkt
      // oder Unicast — keiner gehoert in den IP-Multicast-Plan.
      expect(essenceOf(s)).toBeNull()
    }
  })

  it('fuehrt Kabel-Ids nur einmal', () => {
    const ids = cableCatalog.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
