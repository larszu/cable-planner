import { describe, expect, it } from 'vitest'
import { cableToAvPlan, parseAvPlan, makeAvPlan, AVPLAN_KIND, type AvVenue } from '../src/renderer/lib/avplan'

const venue: AvVenue = { name: 'Halle', widthM: 20, heightM: 12, persons: [], walls: [], stageObjects: [] }

describe('avplan (Cable — Slot "cabling")', () => {
  it('cableToAvPlan legt das Projekt in cabling, fremde Domaenen aus avForeign auf die Top-Ebene', () => {
    const project = {
      metadata: { name: 'Show' },
      equipment: [{ id: 'e1' }],
      avForeign: {
        venue,
        cameras: { cameras: [{ id: 'c1' }] },
        lighting: { fixtures: [{ id: 'f1', dimming: 0.8 }] },
      },
    }
    const avplan = cableToAvPlan(project, { appVersion: '8.2.0', exportedAt: 't' })
    expect(avplan.kind).toBe(AVPLAN_KIND)
    expect(avplan.app).toBe('cable-planner')
    // cabling-Slot = Projekt OHNE avForeign.
    expect((avplan.domains.cabling as { avForeign?: unknown }).avForeign).toBeUndefined()
    expect((avplan.domains.cabling as { equipment: unknown[] }).equipment).toHaveLength(1)
    // Fremde Domaenen verlustfrei oben.
    expect(avplan.venue).toEqual(venue)
    expect(avplan.domains.lighting).toEqual({ fixtures: [{ id: 'f1', dimming: 0.8 }] })
  })

  it('Passthrough: Cable bearbeitet cabling, Licht/Kamera kommen unveraendert zurueck', () => {
    const fromLight = makeAvPlan({
      app: 'light-planner', appVersion: '1.0.0', exportedAt: 't', venue,
      domains: { lighting: { fixtures: [{ id: 'f1', gelFilterIds: ['L201'] }] }, cameras: { cameras: [] } },
    })
    // Cable importiert -> bewahrt fremde Domaenen in project.avForeign.
    const loaded = parseAvPlan(JSON.stringify(fromLight))
    const projectAfterImport = {
      metadata: { name: 'X' }, equipment: [],
      avForeign: { venue: loaded.venue, cameras: loaded.domains.cameras, lighting: loaded.domains.lighting },
    }
    // ... bearbeitet seine Verkabelung und exportiert wieder.
    projectAfterImport.equipment.push({ id: 'atem' } as never)
    const reexported = cableToAvPlan(projectAfterImport, { appVersion: '8.2.0', exportedAt: 't2' })
    expect(reexported.domains.lighting).toEqual(fromLight.domains.lighting)
    expect((reexported.domains.cabling as { equipment: unknown[] }).equipment).toHaveLength(1)
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseAvPlan('{"kind":"cpviewer"}')).toThrow()
  })
})
