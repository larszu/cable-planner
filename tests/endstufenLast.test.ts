import { describe, expect, it } from 'vitest'
import { pruefeEndstufen } from '../src/renderer/lib/endstufenLast'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

const port = (id: string) => ({ id, name: id, type: 'Speaker', connectorType: 'speakON 4 Pole' as const })
const geraet = (id: string, props: Record<string, string | number>, ins: string[] = [], outs: string[] = []): EquipmentItem =>
  ({ id, name: id, category: 'Audio', x: 0, y: 0, width: 100, height: 100, inputs: ins.map(port), outputs: outs.map(port), categoryProps: props }) as EquipmentItem
const kabel = (id: string, a: string, ap: string, b: string, bp: string) =>
  ({ id, fromEquipmentId: a, fromPortId: ap, toEquipmentId: b, toPortId: bp }) as Cable

const amp = geraet('Amp', { audioType: 'amp', minLoadOhm: 4, powerPerChannelW: 1200 }, [], ['A', 'B'])
const box = (id: string, z = 8, rms = 300) => geraet(id, { audioType: 'speaker', impedanceOhm: z, powerRmsW: rms }, ['in'], ['link'])

describe('Endstufenlast (#1206)', () => {
  it('zwei 8-Ohm-Boxen an einem Kanal sind 4 Ohm und in Ordnung', () => {
    const b = pruefeEndstufen([amp, box('L1'), box('L2')], [kabel('c1', 'Amp', 'A', 'L1', 'in'), kabel('c2', 'L1', 'link', 'L2', 'in')])
    expect(b.filter((x) => x.art === 'unterlast')).toEqual([])
  })

  it('drei 8-Ohm-Boxen durchgeschleift unterschreiten 4 Ohm', () => {
    const b = pruefeEndstufen(
      [amp, box('L1'), box('L2'), box('L3')],
      [kabel('c1', 'Amp', 'A', 'L1', 'in'), kabel('c2', 'L1', 'link', 'L2', 'in'), kabel('c3', 'L2', 'link', 'L3', 'in')],
    )
    const u = b.find((x) => x.art === 'unterlast')!
    expect(u.schwere).toBe('fehler')
    expect(u.werte).toMatchObject({ n: 3, last: '2.67', min: '4' })
  })

  it('der zweite Kanal zaehlt getrennt', () => {
    const b = pruefeEndstufen(
      [amp, box('L1'), box('L2'), box('L3')],
      [kabel('c1', 'Amp', 'A', 'L1', 'in'), kabel('c2', 'L1', 'link', 'L2', 'in'), kabel('c3', 'Amp', 'B', 'L3', 'in')],
    )
    expect(b.filter((x) => x.art === 'unterlast')).toEqual([])
  })

  it('warnt, wenn ein Lautsprecher mehr als das Doppelte seiner Belastbarkeit bekommt', () => {
    const b = pruefeEndstufen([amp, box('L1', 8, 250)], [kabel('c1', 'Amp', 'A', 'L1', 'in')])
    // 1200 W * 8/8 = 1200 W > 2 * 250 W
    expect(b.find((x) => x.art === 'ueberleistung')?.werte).toMatchObject({ speaker: 'L1', w: 1200, rms: 250 })
  })

  it('ohne Impedanz kein Urteil, aber ein Hinweis', () => {
    const ohne = geraet('X', { audioType: 'speaker' }, ['in'])
    const b = pruefeEndstufen([amp, ohne], [kabel('c1', 'Amp', 'A', 'X', 'in')])
    expect(b.map((x) => x.art)).toEqual(['impedanz-fehlt'])
  })
})
