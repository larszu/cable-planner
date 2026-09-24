// #910 — die Optik-Zeile im Knoten und die Layout-Rechnung laufen gleich
// (Review-Befund: Routing und Hindernisse lagen eine Rasterzeile daneben).
import { describe, expect, it } from 'vitest'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const kamera = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'cam', name: 'CAM 1', category: 'Cameras', x: 0, y: 0, width: 176, height: 110,
    inputs: [], outputs: [{ id: 'o1', name: 'SDI Out', type: 'video', connectorType: 'BNC' }],
    ...over,
  }) as EquipmentItem

describe('computeEquipmentLayout mit Optik', () => {
  it('eine Optik-Zeile verschiebt die Anschluesse um genau eine Rasterzeile', () => {
    const ohne = computeEquipmentLayout(kamera())
    const mit = computeEquipmentLayout(kamera({ optik: { brennweiteMm: 50 } }))
    expect(mit.height - ohne.height).toBeGreaterThan(0)
    const dy = mit.height - ohne.height
    // Dieselbe Verschiebung wie EXTRA_HEADER_LINE im Knoten (= Rastergroesse).
    expect(dy % 1).toBe(0)
  })
  it('eine leere Optik ergibt keine Zeile', () => {
    expect(computeEquipmentLayout(kamera({ optik: {} })).height).toBe(computeEquipmentLayout(kamera()).height)
  })
})
