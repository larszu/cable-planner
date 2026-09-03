import { describe, expect, it } from 'vitest'
import { buildSourceMap } from '/home/user/cable-planner/src/renderer/lib/sourceMap'
import { buildTallyMap } from '/home/user/cable-planner/src/renderer/lib/tallyMap'
import type { Cable } from '/home/user/cable-planner/src/renderer/types/cable'
import type { EquipmentItem, Port } from '/home/user/cable-planner/src/renderer/types/equipment'

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id, name, type: 'BNC', connectorType: 'BNC', ...over,
})
const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1', name: 'Gerät', category: 'Video', inputs: [], outputs: [],
  x: 0, y: 0, width: 200, height: 160, ...over,
})
const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`, name: 'c', type: 'BNC', length: 10, color: '#fff',
  fromEquipmentId: from[0], fromPortId: from[1], toEquipmentId: to[0], toPortId: to[1], notes: '',
})

const scene = () => ({
  equipment: [
    eq({ id: 'atem', name: 'ATEM Mini Extreme', inputs: [
      port('in1', 'In 1', { contentLabel: 'Kamera 1 Haupt' }),
      port('in2', 'In 2', { contentLabel: 'Kamera 1 Backup' }),
    ]}),
    eq({ id: 'camA', name: 'URSA A', category: 'Kameras', outputs: [port('a-out', 'SDI Out')], sourceIdentityId: 'r1' }),
    eq({ id: 'camB', name: 'URSA B', category: 'Kameras', outputs: [port('b-out', 'SDI Out')], sourceIdentityId: 'r1' }),
  ],
  cables: [cable(['camA','a-out'],['atem','in1']), cable(['camB','b-out'],['atem','in2'])],
  sourceIdentities: [{ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 3 }],
})

describe('haupt/backup', () => {
  it('dump', () => {
    const map = buildSourceMap(scene(), { appVersion: '1', exportedAt: 'x' })
    console.log('BINDINGS', JSON.stringify(map.sources[0].bindings))
    console.log('LABELS', JSON.stringify(map.sources[0].labels))
    console.log('UNRESOLVED', JSON.stringify(map.unresolved))
    const tm = buildTallyMap(scene() as never)
    console.log('TALLY ISSUES', JSON.stringify(tm.issues))
    console.log('TALLY ROWS', JSON.stringify(tm.rows))
  })
  it('reversed equipment order', () => {
    const s = scene()
    const t = s.equipment[1]; s.equipment[1] = s.equipment[2]; s.equipment[2] = t
    const map = buildSourceMap(s, { appVersion: '1', exportedAt: 'x' })
    console.log('LABELS-REVERSED', JSON.stringify(map.sources[0].labels))
  })
})
