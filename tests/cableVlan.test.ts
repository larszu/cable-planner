import { describe, expect, it } from 'vitest'
import { cableVlan, cableVlanLabel } from '../src/renderer/lib/cableVlan'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const geraet = (id: string, extra: Partial<EquipmentItem>) => ({ id, name: id, ports: [], ...extra }) as unknown as EquipmentItem
const kabel = { fromEquipmentId: 'sw', fromPortId: 'p1', toEquipmentId: 'cam', toPortId: 'net' }

describe('#1203 cableVlan', () => {
  it('nimmt das untagged VLAN des Switch-Ports', () => {
    const m = new Map([['sw', geraet('sw', { portVlans: { p1: { untagged: 20 } } })], ['cam', geraet('cam', {})]])
    expect(cableVlan(kabel, m)).toEqual({ kind: 'access', vlanId: 20 })
    expect(cableVlanLabel(cableVlan(kabel, m), [{ vlanId: 20, name: 'Dante', purpose: 'unspecified' }])).toBe('VLAN 20 Dante')
  })
  it('getaggte VLANs ergeben einen Trunk', () => {
    const m = new Map([['sw', geraet('sw', { portVlans: { p1: { untagged: 1, tagged: '10, 20' } } })]])
    expect(cableVlan(kabel, m)).toEqual({ kind: 'trunk', vlanIds: [1, 10, 20] })
  })
  it('ohne Angabe: null', () => {
    expect(cableVlan(kabel, new Map())).toBeNull()
    expect(cableVlanLabel(null, [])).toBe('')
  })
})
