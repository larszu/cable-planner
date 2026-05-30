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

// v7.9.0 / Issue #108 — fitView callback. Caller is the docking
// toggle in LibraryPanel / PropertiesPanel (and in future the
// floating-panel close button). When the user docks or undocks a
// side panel the canvas track changes width abruptly; without
// re-fitting, devices may shift out of view, which the user
// reported as "canvas verschwindet beim abdocken".
let fitViewHandler: (() => void) | null = null

export const setCanvasFitViewHandler = (fn: (() => void) | null) => {
  fitViewHandler = fn
}

export const triggerCanvasFitView = () => {
  try {
    fitViewHandler?.()
  } catch {
    /* no-op */
  }
}

// #340 — Duplikat der aktuellen Canvas-Auswahl (Strg+D) auch aus dem
// "Bearbeiten"-Menue ausloesbar. Die Selektion lebt in ReactFlow, also
// registriert CanvasArea den Handler hier.
let duplicateHandler: (() => void) | null = null
export const setCanvasDuplicateHandler = (fn: (() => void) | null) => {
  duplicateHandler = fn
}
export const triggerCanvasDuplicate = () => {
  try {
    duplicateHandler?.()
  } catch {
    /* no-op */
  }
}

// #341 — Zoom-Steuerung (Einpassen via fitView oben; hier rein/raus/100%)
// aus dem "Ansicht"-Menue. CanvasArea bindet ReactFlows zoomIn/Out/zoomTo.
let zoomHandlers: { zoomIn: () => void; zoomOut: () => void; resetZoom: () => void } | null = null
export const setCanvasZoomHandlers = (
  fns: { zoomIn: () => void; zoomOut: () => void; resetZoom: () => void } | null,
) => {
  zoomHandlers = fns
}
export const triggerCanvasZoomIn = () => {
  try {
    zoomHandlers?.zoomIn()
  } catch {
    /* no-op */
  }
}
export const triggerCanvasZoomOut = () => {
  try {
    zoomHandlers?.zoomOut()
  } catch {
    /* no-op */
  }
}
export const triggerCanvasResetZoom = () => {
  try {
    zoomHandlers?.resetZoom()
  } catch {
    /* no-op */
  }
}

// v7.8.8 — A*-router callback registered by CanvasArea. The context
// menu and any other non-canvas caller can ask "please re-route cable
// X using A*" without needing to live inside the React Flow context.
// CanvasArea owns the live data (rfNodes for actual rendered handle
// positions, full obstacle list, all cables for soft-obstacle
// avoidance) and turns the request into the actual write.
let cableRouter: ((cableId: string) => boolean) | null = null
let allCablesRouter: (() => number) | null = null

export const setCableRouter = (
  fns:
    | {
        routeOne: (cableId: string) => boolean
        routeAll: () => number
      }
    | null,
) => {
  cableRouter = fns?.routeOne ?? null
  allCablesRouter = fns?.routeAll ?? null
}

/** Reroute a single cable using A*. Returns true if a path was found
 *  and written to the cable. */
export const routeCable = (cableId: string): boolean => {
  try {
    return cableRouter ? cableRouter(cableId) : false
  } catch {
    return false
  }
}

/** Reroute every cable using A*. Returns the number of cables that
 *  successfully found a path. */
export const routeAllCables = (): number => {
  try {
    return allCablesRouter ? allCablesRouter() : 0
  } catch {
    return 0
  }
}
