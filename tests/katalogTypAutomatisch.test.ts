import { describe, expect, it } from 'vitest'
import {
  eindeutigerKatalogTyp,
  katalogTypKandidaten,
  katalogTypVorschlaege,
  mitKatalogTyp,
} from '../src/renderer/lib/deviceTypeMatch'
import { listDeviceTypes, resolveDeviceType } from '../src/renderer/lib/deviceTypeRegistry'
import { LEGACY_TEMPLATE_RENAMES } from '../src/renderer/lib/templateRenames'
import { erfasstesGeraet } from '../src/renderer/lib/erfassung'
import { useProjectStore } from '../src/renderer/store/projectStore'

// ---------------------------------------------------------------------------
// Nutzer-Meldung 2026-09-28: „was soll 'katalog typ' bedeuten? ist das nicht
// automatisch?" — Der Typ wird jetzt vergeben, wenn der Name EINDEUTIG ist,
// und nie geraten, wenn er es nicht ist.
// ---------------------------------------------------------------------------

const nameVon = (id: string | undefined) => resolveDeviceType(id)?.template.name

describe('Katalog-Typ aus dem Namen', () => {
  it('trifft jeden Katalog-Eintrag ueber seinen eigenen Namen genau einmal', () => {
    // Der Test, der eine neue Doppelung im Katalog meldet, bevor sie die
    // Automatik still abschaltet.
    for (const t of listDeviceTypes()) {
      expect(katalogTypKandidaten({ name: t.name }), t.name).toEqual([t.id])
    }
  })

  it('erkennt Schreibweise, Herstellerwort und Artikelnummer', () => {
    expect(nameVon(eindeutigerKatalogTyp({ name: 'atem mini pro' }))).toBe('Blackmagic ATEM Mini Pro')
    expect(nameVon(eindeutigerKatalogTyp({ name: 'Blackmagic Design ATEM Mini Pro' }))).toBe('Blackmagic ATEM Mini Pro')
    expect(nameVon(eindeutigerKatalogTyp({ name: 'USW-16-PoE' }))).toBe('UniFi Switch 16 PoE (USW-16-PoE)')
    expect(nameVon(eindeutigerKatalogTyp({ manufacturer: 'Blackmagic Design', model: 'ATEM Mini Pro' }))).toBe(
      'Blackmagic ATEM Mini Pro',
    )
  })

  it('haelt „Ninja V" und „Ninja V+" auseinander', () => {
    expect(nameVon(eindeutigerKatalogTyp({ name: 'Atomos Ninja V' }))).toBe('Atomos Ninja V')
    expect(nameVon(eindeutigerKatalogTyp({ name: 'Atomos Ninja V+' }))).toBe('Atomos Ninja V+')
  })

  it('loest alte Vorlagennamen ueber LEGACY_TEMPLATE_RENAMES auf', () => {
    const katalog = new Set(listDeviceTypes().map((t) => t.name))
    for (const [alt, neu] of Object.entries(LEGACY_TEMPLATE_RENAMES)) {
      if (!katalog.has(neu)) continue
      expect(nameVon(eindeutigerKatalogTyp({ name: alt })), alt).toBe(neu)
    }
  })

  it('raet nicht: Teilstrings und Allerweltswoerter bleiben ohne Typ', () => {
    expect(eindeutigerKatalogTyp({ name: 'Monitor' })).toBeUndefined()
    expect(eindeutigerKatalogTyp({ name: 'Cam 1 URSA Mini Pro 12K' })).toBeUndefined()
    expect(eindeutigerKatalogTyp({ name: 'Pro' })).toBeUndefined()
  })

  it('bietet Teilstring-Treffer nur als Vorschlag an', () => {
    const v = katalogTypVorschlaege({ name: 'Cam 1 URSA Mini Pro 12K' }).map((x) => x.name)
    expect(v[0]).toBe('Blackmagic URSA Mini Pro 12K')
  })

  it('ueberschreibt einen vorhandenen Typ nie und laesst Ports stehen', () => {
    const item = { name: 'ATEM Mini Pro', deviceTypeId: 'eigene-id', inputs: [], outputs: [] }
    expect(mitKatalogTyp(item)).toBe(item)
    const ohne = { name: 'ATEM Mini Pro', inputs: [{ id: 'x' }], outputs: [] }
    const mit = mitKatalogTyp(ohne)
    expect(mit.inputs).toBe(ohne.inputs)
    expect(nameVon(mit.deviceTypeId)).toBe('Blackmagic ATEM Mini Pro')
  })

  it('nimmt den Untertitel, wenn der Name ein Standortname ist', () => {
    expect(nameVon(mitKatalogTyp({ name: 'Cam 3', subtitle: 'Sony FX6' }).deviceTypeId)).toBe('Sony FX6')
  })
})

describe('Katalog-Typ auf allen Wegen ins Projekt', () => {
  const basis = { category: 'Other', inputs: [], outputs: [], x: 0, y: 0, width: 200, height: 100 }

  it('beim Anlegen von Hand', () => {
    useProjectStore.getState().addEquipment({ ...basis, name: 'Sony FX6' })
    const g = useProjectStore.getState().project.equipment.at(-1)!
    expect(nameVon(g.deviceTypeId)).toBe('Sony FX6')
  })

  it('beim Import', () => {
    useProjectStore.getState().importEquipment([{ ...basis, id: 'imp-1', name: 'ATEM Mini Pro' }])
    const g = useProjectStore.getState().project.equipment.find((e) => e.id === 'imp-1')!
    expect(nameVon(g.deviceTypeId)).toBe('Blackmagic ATEM Mini Pro')
  })

  it('bei der Bestandsaufnahme', () => {
    const g = erfasstesGeraet({ name: 'Sony FX6' }, { x: 0, y: 0 }, {
      am: '2026-09-28',
      quelle: 'planer',
      label: { raum: 'Raum', verbindung: 'Verbindung' },
    })
    expect(nameVon(g?.deviceTypeId)).toBe('Sony FX6')
  })

  it('beim Laden eines alten Projekts', () => {
    useProjectStore.getState().loadProject({
      ...useProjectStore.getState().project,
      equipment: [{ ...basis, id: 'alt-1', name: 'Blackmagic ATEM Mini Pro' }],
      cables: [],
    })
    const g = useProjectStore.getState().project.equipment.find((e) => e.id === 'alt-1')!
    expect(nameVon(g.deviceTypeId)).toBe('Blackmagic ATEM Mini Pro')
  })
})
