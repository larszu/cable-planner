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

// #340 — Duplizieren aus dem Bearbeiten-Menü. Die eigentliche Logik
// (copy→paste der Auswahl) lebt in CanvasArea als duplicateSelection;
// die MenuBar triggert sie ueber diesen registrierten Handler, analog
// zu Fit-View. Strg+D funktioniert weiterhin direkt im Canvas.
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

// #340 — "Alles auswählen" aus dem Bearbeiten-Menü: CanvasArea markiert
// alle Geräte-Nodes als selected (ReactFlow-Selektion).
let selectAllHandler: (() => void) | null = null
export const setCanvasSelectAllHandler = (fn: (() => void) | null) => {
  selectAllHandler = fn
}
export const triggerCanvasSelectAll = () => {
  try {
    selectAllHandler?.()
  } catch {
    /* no-op */
  }
}

// #341 — Zoom rein/raus/100% aus dem Ansicht-Menü (Einpassen nutzt
// triggerCanvasFitView). CanvasArea bindet ReactFlows zoomIn/Out/zoomTo.
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

// #ux — Canvas-Suche: auf ein bestimmtes Gerät zentrieren. CanvasArea bindet
// ReactFlows setCenter; die Suchleiste ruft triggerCanvasCenterOn mit dem
// Mittelpunkt des Treffers.
let centerOnHandler: ((x: number, y: number, zoom?: number) => void) | null = null
export const setCanvasCenterOnHandler = (
  fn: ((x: number, y: number, zoom?: number) => void) | null,
) => {
  centerOnHandler = fn
}
export const triggerCanvasCenterOn = (x: number, y: number, zoom?: number) => {
  try {
    centerOnHandler?.(x, y, zoom)
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
// #515 — Router-Registry als ID-gekeyter Stack statt einzelner Globals.
// Grund: Die Rack-Verkabelung (RackInternalCanvas) rendert DIESELBE
// <CanvasArea>-Komponente ein zweites Mal (mode='rack'), nur mit einem
// eigenen Scratch-Store. Beide Instanzen registrierten ihren A*-Router
// über EIN globales Slot — wer zuletzt seinen Effect laufen ließ, gewann.
// Lief der Effect der Haupt-Canvas erneut (deps: project.equipment /
// updateCable), während das Rack-Overlay offen war, zeigte das Slot
// wieder auf die HAUPT-Canvas. routeCable(scratchCableId) suchte das
// Kabel dann im Haupt-Projekt, fand es nicht und gab still `false`
// zurück → "Auto-Routing beim Verkabeln defekt" (Issue #515).
//
// Fix: jede CanvasArea-Instanz registriert mit stabiler ID. Aktiv ist
// die ZULETZT gemountete (oben auf dem Stack = das Rack-Overlay, solange
// es offen ist). Re-Registrierung einer bekannten ID aktualisiert
// in-place, OHNE die Stack-Position zu ändern — ein Re-Run des Haupt-
// Effects kann das offene Rack-Overlay also nicht mehr verdrängen.
// Schließt das Overlay (Cleanup → setCableRouter(id, null)), fällt der
// Stack auf die Haupt-Canvas zurück.
interface CableRouterEntry {
  id: string
  routeOne: (cableId: string) => boolean
  routeAll: () => number
}
const cableRouterStack: CableRouterEntry[] = []

const activeCableRouter = (): CableRouterEntry | null =>
  cableRouterStack.length > 0 ? cableRouterStack[cableRouterStack.length - 1] : null

export const setCableRouter = (
  id: string,
  fns:
    | {
        routeOne: (cableId: string) => boolean
        routeAll: () => number
      }
    | null,
) => {
  const idx = cableRouterStack.findIndex((e) => e.id === id)
  if (!fns) {
    if (idx >= 0) cableRouterStack.splice(idx, 1)
    return
  }
  if (idx >= 0) {
    // In-place aktualisieren — Stack-Position (= "wer ist aktiv") bleibt.
    cableRouterStack[idx] = { id, routeOne: fns.routeOne, routeAll: fns.routeAll }
  } else {
    cableRouterStack.push({ id, routeOne: fns.routeOne, routeAll: fns.routeAll })
  }
}

/** Reroute a single cable using A*. Returns true if a path was found
 *  and written to the cable. Nutzt den aktiven (zuletzt gemounteten)
 *  Canvas-Router — im Rack-Overlay also dessen Scratch-Store-Router. */
export const routeCable = (cableId: string): boolean => {
  try {
    const r = activeCableRouter()
    return r ? r.routeOne(cableId) : false
  } catch {
    return false
  }
}

/** Reroute every cable using A*. Returns the number of cables that
 *  successfully found a path. */
export const routeAllCables = (): number => {
  try {
    const r = activeCableRouter()
    return r ? r.routeAll() : 0
  } catch {
    return 0
  }
}
