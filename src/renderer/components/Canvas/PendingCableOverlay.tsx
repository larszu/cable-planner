import { useEffect, useState } from 'react'
import { useReactFlow, useViewport } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'

/**
 * Visual overlay that renders the in-progress cable while the user is
 * drawing it with click-to-place waypoints. Shows the dashed path from the
 * source port through all placed waypoints to the current mouse position.
 */
export const PendingCableOverlay = () => {
  const pendingCable = useUiStore((s) => s.pendingCable)
  const project = useProjectStore((s) => s.project)
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow()
  const viewport = useViewport()
  const [mouseFlow, setMouseFlow] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pendingCable) {
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

  const node = project.equipment.find((e) => e.id === pendingCable.nodeId)
  if (!node) return null
  const port =
    pendingCable.handleType === 'source'
      ? node.outputs.find((p) => p.id === pendingCable.handleId)
      : node.inputs.find((p) => p.id === pendingCable.handleId)
  if (!port) return null

  // Derive the approximate screen position of the port based on the node's
  // bounding box. Right-side handles sit at x = node.x + width, left-side at
  // x = node.x. Port Y is approximated by its index within the port list.
  const side: 'left' | 'right' = pendingCable.handleType === 'source' ? 'right' : 'left'
  const portList = side === 'right' ? node.outputs : node.inputs
  const portIndex = portList.findIndex((p) => p.id === port.id)
  const HEADER = node.ipAddress ? 62 : 48
  const ROW = 22
  const w = Math.max(node.width ?? 220, 200)
  const portFlow = {
    x: side === 'right' ? node.x + w : node.x,
    y: node.y + HEADER + portIndex * ROW + ROW / 2,
  }

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
        Kabel zeichnen: Klick auf Canvas für Knick, Klick auf Port zum Beenden, Esc zum Abbrechen.
      </div>
    </>
  )
}
