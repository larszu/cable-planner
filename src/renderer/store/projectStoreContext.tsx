// v7.9.9 — Project-Store-Context. Erlaubt den Canvas-Tree (CanvasArea
// + alle ihre Children) gegen einen alternativen Store-Instanz zu
// rendern, ohne dass die ganze restliche App davon weiß.
//
// Default: kein Provider → fällt auf `useProjectStore` aus
// `./projectStore` zurück (identisches Verhalten wie vorher).
//
// Override: `<ProjectStoreProvider store={scratchStore}>...</...>`
// wickelt einen Sub-Tree mit einer separaten Store-Instanz ein.
// Selectors UND imperative `.getState()`-Zugriffe (über `useProjectStoreInstance`)
// gehen dann gegen den Override.
//
// Benutzt von der neuen RackInternalCanvas-Komponente, die die echte
// CanvasArea mit einem Scratch-Store füttert anstatt einen
// stripped-down separaten Canvas zu pflegen.

import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'
import { useProjectStore } from './projectStore'
import type { ProjectState } from './projectStore'

// Das Default-Singleton — useProjectStore von zustand `create()` hat
// alle StoreApi-Methoden (getState/setState/subscribe) als Eigenschaften
// angeheftet, lässt sich daher als StoreApi durchreichen.
const defaultStoreApi = useProjectStore as unknown as StoreApi<ProjectState>

export const ProjectStoreContext = createContext<StoreApi<ProjectState>>(defaultStoreApi)

/** Context-aware selector hook. In normalem Canvas-Tree (kein
 *  Provider drumherum) liest aus dem Default-Store; im
 *  RackInternalCanvas aus dem Scratch-Store. API identisch zu
 *  useProjectStore. */
export function useCanvasProjectStore<T>(selector: (state: ProjectState) => T): T {
  const store = useContext(ProjectStoreContext)
  return useStore(store, selector)
}

/** Imperative Store-Instanz für den Sub-Tree. Nutzt der Aufrufer für
 *  `.getState()` / `.setState()` / `.subscribe()` außerhalb von
 *  Selectors. */
export function useCanvasProjectStoreInstance(): StoreApi<ProjectState> {
  return useContext(ProjectStoreContext)
}
