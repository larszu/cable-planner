// #912 — Kabelenden mit Etage · Raum · Geraet · Port.
import { describe, expect, it } from 'vitest'
import { endeText, kabelEnden, ortText } from '../src/renderer/lib/kabelOrt'
import { buildPullListRows, cableScheduleTable } from '../src/renderer/lib/installerLists'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'

const port = (id: string, name: string) => ({ id, name, type: 'video', connectorType: 'BNC' }) as never
const geraet = (id: string, name: string, x: number, y: number, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name, category: 'Video', inputs: [], outputs: [], x, y, width: 100, height: 60, ...over }) as EquipmentItem
const rahmen = (id: string, name: string, x: number, floor?: string): LocationFrame => ({
  id, name, x, y: 0, width: 400, height: 400, color: '#38bdf8', ...(floor ? { floor } : {}),
})

const kamera = geraet('cam', 'CAM 3', 50, 50, { outputs: [port('cam-out', 'SDI Out')] })
const hub = geraet('hub', 'Videohub', 550, 50, { inputs: [port('hub-12', 'SDI 12')] })
const lose = geraet('lose', 'Monitor', 2000, 2000, { inputs: [port('mon-in', 'In')] })
const halle = rahmen('r1', 'Halle 3', 0, 'EG')
const regie = rahmen('r2', 'Regie', 500, '3.og')
const floors = [{ name: 'EG', elevationM: 0 }, { name: '3.OG', elevationM: 10.5 }]
const kabel = { fromEquipmentId: 'cam', fromPortId: 'cam-out', toEquipmentId: 'hub', toPortId: 'hub-12' }

describe('kabelEnden', () => {
  const ctx = { equipment: [kamera, hub, lose], locations: [halle, regie], floors }

  it('nennt Etage, Raum, Geraet und Port — die Etage in der Schreibweise der Liste', () => {
    const { von, nach } = kabelEnden(kabel, ctx)
    expect(endeText(von)).toBe('EG · Halle 3 · CAM 3 · SDI Out')
    expect(endeText(nach)).toBe('3.OG · Regie · Videohub · SDI 12')
  })

  it('ohne Rahmen bleibt nur Geraet und Port, ohne erfundenen Ort', () => {
    const { nach } = kabelEnden({ ...kabel, toEquipmentId: 'lose', toPortId: 'mon-in' }, ctx)
    expect(nach.raum).toBeUndefined()
    expect(nach.etage).toBeUndefined()
    expect(endeText(nach)).toBe('Monitor · In')
    expect(ortText(nach)).toBe('')
  })

  it('Rahmen ohne Etage: Raum ja, Etage nein', () => {
    const { von } = kabelEnden(kabel, { ...ctx, locations: [rahmen('r1', 'Halle 3', 0), regie] })
    expect(ortText(von)).toBe('Halle 3')
  })
})

describe('Ziehliste und Kabel-Schedule tragen Etage und Raum', () => {
  const projekt = {
    metadata: { name: 'T' },
    equipment: [kamera, hub],
    cables: [{ id: 'k1', name: 'k1', type: 'SDI', length: 30, color: '#fff', notes: '', ...kabel } as Cable],
    locations: [halle, regie],
    floors,
    canvasState: { x: 0, y: 0, zoom: 1 },
  } as unknown as CablePlannerProject

  it('Ziehliste', () => {
    const [r] = buildPullListRows(projekt)
    expect([r.fromFloor, r.fromRoom, r.toFloor, r.toRoom]).toEqual(['EG', 'Halle 3', '3.OG', 'Regie'])
  })

  it('Kabel-Schedule', () => {
    const { headers, rows } = cableScheduleTable(projekt)
    expect(rows[0][headers.indexOf('Nach Etage')]).toBe('3.OG')
    expect(rows[0][headers.indexOf('Von Raum')]).toBe('Halle 3')
  })
})
