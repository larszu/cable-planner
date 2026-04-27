import { useState } from 'react'
import { useReactFlow } from 'reactflow'
import { useUiStore, type EdgeRouting } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { LENGTH_COLOR_RULES } from '../../lib/cableColors'

const routingOptions: { value: EdgeRouting; label: string; hint: string }[] = [
  { value: 'orthogonal', label: 'Ortho', hint: 'Rechtwinkliges Routing (draw.io Standard)' },
  { value: 'straight', label: 'Linie', hint: 'Gerade Linie' },
  { value: 'curved', label: 'Kurve', hint: 'Bézier-Kurve' },
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
  const cableColorMode = useUiStore((state) => state.cableColorMode)
  const setCableColorMode = useUiStore((state) => state.setCableColorMode)
  const [showLengthLegend, setShowLengthLegend] = useState(false)
  const addLocation = useProjectStore((state) => state.addLocation)
  const addLocationAroundEquipment = useProjectStore(
    (state) => state.addLocationAroundEquipment,
  )
  const saveGroupPreset = useProjectStore((state) => state.saveGroupPreset)
  const canvasState = useProjectStore((state) => state.project.canvasState)
  const { getNodes } = useReactFlow()
  const [namingGroup, setNamingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')

  return (
    <div
      className="nodrag nopan"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        maxWidth: 'min(860px, calc(100vw - 420px))',
        padding: 6,
        background: 'rgba(15,23,42,0.94)',
        border: '1px solid #334155',
        borderRadius: 8,
        boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
        fontSize: 11,
        color: '#e2e8f0',
        alignItems: 'center',
      }}
    >
      <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
        Canvas
      </span>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={snapToGrid}
          onChange={(event) => setSnapToGrid(event.target.checked)}
        />
        Einrasten
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
        title="Rastergröße in Pixeln"
      />
      <span style={{ width: 1, height: 18, background: '#334155', margin: '0 4px' }} />
      <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
        Routing
      </span>
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
        Pfeil
      </label>
      <span style={{ width: 1, height: 18, background: '#334155', margin: '0 4px' }} />
      {/* Cable color mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, fontSize: 10, marginRight: 2 }}>
          Kabel
        </span>
        <button
          type="button"
          onClick={() => setCableColorMode('manual')}
          title="Kabelfarbe: manuell (wie im Kabel-Dialog gesetzt)"
          style={{
            padding: '2px 6px',
            background: cableColorMode === 'manual' ? '#0369a1' : '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          Farbe: Typ
        </button>
        <button
          type="button"
          onClick={() => setCableColorMode('byLength')}
          title="Kabelfarbe: nach Standardlänge (1m=rot, 2m=gelb, 3m=grün …)"
          style={{
            padding: '2px 6px',
            background: cableColorMode === 'byLength' ? '#0369a1' : '#1e293b',
            border: '1px solid #334155',
            color: '#e2e8f0',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          Farbe: Länge
        </button>
        {cableColorMode === 'byLength' && (
          <button
            type="button"
            onClick={() => setShowLengthLegend((v) => !v)}
            title="Legende der Längenfarben anzeigen"
            style={{
              padding: '2px 5px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            ?
          </button>
        )}
      </div>
      {showLengthLegend && cableColorMode === 'byLength' && (
        <div
          style={{
            position: 'absolute',
            top: 36,
            left: 0,
            background: 'rgba(15,23,42,0.97)',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            zIndex: 20,
            minWidth: 180,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 11 }}>Längenfarben</div>
          {LENGTH_COLOR_RULES.map((r) => (
            <div
              key={r.length}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, fontSize: 11 }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 24,
                  height: 3,
                  background: r.color,
                  borderRadius: 2,
                  border: '1px solid #475569',
                  ...(r.dashArray ? { backgroundImage: `repeating-linear-gradient(90deg,${r.color} 0 6px,transparent 6px 10px)`, backgroundColor: 'transparent' } : {}),
                }}
              />
              <span style={{ color: '#cbd5e1' }}>{r.label}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowLengthLegend(false)}
            style={{ marginTop: 6, fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Schließen
          </button>
        </div>
      )}
      <span style={{ width: 1, height: 18, background: '#334155', margin: '0 4px' }} />
      <span style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
        Layout
      </span>
      <button
        type="button"
        onClick={() => {
          // If the user has multiple equipment nodes selected (Shift/Ctrl-click
          // or marquee), wrap them in a frame without moving them. Otherwise
          // drop a fresh frame in the viewport center.
          const selectedEquipmentIds = getNodes()
            .filter((n) => n.selected && n.type === 'equipment')
            .map((n) => n.id)
          if (selectedEquipmentIds.length > 0) {
            addLocationAroundEquipment(selectedEquipmentIds)
            return
          }
          const zoom = canvasState.zoom || 1
          const viewportCenterX = (-canvasState.x + 400) / zoom
          const viewportCenterY = (-canvasState.y + 250) / zoom
          addLocation({
            name: 'Neue Location',
            x: viewportCenterX - 180,
            y: viewportCenterY - 120,
            width: 360,
            height: 240,
          })
        }}
        style={{
          padding: '2px 8px',
          background: '#0369a1',
          border: '1px solid #0ea5e9',
          color: '#e2e8f0',
          borderRadius: 3,
          cursor: 'pointer',
        }}
        title="Neue Location: wenn Geräte markiert sind, Rahmen um die Auswahl; sonst leerer Rahmen in der Bildschirmmitte"
      >
        ▣ Rahmen
      </button>
      {(() => {
        const selectedEquipmentIds = getNodes()
          .filter((n) => n.selected && n.type === 'equipment')
          .map((n) => n.id)
        if (selectedEquipmentIds.length < 2) return null
        if (namingGroup) {
          return (
            <form
              style={{ display: 'flex', gap: 4, alignItems: 'center' }}
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = groupName.trim() || `Gruppe ${new Date().toLocaleTimeString()}`
                saveGroupPreset(trimmed, selectedEquipmentIds)
                setNamingGroup(false)
                setGroupName('')
              }}
            >
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Gruppenname…"
                style={{
                  width: 140,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  padding: '1px 6px',
                  borderRadius: 3,
                  fontSize: 11,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '2px 8px',
                  background: '#047857',
                  border: '1px solid #059669',
                  color: '#e2e8f0',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setNamingGroup(false)}
                style={{
                  padding: '2px 6px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </form>
          )
        }
        return (
          <button
            type="button"
            onClick={() => setNamingGroup(true)}
            title={`${selectedEquipmentIds.length} Geräte als Gruppe speichern (inkl. Kabel zwischen ihnen)`}
            style={{
              padding: '2px 8px',
              background: '#0e7490',
              border: '1px solid #06b6d4',
              color: '#e2e8f0',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            Gruppe speichern ({selectedEquipmentIds.length})
          </button>
        )
      })()}
    </div>
  )
}
