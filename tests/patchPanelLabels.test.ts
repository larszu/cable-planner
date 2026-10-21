import { describe, expect, it } from 'vitest'
import {
  buildPanelLabelHtml,
  labelCrossCheck,
  panelLabelRows,
  panelLabelSheets,
} from '../src/renderer/lib/patchPanelLabels'
import { buildLabelCsv } from '../src/renderer/lib/labelPrinterCsv'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const port = (id: string, name: string, connectorType = 'Ethernet/RJ45') =>
  ({ id, name, type: 'network', connectorType }) as never

const geraet = (over: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({ category: 'Network', inputs: [], outputs: [], x: 0, y: 0, width: 100, height: 60, ...over }) as EquipmentItem

const panel = (id: string, n: number, over: Partial<EquipmentItem> = {}) =>
  geraet({
    id,
    name: id.toUpperCase(),
    isPatchPanel: true,
    inputs: Array.from({ length: n }, (_, i) => port(`${id}-f${i + 1}`, `F${i + 1}`)),
    outputs: Array.from({ length: n }, (_, i) => port(`${id}-r${i + 1}`, `R${i + 1}`)),
    ...over,
  })

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    name: id,
    type: 'Cat6',
    length: 5,
    color: '#fff',
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    notes: '',
  }) as Cable

const cam = geraet({ id: 'cam', name: 'Cam 1', inputs: [port('cam-lan', 'LAN')] })
const sw = geraet({
  id: 'sw',
  name: 'Switch',
  category: 'Netzwerk',
  rackInstanceId: 'r1',
  inputs: Array.from({ length: 8 }, (_, i) => port(`sw-${i + 1}`, `P${i + 1}`)),
})

describe('#999 patch panel labels', () => {
  it('labels a position with the device behind the rear side and splits strips by template', () => {
    const pp = panel('pp', 30, { rackInstanceId: 'r1', rackInstanceLabel: 'Rack A', rackInstanceStartUnit: 3 })
    const cables = [kabel('k1', ['pp', 'pp-r2'], ['cam', 'cam-lan']), kabel('k2', ['sw', 'sw-1'], ['pp', 'pp-f2'])]
    const [s] = panelLabelSheets([pp, cam, sw], cables)
    expect(s.template.id).toBe('rj45-24')
    expect(s.strips.map((x) => x.length)).toEqual([24, 6])
    expect(s.strips[0][1].text).toBe('Cam 1 LAN')
    expect(s.strips[0][0].text).toBe('')
    expect(panelLabelRows([s])).toEqual([{ label1: 'PP 2', label2: 'Cam 1 LAN' }])
    const html = buildPanelLabelHtml('Test', [s])
    expect(html).toContain('Cam 1 LAN')
    expect(html).toContain('Rack A')
  })

  it('uses the D-series strip for non-RJ45 panels', () => {
    const bnc = geraet({
      id: 'b',
      name: 'BNC',
      isPatchPanel: true,
      inputs: [port('b-f1', '1', 'BNC')],
      outputs: [port('b-r1', '1', 'BNC')],
    })
    expect(panelLabelSheets([bnc], [])[0].template.id).toBe('d-16')
  })

  it('reuses the two-line label CSV format', () => {
    const f = buildLabelCsv([{ label1: 'PP 2', label2: 'Cam 1 LAN' }], 'brother')
    expect(f.ext).toBe('txt')
    expect(f.body.split('\r\n')).toEqual(['Label1\tLabel2\tLength\tColor', 'PP 2\tCam 1 LAN\t\t'])
  })

  it('cross-checks against rack builder and panel builder', () => {
    const loose = panel('loose', 4)
    const odd = geraet({
      id: 'odd',
      name: 'ODD',
      isPatchPanel: true,
      rackInstanceId: 'r1',
      inputs: [port('o1', '1'), port('o2', '2')],
      outputs: [port('o3', '1')],
    })
    const inRack = panel('pp', 4, { rackInstanceId: 'r1' })
    const blank = geraet({ id: 'b', name: 'Blank', inputs: [port('b1', 'X', 'Blanking Panel')] })
    const cables = [kabel('k1', ['sw', 'sw-1'], ['cam', 'cam-lan']), kabel('k2', ['pp', 'pp-f1'], ['b', 'b1'])]
    const kinds = labelCrossCheck([loose, odd, inRack, blank, sw, cam], cables).map((i) => `${i.kind}:${i.device}`)
    expect(kinds).toContain('panelNotInRack:LOOSE')
    expect(kinds).toContain('panelWithoutLabels:LOOSE')
    expect(kinds).toContain('sidesMismatch:ODD')
    expect(kinds).toContain('blankCabled:Blank')
    expect(kinds).toContain('portWithoutPanel:Switch')
    expect(kinds).not.toContain('panelNotInRack:PP')
  })
})
