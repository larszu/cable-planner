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
  ConnectionMode,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import type { EquipmentTemplate } from '../../types/equipment'
import { EquipmentNode } from './EquipmentNode'
import { CableEdge } from './CableEdge'
import { CanvasToolbar } from './CanvasToolbar'
import { LocationFrameNode } from './LocationFrameNode'
import { PendingCableOverlay } from './PendingCableOverlay'
import { colorByLength } from '../../lib/cableColors'

const nodeTypes = { equipment: EquipmentNode, location: LocationFrameNode }
const edgeTypes = { cable: CableEdge }

const CanvasContent = () => {
  const project = useProjectStore((state) => state.project)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const addEquipment = useProjectStore((state) => state.addEquipment)
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
  const cableColorMode = useUiStore((state) => state.cableColorMode)
  const pendingCable = useUiStore((state) => state.pendingCable)
  const addPendingWaypoint = useUiStore((state) => state.addPendingWaypoint)
  const clearPendingCable = useUiStore((state) => state.clearPendingCable)
  const openCableEdit = useUiStore((state) => state.openCableEdit)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
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

  const nodes = useMemo<Node[]>(() => {
    // Location frames first so they render behind equipment.
    const locationNodes: Node[] = locations.map((loc) => ({
      id: loc.id,
      type: 'location',
      position: { x: loc.x, y: loc.y },
      data: loc,
      zIndex: -1,
      style: { width: loc.width, height: loc.height },
      draggable: true,
      selectable: true,
    }))
    const equipmentNodes: Node[] = project.equipment.map((item) => ({
      id: item.id,
      type: 'equipment',
      position: { x: item.x, y: item.y },
      data: item,
    }))
    return [...locationNodes, ...equipmentNodes]
  }, [project.equipment, locations])

  // Local state keeps React Flow's controlled node positions in sync during drag.
  // We initialise once from the store and then apply changes incrementally.
  // A wholesale replace on every store update is avoided because it causes nodes
  // to jump when other items in the array are deleted/added.
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes)

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
  useEffect(() => {
    setRfNodes((current) => {
      const currentById = new Map(current.map((n) => [n.id, n]))
      const dragging = draggingIdsRef.current
      return nodes.map((n) => {
        const existing = currentById.get(n.id)
        if (!existing) return n
        // During an active drag on this node we must keep the local RF
        // position (otherwise the drag would jitter against store updates).
        // Outside of that we adopt the store position, which is what makes
        // Undo/Redo move the node back visually.
        if (dragging.has(n.id)) {
          return { ...n, position: existing.position }
        }
        // For location frames, preserve React Flow's internally-tracked style
        // (which includes dimensions set by NodeResizer) to prevent the frame
        // from snapping back to its pre-resize size when only data changes.
        if (n.type === 'location' && existing.style) {
          return { ...n, style: existing.style }
        }
        return n
      })
    })
    prevIdsRef.current = nodes.map((n) => n.id).join(',')
  }, [nodes])

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
          data: { cable: item },
          label: item.needsConverter
            ? `${item.name} (${item.length}m) ⚠ converter`
            : `${item.name} (${item.length}m)`,
        }
      }),
    [project.cables, cableColorMode],
  )

  // Helper: check if equipment position overlaps with others
  const hasOverlap = (id: string, x: number, y: number, width: number, height: number): boolean => {
    return project.equipment.some((eq) => {
      if (eq.id === id) return false
      const eqW = eq.width ?? 0
      const eqH = eq.height ?? 0
      // AABB intersection test
      return !(x + width <= eq.x || x >= eq.x + eqW || y + height <= eq.y || y >= eq.y + eqH)
    })
  }

  const onNodesChange = (changes: NodeChange[]) => {
    // Track drag start/end per node so our store→RF sync knows which nodes
    // are currently being dragged (and therefore must keep their local pos).
    for (const change of changes) {
      if (change.type === 'position' && change.id) {
        if (change.dragging) {
          draggingIdsRef.current.add(change.id)
        } else {
          draggingIdsRef.current.delete(change.id)
        }
      }
    }
    
    // Update rfNodes during drag for visual feedback only
    setRfNodes((current) => {
      const next = applyNodeChanges(changes, current)
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

    // Persist to store ONLY on drag-end to avoid infinite loop
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && change.dragging === false) {
        const isLocation = locations.some((l) => l.id === change.id)
        if (isLocation) {
          const drag = locationDragRef.current
          const loc = locations.find((l) => l.id === change.id)
          if (drag && drag.locationId === change.id && loc) {
            const dx = change.position.x - loc.x
            const dy = change.position.y - loc.y
            moveLocationWithContents(change.id, dx, dy, drag.containedEquipmentIds)
          } else {
            updateLocation(change.id, { x: change.position.x, y: change.position.y })
          }
          locationDragRef.current = null
        } else {
          // Check overlap before persisting
          const eq = project.equipment.find((e) => e.id === change.id)
          if (eq && hasOverlap(eq.id, change.position.x, change.position.y, eq.width ?? 0, eq.height ?? 0)) {
            // Revert to last position
            const lastRfNode = rfNodes.find((n) => n.id === change.id)
            if (lastRfNode) {
              setRfNodes((current) =>
                current.map((n) =>
                  n.id === change.id ? { ...n, position: lastRfNode.position } : n,
                ),
              )
            }
          } else {
            updateEquipment(change.id, { x: change.position.x, y: change.position.y })
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
    if (node.type === 'location') {
      // Clear any stale location drag snapshot so unrelated future node
      // changes (like adding equipment by click) cannot shift other nodes.
      locationDragRef.current = null
    }
  }, [])

  const onEdgesChange = (_changes: EdgeChange[]) => {
    applyEdgeChanges(_changes, edges)
  }

  const onConnect: OnConnect = (connection) => {
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
      const encoded = addOpenEndStub({ x: flowPos.x - 70, y: flowPos.y - 30 }, srcPort.connectorType, stubSide)
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
    [addOpenEndStub, project.equipment, queueConnection, screenToFlowPosition],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const payload = event.dataTransfer.getData('application/cable-planner-equipment')
      if (!payload) {
        return
      }
      try {
        const template = JSON.parse(payload) as EquipmentTemplate
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        addEquipment({ ...template, x: position.x, y: position.y })
      } catch (error) {
        console.error('Failed to drop equipment:', error)
      }
    },
    [addEquipment, screenToFlowPosition],
  )

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pendingCable) {
        clearPendingCable()
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      deleteSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected, pendingCable, clearPendingCable])

  return (
    <div
      ref={wrapperRef}
      style={{ width: '100%', height: '100%', minHeight: 400, position: 'relative' }}
      id="cable-planner-canvas"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <CanvasToolbar />
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
            orient="auto-start-reverse"
          >
            <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
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
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={(_event, edge) => setSelection(undefined, edge.id, undefined)}
        onEdgeDoubleClick={(_event, edge) => openCableEdit(edge.id)}
        onMoveEnd={(_event, viewport) => setCanvasState(viewport.x, viewport.y, viewport.zoom)}
      >
        <MiniMap pannable zoomable className="!bg-slate-800" maskColor="rgba(15,23,42,0.7)" />
        <Controls />
        <Background />
      </ReactFlow>
      <PendingCableOverlay />
    </div>
  )
}

export const CanvasArea = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
)
