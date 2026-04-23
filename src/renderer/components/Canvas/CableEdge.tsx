import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from 'reactflow'
import type { Cable } from '../../types/cable'
import { useProjectStore } from '../../store/projectStore'
import { CableWaypoints } from './CableWaypoints'
import { computeObstacleAwareWaypoints, type Rect } from '../../lib/cableRouting'

interface CableEdgeData {
  cable: Cable
}

/** Normalize waypoints so every segment is strictly horizontal or vertical.
 *  Any diagonal is replaced by an L-corner (horizontal-first). */
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
    if (i > 0) result.push({ x: p.x, y: p.y })
    if (isDiag) result.push({ x: q.x, y: p.y }) // insert H-first corner
  }
  return result
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
  const manualWaypoints = cable.waypoints ?? []
  // When the user has not placed any waypoints, compute an obstacle-aware
  // detour so cables don't cross through equipment rectangles.
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
  const waypoints = rawWaypoints.length > 0
    ? normalizeOrthogonal(
        { x: args.sourceX, y: args.sourceY },
        rawWaypoints,
        { x: args.targetX, y: args.targetY },
      )
    : rawWaypoints

  if (waypoints.length === 0) {
    const [path, labelX, labelY] = getSmoothStepPath(args)
    return [path, labelX, labelY]
  }
  const points = [
    { x: args.sourceX, y: args.sourceY },
    ...waypoints,
    { x: args.targetX, y: args.targetY },
  ]
  const d = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')
  const mid = points[Math.floor(points.length / 2)]
  return [d, mid.x, mid.y]
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
  const [path, labelX, labelY] = cable
    ? buildPath(cable, routingArgs, obstacles, obstacleIds)
    : getSmoothStepPath(routingArgs)

  const strokeWidth = cable?.strokeWidth ?? 2.5
  const dashArray = cable?.dashed ? '6 4' : undefined

  const markerEnd = cable?.arrowEnd === false ? undefined : 'url(#cable-planner-arrow-end)'
  const markerStart = cable?.arrowStart ? 'url(#cable-planner-arrow-start)' : undefined

  const mergedStyle: React.CSSProperties = {
    ...style,
    strokeWidth,
    strokeDasharray: dashArray,
    filter: selected ? 'drop-shadow(0 0 3px rgba(56,189,248,0.9))' : undefined,
  }

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
        />
      )}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: 'rgba(15,23,42,0.85)',
              color: '#e2e8f0',
              border: '1px solid #475569',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {label}
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
