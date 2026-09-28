import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'
import type { ProjektAnhang } from '../../types/anhang'

/**
 * Die Anhänge (Messprotokolle, Herstellerunterlagen, Konfig-Sicherungen).
 *
 * ─── WAS DAS ENTFERNEN TUT ─────────────────────────────────────────────────
 *
 * Es nimmt den VERWEIS aus dem Projekt, nicht die Datei aus `Anhaenge/`.
 * Eine Datei zu löschen, die jemand als Beleg einer Messung abgelegt hat,
 * wäre ein Schritt ohne Rückweg — das Rückgängig des Plans holt den Verweis
 * zurück, aber keine Bytes. Wer die Datei los sein will, löscht sie im
 * Dateimanager; der Knopf „Im Ordner zeigen" führt hin.
 *
 * ─── WAS BEIM LÖSCHEN EINES KABELS PASSIERT ────────────────────────────────
 *
 * Nichts, wie bei den Fotos. Das Protokoll bleibt richtig, auch wenn das
 * Kabel aus dem Plan geflogen ist; das Verzeichnis sagt dann „Ziel nicht
 * mehr im Plan", statt die Zeile still zu verlieren.
 */
export type AnhangSlice = Pick<ProjectState, 'addAnhaenge' | 'updateAnhang' | 'removeAnhang'>

export const createAnhangSlice: StateCreator<ProjectState, [], [], AnhangSlice> = (set) => ({
  addAnhaenge: (neu: ProjektAnhang[]) =>
    set((state) => {
      if (isProjectLocked(state) || neu.length === 0) return state
      const updated = touchProject({ ...state.project, anhaenge: [...(state.project.anhaenge ?? []), ...neu] })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  updateAnhang: (id: string, patch: Partial<Pick<ProjektAnhang, 'titel' | 'art' | 'ziel'>>) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const updated = touchProject({
        ...state.project,
        anhaenge: (state.project.anhaenge ?? []).map((a) => {
          if (a.id !== id) return a
          const next = { ...a, ...patch }
          // `ziel: undefined` im Patch heisst „zur Anlage" — dann fällt das Feld weg.
          if ('ziel' in patch && !patch.ziel) delete next.ziel
          return next
        }),
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  removeAnhang: (id: string) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const rest = (state.project.anhaenge ?? []).filter((a) => a.id !== id)
      const updated = touchProject({ ...state.project, anhaenge: rest.length ? rest : undefined })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
