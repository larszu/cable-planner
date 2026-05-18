import { useEffect } from 'react'
import { useProjectStore } from './projectStore'
import type { CablePlannerProject } from '../types/project'

/**
 * Undo/redo history for the project document. We subscribe to the main
 * project store and push each new `project` reference onto an in-memory
 * history stack. A guard flag prevents the subscribe from recording
 * changes that are themselves caused by undo/redo.
 */

const HISTORY_LIMIT = 100
let past: CablePlannerProject[] = []
let future: CablePlannerProject[] = []
let lastProject: CablePlannerProject = useProjectStore.getState().project
let suppress = false

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

useProjectStore.subscribe((state) => {
  if (state.project === lastProject) return
  if (suppress) {
    lastProject = state.project
    return
  }
  past.push(lastProject)
  if (past.length > HISTORY_LIMIT) past.shift()
  future = []
  lastProject = state.project
  notify()
})

export const projectHistory = {
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,
  undo: () => {
    if (past.length === 0) return
    const prev = past.pop()!
    future.push(lastProject)
    suppress = true
    try {
      useProjectStore.getState().loadProject(prev, useProjectStore.getState().filePath)
    } finally {
      suppress = false
    }
    // v7.9.71 / #186 — lastProject MUSS auf die tatsächliche neue
    // state.project-Referenz zeigen, nicht auf das urspüngliche prev.
    // loadProject jagt prev durch healProjectPositions, was eine NEUE
    // Referenz erzeugt; wenn lastProject auf prev (unhealed) zeigt,
    // sieht der nächste Diff im subscribe einen falsch berechneten
    // Vorzustand → Undo/Redo verhielt sich in alten Projekten "verrückt"
    // weil die history und der tatsächliche store divergiert sind.
    lastProject = useProjectStore.getState().project
    notify()
  },
  redo: () => {
    if (future.length === 0) return
    const next = future.pop()!
    past.push(lastProject)
    suppress = true
    try {
      useProjectStore.getState().loadProject(next, useProjectStore.getState().filePath)
    } finally {
      suppress = false
    }
    // v7.9.71 / #186 — dito (siehe undo-Kommentar).
    lastProject = useProjectStore.getState().project
    notify()
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Clear history (e.g. when loading a different project from disk). */
  reset: () => {
    past = []
    future = []
    lastProject = useProjectStore.getState().project
    notify()
  },
}

/**
 * React hook binding Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y to undo/redo.
 * Only active when no input/textarea/contenteditable is focused so the
 * native text-edit shortcuts still work.
 */
export const useUndoRedoShortcuts = () => {
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (el.isContentEditable) return true
      return false
    }
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      if (isEditable(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        projectHistory.undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        projectHistory.redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
