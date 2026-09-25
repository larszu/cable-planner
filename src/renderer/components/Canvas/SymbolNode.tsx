import { memo } from 'react'
import { NodeResizer, type NodeProps } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import type { PlatziertesSymbol, SymbolDef } from '../../types/symbol'
import { svgDataUrl } from '../../lib/symbole/svg'

export type SymbolNodeData = PlatziertesSymbol & {
  def?: SymbolDef
  exportThemeOverride?: 'dark' | 'light'
}

/**
 * Ein Symbol auf dem Canvas. Kein Geraet: keine Ports, keine Handles.
 * Eingebaute Zeichen sind dunkel gezeichnet und werden im dunklen Thema
 * umgekehrt; importierte und erzeugte behalten ihre Farben — ein rotes
 * Brandschutzzeichen soll rot bleiben.
 */
export const SymbolNode = memo(({ data, selected }: NodeProps<SymbolNodeData>) => {
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (data.exportThemeOverride ?? canvasTheme) === 'light'
  const def = data.def
  const src = def?.svg ? svgDataUrl(def.svg) : def?.bild
  const umkehren = !isLight && def?.herkunft === 'eingebaut'
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <NodeResizer isVisible={!!selected && !data.gesperrt} keepAspectRatio minWidth={16} minHeight={16} />
      {src ? (
        <img
          src={src}
          alt={def?.name ?? ''}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: data.drehung ? `rotate(${data.drehung}deg)` : undefined,
            filter: umkehren ? 'invert(1)' : undefined,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="w-full h-full border border-dashed border-cp-danger" />
      )}
      {data.beschriftung && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-semibold"
          style={{ top: '100%', color: isLight ? '#0f172a' : '#e2e8f0' }}
        >
          {data.beschriftung}
        </div>
      )}
    </div>
  )
})
SymbolNode.displayName = 'SymbolNode'
