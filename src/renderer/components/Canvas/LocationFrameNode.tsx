import { memo } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import type { LocationFrame } from '../../types/location'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useTranslation, format } from '../../lib/i18n'

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
 *
 * v7.9.86 / #201 — Lock-Schloss-Symbol neben dem Namen. Klick toggelt
 * `loc.positionLocked` (existiert seit #178). Wenn locked: Frame-Body ist
 * pointer-events:none — Clicks gehen auf darunterliegende Geräte/Canvas
 * durch, Drag/Resize sind ausgeschaltet. Nur das Name+Schloss-Plate bleibt
 * klickbar damit der User entsperren / Settings aufrufen kann.
 */
export const LocationFrameNode = memo(({ id, data, selected }: NodeProps<LocationFrameNodeData>) => {
  const t = useTranslation()
  const color = data.color || '#38bdf8'
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (data.exportThemeOverride ?? canvasTheme) === 'light'
  const updateLocation = useProjectStore((s) => s.updateLocation)
  const setSelection = useProjectStore((s) => s.setSelection)
  const locked = data.positionLocked === true
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minWidth: 40,
        minHeight: 40,
        border: `2px ${selected ? 'solid' : locked ? 'dotted' : 'dashed'} ${color}`,
        borderRadius: 8,
        background: locked ? `${color}06` : `${color}12`,
        position: 'relative',
        boxSizing: 'border-box',
        // v7.9.86 / #201 — pointer-events:none auf dem ganzen Body wenn
        // locked. Lock-Plate (siehe unten) hat eigenes pointer-events:all
        // damit es weiter klickbar bleibt.
        pointerEvents: locked ? 'none' : 'auto',
      }}
    >
      {!locked && (
        <NodeResizer
          isVisible={!!selected}
          minWidth={40}
          minHeight={40}
          color={color}
          lineStyle={{
            borderColor: color,
            borderWidth: 1,
            margin: -2,
            padding: 2,
          }}
          handleStyle={{ background: color, width: 10, height: 10 }}
        />
      )}
      {/* Name + Lock-Plate. Immer pointer-events:all damit es auch im
          locked-State klickbar bleibt. */}
      <div
        style={{
          position: 'absolute',
          top: -22,
          left: 12,
          padding: '0 12px',
          background: isLight ? '#dde4ee' : '#0f172a',
          color,
          fontSize: 24,
          fontStyle: 'italic',
          fontWeight: 600,
          letterSpacing: 0.6,
          userSelect: 'none',
          pointerEvents: 'all',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          opacity: locked ? 0.7 : 1,
        }}
        onClick={(e) => {
          // Click auf Name = Location selecten damit Properties aufgehen.
          e.stopPropagation()
          setSelection(undefined, undefined, id)
        }}
        title={locked
          ? format(t('locationFrame.lockedTitle', '{name} (gesperrt — Klick auf Schloss zum Entsperren)'), { name: data.name })
          : data.name}
      >
        <button
          type="button"
          onClick={(e) => {
            // Lock-Toggle. stopPropagation damit der parent-onClick (select)
            // nicht zusätzlich feuert.
            e.stopPropagation()
            updateLocation(id, { positionLocked: !locked })
          }}
          title={locked ? t('locationFrame.unlock', 'Location entsperren') : t('locationFrame.lock', 'Location sperren (kein Verschieben/Resizen, aber Settings noch erreichbar)')}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color,
            display: 'inline-flex',
            alignItems: 'center',
            lineHeight: 1,
            fontSize: 24,
          }}
        >
          {locked ? (
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="7" width="10" height="7" rx="1" fill="currentColor" fillOpacity="0.25" />
              <path d="M5 7V4.5a3 3 0 0 1 6 0V7" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6">
              <rect x="3" y="7" width="10" height="7" rx="1" />
              <path d="M5 7V4.5a3 3 0 0 1 6 0V6" />
            </svg>
          )}
        </button>
        <span>{data.name}</span>
      </div>
    </div>
  )
})
LocationFrameNode.displayName = 'LocationFrameNode'
