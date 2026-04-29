import { memo } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import type { LocationFrame } from '../../types/location'
import { useUiStore } from '../../store/uiStore'

type LocationFrameNodeData = LocationFrame & {
  exportThemeOverride?: 'dark' | 'light'
}

/**
 * Visual "group" frame rendered behind equipment nodes.
 *
 * This node is NOT a React Flow parent (to keep existing equipment drag logic
 * untouched). Instead, `CanvasArea` implements "soft grouping": when the frame
 * node starts dragging, it snapshots which equipment is inside, and applies
 * the same delta to them. Resulting UX: drag the frame → contents move with it.
 */
export const LocationFrameNode = memo(({ data, selected }: NodeProps<LocationFrameNodeData>) => {
  const color = data.color || '#38bdf8'
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (data.exportThemeOverride ?? canvasTheme) === 'light'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 40,
        minHeight: 40,
        border: `2px ${selected ? 'solid' : 'dashed'} ${color}`,
        borderRadius: 8,
        background: `${color}12`,
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={40}
        minHeight={40}
        color={color}
        lineStyle={{ borderColor: color }}
        handleStyle={{ background: color }}
      />
      <div
        style={{
          position: 'absolute',
          top: -11,
          left: 12,
          padding: '0 6px',
          background: isLight ? '#dde4ee' : '#0f172a',
          color,
          fontSize: 12,
          fontStyle: 'italic',
          fontWeight: 600,
          letterSpacing: 0.3,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {data.name}
      </div>
    </div>
  )
})
LocationFrameNode.displayName = 'LocationFrameNode'
