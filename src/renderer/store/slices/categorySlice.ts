import type { StateCreator } from 'zustand'
import { persistKnownCategories } from '../libraryPersist'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Category-Slice. Reine Verwaltungs-Actions auf
 * state.knownCategories:
 *  - addKnownCategories: neue Kategorien hinzufuegen. Existing-Order
 *    wird bewahrt (v7.9.5: User-Drag&Drop-Reihenfolge schuetzen), nur
 *    NEUE landen sortiert am Ende.
 *  - reorderCategories: User-Drag&Drop-Resultat anwenden. Unbekannte
 *    werden ignoriert; ausgelassene haengen wir hinten dran damit
 *    Partial-Reorder keine Eintraege verliert.
 *
 * Nicht hier: renameCustomCategory — cross-mutiert auch
 * project.equipment + customLibrary, das ist eine andere Domain.
 */
export type CategorySlice = Pick<
  ProjectState,
  'addKnownCategories' | 'reorderCategories'
>

export const createCategorySlice: StateCreator<ProjectState, [], [], CategorySlice> = (set) => ({
  addKnownCategories: (categories) =>
    set((state) => {
      const set_ = new Set(state.knownCategories)
      categories.forEach((c) => {
        const trimmed = c.trim()
        if (trimmed) set_.add(trimmed)
      })
      // v7.9.5 — Append NEU statt komplett zu sortieren, damit der User
      // seine manuelle Drag&Drop-Reihenfolge nicht verliert. Existing
      // categories behalten ihre Position; nur neue kommen ans Ende.
      const existing = state.knownCategories.filter((c) => set_.has(c))
      const added: string[] = []
      for (const c of set_) {
        if (!existing.includes(c)) added.push(c)
      }
      added.sort((a, b) => a.localeCompare(b))
      const next = [...existing, ...added]
      persistKnownCategories(next)
      return { knownCategories: next }
    }),
  reorderCategories: (newOrder) =>
    set((state) => {
      // Nur Kategorien akzeptieren die wir bereits kennen, in der
      // gegebenen Reihenfolge. Unbekannte werden ignoriert; ausgelassene
      // werden ans Ende gehängt um nichts zu verlieren.
      const known = new Set(state.knownCategories)
      const ordered: string[] = []
      const seen = new Set<string>()
      for (const c of newOrder) {
        if (known.has(c) && !seen.has(c)) {
          ordered.push(c)
          seen.add(c)
        }
      }
      for (const c of state.knownCategories) {
        if (!seen.has(c)) ordered.push(c)
      }
      persistKnownCategories(ordered)
      return { knownCategories: ordered }
    }),
})
