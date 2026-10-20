import { describe, expect, it, vi } from 'vitest'
import { fuehreSchreibwerkzeugAus, type Aktionen } from '../src/renderer/lib/mcpSchreiben'
import { beantworteWerkzeug } from '../src/renderer/lib/mcpWerkzeuge'
import type { CablePlannerProject } from '../src/renderer/types/project'

// ---------------------------------------------------------------------------
// #1065 Geraetefelder, #1066 Raeume und Etagen ueber MCP.
// Gemessen wird, WELCHE Store-Aktion mit welchen Werten laeuft.
// ---------------------------------------------------------------------------

const plan = (): CablePlannerProject =>
  ({
    metadata: { name: 'Haus' },
    equipment: [
      { id: 'cam', name: 'Kamera 1', x: 50, y: 50, width: 200, height: 100, inputs: [], outputs: [] },
      { id: 'sw', name: 'Switch', x: 1000, y: 1000, inputs: [], outputs: [] },
      { id: 'enc', name: 'Encoder', x: 1200, y: 1000, inputs: [], outputs: [] },
    ],
    cables: [],
    floors: [{ name: 'EG' }, { name: '1.OG', elevationM: 3.5 }],
    locations: [
      { id: 'r1', name: 'Regie', x: 0, y: 0, width: 400, height: 300, color: '#000', floor: 'EG' },
      { id: 'r2', name: 'Lager', x: 2000, y: 0, width: 300, height: 200, color: '#000', floor: 'EG' },
      { id: 'r3', name: 'Lager', x: 2500, y: 0, width: 300, height: 200, color: '#000', floor: '1.OG', moveContents: false },
    ],
  }) as unknown as CablePlannerProject

const aktionen = (p = plan()) => {
  const spy = {
    updateEquipment: vi.fn(),
    addKnownCategories: vi.fn(),
    addLocation: vi.fn((partial) => {
      p.locations = [...(p.locations ?? []), { id: 'neu', color: '#000', ...partial }]
    }),
    updateLocation: vi.fn(),
    deleteLocation: vi.fn(),
    moveLocationWithContents: vi.fn(),
    setFloors: vi.fn(),
    renameFloor: vi.fn(),
    aktuell: () => p,
  }
  return spy as unknown as Aktionen & typeof spy
}

describe('#1065 — set_device', () => {
  it('setzt IP, Maske, VLAN, Seriennummer und Notiz in einem Patch', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'set_device', {
      deviceId: 'Switch',
      ipAddress: '10.0.0.5',
      subnetMask: '255.255.255.0',
      managementVlanId: 20,
      serialNumber: 'SN-1',
      notes: 'Patchfeld 3',
    })
    expect(r.ok).toBe(true)
    expect(a.updateEquipment).toHaveBeenCalledWith('sw', {
      ipAddress: '10.0.0.5',
      subnetMask: '255.255.255.0',
      managementVlanId: 20,
      serialNumber: 'SN-1',
      notes: 'Patchfeld 3',
    })
  })

  it('lehnt eine ungueltige IP mit Begruendung ab', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'set_device', { deviceId: 'sw', ipAddress: '10.0.0.300' })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('IPv4')
    expect(a.updateEquipment).not.toHaveBeenCalled()
  })

  it('lehnt eine nicht zusammenhaengende Maske ab', () => {
    const r = fuehreSchreibwerkzeugAus(plan(), aktionen(), 'set_device', { deviceId: 'sw', subnetMask: '255.0.255.0' })
    expect(r.ok).toBe(false)
  })

  it('schreibt keine Zugangsdaten', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'set_device', { deviceId: 'sw', password: 'geheim' })
    expect(r.ok).toBe(false)
    expect(a.updateEquipment).not.toHaveBeenCalled()
  })

  it('lehnt ein unbekanntes Geraet und einen leeren Aufruf ab', () => {
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'set_device', { deviceId: 'Nix', notes: 'x' }).ok).toBe(false)
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'set_device', { deviceId: 'sw' }).ok).toBe(false)
  })

  it('leerer Text loescht das Feld', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_device', { deviceId: 'sw', ipAddress: '' })
    expect(a.updateEquipment).toHaveBeenCalledWith('sw', { ipAddress: undefined })
  })
})

describe('#1065 — set_devices', () => {
  it('wendet gueltige Zeilen an und meldet abgelehnte einzeln', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'set_devices', {
      devices: [
        { deviceId: 'Switch', ipAddress: '10.0.0.5' },
        { deviceId: 'Encoder', ipAddress: 'kaputt' },
        { deviceId: 'Kamera 1', serialNumber: 'C-7' },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.daten).toMatchObject({ updated: 2, refused: 1 })
    expect(a.updateEquipment).toHaveBeenCalledTimes(2)
  })

  it('ohne Liste kein Erfolg', () => {
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'set_devices', {}).ok).toBe(false)
  })
})

describe('#1066 — lesen', () => {
  it('list_locations nennt Etage und enthaltene Geraete', () => {
    const r = beantworteWerkzeug(plan(), 'list_locations')
    const regie = (r.daten.locations as Array<Record<string, unknown>>).find((l) => l.id === 'r1')
    expect(regie).toMatchObject({ name: 'Regie', floor: 'EG', devices: ['Kamera 1'] })
    expect(beantworteWerkzeug(plan(), 'list_locations', { floor: '1.og' }).daten.total).toBe(1)
  })

  it('list_floors meldet fehlende Hoehe als null', () => {
    const r = beantworteWerkzeug(plan(), 'list_floors')
    expect(r.daten.floors).toEqual([
      { name: 'EG', elevationM: null, rooms: 2 },
      { name: '1.OG', elevationM: 3.5, rooms: 1 },
    ])
  })

  it('list_devices zeigt die Raumzuordnung der Oberflaeche', () => {
    const r = beantworteWerkzeug(plan(), 'list_devices')
    const kamera = (r.daten.devices as Array<Record<string, unknown>>).find((d) => d.id === 'cam')
    expect(kamera?.location).toBe('Regie')
  })
})

describe('#1066 — Raeume', () => {
  it('create_location legt den Raum auf einer vorhandenen Etage an', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'create_location', { name: 'Technik', floor: '1.og' })
    expect(r.ok).toBe(true)
    expect(a.addLocation.mock.calls[0][0]).toMatchObject({ name: 'Technik', floor: '1.OG' })
  })

  it('create_location lehnt doppelten Namen und unbekannte Etage ab', () => {
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'create_location', { name: 'regie' }).ok).toBe(false)
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'create_location', { name: 'X', floor: '7.OG' }).ok).toBe(false)
  })

  it('ein doppelter Raumname wird abgelehnt statt geraten, die Id geht', () => {
    const r = fuehreSchreibwerkzeugAus(plan(), aktionen(), 'place_in_location', { locationId: 'Lager', deviceIds: ['sw'] })
    expect(r.ok).toBe(false)
    expect(r.text).toContain('pass the id')
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'place_in_location', { locationId: 'r2', deviceIds: ['sw'] }).ok).toBe(true)
  })

  it('set_location verschiebt mit Inhalt, wenn moveContents an ist', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_location', { locationId: 'Regie', x: 100, name: 'Bildregie' })
    expect(a.moveLocationWithContents).toHaveBeenCalledWith('r1', 100, 0, ['cam'])
    expect(a.updateLocation).toHaveBeenCalledWith('r1', { name: 'Bildregie' })
  })

  it('set_location verschiebt nur den Rahmen, wenn moveContents aus ist', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_location', { locationId: 'r3', y: 50 })
    expect(a.moveLocationWithContents).not.toHaveBeenCalled()
    expect(a.updateLocation).toHaveBeenCalledWith('r3', { x: 2500, y: 50 })
  })

  it('delete_location nimmt nur den Rahmen', () => {
    const a = aktionen()
    expect(fuehreSchreibwerkzeugAus(plan(), a, 'delete_location', { locationId: 'Regie' }).ok).toBe(true)
    expect(a.deleteLocation).toHaveBeenCalledWith('r1')
    expect(a.updateEquipment).not.toHaveBeenCalled()
  })

  it('place_in_location ordnet im Rahmen an und laesst ihn wachsen', () => {
    const a = aktionen()
    const r = fuehreSchreibwerkzeugAus(plan(), a, 'place_in_location', { locationId: 'r2', deviceIds: ['Switch', 'Encoder', 'Kamera 1'] })
    expect(r.ok).toBe(true)
    expect(a.updateEquipment).toHaveBeenCalledTimes(3)
    for (const [, pos] of a.updateEquipment.mock.calls) {
      expect(pos.x).toBeGreaterThanOrEqual(2000)
      expect(pos.y).toBeGreaterThanOrEqual(0)
    }
    expect(a.updateLocation).toHaveBeenCalled()
  })
})

describe('#1066 — Etagen', () => {
  it('create_floor haengt oben an und lehnt Doppelte ab', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'create_floor', { name: '2.OG', elevationM: 7 })
    expect(a.setFloors.mock.calls[0][0].at(-1)).toEqual({ name: '2.OG', elevationM: 7 })
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'create_floor', { name: 'eg' }).ok).toBe(false)
  })

  it('set_floor benennt um und verschmilzt keine Etagen', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_floor', { floor: 'EG', name: 'Erdgeschoss' })
    expect(a.renameFloor).toHaveBeenCalledWith('EG', 'Erdgeschoss')
    expect(fuehreSchreibwerkzeugAus(plan(), aktionen(), 'set_floor', { floor: 'EG', name: '1.og' }).ok).toBe(false)
  })

  it('set_floor setzt und loescht die Hoehe', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_floor', { floor: '1.OG', elevationM: null })
    expect(a.setFloors.mock.calls[0][0]).toEqual([{ name: 'EG' }, { name: '1.OG' }])
  })
})
