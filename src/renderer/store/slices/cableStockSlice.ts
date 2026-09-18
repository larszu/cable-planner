import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import type { CableStockEntry } from '../../types/cable'
import type { LedPanelType, LedWall } from '../../types/ledWall'

/**
 * #875 / #881 — womit diese Produktion gebaut wird: Lagerlaengen und
 * LED-Kacheln.
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
export type CableStockSlice = Pick<ProjectState, 'setCableStock' | 'setLedPanelTypes' | 'setLedWalls'>

export const createCableStockSlice: StateCreator<ProjectState, [], [], CableStockSlice> = (set) => ({
  setCableStock: (cableStock: CableStockEntry[]) =>
    set((state) => {
      const updated = { ...state.project, cableStock }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  // #881 — die LED-Waende liegen im selben Slice und nicht in einem eigenen:
  // es ist derselbe Belang, nur eine Ebene weiter — eine Angabe darueber,
  // WOMIT diese Produktion gebaut wird. Ein dritter Slice mit derselben
  // Form waere eine Datei mehr und keine Grenze mehr.
  setLedPanelTypes: (ledPanelTypes: LedPanelType[]) =>
    set((state) => {
      const updated = { ...state.project, ledPanelTypes }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  setLedWalls: (ledWalls: LedWall[]) =>
    set((state) => {
      const updated = { ...state.project, ledWalls }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
