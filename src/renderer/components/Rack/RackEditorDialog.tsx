// Issue #61 — Sub-canvas Rack-Editor.
//
// Architecture decision: keep all equipment + cables in the single
// project store and just FILTER the view here. Members of the rack
// share the same `rackInstanceId` tag (set by `placeGroupPreset`
// whenever a GroupPreset with rack metadata is materialised). Doing
// it this way means:
//   - undo/redo, autosave, locations BOMs, Rentman sync etc. all
//     keep working without needing rack-specific code paths.
//   - The rack editor isn't a separate authoring surface; it's a
//     focused lens on the existing data. Edits made here apply to
//     the main canvas instantly.
//
// The dialog renders a small ReactFlow with vertical rail guides at
// the 19" front and rear positions, plus horizontal HU-stripes so
// the user can see which rack units are occupied. Drag a device
// vertically and it snaps to the nearest whole HU; horizontal
// position is preserved as a free offset for cable management.

import { useMemo } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
} from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { useTranslation } from '../../lib/i18n'
import { EquipmentNode } from '../Canvas/EquipmentNode'
import { CableEdge } from '../Canvas/CableEdge'

const nodeTypes = { equipment: EquipmentNode }
const edgeTypes = { cable: CableEdge }

/** Rack-unit pixel size — must match the visual height of one device
 *  row inside the editor. 28 px gives a reasonable density for medium
 *  racks (24 HU) on a 1080p screen. */
const HU = 28

/** Approximate width of the rendered rack (19" + flanges). Devices
 *  flow under this width; cables can leave the rail area when they
 *  route between non-adjacent items. */
const RACK_WIDTH = 760

interface RackContents {
  label: string
  totalUnits: number
  devices: ReturnType<typeof useProjectStore.getState>['project']['equipment']
  cables: ReturnType<typeof useProjectStore.getState>['project']['cables']
}

const useRackContents = (rackInstanceId: string | undefined): RackContents => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  return useMemo<RackContents>(() => {
    if (!rackInstanceId) return { label: 'Rack', totalUnits: 24, devices: [], cables: [] }
    const devices = equipment.filter((e) => e.rackInstanceId === rackInstanceId)
    const ids = new Set(devices.map((d) => d.id))
    // Internal cables = both endpoints inside the rack. External
    // cables stay on the main canvas and are not shown here so the
    // editor doesn't drag in unrelated equipment.
    const internal = cables.filter(
      (c) => ids.has(c.fromEquipmentId) && ids.has(c.toEquipmentId),
    )
    const label = devices.find((d) => d.rackInstanceLabel)?.rackInstanceLabel ?? 'Rack'
    // Total units = highest occupied unit + device's HU height, with a
    // sane minimum of 12 HU so a tiny rack still looks like a rack.
    const totalUnits = Math.max(
      12,
      ...devices.map((d) => (d.rackInstanceStartUnit ?? 0) + (d.rackUnits ?? 1)),
    )
    return { label, totalUnits, devices, cables: internal }
  }, [equipment, cables, rackInstanceId])
}

const buildNodes = (contents: RackContents): Node[] =>
  contents.devices.map((d) => {
    const startUnit = d.rackInstanceStartUnit ?? 0
    return {
      id: d.id,
      type: 'equipment',
      position: { x: 80, y: 40 + startUnit * HU },
      data: d,
    } as Node
  })

const buildEdges = (contents: RackContents): Edge[] =>
  contents.cables.map((c) => ({
    id: c.id,
    source: c.fromEquipmentId,
    target: c.toEquipmentId,
    sourceHandle: c.fromPortId,
    targetHandle: c.toPortId,
    type: 'cable',
    label: c.name,
    style: { stroke: c.color || '#64748b', strokeWidth: 2.5 },
    data: { cable: c },
  }))

const RackEditorContent = ({ rackInstanceId }: { rackInstanceId: string }) => {
  const contents = useRackContents(rackInstanceId)
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const nodes = useMemo(() => buildNodes(contents), [contents])
  const edges = useMemo(() => buildEdges(contents), [contents])

  // Rail/HU SVG overlay. Drawn behind ReactFlow nodes so devices sit
  // on top of the stripes. Width follows the editor canvas; height
  // accommodates totalUnits.
  const railHeight = 40 + contents.totalUnits * HU
  const railSvg = (
    <svg
      width={RACK_WIDTH + 200}
      height={railHeight}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {/* Outer rack box */}
      <rect
        x={40}
        y={20}
        width={RACK_WIDTH}
        height={contents.totalUnits * HU + 20}
        fill="none"
        stroke="#475569"
        strokeWidth={2}
        rx={4}
      />
      {/* HU stripes */}
      {Array.from({ length: contents.totalUnits }).map((_, i) => (
        <g key={i}>
          <line
            x1={40}
            x2={40 + RACK_WIDTH}
            y1={40 + i * HU}
            y2={40 + i * HU}
            stroke={i % 2 === 0 ? '#1e293b' : '#0f172a'}
            strokeWidth={1}
            opacity={0.6}
          />
          <text
            x={20}
            y={40 + i * HU + HU / 2 + 4}
            fill="#475569"
            fontSize={10}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {i + 1}
          </text>
          <text
            x={40 + RACK_WIDTH + 20}
            y={40 + i * HU + HU / 2 + 4}
            fill="#475569"
            fontSize={10}
            fontFamily="monospace"
            textAnchor="middle"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  )

  const handleNodeDragStop = (_event: unknown, node: Node) => {
    // Snap to nearest HU vertically; keep horizontal offset.
    const snappedUnit = Math.max(0, Math.round((node.position.y - 40) / HU))
    updateEquipment(node.id, { rackInstanceStartUnit: snappedUnit })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {railSvg}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeDragStop={handleNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable
          panOnDrag={[1, 2]}
          minZoom={0.4}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} color="#1e293b" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

export const RackEditorDialog = () => {
  const t = useTranslation()
  const slot = useUiStore((s) => s.rackEditor)
  const close = useUiStore((s) => s.closeRackEditor)
  const { containerRef, containerStyle, headerProps } = useDraggablePosition(
    'cable-planner:modal-pos:rack-editor',
    slot.open,
  )
  if (!slot.open || !slot.rackInstanceId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl"
      >
        <header
          {...headerProps}
          className="flex items-center justify-between border-b border-cp-border px-4 py-2 select-none"
        >
          <div>
            <h2 className="text-cp-base font-semibold">{t('rackEditor.title', 'Rack-Editor')}</h2>
            <p className="text-[10px] text-cp-text-muted">
              {t(
                'rackEditor.intro',
                'Sub-Canvas pro Rack — Geräte sind im Hauptprojekt gespeichert, der Editor zeigt nur diese Rack-Instanz. Vertikal ziehen rastet auf HU-Linien ein.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.close', 'Schließen')}
          </button>
        </header>
        <div className="flex-1 min-h-0 bg-cp-surface-3">
          <ReactFlowProvider>
            <RackEditorContent rackInstanceId={slot.rackInstanceId} />
          </ReactFlowProvider>
        </div>
        <footer className="border-t border-cp-border px-4 py-2 text-[11px] text-cp-text-muted">
          {t(
            'rackEditor.footer',
            'Tipp: HU-Position wird beim Loslassen automatisch auf die nächste ganze HU gerundet. Änderungen wirken sofort auf die Haupt-Canvas.',
          )}
        </footer>
      </div>
    </div>
  )
}
