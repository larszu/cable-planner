import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Annotation-Slice. Viewer-Mode-Annotations + project.mode +
 * viewerSession. Alle 5 Actions teilen das gleiche Pattern:
 * `state.project` patchen + scheduleProjectAutosave aufrufen.
 *
 * Wichtig: keine isProjectLocked-Guards — Annotations sind genau dafür
 * da, im viewer-Modus geschrieben zu werden (das ist der einzige
 * Schreib-Pfad der im viewer/finalized Mode aktiv bleibt).
 */
export type AnnotationSlice = Pick<
  ProjectState,
  | 'setProjectMode'
  | 'addAnnotation'
  | 'updateAnnotation'
  | 'removeAnnotation'
  | 'mergeAnnotationsFromViewerFile'
  | 'setViewerSession'
>

export const createAnnotationSlice: StateCreator<ProjectState, [], [], AnnotationSlice> = (
  set,
  get,
) => ({
  setProjectMode: (mode) =>
    set((state) => {
      const updated = { ...state.project, mode }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  addAnnotation: (annotation) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const updated = { ...state.project, annotations: [...existing, annotation] }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  updateAnnotation: (id, patch) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const next = existing.map((a) => (a.id === id ? { ...a, ...patch } : a))
      const updated = { ...state.project, annotations: next }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  removeAnnotation: (id) =>
    set((state) => {
      const existing = state.project.annotations ?? []
      const updated = {
        ...state.project,
        annotations: existing.filter((a) => a.id !== id),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  mergeAnnotationsFromViewerFile: (incoming) => {
    const existing = get().project.annotations ?? []
    const byId = new Map(existing.map((a) => [a.id, a]))
    let added = 0
    let updated = 0
    for (const a of incoming) {
      if (!a || typeof a.id !== 'string') continue
      const prev = byId.get(a.id)
      if (!prev) added += 1
      else if (JSON.stringify(prev) !== JSON.stringify(a)) updated += 1
      byId.set(a.id, a)
    }
    if (added > 0 || updated > 0) {
      set((state) => {
        const next = { ...state.project, annotations: [...byId.values()] }
        scheduleProjectAutosave(next)
        return { project: next }
      })
    }
    return { added, updated }
  },
  setViewerSession: (session) =>
    set((state) => {
      const updated = { ...state.project, viewerSession: session }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
