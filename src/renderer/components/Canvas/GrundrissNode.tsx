import { memo } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import type { Grundriss, PlanPunkt } from '../../types/grundriss'

export type GrundrissNodeData = Grundriss

/**
 * Der Hallenplan als unterster Knoten. Ein Knoten und kein CSS-Hintergrund,
 * weil die Exporte (PDF, PNG) ihre Flaeche aus den `.react-flow__node`
 * bestimmen: so ist der Plan im Ausdruck, ohne dass ein Export davon wissen
 * muss.
 *
 * Gesperrt laesst er jeden Klick durch (pointer-events: none) — auf einem
 * Plan, der unter allem liegt, soll ein Klick das Geraet treffen.
 */
export const GrundrissNode = memo(({ data, selected }: NodeProps<GrundrissNodeData>) => {
  const k = data.kalibrierung
  const lokal = (p: PlanPunkt) => `${p.x - data.x},${p.y - data.y}`
  return (
    <div style={{ width: '100%', height: '100%', pointerEvents: data.gesperrt ? 'none' : 'auto' }}>
      <NodeResizer isVisible={!!selected && !data.gesperrt} keepAspectRatio minWidth={80} minHeight={40} />
      <img
        src={data.src}
        alt={data.name ?? ''}
        draggable={false}
        style={{ width: '100%', height: '100%', opacity: data.deckkraft, display: 'block', pointerEvents: 'none' }}
      />
      {k && (
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          {k.art === 'zweiPunkt' ? (
            <polyline points={`${lokal(k.a)} ${lokal(k.b)}`} stroke="var(--cp-signal)" strokeWidth={2} strokeDasharray="6 4" fill="none" />
          ) : (
            <polygon points={k.ecken.map(lokal).join(' ')} stroke="var(--cp-signal)" strokeWidth={2} strokeDasharray="6 4" fill="none" />
          )}
        </svg>
      )}
    </div>
  )
})
GrundrissNode.displayName = 'GrundrissNode'
