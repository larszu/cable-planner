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
  | 'setViewerSession'
>

export const createAnnotationSlice: StateCreator<ProjectState, [], [], AnnotationSlice> = (set) => ({
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
  setViewerSession: (session) =>
    set((state) => {
      const updated = { ...state.project, viewerSession: session }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
