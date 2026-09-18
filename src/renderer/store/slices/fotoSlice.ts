import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'
import type { Foto } from '../../types/foto'
import { hatBild, mitBilddaten } from '../../lib/fotoMasse'
import { liesBilder } from '../fotoSpeicher'

/**
 * #884 — die Fotos.
 *
 * ─── WARUM EIN EIGENER SLICE ───────────────────────────────────────────────
 *
 * Weil ein Foto zu keinem der anderen Belange gehoert: es ist weder Geraet
 * noch Kabel noch Einstellung, sondern eine Beobachtung ueber eines davon.
 * Es an den Geraete-Slice zu haengen hiesse, dass jedes Loeschen eines
 * Geraets sich mit Bilddaten beschaeftigen muss.
 *
 * ─── WAS BEIM LOESCHEN EINES GERAETS PASSIERT ──────────────────────────────
 *
 * Nichts, und das mit Absicht — dieselbe Teilung wie bei den Farbnormen
 * (`conductorSlice`). Das Foto zeigt danach ins Leere und wird beim naechsten
 * Laden zu einem Foto OHNE Ziel, also zu einem des Projekts. Es zu loeschen
 * waere schlimmer: das Bild vom Anschlussfeld bleibt richtig, auch wenn das
 * Geraet aus dem Plan geflogen ist — oft ist es dann sogar das Einzige, was
 * noch zeigt, wie es aussah.
 */
export type FotoSlice = Pick<ProjectState, 'addFoto' | 'removeFoto' | 'updateFoto' | 'fotosNachladen'>

export const createFotoSlice: StateCreator<ProjectState, [], [], FotoSlice> = (set, get) => ({
  /**
   * Die Bilder aus der Ablage nachtragen (#884).
   *
   * Die Sicherungskopie im Browser trägt die Datensätze OHNE Bilder; nach
   * einem Absturz steht der Plan also mit leeren Rahmen da, bis dieser
   * Schritt gelaufen ist. Er läuft einmal beim Start und nur, wenn es
   * überhaupt Rahmen ohne Bild gibt — IndexedDB zu öffnen kostet sonst nur
   * Zeit.
   *
   * Er schreibt KEINE Sicherungskopie und er berührt `updatedAt` nicht:
   * Nachtragen ist kein Bearbeiten. Ein `touchProject` hier machte aus jedem
   * Programmstart eine Änderung am Plan, und der Vergleich zweier Stände
   * meldete danach eine, die niemand gemacht hat.
   */
  fotosNachladen: async () => {
    const fotos = get().project.fotos ?? []
    if (fotos.length === 0 || fotos.every(hatBild)) return
    const bilder = await liesBilder()
    if (bilder.size === 0) return
    set((state) => ({
      project: { ...state.project, fotos: mitBilddaten(state.project.fotos, bilder) },
    }))
  },

  addFoto: (foto: Foto) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const updated = touchProject({ ...state.project, fotos: [...(state.project.fotos ?? []), foto] })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  removeFoto: (id: string) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const updated = touchProject({
        ...state.project,
        fotos: (state.project.fotos ?? []).filter((f) => f.id !== id),
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  updateFoto: (id: string, patch: Partial<Pick<Foto, 'notiz' | 'zeigtAuf'>>) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const updated = touchProject({
        ...state.project,
        fotos: (state.project.fotos ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
