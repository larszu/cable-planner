import { BaseEdge, type EdgeProps, getSmoothStepPath } from 'reactflow'

export const CableEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style }: EdgeProps) => {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return <BaseEdge id={id} path={edgePath} style={style} />
}
