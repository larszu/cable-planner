import type { StateCreator } from 'zustand'
import type { Grundriss, PlanKalibrierung } from '../../types/grundriss'
import type { PlatziertesSymbol, SymbolDef } from '../../types/symbol'
import { kalibrierungMitfuehren, meterJePixel } from '../../lib/grundriss/massstab'
import { DEFAULT_LENGTH_ESTIMATION } from '../../lib/cableLengthEstimate'
import { grundrissVon, mitGrundriss } from '../../lib/grundriss/etagenPlaene'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'

export type GrundrissSlice = Pick<
  ProjectState,
  | 'setGrundriss'
  | 'updateGrundriss'
  | 'kalibriereGrundriss'
  | 'addSymbol'
  | 'updateSymbol'
  | 'removeSymbol'
  | 'addSymbolDef'
  | 'removeSymbolDef'
>

export const createGrundrissSlice: StateCreator<ProjectState, [], [], GrundrissSlice> = (set) => ({
  setGrundriss: (g, etage = null) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return { project: touchProject(mitGrundriss(state.project, etage, g)) }
    }),
  // Lage oder Groesse aendern fuehrt die Kalibrierung mit: ihre Punkte sind
  // Canvas-Koordinaten und gehoeren zum Bild, nicht zum Canvas.
  updateGrundriss: (patch, etage = null) =>
    set((state) => {
      const alt = grundrissVon(state.project, etage)
      if (!alt || isProjectLocked(state)) return state
      const neu: Grundriss = { ...alt, ...patch }
      const bewegt = neu.x !== alt.x || neu.y !== alt.y || neu.width !== alt.width || neu.height !== alt.height
      if (bewegt && alt.kalibrierung && patch.kalibrierung === undefined) {
        neu.kalibrierung = kalibrierungMitfuehren(alt.kalibrierung, alt, neu)
      }
      return { project: touchProject(mitGrundriss(state.project, etage, neu)) }
    }),
  // Eine Zwei-Punkt-Kalibrierung ist EIN Massstab, und der gilt dann auch als
  // „Meter pro 100 px" — sonst rechneten Laengen und 3D-Gebaeudeansicht mit
  // zwei verschiedenen Zahlen fuer denselben Canvas.
  // Nur der allgemeine Plan setzt „Meter pro 100 px"; ein Etagenplan
  // behaelt seinen Massstab fuer sich.
  kalibriereGrundriss: (k: PlanKalibrierung, etage = null) =>
    set((state) => {
      const g = grundrissVon(state.project, etage)
      if (!g || isProjectLocked(state)) return state
      const mJePx = etage == null ? meterJePixel(k) : null
      const metadata =
        mJePx == null
          ? state.project.metadata
          : {
              ...state.project.metadata,
              lengthEstimation: {
                ...(state.project.metadata.lengthEstimation ?? DEFAULT_LENGTH_ESTIMATION),
                metersPer100px: Math.round(mJePx * 100 * 10000) / 10000,
              },
            }
      // Nach der Kalibrierung ist der Plan eingerichtet: sperren, damit ein
      // versehentliches Ziehen den Massstab nicht vom Bild loest.
      return { project: touchProject(mitGrundriss({ ...state.project, metadata }, etage, { ...g, kalibrierung: k, gesperrt: true })) }
    }),
  addSymbol: (s: PlatziertesSymbol) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return { project: touchProject({ ...state.project, symbole: [...(state.project.symbole ?? []), s] }) }
    }),
  updateSymbol: (id, patch) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const symbole = (state.project.symbole ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s))
      return { project: touchProject({ ...state.project, symbole }) }
    }),
  removeSymbol: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const symbole = (state.project.symbole ?? []).filter((s) => s.id !== id)
      return { project: touchProject({ ...state.project, symbole }) }
    }),
  addSymbolDef: (d: SymbolDef) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const symbolDefs = [...(state.project.symbolDefs ?? []).filter((x) => x.id !== d.id), d]
      return { project: touchProject({ ...state.project, symbolDefs }) }
    }),
  // Eine Definition, die noch auf dem Canvas steht, wird nicht entfernt:
  // die platzierten Symbole zeigten sonst ein leeres Feld.
  removeSymbolDef: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      if ((state.project.symbole ?? []).some((s) => s.defId === id)) return state
      const symbolDefs = (state.project.symbolDefs ?? []).filter((d) => d.id !== id)
      return { project: touchProject({ ...state.project, symbolDefs }) }
    }),
})
