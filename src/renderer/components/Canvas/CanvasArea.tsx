import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  updateEdge,
  useReactFlow,
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
import { confirmDialog } from '../../lib/confirmDialog'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'
import { useUiStore } from '../../store/uiStore'
import { ANNOTATION_DRAG_MIME } from '../Annotations/AnnotationsPanel'
import { AnnotationCanvasOverlay } from '../Annotations/AnnotationCanvasOverlay'
import type { EquipmentItem, EquipmentTemplate } from '../../types/equipment'
import type { Cable } from '../../types/cable'
import { EquipmentNode } from './EquipmentNode'
import { CableEdge } from './CableEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { LocationFrameNode } from './LocationFrameNode'
import { PendingCableOverlay } from './PendingCableOverlay'
import { colorByLength } from '../../lib/cableColors'
import { promptDialog } from '../../lib/promptDialog'
import {
  setViewportCenterGetter,
  setCanvasSelectionClearer,
  setCanvasInteractionLockHandlers,
  setCableRouter,
  setCanvasFitViewHandler,
} from '../../lib/canvasViewport'
import { routeCableWithAStar, type HandleSide } from '../../lib/routeCableWithAStar'
import type { PixelRect } from '../../lib/cableAStar'

const nodeTypes = { equipment: EquipmentNode, location: LocationFrameNode }
const edgeTypes = { cable: CableEdge }

type CanvasMode = 'main' | 'rack'

const CanvasContent = ({ mode = 'main' }: { mode?: CanvasMode }) => {
  // v7.9.9 — context-aware project store instance. Default = main store,
  // override = scratch store (z.B. RackInternalCanvas).
  const projectStoreInstance = useCanvasProjectStoreInstance()
  const project = useProjectStore((state) => state.project)
  const projectVersion = useProjectStore((state) => state.projectVersion)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const pasteEquipment = useProjectStore((state) => state.pasteEquipment)
  const deleteEquipment = useProjectStore((state) => state.deleteEquipment)
  const queueConnection = useProjectStore((state) => state.queueConnection)
  const setSelection = useProjectStore((state) => state.setSelection)
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
  const canvasTheme = useUiStore((state) => state.canvasTheme)
  const pdfExportThemeOverride = useUiStore((state) => state.pdfExportThemeOverride)
  const pendingCable = useUiStore((state) => state.pendingCable)
  const addPendingWaypoint = useUiStore((state) => state.addPendingWaypoint)
  const clearPendingCable = useUiStore((state) => state.clearPendingCable)
  const openCableEdit = useUiStore((state) => state.openCableEdit)
  const setHoveredCableId = useUiStore((state) => state.setHoveredCableId)
  // v7.8.7 — cable right-click context menu trigger.
  const openCableContextMenu = useUiStore((state) => state.openCableContextMenu)
  // v7.9.3 — Projekt-Lock: 'finalized' und 'viewer' Modus blockieren
  // alle Bearbeitungs-Interaktionen am Canvas. Viewer kann zusätzlich
  // Annotations setzen (UI in CanvasToolbar + AnnotationsPanel).
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const projectIsLocked = projectMode === 'finalized' || projectMode === 'viewer'
  const wrapperRef = useRef<HTMLDivElement>(null)
  // Last screen-pixel mouse position over the canvas. Used by Strg++ quick-add
  // (#44) so the new device lands where the user pointed instead of always at
  // the viewport origin.
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null)
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow()
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

  // v7.8.8 — Register the A*-based cable router. Caller is the cable
  // context menu (and a future Settings toggle for auto-route). We
  // capture the current scene state via the project store for each
  // invocation so the registered callbacks always reroute against the
  // latest positions.
  useEffect(() => {
    // Compute the layout geometry of one equipment item, matching the
    // visual rendering in EquipmentNode. Returns the equipment's
    // bounding rect plus precomputed port positions so we can place
    // the cable's source/target on the exact handle centres.
    const layoutOf = (eq: typeof project.equipment[number]) => {
      const HEADER = eq.ipAddress ? 62 : 48
      const ROW = 22
      const PADDING = 8
      const inputs = eq.inputs ?? []
      const outputs = eq.outputs ?? []
      const rows = Math.max(inputs.length, outputs.length, 1)
      const width = Math.max(eq.width ?? EQUIPMENT_LAYOUT.DEFAULT_WIDTH, 200)
      const height = Math.max(eq.height ?? HEADER + rows * ROW + PADDING, HEADER + rows * ROW + PADDING)
      const portsFlipped = !!eq.portsFlipped
      const defaultInputSide: HandleSide = portsFlipped ? 'right' : 'left'
      const defaultOutputSide: HandleSide = portsFlipped ? 'left' : 'right'
      const handleAt = (portId: string, type: 'source' | 'target'): {
        side: HandleSide
        pos: { x: number; y: number }
      } | null => {
        const isOutput = type === 'source'
        const list = isOutput ? outputs : inputs
        const idx = list.findIndex((p) => p.id === portId)
        if (idx < 0) {
          // Fallback: try the other list — handles can be 'bidirectional'
          // and live in either array depending on how ReactFlow attached.
          const altList = isOutput ? inputs : outputs
          const altIdx = altList.findIndex((p) => p.id === portId)
          if (altIdx < 0) return null
          const port = altList[altIdx]
          const sideRaw = (port?.side as HandleSide | undefined) ??
            (isOutput ? defaultInputSide : defaultOutputSide)
          const y = eq.y + HEADER + altIdx * ROW + ROW / 2
          const x =
            sideRaw === 'left'
              ? eq.x
              : sideRaw === 'right'
                ? eq.x + width
                : eq.x + width / 2
          return { side: sideRaw, pos: { x, y } }
        }
        const port = list[idx]
        const sideRaw = (port?.side as HandleSide | undefined) ??
          (isOutput ? defaultOutputSide : defaultInputSide)
        const y = eq.y + HEADER + idx * ROW + ROW / 2
        const x =
          sideRaw === 'left'
            ? eq.x
            : sideRaw === 'right'
              ? eq.x + width
              : eq.x + width / 2
        return { side: sideRaw, pos: { x, y } }
      }
      return { width, height, handleAt }
    }

    const routeOne = (cableId: string): boolean => {
      const proj = projectStoreInstance.getState().project
      const cable = proj.cables.find((c) => c.id === cableId)
      if (!cable) return false
      const srcEq = proj.equipment.find((e) => e.id === cable.fromEquipmentId)
      const tgtEq = proj.equipment.find((e) => e.id === cable.toEquipmentId)
      if (!srcEq || !tgtEq) return false
      const srcLayout = layoutOf(srcEq)
      const tgtLayout = layoutOf(tgtEq)
      const srcHandle = srcLayout.handleAt(cable.fromPortId, 'source')
      const tgtHandle = tgtLayout.handleAt(cable.toPortId, 'target')
      if (!srcHandle || !tgtHandle) return false
      const obstacles: PixelRect[] = proj.equipment.map((eq) => {
        const l = layoutOf(eq)
        return { x: eq.x, y: eq.y, width: l.width, height: l.height, id: eq.id }
      })
      const waypoints = routeCableWithAStar({
        source: srcHandle.pos,
        target: tgtHandle.pos,
        sourceSide: srcHandle.side,
        targetSide: tgtHandle.side,
        obstacles,
        sourceEquipmentId: cable.fromEquipmentId,
        targetEquipmentId: cable.toEquipmentId,
      })
      if (!waypoints) return false
      updateCable(cable.id, { waypoints: waypoints.length > 0 ? waypoints : undefined })
      return true
    }

    const routeAll = (): number => {
      const proj = projectStoreInstance.getState().project
      let ok = 0
      for (const c of proj.cables) {
        if (routeOne(c.id)) ok += 1
      }
      return ok
    }

    setCableRouter({ routeOne, routeAll })
    return () => setCableRouter(null)
  }, [project.equipment, updateCable])

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
      draggable: true,
      selectable: true,
    }))
    const equipmentNodes: Node[] = project.equipment.map((item) => ({
      id: item.id,
      type: 'equipment',
      position: { x: item.x, y: item.y },
      data: { ...item, exportThemeOverride: pdfExportThemeOverride },
    }))
    return [...locationNodes, ...equipmentNodes]
  }, [project.equipment, locations, pdfExportThemeOverride])

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

  // Briefly flash a node red when its drag is rejected due to overlap, so the
  // user understands why the device snapped back (not a glitch).
  const [overlapFlashId, setOverlapFlashId] = useState<string | null>(null)
  const flashOverlap = (id: string) => {
    setOverlapFlashId(id)
    window.setTimeout(() => setOverlapFlashId(null), 500)
  }


  // Ids currently being dragged. While a node is in this set we preserve its
  // local React Flow position (so active drags don't snap back). Anything not
  // in the set takes its position from the store - that allows Undo/Redo to
  // move nodes back visually when the store reverts.
  const draggingIdsRef = useRef<Set<string>>(new Set())

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
        return { ...existing, data: n.data }
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
          label: item.needsConverter
            ? `${item.name} (${item.length}m) ⚠ converter`
            : `${item.name} (${item.length}m)`,
        }
      }),
    [project.cables, cableColorMode, pdfExportThemeOverride],
  )

  // Helper: check if equipment position overlaps with others
  const hasOverlap = useCallback((id: string, x: number, y: number, width: number, height: number): boolean => {
    return project.equipment.some((eq) => {
      if (eq.id === id) return false
      const eqW = eq.width ?? 0
      const eqH = eq.height ?? 0
      // AABB intersection test
      return !(x + width <= eq.x || x >= eq.x + eqW || y + height <= eq.y || y >= eq.y + eqH)
    })
  }, [project.equipment])

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
      return endedDragIds.has(change.id)
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
          // Check overlap before persisting
          const eq = project.equipment.find((e) => e.id === change.id)
          if (eq && hasOverlap(eq.id, px, py, eq.width ?? 0, eq.height ?? 0)) {
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
        }
      }
    })
  }

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== 'location') return
      const loc = locations.find((l) => l.id === node.id)
      if (!loc) return
      // By default a location frame moves independently; contained equipment
      // only follows when the user explicitly enables `moveContents` in the
      // location properties (opt-in).
      if (!loc.moveContents) {
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
    [locations, project.equipment],
  )

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    const snap = (v: number) =>
      snapToGrid && gridSize > 0 ? Math.round(v / gridSize) * gridSize : v
    const px = snap(node.position.x)
    const py = snap(node.position.y)

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
          if (hasOverlap(eq.id, px, py, eq.width ?? 0, eq.height ?? 0)) {
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
    if (node.type === 'location') {
      // Clear any stale location drag snapshot so unrelated future node
      // changes (like adding equipment by click) cannot shift other nodes.
      locationDragRef.current = null
    }
  }, [gridSize, hasOverlap, locations, moveLocationWithContents, project.equipment, snapToGrid, updateEquipment, updateLocation])

  const onEdgesChange = (_changes: EdgeChange[]) => {
    applyEdgeChanges(_changes, edges)
  }

  const onConnect: OnConnect = (connection) => {
    // ReactFlow's ConnectionMode.Loose lets the user drag from any handle
    // (including the transparent overlay handle on each port). When they
    // drag from an Input to an Output, ReactFlow picks the drag-origin
    // handle as `source` — which leaves the cable arrow pointing the wrong
    // way (Input → Output). Normalise here so the canonical signal flow
    // (output → input) is preserved regardless of which end the user
    // started from.
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
  }

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
    },
    [],
  )

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const start = connectStartRef.current
      connectStartRef.current = null
      if (!start || !start.nodeId || !start.handleId || !start.handleType) return

      // Only act when dropped on the pane (not on a node/handle).
      const target = event.target as HTMLElement | null
      const targetIsPane = target?.classList.contains('react-flow__pane')
      if (!targetIsPane) return

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
    [addOpenEndStub, project.equipment, queueConnection, screenToFlowPosition, snapToGrid, gridSize],
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
      const rackPresetId = event.dataTransfer.getData('application/cable-planner-rack-preset')
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
      const groupPresetId = event.dataTransfer.getData('application/cable-planner-group-preset')
      if (groupPresetId) {
        if (mode === 'rack') return
        const px = snapX(position.x)
        const py = snapX(position.y)
        projectStoreInstance.getState().placeGroupPreset(groupPresetId, px, py)
        return
      }

      const payload = event.dataTransfer.getData('application/cable-planner-equipment')
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
    const newIds = pasteEquipment(snap.items, snap.cables, { dx: step, dy: step })
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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pendingCable) {
        clearPendingCable()
        return
      }
      const target = event.target as HTMLElement | null
      const isTextField =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      if (isTextField) return
      const ctrl = event.ctrlKey || event.metaKey
      if (ctrl && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase()
        if (key === 'c') {
          if (copySelectionToClipboard()) event.preventDefault()
          return
        }
        if (key === 'v') {
          if (clipboardRef.current) {
            event.preventDefault()
            pasteFromClipboard()
          }
          return
        }
        if (key === 'd') {
          event.preventDefault()
          duplicateSelection()
          return
        }
        // Strg+= or Strg++  (issue #44): quick-add device. Opens a name
        // prompt; the new equipment lands at the last known mouse position
        // in flow coordinates, snapped to grid.
        if (event.key === '+' || event.key === '=') {
          event.preventDefault()
          ;(async () => {
            const name = (await promptDialog('Neues Gerät', 'Neues Gerät'))?.trim()
            if (!name) return
            const pos = lastMousePosRef.current
            const flow = pos
              ? screenToFlowPosition({ x: pos.x, y: pos.y })
              : { x: 200, y: 200 }
            addEquipment({
              name,
              category: 'Sonstiges',
              inputs: [],
              outputs: [],
              x: flow.x,
              y: flow.y,
              width: 240,
              height: 80,
            })
          })()
          return
        }
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const ids = getSelectedEquipmentIds()
      if (ids.length > 1) {
        event.preventDefault()
        for (const id of ids) deleteEquipment(id)
        return
      }
      deleteSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    deleteSelected,
    deleteEquipment,
    pendingCable,
    clearPendingCable,
    copySelectionToClipboard,
    pasteFromClipboard,
    duplicateSelection,
    getSelectedEquipmentIds,
  ])

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
              ? 'Viewer-Modus — Plan ist read-only. Änderungen nicht möglich.'
              : 'Plan ist abgeschlossen — Änderungen sind gesperrt.'}
          </span>
          {projectMode === 'finalized' && (
            <button
              type="button"
              onClick={async () => {
                if (
                  await confirmDialog('Planung wieder zur Bearbeitung freigeben?', {
                    body: 'Geräte, Kabel und Layout können dann wieder verändert werden.',
                    okLabel: 'Freigeben',
                  })
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
              Bearbeitung freigeben
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
        multiSelectionKeyCode={['Control', 'Meta']}
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
            const newName = await promptDialog('Location umbenennen:', current)
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
        onMoveEnd={(_event, viewport) => setCanvasState(viewport.x, viewport.y, viewport.zoom)}
      >
        <MiniMap pannable zoomable
          className={effectiveCanvasTheme === 'light' ? '!bg-slate-100' : '!bg-slate-800'}
          maskColor={effectiveCanvasTheme === 'light' ? 'rgba(226,232,240,0.7)' : 'rgba(15,23,42,0.7)'}
        />
        <Controls />
        {/* Issue #71: background pattern is user-configurable. When the
            user picked 'none' we omit the component entirely so React
            Flow falls back to its plain coloured canvas. */}
        {bgVariant !== 'none' && (() => {
          // Background pattern with sensible floors so dots/lines stay
          // visible regardless of gridSize, theme or persisted opacity.
          // The custom palette (if set in Settings) overrides the
          // theme-derived grid color.
          const variant =
            bgVariant === 'lines'
              ? BackgroundVariant.Lines
              : bgVariant === 'cross'
                ? BackgroundVariant.Cross
                : BackgroundVariant.Dots
          const baseGap = gridSize > 0 ? gridSize : 20
          const gap =
            variant === BackgroundVariant.Dots
              ? Math.max(16, baseGap)
              : Math.max(20, baseGap * 3)
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
    </div>
  )
}

export const CanvasArea = ({ mode = 'main' }: { mode?: CanvasMode } = {}) => (
  <ReactFlowProvider>
    <CanvasContent mode={mode} />
  </ReactFlowProvider>
)
