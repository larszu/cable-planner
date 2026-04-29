import { useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { Cable, CableWaypoint } from '../../types/cable'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'

interface Props {
  cable: Cable
  /** ReactFlow edge id — used to select the edge when dragging unselected. */
  edgeId: string
  selected: boolean
  source: { x: number; y: number }
  target: { x: number; y: number }
  /** Effective rendered orthogonal waypoints (manual or auto-routed). */
  renderWaypoints?: { x: number; y: number }[]
  exportThemeOverride?: 'dark' | 'light'
}

const HANDLE_SIZE = 8
const SEGMENT_HIT_WIDTH = 16
const AXIS_TOL = 3

type SegmentAxis = 'horizontal' | 'vertical' | 'diagonal'

function segmentAxis(p: { x: number; y: number }, q: { x: number; y: number }): SegmentAxis {
  if (Math.abs(q.y - p.y) < AXIS_TOL) return 'horizontal'
  if (Math.abs(q.x - p.x) < AXIS_TOL) return 'vertical'
  return 'diagonal'
}

function segmentCursor(axis: SegmentAxis): string {
  if (axis === 'horizontal') return 'ns-resize'
  if (axis === 'vertical') return 'ew-resize'
  return 'grab'
}

/**
 * Remove redundant collinear waypoints.
 * A waypoint is redundant when the segment leading in and the segment
 * leading out share the same axis and the point lies on that line —
 * i.e. three consecutive points are all on the same horizontal or vertical.
 *
 * Example: source→wp0 is horizontal and wp0→wp1 is also horizontal
 * (same Y) → wp0 adds no bend and can be removed.
 *
 * Runs iteratively until stable so it handles cascading collinearities.
 */
function cleanCollinear(
  waypoints: CableWaypoint[],
  source: { x: number; y: number },
  target: { x: number; y: number },
  tol = AXIS_TOL,
): CableWaypoint[] {
  let pts: { x: number; y: number }[] = [source, ...waypoints, target]
  let changed = true
  while (changed) {
    changed = false
    const next: typeof pts = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const nextp = pts[i + 1]
      const horizontal = Math.abs(prev.y - curr.y) < tol && Math.abs(curr.y - nextp.y) < tol
      const vertical   = Math.abs(prev.x - curr.x) < tol && Math.abs(curr.x - nextp.x) < tol
      if (horizontal || vertical) {
        changed = true // skip this waypoint — it's collinear
      } else {
        next.push(curr)
      }
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  // strip source and target back off; return only interior waypoints
  return pts.slice(1, -1) as CableWaypoint[]
}

/**
 * Renders segment drag hit-areas (always active) and waypoint dot handles
 * (only when selected).
 *
 * yEd-style UX:
 * - Hover any segment → cursor changes to ↕ / ↔ showing which axis will move
 * - Drag directly on the segment (no prior selection required)
 * - Drag starts segment movement; unselected edge is auto-selected first
 * - Selected edge additionally shows blue dot handles for fine-tuning
 */
export const CableWaypoints = ({
  cable,
  edgeId,
  selected,
  source,
  target,
  renderWaypoints,
  exportThemeOverride,
}: Props) => {
  const updateCable = useProjectStore((state) => state.updateCable)
  const setSelection = useProjectStore((state) => state.setSelection)
  const { screenToFlowPosition } = useReactFlow()
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (exportThemeOverride ?? canvasTheme) === 'light'
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null)

  const routing = cable.routing ?? 'orthogonal'
  if (routing === 'curved') return null

  const waypoints = cable.waypoints ?? []
  // If no manual waypoints exist, use the currently rendered orthogonal path
  // so segment hit-zones match what the user sees on screen.
  const effectiveWaypoints = waypoints.length > 0 ? waypoints : (renderWaypoints ?? [])
  const points: { x: number; y: number }[] = [source, ...effectiveWaypoints, target]
  const totalPoints = points.length

  // ── helpers ────────────────────────────────────────────────────────────────

  const beginDrag = (
    event: React.PointerEvent<SVGElement>,
    update: (flow: { x: number; y: number }) => CableWaypoint[],
    extraPatch?: Partial<Cable>,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const el = event.currentTarget as SVGElement
    el.setPointerCapture(event.pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      const flow = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const next = update(flow)
      updateCable(cable.id, { waypoints: next.length ? next : undefined, ...extraPatch })
    }
    const handleUp = () => {
      el.removeEventListener('pointermove', handleMove as EventListener)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
      try { el.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
      // After drag ends, collapse any redundant collinear waypoints so that
      // segments that became straight lines don't leave orphan bend-points.
      const currentWPs = (useProjectStore.getState().project.cables.find(c => c.id === cable.id)?.waypoints) ?? []
      const cleaned = cleanCollinear(currentWPs, source, target)
      if (cleaned.length !== currentWPs.length) {
        updateCable(cable.id, { waypoints: cleaned.length ? cleaned : undefined })
      }
    }
    el.addEventListener('pointermove', handleMove as EventListener)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleUp)
  }

  // ── existing waypoint dot handles (selected-only) ─────────────────────────

  const dragExisting = (index: number) => (event: React.PointerEvent<SVGElement>) => {
    const initWPs = waypoints.slice()
    const prevFixed = index === 0          // predecessor is source (immutable)
    const nextFixed = index === initWPs.length - 1  // successor is target (immutable)
    const prevPt = prevFixed ? source : initWPs[index - 1]
    const nextPt = nextFixed ? target : initWPs[index + 1]
    const wpInit = initWPs[index]
    const inAxis  = segmentAxis(prevPt, wpInit)
    const outAxis = segmentAxis(wpInit, nextPt)

    beginDrag(event, (cursor) => {
      const result = initWPs.slice()
      let cx = cursor.x
      let cy = cursor.y

      // Clamp against fixed endpoints (source/target) to keep segments orthogonal
      if (prevFixed) {
        if (inAxis === 'horizontal') cy = source.y
        else if (inAxis === 'vertical') cx = source.x
      }
      if (nextFixed) {
        if (outAxis === 'horizontal') cy = target.y
        else if (outAxis === 'vertical') cx = target.x
      }

      result[index] = { x: cx, y: cy }

      // Propagate one coordinate to adjacent movable waypoints so they stay orthogonal
      if (!prevFixed && index > 0) {
        if (inAxis === 'horizontal') result[index - 1] = { ...initWPs[index - 1], y: cy }
        else if (inAxis === 'vertical') result[index - 1] = { ...initWPs[index - 1], x: cx }
      }
      if (!nextFixed && index < initWPs.length - 1) {
        if (outAxis === 'horizontal') result[index + 1] = { ...initWPs[index + 1], y: cy }
        else if (outAxis === 'vertical') result[index + 1] = { ...initWPs[index + 1], x: cx }
      }

      return result
    })
  }

  const removeWaypoint = (index: number) => (event: React.MouseEvent<SVGElement>) => {
    if (event.button === 2 || event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      const next = waypoints.slice()
      next.splice(index, 1)
      updateCable(cable.id, { waypoints: next.length ? next : undefined })
    }
  }

  // ── segment drag (always active — yEd-style) ──────────────────────────────
  //
  // Algorithm from mxEdgeSegmentHandler (draw.io/mxGraph):
  //   Horizontal → cursor.y is the new segment Y (both endpoints)
  //   Vertical   → cursor.x is the new segment X (both endpoints)
  //   Fixed source/target get L-shaped corners inserted.

  const dragSegment = (segIdx: number) => (event: React.PointerEvent<SVGElement>) => {
    // Auto-select edge if not already selected.
    if (!selected) setSelection(undefined, edgeId, undefined)

    event.stopPropagation()
    event.preventDefault()
    const el = event.currentTarget as SVGElement
    el.setPointerCapture(event.pointerId)

    const p0 = points[segIdx]
    const p1 = points[segIdx + 1]
    const axis = segmentAxis(p0, p1)

    const startIsSource = segIdx === 0
    const endIsTarget = segIdx + 1 === totalPoints - 1
    const initWaypoints = [...effectiveWaypoints]
    const needsRoutingSwitch = routing === 'straight'

    // For diagonal fallback only.
    const startFlow = screenToFlowPosition({ x: event.clientX, y: event.clientY })

    const handleMove = (moveEvent: PointerEvent) => {
      const cursor = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const dx = cursor.x - startFlow.x
      const dy = cursor.y - startFlow.y

      const constrain = (wp: { x: number; y: number }): CableWaypoint => {
        if (axis === 'horizontal') return { x: wp.x,      y: cursor.y }
        if (axis === 'vertical')   return { x: cursor.x,  y: wp.y }
        return { x: wp.x + dx, y: wp.y + dy }
      }

      let next: CableWaypoint[]

      if (!startIsSource && !endIsTarget) {
        const wi0 = segIdx - 1
        const wi1 = segIdx
        next = initWaypoints.map((wp, i) =>
          i === wi0 || i === wi1 ? constrain(wp) : wp,
        )
      } else if (startIsSource && endIsTarget) {
        if (axis === 'horizontal') {
          next = [{ x: source.x, y: cursor.y }, { x: target.x, y: cursor.y }]
        } else if (axis === 'vertical') {
          next = [{ x: cursor.x, y: source.y }, { x: cursor.x, y: target.y }]
        } else {
          next = [{ x: source.x + dx, y: source.y + dy }, { x: target.x + dx, y: target.y + dy }]
        }
      } else if (startIsSource) {
        const wp0 = initWaypoints[0]
        if (axis === 'horizontal') {
          next = [{ x: source.x, y: cursor.y }, { x: wp0.x, y: cursor.y }, ...initWaypoints.slice(1)]
        } else if (axis === 'vertical') {
          next = [{ x: cursor.x, y: source.y }, { x: cursor.x, y: wp0.y }, ...initWaypoints.slice(1)]
        } else {
          next = [{ x: source.x + dx, y: source.y + dy }, { x: wp0.x + dx, y: wp0.y + dy }, ...initWaypoints.slice(1)]
        }
      } else {
        const wpLast = initWaypoints[segIdx - 1]
        if (axis === 'horizontal') {
          next = [...initWaypoints.slice(0, segIdx - 1), { x: wpLast.x, y: cursor.y }, { x: target.x, y: cursor.y }]
        } else if (axis === 'vertical') {
          next = [...initWaypoints.slice(0, segIdx - 1), { x: cursor.x, y: wpLast.y }, { x: cursor.x, y: target.y }]
        } else {
          next = [...initWaypoints.slice(0, segIdx - 1), { x: wpLast.x + dx, y: wpLast.y + dy }, { x: target.x + dx, y: target.y + dy }]
        }
      }

      updateCable(cable.id, {
        waypoints: next.length ? next : undefined,
        ...(needsRoutingSwitch ? { routing: 'orthogonal' } : {}),
      })
    }

    const handleUp = () => {
      el.removeEventListener('pointermove', handleMove as EventListener)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
      try { el.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
    }
    el.addEventListener('pointermove', handleMove as EventListener)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleUp)
  }

  return (
    <g className="nodrag nopan" style={{ pointerEvents: 'all' }}>
      {/* ── Segment hit areas ──
          In orthogonal routing only horizontal/vertical segments are draggable;
          diagonal segments (e.g. while transitioning) get no handle so the
          user can't accidentally bend a non-ortho segment. */}
      {points.slice(0, -1).map((p, i) => {
        const q = points[i + 1]
        const axis = segmentAxis(p, q)
        if (routing === 'orthogonal' && axis === 'diagonal') return null
        const cursor = segmentCursor(axis)
        const isHovered = hoveredSeg === i

        return (
          <g key={`seg-${i}`}>
            {/* Hover highlight (slightly visible) */}
            {isHovered && (
              <line
                x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke="rgba(56,189,248,0.25)"
                strokeWidth={SEGMENT_HIT_WIDTH}
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Wide transparent hit area */}
            <line
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              stroke="transparent"
              strokeWidth={SEGMENT_HIT_WIDTH}
              strokeLinecap="round"
              style={{ cursor }}
              onPointerEnter={() => setHoveredSeg(i)}
              onPointerLeave={() => setHoveredSeg(null)}
              onPointerDown={dragSegment(i)}
            >
              <title>
                {axis === 'horizontal' ? 'Segment vertikal verschieben' :
                 axis === 'vertical'   ? 'Segment horizontal verschieben' :
                 'Segment verschieben'}
              </title>
            </line>
          </g>
        )
      })}

      {/* ── Existing waypoint dot handles — only when selected ── */}
      {selected && waypoints.map((wp, index) => (
        <circle
          key={`wp-${index}`}
          cx={wp.x} cy={wp.y}
          r={HANDLE_SIZE / 2}
          fill="#38bdf8"
          stroke={isLight ? '#e2e8f0' : '#0f172a'}
          strokeWidth={1.5}
          style={{ cursor: 'move' }}
          onPointerDown={dragExisting(index)}
          onMouseDown={removeWaypoint(index)}
          onContextMenu={(e) => {
            e.preventDefault()
            const next = waypoints.slice()
            next.splice(index, 1)
            updateCable(cable.id, { waypoints: next.length ? next : undefined })
          }}
        >
          <title>Ziehen zum Verschieben · Alt+Klick oder Rechtsklick zum Entfernen</title>
        </circle>
      ))}
    </g>
  )
}
