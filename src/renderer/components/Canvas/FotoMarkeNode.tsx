import { memo } from 'react'
import type { NodeProps } from 'reactflow'
import { Camera } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

export type FotoMarkeData = { fotoId: string; notiz?: string; datum: string }

/**
 * #1187 — die Stelle im Plan, an der ein Foto aufgenommen wurde. Ein Klick
 * oeffnet das Foto (`onNodeClick` in `CanvasArea`), Ziehen verschiebt die
 * Marke. Keine Ports, keine Handles: sie ist kein Geraet.
 */
export const FotoMarkeNode = memo(({ data, selected }: NodeProps<FotoMarkeData>) => {
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = canvasTheme === 'light'
  return (
    <div
      data-testid="foto-marke"
      title={[data.notiz, data.datum].filter(Boolean).join(' · ')}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50% 50% 50% 0',
        transform: 'rotate(-45deg)',
        background: '#f59e0b',
        border: `2px solid ${selected ? (isLight ? '#0f172a' : '#ffffff') : isLight ? '#ffffff' : '#0f172a'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <Camera size={14} color="#0f172a" style={{ transform: 'rotate(45deg)' }} />
    </div>
  )
})
FotoMarkeNode.displayName = 'FotoMarkeNode'
