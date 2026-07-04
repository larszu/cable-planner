import { describe, expect, it } from 'vitest'
import { resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import { detectDeviceKind, detectNetworkDevice } from '../src/renderer/lib/deviceKind'
import { CAMERA_CATALOG } from '../src/renderer/lib/cameraCatalog'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { GREENGO_CATALOG } from '../src/renderer/lib/greengoCatalog'
import { MONITOR_CATALOG } from '../src/renderer/lib/monitorCatalog'
import { UBIQUITI_CATALOG } from '../src/renderer/lib/ubiquitiCatalog'
import { MISC_CATALOG } from '../src/renderer/lib/miscCatalog'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Geraet',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const ALL_CATALOGS = [
  ...CAMERA_CATALOG,
  ...BLACKMAGIC_CATALOG,
  ...GREENGO_CATALOG,
  ...MONITOR_CATALOG,
  ...UBIQUITI_CATALOG,
  ...MISC_CATALOG,
]

describe('deviceTypeRegistry (stabile GUID-Identitaet, GDTF-analog)', () => {
  it('alle Katalog-GUIDs sind eindeutig und wohlgeformt', () => {
    const ids = ALL_CATALOGS.map((e) => e.deviceTypeId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    }
  })

  it('loest jede Katalog-GUID auf ihr Template auf (mit deviceTypeId gestempelt)', () => {
    for (const entry of ALL_CATALOGS) {
      const info = resolveDeviceType(entry.deviceTypeId)
      expect(info, entry.template.name).toBeTruthy()
      expect(info?.template.name).toBe(entry.template.name)
      expect(info?.template.deviceTypeId).toBe(entry.deviceTypeId)
    }
  })

  it('unbekannte oder fehlende ID → null (kein Raten)', () => {
    expect(resolveDeviceType(undefined)).toBeNull()
    expect(resolveDeviceType('ffffffff-0000-0000-0000-000000000000')).toBeNull()
  })

  it('ATEM-/Videohub-Rollen kommen autoritativ aus dem Katalog', () => {
    const videohub = BLACKMAGIC_CATALOG.find((e) => e.kind === 'videohub')!
    const atem = BLACKMAGIC_CATALOG.find((e) => e.kind === 'atem')!
    expect(resolveDeviceType(videohub.deviceTypeId)?.kind).toBe('videohub')
    expect(resolveDeviceType(atem.deviceTypeId)?.kind).toBe('atem')
    // GreenGo: Rolle gilt katalogweit.
    expect(resolveDeviceType(GREENGO_CATALOG[0].deviceTypeId)?.kind).toBe('greengo')
  })
})

describe('detectDeviceKind / detectNetworkDevice — ID vor Heuristik', () => {
  it('ID-Aufloesung schlaegt die Namens-Heuristik', () => {
    const atem = BLACKMAGIC_CATALOG.find((e) => e.kind === 'atem')!
    // Name sagt "Videohub", die ID sagt autoritativ ATEM → ATEM gewinnt.
    const device = eq({ name: 'Videohub Umbenannt', deviceTypeId: atem.deviceTypeId })
    expect(detectDeviceKind(device)).toBe('atem')
  })

  it('bekannte ID ohne Spezial-Rolle → autoritativ null (keine Struktur-Heuristik)', () => {
    // Eine Kamera-GUID: viele BNC-Ports koennten die Heuristik zu 'videohub'
    // verleiten — die ID weiss es besser.
    const f55 = CAMERA_CATALOG[0]
    const device = eq({
      name: 'MV Rack Crossbar', // wuerde per Regex als multiviewer/videohub raten
      deviceTypeId: f55.deviceTypeId,
    })
    expect(detectDeviceKind(device)).toBeNull()
  })

  it('Switch/Router-Rolle kommt autoritativ aus dem Ubiquiti-Katalog', () => {
    const router = UBIQUITI_CATALOG.find((e) => e.networkKind === 'router')!
    const sw = UBIQUITI_CATALOG.find((e) => e.networkKind === 'switch')!
    expect(detectNetworkDevice(eq({ name: 'x', deviceTypeId: router.deviceTypeId }))).toBe('router')
    expect(detectNetworkDevice(eq({ name: 'x', deviceTypeId: sw.deviceTypeId }))).toBe('switch')
  })

  it('ohne ID greift weiter die Namens-Heuristik (Fallback unveraendert)', () => {
    expect(detectDeviceKind(eq({ name: 'ATEM Constellation 8K' }))).toBe('atem')
    expect(detectNetworkDevice(eq({ name: 'EdgeRouter 4', category: 'Netzwerk' }))).toBe('router')
  })
})
