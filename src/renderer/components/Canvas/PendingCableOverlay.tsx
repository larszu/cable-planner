import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useReactFlow, useViewport } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { useTranslation, format } from '../../lib/i18n'

/**
 * Shared look of the two banner buttons (#834).
 *
 * `minHeight: 44` is not decoration: it is the smallest target a finger hits
 * reliably (WCAG 2.5.5). A 20-px button next to a 12-px line of text reads as
 * an escape hatch and behaves like a trap.
 */
const BANNER_BUTTON: CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  background: 'rgba(251,191,36,0.15)',
  color: '#fde68a',
  border: '1px solid #f59e0b',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
}

/**
 * Visual overlay that renders the in-progress cable while the user is
 * drawing it with click-to-place waypoints. Shows the dashed path from the
 * source port through all placed waypoints to the current mouse position.
 */
export const PendingCableOverlay = () => {
  const t = useTranslation()
  const pendingCable = useUiStore((s) => s.pendingCable)
  const clearPendingCable = useUiStore((s) => s.clearPendingCable)
  const removeLastPendingWaypoint = useUiStore((s) => s.removeLastPendingWaypoint)
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
    // #834 — `pointermove` statt `mousemove`: das eine Ereignis deckt Maus,
    // Finger und Stift ab. Mit `mousemove` allein blieb die gestrichelte
    // Vorschau auf einem Touchscreen am Startpunkt kleben, weil dort ohne
    // Zeiger auch kein Zeiger bewegt wird.
    const handler = (event: PointerEvent) => {
      setMouseFlow(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
    }
    window.addEventListener('pointermove', handler)
    return () => window.removeEventListener('pointermove', handler)
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
  const layout = computeEquipmentLayout(node, project.intercom)
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
      {/*
        #834 — Das Band war reiner Text mit `pointerEvents: 'none'` und nannte
        als Ausweg nur „Esc". Auf einem Touchscreen gibt es keine Esc-Taste:
        wer dort eine Linie anfing, kam nicht mehr heraus ausser ueber einen
        zweiten Port, den er vielleicht gar nicht wollte.

        Die beiden Knoepfe stehen fuer ALLE da und nicht nur fuer Touch —
        dieselbe Lehre wie bei B-44 Teil 2: ein Weg, den nur eine Taste oeffnet,
        ist fuer den halben Saal zu. Sie sind mit 44 px hoch genug fuer einen
        Finger (WCAG 2.5.5).
      */}
      <div
        className="nodrag nopan"
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
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          maxWidth: 'calc(100vw - 24px)',
          flexWrap: 'wrap',
          pointerEvents: 'auto',
        }}
        // Ohne das setzt ReactFlow den Klick als Pane-Klick fort und legt
        // ausgerechnet dort einen Knick ab, wo jemand abbrechen wollte.
        onPointerDown={(e) => e.stopPropagation()}
      >
        <span style={{ pointerEvents: 'none' }}>
          {t('pendingCable.banner', 'Draw cable: tap the canvas for a bend, tap a port to finish.')}
        </span>
        <button
          type="button"
          onClick={() => removeLastPendingWaypoint()}
          disabled={pendingCable.waypoints.length === 0}
          style={{
            ...BANNER_BUTTON,
            opacity: pendingCable.waypoints.length === 0 ? 0.45 : 1,
            cursor: pendingCable.waypoints.length === 0 ? 'default' : 'pointer',
          }}
        >
          {t('pendingCable.undoBend', 'Undo bend')}
        </button>
        <button type="button" onClick={() => clearPendingCable()} style={BANNER_BUTTON}>
          {t('pendingCable.cancel', 'Cancel')}
        </button>
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
    // #834 — auch hier `pointermove`: sonst bleibt `mousePos` auf einem
    // Touchscreen `null`, und `place()` steigt in der ersten Zeile aus. Der
    // Vorschlag sah dann bedienbar aus und tat beim Tippen nichts.
    const handler = (e: PointerEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', handler)
    return () => window.removeEventListener('pointermove', handler)
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
        {format(tr('pendingCable.suggestionsTitle', 'Quick suggestions ({connector})'), { connector: sourcePortConnector })}
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
            title={format(tr('pendingCable.suggestionItemTitle', 'Place at the pointer and connect ({category})'), { category: t.category })}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
