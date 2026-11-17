import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import {
  ALL_SIGNAL_STANDARDS,
  cableCatalog,
  bandwidthMbpsForStandard,
  pickHighestSdiStandard,
} from '../src/renderer/types/cableSpec'
import { essenceOf } from '../src/renderer/lib/multicastPlan'
import { AUDIO_MULTICAST, VIDEO_MULTICAST } from '../src/renderer/lib/venueNetworkRequest'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { SignalStandard } from '../src/renderer/types/cableSpec'

// ---------------------------------------------------------------------------
// #1200 — Vergleich mit EasySchematic, NMOS und SMPTE ST 2110.
//
// Zwei kleine Luecken aus dem Vergleich (docs/vergleich-easyschematic-nmos-
// 2110.md) sind hier geschlossen:
//
//   1. ST 2110-22 (JPEG XS) und ST 2110-31 (AES3 transparent) fehlten als
//      Signalstandard. Ein Aufbau mit JPEG-XS-Strecken liess sich nur als
//      -20 eintragen und meldete dann das Zehnfache an Netzlast.
//   2. Kein Plan-Check verglich die Last eines Mediensignals mit der
//      Kapazitaet der Buchse, an der es haengt.
// ---------------------------------------------------------------------------

const port = (id: string, standard?: SignalStandard): Port => ({
  id,
  name: id,
  type: 'network',
  connectorType: 'Ethernet/RJ45',
  standard,
})

const eq = (id: string, ports: Port[]): EquipmentItem => ({
  id,
  name: id,
  category: 'Video',
  inputs: ports,
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
})

const kabel = (standard: SignalStandard): Cable => ({
  id: 'k',
  fromEquipmentId: 'cam',
  fromPortId: 'cam-p',
  toEquipmentId: 'sw',
  toPortId: 'sw-p',
  type: 'Ethernet/RJ45',
  standard,
})

const pruefe = (standard: SignalStandard, swPort?: SignalStandard) =>
  runDrawingChecks({
    equipment: [eq('cam', [port('cam-p')]), eq('sw', [port('sw-p', swPort)])],
    cables: [kabel(standard)],
  }).findings.filter((f) => f.id.startsWith('link-too-slow:'))

describe('#1200 ST 2110-22 und -31', () => {
  it('stehen in der Auswahl und im 2110-Kabel', () => {
    for (const s of ['ST2110-22', 'ST2110-31'] as const) {
      expect(ALL_SIGNAL_STANDARDS).toContain(s)
      expect(cableCatalog.find((c) => c.id === 'st2110-fiber')?.standards).toContain(s)
    }
  })

  it('JPEG XS liegt zwischen Audio und unkomprimiertem Video', () => {
    const xs = bandwidthMbpsForStandard('ST2110-22')!
    expect(xs).toBeGreaterThan(bandwidthMbpsForStandard('ST2110-30')!)
    expect(xs).toBeLessThan(bandwidthMbpsForStandard('ST2110-20')!)
    expect(bandwidthMbpsForStandard('ST2110-31')).toBe(bandwidthMbpsForStandard('ST2110-30'))
  })

  it('der Vorgabewert des 2110-Kabels bleibt die unkomprimierte Video-Essenz', () => {
    const spec = cableCatalog.find((c) => c.id === 'st2110-fiber')!
    expect(pickHighestSdiStandard(spec.standards)).toBe('ST2110-20')
  })

  it('gehoeren zu Video bzw. Audio im Multicast- und PTP-Plan', () => {
    expect(essenceOf('ST2110-22')).toBe('video')
    expect(essenceOf('ST2110-31')).toBe('audio')
    expect(VIDEO_MULTICAST.has('ST2110-22')).toBe(true)
    expect(AUDIO_MULTICAST.has('ST2110-31')).toBe(true)
  })

  it('loesen die PTP-Erinnerung aus wie jede andere 2110-Essenz', () => {
    const r = runDrawingChecks({
      equipment: [eq('cam', [port('cam-p')]), eq('sw', [port('sw-p')])],
      cables: [kabel('ST2110-22')],
    })
    expect(r.findings.some((f) => f.id === 'st2110-no-ptp')).toBe(true)
  })
})

describe('#1200 Pruefung: Signal breiter als die Schnittstelle', () => {
  it('meldet unkomprimiertes 2110-20 an einer 1G-Buchse', () => {
    const f = pruefe('ST2110-20', 'Eth-1G')
    expect(f).toHaveLength(1)
    expect(f[0].severity).toBe('warning')
    expect(f[0].equipmentId).toBe('sw')
    expect(f[0].message).toContain('2188')
    expect(f[0].message).toContain('1000')
  })

  it('laesst JPEG XS an derselben Buchse durch', () => {
    expect(pruefe('ST2110-22', 'Eth-1G')).toHaveLength(0)
  })

  it('laesst 2110-20 an einer 10G-Buchse durch', () => {
    expect(pruefe('ST2110-20', 'Eth-10G')).toHaveLength(0)
  })

  it('schweigt, wenn die Buchse keine Geschwindigkeit nennt', () => {
    expect(pruefe('ST2110-20')).toHaveLength(0)
  })
})
