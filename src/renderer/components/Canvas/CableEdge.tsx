import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from 'reactflow'
import type { Cable } from '../../types/cable'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { CableWaypoints } from './CableWaypoints'
import { computeObstacleAwareWaypoints, type Rect } from '../../lib/cableRouting'

interface CableEdgeData {
  cable: Cable
  exportThemeOverride?: 'dark' | 'light'
}

/**
 * Issue #65: Replace each crossing point with a small jump-bump arc so
 * the user can see which cable is "on top" when two cables cross.
 *
 * Input: a polyline (list of points forming straight segments).
 * Output: an SVG-path `d` string with the original moves/lines plus an
 *         arc of `bumpRadius` over each crossing point.
 *
 * We only consider perpendicular crossings; near-parallel overlaps fall
 * through as regular line segments because a bump there would look
 * weird. The crossings are computed against `otherSegments`, which
 * should be the segments of all OTHER cables on the canvas.
 */
const buildPathWithBumps = (
  points: { x: number; y: number }[],
  otherSegments: Array<{
    a: { x: number; y: number }
    b: { x: number; y: number }
  }>,
  bumpRadius = 5,
): string => {
  if (points.length < 2 || otherSegments.length === 0) {
    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')
  }
  const segments: string[] = []
  segments.push(`M ${points[0].x} ${points[0].y}`)
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    const horizontal = Math.abs(q.y - p.y) < 1
    const vertical = Math.abs(q.x - p.x) < 1
    if (!horizontal && !vertical) {
      segments.push(`L ${q.x} ${q.y}`)
      continue
    }
    // Find perpendicular crossings on this segment, sorted by distance
    // from p so we draw them in order.
    const hits: number[] = []
    for (const other of otherSegments) {
      const oHoriz = Math.abs(other.a.y - other.b.y) < 1
      const oVert = Math.abs(other.a.x - other.b.x) < 1
      if (horizontal && oVert) {
        const ox = other.a.x
        const oyMin = Math.min(other.a.y, other.b.y)
        const oyMax = Math.max(other.a.y, other.b.y)
        const xMin = Math.min(p.x, q.x)
        const xMax = Math.max(p.x, q.x)
        if (
          ox > xMin + bumpRadius &&
          ox < xMax - bumpRadius &&
          p.y > oyMin + 1 &&
          p.y < oyMax - 1
        ) {
          hits.push(ox)
        }
      } else if (vertical && oHoriz) {
        const oy = other.a.y
        const oxMin = Math.min(other.a.x, other.b.x)
        const oxMax = Math.max(other.a.x, other.b.x)
        const yMin = Math.min(p.y, q.y)
        const yMax = Math.max(p.y, q.y)
        if (
          oy > yMin + bumpRadius &&
          oy < yMax - bumpRadius &&
          p.x > oxMin + 1 &&
          p.x < oxMax - 1
        ) {
          hits.push(oy)
        }
      }
    }
    if (hits.length === 0) {
      segments.push(`L ${q.x} ${q.y}`)
      continue
    }
    // Sort by distance from p along the segment direction.
    const ascending = horizontal ? q.x > p.x : q.y > p.y
    hits.sort((a, b) => (ascending ? a - b : b - a))
    let curX = p.x
    let curY = p.y
    for (const hit of hits) {
      if (horizontal) {
        const arcStartX = ascending ? hit - bumpRadius : hit + bumpRadius
        const arcEndX = ascending ? hit + bumpRadius : hit - bumpRadius
        segments.push(`L ${arcStartX} ${curY}`)
        // sweep flag 0 keeps the arc on the "top" side (negative y) of
        // a horizontal segment regardless of travel direction
        segments.push(`A ${bumpRadius} ${bumpRadius} 0 0 ${ascending ? 1 : 0} ${arcEndX} ${curY}`)
        curX = arcEndX
      } else {
        const arcStartY = ascending ? hit - bumpRadius : hit + bumpRadius
        const arcEndY = ascending ? hit + bumpRadius : hit - bumpRadius
        segments.push(`L ${curX} ${arcStartY}`)
        segments.push(`A ${bumpRadius} ${bumpRadius} 0 0 ${ascending ? 0 : 1} ${curX} ${arcEndY}`)
        curY = arcEndY
      }
    }
    segments.push(`L ${q.x} ${q.y}`)
  }
  return segments.join(' ')
}

/** Normalize waypoints so every segment is strictly horizontal or vertical.
 *  Any diagonal is replaced by an L-corner (horizontal-first). Already
 *  orthogonal segments are passed through unchanged so we don't introduce
 *  spurious bends that make the cable visually "jump". */
function normalizeOrthogonal(
  src: { x: number; y: number },
  wps: { x: number; y: number }[],
  tgt: { x: number; y: number },
  tol = 2,
): { x: number; y: number }[] {
  const pts = [src, ...wps, tgt]
  const result: { x: number; y: number }[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]
    const q = pts[i + 1]
    const isDiag = Math.abs(q.x - p.x) > tol && Math.abs(q.y - p.y) > tol
    // Push every intermediate waypoint (not source, not target).
    if (i > 0) result.push({ x: p.x, y: p.y })
    // Only insert an L-corner if this segment is actually diagonal.
    if (isDiag) result.push({ x: q.x, y: p.y })
  }
  return result
}

const resolveOrthogonalWaypoints = (
  cable: Cable,
  args: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  },
  obstacles: Rect[],
  obstacleIds: string[],
): { x: number; y: number }[] => {
  const manualWaypoints = cable.waypoints ?? []
  const autoWaypoints =
    manualWaypoints.length === 0
      ? computeObstacleAwareWaypoints(
          { x: args.sourceX, y: args.sourceY },
          { x: args.targetX, y: args.targetY },
          obstacles,
          new Set([cable.fromEquipmentId, cable.toEquipmentId]),
          obstacleIds,
        )
      : []
  const rawWaypoints = manualWaypoints.length > 0 ? manualWaypoints : autoWaypoints
  return rawWaypoints.length > 0
    ? normalizeOrthogonal(
        { x: args.sourceX, y: args.sourceY },
        rawWaypoints,
        { x: args.targetX, y: args.targetY },
      )
    : rawWaypoints
}

/** Issue #53: deterministic small offset for the midline of a cable
 *  so two cables that would compute the same midX/midY don't perfectly
 *  overlap. Hash the cable id to a stable jitter in -10..+10 px. */
const midlineJitter = (cableId: string): number => {
  let hash = 0
  for (let i = 0; i < cableId.length; i++) {
    hash = (hash * 31 + cableId.charCodeAt(i)) | 0
  }
  // Map to -10, -6, -2, +2, +6, +10 — six discrete lanes so even
  // many overlapping cables space out predictably.
  const lanes = [-10, -6, -2, 2, 6, 10]
  return lanes[Math.abs(hash) % lanes.length]
}

const buildPath = (
  cable: Cable,
  args: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    sourcePosition: EdgeProps['sourcePosition']
    targetPosition: EdgeProps['targetPosition']
  },
  obstacles: Rect[],
  obstacleIds: string[],
  resolvedOrthogonalWaypoints?: { x: number; y: number }[],
): [string, number, number] => {
  const routing = cable.routing ?? 'orthogonal'

  if (routing === 'straight') {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: args.sourceX,
      sourceY: args.sourceY,
      targetX: args.targetX,
      targetY: args.targetY,
    })
    return [path, labelX, labelY]
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath(args)
    return [path, labelX, labelY]
  }
  const waypoints =
    resolvedOrthogonalWaypoints ??
    resolveOrthogonalWaypoints(cable, args, obstacles, obstacleIds)

  if (waypoints.length === 0) {
    // No manual waypoints and no obstacle detour: build a stub-respecting
    // orthogonal path. The first/last segment must be perpendicular to the
    // device handle (i.e. exit a Right-handle going right, enter a Left-handle
    // going right). Without that, an L-shape can land at the target's left
    // handle going *vertically*, so the cable runs along the device's left
    // edge and visually disappears behind the device body (issue #51).
    const sx = args.sourceX
    const sy = args.sourceY
    const tx = args.targetX
    const ty = args.targetY
    const STUB = 18
    const stub = (
      pt: { x: number; y: number },
      pos: EdgeProps['sourcePosition'] | EdgeProps['targetPosition'] | undefined,
    ): { x: number; y: number } => {
      switch (pos) {
        case Position.Left:
          return { x: pt.x - STUB, y: pt.y }
        case Position.Right:
          return { x: pt.x + STUB, y: pt.y }
        case Position.Top:
          return { x: pt.x, y: pt.y - STUB }
        case Position.Bottom:
          return { x: pt.x, y: pt.y + STUB }
        default:
          // Unknown handle orientation: fall back to a tiny rightward stub so
          // the path is still well-defined.
          return { x: pt.x + STUB, y: pt.y }
      }
    }
    const sStub = stub({ x: sx, y: sy }, args.sourcePosition)
    const tStub = stub({ x: tx, y: ty }, args.targetPosition)
    const sHorizontal =
      args.sourcePosition === Position.Left || args.sourcePosition === Position.Right
    const tHorizontal =
      args.targetPosition === Position.Left || args.targetPosition === Position.Right

    // Compose intermediate points between sStub and tStub. The exact shape
    // depends on whether the two stubs share an axis after stub-out.
    // Issue #53: when the user enabled `orthogonalCollisionShift` we
    // jitter the midline so cables that would compute identical
    // midX/midY don't perfectly overlap. The jitter is hashed from the
    // cable id so it's stable across re-renders.
    const collisionShiftOn = useUiStore.getState().orthogonalCollisionShift
    const jitter = collisionShiftOn ? midlineJitter(cable.id) : 0
    const points: { x: number; y: number }[] = [{ x: sx, y: sy }, sStub]
    if (Math.abs(sStub.x - tStub.x) < 2 || Math.abs(sStub.y - tStub.y) < 2) {
      // Stubs are collinear: src → sStub → tStub → tgt is already orthogonal.
    } else if (sHorizontal && tHorizontal) {
      // Both handles horizontal (typical port-to-port): bend at midX.
      const midX = (sStub.x + tStub.x) / 2 + jitter
      points.push({ x: midX, y: sStub.y }, { x: midX, y: tStub.y })
    } else if (!sHorizontal && !tHorizontal) {
      // Both handles vertical: bend at midY.
      const midY = (sStub.y + tStub.y) / 2 + jitter
      points.push({ x: sStub.x, y: midY }, { x: tStub.x, y: midY })
    } else if (sHorizontal) {
      // Source horizontal → target vertical: single bend at (tStub.x, sStub.y).
      points.push({ x: tStub.x, y: sStub.y })
    } else {
      // Source vertical → target horizontal: single bend at (sStub.x, tStub.y).
      points.push({ x: sStub.x, y: tStub.y })
    }
    points.push(tStub, { x: tx, y: ty })

    // Build SVG path and find the longest segment for the label position.
    const d = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')
    let bestLen = -1
    let labelX = (sx + tx) / 2
    let labelY = (sy + ty) / 2
    for (let i = 0; i < points.length - 1; i++) {
      const len =
        Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
      if (len > bestLen) {
        bestLen = len
        labelX = (points[i].x + points[i + 1].x) / 2
        labelY = (points[i].y + points[i + 1].y) / 2
      }
    }
    return [d, labelX, labelY]
  }
  const points = [
    { x: args.sourceX, y: args.sourceY },
    ...waypoints,
    { x: args.targetX, y: args.targetY },
  ]
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')
  // Place label at midpoint of the longest segment so it appears on a clear
  // stretch of cable, not crammed into the bend corner.
  let bestLen = -1
  let labelX = points[Math.floor(points.length / 2)].x
  let labelY = points[Math.floor(points.length / 2)].y
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const len = Math.abs(dx) + Math.abs(dy)
    if (len > bestLen) {
      bestLen = len
      labelX = (points[i].x + points[i + 1].x) / 2
      labelY = (points[i].y + points[i + 1].y) / 2
    }
  }
  return [d, labelX, labelY]
}

export const CableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  selected,
  label,
}: EdgeProps<CableEdgeData>) => {
  const cable = data?.cable
  const deleteCable = useProjectStore((state) => state.deleteCable)
  const equipment = useProjectStore((state) => state.project.equipment)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  // Issue #68: when hovered, draw the cable thicker + with a sky glow.
  // EquipmentNode reads the same store value to highlight the matching
  // port handles, so the entire connection visually pops at once.
  const hoveredCableId = useUiStore((s) => s.hoveredCableId)
  const hovered = hoveredCableId === id
  const isLight = (data?.exportThemeOverride ?? canvasTheme) === 'light'

  const { obstacles, obstacleIds } = (() => {
    const rects: Rect[] = []
    const ids: string[] = []
    for (const item of equipment) {
      const HEADER = item.ipAddress ? 62 : 48
      const ROW = 22
      const PADDING = 8
      const width = Math.max(item.width ?? 220, 200)
      const portRows = Math.max(item.inputs.length, item.outputs.length, 1)
      const height = Math.max(item.height ?? HEADER + portRows * ROW + PADDING, HEADER + portRows * ROW + PADDING)
      rects.push({ x: item.x, y: item.y, width, height })
      ids.push(item.id)
    }
    return { obstacles: rects, obstacleIds: ids }
  })()

  const routingArgs = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  }
  const orthogonalWaypoints = cable
    ? resolveOrthogonalWaypoints(cable, routingArgs, obstacles, obstacleIds)
    : []
  const [path, centerX, centerY] = cable
    ? buildPath(cable, routingArgs, obstacles, obstacleIds, orthogonalWaypoints)
    : getSmoothStepPath(routingArgs)

  // Resolve label position: center (default), near source, near target.
  const labelPos = cable?.labelPosition ?? 'center'
  let labelX = centerX
  let labelY = centerY
  if (labelPos === 'source') {
    labelX = sourceX + (centerX - sourceX) * 0.15
    labelY = sourceY + (centerY - sourceY) * 0.15
  } else if (labelPos === 'target') {
    labelX = targetX + (centerX - targetX) * 0.15
    labelY = targetY + (centerY - targetY) * 0.15
  }

  const strokeWidth = cable?.strokeWidth ?? 2.5
  // Wireless cables are always dashed (unless the user has explicitly set dashed=false)
  const isWireless = cable?.wireless === true
  const dashArray = (cable?.dashed || isWireless) ? '6 4' : undefined

  // Bidirectional cables (USB, Ethernet, Fibre, …) get arrow markers on
  // BOTH ends to communicate two-way signal flow. The user can still
  // override per-end with the arrowStart / arrowEnd toggles, but the
  // bidirectional flag is the easier single switch (issue #67).
  const bidi = cable?.bidirectional === true
  const markerEnd =
    bidi || cable?.arrowEnd !== false ? 'url(#cable-planner-arrow-end)' : undefined
  const markerStart =
    bidi || cable?.arrowStart ? 'url(#cable-planner-arrow-start)' : undefined

  const mergedStyle: React.CSSProperties = {
    ...style,
    // Bump stroke a bit on hover so the connection visually pops out
    // even when surrounded by dense routing (issue #68).
    strokeWidth: hovered ? strokeWidth + 1.5 : strokeWidth,
    strokeDasharray: dashArray,
    filter: selected
      ? 'drop-shadow(0 0 3px rgba(56,189,248,0.9))'
      : hovered
        ? 'drop-shadow(0 0 4px rgba(56,189,248,0.65))'
        : undefined,
  }

  // Build label text: for wireless cables, prefix with signal icon + frequency/channel info
  const wirelessSuffix = isWireless
    ? ` 〜${cable?.frequency ? ` ${cable.frequency}` : ''}${cable?.wifiChannel ? ` CH${cable.wifiChannel}` : ''}`
    : ''
  const displayLabel = label ? `${label}${wirelessSuffix}` : (wirelessSuffix.trim() ? wirelessSuffix.trim() : undefined)

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={mergedStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {cable && (
        <CableWaypoints
          cable={cable}
          edgeId={id}
          selected={!!selected}
          source={{ x: sourceX, y: sourceY }}
          target={{ x: targetX, y: targetY }}
          renderWaypoints={orthogonalWaypoints}
          exportThemeOverride={data?.exportThemeOverride}
        />
      )}
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: isLight ? 'rgba(241,245,249,0.92)' : 'rgba(15,23,42,0.85)',
              color: isLight ? '#1e293b' : '#e2e8f0',
              border: `1px solid ${isLight ? '#94a3b8' : '#475569'}`,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {displayLabel}
            {selected && cable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteCable(cable.id)
                }}
                style={{
                  marginLeft: 6,
                  background: '#b91c1c',
                  border: 'none',
                  color: 'white',
                  borderRadius: 3,
                  padding: '0 4px',
                  cursor: 'pointer',
                }}
                title="Delete cable"
              >
                ×
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
