import { describe, expect, it } from 'vitest'
import { portAmKoerper } from '../src/renderer/lib/portAmKoerper'
import { listDeviceTypes } from '../src/renderer/lib/deviceTypeRegistry'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Ein Geraet mit nur einem Namen muss sich verkabeln lassen (2026-09-28).
const geraet = (over: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: 'g', name: 'Neu', category: 'Other', inputs: [], outputs: [], x: 0, y: 0, width: 240, height: 80, ...over,
})
const sdi = { connectorType: 'BNC' as const, type: 'SDI' }

describe('Kabel auf den Geraetekoerper', () => {
  it('legt am Geraet ohne Ports einen Eingang mit dem Stecker der Quelle an', () => {
    const r = portAmKoerper(geraet({ portsUnknown: true }), 'input', sdi)!
    expect(r.patch.inputs).toHaveLength(1)
    expect(r.patch.inputs![0]).toMatchObject({ id: r.portId, name: 'In 1', connectorType: 'BNC', type: 'SDI' })
    expect('portsUnknown' in r.patch && r.patch.portsUnknown === undefined).toBe(true)
  })

  it('zaehlt weiter und haengt Ausgaenge an', () => {
    const r = portAmKoerper(geraet({ outputs: [{ id: 'o', name: 'Out 1', type: 'SDI', connectorType: 'BNC' }] }), 'output', sdi)!
    expect(r.patch.outputs!.map((p) => p.name)).toEqual(['Out 1', 'Out 2'])
  })

  it('erfindet an einem Katalog-Geraet keine Buchse', () => {
    const id = listDeviceTypes()[0].id
    expect(portAmKoerper(geraet({ deviceTypeId: id }), 'input', sdi)).toBeNull()
  })

  it('erweitert eine eigene Vorlage mit selbst geminter Id', () => {
    expect(portAmKoerper(geraet({ deviceTypeId: '00000000-0000-4000-8000-000000000000' }), 'input', sdi)).not.toBeNull()
  })
})
