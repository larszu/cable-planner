import { useEffect } from 'react'
import { useProjectStore } from './projectStore'
import type { CablePlannerProject } from '../types/project'

/**
 * v7.9.92 — Undo/Redo mit Transaction + Coalesce-Window.
 *
 * Inspiriert von draw.io / mxGraph's `beginUpdate`/`endUpdate`-Pattern:
 * eine User-Aktion (z.B. Multi-Select-Drag oder Paste) löst N atomare
 * Store-Mutationen aus, soll aber EINEN Undo-Schritt sein.
 *
 * Zwei Mechaniken laufen parallel:
 *
 * 1. **Explizite Transaktionen** via `beginTransaction()` / `endTransaction()`:
 *    Bekannte Multi-Step-Aktionen (Multi-Drag, Multi-Delete, Paste,
 *    Group-Drag mit Contents) wickeln sich in einen Transaction-Frame.
 *    Während der Transaktion werden Project-Changes intern verfolgt
 *    aber NICHT als History-Entries gepusht. Beim End-Of-Transaction
 *    landet die DIFF (Start → End) als ein einziger Entry.
 *
 * 2. **Auto-Coalesce** mit 200 ms Window:
 *    Zwei aufeinanderfolgende Changes innerhalb derselben Burst-Phase
 *    (z.B. ein Properties-Slider der bei jeder Pixel-Bewegung set()
 *    aufruft) werden in den VORHERIGEN History-Entry geschmolzen.
 *    Bedingung: kein offener Transaction-Frame.
 *
 * Plus: leerer Diff (state.project === past[-1]) blockiert No-Op-Entries.
 */

const HISTORY_LIMIT = 100
const COALESCE_WINDOW_MS = 200

let past: CablePlannerProject[] = []
let future: CablePlannerProject[] = []
let lastProject: CablePlannerProject = useProjectStore.getState().project
let suppress = false

// Transaction-State.
let transactionDepth = 0
let transactionStartProject: CablePlannerProject | null = null

// Coalesce-State.
let lastChangeTime = 0

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const pushPast = (entry: CablePlannerProject): void => {
  past.push(entry)
  if (past.length > HISTORY_LIMIT) past.shift()
  future = []
}

useProjectStore.subscribe((state) => {
  if (state.project === lastProject) return
  if (suppress) {
    lastProject = state.project
    return
  }
  // v7.9.92 — Während einer Transaktion: project-Reference im lastProject
  // mit-tracken aber NICHT als History-Entry pushen. Der eine Entry wird
  // bei endTransaction() aus transactionStartProject erzeugt.
  if (transactionDepth > 0) {
    lastProject = state.project
    return
  }
  const now = Date.now()
  // v7.9.92 — Coalesce: zwei Bursts innerhalb 200 ms → kein neuer Entry,
  // nur lastProject tracken. Das schmiltzt z.B. Drag-Drop-Sequenzen
  // oder Slider-Spam zu einem User-perception-Step.
  if (now - lastChangeTime < COALESCE_WINDOW_MS && past.length > 0) {
    lastChangeTime = now
    lastProject = state.project
    return
  }
  pushPast(lastProject)
  lastChangeTime = now
  lastProject = state.project
  notify()
})

export const projectHistory = {
  canUndo: () => past.length > 0,
  canRedo: () => future.length > 0,

  /** v7.9.92 — Start einer expliziten Transaktion. Bis zum
   *  endTransaction() werden alle Project-Mutationen NICHT als
   *  separate Entries erfasst; der finale State landet als ein Entry. */
  beginTransaction: (): void => {
    if (transactionDepth === 0) {
      transactionStartProject = lastProject
    }
    transactionDepth++
  },
  endTransaction: (): void => {
    if (transactionDepth === 0) return
    transactionDepth--
    if (transactionDepth === 0 && transactionStartProject) {
      const finalProject = useProjectStore.getState().project
      if (finalProject !== transactionStartProject) {
        pushPast(transactionStartProject)
        lastChangeTime = Date.now()
        notify()
      }
      transactionStartProject = null
    }
  },
  /** Convenience: führt fn() innerhalb einer Transaktion aus. */
  transact<T>(fn: () => T): T {
    projectHistory.beginTransaction()
    try {
      return fn()
    } finally {
      projectHistory.endTransaction()
    }
  },

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
    // Coalesce-Reset: nach einem Undo soll der NÄCHSTE User-Edit einen
    // frischen Entry erzeugen, nicht in den letzten gemergt werden.
    lastChangeTime = 0
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
    lastProject = useProjectStore.getState().project
    lastChangeTime = 0
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
    transactionDepth = 0
    transactionStartProject = null
    lastChangeTime = 0
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
