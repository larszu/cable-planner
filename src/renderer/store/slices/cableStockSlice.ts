import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import type { CableStockEntry } from '../../types/cable'

/**
 * #875 — die verfuegbaren Lagerlaengen je Kabeltyp.
 *
 * ─── WARUM DAS EIN EIGENER SLICE IST ───────────────────────────────────────
 *
 * Weil es ein eigener Belang ist und kein Feld am Kabel: „wir fahren 100er-
 * und 50er-Trommeln" ist eine Aussage ueber das ganze Projekt. An jedem Kabel
 * gespeichert waere sie hundertmal da, und die hundert Kopien liefen
 * auseinander.
 *
 * ─── UND WARUM SIE UEBERHAUPT AM PROJEKT HAENGEN ───────────────────────────
 *
 * ADR-006 hat den Bestand in ein eigenes Werkzeug ausgelagert; der Planer
 * kennt kein Lager-Modell und soll keins bekommen. Was hier steht, ist keine
 * Bestandsfuehrung, sondern die Angabe „mit diesen Trommeln fahren wir diese
 * Produktion" — genau so viel, wie die Stueckelung braucht.
 *
 * ─── WAS HIER NICHT PASSIERT ───────────────────────────────────────────────
 *
 * Aufraeumen und Pruefen. Eine Laenge von 0 oder eine negative Stueckzahl
 * faellt beim naechsten Laden in `healProjectPositions` — dieselbe Teilung
 * wie bei den Farbnormen. Zwei Stellen, die dasselbe pruefen, sind eine
 * Stelle zu viel.
 */
export type CableStockSlice = Pick<ProjectState, 'setCableStock'>

export const createCableStockSlice: StateCreator<ProjectState, [], [], CableStockSlice> = (set) => ({
  setCableStock: (cableStock: CableStockEntry[]) =>
    set((state) => {
      const updated = { ...state.project, cableStock }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
