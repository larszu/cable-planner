import { useEffect, useRef, useState } from 'react'
import { useOnSelectionChange, useReactFlow } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { LENGTH_COLOR_RULES } from '../../lib/cableColors'
import { RoutingToggle } from '../shared/RoutingToggle'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'

type CanvasToolbarMode = 'main' | 'rack'

export const CanvasToolbar = ({ mode = 'main' }: { mode?: CanvasToolbarMode } = {}) => {
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
  const annotationsVisible = useUiStore((s) => s.annotationsVisible)
  const setAnnotationsVisible = useUiStore((s) => s.setAnnotationsVisible)
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

  // v7.9.5 — Unified design tokens für die Toolbar.
  const T = {
    iconBtnSize: 28,
    bg: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(15,23,42,0.92)',
    border: isLight ? '#cbd5e1' : '#1f2937',
    text: isLight ? '#1e293b' : '#e2e8f0',
    textMuted: isLight ? '#64748b' : '#94a3b8',
    btnBg: 'transparent',
    btnBgHover: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(148,163,184,0.12)',
    btnActiveBg: '#0284c7',
    btnActiveText: '#ffffff',
    dividerColor: isLight ? '#e2e8f0' : '#1f2937',
  }
  const dividerStyle: React.CSSProperties = {
    width: 1,
    height: 22,
    background: T.dividerColor,
    margin: '0 4px',
    alignSelf: 'center',
  }

  // v7.9.5 — Compact icon button: 28×28, transparent default, hover-bg,
  // active-state in sky-blue. Disabled = 40% opacity, not-allowed cursor.
  const IconButton = ({
    title,
    onClick,
    active,
    disabled,
    children,
    color,
  }: {
    title: string
    onClick?: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    color?: string
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: T.iconBtnSize,
        height: T.iconBtnSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        background: active ? T.btnActiveBg : T.btnBg,
        color: active ? T.btnActiveText : (color ?? T.text),
        border: '1px solid transparent',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active)
          (e.currentTarget as HTMLButtonElement).style.background = T.btnBgHover
      }}
      onMouseLeave={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = T.btnBg
      }}
    >
      {children}
    </button>
  )

  // v7.9.19 — Reaktive Selection-Anzeige. getNodes() von useReactFlow
  // ist nur ein Lookup auf den aktuellen ReactFlow-Store; ohne
  // useOnSelectionChange würde die Toolbar nicht zwingend re-rendern
  // wenn der User Geräte selektiert / deselektiert. Mit dem Listener
  // erzwingen wir Re-Render bei jeder Selection-Änderung — daher
  // erscheinen/verschwinden die selection-dependent Buttons sofort.
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([])
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      setSelectedEquipmentIds(
        nodes.filter((n) => n.type === 'equipment').map((n) => n.id),
      )
    },
  })
  // Initiale Hydration (z.B. nach Project-Load mit erhaltener
  // Selection) — getNodes() ist live; einmal beim Mount lesen.
  useEffect(() => {
    setSelectedEquipmentIds(
      getNodes()
        .filter((n) => n.selected && n.type === 'equipment')
        .map((n) => n.id),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const hasSelection = selectedEquipmentIds.length >= 1
  const alignEnabled = selectedEquipmentIds.length >= 2

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
        gap: 2,
        maxWidth: 'min(880px, calc(100vw - 420px))',
        padding: '4px 6px',
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: isLight
          ? '0 8px 24px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)'
          : '0 8px 24px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.30)',
        fontSize: 11,
        ...drag.containerStyle,
        color: T.text,
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* ── Drag-Grip (verschiebt die Toolbar) ─────────────────────── */}
      <span
        {...drag.headerProps}
        title="Toolbar verschieben"
        aria-label="Toolbar verschieben"
        style={{
          ...drag.headerProps.style,
          display: 'inline-flex',
          alignItems: 'center',
          padding: '0 4px',
          height: T.iconBtnSize,
          color: T.textMuted,
          userSelect: 'none',
          borderRadius: 4,
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

      <span style={dividerStyle} />

      {/* ── Gruppe 1: Snap-to-Grid + Grid-Size ─────────────────────── */}
      <IconButton
        title={`Geräte beim Verschieben am Raster (${gridSize}px) einrasten`}
        onClick={() => setSnapToGrid(!snapToGrid)}
        active={snapToGrid}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="2" width="12" height="12" rx="0.5" />
          <line x1="6" y1="2" x2="6" y2="14" />
          <line x1="10" y1="2" x2="10" y2="14" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <line x1="2" y1="10" x2="14" y2="10" />
        </svg>
      </IconButton>
      <input
        type="number"
        min={2}
        max={100}
        value={gridSize}
        onChange={(event) => setGridSize(Number(event.target.value))}
        style={{
          width: 40,
          height: T.iconBtnSize - 4,
          background: isLight ? '#ffffff' : '#0f172a',
          border: `1px solid ${T.border}`,
          color: T.text,
          padding: '0 4px',
          borderRadius: 4,
          fontSize: 11,
        }}
        title="Rastergröße in Pixeln"
      />

      <span style={dividerStyle} />

      {/* ── Gruppe 2: Defaults-Dropdown ────────────────────────────── */}
      <DefaultsMenu
        T={T}
        defaultRouting={defaultRouting}
        setDefaultRouting={setDefaultRouting}
        defaultArrow={defaultArrow}
        setDefaultArrow={setDefaultArrow}
        cableBumps={cableBumps}
        setCableBumps={setCableBumps}
        colorPortsByType={colorPortsByType}
        setColorPortsByType={setColorPortsByType}
        cableColorMode={cableColorMode}
        setCableColorMode={setCableColorMode}
        showLengthLegend={showLengthLegend}
        setShowLengthLegend={setShowLengthLegend}
        isLight={isLight}
      />

      <span style={dividerStyle} />

      {/* ── Gruppe 3: Auswahl-Aktionen ───────────────────────────────
          v7.9.12 — Im Rack-Mode ausgeblendet: Location-Frames, Group-
          Save, Sub-Rack-Build sind alle Project-Level Operations, im
          Rack-Sub-Canvas nicht sinnvoll.
          v7.9.19 — Group- und Rack-Aktionen sind selection-dependent
          und werden NUR angezeigt wenn mindestens ein Gerät selektiert
          ist. Vorher waren sie permanent (disabled) sichtbar, was die
          Toolbar visuell unruhig hielt. Frame bleibt always-on weil er
          auch ohne Auswahl ein leeres Rahmen-Rechteck erstellt. */}
      {mode === 'main' && (
        <>
          <IconButton
            title={
              hasSelection
                ? `Rahmen um die ${selectedEquipmentIds.length} markierten Geräte`
                : 'Neuen Location-Rahmen einfügen'
            }
            onClick={() => {
              if (hasSelection) {
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
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2" y="3" width="12" height="10" rx="0.5" strokeDasharray="2 1.5" />
            </svg>
          </IconButton>
          {hasSelection && (
            <IconButton
              title={`${selectedEquipmentIds.length} markierte Geräte als Gruppe speichern`}
              onClick={() => setNamingGroup(true)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2" y="2" width="6" height="5" rx="0.5" />
                <rect x="8" y="2" width="6" height="5" rx="0.5" />
                <rect x="5" y="9" width="6" height="5" rx="0.5" />
              </svg>
            </IconButton>
          )}
          {hasSelection && (
            <IconButton
              title={`${selectedEquipmentIds.length} markierte Geräte im 2D-Rack-Builder anordnen`}
              onClick={() => triggerRackBuilderFromSelection(selectedEquipmentIds)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="2" width="10" height="12" rx="0.5" />
                <line x1="3" y1="5" x2="13" y2="5" />
                <line x1="3" y1="8" x2="13" y2="8" />
                <line x1="3" y1="11" x2="13" y2="11" />
              </svg>
            </IconButton>
          )}
        </>
      )}

      {namingGroup && hasSelection && (
        <form
          style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 4 }}
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            placeholder="Gruppenname…"
            style={{
              width: 140,
              height: T.iconBtnSize - 4,
              background: isLight ? '#ffffff' : '#0f172a',
              border: `1px solid ${T.border}`,
              color: T.text,
              padding: '0 6px',
              borderRadius: 4,
              fontSize: 11,
            }}
          />
          <button
            type="submit"
            title="Gruppe speichern"
            style={{
              width: T.iconBtnSize,
              height: T.iconBtnSize,
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✓
          </button>
          <IconButton title="Abbrechen" onClick={() => setNamingGroup(false)}>
            <span style={{ fontSize: 11 }}>✕</span>
          </IconButton>
        </form>
      )}

      {/* ── Gruppe 4: Ausrichten ─────────────────────────────────────
          v7.9.19 — Komplette Align-Gruppe (Divider + 6 Buttons) wird
          nur gerendert wenn mind. 2 Geräte ausgewählt sind. Vorher
          waren alle 6 Buttons disabled aber sichtbar — visueller Lärm
          für Use-Cases ohne Multi-Selection. */}
      {alignEnabled && (
        <>
          <span style={dividerStyle} />
          <IconButton
            title="Linksbündig"
            onClick={() => alignSelected('left')}
          >
            <span style={{ fontSize: 14 }}>⇤</span>
          </IconButton>
          <IconButton
            title="Horizontal zentrieren"
            onClick={() => alignSelected('center-h')}
          >
            <span style={{ fontSize: 14 }}>↔</span>
          </IconButton>
          <IconButton
            title="Rechtsbündig"
            onClick={() => alignSelected('right')}
          >
            <span style={{ fontSize: 14 }}>⇥</span>
          </IconButton>
          <IconButton
            title="Oben ausrichten"
            onClick={() => alignSelected('top')}
          >
            <span style={{ fontSize: 14 }}>⤒</span>
          </IconButton>
          <IconButton
            title="Vertikal zentrieren"
            onClick={() => alignSelected('center-v')}
          >
            <span style={{ fontSize: 14 }}>↕</span>
          </IconButton>
          <IconButton
            title="Unten ausrichten"
            onClick={() => alignSelected('bottom')}
          >
            <span style={{ fontSize: 14 }}>⤓</span>
          </IconButton>
        </>
      )}

      {/* ── Status-Gruppe (rechts gepusht): Plan-Lock + Annotations ─
          v7.9.12 — Im Rack-Mode komplett ausgeblendet. Plan-Lock und
          Annotations sind Project-Level-Concerns, nicht Rack-intern. */}
      {mode === 'main' && <>
      <span style={{ ...dividerStyle, marginLeft: 'auto' }} />
      <button
        type="button"
        onClick={() => {
          if (projectMode === 'viewer') return
          if (projectMode === 'finalized') {
            const ok = window.confirm(
              'Planung wieder zur Bearbeitung freigeben?\n\n' +
                'Geräte, Kabel und Layout können dann wieder verändert werden.',
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
            ? 'Viewer-Datei — read-only'
            : projectMode === 'finalized'
              ? 'Planung ist abgeschlossen (Klick: Bearbeitung freigeben)'
              : 'Planung als abgeschlossen markieren'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: T.iconBtnSize,
          padding: '0 10px',
          background:
            projectMode === 'viewer'
              ? (isLight ? '#e2e8f0' : '#1e293b')
              : projectMode === 'finalized'
                ? '#0e7490'
                : T.btnBg,
          color:
            projectMode === 'viewer'
              ? T.textMuted
              : projectMode === 'finalized'
                ? '#e0f2fe'
                : T.text,
          border: `1px solid ${projectMode === 'finalized' ? '#06b6d4' : T.border}`,
          borderRadius: 6,
          cursor: projectMode === 'viewer' ? 'not-allowed' : 'pointer',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="7" width="10" height="7" rx="1" />
          <path d={projectMode === 'editing' ? 'M5 7V4.5a3 3 0 0 1 6 0V6' : 'M5 7V4.5a3 3 0 0 1 6 0V7'} />
        </svg>
        <span>
          {projectMode === 'viewer'
            ? 'Viewer'
            : projectMode === 'finalized'
              ? 'Abgeschlossen'
              : 'Abschließen'}
        </span>
      </button>
      {/* v7.9.8 — Sichtbarkeits-Toggle für Canvas-Annotations. Versteckt
          die farbigen Kreis-Badges OHNE die Annotations zu löschen. */}
      <button
        type="button"
        onClick={() => setAnnotationsVisible(!annotationsVisible)}
        title={
          annotationsVisible
            ? 'Anmerkungen-Badges auf dem Canvas ausblenden (Daten bleiben erhalten)'
            : 'Anmerkungen-Badges auf dem Canvas wieder einblenden'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: T.iconBtnSize,
          height: T.iconBtnSize,
          background: annotationsVisible ? T.btnBg : T.btnActiveBg,
          color: annotationsVisible ? T.text : '#ffffff',
          border: `1px solid ${annotationsVisible ? T.border : T.btnActiveBg}`,
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        {annotationsVisible ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1.5 8c1.5-3 4-5 6.5-5s5 2 6.5 5c-1.5 3-4 5-6.5 5s-5-2-6.5-5z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 2l12 12" />
            <path d="M3 5.5c1.4-1.6 3-2.5 5-2.5s3.6.9 5 2.5M1.5 8c1-2 2.5-3.5 4.5-4.3M14.5 8c-1.5 3-4 5-6.5 5-.7 0-1.4-.15-2-.4" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => setAnnotationsPanelOpen(!annotationsPanelOpen)}
        title={
          projectMode === 'viewer'
            ? 'Anmerkungen — als Reviewer Notizen hinterlassen'
            : 'Anmerkungen anzeigen / verwalten'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: T.iconBtnSize,
          padding: '0 10px',
          background: annotationsPanelOpen
            ? T.btnActiveBg
            : projectMode === 'viewer'
              ? '#7c3aed'
              : T.btnBg,
          color: annotationsPanelOpen || projectMode === 'viewer' ? '#ffffff' : T.text,
          border: `1px solid ${
            annotationsPanelOpen
              ? T.btnActiveBg
              : projectMode === 'viewer'
                ? '#a78bfa'
                : T.border
          }`,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6.5L4 13.5V11H3a1 1 0 0 1-1-1V4z" />
        </svg>
        <span>Anmerkungen{annotationsCount > 0 ? ` (${annotationsCount})` : ''}</span>
      </button>
      </>}

      {/* Length-Color-Legend Popover (bei Bedarf gerendert) */}
      {showLengthLegend && cableColorMode === 'byLength' && (
        <div
          style={{
            position: 'absolute',
            top: 42,
            left: 0,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 20,
            minWidth: 200,
            boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 11, color: T.text }}>
            Längenfarben
          </div>
          {LENGTH_COLOR_RULES.map((r) => (
            <div
              key={r.length}
              style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 11 }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 28,
                  height: 3,
                  background: r.color,
                  borderRadius: 2,
                  border: `1px solid ${isLight ? '#94a3b8' : '#475569'}`,
                  ...(r.dashArray
                    ? { backgroundImage: `repeating-linear-gradient(90deg,${r.color} 0 6px,transparent 6px 10px)`, backgroundColor: 'transparent' }
                    : {}),
                }}
              />
              <span style={{ color: T.textMuted }}>{r.label}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setShowLengthLegend(false)}
            style={{
              marginTop: 8,
              fontSize: 10,
              color: T.textMuted,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Schließen
          </button>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// v7.9.5 — Defaults-Dropdown: alle "Standard-Verhalten"-Toggles
// (Routing, Pfeil, Brücken, Ports nach Typ, Kabelfarbe) gebündelt in
// EINEM Menü statt 5 inline-Checkboxen. Click → Panel auf, Klick
// außerhalb schließt.
// ────────────────────────────────────────────────────────────────────
const DefaultsMenu = ({
  T,
  defaultRouting,
  setDefaultRouting,
  defaultArrow,
  setDefaultArrow,
  cableBumps,
  setCableBumps,
  colorPortsByType,
  setColorPortsByType,
  cableColorMode,
  setCableColorMode,
  showLengthLegend,
  setShowLengthLegend,
  isLight,
}: {
  T: {
    iconBtnSize: number
    bg: string
    border: string
    text: string
    textMuted: string
    btnBg: string
    btnBgHover: string
    btnActiveBg: string
    btnActiveText: string
    dividerColor: string
  }
  defaultRouting: 'orthogonal' | 'straight' | 'curved'
  setDefaultRouting: (v: 'orthogonal' | 'straight' | 'curved') => void
  defaultArrow: boolean
  setDefaultArrow: (v: boolean) => void
  cableBumps: boolean
  setCableBumps: (v: boolean) => void
  colorPortsByType: boolean
  setColorPortsByType: (v: boolean) => void
  cableColorMode: 'manual' | 'byLength'
  setCableColorMode: (v: 'manual' | 'byLength') => void
  showLengthLegend: boolean
  setShowLengthLegend: (v: boolean) => void
  isLight: boolean
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const anyNonDefault =
    defaultRouting !== 'orthogonal' ||
    defaultArrow ||
    cableBumps ||
    colorPortsByType ||
    cableColorMode !== 'manual'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Standard-Verhalten für neue Kabel + Darstellung"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: T.iconBtnSize,
          padding: '0 8px',
          background: open ? T.btnActiveBg : T.btnBg,
          color: open ? T.btnActiveText : T.text,
          border: '1px solid transparent',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
        </svg>
        <span>Defaults</span>
        {anyNonDefault && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f59e0b',
              marginLeft: 1,
            }}
            title="Mindestens ein Default wurde verändert"
          />
        )}
        <span style={{ fontSize: 9 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 260,
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            padding: 8,
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            fontSize: 11,
            color: T.text,
            zIndex: 30,
          }}
        >
          <div style={{ marginBottom: 6, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', fontSize: 9 }}>
            Kabel-Routing
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(
              [
                { value: 'orthogonal' as const, label: 'Ortho' },
                { value: 'straight' as const, label: 'Direkt' },
                { value: 'curved' as const, label: 'Kurve' },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDefaultRouting(opt.value)}
                style={{
                  flex: 1,
                  padding: 4,
                  background: defaultRouting === opt.value ? T.btnActiveBg : (isLight ? '#f1f5f9' : '#1e293b'),
                  color: defaultRouting === opt.value ? T.btnActiveText : T.text,
                  border: '1px solid transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 6, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', fontSize: 9 }}>
            Kabelfarbe
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setCableColorMode('manual')}
              style={{
                flex: 1,
                padding: 4,
                background: cableColorMode === 'manual' ? T.btnActiveBg : (isLight ? '#f1f5f9' : '#1e293b'),
                color: cableColorMode === 'manual' ? T.btnActiveText : T.text,
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Nach Typ
            </button>
            <button
              type="button"
              onClick={() => setCableColorMode('byLength')}
              style={{
                flex: 1,
                padding: 4,
                background: cableColorMode === 'byLength' ? T.btnActiveBg : (isLight ? '#f1f5f9' : '#1e293b'),
                color: cableColorMode === 'byLength' ? T.btnActiveText : T.text,
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              Nach Länge
            </button>
            {cableColorMode === 'byLength' && (
              <button
                type="button"
                onClick={() => setShowLengthLegend(!showLengthLegend)}
                title="Legende der Längenfarben"
                style={{
                  padding: '4px 6px',
                  background: isLight ? '#f1f5f9' : '#1e293b',
                  color: T.textMuted,
                  border: '1px solid transparent',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ?
              </button>
            )}
          </div>

          <div style={{ marginBottom: 6, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', fontSize: 9 }}>
            Sonstiges
          </div>
          {(
            [
              {
                label: 'Pfeil am Kabel-Ende',
                value: defaultArrow,
                set: setDefaultArrow,
                hint: 'Frisch gezogene Kabel bekommen einen Pfeil',
              },
              {
                label: 'Kabelbrücken bei Kreuzungen',
                value: cableBumps,
                set: setCableBumps,
                hint: 'Globaler Default — pro Kabel via Rechtsklick überschreibbar',
              },
              {
                label: 'Ports nach Connector-Typ einfärben',
                value: colorPortsByType,
                set: setColorPortsByType,
                hint: 'SDI = bernstein, HDMI = violett, Ethernet = grün, …',
              },
            ]
          ).map((opt) => (
            <label
              key={opt.label}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', cursor: 'pointer' }}
              title={opt.hint}
            >
              <input
                type="checkbox"
                checked={opt.value}
                onChange={(e) => opt.set(e.target.checked)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
