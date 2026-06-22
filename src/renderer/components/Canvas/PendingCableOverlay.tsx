import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useReactFlow, useViewport } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { useTranslation, format } from '../../lib/i18n'

/**
 * Visual overlay that renders the in-progress cable while the user is
 * drawing it with click-to-place waypoints. Shows the dashed path from the
 * source port through all placed waypoints to the current mouse position.
 */
export const PendingCableOverlay = () => {
  const t = useTranslation()
  const pendingCable = useUiStore((s) => s.pendingCable)
  const project = useProjectStore((s) => s.project)
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow()
  const viewport = useViewport()
  const [mouseFlow, setMouseFlow] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pendingCable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset beim Clear neben dem window-mousemove-Listener
      setMouseFlow(null)
      return
    }
    const handler = (event: MouseEvent) => {
      setMouseFlow(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [pendingCable, screenToFlowPosition])

  if (!pendingCable) return null

  // Reference viewport so we refresh when the user pans/zooms.
  void viewport

  const node = getEquipmentById(project.equipment, pendingCable.nodeId)
  if (!node) return null
  const port =
    pendingCable.handleType === 'source'
      ? node.outputs.find((p) => p.id === pendingCable.handleId)
      : node.inputs.find((p) => p.id === pendingCable.handleId)
  if (!port) return null

  // v7.9.4 — Exakte Handle-Position via shared computeEquipmentLayout.
  // Vorher rechnete diese Datei mit fixer width=220 ohne Auto-Expand,
  // ohne Side-Overrides und ohne IP/Subtitle/Beltpack-Header-Offset →
  // bei breiteren Geräten landete der Startpunkt der gestrichelten
  // Linie mitten im Gerät statt am Port (User-Bug "startpunkt der
  // gelben gestrichelten linie ist aktuell immer die geräte mitte").
  const layout = computeEquipmentLayout(node, project.greengoConfig)
  const pos = layout.portPos(
    port.id,
    pendingCable.handleType === 'source' ? 'source' : 'target',
  )
  if (!pos) return null
  const portFlow = { x: pos.x, y: pos.y }

  const points = [portFlow, ...pendingCable.waypoints]
  if (mouseFlow) points.push(mouseFlow)

  const screenPoints = points.map((p) => flowToScreenPosition(p))
  const d = screenPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')

  return (
    <>
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 40,
        }}
      >
        <path
          d={d}
          fill="none"
          stroke="#fbbf24"
          strokeWidth={2}
          strokeDasharray="6 4"
        />
        {pendingCable.waypoints.map((wp, i) => {
          const s = flowToScreenPosition(wp)
          return <circle key={i} cx={s.x} cy={s.y} r={4} fill="#fbbf24" />
        })}
      </svg>
      <div
        style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.92)',
          color: '#fde68a',
          border: '1px solid #f59e0b',
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          zIndex: 50,
          pointerEvents: 'none',
        }}
      >
        {t('pendingCable.banner', 'Kabel zeichnen: Klick auf Canvas für Knick, Klick auf Port zum Beenden, Esc zum Abbrechen.')}
      </div>
      <PendingCableSuggestions
        sourcePortConnector={port.connectorType}
        sourceNodeId={node.id}
        sourcePortId={port.id}
        sourceIsOutput={pendingCable.handleType === 'source'}
      />
    </>
  )
}

/**
 * Issue #49: Quick suggestions panel. While the user is mid-cable-draw,
 * shows a small list of library templates whose ports match the source's
 * connector type. Sorted by usage frequency in the current project so the
 * most-used target devices come first. Clicking a suggestion places that
 * device at the last mouse position and finishes the cable to its first
 * matching port — the user gets a 1-click "next likely device" workflow.
 */
const PendingCableSuggestions = ({
  sourcePortConnector,
  sourceNodeId,
  sourcePortId,
  sourceIsOutput,
}: {
  sourcePortConnector: string
  sourceNodeId: string
  sourcePortId: string
  sourceIsOutput: boolean
}) => {
  const tr = useTranslation()
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const cables = useProjectStore((s) => s.project.cables)
  const equipment = useProjectStore((s) => s.project.equipment)
  const importEquipment = useProjectStore((s) => s.importEquipment)
  const queueConnection = useProjectStore((s) => s.queueConnection)
  const createCableFromPending = useProjectStore((s) => s.createCableFromPending)
  const clearPendingCable = useUiStore((s) => s.clearPendingCable)
  const { screenToFlowPosition } = useReactFlow()
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  const suggestions = useMemo(() => {
    // Usage counts: how often each template name has been the *target* (or
    // source, depending on which direction we're searching) of any cable in
    // the current project. Templates the user wires up frequently float to
    // the top.
    const usage = new Map<string, number>()
    const nameById = new Map(equipment.map((e) => [e.id, e.name]))
    for (const c of cables) {
      const targetEqId = sourceIsOutput ? c.toEquipmentId : c.fromEquipmentId
      const name = nameById.get(targetEqId)
      if (name) usage.set(name, (usage.get(name) ?? 0) + 1)
    }
    // Required port direction on the candidate template:
    //   - source is an OUTPUT port  → candidate needs an INPUT  with same connector
    //   - source is an INPUT  port  → candidate needs an OUTPUT with same connector
    const needsKey = sourceIsOutput ? 'inputs' : 'outputs'
    return customLibrary
      .filter((t) => !t.hidden)
      .filter((t) =>
        (t[needsKey] ?? []).some((p) => p.connectorType === sourcePortConnector),
      )
      .sort((a, b) => (usage.get(b.name) ?? 0) - (usage.get(a.name) ?? 0))
      .slice(0, 8)
  }, [customLibrary, cables, equipment, sourceIsOutput, sourcePortConnector])

  if (suggestions.length === 0) return null

  const place = (template: typeof suggestions[number]) => {
    if (!mousePos) return
    const flow = screenToFlowPosition(mousePos)
    const matchKey = sourceIsOutput ? 'inputs' : 'outputs'
    const matchPort = (template[matchKey] ?? []).find(
      (p) => p.connectorType === sourcePortConnector,
    )
    if (!matchPort) return
    const newId = uuidv4()
    const newPortId = uuidv4()
    importEquipment([
      {
        ...template,
        id: newId,
        x: flow.x,
        y: flow.y,
        inputs: (template.inputs ?? []).map((p) =>
          p.id === matchPort.id && sourceIsOutput
            ? { ...p, id: newPortId }
            : { ...p, id: uuidv4() },
        ),
        outputs: (template.outputs ?? []).map((p) =>
          p.id === matchPort.id && !sourceIsOutput
            ? { ...p, id: newPortId }
            : { ...p, id: uuidv4() },
        ),
      },
    ])
    queueConnection({
      source: sourceIsOutput ? sourceNodeId : newId,
      sourceHandle: sourceIsOutput ? sourcePortId : newPortId,
      target: sourceIsOutput ? newId : sourceNodeId,
      targetHandle: sourceIsOutput ? newPortId : sourcePortId,
    })
    createCableFromPending({
      name: template.name,
      type: 'Custom',
      length: 1,
      color: '#64748b',
      notes: '',
    })
    clearPendingCable()
  }

  return (
    <div
      // #450 — vorher fest dunkle slate-Hex → im Light-Mode dunkler Kasten.
      // Jetzt theme-aware über die --cp-*-Tokens (kippen mit dem Theme).
      style={{
        position: 'fixed',
        top: 60,
        right: 12,
        background: 'var(--cp-surface-1)',
        color: 'var(--cp-text)',
        border: '1px solid var(--cp-border)',
        padding: 8,
        borderRadius: 6,
        fontSize: 11,
        zIndex: 50,
        maxWidth: 220,
        pointerEvents: 'auto',
      }}
      className="nodrag nopan"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ marginBottom: 6, fontWeight: 600, color: 'var(--cp-accent)' }}>
        {format(tr('pendingCable.suggestionsTitle', 'Schnelle Vorschläge ({connector})'), { connector: sourcePortConnector })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {suggestions.map((t) => (
          <button
            key={t.name}
            type="button"
            onClick={() => place(t)}
            style={{
              textAlign: 'left',
              padding: '4px 6px',
              background: 'var(--cp-surface-2)',
              border: '1px solid var(--cp-border-muted)',
              borderRadius: 3,
              color: 'var(--cp-text)',
              cursor: 'pointer',
            }}
            title={format(tr('pendingCable.suggestionItemTitle', 'Bei Mausposition platzieren und Verbindung herstellen ({category})'), { category: t.category })}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
