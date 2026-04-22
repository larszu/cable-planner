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
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const gridSize = useUiStore((state) => state.gridSize)
  const nodeTypes = useMemo(() => ({ equipment: EquipmentNode }), [])
  const edgeTypes = useMemo(() => ({ cable: CableEdge }), [])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const edgeUpdateSuccessful = useRef(true)
  const connectStartRef = useRef<{
    nodeId: string | null
    handleId: string | null
    handleType: 'source' | 'target' | null
  } | null>(null)

  const nodes = useMemo<Node[]>(
    () =>
      project.equipment.map((item) => ({
        id: item.id,
        type: 'equipment',
        position: { x: item.x, y: item.y },
        data: item,
      })),
    [project.equipment],
  )

  // Local state keeps React Flow's controlled node positions in sync during drag.
  // Without applyNodeChanges the node would snap back on drag-end.
  const [rfNodes, setRfNodes] = useState<Node[]>(nodes)
  useEffect(() => {
    setRfNodes(nodes)
  }, [nodes])

  const edges = useMemo<Edge[]>(
    () =>
      project.cables.map((item) => ({
        id: item.id,
        source: item.fromEquipmentId,
        sourceHandle: item.fromPortId,
        target: item.toEquipmentId,
        targetHandle: item.toPortId,
        type: 'cable',
        updatable: true,
        style: { stroke: item.color, strokeWidth: item.strokeWidth ?? 2.5 },
        data: { cable: item },
        label: item.needsConverter
          ? `${item.name} (${item.length}m) ⚠ converter`
          : `${item.name} (${item.length}m)`,
      })),
    [project.cables],
  )

  const onNodesChange = (changes: NodeChange[]) => {
    setRfNodes((current) => applyNodeChanges(changes, current))
    changes.forEach((change) => {
      if (change.type === 'position' && change.position && !change.dragging) {
        updateEquipment(change.id, { x: change.position.x, y: change.position.y })
      }
    })
  }

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
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      deleteSelected()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected])

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
        onPaneClick={() => setSelection(undefined, undefined)}
        onNodeClick={(_event, node) => setSelection(node.id, undefined)}
        onEdgeClick={(_event, edge) => setSelection(undefined, edge.id)}
        onMoveEnd={(_event, viewport) => setCanvasState(viewport.x, viewport.y, viewport.zoom)}
      >
        <MiniMap pannable zoomable className="!bg-slate-800" maskColor="rgba(15,23,42,0.7)" />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
}

export const CanvasArea = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
)
