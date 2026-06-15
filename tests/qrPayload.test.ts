import { describe, it, expect } from 'vitest'
import {
  buildQrPayload,
  parseQrPayload,
  lookupQrRef,
} from '../src/renderer/lib/qrPayload'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const cable = (over: Partial<Cable> = {}): Cable =>
  ({
    id: 'cab-uuid-1',
    name: 'Kabel',
    type: 'BNC' as Cable['type'],
    length: 1,
    color: '#000',
    fromEquipmentId: 'e1',
    fromPortId: 'p1',
    toEquipmentId: 'e2',
    toPortId: 'p2',
    qrId: 'C-0001',
    cableNumber: 'CBL-7',
    ...over,
  }) as Cable

const equip = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'eq-uuid-1',
    name: 'ATEM',
    category: 'mixer',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    qrId: 'A-0001',
    assetTag: 'INV-42',
    ...over,
  }) as EquipmentItem

describe('buildQrPayload / parseQrPayload roundtrip', () => {
  it('baut eine cableplanner-URI und parst sie zurück', () => {
    const payload = buildQrPayload('cable', 'C-0001', 'ATEM OUT 1 → PROJ IN 1')
    expect(payload).toBe('cableplanner://cable/C-0001?l=ATEM%20OUT%201%20%E2%86%92%20PROJ%20IN%201')
    const ref = parseQrPayload(payload)
    expect(ref).toEqual({ kind: 'cable', id: 'C-0001', label: 'ATEM OUT 1 → PROJ IN 1' })
  })

  it('parst Equipment-URIs', () => {
    expect(parseQrPayload('cableplanner://equipment/A-0007?l=Rack')).toEqual({
      kind: 'equipment',
      id: 'A-0007',
      label: 'Rack',
    })
  })

  it('parst Deep-Links aus Hash und ?lookup=', () => {
    expect(parseQrPayload('https://host/mobile.html#cable/C-0009')).toMatchObject({
      kind: 'cable',
      id: 'C-0009',
    })
    expect(parseQrPayload('http://x/?lookup=equipment/A-0003')).toMatchObject({
      kind: 'equipment',
      id: 'A-0003',
    })
  })

  it('parst die nackte kind/id-Form (Deep-Link ohne Präfix)', () => {
    expect(parseQrPayload('cable/C-0001')).toMatchObject({ kind: 'cable', id: 'C-0001' })
    expect(parseQrPayload('equipment/A-9')).toMatchObject({ kind: 'equipment', id: 'A-9' })
  })

  it('leitet die Sorte aus nackten Doc-IDs ab', () => {
    expect(parseQrPayload('C-0001')).toEqual({ kind: 'cable', id: 'C-0001' })
    expect(parseQrPayload('a-0002')).toEqual({ kind: 'equipment', id: 'a-0002' })
  })

  it('behandelt Freitext als ID ohne Sorte', () => {
    expect(parseQrPayload('CBL-7')).toEqual({ id: 'CBL-7' })
    expect(parseQrPayload('   ')).toBeNull()
  })
})

describe('lookupQrRef', () => {
  const cables = [cable(), cable({ id: 'cab-2', qrId: 'C-0002', cableNumber: 'CBL-9' })]
  const equipment = [equip(), equip({ id: 'eq-2', qrId: 'A-0002', assetTag: 'INV-99' })]

  it('findet Kabel über qrId', () => {
    const m = lookupQrRef({ kind: 'cable', id: 'C-0002' }, cables, equipment)
    expect(m).toMatchObject({ kind: 'cable', item: { id: 'cab-2' } })
  })

  it('findet Kabel über cableNumber (Freitext-Scan)', () => {
    const m = lookupQrRef(parseQrPayload('CBL-9')!, cables, equipment)
    expect(m).toMatchObject({ kind: 'cable', item: { id: 'cab-2' } })
  })

  it('findet Gerät über assetTag', () => {
    const m = lookupQrRef({ id: 'INV-99' }, cables, equipment)
    expect(m).toMatchObject({ kind: 'equipment', item: { id: 'eq-2' } })
  })

  it('respektiert die Sorte (equipment-Ref findet kein Kabel)', () => {
    expect(lookupQrRef({ kind: 'equipment', id: 'C-0001' }, cables, equipment)).toBeNull()
  })

  it('liefert null bei keinem Treffer', () => {
    expect(lookupQrRef({ id: 'nope' }, cables, equipment)).toBeNull()
  })
})
