// v7.8.5 — In-Builder Rack Internal Wiring Sub-Canvas.
// v7.9.1 — Substanzielle Funktions-Erweiterung (User-Request):
//          Sub-Canvas soll möglichst die gleichen Features wie der Haupt-
//          Canvas bieten — Rechtsklick-Menü auf Edges + Pane, Kabel-
//          Properties-Dialog (Name, Typ, Länge, Farbe, Standard),
//          orthogonale Step-Edges, Auto-Anordnen, Fit-View, Tastatur-
//          Shortcuts. Volle A*/Bumps-Parität ist außerhalb des Scopes
//          eines einzelnen Dialogs — dafür müsste die Haupt-Canvas-
//          Render-Pipeline shared werden, was eine Store-Refactor
//          erfordert.
//
// Opens from the RackBuilderDialog ("🔌 Intern verkabeln…" button). Shows
// every placement as a node with its inputs (left) and outputs (right) as
// handles, so the user can drag-connect them to author the rack's INTERNAL
// wiring before saving the preset.
//
// Output: a `GroupPreset['cables']` array — i.e. `{fromItemIndex,
// fromPortName, toItemIndex, toPortName, name, type, length, color,
// standard}[]`. When the user places the rack on the main canvas via
// `placeGroupPreset`, the store materialises those cables with fresh ids.
// The user can then open the existing RackEditorDialog from any rack-
// instance device to see the internal wiring as documentation.
//
// Architecture: this is a STANDALONE ReactFlow canvas — it does NOT touch
// the project store. The dialog's `draft` state is pure component state
// and only flushed to the parent (RackBuilderDialog) when the user clicks
// "Übernehmen". Cancel discards.
//
// Visual layout: devices stack vertically, sorted by their rack start-HE
// (lowest at the top, matching the front-of-rack convention).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeProps,
} from 'reactflow'
import { v4 as uuidv4 } from 'uuid'
import {
  ALL_CONNECTOR_TYPES,
  type EquipmentTemplate,
  type GroupPreset,
} from '../../types/equipment'
import type { CableType } from '../../types/cable'
import { ALL_SIGNAL_STANDARDS, type SignalStandard } from '../../types/cableSpec'

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

/** Default color picker palette + connector-type → color mapping. Matches
 *  the broad family the main canvas uses but kept local so we don't pull
 *  in colorPortsByType / colorForConnector machinery. */
const DEFAULT_COLOR = '#64748b'
const CONNECTOR_COLOR: Partial<Record<CableType, string>> = {
  XLR: '#f97316',
  BNC: '#22c55e',
  HDMI: '#a855f7',
  'Ethernet/RJ45': '#0ea5e9',
  Fiber: '#facc15',
  SFP: '#facc15',
  'SFP+': '#facc15',
  'USB-C': '#38bdf8',
  Triax: '#84cc16',
  'Wireless/RF': '#ec4899',
  'IEC 230V': '#dc2626',
  PowerCON: '#dc2626',
  'Schuko 230V': '#dc2626',
  'C7 Eurostecker': '#dc2626',
}

const COLOR_PALETTE = [
  '#64748b', '#0ea5e9', '#22c55e', '#facc15', '#f97316', '#dc2626',
  '#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#fb923c', '#e2e8f0',
]

const SIGNAL_STANDARDS = ALL_SIGNAL_STANDARDS

interface CableData {
  name: string
  type: CableType
  length: number
  color: string
  standard?: SignalStandard
}

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
                      className="!h-2.5 !w-2.5 !-translate-x-1/2 !border !border-slate-900 !bg-emerald-500"
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
                      className="!h-2.5 !w-2.5 !translate-x-1/2 !border !border-slate-900 !bg-sky-500"
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

/** Build an Edge from a connection + cable-data. Single source of truth
 *  for label/style so addEdge() and the properties dialog stay in sync. */
const edgeFromCableData = (
  base: Pick<Edge, 'id' | 'source' | 'sourceHandle' | 'target' | 'targetHandle'>,
  data: CableData,
): Edge => ({
  ...base,
  type: 'step',
  label: data.name,
  data,
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 4,
  labelBgStyle: { fill: '#1e293b', stroke: '#475569', strokeWidth: 1 },
  labelStyle: { fill: '#e2e8f0', fontSize: 10 },
  style: { stroke: data.color, strokeWidth: 2 },
})

interface CableMenuState {
  x: number
  y: number
  edgeId: string
}

interface PaneMenuState {
  x: number
  y: number
}

interface CablePropsDialogState {
  edgeId: string
  data: CableData
}

const InnerCanvas = ({
  placements,
  initialCables,
  onCancel,
  onApply,
  rackName,
}: Omit<RackInternalWireDialogProps, 'open'>) => {
  const { fitView } = useReactFlow()

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
      const data: CableData = {
        name: c.name || `${c.fromPortName} → ${c.toPortName}`,
        type: (c.type as CableType) ?? 'Custom',
        length: c.length ?? 0.5,
        color: c.color ?? DEFAULT_COLOR,
        standard: c.standard as SignalStandard | undefined,
      }
      result.push(
        edgeFromCableData(
          {
            id: `wire-${uuidv4()}`,
            source: from.id,
            sourceHandle: encodeHandle(from.id, c.fromPortName),
            target: to.id,
            targetHandle: encodeHandle(to.id, c.toPortName),
          },
          data,
        ),
      )
    }
    return result
  }, [initialCables, placements])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [cableMenu, setCableMenu] = useState<CableMenuState | null>(null)
  const [paneMenu, setPaneMenu] = useState<PaneMenuState | null>(null)
  const [propsDialog, setPropsDialog] = useState<CablePropsDialogState | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close context menus when clicking anywhere else (handled by the
  // backdrop click in renderContextMenu, but also on Escape).
  useEffect(() => {
    if (!cableMenu && !paneMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCableMenu(null)
        setPaneMenu(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cableMenu, paneMenu])

  const inferType = useCallback(
    (sourceHandle: string, targetHandle: string): CableType => {
      const from = decodeHandle(sourceHandle)
      const to = decodeHandle(targetHandle)
      if (!from || !to) return 'Custom'
      const findPort = (placementId: string, portName: string) => {
        const p = placements.find((pl) => pl.id === placementId)
        if (!p) return null
        return (
          p.outputs.find((o) => o.name === portName) ??
          p.inputs.find((i) => i.name === portName) ??
          null
        )
      }
      const sp = findPort(from.placementId, from.portName)
      const tp = findPort(to.placementId, to.portName)
      // Pick the matching ConnectorType if both ends agree, else fall
      // back to the source connector type.
      const sct = sp?.connectorType
      const tct = tp?.connectorType
      const chosen = sct && (sct === tct || !tct) ? sct : sct ?? tct
      if (!chosen) return 'Custom'
      // ConnectorType ⊃ CableType (DIN/DisplayPort/USB excluded from
      // CableType). If excluded, fall back to Custom.
      if (chosen === 'DIN' || chosen === 'DisplayPort' || chosen === 'USB') return 'Custom'
      return chosen as CableType
    },
    [placements],
  )

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
      const cableName = fromPort && toPort ? `${fromPort.portName} → ${toPort.portName}` : 'Kabel'
      const type = inferType(conn.sourceHandle, conn.targetHandle)
      const color = CONNECTOR_COLOR[type] ?? DEFAULT_COLOR
      const data: CableData = { name: cableName, type, length: 0.5, color }
      setEdges((current) =>
        addEdge(
          edgeFromCableData(
            {
              id: `wire-${uuidv4()}`,
              source: conn.source!,
              sourceHandle: conn.sourceHandle!,
              target: conn.target!,
              targetHandle: conn.targetHandle!,
            },
            data,
          ),
          current,
        ),
      )
    },
    [edges, inferType, setEdges],
  )

  const updateEdgeData = useCallback(
    (edgeId: string, patch: Partial<CableData>) => {
      setEdges((current) =>
        current.map((e) => {
          if (e.id !== edgeId) return e
          const oldData = (e.data as CableData | undefined) ?? {
            name: '',
            type: 'Custom' as CableType,
            length: 0.5,
            color: DEFAULT_COLOR,
          }
          const merged: CableData = { ...oldData, ...patch }
          return edgeFromCableData(
            {
              id: e.id,
              source: e.source,
              sourceHandle: e.sourceHandle ?? undefined,
              target: e.target,
              targetHandle: e.targetHandle ?? undefined,
            },
            merged,
          )
        }),
      )
    },
    [setEdges],
  )

  const removeEdge = useCallback(
    (edgeId: string) => {
      setEdges((current) => current.filter((e) => e.id !== edgeId))
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null)
    },
    [selectedEdgeId, setEdges],
  )

  const removeSelected = () => {
    if (!selectedEdgeId) return
    removeEdge(selectedEdgeId)
  }

  // Right-click on an edge → open custom context menu.
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      const rect = wrapperRef.current?.getBoundingClientRect()
      const x = rect ? event.clientX - rect.left : event.clientX
      const y = rect ? event.clientY - rect.top : event.clientY
      setCableMenu({ x, y, edgeId: edge.id })
      setPaneMenu(null)
      setSelectedEdgeId(edge.id)
    },
    [],
  )

  // Right-click on the canvas pane → open generic context menu.
  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    const rect = wrapperRef.current?.getBoundingClientRect()
    const x = rect ? event.clientX - rect.left : event.clientX
    const y = rect ? event.clientY - rect.top : event.clientY
    setPaneMenu({ x, y })
    setCableMenu(null)
  }, [])

  // Open properties dialog for a cable (from context menu or double-click).
  const openCableProperties = useCallback(
    (edgeId: string) => {
      const edge = edges.find((e) => e.id === edgeId)
      if (!edge) return
      const data = (edge.data as CableData | undefined) ?? {
        name: typeof edge.label === 'string' ? edge.label : 'Kabel',
        type: 'Custom' as CableType,
        length: 0.5,
        color: DEFAULT_COLOR,
      }
      setPropsDialog({ edgeId, data })
      setCableMenu(null)
    },
    [edges],
  )

  const onEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      openCableProperties(edge.id)
    },
    [openCableProperties],
  )

  // Auto-Anordnen: re-stack nodes top-down by start-HE.
  const autoLayout = useCallback(() => {
    const sorted = placements.slice().sort((a, b) => a.startUnit - b.startUnit)
    let cursorY = 40
    const newPositions = new Map<string, { x: number; y: number }>()
    for (const p of sorted) {
      const rows = Math.max(p.inputs.length, p.outputs.length, 1)
      const h = HEADER_HEIGHT + rows * PORT_ROW_HEIGHT + 6
      newPositions.set(p.id, { x: X_OFFSET, y: cursorY })
      cursorY += h + Y_GAP
    }
    setNodes((current) =>
      current.map((n) => {
        const pos = newPositions.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
    )
    setPaneMenu(null)
    // Fit view after layout settles.
    window.setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 50)
  }, [fitView, placements, setNodes])

  const deleteAllCables = useCallback(() => {
    if (edges.length === 0) {
      setPaneMenu(null)
      return
    }
    const ok = window.confirm(`Alle ${edges.length} Kabel löschen?`)
    if (!ok) {
      setPaneMenu(null)
      return
    }
    setEdges([])
    setSelectedEdgeId(null)
    setPaneMenu(null)
  }, [edges.length, setEdges])

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
      const data = (e.data as CableData | undefined) ?? {
        name: '',
        type: 'Custom' as CableType,
        length: 0.5,
        color: DEFAULT_COLOR,
      }
      cables.push({
        fromItemIndex: fromIdx,
        fromPortName: fromPort.portName,
        toItemIndex: toIdx,
        toPortName: toPort.portName,
        name: data.name || `${fromPort.portName} → ${toPort.portName}`,
        type: data.type,
        length: data.length,
        color: data.color,
        ...(data.standard ? { standard: data.standard } : {}),
      })
    }
    onApply(cables)
  }

  const cableCount = edges.length

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-3 py-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">
            🔌 Rack-Verkabelung: {rackName}
          </h3>
          <p className="text-[11px] text-slate-400">
            Ziehe Linien Output → Input. Rechtsklick = Menü, Doppelklick = Eigenschaften, Entf = Löschen.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={autoLayout}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-100 hover:bg-slate-600"
            title="Geräte vertikal neu anordnen"
          >
            Auto-Anordnen
          </button>
          <button
            type="button"
            onClick={() => selectedEdgeId && openCableProperties(selectedEdgeId)}
            disabled={!selectedEdgeId}
            className="rounded bg-sky-900/70 px-2 py-1 text-xs text-sky-100 hover:bg-sky-800 disabled:opacity-40"
          >
            Eigenschaften
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selectedEdgeId}
            className="rounded bg-red-900/60 px-2 py-1 text-xs text-red-200 hover:bg-red-800 disabled:opacity-40"
          >
            Löschen
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
            Übernehmen ({cableCount} Kabel)
          </button>
        </div>
      </div>
      <div ref={wrapperRef} className="relative min-h-0 flex-1">
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
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={() => {
            setCableMenu(null)
            setPaneMenu(null)
          }}
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

        {cableMenu && (
          <ContextMenu
            x={cableMenu.x}
            y={cableMenu.y}
            items={[
              {
                label: 'Eigenschaften…',
                icon: '✏️',
                onClick: () => openCableProperties(cableMenu.edgeId),
              },
              {
                label: 'Verbindung löschen',
                icon: '🗑️',
                danger: true,
                onClick: () => {
                  removeEdge(cableMenu.edgeId)
                  setCableMenu(null)
                },
              },
            ]}
            onClose={() => setCableMenu(null)}
          />
        )}

        {paneMenu && (
          <ContextMenu
            x={paneMenu.x}
            y={paneMenu.y}
            items={[
              {
                label: 'Ansicht zentrieren',
                icon: '🎯',
                onClick: () => {
                  fitView({ padding: 0.2, duration: 250 })
                  setPaneMenu(null)
                },
              },
              {
                label: 'Geräte auto-anordnen',
                icon: '📐',
                onClick: autoLayout,
              },
              {
                label: 'Alle Kabel löschen',
                icon: '🗑️',
                danger: true,
                onClick: deleteAllCables,
              },
            ]}
            onClose={() => setPaneMenu(null)}
          />
        )}

        {propsDialog && (
          <CablePropsDialog
            initial={propsDialog.data}
            onCancel={() => setPropsDialog(null)}
            onSave={(next) => {
              updateEdgeData(propsDialog.edgeId, next)
              setPropsDialog(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

interface ContextMenuItem {
  label: string
  icon?: string
  danger?: boolean
  onClick: () => void
}

const ContextMenu = ({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) => {
  return (
    <>
      <div className="absolute inset-0 z-10" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        className="absolute z-20 min-w-[180px] rounded border border-slate-700 bg-slate-800 py-1 text-xs text-slate-100 shadow-xl"
        style={{ left: x, top: y }}
      >
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              it.onClick()
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-700 ${
              it.danger ? 'text-red-300 hover:text-red-200' : ''
            }`}
          >
            {it.icon && <span className="w-4 text-center">{it.icon}</span>}
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

const CABLE_TYPE_OPTIONS: CableType[] = ALL_CONNECTOR_TYPES.filter(
  (t) => t !== 'DIN' && t !== 'DisplayPort' && t !== 'USB',
) as CableType[]

const CablePropsDialog = ({
  initial,
  onCancel,
  onSave,
}: {
  initial: CableData
  onCancel: () => void
  onSave: (data: CableData) => void
}) => {
  const [name, setName] = useState(initial.name)
  const [type, setType] = useState<CableType>(initial.type)
  const [length, setLength] = useState<number>(initial.length)
  const [color, setColor] = useState<string>(initial.color)
  const [standard, setStandard] = useState<SignalStandard | ''>(initial.standard ?? '')

  // When user changes the cable type, suggest its default color (only if
  // current color is the connector-derived default for the old type or the
  // hardcoded default — never overwrite an explicit user choice).
  const lastTypeRef = useRef(type)
  useEffect(() => {
    if (lastTypeRef.current === type) return
    const oldDefault = CONNECTOR_COLOR[lastTypeRef.current] ?? DEFAULT_COLOR
    if (color === oldDefault) {
      const newDefault = CONNECTOR_COLOR[type] ?? DEFAULT_COLOR
      setColor(newDefault)
    }
    lastTypeRef.current = type
  }, [type, color])

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-4 text-slate-100 shadow-2xl">
        <h4 className="mb-3 text-sm font-semibold">Kabel-Eigenschaften</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-400">Typ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CableType)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
              >
                {CABLE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-[11px] text-slate-400">Länge (m)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={length}
                onChange={(e) => setLength(Number(e.target.value) || 0)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">Standard (optional)</label>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value as SignalStandard | '')}
              className="w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs"
            >
              <option value="">(keiner)</option>
              {SIGNAL_STANDARDS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400">Farbe</label>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-6 w-6 rounded border-2 ${color === c ? 'border-white' : 'border-slate-700'}`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-6 w-8 cursor-pointer rounded border border-slate-600 bg-slate-800"
                title="Benutzerdefinierte Farbe"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                name: name.trim() || 'Kabel',
                type,
                length,
                color,
                ...(standard ? { standard: standard as SignalStandard } : {}),
              })
            }
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500"
          >
            Speichern
          </button>
        </div>
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
