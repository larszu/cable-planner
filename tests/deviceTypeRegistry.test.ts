import { describe, expect, it } from 'vitest'
import { resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import {
  detectDeviceKind,
  detectNetworkDevice,
  videohubPresetForDevice,
} from '../src/renderer/lib/deviceKind'
import { videohubPresets } from '../src/renderer/lib/exportVideohub'
import { CAMERA_CATALOG } from '../src/renderer/lib/cameraCatalog'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { GREENGO_CATALOG } from '../src/renderer/lib/greengoCatalog'
import { MONITOR_CATALOG } from '../src/renderer/lib/monitorCatalog'
import { UBIQUITI_CATALOG } from '../src/renderer/lib/ubiquitiCatalog'
import { MISC_CATALOG } from '../src/renderer/lib/miscCatalog'
import { AJA_CATALOG, matchAjaTemplate } from '../src/renderer/lib/ajaCatalog'
import { ROSS_CATALOG } from '../src/renderer/lib/rossCatalog'
import { LYNX_CATALOG, matchLynxTemplate } from '../src/renderer/lib/lynxCatalog'
import { SWITCHER_CATALOG } from '../src/renderer/lib/switcherCatalog'
import { AVNETWORK_CATALOG } from '../src/renderer/lib/avNetworkCatalog'
import { BROADCAST_TOOLS_CATALOG } from '../src/renderer/lib/broadcastToolsCatalog'
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
  ...AJA_CATALOG,
  ...ROSS_CATALOG,
  ...LYNX_CATALOG,
  ...SWITCHER_CATALOG,
  ...AVNETWORK_CATALOG,
  ...BROADCAST_TOOLS_CATALOG,
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

  it('AJA-KUMO-/Ross-Router bekommen KEINE videohub-Rolle (BMD-Protokoll)', () => {
    // Der Videohub-Export spricht das Blackmagic-Protokoll (Port 9990).
    // KUMO/Ultrix/NK sprechen es nicht — Rolle muss autoritativ null sein,
    // obwohl der Name/die Port-Struktur nach Router aussieht.
    const kumo = AJA_CATALOG.find((e) => e.template.name.includes('KUMO 3232-12G'))!
    const device = eq({
      name: 'AJA KUMO 3232-12G',
      deviceTypeId: kumo.deviceTypeId,
      inputs: kumo.template.inputs,
      outputs: kumo.template.outputs,
    })
    expect(detectDeviceKind(device)).toBeNull()
  })

  it('neue Kataloge matchen konservativ ueber Marken-Guard + Needles', () => {
    expect(matchAjaTemplate('AJA KUMO 1616-12G')?.name).toBe('AJA KUMO 1616-12G')
    // 12G-Variante darf NICHT auf das 3G-Basismodell fallen und umgekehrt.
    expect(matchAjaTemplate('AJA KUMO 1616')?.name).toBe('AJA KUMO 1616')
    // Lynx: CHD vs ORX teilen die Nummer 1802 — Kuerzel entscheidet.
    expect(matchLynxTemplate('LYNX yellobrik CHD 1802')?.name).toContain('CHD 1802')
    expect(matchLynxTemplate('LYNX yellobrik ORX 1802')?.name).toContain('ORX 1802')
    // Generische Namen ohne Marken-Keyword matchen nicht.
    expect(matchAjaTemplate('Irgendein 12G Router 3232')).toBeNull()
  })
})

describe('videohubPresetForDevice — kein Raten', () => {
  const presetKeys = new Set(videohubPresets.map((p) => p.key))

  it('jeder Katalog-Videohub verweist auf einen EXISTIERENDEN Preset-Key', () => {
    // Der alte guessVideohubPresetKey lieferte Keys, die es nicht gab
    // ('smart-40x40', 'universal-288x288') → stiller 16x16-Fallback.
    for (const e of BLACKMAGIC_CATALOG.filter((x) => x.kind === 'videohub')) {
      expect(e.videohubPresetKey, e.template.name).toBeTruthy()
      expect(presetKeys.has(e.videohubPresetKey!), `${e.template.name} → ${e.videohubPresetKey}`).toBe(true)
    }
  })

  it('ID → expliziter Katalog-Preset-Key (Datenblatt-Fakt)', () => {
    const vh288 = BLACKMAGIC_CATALOG.find((e) => e.template.name.includes('288'))!
    const r = videohubPresetForDevice(eq({ name: 'irgendwas', deviceTypeId: vh288.deviceTypeId }))
    expect(r.key).toBe('universal-master-288x288')
  })

  it('ohne ID → custom mit den ECHTEN BNC-Port-Zahlen (keine Schaetzung)', () => {
    const bnc = (n: string) => ({ id: n, name: n, type: 'BNC', connectorType: 'BNC' as const })
    const r = videohubPresetForDevice(
      eq({
        name: 'Fremder Video Router 40x40', // Regex haette frueher smart-40x40 geraten
        inputs: Array.from({ length: 34 }, (_, i) => bnc(`in${i}`)),
        outputs: Array.from({ length: 34 }, (_, i) => bnc(`out${i}`)),
      }),
    )
    expect(r).toEqual({ key: 'custom', customInputs: 34, customOutputs: 34 })
  })

  it('ohne ID und ohne BNC-Ports → custom 16/16 (klar editierbare Eigen-Groesse)', () => {
    const r = videohubPresetForDevice(eq({ name: 'Leergeraet' }))
    expect(r).toEqual({ key: 'custom', customInputs: 16, customOutputs: 16 })
  })
})
