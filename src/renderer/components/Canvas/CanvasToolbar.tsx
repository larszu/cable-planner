import { useUiStore, type EdgeRouting } from '../../store/uiStore'

const routingOptions: { value: EdgeRouting; label: string; hint: string }[] = [
  { value: 'orthogonal', label: 'Ortho', hint: 'Right-angle routing (draw.io default)' },
  { value: 'straight', label: 'Line', hint: 'Straight line' },
  { value: 'curved', label: 'Curve', hint: 'Bezier curve' },
]

export const CanvasToolbar = () => {
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const setSnapToGrid = useUiStore((state) => state.setSnapToGrid)
  const gridSize = useUiStore((state) => state.gridSize)
  const setGridSize = useUiStore((state) => state.setGridSize)
  const defaultRouting = useUiStore((state) => state.defaultRouting)
  const setDefaultRouting = useUiStore((state) => state.setDefaultRouting)
  const defaultArrow = useUiStore((state) => state.defaultArrow)
  const setDefaultArrow = useUiStore((state) => state.setDefaultArrow)

  return (
    <div
      className="nodrag nopan"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'rgba(15,23,42,0.9)',
        border: '1px solid #334155',
        borderRadius: 6,
        fontSize: 11,
        color: '#e2e8f0',
        alignItems: 'center',
      }}
    >
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={snapToGrid}
          onChange={(event) => setSnapToGrid(event.target.checked)}
        />
        Snap
      </label>
      <input
        type="number"
        min={2}
        max={100}
        value={gridSize}
        onChange={(event) => setGridSize(Number(event.target.value))}
        style={{
          width: 50,
          background: '#0f172a',
          border: '1px solid #334155',
          color: '#e2e8f0',
          padding: '1px 4px',
          borderRadius: 3,
        }}
        title="Grid size in pixels"
      />
      <span style={{ width: 1, height: 18, background: '#334155', margin: '0 4px' }} />
      <span style={{ color: '#94a3b8' }}>Default:</span>
      {routingOptions.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setDefaultRouting(opt.value)}
          title={opt.hint}
          style={{
            padding: '2px 6px',
            background: defaultRouting === opt.value ? '#0369a1' : '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 4 }}>
        <input
          type="checkbox"
          checked={defaultArrow}
          onChange={(event) => setDefaultArrow(event.target.checked)}
        />
        Arrow
      </label>
    </div>
  )
}
