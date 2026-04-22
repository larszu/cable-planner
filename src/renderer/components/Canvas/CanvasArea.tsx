import { useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  applyNodeChanges,
  applyEdgeChanges,
  type Edge,
  type Node,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
} from 'reactflow'
import { useProjectStore } from '../../store/projectStore'
import { EquipmentNode } from './EquipmentNode'
import { CableEdge } from './CableEdge'

const nodeTypes = { equipment: EquipmentNode }
const edgeTypes = { cable: CableEdge }

const CanvasContent = () => {
  const project = useProjectStore((state) => state.project)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const queueConnection = useProjectStore((state) => state.queueConnection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const setCanvasState = useProjectStore((state) => state.setCanvasState)

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

  const edges = useMemo<Edge[]>(
    () =>
      project.cables.map((item) => ({
        id: item.id,
        source: item.fromEquipmentId,
        sourceHandle: item.fromPortId,
        target: item.toEquipmentId,
        targetHandle: item.toPortId,
        type: 'cable',
        style: { stroke: item.color, strokeWidth: 2.5 },
        label: `${item.name} (${item.length}m)`,
      })),
    [project.cables],
  )

  const onNodesChange = (changes: NodeChange[]) => {
    const changed = applyNodeChanges(changes, nodes)
    changed.forEach((node) => {
      updateEquipment(node.id, { x: node.position.x, y: node.position.y })
    })
  }

  const onEdgesChange = (_changes: EdgeChange[]) => {
    applyEdgeChanges(_changes, edges)
  }

  const onConnect: OnConnect = (connection) => {
    queueConnection(connection)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      onNodeClick={(_event, node) => setSelection(node.id, undefined)}
      onEdgeClick={(_event, edge) => setSelection(undefined, edge.id)}
      onMoveEnd={(_event, viewport) => setCanvasState(viewport.x, viewport.y, viewport.zoom)}
    >
      <MiniMap pannable zoomable />
      <Controls />
      <Background />
    </ReactFlow>
  )
}

export const CanvasArea = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
)
