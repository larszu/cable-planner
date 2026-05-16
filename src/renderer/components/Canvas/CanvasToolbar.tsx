import { useEffect, useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { LENGTH_COLOR_RULES } from '../../lib/cableColors'
import { RoutingToggle } from '../shared/RoutingToggle'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'

export const CanvasToolbar = () => {
  // v7.9.5 — Toolbar frei verschiebbar (User-Request: "Mache die
  // toolbar im canvas frei verschiebbar"). useDraggablePosition liefert
  // den persistierten Offset relativ zur Default-Position top:8 left:8.
  const drag = useDraggablePosition('cable-planner:canvas-toolbar-pos', true)
  // v7.9.0 / Issue #120 — open RackBuilder seeded with current selection
  const triggerRackBuilderFromSelection = useUiStore((s) => s.triggerRackBuilderFromSelection)
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const setSnapToGrid = useUiStore((state) => state.setSnapToGrid)
  const gridSize = useUiStore((state) => state.gridSize)
  const setGridSize = useUiStore((state) => state.setGridSize)
  const defaultRouting = useUiStore((state) => state.defaultRouting)
  const setDefaultRouting = useUiStore((state) => state.setDefaultRouting)
  const defaultArrow = useUiStore((state) => state.defaultArrow)
  const setDefaultArrow = useUiStore((state) => state.setDefaultArrow)
  // v7.9.5 — globaler Kabelbrücken-Toggle in der Toolbar
  const cableBumps = useUiStore((state) => state.cableBumps)
  const setCableBumps = useUiStore((state) => state.setCableBumps)
  const cableColorMode = useUiStore((state) => state.cableColorMode)
  const setCableColorMode = useUiStore((state) => state.setCableColorMode)
  const canvasTheme = useUiStore((state) => state.canvasTheme)
  const colorPortsByType = useUiStore((state) => state.colorPortsByType)
  const setColorPortsByType = useUiStore((state) => state.setColorPortsByType)
  const isLight = canvasTheme === 'light'
  const [showLengthLegend, setShowLengthLegend] = useState(false)
  const addLocation = useProjectStore((state) => state.addLocation)
  const addLocationAroundEquipment = useProjectStore(
    (state) => state.addLocationAroundEquipment,
  )
  const saveGroupPreset = useProjectStore((state) => state.saveGroupPreset)
  const canvasState = useProjectStore((state) => state.project.canvasState)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const equipmentList = useProjectStore((state) => state.project.equipment)
  // v7.9.3 — Plan-Lock-Status: 'editing' | 'finalized' | 'viewer'.
  // Toolbar-Button toggelt editing↔finalized; viewer-Modus wird nur
  // durch .cpviewer-Import gesetzt und kann nicht zurück.
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const setProjectMode = useProjectStore((s) => s.setProjectMode)
  const annotationsPanelOpen = useUiStore((s) => s.annotationsPanelOpen)
  const setAnnotationsPanelOpen = useUiStore((s) => s.setAnnotationsPanelOpen)
  const annotationsCount = useProjectStore((s) => s.project.annotations?.length ?? 0)
  const { getNodes, setNodes } = useReactFlow()
  const [namingGroup, setNamingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  // Issue #59: the toolbar's group-name input sometimes ignored keystrokes
  // until app restart. autoFocus alone is unreliable when another component
  // (e.g. ReactFlow's pane after a click) steals focus on the same tick.
  // Hold a ref and re-focus explicitly each time the form opens.
  const groupNameRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (namingGroup) {
      // Defer one frame so the input is in the DOM before .focus() runs.
      const id = requestAnimationFrame(() => groupNameRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [namingGroup])

  /**
   * Align the currently selected equipment nodes along the requested axis.
   * The bounding box of the selection is the reference frame; positions are
   * persisted via the project store so cables follow automatically.
   */
  /** v7.6.0 — Milanote/Figma-style alignment. Earlier versions
   *  fell back to `width ?? 0` / `height ?? 0` when a device hadn't
   *  been resized, which collapsed the bounding box and snapped
   *  every device into the same point. The fixed version uses the
   *  same visual defaults the equipment-node renderer uses (220 px
   *  wide; height derived from port count). Center alignments use
   *  device CENTERS as the reference, not corners. */
  const measuredSize = (item: { width?: number; height?: number; inputs?: ReadonlyArray<unknown>; outputs?: ReadonlyArray<unknown>; ipAddress?: string }) => {
    const w = item.width && item.width > 0 ? item.width : 220
    if (item.height && item.height > 0) return { w, h: item.height }
    // Match EquipmentNode's intrinsic layout: header + N port rows + padding.
    const HEADER = item.ipAddress ? 62 : 48
    const ROW = 22
    const PADDING = 8
    const inLen = item.inputs?.length ?? 0
    const outLen = item.outputs?.length ?? 0
    const portRows = Math.max(inLen, outLen, 1)
    return { w, h: HEADER + portRows * ROW + PADDING }
  }
  const alignSelected = (
    mode: 'left' | 'right' | 'center-h' | 'top' | 'bottom' | 'center-v',
  ) => {
    const ids = getNodes()
      .filter((n) => n.selected && n.type === 'equipment')
      .map((n) => n.id)
    if (ids.length < 2) return
    const items = equipmentList.filter((e) => ids.includes(e.id))
    if (items.length < 2) return
    // Use the actual rendered sizes so the bounding box is real
    // (a 220x80 default node won't collapse to a single point).
    const sized = items.map((item) => ({ item, ...measuredSize(item) }))
    const minX = Math.min(...sized.map((s) => s.item.x))
    const maxRight = Math.max(...sized.map((s) => s.item.x + s.w))
    const minY = Math.min(...sized.map((s) => s.item.y))
    const maxBottom = Math.max(...sized.map((s) => s.item.y + s.h))
    const centerX = (minX + maxRight) / 2
    const centerY = (minY + maxBottom) / 2
    // v7.9.0 / Issue #119 — Two-stage update: first write the new
    // positions to the project store (autosave + undo/redo), then
    // immediately patch React Flow's local rfNodes state so the
    // canvas re-renders with the new positions. Without the
    // setNodes() the canvas would keep showing OLD positions because
    // CanvasArea's structural-sync useEffect deliberately preserves
    // existing rfNode positions across data updates to avoid drag-
    // jumps — alignment is a deliberate position change and needs to
    // bypass that.
    const newPositionById = new Map<string, { x: number; y: number }>()
    for (const { item, w, h } of sized) {
      let nx = item.x
      let ny = item.y
      switch (mode) {
        case 'left':     nx = minX;             break
        case 'right':    nx = maxRight - w;     break
        // Milanote-style: each item's CENTER lands on the selection-bbox center.
        case 'center-h': nx = centerX - w / 2;  break
        case 'top':      ny = minY;             break
        case 'bottom':   ny = maxBottom - h;    break
        case 'center-v': ny = centerY - h / 2;  break
      }
      if (nx !== item.x || ny !== item.y) {
        updateEquipment(item.id, { x: nx, y: ny })
        newPositionById.set(item.id, { x: nx, y: ny })
      }
    }
    if (newPositionById.size > 0) {
      setNodes((rf) =>
        rf.map((n) => {
          const pos = newPositionById.get(n.id)
          return pos ? { ...n, position: pos } : n
        }),
      )
    }
  }

  const sectionLabelStyle: React.CSSProperties = {
    color: isLight ? '#475569' : '#94a3b8',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontSize: 9,
    paddingRight: 2,
  }
  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: 18,
    background: isLight ? '#e2e8f0' : '#1f2937',
    margin: '0 2px',
  }
  return (
    <div
      ref={drag.containerRef}
      className="nodrag nopan"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        maxWidth: 'min(880px, calc(100vw - 420px))',
        padding: '5px 8px',
        background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.92)',
        border: `1px solid ${isLight ? '#cbd5e1' : '#1f2937'}`,
        borderRadius: 10,
        boxShadow: isLight
          ? '0 8px 24px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)'
          : '0 8px 24px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.30)',
        fontSize: 11,
        ...drag.containerStyle,
        color: isLight ? '#1e293b' : '#e2e8f0',
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* v7.9.5 — Drag-Grip am Anfang. PointerDown auf diesem Span
          startet das Verschieben der Toolbar; alle anderen Buttons
          und Inputs bleiben normal klickbar (useDraggablePosition's
          headerProps ignoriert target.closest('button,input,...')). */}
      <span
        {...drag.headerProps}
        title="Toolbar verschieben"
        aria-label="Toolbar verschieben"
        style={{
          ...drag.headerProps.style,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 2px',
          color: isLight ? '#94a3b8' : '#64748b',
          userSelect: 'none',
        }}
      >
        <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.1" />
          <circle cx="6" cy="2" r="1.1" />
          <circle cx="2" cy="7" r="1.1" />
          <circle cx="6" cy="7" r="1.1" />
          <circle cx="2" cy="12" r="1.1" />
          <circle cx="6" cy="12" r="1.1" />
        </svg>
      </span>
      <span style={sectionLabelStyle}>Canvas</span>
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
          background: isLight ? '#ffffff' : '#0f172a',
          border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
          color: isLight ? '#1e293b' : '#e2e8f0',
          padding: '1px 4px',
          borderRadius: 3,
        }}
        title="Rastergröße in Pixeln"
      />
      <span style={dividerStyle} />
      <span style={sectionLabelStyle}>Routing</span>
      <RoutingToggle
        value={defaultRouting}
        onChange={setDefaultRouting}
        variant="toolbar"
        isLight={isLight}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 4 }}>
        <input
          type="checkbox"
          checked={defaultArrow}
          onChange={(event) => setDefaultArrow(event.target.checked)}
        />
        Pfeil
      </label>
      {/* v7.9.5 — Globaler Kabelbrücken-Toggle (User-Request:
          "In der toolbar soll man global kabelbrücken an und aus
          machen können"). Pro-Kabel-Override geschieht weiter im
          Kabel-Rechtsklick. */}
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 4 }}
        title="Kabelbrücken bei Kreuzungen global an/aus. Pro Kabel überschreibbar via Rechtsklick."
      >
        <input
          type="checkbox"
          checked={cableBumps}
          onChange={(event) => setCableBumps(event.target.checked)}
        />
        Brücken
      </label>
      <label
        style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginLeft: 4 }}
        title="Port-Punkte in der Farbe des Steckertyps darstellen (SDI=amber, HDMI=violett, Ethernet=grün …) statt nach Input/Output"
      >
        <input
          type="checkbox"
          checked={colorPortsByType}
          onChange={(event) => setColorPortsByType(event.target.checked)}
        />
        Ports nach Typ
      </label>
      <span style={dividerStyle} />
      {/* Cable color mode toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ ...sectionLabelStyle, marginRight: 2 }}>Kabel</span>
        <button
          type="button"
          onClick={() => setCableColorMode('manual')}
          title="Kabelfarbe: manuell (wie im Kabel-Dialog gesetzt)"
          style={{
            padding: '2px 6px',
            background: cableColorMode === 'manual' ? '#0369a1' : (isLight ? '#e2e8f0' : '#1e293b'),
            border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
            color: isLight ? '#1e293b' : '#e2e8f0',
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
            background: cableColorMode === 'byLength' ? '#0369a1' : (isLight ? '#e2e8f0' : '#1e293b'),
            border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
            color: isLight ? '#1e293b' : '#e2e8f0',
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
              background: isLight ? '#e2e8f0' : '#1e293b',
              border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
              color: isLight ? '#64748b' : '#94a3b8',
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
            background: isLight ? 'rgba(241,245,249,0.98)' : 'rgba(15,23,42,0.97)',
            border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
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
                  border: `1px solid ${isLight ? '#94a3b8' : '#475569'}`,
                  ...(r.dashArray ? { backgroundImage: `repeating-linear-gradient(90deg,${r.color} 0 6px,transparent 6px 10px)`, backgroundColor: 'transparent' } : {}),
                }}
              />
              <span style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{r.label}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowLengthLegend(false)}
            style={{ marginTop: 6, fontSize: 10, color: isLight ? '#475569' : '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Schließen
          </button>
        </div>
      )}
      {/* v7.9.5 — Dark/Light-Toggle aus der Toolbar entfernt
          (User-Request: "Dark/Light mode muss nicht in toolbar sein").
          Weiterhin verfügbar via Settings → Darstellung. */}
      <span style={dividerStyle} />
      {/* v7.9.3 — Planungs-Lock-Toggle (User-Request: "Planung
          abgeschlossen"-Button). 'editing'→'finalized' macht das
          Canvas read-only. Viewer-Modus (entstanden durch Import
          einer .cpviewer-Datei) kann hier NICHT zurückgesetzt
          werden (Button wird disabled/anders gerendert). */}
      <button
        type="button"
        onClick={() => {
          if (projectMode === 'viewer') return
          if (projectMode === 'finalized') {
            const ok = window.confirm(
              'Planung wieder zur Bearbeitung freigeben?\n\n' +
                'Im Editing-Modus können Geräte und Kabel wieder verschoben, hinzugefügt und gelöscht werden.',
            )
            if (ok) setProjectMode('editing')
          } else {
            const ok = window.confirm(
              'Planung abschließen?\n\n' +
                'Das Canvas wird gesperrt — keine Verschiebungen, neue Verbindungen ' +
                'oder Löschungen möglich. Du kannst die Sperre jederzeit wieder aufheben.',
            )
            if (ok) setProjectMode('finalized')
          }
        }}
        disabled={projectMode === 'viewer'}
        title={
          projectMode === 'viewer'
            ? 'Viewer-Modus — die Datei wurde aus einer .cpviewer-Datei geladen und ist permanent read-only.'
            : projectMode === 'finalized'
              ? 'Planung ist abgeschlossen (read-only). Klicken um wieder zu bearbeiten.'
              : 'Planung als abgeschlossen markieren (Canvas read-only schalten).'
        }
        style={{
          padding: '2px 8px',
          background:
            projectMode === 'viewer'
              ? '#1e293b'
              : projectMode === 'finalized'
                ? '#0e7490'
                : (isLight ? '#e2e8f0' : '#1e293b'),
          border:
            '1px solid ' +
            (projectMode === 'viewer'
              ? '#475569'
              : projectMode === 'finalized'
                ? '#06b6d4'
                : (isLight ? '#cbd5e1' : '#334155')),
          color:
            projectMode === 'viewer'
              ? '#94a3b8'
              : projectMode === 'finalized'
                ? '#e0f2fe'
                : (isLight ? '#475569' : '#cbd5e1'),
          borderRadius: 3,
          cursor: projectMode === 'viewer' ? 'not-allowed' : 'pointer',
          fontSize: 11,
        }}
      >
        {projectMode === 'viewer' && '👁 Viewer'}
        {projectMode === 'finalized' && '🔒 Plan abgeschlossen'}
        {projectMode === 'editing' && '🔓 Plan abschließen'}
      </button>
      {/* v7.9.3 — Annotations-Panel-Toggle. Im Viewer-Modus prominent
          dargestellt, im Editor-Modus dezent (für Plan-Eigentümer der
          Reviewer-Kommentare durchgehen will). */}
      <button
        type="button"
        onClick={() => setAnnotationsPanelOpen(!annotationsPanelOpen)}
        title={
          projectMode === 'viewer'
            ? 'Anmerkungen — als Reviewer Notizen hinterlassen'
            : 'Anmerkungen anzeigen'
        }
        style={{
          padding: '2px 8px',
          background: annotationsPanelOpen
            ? '#0e7490'
            : projectMode === 'viewer'
              ? '#7c3aed'
              : (isLight ? '#e2e8f0' : '#1e293b'),
          border:
            '1px solid ' +
            (annotationsPanelOpen
              ? '#06b6d4'
              : projectMode === 'viewer'
                ? '#a78bfa'
                : (isLight ? '#cbd5e1' : '#334155')),
          color:
            annotationsPanelOpen
              ? '#e0f2fe'
              : projectMode === 'viewer'
                ? '#e2e8f0'
                : (isLight ? '#475569' : '#cbd5e1'),
          borderRadius: 3,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        💬 Anmerkungen{annotationsCount > 0 ? ` (${annotationsCount})` : ''}
      </button>
      <span style={dividerStyle} />
      <span style={sectionLabelStyle}>Layout</span>
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
        // v7.9.2 — Schwelle von >=2 auf >=1 gesenkt, damit Gruppe und
        // "Als Rack speichern" gleichzeitig sichtbar sind sobald min.
        // 1 Gerät selektiert ist. Vorher war "Gruppe speichern"
        // unsichtbar bei 1-Geräte-Auswahl, der User dachte die Funktion
        // sei weg ("die funktion ist leider weg").
        if (selectedEquipmentIds.length < 1) return null
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
                ref={groupNameRef}
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                // ReactFlow's pane swallows pointer events on its children
                // unless we stop propagation here. Without this the click
                // that focuses the input also bubbles to the pane, which
                // can immediately re-focus itself and steal the caret
                // (issue #59: "manchmal lässt sich kein text eingeben").
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="Gruppenname…"
                style={{
                  width: 140,
                  background: isLight ? '#ffffff' : '#0f172a',
                  border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
                  color: isLight ? '#1e293b' : '#e2e8f0',
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
                  background: isLight ? '#e2e8f0' : '#1e293b',
                  border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
                  color: isLight ? '#475569' : '#94a3b8',
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
      {/* v7.9.0 / Issue #120 — "Als Rack speichern" neben "Gruppe speichern" */}
      {(() => {
        const selectedEquipmentIds = getNodes()
          .filter((n) => n.selected && n.type === 'equipment')
          .map((n) => n.id)
        if (selectedEquipmentIds.length < 1) return null
        return (
          <button
            type="button"
            onClick={() => triggerRackBuilderFromSelection(selectedEquipmentIds)}
            title={`${selectedEquipmentIds.length} ${selectedEquipmentIds.length === 1 ? 'Gerät' : 'Geräte'} im 2D-Rack-Builder anlegen (Rack-Layout + interne Verkabelung)`}
            style={{
              padding: '2px 8px',
              background: '#7c3aed',
              border: '1px solid #a78bfa',
              color: '#e2e8f0',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            ▤ Als Rack speichern ({selectedEquipmentIds.length})
          </button>
        )
      })()}
      {(() => {
        const selectedCount = getNodes().filter(
          (n) => n.selected && n.type === 'equipment',
        ).length
        // v7.9.0 / Issue #119 — Toolbar erscheint jetzt ab 1+ selektiertem
        // Gerät; Ausrichtungs-Buttons sind aber bei nur 1 Gerät disabled
        // (mit Hinweis-Title), da Alignment zwischen mehreren stattfindet.
        if (selectedCount < 1) return null
        const enabled = selectedCount >= 2
        const btnStyle = {
          padding: '2px 6px',
          background: isLight ? '#e2e8f0' : '#1e293b',
          border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
          color: isLight ? '#1e293b' : '#e2e8f0',
          borderRadius: 3,
          cursor: enabled ? 'pointer' : 'not-allowed',
          opacity: enabled ? 1 : 0.4,
          fontSize: 13,
          lineHeight: 1,
        } as const
        const tip = (base: string): string =>
          enabled ? base : `${base} — mindestens 2 Geräte auswählen`
        return (
          <>
            <span style={dividerStyle} />
            <span style={sectionLabelStyle}>Ausrichten</span>
            <button type="button" disabled={!enabled} title={tip('Linksbündig (gleiche linke Kante)')} onClick={() => alignSelected('left')} style={btnStyle}>⇤</button>
            <button type="button" disabled={!enabled} title={tip('Horizontal zentrieren (gleiche X-Mitte)')} onClick={() => alignSelected('center-h')} style={btnStyle}>↔</button>
            <button type="button" disabled={!enabled} title={tip('Rechtsbündig (gleiche rechte Kante)')} onClick={() => alignSelected('right')} style={btnStyle}>⇥</button>
            <button type="button" disabled={!enabled} title={tip('Oben ausrichten (gleiche obere Kante)')} onClick={() => alignSelected('top')} style={btnStyle}>⤒</button>
            <button type="button" disabled={!enabled} title={tip('Vertikal zentrieren (gleiche Y-Mitte)')} onClick={() => alignSelected('center-v')} style={btnStyle}>↕</button>
            <button type="button" disabled={!enabled} title={tip('Unten ausrichten (gleiche untere Kante)')} onClick={() => alignSelected('bottom')} style={btnStyle}>⤓</button>
          </>
        )
      })()}
    </div>
  )
}
