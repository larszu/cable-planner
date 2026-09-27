import { describe, expect, it } from 'vitest'
import { eintragAusMeldung, erfassungsNotiz, erfasstesGeraet, offeneErfassungen, ERFASST_KATEGORIE } from '../src/renderer/lib/erfassung'
import { useProjectStore } from '../src/renderer/store/projectStore'

const label = { raum: 'Raum', verbindung: 'Verbunden mit (vermutet)' }

describe('#906 — Bestandsaufnahme', () => {
  it('ein Eintrag wird ein unfertiges Geraet ohne erfundene Buchsen', () => {
    const g = erfasstesGeraet(
      { name: ' Beamer Decke ', raum: 'Saal 2', verbindung: 'Rednerpult, HDMI?', notiz: 'laut' },
      { x: 10, y: 20 },
      { am: '2026-09-27T10:00:00.000Z', quelle: 'planer', label },
    )!
    expect(g.name).toBe('Beamer Decke')
    expect(g.inputs).toEqual([])
    expect(g.outputs).toEqual([])
    expect(g.portsUnknown).toBe(true)
    expect(g.category).toBe(ERFASST_KATEGORIE)
    expect(g.erfasst).toEqual({ am: '2026-09-27T10:00:00.000Z', quelle: 'planer' })
    expect(g.notes).toBe('Raum: Saal 2\nVerbunden mit (vermutet): Rednerpult, HDMI?\nlaut')
  })

  it('ohne Namen kein Geraet, ohne Angaben keine leere Notiz', () => {
    expect(erfasstesGeraet({ name: '  ' }, { x: 0, y: 0 }, { am: 'x', quelle: 'planer', label })).toBeNull()
    expect(erfasstesGeraet({ name: 'A' }, { x: 0, y: 0 }, { am: 'x', quelle: 'planer', label })!.notes).toBeUndefined()
    expect(erfassungsNotiz({ name: 'A', raum: ' ' }, label)).toBe('')
  })

  it('liest eine Handy-Meldung new-device, sonst nichts', () => {
    expect(eintragAusMeldung({ kind: 'new-device', summary: 's', patch: { name: 'Mixer', raum: 'Regie' } })).toEqual({ name: 'Mixer', raum: 'Regie' })
    expect(eintragAusMeldung({ kind: 'note', summary: 's', patch: { name: 'Mixer' } })).toBeNull()
    expect(eintragAusMeldung({ kind: 'new-device', summary: 's', patch: {} })).toBeNull()
  })

  it('Annehmen einer Handy-Meldung legt das Geraet an', () => {
    const st = useProjectStore.getState()
    const vorher = st.project.equipment.length
    st.addPendingChange({ id: 'pc-906', source: 'mobile', kind: 'new-device', summary: 'New device: Kamera 3', patch: { name: 'Kamera 3', raum: 'Saal' } })
    expect(useProjectStore.getState().applyPendingChange('pc-906')).toBe(true)
    const nachher = useProjectStore.getState().project
    expect(nachher.equipment.length).toBe(vorher + 1)
    const neu = nachher.equipment[nachher.equipment.length - 1]
    expect(neu.name).toBe('Kamera 3')
    expect(neu.portsUnknown).toBe(true)
    expect(neu.erfasst?.quelle).toBe('handy')
    expect(offeneErfassungen(nachher.equipment)).toContain(neu)
    expect(nachher.pendingChanges?.some((p) => p.id === 'pc-906')).toBe(false)
  })
})
