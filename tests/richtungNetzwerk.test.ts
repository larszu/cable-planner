/**
 * #1219 — Switch auf Patchblende: beide Ports RJ45 mit Richtung "auto"
 * wurden als Ausgang→Ausgang abgelehnt, und es gab keinen Weg, die
 * Verbindung trotzdem anzulegen.
 */
import { describe, expect, it } from 'vitest'
import { useUiStore } from '../src/renderer/store/uiStore'
import { richteVerbindungAus } from '../src/renderer/lib/connectionDirection'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, connectorType: string, direction?: Port['direction']): Port => ({
  id,
  name: id,
  originalName: id,
  type: connectorType as Port['type'],
  connectorType: connectorType as Port['connectorType'],
  ...(direction ? { direction } : {}),
})

const geraet = (id: string, outputs: Port[]): EquipmentItem => ({
  id,
  name: id,
  type: 'Device',
  category: 'Network',
  x: 0,
  y: 0,
  inputs: [],
  outputs,
})

const verb = (source: string, target: string) => ({
  source,
  sourceHandle: 'p1',
  target,
  targetHandle: 'p1',
})

describe('#1219 — Richtung von Netzwerk-Ports', () => {
  const sw = geraet('switch', [port('p1', 'RJ45')])
  const patch = geraet('patch', [port('p1', 'RJ45')])
  const lc = geraet('lc', [port('p1', 'Fiber Optic LC')])
  const sdiA = geraet('sdi-a', [port('p1', 'BNC')])
  const sdiB = geraet('sdi-b', [port('p1', 'BNC')])
  const rausA = geraet('raus-a', [port('p1', 'RJ45', 'out')])
  const rausB = geraet('raus-b', [port('p1', 'RJ45', 'out')])

  it('RJ45 auf RJ45 mit Richtung "auto" verbindet', () => {
    expect(richteVerbindungAus([sw, patch], verb('switch', 'patch')).ok).toBe(true)
  })

  it('Glasfaser gilt ebenso als richtungslos', () => {
    expect(richteVerbindungAus([sw, lc], verb('lc', 'switch')).ok).toBe(true)
  })

  it('BNC-Ausgang auf BNC-Ausgang bleibt abgelehnt', () => {
    expect(richteVerbindungAus([sdiA, sdiB], verb('sdi-a', 'sdi-b'))).toEqual({
      ok: false,
      grund: 'outputToOutput',
    })
  })

  it('eine ausdrueckliche Richtung am Port gewinnt', () => {
    expect(richteVerbindungAus([rausA, rausB], verb('raus-a', 'raus-b')).ok).toBe(false)
  })

  it('"Verbindungswarnungen uebergehen" laesst auch Ausgang→Ausgang zu', () => {
    useUiStore.setState({ overrideConnectionWarnings: true })
    try {
      const c = verb('sdi-a', 'sdi-b')
      expect(richteVerbindungAus([sdiA, sdiB], c)).toEqual({ ok: true, connection: c, umgedreht: false })
    } finally {
      useUiStore.setState({ overrideConnectionWarnings: false })
    }
  })
})
