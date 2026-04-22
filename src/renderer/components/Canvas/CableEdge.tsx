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

interface CableEdgeData {
  cable: Cable
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
  const waypoints = cable.waypoints ?? []
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

  const routingArgs = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  }
  const [path, labelX, labelY] = cable
    ? buildPath(cable, routingArgs)
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
