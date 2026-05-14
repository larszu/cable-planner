// v7.8.5 — In-Builder Rack Internal Wiring Sub-Canvas.
//
// Opens from the RackBuilderDialog ("🔌 Intern verkabeln…" button). Shows
// every placement as a node with its inputs (left) and outputs (right) as
// handles, so the user can drag-connect them to author the rack's INTERNAL
// wiring before saving the preset.
//
// Output: a `GroupPreset['cables']` array — i.e. `{fromItemIndex,
// fromPortName, toItemIndex, toPortName, name, type, length}[]`. When the
// user places the rack on the main canvas via `placeGroupPreset`, the
// store materialises those cables with fresh ids. The user can then open
// the existing RackEditorDialog from any rack-instance device to see the
// internal wiring as documentation.
//
// Architecture: this is a STANDALONE ReactFlow canvas — it does NOT touch
// the project store. The dialog's `draft` state is pure component state
// and only flushed to the parent (RackBuilderDialog) when the user clicks
// "Übernehmen". Cancel discards.
//
// Visual layout: devices stack vertically, sorted by their rack start-HE
// (lowest at the top, matching the front-of-rack convention).

import { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeProps,
} from 'reactflow'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'

export interface RackInternalWireDialogProps {
  open: boolean
  rackName: string
  /** Placements in their builder order. We use the array INDEX directly
   *  as the item-index for cable references, matching the order in which
   *  RackBuilderDialog will serialise them in `saveRack()` (after the
   *  same start-unit sort). */
  placements: RackPlacementForWire[]
  /** Existing cables from the draft (when editing an already-wired rack). */
  initialCables: GroupPreset['cables']
  onCancel: () => void
  onApply: (cables: GroupPreset['cables']) => void
}

/** The subset of RackPlacementDraft we need here. Keeping it explicit
 *  decouples this dialog from the builder's internal draft shape. */
export interface RackPlacementForWire {
  id: string
  name: string
  startUnit: number
  rackUnits: number
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
}

/** Encoded as `placement-id::port-name`. We use port NAME (not id)
 *  because GroupPreset.cables stores port references by name. */
const encodeHandle = (placementId: string, portName: string) =>
  `${placementId}::${portName}`

const decodeHandle = (handle: string): { placementId: string; portName: string } | null => {
  const idx = handle.indexOf('::')
  if (idx < 0) return null
  return { placementId: handle.slice(0, idx), portName: handle.slice(idx + 2) }
}

const NODE_WIDTH = 240
const PORT_ROW_HEIGHT = 22
const HEADER_HEIGHT = 36
const Y_GAP = 28
const X_OFFSET = 60

interface RackPlacementNodeData {
  name: string
  startUnit: number
  rackUnits: number
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
}

/** Render a placement as a card with INPUTS on the left and OUTPUTS on
 *  the right. ReactFlow `<Handle>` elements are absolutely-positioned
 *  inside each port row. */
const RackPlacementNode = ({ data, id }: NodeProps<RackPlacementNodeData>) => {
  const rowCount = Math.max(data.inputs.length, data.outputs.length, 1)
  const height = HEADER_HEIGHT + rowCount * PORT_ROW_HEIGHT + 6
  return (
    <div
      className="rounded border border-slate-600 bg-slate-900/95 text-[11px] text-slate-100 shadow-lg"
      style={{ width: NODE_WIDTH, minHeight: height }}
    >
      <div className="border-b border-slate-700 bg-slate-800/80 px-2 py-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold">{data.name}</span>
          <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-400">
            U{data.startUnit}
            {data.rackUnits > 1 ? `–${data.startUnit + data.rackUnits - 1}` : ''}
          </span>
        </div>
      </div>
      <div className="relative px-2 py-1">
        {Array.from({ length: rowCount }).map((_, rowIdx) => {
          const inp = data.inputs[rowIdx]
          const out = data.outputs[rowIdx]
          return (
            <div
              key={rowIdx}
              className="flex items-center justify-between gap-2 text-[10px]"
              style={{ height: PORT_ROW_HEIGHT }}
            >
              <div className="relative flex min-w-0 flex-1 items-center gap-1">
                {inp && (
                  <>
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={encodeHandle(id, inp.name)}
                      className="!h-2 !w-2 !-translate-x-1/2 !bg-emerald-500"
                      style={{ left: -6 }}
                    />
                    <span className="truncate text-slate-300">{inp.name}</span>
                    {inp.connectorType && (
                      <span className="shrink-0 text-[9px] text-slate-500">
                        {inp.connectorType}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="relative flex min-w-0 flex-1 items-center justify-end gap-1">
                {out && (
                  <>
                    {out.connectorType && (
                      <span className="shrink-0 text-[9px] text-slate-500">
                        {out.connectorType}
                      </span>
                    )}
                    <span className="truncate text-right text-slate-300">{out.name}</span>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={encodeHandle(id, out.name)}
                      className="!h-2 !w-2 !translate-x-1/2 !bg-sky-500"
                      style={{ right: -6 }}
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const nodeTypes = { rackPlacement: RackPlacementNode }

const InnerCanvas = ({
  placements,
  initialCables,
  onCancel,
  onApply,
  rackName,
}: Omit<RackInternalWireDialogProps, 'open'>) => {
  // Build initial nodes from placements, stacked top-to-bottom by start-HE.
  const initialNodes = useMemo<Node<RackPlacementNodeData>[]>(() => {
    const sorted = placements.slice().sort((a, b) => a.startUnit - b.startUnit)
    let cursorY = 40
    return sorted.map((p) => {
      const rows = Math.max(p.inputs.length, p.outputs.length, 1)
      const h = HEADER_HEIGHT + rows * PORT_ROW_HEIGHT + 6
      const node: Node<RackPlacementNodeData> = {
        id: p.id,
        type: 'rackPlacement',
        position: { x: X_OFFSET, y: cursorY },
        data: {
          name: p.name,
          startUnit: p.startUnit,
          rackUnits: p.rackUnits,
          inputs: p.inputs,
          outputs: p.outputs,
        },
      }
      cursorY += h + Y_GAP
      return node
    })
  }, [placements])

  // Materialise initial cables. Map item indices → placement ids via the
  // builder's order (NOT the start-HE sorted order). For now we accept
  // either, but the source of truth is `placements[itemIndex].id`.
  const initialEdges = useMemo<Edge[]>(() => {
    const result: Edge[] = []
    for (const c of initialCables) {
      const from = placements[c.fromItemIndex]
      const to = placements[c.toItemIndex]
      if (!from || !to) continue
      result.push({
        id: `wire-${uuidv4()}`,
        source: from.id,
        sourceHandle: encodeHandle(from.id, c.fromPortName),
        target: to.id,
        targetHandle: encodeHandle(to.id, c.toPortName),
        type: 'smoothstep',
        animated: false,
        label: c.name || c.type,
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
        labelStyle: { fill: '#e2e8f0', fontSize: 10 },
        style: { stroke: c.color ?? '#64748b', strokeWidth: 2 },
      })
    }
    return result
  }, [initialCables, placements])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return
      // Same-device wiring is allowed (loopback / monitor return), but
      // the same source→target pair can only be wired once.
      const dup = edges.some(
        (e) =>
          e.source === conn.source &&
          e.target === conn.target &&
          e.sourceHandle === conn.sourceHandle &&
          e.targetHandle === conn.targetHandle,
      )
      if (dup) return
      const fromPort = decodeHandle(conn.sourceHandle)
      const toPort = decodeHandle(conn.targetHandle)
      const label = fromPort && toPort ? `${fromPort.portName} → ${toPort.portName}` : ''
      setEdges((current) =>
        addEdge(
          {
            ...conn,
            id: `wire-${uuidv4()}`,
            type: 'smoothstep',
            label,
            labelBgPadding: [4, 2] as [number, number],
            labelBgBorderRadius: 4,
            labelBgStyle: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
            labelStyle: { fill: '#e2e8f0', fontSize: 10 },
            style: { stroke: '#64748b', strokeWidth: 2 },
          },
          current,
        ),
      )
    },
    [edges, setEdges],
  )

  const removeSelected = () => {
    if (!selectedEdgeId) return
    setEdges((current) => current.filter((e) => e.id !== selectedEdgeId))
    setSelectedEdgeId(null)
  }

  // Translate edges back into the GroupPreset cable shape on apply.
  const handleApply = () => {
    const placementIdToIndex = new Map<string, number>()
    placements.forEach((p, idx) => placementIdToIndex.set(p.id, idx))
    const cables: GroupPreset['cables'] = []
    for (const e of edges) {
      const fromIdx = placementIdToIndex.get(e.source)
      const toIdx = placementIdToIndex.get(e.target)
      if (fromIdx == null || toIdx == null) continue
      const fromPort = e.sourceHandle ? decodeHandle(e.sourceHandle) : null
      const toPort = e.targetHandle ? decodeHandle(e.targetHandle) : null
      if (!fromPort || !toPort) continue
      cables.push({
        fromItemIndex: fromIdx,
        fromPortName: fromPort.portName,
        toItemIndex: toIdx,
        toPortName: toPort.portName,
        name:
          typeof e.label === 'string' && e.label
            ? e.label
            : `${fromPort.portName} → ${toPort.portName}`,
        type: 'Custom',
        length: 0.5,
        color: '#64748b',
      })
    }
    onApply(cables)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            🔌 Rack-Verkabelung: {rackName}
          </h3>
          <p className="text-[11px] text-slate-400">
            Ziehe Linien von einem Output (rechts) zu einem Input (links). Wähle eine Linie + Entf, um sie zu löschen.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selectedEdgeId}
            className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-200 hover:bg-red-800 disabled:opacity-40"
          >
            Verbindung löschen
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Übernehmen ({edges.length} Kabel)
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={(changes: EdgeChange[]) => {
            onEdgesChange(changes)
            // Track which edge is selected so the "delete" button works.
            for (const c of changes) {
              if (c.type === 'select') {
                setSelectedEdgeId(c.selected ? c.id : null)
              }
            }
          }}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          deleteKeyCode={['Backspace', 'Delete']}
          onEdgesDelete={(deleted) => {
            for (const d of deleted) {
              if (d.id === selectedEdgeId) setSelectedEdgeId(null)
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#475569" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}

export const RackInternalWireDialog = (props: RackInternalWireDialogProps) => {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-6">
      <div className="flex h-[90vh] w-full max-w-[1200px] flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <ReactFlowProvider>
          <InnerCanvas {...props} />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
