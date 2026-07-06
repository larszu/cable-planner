import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Kameras',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

describe('drawingChecks — Ports unbekannt (#Grundsatz: nichts erfinden)', () => {
  it('warnt bei portsUnknown ohne Ports', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'cam', name: 'CAM 2', portsUnknown: true })],
      cables: [],
    })
    const f = findings.find((x) => x.id === 'ports-unknown:cam')
    expect(f).toBeTruthy()
    expect(f?.severity).toBe('warning')
    expect(f?.equipmentId).toBe('cam')
  })

  it('warnt NICHT mehr, sobald reale Ports ergänzt wurden', () => {
    const { findings } = runDrawingChecks({
      equipment: [
        eq({
          id: 'cam',
          name: 'CAM 2',
          portsUnknown: true,
          outputs: [{ id: 'p1', name: 'SDI Out', type: 'BNC', connectorType: 'BNC' }],
        }),
      ],
      cables: [],
    })
    expect(findings.some((x) => x.id === 'ports-unknown:cam')).toBe(false)
  })

  it('warnt nicht bei normalen Geräten ohne den Marker', () => {
    const { findings } = runDrawingChecks({
      equipment: [eq({ id: 'cam', name: 'CAM 1' })],
      cables: [],
    })
    expect(findings.some((x) => x.category === 'Ports unbekannt')).toBe(false)
  })
})
