import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  updateEdge,
  useReactFlow,
  useViewport,
  useUpdateNodeInternals,
  ConnectionMode,
  SelectionMode,
  BackgroundVariant,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'
import {
  useCanvasProjectStore as useProjectStore,
  useCanvasProjectStoreInstance,
} from '../../store/projectStoreContext'
import { projectHistory } from '../../store/projectHistory'
import { confirmDialog } from '../../lib/confirmDialog'
import { useUiStore } from '../../store/uiStore'
import { netKeyOf } from '../../lib/offPageNet'
import {
  MIME_ANNOTATION as ANNOTATION_DRAG_MIME,
  MIME_EQUIPMENT,
  MIME_GROUP_PRESET,
  MIME_RACK_PRESET,
} from '../../lib/dragDropMimes'
import { AnnotationCanvasOverlay } from '../Annotations/AnnotationCanvasOverlay'
import type { EquipmentItem, EquipmentTemplate } from '../../types/equipment'
import type { Cable } from '../../types/cable'
import { EquipmentNode } from './EquipmentNode'
import { useCanvasCableRouter } from './useCanvasCableRouter'
import { useCanvasKeyboardShortcuts } from './useCanvasKeyboardShortcuts'
import { CableEdge } from './CableEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { LocationFrameNode } from './LocationFrameNode'
import { PendingCableOverlay } from './PendingCableOverlay'
import { InlineSelectionToolbar } from './InlineSelectionToolbar'
import { colorByLength } from '../../lib/cableColors'
import { promptDialog } from '../../lib/promptDialog'
import {
  setViewportCenterGetter,
  setCanvasSelectionClearer,
  setCanvasInteractionLockHandlers,
  setCanvasFitViewHandler,
  setCanvasDuplicateHandler,
  setCanvasZoomHandlers,
  setCanvasSelectAllHandler,
  triggerCanvasFitView,
  setCanvasCenterOnHandler,
} from '../../lib/canvasViewport'
import { createDemoProject } from '../../lib/demoProject'
import { CanvasSearch } from './CanvasSearch'
import { format, useTranslation } from '../../lib/i18n'

const nodeTypes = { equipment: EquipmentNode, location: LocationFrameNode }
const edgeTypes = { cable: CableEdge }

type CanvasMode = 'main' | 'rack'

/**
 * #zoomfix — Spiegelt JEDE Viewport-Änderung (inkl. PROGRAMMATISCHEM Zoom über
 * das Ansicht-Menü / die Toolbar-Buttons) in den Store, damit die StatusBar-
 * Zoom-Anzeige stimmt. ReactFlows `onMoveEnd` feuert nur bei Maus-/Wheel-Gesten,
 * NICHT bei `zoomIn/zoomOut/zoomTo({duration})` — daher zeigte die Anzeige nach
 * Menü-Zoom weiter „100 %", obwohl die Canvas tatsächlich zoomte. `useViewport()`
 * reflektiert dagegen den echten Viewport. Debounced geschrieben; setCanvasState
 * ist #382-history-gefiltert, erzeugt also keine Undo-Schritte.
 */
const ViewportStateSync = ({
  onChange,
}: {
  onChange: (x: number, y: number, zoom: number) => void
}) => {
  const { x, y, zoom } = useViewport()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(x, y, zoom), 150)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [x, y, zoom, onChange])
  return null
}

const CanvasContent = ({ mode = 'main' }: { mode?: CanvasMode }) => {
  const t = useTranslation()
  // #515 — stabile ID dieser CanvasArea-Instanz für die A*-Router-Registry.
  // Haupt- und Rack-Canvas teilen die Komponente, aber nicht die Instanz;
  // die ID hält ihre Router im Stack auseinander (siehe setCableRouter).
  const routerId = useId()
  // v7.9.9 — context-aware project store instance. Default = main store,
  // override = scratch store (z.B. RackInternalCanvas).
  const projectStoreInstance = useCanvasProjectStoreInstance()
  const project = useProjectStore((state) => state.project)
  const projectVersion = useProjectStore((state) => state.projectVersion)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const loadProjectIntoStore = useProjectStore((state) => state.loadProject)
  const pasteEquipment = useProjectStore((state) => state.pasteEquipment)
  const deleteEquipment = useProjectStore((state) => state.deleteEquipment)
  const deleteLocation = useProjectStore((state) => state.deleteLocation)
  const deleteCable = useProjectStore((state) => state.deleteCable)
  const queueConnection = useProjectStore((state) => state.queueConnection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const setCanvasState = useProjectStore((state) => state.setCanvasState)
  const deleteSelected = useProjectStore((state) => state.deleteSelected)
  const reconnectCable = useProjectStore((state) => state.reconnectCable)
  const addOpenEndStub = useProjectStore((state) => state.addOpenEndStub)
  const updateLocation = useProjectStore((state) => state.updateLocation)
  const moveLocationWithContents = useProjectStore((state) => state.moveLocationWithContents)
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const gridSize = useUiStore((state) => state.gridSize)
  // Issue #71: user-configurable canvas background pattern + opacity.
  const bgVariant = useUiStore((state) => state.bgVariant)
  const bgOpacity = useUiStore((state) => state.bgOpacity)
  const customPalette = useUiStore((state) => state.customPalette)
  const canvasBgImageDark = useUiStore((state) => state.canvasBgImageDark)
  const canvasBgImageLight = useUiStore((state) => state.canvasBgImageLight)
  const canvasBgImageFit = useUiStore((state) => state.canvasBgImageFit)
  const cableColorMode = useUiStore((state) => state.cableColorMode)
  const cableLabelShortForm = useUiStore((state) => state.cableLabelShortForm)
  const canvasTheme = useUiStore((state) => state.canvasTheme)
  const pdfExportThemeOverride = useUiStore((state) => state.pdfExportThemeOverride)
  const pendingCable = useUiStore((state) => state.pendingCable)
  const addPendingWaypoint = useUiStore((state) => state.addPendingWaypoint)
  const clearPendingCable = useUiStore((state) => state.clearPendingCable)
  const openCableEdit = useUiStore((state) => state.openCableEdit)
  const setHoveredCableId = useUiStore((state) => state.setHoveredCableId)
  const setHighlightedNetKey = useUiStore((state) => state.setHighlightedNetKey)
  // v7.8.7 — cable right-click context menu trigger.
  const openCableContextMenu = useUiStore((state) => state.openCableContextMenu)
  // #557 — Kontextmenüs schliessen sobald Canvas verschoben/gezoomt wird.
  const closeCableContextMenu = useUiStore((state) => state.closeCableContextMenu)
  // v7.9.3 — Projekt-Lock: 'finalized' und 'viewer' Modus blockieren
  // alle Bearbeitungs-Interaktionen am Canvas. Viewer kann zusätzlich
  // Annotations setzen (UI in CanvasToolbar + AnnotationsPanel).
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const projectIsLocked = projectMode === 'finalized' || projectMode === 'viewer'
  // v7.9.67 / #177 — Toolbar-Sperren für ganze Objektarten.
  const lockFrames = useUiStore((s) => s.lockFrames)
  const lockEquipment = useUiStore((s) => s.lockEquipment)
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Last screen-pixel mouse position over the canvas. Used by Strg++ quick-add
  // (#44) so the new device lands where the user pointed instead of always at
  // the viewport origin.
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const { screenToFlowPosition, setViewport, fitView, getEdges, getNodes, zoomIn, zoomOut, zoomTo, setCenter } = useReactFlow()
  const updateCable = useProjectStore((state) => state.updateCable)
  const updateNodeInternals = useUpdateNodeInternals()
  const [interactionLocked, setInteractionLocked] = useState(false)
  const interactionLockedRef = useRef(false)
  const lockTokensRef = useRef(0)
  const lockTimersRef = useRef<number[]>([])

  const requestInteractionLock = useCallback((durationMs = 450) => {
    lockTokensRef.current += 1
    interactionLockedRef.current = true
    setInteractionLocked(true)
    const id = window.setTimeout(() => {
      lockTokensRef.current = Math.max(0, lockTokensRef.current - 1)
      if (lockTokensRef.current === 0) {
        interactionLockedRef.current = false
        setInteractionLocked(false)
      }
      lockTimersRef.current = lockTimersRef.current.filter((timer) => timer !== id)
    }, durationMs)
    lockTimersRef.current.push(id)
  }, [])

  const unlockInteractionNow = useCallback(() => {
    lockTokensRef.current = 0
    for (const id of lockTimersRef.current) {
      window.clearTimeout(id)
    }
    lockTimersRef.current = []
    interactionLockedRef.current = false
    setInteractionLocked(false)
  }, [])

  // Expose canvas viewport centre to non-canvas components (LibraryPanel)
  // so click-added equipment lands where the user is currently looking.
  useEffect(() => {
    setViewportCenterGetter(() => {
      const el = wrapperRef.current
      if (!el) return null
      const r = el.getBoundingClientRect()
      return screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    })
    return () => setViewportCenterGetter(null)
  }, [screenToFlowPosition])

  useEffect(() => {
    setCanvasInteractionLockHandlers({
      requestLock: requestInteractionLock,
      unlock: unlockInteractionNow,
    })
    return () => {
      setCanvasInteractionLockHandlers(null)
      unlockInteractionNow()
    }
  }, [requestInteractionLock, unlockInteractionNow])

  // v7.9.0 / Issue #108 — expose fitView so the side panels can call
  // it after docking/undocking. Without this, undocking a wide panel
  // would leave devices outside the new viewport bounds and the user
  // reported "canvas verschwindet" because nodes scrolled off-screen.
  useEffect(() => {
    setCanvasFitViewHandler(() => fitView({ padding: 0.1, duration: 250 }))
    return () => setCanvasFitViewHandler(null)
  }, [fitView])

  // #ux — Canvas-Suche: auf ein Gerät zentrieren (Bridge wie fitView).
  useEffect(() => {
    setCanvasCenterOnHandler((x, y, zoom) => setCenter(x, y, { zoom: zoom ?? 1.2, duration: 400 }))
    return () => setCanvasCenterOnHandler(null)
  }, [setCenter])

  // #341 — Zoom rein/raus/100% aus dem Ansicht-Menü (Bridge wie fitView).
  useEffect(() => {
    setCanvasZoomHandlers({
      zoomIn: () => zoomIn({ duration: 200 }),
      zoomOut: () => zoomOut({ duration: 200 }),
      resetZoom: () => zoomTo(1, { duration: 200 }),
    })
    return () => setCanvasZoomHandlers(null)
  }, [zoomIn, zoomOut, zoomTo])

  // v7.8.8 / #468 — A*-Router-Registrierung (siehe useCanvasCableRouter).
  // Caller ist das Cable-Kontextmenü (und ein künftiger Settings-Toggle).
  useCanvasCableRouter(routerId, projectStoreInstance, updateCable, mode, project.equipment)

  // Restore saved viewport whenever a new project is loaded (projectVersion changes).
  // The initial render uses defaultViewport below; this effect handles
  // subsequent in-session project loads (open file, new project, sync pull).
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const cs = project.canvasState
    setViewport({ x: cs.x, y: cs.y, zoom: cs.zoom })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectVersion])

  const edgeUpdateSuccessful = useRef(true)
  const connectStartRef = useRef<{
    nodeId: string | null
    handleId: string | null
    handleType: 'source' | 'target' | null
  } | null>(null)
  // v7.9.128 — Flag das onConnect setzt wenn ein gueltiger Drop auf
  // einem Handle stattgefunden hat. onConnectEnd nutzt es um zu
  // entscheiden ob er einen Open-End-Stub erstellen soll oder nicht.
  // Loest das Problem dass die alte strict 'react-flow__pane'-
  // Detection bei Drops auf Edge-Labels / Grid-Pattern / etc. das
  // Open-End-Verhalten "verschluckt" hat.
  const connectMadeRef = useRef(false)
  // Group-drag support: when a location frame is being dragged, we remember
  // which equipment was inside at drag-start and the previous frame position,
  // so we can apply the delta to contained equipment live.
  const locationDragRef = useRef<{
    locationId: string
    lastX: number
    lastY: number
    containedEquipmentIds: string[]
  } | null>(null)

  // Memoise to ensure a stable reference when `project.locations` is undefined.
  // Otherwise `[]` would be a new array every render, causing `nodes` below to
  // be a new memo every render, which cascades into the `useEffect([nodes])`
  // calling `setRfNodes` on every render → infinite loop (React #185).
  const locations = useMemo(() => project.locations ?? [], [project.locations])
  const effectiveCanvasTheme = pdfExportThemeOverride ?? canvasTheme

  const nodes = useMemo<Node[]>(() => {
    // Location frames first so they render behind equipment.
    const locationNodes: Node[] = locations.map((loc) => ({
      id: loc.id,
      type: 'location',
      position: { x: loc.x, y: loc.y },
      data: { ...loc, exportThemeOverride: pdfExportThemeOverride },
      zIndex: -1,
      style: { width: loc.width, height: loc.height },
      // v7.9.68 — Per-Frame-Lock (#178) ODER globaler Toolbar-Lock (#177)
      // ODER Plan-Lock (#173 Punkt 3) blockiert Drag. Bisher hat das
      // per-node draggable: true den globalen nodesDraggable={false}
      // überschrieben, weshalb Rahmen auch im finalisierten Plan noch
      // verschiebbar waren.
      draggable: !loc.positionLocked && !lockFrames && !projectIsLocked,
      // v7.9.86 / #201 — Bei locked Locations auch Selection aus, sonst
      // erscheinen NodeResizer-Handles und ein versehentlicher Klick
      // wählt den Frame statt das darunterliegende Gerät. Das Schloss-
      // Plate selber bleibt klickbar via stopPropagation in LocationFrameNode.
      selectable: !loc.positionLocked,
    }))
    const equipmentNodes: Node[] = project.equipment.map((item) => ({
      id: item.id,
      type: 'equipment',
      position: { x: item.x, y: item.y },
      data: { ...item, exportThemeOverride: pdfExportThemeOverride },
      // v7.9.68 — analog für Geräte.
      draggable: !item.positionLocked && !lockEquipment && !projectIsLocked,
    }))
    return [...locationNodes, ...equipmentNodes]
  }, [project.equipment, locations, pdfExportThemeOverride, lockFrames, lockEquipment, projectIsLocked])

  // Local state keeps React Flow's controlled node positions in sync during drag.
  // We initialise once from the store and then apply changes incrementally.
  // A wholesale replace on every store update is avoided because it causes nodes
  // to jump when other items in the array are deleted/added.
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes)

  // Allow non-canvas components (LibraryPanel) to clear any active canvas
  // selection. Used when the cursor enters the library so a previously
  // moved-and-still-selected node can't participate in React Flow's
  // multi-select group drag on the next pointer event.
  useEffect(() => {
    setCanvasSelectionClearer(() => {
      setRfNodes((current) => {
        let changed = false
        const next = current.map((n) => {
          if (n.selected) {
            changed = true
            return { ...n, selected: false }
          }
          return n
        })
        return changed ? next : current
      })
      setSelection(undefined, undefined, undefined)
    })
    return () => setCanvasSelectionClearer(null)
  }, [setSelection])

  // #221 — Netz-Highlight: wenn ein Off-Page-Kabel selektiert ist, dessen
  // Netz-Schlüssel global setzen, sodass alle CableEdges desselben Netzes
  // mitleuchten ("alle verbundenen Segmente hervorheben"). Nicht-Off-Page
  // oder keine Auswahl → null (kein Highlight).
  useEffect(() => {
    const c = project.cables.find((x) => x.id === selectedCableId)
    setHighlightedNetKey(c && c.offPage ? netKeyOf(c) : null)
  }, [selectedCableId, project.cables, setHighlightedNetKey])

  // Briefly flash a node red when its drag is rejected due to overlap, so the
  // user understands why the device snapped back (not a glitch).
  const [overlapFlashId, setOverlapFlashId] = useState<string | null>(null)
  // v7.9.67 / #178 — Rechtsklick-Kontextmenü pro Node. {clientX, clientY} sind
  // Screen-Pixel (für die Position des Fixed-Overlays), nodeId/nodeType
  // identifizieren das angeklickte Element. null = Menu geschlossen.
  const [nodeContextMenu, setNodeContextMenu] = useState<
    | { clientX: number; clientY: number; nodeId: string; nodeType: 'equipment' | 'location' }
    | null
  >(null)
  const flashOverlap = (id: string) => {
    setOverlapFlashId(id)
    window.setTimeout(() => setOverlapFlashId(null), 500)
  }


  // Ids currently being dragged. While a node is in this set we preserve its
  // local React Flow position (so active drags don't snap back). Anything not
  // in the set takes its position from the store - that allows Undo/Redo to
  // move nodes back visually when the store reverts.
  const draggingIdsRef = useRef<Set<string>>(new Set())

  // v7.9.66 / #187 — Shift = Axis-Lock beim Drag. dragStartPositionsRef hält
  // pro Node-Id die Startposition (am dragstart aufgenommen), damit wir live
  // bei jedem dragging-Position-Change |dx| vs |dy| vergleichen und die
  // kleinere Achse auf den Startwert klemmen können. shiftKeyRef wird live
  // per window keydown/keyup gepflegt, damit der User Shift mitten im Drag
  // drücken/loslassen kann.
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const shiftKeyRef = useRef(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftKeyRef.current = e.shiftKey
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [])

  // Sync store → RF for structural changes (adds/removes) AND data changes
  // (name, ports, IP, etc. edited in the Properties panel). Position is kept
  // from the RF state during drags, but everything else flows store → RF so
  // edits are visible on the canvas immediately.
  const prevIdsRef = useRef<string>(nodes.map((n) => n.id).join(','))
  // Track the projectVersion that rfNodes were last fully synced from. When
  // the user opens a different project (or reopens the same project after
  // editing it elsewhere), `projectVersion` increments — and rfNodes MUST be
  // rebuilt from the store positions, otherwise the local rfNodes state
  // (which deliberately survives store updates to keep drag positions stable)
  // would keep stale positions that disagree with the freshly loaded file.
  // This was the root cause of the "Geräte verschoben beim Öffnen" bug.
  const lastSyncedProjectVersionRef = useRef(projectVersion)
  useEffect(() => {
    const changedIds: string[] = []
    const projectChanged = projectVersion !== lastSyncedProjectVersionRef.current
    setRfNodes((current) => {
      const currentById = new Map(current.map((n) => [n.id, n]))
      // When a different project was just loaded, throw away ALL local rfNode
      // state and rebuild straight from the freshly loaded store. Otherwise
      // any equipment that happens to share an id with the previous project
      // (e.g. reopening the same file) would keep its stale local position.
      if (projectChanged) {
        return nodes.map((n) => ({ ...n }))
      }
      // For every node that already exists in rfNodes we keep the existing
      // RF node object (position, selection flags, measured dimensions, etc.)
      // and only refresh `data` from the store. Existing-node positions are
      // owned by ReactFlow's drag events — never overwritten from the store
      // sync, regardless of how far apart they are. This is the only way to
      // guarantee that adding/editing other devices, port changes, or any
      // unrelated state update can NEVER visibly shift an existing device.
      // The previous threshold-based logic was the root cause of the
      // "existing nodes jump when adding from library" bug.
      return nodes.map((n) => {
        const existing = currentById.get(n.id)
        if (!existing) return n
        // Track nodes whose data changed so we can call updateNodeInternals
        // below. This tells ReactFlow to re-register handle positions so
        // cable edges re-route to the correct port after port edits (#20).
        if (existing.data !== n.data) changedIds.push(n.id)
        // v7.9.67 / #178 + #177 — `draggable` muss aus dem frisch berechneten
        // nodes-Memo durchgereicht werden, weil sich der Wert mit dem
        // Toolbar-Lock UND mit dem Per-Device-Lock ändern kann. Ohne diese
        // Zeile hätte rfNodes den Lock-State von der Erst-Initialisierung.
        return { ...existing, data: n.data, draggable: n.draggable }
      })
    })
    if (projectChanged) {
      // After a project switch every node needs its handles re-registered
      // so cable edges latch onto the correct port positions.
      updateNodeInternals(nodes.map((n) => n.id))
      lastSyncedProjectVersionRef.current = projectVersion
    }
    prevIdsRef.current = nodes.map((n) => n.id).join(',')
    // Re-register handles for nodes whose data changed (port additions,
    // removals, reorders, "Ports spiegeln" toggle). The setRfNodes above
    // schedules a render, so we call updateNodeInternals once now AND
    // again on the next animation frame — by then the EquipmentNode has
    // re-rendered with the new handle positions and ReactFlow can latch
    // existing cable edges onto the moved ports. Without the deferred
    // call, edges stayed pinned to the OLD handle positions after a
    // portsFlipped toggle.
    if (changedIds.length > 0) {
      updateNodeInternals(changedIds)
      const id = requestAnimationFrame(() => updateNodeInternals(changedIds))
      return () => cancelAnimationFrame(id)
    }
  }, [nodes, projectVersion, updateNodeInternals])

  const edges = useMemo<Edge[]>(
    () =>
      project.cables.map((item) => {
        const lengthColor = cableColorMode === 'byLength' ? colorByLength(item.length) : null
        // In byLength mode, cables with no matching length rule get a neutral grey so they're
        // visually distinct from manually-colored cables and easy to spot.
        const strokeColor =
          cableColorMode === 'byLength'
            ? (lengthColor ? lengthColor.color : '#64748b')
            : item.color
        const dashArray = item.dashed
          ? '6 4'
          : cableColorMode === 'byLength' && lengthColor?.dashArray
            ? lengthColor.dashArray
            : undefined
        return {
          id: item.id,
          source: item.fromEquipmentId,
          sourceHandle: item.fromPortId,
          target: item.toEquipmentId,
          targetHandle: item.toPortId,
          type: 'cable',
          updatable: true,
          style: { stroke: strokeColor, strokeWidth: item.strokeWidth ?? 2.5, strokeDasharray: dashArray },
          data: { cable: item, exportThemeOverride: pdfExportThemeOverride },
          label: (() => {
            // Issue #240 — Kabel-Label-Anzeige, kurz oder lang.
            // ShortForm (Default an): Format-Suffix in Klammern
            // (Pattern (NNNpNN[/NN]) o.ae.) wird aus dem Anzeige-Namen
            // entfernt, "SDI 3G (1080p50/60) (1m)" -> "SDI 3G (1m)".
            // Toggle ueber Toolbar (Defaults-Menue). Voller Name +
            // Standard sieht der User weiter in den Eigenschaften.
            const displayName = cableLabelShortForm
              ? item.name.replace(
                  /\s*\(\d{2,4}[pi]\d{2,3}(?:\/\d{2,3})?\)/gi,
                  '',
                ).trim()
              : item.name
            const base = `${displayName} (${item.length}m)`
            // Auto-Kabelnummerierung: Nummer als [Nr]-Praefix voranstellen.
            const numbered = item.cableNumber ? `[${item.cableNumber}] ${base}` : base
            return item.needsConverter ? `${numbered} ⚠ converter` : numbered
          })(),
        }
      }),
    [project.cables, cableColorMode, cableLabelShortForm, pdfExportThemeOverride],
  )

  // Helper: check if equipment position overlaps with others.
  // v7.9.69 / #183 — Ghost-Blocking-Fix:
  //  1. Bevorzuge die LIVE-gemessenen Dimensionen aus rfNodes (n.width /
  //     n.height) statt der im Store gespeicherten Werte. Stored width/
  //     height können veraltet sein (z.B. nach Port-Änderungen, die das
  //     Layout schrumpfen), während rfNodes immer das aktuelle DOM-
  //     Bounding-Rect kennt.
  //  2. EPSILON von 1 px Toleranz: AABB-Tests mit strenger <= Vergleichung
  //     melden bei exakter Kante-an-Kante-Adjazenz Overlap. 1 px Slack
  //     macht "an die Nachbar-Karte schmiegen" wieder möglich.
  const hasOverlap = useCallback((id: string, x: number, y: number, width: number, height: number): boolean => {
    const EPS = 1
    return project.equipment.some((eq) => {
      if (eq.id === id) return false
      const rfNode = rfNodes.find((n) => n.id === eq.id)
      const eqW = rfNode?.width ?? eq.width ?? 0
      const eqH = rfNode?.height ?? eq.height ?? 0
      if (eqW <= 0 || eqH <= 0) return false
      return !(
        x + width <= eq.x + EPS ||
        x + EPS >= eq.x + eqW ||
        y + height <= eq.y + EPS ||
        y + EPS >= eq.y + eqH
      )
    })
  }, [project.equipment, rfNodes])

  const onNodesChange = (changes: NodeChange[]) => {
    // snap helper used both in the locked and normal paths
    const snap = (v: number) =>
      snapToGrid && gridSize > 0 ? Math.round(v / gridSize) * gridSize : v

    // While a library item is being clicked/dragged onto the canvas, React Flow
    // may emit position changes for previously selected nodes as it reconciles
    // selection/drag state. Spurious changes must be ignored so adding a new
    // device cannot move existing devices.
    //
    // IMPORTANT: if the user released a canvas drag while the pointer happened
    // to be over the library (e.g. fast click: drag node → release on library
    // item), the drag-end `onNodesChange` fires here while the lock is active.
    // We MUST still persist that drag-end so the node stays at the drop
    // position. Without this, the store keeps the old pre-drag position, and
    // the next useEffect([nodes]) sync snaps the node back → visible jump.
    if (interactionLockedRef.current) {
      // Identify real drag-ends under lock (ids that were tracked in draggingIdsRef)
      const lockedEndedDragIds = new Set<string>()
      for (const change of changes) {
        if (change.type === 'position' && change.id) {
          if (change.dragging) {
            draggingIdsRef.current.add(change.id)
          } else if (draggingIdsRef.current.has(change.id)) {
            lockedEndedDragIds.add(change.id)
            draggingIdsRef.current.delete(change.id)
          }
        }
      }
      // Apply non-position changes + real drag-ends; skip all other position events
      const allowedChanges = changes.filter((c) => {
        if (c.type !== 'position') return true
        if (c.dragging) return false
        return lockedEndedDragIds.has(c.id)
      })
      if (allowedChanges.length > 0) {
        setRfNodes((current) => applyNodeChanges(allowedChanges, current))
      }
      // Persist drag-end positions to the store even though we're locked
      changes.forEach((change) => {
        if (
          change.type === 'position' &&
          change.position &&
          change.dragging === false &&
          lockedEndedDragIds.has(change.id)
        ) {
          const px = snap(change.position.x)
          const py = snap(change.position.y)
          const isLocation = locations.some((l) => l.id === change.id)
          if (isLocation) {
            updateLocation(change.id, { x: px, y: py })
          } else {
            updateEquipment(change.id, { x: px, y: py })
          }
          // Sync rfNodes to the snapped position so local visual state
          // matches the persisted store value.
          setRfNodes((current) =>
            current.map((n) =>
              n.id === change.id ? { ...n, position: { x: px, y: py } } : n,
            ),
          )
        }
      })
      return
    }

    // Track drag start/end per node so our store→RF sync knows which nodes
    // are currently being dragged (and therefore must keep their local pos).
    // Also record which ids were *just* dragging so we can distinguish a real
    // drag-end (persist position) from a spurious React Flow sync event (skip).
    // Without this guard, adding a new node emits `dragging: false` position
    // changes for *existing* nodes, which then slightly nudged them in the store.
    const endedDragIds = new Set<string>()
    for (const change of changes) {
      if (change.type === 'position' && change.id) {
        if (change.dragging) {
          draggingIdsRef.current.add(change.id)
        } else if (draggingIdsRef.current.has(change.id)) {
          endedDragIds.add(change.id)
          draggingIdsRef.current.delete(change.id)
        }
      }
    }

    // v7.9.66 / #187 — Shift = Axis-Lock. Bei jedem Position-Change (sowohl
    // dragging:true als auch dragging:false drag-end) |dx| vs |dy| vergleichen
    // und die kleinere Achse auf den am dragstart gespeicherten Startwert
    // klemmen. dragging:false MUSS auch geklemmt werden, weil ReactFlow das
    // finale drag-end auf Basis seiner eigenen Pointer-Tracking-State berechnet
    // (nicht aus unserem geklemmten rfNodes), sonst springt das Gerät beim
    // Loslassen an die ungeklemmte Position. shiftKeyRef wird live durch
    // window keydown/keyup gepflegt, damit Shift auch mitten im Drag
    // gedrückt/losgelassen werden kann.
    if (shiftKeyRef.current) {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const start = dragStartPositionsRef.current.get(change.id)
          if (start) {
            const dx = change.position.x - start.x
            const dy = change.position.y - start.y
            if (Math.abs(dx) >= Math.abs(dy)) {
              change.position = { x: change.position.x, y: start.y }
              if (change.positionAbsolute) {
                change.positionAbsolute = {
                  x: change.positionAbsolute.x,
                  y: change.positionAbsolute.y - dy,
                }
              }
            } else {
              change.position = { x: start.x, y: change.position.y }
              if (change.positionAbsolute) {
                change.positionAbsolute = {
                  x: change.positionAbsolute.x - dx,
                  y: change.positionAbsolute.y,
                }
              }
            }
          }
        }
      }
    }

    // Hinweis: dragStartPositionsRef wird NICHT hier geleert — sondern erst in
    // onNodeDragStop. Sonst hätte die finale Persistierung in onNodeDragStop
    // (die auf node.position basiert, NICHT auf den oben geklemmten changes)
    // keine Startposition mehr und würde die ungeklemmte Position speichern.
    
    // v7.9.68 / #173 — Resize-driven position changes. NodeResizer dispatches
    // a paired (position + dimensions) Änderung wenn der User am W/N-Handle
    // zieht. Ohne diese Erkennung würde der position-Change vom Filter unten
    // verworfen → nur width/height wachsen, x bleibt → Rahmen "wächst" auf
    // der falschen Seite (Bug "links vergrößern → rechts wächst").
    const resizingIds = new Set<string>()
    for (const change of changes) {
      if (change.type === 'dimensions' && change.dimensions) {
        resizingIds.add(change.id)
      }
    }

    // Filter out spurious `position` changes that React Flow emits during
    // internal syncs (e.g. after a node is added or its dimensions change).
    // These have `dragging === false` but the id is *not* in `endedDragIds`
    // because no real drag took place. If we let `applyNodeChanges` apply
    // them, unrelated nodes visibly nudge in `rfNodes` every time a device is
    // added or its port count changes — until the next store→RF sync resets
    // them. The persist branch below is already guarded; this guards the
    // visual side too.
    const filteredChanges = changes.filter((change) => {
      if (change.type !== 'position') return true
      if (change.dragging) return true
      if (endedDragIds.has(change.id)) return true
      // v7.9.68 / #173 — Resize-driven position-Changes durchlassen.
      if (resizingIds.has(change.id)) return true
      return false
    })

    // Update rfNodes during drag for visual feedback only
    setRfNodes((current) => {
      const next = applyNodeChanges(filteredChanges, current)
      // Live group-drag: if a location is being dragged, shift contained equipment
      const drag = locationDragRef.current
      if (drag) {
        const posChange = changes.find(
          (c) =>
            c.type === 'position' &&
            c.id === drag.locationId &&
            c.position &&
            c.dragging === true,
        ) as Extract<NodeChange, { type: 'position' }> | undefined
        if (posChange && posChange.position) {
          const dx = posChange.position.x - drag.lastX
          const dy = posChange.position.y - drag.lastY
          if (dx || dy) {
            const shifted = new Set(drag.containedEquipmentIds)
            drag.lastX = posChange.position.x
            drag.lastY = posChange.position.y
            return next.map((n) =>
              shifted.has(n.id)
                ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
                : n,
            )
          }
        }
      }
      return next
    })

    // v7.9.69 / #184 — Multi-Select-Drag: Sammele die Delta-Verschiebungen
    // pro Equipment-Id. Nach der Schleife shiften wir alle Kabel-Waypoints
    // dazwischen, damit die "kleben-gebliebenen" Knickpunkte mit umziehen.
    const equipmentDeltas = new Map<string, { dx: number; dy: number }>()

    // v7.9.92 — Wenn dieser onNodesChange-Aufruf ein Drag-End enthält
    // (endedDragIds.size > 0), startet eine History-Transaktion damit
    // ALLE folgenden updateEquipment + updateCable als EIN Undo-Schritt
    // landen. Sonst hatte ein Multi-Select-Drag von 5 Geräten mit 3
    // mitgezogenen Cable-Waypoints am Ende 8 Undo-Schritte erzeugt.
    const isDragEndBatch = endedDragIds.size > 0
    if (isDragEndBatch) projectHistory.beginTransaction()

    // Persist to store ONLY on a real drag-end. `change.dragging === false`
    // alone is not enough — React Flow emits those during internal syncs too,
    // which would nudge unrelated nodes whenever a new one is added.
    //
    // We also snap the persisted position when snapToGrid is enabled, so the
    // store stays in sync with the snapped position React Flow shows in
    // `rfNodes`. Without this, store and rfNodes drift by sub-grid amounts,
    // and any subsequent re-sync (e.g. after adding a new equipment item)
    // would cause existing nodes to visibly jump to their raw positions.
    changes.forEach((change) => {
      if (
        change.type === 'position' &&
        change.position &&
        change.dragging === false &&
        endedDragIds.has(change.id)
      ) {
        const px = snap(change.position.x)
        const py = snap(change.position.y)
        // CRITICAL: Ensure snapped positions are valid numbers. Prevent NaN
        // from being persisted if snap() or any calculation somehow produces NaN.
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          console.warn(`[CanvasArea] Drag-end produced invalid position: (${px}, ${py}) for node ${change.id}`)
          return
        }
        const isLocation = locations.some((l) => l.id === change.id)
        if (isLocation) {
          const drag = locationDragRef.current
          const loc = locations.find((l) => l.id === change.id)
          if (drag && drag.locationId === change.id && loc) {
            const dx = px - loc.x
            const dy = py - loc.y
            moveLocationWithContents(change.id, dx, dy, drag.containedEquipmentIds)
            // Sync rfNodes for the location AND every contained equipment to
            // the snapped delta so visuals match the store.
            const containedSet = new Set(drag.containedEquipmentIds)
            setRfNodes((current) =>
              current.map((n) => {
                if (n.id === change.id) {
                  return { ...n, position: { x: px, y: py } }
                }
                if (containedSet.has(n.id)) {
                  return {
                    ...n,
                    position: { x: n.position.x + dx, y: n.position.y + dy },
                  }
                }
                return n
              }),
            )
          } else {
            updateLocation(change.id, { x: px, y: py })
            setRfNodes((current) =>
              current.map((n) =>
                n.id === change.id ? { ...n, position: { x: px, y: py } } : n,
              ),
            )
          }
          locationDragRef.current = null
        } else {
          // Check overlap before persisting. v7.9.69 / #183 — use live
          // measured dimensions from rfNodes if available, so stale stored
          // width/height can't cause ghost-blocking.
          const eq = project.equipment.find((e) => e.id === change.id)
          const movedRfNode = rfNodes.find((n) => n.id === change.id)
          const movedW = movedRfNode?.width ?? eq?.width ?? 0
          const movedH = movedRfNode?.height ?? eq?.height ?? 0
          if (eq && hasOverlap(eq.id, px, py, movedW, movedH)) {
            // Revert to last position and flash the node red so the user
            // understands why it snapped back (not a bug).
            const lastRfNode = rfNodes.find((n) => n.id === change.id)
            if (lastRfNode) {
              setRfNodes((current) =>
                current.map((n) =>
                  n.id === change.id ? { ...n, position: lastRfNode.position } : n,
                ),
              )
            }
            flashOverlap(change.id)
          } else {
            // v7.9.69 / #184 — Verschiebungs-Delta merken für späteres
            // Mit-Verschieben von Kabel-Waypoints in Group-Drags.
            if (eq) {
              equipmentDeltas.set(change.id, { dx: px - eq.x, dy: py - eq.y })
            }
            updateEquipment(change.id, { x: px, y: py })
            console.log('[drag-end persist]', {
              id: change.id,
              raw: change.position,
              snapped: { x: px, y: py },
              snapToGrid,
              gridSize,
            })
            // CRITICAL: Also overwrite rfNodes with the SNAPPED position so
            // local visual state and the store agree. Otherwise rfNodes keeps
            // the raw (unsnapped) drag position while the store has the
            // snapped one — saving then persists the snapped value, but the
            // user sees the unsnapped one in the canvas. After re-opening the
            // file, every device appears shifted by its individual sub-grid
            // drift amount.
            setRfNodes((current) =>
              current.map((n) =>
                n.id === change.id ? { ...n, position: { x: px, y: py } } : n,
              ),
            )
          }
        }
      }
      if (change.type === 'dimensions' && change.dimensions) {
        const isLocation = locations.some((l) => l.id === change.id)
        if (isLocation) {
          const loc = locations.find((l) => l.id === change.id)
          const newW = Math.max(40, change.dimensions.width)
          const newH = Math.max(40, change.dimensions.height)
          if (!loc || loc.width !== newW || loc.height !== newH) {
            updateLocation(change.id, { width: newW, height: newH })
          }
        } else {
          // v7.9.84 / #206 — Equipment-Dimensionen ebenfalls persistieren.
          // Vorher wurden nur Location-Dimensions ins Store geschrieben;
          // Equipment-eq.height blieb auf dem initialen Wert (oft 0 für
          // den RackInternalCanvas der mit `height: 0` initialisiert).
          // Folge: hasOverlap-Tests konnten falsche Ergebnisse liefern
          // wenn rfNode-Measure noch nicht stable war → "Ghost-Blocking
          // obwohl Stelle leer" (Bug 2 in Issue #206). Mit gespeicherten
          // measured Dimensions ist die fallback-Kette
          // rfNode?.width ?? eq.width ?? 0 immer stabil.
          const eq = project.equipment.find((e) => e.id === change.id)
          const newW = Math.max(40, Math.round(change.dimensions.width))
          const newH = Math.max(20, Math.round(change.dimensions.height))
          // Diff-Check + Threshold: nur persistieren wenn nennenswert anders
          // (mind. 2 px), um Re-Render-Loop durch Mini-Float-Schwankungen zu
          // vermeiden.
          if (eq && (Math.abs((eq.width ?? 0) - newW) > 2 || Math.abs((eq.height ?? 0) - newH) > 2)) {
            updateEquipment(change.id, { width: newW, height: newH })
          }
        }
      }
      // v7.9.68 / #173 — Resize-driven position-Change persistieren. Beim
      // Anfassen des W/N-Handles emittiert NodeResizer ZUSÄTZLICH zum
      // dimensions-Change einen position-Change mit neuer x/y (damit der
      // Rahmen tatsächlich auf der Anfassen-Seite wächst und nicht auf der
      // gegenüberliegenden). Wenn wir den nur visuell anwenden aber nicht im
      // Store speichern, springt der Rahmen beim nächsten Store→RF-Sync
      // zurück auf die alte x/y → das gefühlte "wächst auf der falschen
      // Seite"-Verhalten kehrt zurück.
      if (
        change.type === 'position' &&
        change.position &&
        resizingIds.has(change.id) &&
        !endedDragIds.has(change.id) &&
        !change.dragging
      ) {
        const isLocation = locations.some((l) => l.id === change.id)
        if (isLocation) {
          const loc = locations.find((l) => l.id === change.id)
          const nx = change.position.x
          const ny = change.position.y
          if (loc && (loc.x !== nx || loc.y !== ny)) {
            updateLocation(change.id, { x: nx, y: ny })
          }
        }
      }
    })

    // v7.9.69 / #184 — Cable-Waypoints mit-verschieben bei Multi-Select-Drag.
    // Konsistent zu moveLocationWithContents (Location-Group-Drag): wenn
    // mindestens EIN Endpunkt eines Kabels mit verschoben wird, shiften wir
    // dessen Waypoints um den gleichen Delta-Vektor mit. Sonst "kleben" die
    // Knickpunkte am Canvas und das Kabel verbiegt sich grotesk.
    if (equipmentDeltas.size > 0) {
      // Alle Deltas sollten identisch sein (ReactFlow shift't alle selected
      // Nodes um denselben Pointer-Delta), aber wir nehmen den ersten als
      // Referenz für die Waypoint-Verschiebung.
      const firstDelta = equipmentDeltas.values().next().value
      if (firstDelta && (firstDelta.dx !== 0 || firstDelta.dy !== 0)) {
        for (const cable of project.cables) {
          const fromMoved = equipmentDeltas.has(cable.fromEquipmentId)
          const toMoved = equipmentDeltas.has(cable.toEquipmentId)
          if ((fromMoved || toMoved) && cable.waypoints?.length) {
            // Nur shiften wenn BEIDE Endpunkte zusammen verschoben wurden
            // — sonst werden die Waypoints "verbogen" weil ein Endpunkt
            // bleibt wo er war. Bei einem-endpoint-Drag ist die "klebende"
            // Variante das geringere Übel.
            if (fromMoved && toMoved) {
              const shifted = cable.waypoints.map((wp) => ({
                x: wp.x + firstDelta.dx,
                y: wp.y + firstDelta.dy,
              }))
              updateCable(cable.id, { waypoints: shifted })
            }
          }
        }
      }
    }

    // v7.9.92 — Drag-End-Transaktion schließen (siehe oben).
    if (isDragEndBatch) projectHistory.endTransaction()
  }

  // v7.9.67 / #178 — Rechtsklick → Kontextmenü mit "Position sperren".
  // ReactFlow's onNodeContextMenu liefert das React-Event und den Node;
  // wir verhindern das native Browser-Menü und positionieren ein eigenes
  // kleines Popup über den Cursor.
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.type !== 'equipment' && node.type !== 'location') return
      event.preventDefault()
      setNodeContextMenu({
        clientX: event.clientX,
        clientY: event.clientY,
        nodeId: node.id,
        nodeType: node.type,
      })
    },
    [],
  )

  // ESC oder Klick außerhalb → Menu schließen.
  useEffect(() => {
    if (!nodeContextMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNodeContextMenu(null)
    }
    const onClick = () => setNodeContextMenu(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [nodeContextMenu])

  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // v7.9.66 / #187 — Snapshot Startpositionen für Axis-Lock. Sowohl die
      // Position des direkt gegriffenen Nodes als auch aller mitgewählten
      // Nodes (Multi-Select-Drag) werden eingefroren, damit shift-axis-lock
      // pro Node die korrekte Achse klemmen kann.
      shiftKeyRef.current = event.shiftKey
      dragStartPositionsRef.current.clear()
      const snapshot = (id: string) => {
        const rfNode = rfNodes.find((n) => n.id === id)
        if (rfNode) {
          dragStartPositionsRef.current.set(id, {
            x: rfNode.position.x,
            y: rfNode.position.y,
          })
        }
      }
      snapshot(node.id)
      for (const n of rfNodes) {
        if (n.selected && n.id !== node.id) snapshot(n.id)
      }

      if (node.type !== 'location') return
      const loc = locations.find((l) => l.id === node.id)
      if (!loc) return
      // By default a location frame moves independently; contained equipment
      // only follows when `moveContents` is not explicitly disabled.
      // v7.9.93 / #194 — Default ist seit v7.9.81 'true' (siehe addLocation),
      // aber BESTEHENDE Locations aus älteren Projekten haben das Feld
      // gar nicht (undefined) → vorher wurde das wie 'false' behandelt
      // und der User-Erwartung widersprochen. Jetzt: `false` heisst
      // explizit aus, alles andere (undefined oder true) = mitziehen.
      if (loc.moveContents === false) {
        locationDragRef.current = null
        return
      }
      const contained = project.equipment
        .filter((e) => {
          const cx = e.x + (e.width ?? 0) / 2
          const cy = e.y + (e.height ?? 0) / 2
          return cx >= loc.x && cx <= loc.x + loc.width && cy >= loc.y && cy <= loc.y + loc.height
        })
        .map((e) => e.id)
      locationDragRef.current = {
        locationId: loc.id,
        lastX: loc.x,
        lastY: loc.y,
        containedEquipmentIds: contained,
      }
    },
    [locations, project.equipment, rfNodes],
  )

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const snap = (v: number) =>
      snapToGrid && gridSize > 0 ? Math.round(v / gridSize) * gridSize : v

    // v7.9.66 / #187 — Final Axis-Lock auf node.position. ReactFlow trackt
    // die Drag-Position intern aus dem Pointer (nicht aus unserem geklemmten
    // rfNodes), deshalb kommt hier die UNgeklemmte Endposition rein. Wir
    // klemmen mit der gespeicherten Startposition nach derselben Regel wie
    // im onNodesChange-Block (kleinere Achse = Lock).
    let lockedPos = { x: node.position.x, y: node.position.y }
    if (shiftKeyRef.current) {
      const start = dragStartPositionsRef.current.get(node.id)
      if (start) {
        const dx = node.position.x - start.x
        const dy = node.position.y - start.y
        if (Math.abs(dx) >= Math.abs(dy)) {
          lockedPos = { x: node.position.x, y: start.y }
        } else {
          lockedPos = { x: start.x, y: node.position.y }
        }
      }
    }
    const px = snap(lockedPos.x)
    const py = snap(lockedPos.y)

    if (Number.isFinite(px) && Number.isFinite(py)) {
      if (node.type === 'location') {
        const drag = locationDragRef.current
        const loc = locations.find((l) => l.id === node.id)
        if (drag && drag.locationId === node.id && loc) {
          const dx = px - loc.x
          const dy = py - loc.y
          if (dx || dy) {
            moveLocationWithContents(node.id, dx, dy, drag.containedEquipmentIds)
          }
        } else if (loc && (loc.x !== px || loc.y !== py)) {
          updateLocation(node.id, { x: px, y: py })
        }
      } else {
        const eq = project.equipment.find((e) => e.id === node.id)
        if (eq && (eq.x !== px || eq.y !== py)) {
          // v7.9.69 / #183 — measured size > stored size (siehe hasOverlap).
          const movedW = node.width ?? eq.width ?? 0
          const movedH = node.height ?? eq.height ?? 0
          if (hasOverlap(eq.id, px, py, movedW, movedH)) {
            setRfNodes((current) =>
              current.map((n) =>
                n.id === node.id ? { ...n, position: { x: eq.x, y: eq.y } } : n,
              ),
            )
            flashOverlap(node.id)
          } else {
            updateEquipment(node.id, { x: px, y: py })
            setRfNodes((current) =>
              current.map((n) =>
                n.id === node.id ? { ...n, position: { x: px, y: py } } : n,
              ),
            )
          }
        }
      }
    }

    // A completed drag must not leave any ids behind. If stale ids remain here,
    // a later library add can make React Flow emit `dragging:false` position
    // syncs for those ids, which our persistence logic would otherwise treat as
    // another real drag-end and move unrelated devices.
    draggingIdsRef.current.clear()
    // v7.9.66 / #187 — Axis-Lock-Startpositionen freigeben. Erst hier (nicht
    // schon in onNodesChange), damit der oben durchgeführte Final-Lock noch
    // auf einen gültigen Snapshot zugreifen konnte.
    dragStartPositionsRef.current.clear()
    if (node.type === 'location') {
      // Clear any stale location drag snapshot so unrelated future node
      // changes (like adding equipment by click) cannot shift other nodes.
      locationDragRef.current = null
    }
  }, [gridSize, hasOverlap, locations, moveLocationWithContents, project.equipment, snapToGrid, updateEquipment, updateLocation])

  const onEdgesChange = (_changes: EdgeChange[]) => {
    applyEdgeChanges(_changes, edges)
  }

  // v7.9.90 — useCallback statt freier Funktion. Vorher wurde onConnect
  // bei JEDEM Render neu erzeugt → ReactFlow re-attachte interne Listener
  // (kein Korrektheitsbug aber unnötiger Overhead). project.equipment in
  // den deps damit der closure-capture korrekt ist — zustand triggert
  // sowieso re-render bei Project-Änderungen.
  const onConnect: OnConnect = useCallback(
    (connection) => {
      // ReactFlow's ConnectionMode.Loose lets the user drag from any handle
      // (including the transparent overlay handle on each port). When they
      // drag from an Input to an Output, ReactFlow picks the drag-origin
      // handle as `source` — which leaves the cable arrow pointing the wrong
      // way (Input → Output). Normalise here so the canonical signal flow
      // (output → input) is preserved regardless of which end the user
      // started from.
      // v7.9.128 — Flag setzen damit onConnectEnd weiss: hier wurde
      // eine echte Verbindung gemacht, KEIN Open-End-Stub mehr noetig.
      connectMadeRef.current = true
      if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
        const sourceEq = project.equipment.find((e) => e.id === connection.source)
        const targetEq = project.equipment.find((e) => e.id === connection.target)
        const sourceIsOutput = !!sourceEq?.outputs.find((p) => p.id === connection.sourceHandle)
        const targetIsOutput = !!targetEq?.outputs.find((p) => p.id === connection.targetHandle)
        if (!sourceIsOutput && targetIsOutput) {
          queueConnection({
            source: connection.target,
            sourceHandle: connection.targetHandle,
            target: connection.source,
            targetHandle: connection.sourceHandle,
          })
          return
        }
      }
      queueConnection(connection)
    },
    [project.equipment, queueConnection],
  )

  // Reconnect / drag endpoints (draw.io-like).
  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false
  }, [])

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeUpdateSuccessful.current = true
      if (!newConnection.source || !newConnection.target) return
      // Determine which endpoint changed.
      if (
        newConnection.source !== oldEdge.source ||
        newConnection.sourceHandle !== oldEdge.sourceHandle
      ) {
        reconnectCable(
          oldEdge.id,
          'source',
          newConnection.source,
          newConnection.sourceHandle ?? '',
        )
      }
      if (
        newConnection.target !== oldEdge.target ||
        newConnection.targetHandle !== oldEdge.targetHandle
      ) {
        reconnectCable(
          oldEdge.id,
          'target',
          newConnection.target,
          newConnection.targetHandle ?? '',
        )
      }
      // keep React Flow's internal edge list consistent for the frame
      updateEdge(oldEdge, newConnection, edges)
    },
    [edges, reconnectCable],
  )

  const onEdgeUpdateEnd = useCallback(() => {
    // If drop missed, leave edge untouched (user can retry). We intentionally
    // do NOT delete on miss to avoid accidental cable loss.
    edgeUpdateSuccessful.current = true
  }, [])

  // Open-end support: remember handle where a new connection started.
  const onConnectStart = useCallback(
    (
      _event: React.MouseEvent | React.TouchEvent,
      params: { nodeId: string | null; handleId: string | null; handleType: 'source' | 'target' | null },
    ) => {
      connectStartRef.current = params
      // v7.9.128 — Reset flag fuer neue Drag-Session. Wird in onConnect
      // gesetzt wenn der Drop auf einem gueltigen Handle landet.
      connectMadeRef.current = false
    },
    [],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current
      connectStartRef.current = null
      if (!start || !start.nodeId || !start.handleId || !start.handleType) return
      // #295 — Im finalized/viewer-Modus keine Open-End-Stubs anlegen.
      // ReactFlow's `nodesConnectable={!projectIsLocked}` blockiert den
      // Connect-Start schon, aber Touch-/Mouse-Events koennen den Drag
      // dennoch aufmachen wenn der User waehrend des Drags den Lock
      // umschaltet; dieser Guard ist die zweite Verteidigungslinie.
      if (projectIsLocked) return

      // v7.9.128 — Wenn onConnect schon eine Verbindung gemacht hat,
      // KEIN Open-End-Stub mehr drueber legen. Der frueher hier
      // verwendete strict 'react-flow__pane'-Check hatte das Problem,
      // dass Drops auf Cable-Edge-Labels, Grid-Pattern-SVG, Layer-
      // Overlay-Buttons, Location-Frame-Labels usw. ALLE als
      // "nicht auf der Pane" galten und der Drag-To-Open-End
      // schweigend nichts tat — obwohl der User klar einen Stub
      // wollte. Stattdessen: Drop auf einen Port (handle) -> hat
      // onConnect schon gemacht. Sonst (egal wo auf der Canvas) ->
      // Open-End-Stub.
      if (connectMadeRef.current) {
        connectMadeRef.current = false
        return
      }
      // Sicherheitscheck: trotzdem nicht stub'en, wenn das Mouse-Up
      // direkt auf einem Handle landete (ReactFlow konnte's evtl.
      // nicht als Connect interpretieren, soll aber auch kein Stub
      // erzeugen — z.B. Drop auf inkompatiblen Handle-Typ).
      const target = event.target as HTMLElement | null
      if (target?.closest('.react-flow__handle')) return

      // Resolve clientX/Y for mouse or touch.
      const pt =
        'clientX' in event
          ? { x: event.clientX, y: event.clientY }
          : event.changedTouches && event.changedTouches[0]
            ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
            : null
      if (!pt) return
      const flowPos = screenToFlowPosition(pt)

      // Find source connector type to mirror on the stub.
      const srcEquipment = project.equipment.find((e) => e.id === start.nodeId)
      if (!srcEquipment) return
      const srcPort =
        start.handleType === 'source'
          ? srcEquipment.outputs.find((p) => p.id === start.handleId)
          : srcEquipment.inputs.find((p) => p.id === start.handleId)
      if (!srcPort) return

      const stubSide: 'input' | 'output' = start.handleType === 'source' ? 'input' : 'output'
      // Snap stub position so floats from screenToFlowPosition (e.g. at
      // zoom 1.5) don't sneak into the store.
      const rawX = flowPos.x - 70
      const rawY = flowPos.y - 30
      const stubX = snapToGrid && gridSize > 0
        ? Math.round(rawX / gridSize) * gridSize
        : Math.round(rawX)
      const stubY = snapToGrid && gridSize > 0
        ? Math.round(rawY / gridSize) * gridSize
        : Math.round(rawY)
      const encoded = addOpenEndStub({ x: stubX, y: stubY }, srcPort.connectorType, stubSide)
      const [stubId, stubPortId] = encoded.split('|')

      // Queue cable dialog just like a normal connection.
      if (start.handleType === 'source') {
        queueConnection({
          source: start.nodeId,
          sourceHandle: start.handleId,
          target: stubId,
          targetHandle: stubPortId,
        })
      } else {
        queueConnection({
          source: stubId,
          sourceHandle: stubPortId,
          target: start.nodeId,
          targetHandle: start.handleId,
        })
      }
    },
    [addOpenEndStub, project.equipment, queueConnection, screenToFlowPosition, snapToGrid, gridSize, projectIsLocked],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    // dropEffect MUST match the source's effectAllowed, otherwise the
    // browser shows the forbidden cursor. Annotations are dragged with
    // effectAllowed='move' (re-anchor existing entity), equipment
    // templates with the default 'copy' (clone into new instance).
    const types = event.dataTransfer.types
    event.dataTransfer.dropEffect =
      types && Array.from(types).includes(ANNOTATION_DRAG_MIME) ? 'move' : 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const snapX = (n: number): number =>
        snapToGrid && gridSize > 0 ? Math.round(n / gridSize) * gridSize : Math.round(n)

      // v7.9.5 — Annotations-Drop. Wenn das DataTransfer eine
      // Annotation-ID enthält, re-anchor sie. Über einem Geräte-DOM-
      // Knoten → anchor.type='device', sonst frei mit Drop-Position.
      const annotationId = event.dataTransfer.getData(ANNOTATION_DRAG_MIME)
      if (annotationId) {
        const target = event.target as HTMLElement | null
        const deviceEl = target?.closest('.react-flow__node-equipment') as HTMLElement | null
        const deviceId = deviceEl?.getAttribute('data-id') ?? null
        const updateAnnotation = projectStoreInstance.getState().updateAnnotation
        if (deviceId) {
          updateAnnotation(annotationId, {
            anchor: { type: 'device', deviceId },
          })
        } else {
          updateAnnotation(annotationId, {
            anchor: { type: 'free', x: snapX(position.x), y: snapX(position.y) },
          })
        }
        return
      }

      // v7.9.15 — Rack-Preset-Drop. Wenn ein Black-Box-Rack aus der
      // Library-Racks-Tab gezogen wird, fügen wir es als ein einziges
      // Equipment-Item (Black-Box) am Drop-Punkt ein.
      const rackPresetId = event.dataTransfer.getData(MIME_RACK_PRESET)
      if (rackPresetId) {
        if (mode === 'rack') return
        const px = snapX(position.x)
        const py = snapX(position.y)
        projectStoreInstance.getState().insertBlackBoxRack(rackPresetId, px, py)
        return
      }
      // v7.9.16 — Group-Preset-Drop (Non-Rack-Gruppen). Funktioniert wie
      // der Platzieren-Button: spawn die Geräte mit Internal-Cables am
      // Drop-Punkt (placeGroupPreset).
      const groupPresetId = event.dataTransfer.getData(MIME_GROUP_PRESET)
      if (groupPresetId) {
        if (mode === 'rack') return
        const px = snapX(position.x)
        const py = snapX(position.y)
        projectStoreInstance.getState().placeGroupPreset(groupPresetId, px, py)
        return
      }

      const payload = event.dataTransfer.getData(MIME_EQUIPMENT)
      if (!payload) {
        return
      }
      // v7.9.10 — In rack-mode keine Library-Drops. Geräte werden im
      // Rack-Builder via "+ Rack"-Button hinzugefügt, nicht durch
      // Drag-Drop vom Haupt-Library-Panel ins Sub-Canvas.
      if (mode === 'rack') return
      try {
        const template = JSON.parse(payload) as EquipmentTemplate
        // Snap drop-position to grid (or at least to integer) so the store
        // never receives sub-pixel floats from screenToFlowPosition.
        const px = snapX(position.x)
        const py = snapX(position.y)
        // v7.9.108 / Issue #225 — Wenn das Template KEINE Ports hat,
        // direkten addEquipment-Call ueberspringen und stattdessen den
        // 'Eigenes Geraet anlegen'-Dialog im LibraryPanel oeffnen. Der
        // User muss erst Ports definieren (oder AI fragen) bevor das
        // Geraet auf dem Canvas landet.
        const hasNoPorts =
          (template.inputs?.length ?? 0) === 0 && (template.outputs?.length ?? 0) === 0
        if (hasNoPorts) {
          useUiStore.getState().triggerEmptyDeviceDrop({
            name: template.name ?? '',
            category: template.category ?? '',
            x: px,
            y: py,
          })
          return
        }
        addEquipment({ ...template, x: px, y: py })
      } catch (error) {
        console.error('Failed to drop equipment:', error)
      }
    },
    [addEquipment, screenToFlowPosition, snapToGrid, gridSize, mode, projectStoreInstance],
  )

  // In-app clipboard for Ctrl+C / Ctrl+V. Snapshots the selected equipment
  // and any cables that connect them at copy time, so paste keeps working
  // even if the source items are later edited or deleted.
  const clipboardRef = useRef<{ items: EquipmentItem[]; cables: Cable[] } | null>(null)
  // Number of consecutive pastes from the same clipboard, used to spread
  // copies diagonally instead of stacking them on the same spot.
  const pasteCountRef = useRef(0)

  const getSelectedEquipmentIds = useCallback((): string[] => {
    return rfNodes
      .filter((n) => n.type === 'equipment' && n.selected)
      .map((n) => n.id)
  }, [rfNodes])

  const copySelectionToClipboard = useCallback(() => {
    const ids = getSelectedEquipmentIds()
    if (ids.length === 0) return false
    const idSet = new Set(ids)
    const items = project.equipment.filter((e) => idSet.has(e.id))
    if (items.length === 0) return false
    const cables = project.cables.filter(
      (c) => idSet.has(c.fromEquipmentId) && idSet.has(c.toEquipmentId),
    )
    // Deep-clone via JSON so subsequent edits don't mutate the snapshot.
    clipboardRef.current = JSON.parse(JSON.stringify({ items, cables })) as {
      items: EquipmentItem[]
      cables: Cable[]
    }
    pasteCountRef.current = 0
    return true
  }, [getSelectedEquipmentIds, project.equipment, project.cables])

  const pasteFromClipboard = useCallback(() => {
    const snap = clipboardRef.current
    if (!snap || snap.items.length === 0) return
    pasteCountRef.current += 1
    const step = 30 * pasteCountRef.current
    // v7.9.92 — Paste = ein Undo-Schritt (pasteEquipment + setSelection
    // sind 2 separate Store-Mutationen).
    const newIds = projectHistory.transact(() =>
      pasteEquipment(snap.items, snap.cables, { dx: step, dy: step }),
    )
    if (newIds.length === 0) return
    const newIdSet = new Set(newIds)
    // Reflect the new selection visually in React Flow.
    setRfNodes((current) =>
      current.map((n) => {
        if (n.type === 'equipment' && newIdSet.has(n.id)) return { ...n, selected: true }
        if (n.selected) return { ...n, selected: false }
        return n
      }),
    )
    setSelection(newIds[0], undefined, undefined)
  }, [pasteEquipment, setSelection, setRfNodes])

  const duplicateSelection = useCallback(() => {
    if (!copySelectionToClipboard()) return
    pasteFromClipboard()
  }, [copySelectionToClipboard, pasteFromClipboard])

  // #340 — Bearbeiten→Duplizieren in der MenuBar triggert dieselbe
  // Logik wie Strg+D. Handler registrieren (analog zu Fit-View).
  useEffect(() => {
    setCanvasDuplicateHandler(duplicateSelection)
    return () => setCanvasDuplicateHandler(null)
  }, [duplicateSelection])

  // #340 — "Alles auswählen" aus dem Bearbeiten-Menü: alle Geräte-Nodes
  // als selected markieren (ReactFlow-Selektion; rfNodes ist controlled).
  useEffect(() => {
    setCanvasSelectAllHandler(() =>
      setRfNodes((cur) => cur.map((n) => ({ ...n, selected: true }))),
    )
    return () => setCanvasSelectAllHandler(null)
  }, [])

  useCanvasKeyboardShortcuts({
    pendingCable,
    clearPendingCable,
    copySelectionToClipboard,
    pasteFromClipboard,
    duplicateSelection,
    deleteSelected,
    getSelectedEquipmentIds,
    clipboardRef,
    lastMousePosRef,
    screenToFlowPosition,
    getNodes,
    getEdges,
    setRfNodes,
    addEquipment,
    updateEquipment,
    deleteEquipment,
    deleteCable,
  })

  // v7.7.1 — Custom canvas background image (Issue #71). When the user
  // uploaded an image for the current theme, render it as the canvas
  // backdrop in place of the radial gradient. The pattern overlay from
  // ReactFlow's <Background> still draws on top so the grid remains
  // visible. Fit mode maps to CSS `background-size`.
  const canvasBgImage =
    effectiveCanvasTheme === 'light' ? canvasBgImageLight : canvasBgImageDark
  const canvasBgSize =
    canvasBgImageFit === 'cover'
      ? 'cover'
      : canvasBgImageFit === 'contain'
        ? 'contain'
        : 'auto'
  const canvasBgRepeat = canvasBgImageFit === 'tile' ? 'repeat' : 'no-repeat'
  const canvasBgInlineStyle: React.CSSProperties = canvasBgImage
    ? {
        backgroundImage: `url(${canvasBgImage})`,
        backgroundSize: canvasBgSize,
        backgroundRepeat: canvasBgRepeat,
        backgroundPosition: 'center center',
        backgroundColor:
          customPalette?.canvasBg ??
          (effectiveCanvasTheme === 'light' ? '#e8edf4' : '#0f172a'),
      }
    : { background: customPalette?.canvasBg }

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        position: 'relative',
        ...canvasBgInlineStyle,
      }}
      id="cable-planner-canvas"
      className={effectiveCanvasTheme === 'light' ? 'canvas-theme-light' : ''}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onMouseMove={(event) => {
        lastMousePosRef.current = { x: event.clientX, y: event.clientY }
      }}
    >
      {/* #ux — Empty-State: leere Haupt-Canvas erklärte sich bisher nicht
          (schwarze Fläche). Hinweis weist auf die Bibliothek; pointer-events-
          none, damit Drag&Drop + Pan/Zoom darunter ungestört funktionieren.
          Nur Haupt-Canvas (im Rack-Overlay irrelevant). */}
      {mode === 'main' && project.equipment.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div className="text-cp-lg font-medium text-cp-text-secondary">
            {t('canvas.empty.title', 'Noch keine Geräte im Plan')}
          </div>
          <div className="max-w-sm text-cp-sm text-cp-text-muted">
            {t(
              'canvas.empty.hint',
              'Zieh ein Gerät aus der Bibliothek (links) auf die Fläche, um zu starten.',
            )}
          </div>
          <div className="mt-1 text-cp-xs text-cp-text-faint">
            {t('canvas.empty.or', '— oder —')}
          </div>
          <button
            type="button"
            className="pointer-events-auto rounded-cp-control border border-cp-border bg-cp-surface-2 px-cp-4 py-cp-2 text-cp-sm font-medium text-cp-text hover:bg-cp-surface-3"
            onClick={() => {
              // Demo nur laden wenn wirklich leer (Empty-State) — kein Überschreiben.
              loadProjectIntoStore(createDemoProject())
              // Nach dem Neu-Mount der Nodes auf den Inhalt zoomen.
              setTimeout(() => triggerCanvasFitView(), 80)
            }}
          >
            {t('canvas.empty.loadDemo', 'Beispielprojekt laden')}
          </button>
        </div>
      )}
      {/* #ux — Geräte-Suche (oben mittig), sobald Geräte existieren. */}
      {mode === 'main' && project.equipment.length > 0 && <CanvasSearch />}
      {/* v7.9.12 — Toolbar wird auch im Rack-Mode gerendert, allerdings
          mit reduziertem Feature-Set (Frame/Group/Lock/Annotations
          ausgeblendet). Snap/Grid/Routing-Defaults/Align bleiben
          weil sie auch im Rack-Sub-Canvas Sinn machen. */}
      <CanvasToolbar mode={mode} />
      {mode === 'main' && <AnnotationCanvasOverlay />}
      {/* v7.9.5 — Lock-Banner. Wenn projectMode='finalized' oder 'viewer'
          ist, zeigt eine prominente Leiste oben dass das Canvas
          gesperrt ist + im finalized-Fall einen Quick-Unlock-Button. */}
      {mode === 'main' && projectIsLocked && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '6px 14px',
            background:
              projectMode === 'viewer' ? 'rgba(124, 58, 237, 0.92)' : 'rgba(14, 116, 144, 0.92)',
            color: '#fff',
            borderRadius: '0 0 8px 8px',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
            pointerEvents: 'auto',
          }}
        >
          <span>
            {projectMode === 'viewer'
              ? t(
                  'canvas.area.viewerMode',
                  'Viewer-Modus — Plan ist read-only. Änderungen nicht möglich.',
                )
              : t(
                  'canvas.area.finalizedMode',
                  'Plan ist abgeschlossen — Änderungen sind gesperrt.',
                )}
          </span>
          {projectMode === 'finalized' && (
            <button
              type="button"
              onClick={async () => {
                if (
                  await confirmDialog(
                    t('canvas.area.releaseConfirm', 'Planung wieder zur Bearbeitung freigeben?'),
                    {
                      body: t(
                        'canvas.area.releaseBody',
                        'Geräte, Kabel und Layout können dann wieder verändert werden.',
                      ),
                      okLabel: t('canvas.area.release', 'Freigeben'),
                    },
                  )
                ) {
                  projectStoreInstance.getState().setProjectMode('editing')
                }
              }}
              style={{
                padding: '2px 10px',
                background: 'rgba(255, 255, 255, 0.18)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: 4,
                color: '#fff',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {t('canvas.area.releaseBtn', 'Bearbeitung freigeben')}
            </button>
          )}
        </div>
      )}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker
            id="cable-planner-arrow-end"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
          <marker
            id="cable-planner-arrow-start"
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        proOptions={{ hideAttribution: true }}
        nodes={rfNodes.map((n) =>
          overlapFlashId === n.id
            ? { ...n, className: (n.className ? n.className + ' ' : '') + 'overlap-flash' }
            : n,
        )}
        edges={edges}
        nodesDraggable={!interactionLocked && !projectIsLocked}
        nodesConnectable={!projectIsLocked}
        elementsSelectable={!interactionLocked}
        edgesUpdatable={!interactionLocked && !projectIsLocked}
        panOnDrag={interactionLocked ? false : true}
        panOnScroll={!interactionLocked}
        zoomOnScroll={!interactionLocked}
        zoomOnPinch={!interactionLocked}
        zoomOnDoubleClick={!interactionLocked}
        selectNodesOnDrag={false}
        // v7.9.63 / #179 — Shift sowohl für Rubber-Band-Selection
        // (drag-frame) als auch für additives Click-Select. Vorher
        // war Click-Select auf Ctrl/Meta gelegt, was zu ständigem
        // Modifier-Wechsel zwischen "Frame ziehen" und "weiteres Item
        // dazu wählen" zwang. Ctrl/Meta bleibt als Fallback erhalten
        // damit alte Muscle-Memory auch noch funktioniert.
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        // Hold Shift and drag on empty canvas to draw a marquee selection
        // box (issue #66). Plain drag still pans the viewport, so the
        // user's normal pan workflow is untouched.
        selectionKeyCode={interactionLocked ? null : 'Shift'}
        // 'Partial' = any node touching the marquee is selected. The
        // alternative ('Full' / SelectionMode.Full) requires the whole
        // node to fit inside the box, which is annoying for big devices.
        selectionMode={SelectionMode.Partial}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onNodeContextMenu={onNodeContextMenu}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        edgeUpdaterRadius={16}
        // Snap a dragged connection to the nearest port handle within this
        // pixel radius. Keep it below PORT_ROW/2 (=11) so adjacent ports
        // don't get confused: 28px was larger than the 22px row spacing and
        // caused cables to snap to the wrong port (Bug #21).
        connectionRadius={10}
        defaultViewport={{ x: project.canvasState.x, y: project.canvasState.y, zoom: project.canvasState.zoom }}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        deleteKeyCode={null}
        onPaneClick={(event) => {
          // While drawing a cable by clicking, each pane click appends a
          // waypoint. Otherwise treat the pane click as a selection clear.
          if (pendingCable) {
            const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY })
            addPendingWaypoint(flow)
            return
          }
          setSelection(undefined, undefined, undefined)
        }}
        onNodeClick={(_event, node) =>
          node.type === 'location'
            ? setSelection(undefined, undefined, node.id)
            : setSelection(node.id, undefined, undefined)
        }
        onNodeDoubleClick={async (_event, node) => {
          if (node.type === 'location') {
            const current = (node.data as { name?: string }).name ?? ''
            const newName = await promptDialog(
              t('canvas.area.renameLocation', 'Location umbenennen:'),
              current,
            )
            if (newName !== null && newName.trim()) {
              updateLocation(node.id, { name: newName.trim() })
            }
          }
        }}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={(_event, edge) => setSelection(undefined, edge.id, undefined)}
        onEdgeDoubleClick={(_event, edge) => openCableEdit(edge.id)}
        // v7.8.7 / Issues #106 + #117 — right-click on a cable opens the
        // context menu (rename, add/remove waypoint, change routing,
        // toggle cable-bumps, delete, …). State lives in uiStore so the
        // menu is one global element rendered next to CanvasArea.
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault()
          const me = event as unknown as MouseEvent
          const flow = screenToFlowPosition({ x: me.clientX, y: me.clientY })
          openCableContextMenu({
            cableId: edge.id,
            screenX: me.clientX,
            screenY: me.clientY,
            flowX: flow.x,
            flowY: flow.y,
          })
        }}
        // Issue #68: track which edge the mouse is over so CableEdge can
        // thicken/glow itself and EquipmentNode can highlight the matching
        // port handles. The store value is read by both components.
        onEdgeMouseEnter={(_event, edge) => setHoveredCableId(edge.id)}
        onEdgeMouseLeave={() => setHoveredCableId(null)}
        // #557 — Beim Pan/Zoom-Start beide Rechts-Klick-Menues schliessen.
        // Sonst klebt das Menue an der alten Bildschirm-Position, waehrend
        // der referenzierte Knoten unter dem Cursor wegrutscht.
        onMoveStart={() => {
          setNodeContextMenu(null)
          closeCableContextMenu()
        }}
      >
        {/* #zoomfix — Viewport→Store-Sync (auch bei Menü-/Toolbar-Zoom), ersetzt
            das frühere onMoveEnd, das programmatischen Zoom nicht erfasste. */}
        <ViewportStateSync onChange={setCanvasState} />
        <MiniMap pannable zoomable
          className={effectiveCanvasTheme === 'light' ? '!bg-slate-100' : '!bg-cp-surface-2'}
          maskColor={effectiveCanvasTheme === 'light' ? 'rgba(226,232,240,0.7)' : 'rgba(15,23,42,0.7)'}
        />
        <Controls />
        {/* Issue #71: background pattern is user-configurable. When the
            user picked 'none' we omit the component entirely so React
            Flow falls back to its plain coloured canvas. */}
        {bgVariant !== 'none' && (() => {
          // v7.9.100 — Background-Gap = gridSize damit JEDER Dot ein
          // echter Snap-Punkt ist. Vor v7.9.100 hatte Dots ein Floor von
          // 16 px, Lines/Cross von 20 px — Geräte snappten auf gridSize=11
          // aber die Dots wurden alle 16 px gezeichnet, also nie auf
          // Geräte-Kanten. Resultat: Snap unsichtbar, "schräg wirkend".
          //
          // Wenn gridSize sehr klein ist (< 4 px), zeichnet ReactFlow
          // visuell so dichte Dots dass sie zu Linien verschmelzen — wir
          // ziehen dann visuell jeden 2./4. Dot, halten aber das echte
          // Snap-Raster bei gridSize. So bleibt das Visual lesbar.
          const variant =
            bgVariant === 'lines'
              ? BackgroundVariant.Lines
              : bgVariant === 'cross'
                ? BackgroundVariant.Cross
                : BackgroundVariant.Dots
          const baseGap = gridSize > 0 ? gridSize : 11
          // Multiplier damit ein zu kleines Grid visuell nicht aufgeht.
          // Bei gridSize=11 (Default) bleibt's bei 1 → Dots auf jedem
          // Snap-Punkt. Bei gridSize=2 → Multiplier 8 → Dots alle 16 px,
          // aber Snap weiter alle 2 px.
          const visualMultiplier = baseGap >= 8 ? 1 : Math.ceil(8 / baseGap)
          const gap = baseGap * visualMultiplier
          const themeColor = effectiveCanvasTheme === 'light' ? '#94a3b8' : '#64748b'
          const color = customPalette?.gridColor ?? themeColor
          const opacity = Math.max(0.35, bgOpacity)
          return (
            <Background
              variant={variant}
              gap={gap}
              size={variant === BackgroundVariant.Dots ? 1.5 : 1}
              color={color}
              style={{ opacity }}
            />
          )
        })()}
      </ReactFlow>
      <PendingCableOverlay />
      {mode === 'main' && <InlineSelectionToolbar />}
      {nodeContextMenu && (() => {
        const isLocation = nodeContextMenu.nodeType === 'location'
        const target = isLocation
          ? locations.find((l) => l.id === nodeContextMenu.nodeId)
          : project.equipment.find((e) => e.id === nodeContextMenu.nodeId)
        if (!target) return null
        const isLocked = !!target.positionLocked
        const toggle = () => {
          if (isLocation) {
            updateLocation(nodeContextMenu.nodeId, { positionLocked: !isLocked })
          } else {
            updateEquipment(nodeContextMenu.nodeId, { positionLocked: !isLocked })
          }
          setNodeContextMenu(null)
        }
        // #519 — Löschen aus dem Rechtsklick-Menü. Equipment: löscht das Gerät
        // + kaskadiert angeschlossene Kabel (deleteEquipment). Location: löscht
        // nur den Rahmen, die enthaltenen Geräte bleiben (deleteLocation) —
        // das ist die nicht-destruktive Variante. Beides hinter einer
        // Bestätigung (destructive), analog zu LocationProperties.
        const remove = async () => {
          const okLabel = t('confirm.delete', 'Löschen')
          const ok = isLocation
            ? await confirmDialog(
                format(t('canvas.nodeMenu.confirmDeleteLocation', 'Rahmen "{name}" löschen?'), {
                  name: target.name,
                }),
                {
                  body: t(
                    'canvas.nodeMenu.confirmDeleteLocationBody',
                    'Nur der Rahmen wird gelöscht. Die enthaltenen Geräte bleiben auf dem Canvas.',
                  ),
                  destructive: true,
                  okLabel,
                },
              )
            : await confirmDialog(
                format(t('canvas.nodeMenu.confirmDeleteEquipment', 'Gerät "{name}" löschen?'), {
                  name: target.name,
                }),
                {
                  body: t(
                    'canvas.nodeMenu.confirmDeleteEquipmentBody',
                    'Das Gerät und alle daran angeschlossenen Kabel werden gelöscht.',
                  ),
                  destructive: true,
                  okLabel,
                },
              )
          if (!ok) {
            setNodeContextMenu(null)
            return
          }
          if (isLocation) deleteLocation(nodeContextMenu.nodeId)
          else deleteEquipment(nodeContextMenu.nodeId)
          setNodeContextMenu(null)
        }
        return (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: nodeContextMenu.clientX,
              top: nodeContextMenu.clientY,
              zIndex: 100,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              padding: 4,
              minWidth: 180,
              fontSize: 12,
              color: '#e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                background: 'transparent',
                color: 'inherit',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="7" width="10" height="7" rx="1" />
                <path d={isLocked ? 'M5 7V4.5a3 3 0 0 1 6 0V7' : 'M5 7V4.5a3 3 0 0 1 6 0V6'} />
              </svg>
              <span>
                {isLocked
                  ? t('canvas.area.unlockPosition', 'Position entsperren')
                  : t('canvas.area.lockPosition', 'Position sperren')}
              </span>
            </button>
            <div style={{ height: 1, background: '#334155', margin: '4px 0' }} />
            <button
              type="button"
              onClick={() => void remove()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '6px 10px',
                background: 'transparent',
                color: '#f87171',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2.5 4h11M6 4V2.5h4V4M5 4l.5 9a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L11 4" />
              </svg>
              <span>
                {isLocation
                  ? t('canvas.nodeMenu.deleteLocation', 'Rahmen löschen')
                  : t('canvas.nodeMenu.deleteEquipment', 'Gerät löschen')}
              </span>
            </button>
          </div>
        )
      })()}
    </div>
  )
}

export const CanvasArea = ({ mode = 'main' }: { mode?: CanvasMode } = {}) => (
  <ReactFlowProvider>
    <CanvasContent mode={mode} />
  </ReactFlowProvider>
)
