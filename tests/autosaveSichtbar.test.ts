// ───────────────────────────────────────────────────────────────────────────
// Die Sicherungskopie schweigt nicht mehr, wenn sie ausfällt.
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// In `projectAutosave.ts` stand `catch { /* quota errors are non-fatal */ }`.
// Für den Programmablauf stimmte das — es stürzt nichts ab. Für den Menschen
// davor nicht: `localStorage` fasst je nach Browser 5–10 MB, und ab dem
// ersten zu grossen Speichern wird die Kopie stillschweigend nicht mehr
// geschrieben. Wer weiterplant und dann den Rechner verliert, hat den Stand
// von damals, und niemand hat ihm gesagt, ab wann.
//
// Das ist die teuerste Defektform dieses Repos: kein Fehler, nur eine
// Anzeige, die weiter „gesichert" behauptet.
// ───────────────────────────────────────────────────────────────────────────
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { autosaveFehlschlag, scheduleProjectAutosave } from '../src/renderer/store/projectAutosave'
import type { CablePlannerProject } from '../src/renderer/types/project'

const projekt = (name: string): CablePlannerProject =>
  ({
    metadata: { name, description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as CablePlannerProject

describe('die Sicherungskopie meldet ihren Ausfall', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('schweigt, solange es gut geht', () => {
    scheduleProjectAutosave(projekt('klein'))
    vi.runAllTimers()
    expect(autosaveFehlschlag()).toBeNull()
  })

  it('merkt sich den Ausfall MIT der Grösse', () => {
    // „Zu gross" ohne Zahl lässt jemanden raten, ob ein Logo zu viel war
    // oder der halbe Plan.
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    scheduleProjectAutosave(projekt('gross'))
    vi.runAllTimers()
    const weg = autosaveFehlschlag()
    expect(weg).not.toBeNull()
    expect(weg!.bytes).toBeGreaterThan(0)
  })

  it('nimmt die Meldung zurück, sobald es wieder geht', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    scheduleProjectAutosave(projekt('gross'))
    vi.runAllTimers()
    expect(autosaveFehlschlag()).not.toBeNull()

    spy.mockRestore()
    scheduleProjectAutosave(projekt('klein'))
    vi.runAllTimers()
    expect(autosaveFehlschlag()).toBeNull()
  })

  it('stürzt nicht ab — der Plan läuft weiter', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => {
      scheduleProjectAutosave(projekt('gross'))
      vi.runAllTimers()
    }).not.toThrow()
  })
})
