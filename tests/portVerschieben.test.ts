import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { listenZiel, verschiebePort } from '../src/renderer/lib/portVerschieben'
import type { Port } from '../src/renderer/types/equipment'

const p = (id: string, extra: Partial<Port> = {}): Port => ({ id, name: id, type: 'BNC', connectorType: 'BNC', ...extra })
const listen = () => ({ inputs: [p('i1'), p('i2'), p('i3')], outputs: [p('o1'), p('o2')] })
const ids = (l: { inputs: Port[]; outputs: Port[] } | null) =>
  l && { in: l.inputs.map((x) => x.id), out: l.outputs.map((x) => x.id) }

describe('Ports zwischen Eingaengen und Ausgaengen ziehen (#1220)', () => {
  it('ordnet innerhalb einer Liste wie bisher', () => {
    expect(ids(verschiebePort(listen(), 'i1', 'i3'))).toEqual({ in: ['i2', 'i3', 'i1'], out: ['o1', 'o2'] })
    expect(ids(verschiebePort(listen(), 'i3', 'i1'))).toEqual({ in: ['i3', 'i1', 'i2'], out: ['o1', 'o2'] })
  })

  it('setzt einen Eingang vor den Ausgang, auf den er fällt', () => {
    expect(ids(verschiebePort(listen(), 'i2', 'o2'))).toEqual({ in: ['i1', 'i3'], out: ['o1', 'i2', 'o2'] })
  })

  it('auf die Liste selbst: ans Ende — auch in eine leere', () => {
    expect(ids(verschiebePort(listen(), 'o1', listenZiel('in')))).toEqual({ in: ['i1', 'i2', 'i3', 'o1'], out: ['o2'] })
    const leer = { inputs: [p('i1')], outputs: [] }
    expect(ids(verschiebePort(leer, 'i1', listenZiel('out')))).toEqual({ in: [], out: ['i1'] })
  })

  it('behält die Id (Kabel bleiben dran) und alle Eigenschaften', () => {
    const l = { inputs: [p('i1', { standard: '12G-SDI' as never, contentLabel: 'PGM' })], outputs: [] }
    const neu = verschiebePort(l, 'i1', listenZiel('out'))!
    expect(neu.outputs[0]).toMatchObject({ id: 'i1', standard: '12G-SDI', contentLabel: 'PGM' })
  })

  it('eine widersprechende Richtung fällt weg, bidirektional bleibt', () => {
    const l = { inputs: [p('a', { direction: 'in' }), p('b', { direction: 'bidirectional' })], outputs: [] }
    expect(verschiebePort(l, 'a', listenZiel('out'))!.outputs[0].direction).toBeUndefined()
    expect(verschiebePort(l, 'b', listenZiel('out'))!.outputs[0].direction).toBe('bidirectional')
  })

  it('nichts zu tun: null', () => {
    expect(verschiebePort(listen(), 'i1', 'i1')).toBeNull()
    expect(verschiebePort(listen(), 'i3', listenZiel('in'))).toBeNull()
    expect(verschiebePort(listen(), 'x', 'o1')).toBeNull()
  })

  it('Geraete- und Vorlagen-Inspector teilen EINEN Zieh-Kontext fuer beide Listen', () => {
    for (const f of ['sections/PortsSection.tsx', 'TemplateProperties.tsx']) {
      const src = readFileSync(`src/renderer/components/Properties/${f}`, 'utf8')
      expect(src).toMatch(/usePortZiehen\(/)
      expect(src).toMatch(/seite="in"/)
      expect(src).toMatch(/seite="out"/)
    }
    expect(readFileSync('src/renderer/components/Properties/PortList.tsx', 'utf8')).not.toMatch(/<DndContext/)
  })
})
