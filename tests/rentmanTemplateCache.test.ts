import { beforeEach, describe, expect, it } from 'vitest'
import {
  getCachedRentmanTemplate,
  upsertCachedRentmanTemplate,
} from '../src/renderer/lib/rentmanTemplateCache'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'

// ADR-005 (Verlustfrei oder laut), Inkrement 3.
//
// Drei Funktionen bauen hier ein Template aus einem EquipmentItem, und ihre
// Feldmengen sind ineinander geschachtelt: der Cache nennt 37, das
// templateSlice 23, der Heal-Zweig 15 — ohne dass eine der kleineren etwas
// wuesste, das die groesste nicht auch weiss.
//
// Solange `upsertCachedRentmanTemplate` den Eintrag ERSETZTE, gewann damit
// immer die aermste Rekonstruktion, die zuletzt vorbeikam. Der Cache ist
// projektuebergreifend; was hier faellt, faellt fuer alle Projekte.

const tpl = (over: Partial<EquipmentTemplate>): EquipmentTemplate =>
  ({ name: 'ATEM 4 M/E', category: 'Video', ...over }) as EquipmentTemplate

describe('rentmanTemplateCache — Fortschreiben statt Ersetzen', () => {
  beforeEach(() => localStorage.clear())

  it('haelt Felder, ueber die die neue Fassung nichts sagt', () => {
    // Der Weg, den ein Nutzer wirklich geht: Rentman-Import schreibt die
    // Engineering-Daten, danach "Als Template speichern" auf demselben Geraet.
    upsertCachedRentmanTemplate(
      tpl({ rentmanId: 'r1', rackUnits: 4, isRackDevice: true, powerWatts: 350, depthMm: 480 }),
    )
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', notes: 'Ton links' }))

    const cached = getCachedRentmanTemplate('r1')
    expect(cached?.notes).toBe('Ton links')
    expect(cached?.rackUnits).toBe(4)
    expect(cached?.powerWatts).toBe(350)
    expect(cached?.depthMm).toBe(480)
    expect(cached?.isRackDevice).toBe(true)
  })

  it('laesst die neue Fassung gewinnen, wo sie etwas sagt', () => {
    // Fortschreiben heisst nicht Festhalten: ein wirklich geaenderter Wert
    // muss durchkommen, sonst waere der Cache nicht mehr aktualisierbar.
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', rackUnits: 4, powerWatts: 350 }))
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', powerWatts: 400 }))
    expect(getCachedRentmanTemplate('r1')?.powerWatts).toBe(400)
    expect(getCachedRentmanTemplate('r1')?.rackUnits).toBe(4)
  })

  it('loescht ein Feld, wenn die neue Fassung es ausdruecklich leert', () => {
    // Der Unterschied zwischen "sagt nichts" und "sagt: nichts". Ein
    // explizites undefined traegt der Spread, also ueberschreibt es.
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', powerWatts: 350 }))
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', powerWatts: undefined }))
    expect(getCachedRentmanTemplate('r1')?.powerWatts).toBeUndefined()
  })

  it('haelt Eintraege verschiedener Rentman-Ids auseinander', () => {
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r1', rackUnits: 4 }))
    upsertCachedRentmanTemplate(tpl({ rentmanId: 'r2', notes: 'x' }))
    expect(getCachedRentmanTemplate('r2')?.rackUnits).toBeUndefined()
    expect(getCachedRentmanTemplate('r1')?.rackUnits).toBe(4)
  })

  it('schreibt nichts ohne Rentman-Id', () => {
    upsertCachedRentmanTemplate(tpl({ rackUnits: 4 }))
    expect(getCachedRentmanTemplate('')).toBeUndefined()
  })
})
