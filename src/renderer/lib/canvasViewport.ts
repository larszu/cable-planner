// Module-level bridge so non-canvas components (Library panel, Rentman dialogs)
// can ask "what's the centre of the current canvas viewport?" and "clear any
// active canvas selection" without having to live inside <ReactFlowProvider>.
//
// CanvasArea registers callbacks on mount.

type Point = { x: number; y: number }

let viewportGetter: (() => Point | null) | null = null
let selectionClearer: (() => void) | null = null
let interactionLockRequester: ((durationMs?: number) => void) | null = null
let interactionUnlocker: (() => void) | null = null

export const setViewportCenterGetter = (fn: (() => Point | null) | null) => {
  viewportGetter = fn
}

export const getViewportCenter = (): Point | null => {
  try {
    return viewportGetter ? viewportGetter() : null
  } catch {
    return null
  }
}

export const setCanvasSelectionClearer = (fn: (() => void) | null) => {
  selectionClearer = fn
}

export const clearCanvasSelection = () => {
  try {
    selectionClearer?.()
  } catch {
    /* no-op */
  }
}

export const setCanvasInteractionLockHandlers = (
  handlers:
    | {
        requestLock: (durationMs?: number) => void
        unlock: () => void
      }
    | null,
) => {
  interactionLockRequester = handlers?.requestLock ?? null
  interactionUnlocker = handlers?.unlock ?? null
}

export const lockCanvasInteraction = (durationMs?: number) => {
  try {
    interactionLockRequester?.(durationMs)
  } catch {
    /* no-op */
  }
}

export const unlockCanvasInteraction = () => {
  try {
    interactionUnlocker?.()
  } catch {
    /* no-op */
  }
}
