import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import type { Anschluss, Farbnorm } from '../../types/conductor'

/**
 * B-45 — die Farbnormen und die Anschluss.
 *
 * WARUM ES DAS UEBERHAUPT ALS SLICE GIBT UND NICHT ALS FELD AM KABEL. Beides
 * sind Aussagen ueber MEHRERE Leitungen: eine Norm gilt fuer alle Adern eines
 * Anschlusses, ein Anschluss fuer die fuenf Leitungen, die ihn bilden. An einem
 * Kabel gespeichert waeren sie fuenfmal da, und die fuenf Kopien liefen
 * auseinander — genau die Defektform `zwei-rechnungen`, nur mit fuenf.
 *
 * WAS HIER NICHT PASSIERT: aufraeumen beim Loeschen. Wer eine Norm entfernt,
 * bekommt Anschluss ohne Norm; wer ein Anschluss entfernt, bekommt Leitungen ohne
 * Zugehoerigkeit. Beides ist in Ordnung und wird beim naechsten Laden geheilt
 * (`healProjectPositions`) — der Zeiger faellt weg, und der Plan-Check sagt
 * dann „keine Norm gewaehlt" statt still eine geloeschte zu benutzen.
 * Hier zusaetzlich aufzuraeumen waere eine zweite Fassung derselben Regel.
 */
export type ConductorSlice = Pick<
  ProjectState,
  'setFarbnormen' | 'setAnschluss' | 'setOscLauscher'
>

export const createConductorSlice: StateCreator<ProjectState, [], [], ConductorSlice> = (set) => ({
  setFarbnormen: (farbnormen: Farbnorm[]) =>
    set((state) => {
      const updated = { ...state.project, farbnormen }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  setAnschluss: (anschlussListe: Anschluss[]) =>
    set((state) => {
      const updated = { ...state.project, anschlussListe }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  // E-23 — der Lauscher gehoert zum PROJEKT und nicht zur App. Eine App-weite
  // Einstellung erbte ein zweites Projekt mit, und dann lauschte ein Port,
  // den fuer dieses Projekt niemand wollte (Auflage 2 aus E-23).
  setOscLauscher: (oscLauscher) =>
    set((state) => {
      const updated = { ...state.project, oscLauscher }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
