import { useEffect, useMemo, useRef, useState } from 'react'
import { useOnSelectionChange, useReactFlow } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { LENGTH_COLOR_RULES } from '../../lib/cableColors'
import { LayerVisibilityChips } from './LayerVisibilityChips'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { confirmDialog } from '../../lib/confirmDialog'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { computeAlignedPositions, type AlignMode, type AlignItem } from '../../lib/alignEquipment'
import { Check, X } from 'lucide-react'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { Tooltip } from '../shared/Tooltip'

type CanvasToolbarMode = 'main' | 'rack'

/** Shared design tokens for the toolbar; derived from the light/dark theme. */
type ToolbarTokens = {
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

// v7.9.5 — Compact icon button: 28×28, transparent default, hover-bg,
// active-state in sky-blue. Disabled = 40% opacity, not-allowed cursor.
// Module-level (not defined during render) so React keeps a stable type.
const IconButton = ({
  title,
  onClick,
  active,
  disabled,
  children,
  color,
  T,
}: {
  title: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  color?: string
  T: ToolbarTokens
}) => (
  // #467 — der `title` dient als ergaenzender Tooltip (mit Delay,
  // Positionierung, Keyboard-Fokus-Reveal); `aria-label` bleibt der
  // barrierefreie Name. Kein natives title= mehr → kein Doppel-Tooltip.
  <Tooltip label={title}>
    <button
      type="button"
      aria-label={title}
      aria-pressed={active}
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
  </Tooltip>
)

export const CanvasToolbar = ({ mode = 'main' }: { mode?: CanvasToolbarMode } = {}) => {
  const t = useTranslation()
  // v7.9.5 — Toolbar frei verschiebbar (User-Request: "Mache die
  // toolbar im canvas frei verschiebbar"). useDraggablePosition liefert
  // den persistierten Offset relativ zur Default-Position top:8 left:8.
  // Destructured so the compiler sees the ref (`containerRef`, only attached
  // via `ref={}`) separately from the plain derived values (react-hooks/refs).
  const { containerRef, containerStyle, headerProps } = useDraggablePosition(
    'cable-planner:canvas-toolbar-pos',
    true,
  )
  // v7.9.0 / Issue #120 — open RackBuilder seeded with current selection
  const triggerRackBuilderFromSelection = useUiStore((s) => s.triggerRackBuilderFromSelection)
  const triggerRackBuilderEditFromBlackBox = useUiStore(
    (s) => s.triggerRackBuilderEditFromBlackBox,
  )
  // v7.9.30 — Snap-to-Grid + Grid-Size sind nicht mehr user-konfigurierbar.
  // Werte kommen jetzt aus dem Store-Default (snapToGrid=true,
  // gridSize=EQUIPMENT_LAYOUT.GRID_SIZE=11) — siehe uiStore-Migration.
  const snapToGrid = useUiStore((state) => state.snapToGrid)
  const gridSize = useUiStore((state) => state.gridSize)
  const defaultRouting = useUiStore((state) => state.defaultRouting)
  const setDefaultRouting = useUiStore((state) => state.setDefaultRouting)
  const defaultArrow = useUiStore((state) => state.defaultArrow)
  const setDefaultArrow = useUiStore((state) => state.setDefaultArrow)
  // v7.9.5 — globaler Kabelbrücken-Toggle in der Toolbar
  const cableBumps = useUiStore((state) => state.cableBumps)
  const setCableBumps = useUiStore((state) => state.setCableBumps)
  // v7.9.112 / Issue #234 — Global Cable-Labels ausblenden.
  const hideAllCableLabels = useUiStore((state) => state.hideAllCableLabels)
  const setHideAllCableLabels = useUiStore((state) => state.setHideAllCableLabels)
  // Issue #240 — Toggle fuer Kurz-Label (Format-Suffix stripping).
  const cableLabelShortForm = useUiStore((state) => state.cableLabelShortForm)
  const setCableLabelShortForm = useUiStore((state) => state.setCableLabelShortForm)
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
  const deleteGroupPreset = useProjectStore((state) => state.deleteGroupPreset)
  const groupPresetsForOverwrite = useProjectStore((state) => state.groupPresets)
  // #425 — Liste der bestehenden Preset-Namen fuer Duplikat-Check beim
  // Speichern einer neuen Geraetegruppe (case-insensitive). WICHTIG: aus dem
  // stabilen groupPresets-Array via useMemo ableiten. Ein Store-Selector der
  // direkt `.map()` zurueckgibt liefert bei JEDEM Render eine neue Array-
  // Referenz; unter zustand v5 (useSyncExternalStore) fuehrt das zu
  // "Maximum update depth exceeded" — Endlos-Re-Render der CanvasToolbar.
  const existingPresetNames = useMemo(
    () => groupPresetsForOverwrite.map((p) => p.name.trim().toLowerCase()),
    [groupPresetsForOverwrite],
  )
  const canvasState = useProjectStore((state) => state.project.canvasState)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const equipmentList = useProjectStore((state) => state.project.equipment)
  const greengoConfig = useProjectStore((state) => state.project.greengoConfig)
  // v7.9.3 — Plan-Lock-Status: 'editing' | 'finalized' | 'viewer'.
  // Toolbar-Button toggelt editing↔finalized; viewer-Modus wird nur
  // durch .cpviewer-Import gesetzt und kann nicht zurück.
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const setProjectMode = useProjectStore((s) => s.setProjectMode)
  const annotationsPanelOpen = useUiStore((s) => s.annotationsPanelOpen)
  const setAnnotationsPanelOpen = useUiStore((s) => s.setAnnotationsPanelOpen)
  const annotationsVisible = useUiStore((s) => s.annotationsVisible)
  const setAnnotationsVisible = useUiStore((s) => s.setAnnotationsVisible)
  // v7.9.67 / #177 — Toolbar-Modi um ganze Objektarten zu sperren.
  const lockFrames = useUiStore((s) => s.lockFrames)
  const setLockFrames = useUiStore((s) => s.setLockFrames)
  const lockEquipment = useUiStore((s) => s.lockEquipment)
  const setLockEquipment = useUiStore((s) => s.setLockEquipment)
  const lockCables = useUiStore((s) => s.lockCables)
  const setLockCables = useUiStore((s) => s.setLockCables)
  const annotationsCount = useProjectStore((s) => s.project.annotations?.length ?? 0)
  const { getNodes, setNodes, screenToFlowPosition } = useReactFlow()
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

  /** v7.9.28 — Figma-style alignment + distribute + viewport-relative
   *  Single-Selection. Vorher waren die Buttons unter 2 Items komplett
   *  ausgeblendet; Distribute fehlte komplett; nach Align landeten
   *  Positionen zwischen Raster-Linien. Jetzt:
   *  - 1 Selection → richtet das Gerät am sichtbaren Viewport aus
   *    (Figma: "align to parent frame")
   *  - 2+ Selection → Bounding-Box-Referenz (Figma-Standard)
   *  - 3+ Selection → zusätzlich Distribute (gleiche Lücken)
   *  - Wenn Snap-to-Grid aktiv ist, snappt jedes Ergebnis auf
   *    `gridSize` (Default 11) — bleibt damit auf Dot-Reihen. */
  // #501-Folgefix — dieselbe Geometrie-Quelle wie der Renderer, damit
  // Ausrichten/Verteilen mit den tatsächlich gerenderten Maßen rechnet
  // (snapUp-Breite + Header inkl. Subtitle/Beltpack). Vorher: ungesnappte
  // Store-Breite + vereinfachter Header → Versatz bei breiten Geräten.
  const measuredSize = (item: (typeof equipmentList)[number]) => {
    const { width, height } = computeEquipmentLayout(item, greengoConfig)
    return { w: width, h: height }
  }

  const snap = (val: number) => {
    if (!snapToGrid || gridSize <= 0) return Math.round(val)
    return Math.round(val / gridSize) * gridSize
  }

  /** Viewport-Rechteck in Flow-Koordinaten — basiert auf der ReactFlow-
   *  DOM-Bounding-Box damit Toolbar-Offset und Sidebar ausgeblendet
   *  bleiben (nicht window-Center). */
  const viewportBoundsInFlow = (): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    const el = document.querySelector('.react-flow') as HTMLElement | null
    if (!el) return null
    const r = el.getBoundingClientRect()
    const tl = screenToFlowPosition({ x: r.left, y: r.top })
    const br = screenToFlowPosition({ x: r.right, y: r.bottom })
    return { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y }
  }

  const commitPositions = (newPositionById: Map<string, { x: number; y: number }>) => {
    if (newPositionById.size === 0) return
    for (const [id, pos] of newPositionById) {
      updateEquipment(id, pos)
    }
    setNodes((rf) =>
      rf.map((n) => {
        const pos = newPositionById.get(n.id)
        return pos ? { ...n, position: pos } : n
      }),
    )
  }

  const alignSelected = (mode: AlignMode) => {
    const ids = getNodes()
      .filter((n) => n.selected && n.type === 'equipment')
      .map((n) => n.id)
    if (ids.length === 0) return
    const items = equipmentList.filter((e) => ids.includes(e.id))
    if (items.length === 0) return
    const alignItems: AlignItem[] = items.map((item) => {
      const { w, h } = measuredSize(item)
      return { id: item.id, x: item.x, y: item.y, w, h }
    })
    const newPositionById = computeAlignedPositions(alignItems, mode, {
      snap,
      singleSelectionBounds: alignItems.length === 1 ? viewportBoundsInFlow() : null,
    })
    commitPositions(newPositionById)
  }

  // v7.9.5 — Unified design tokens für die Toolbar.
  const T: ToolbarTokens = {
    // #463 — groessere Touch-/Klick-Ziele (war 28px, < komfortable Zielgroesse).
    iconBtnSize: 32,
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
  // Initiale Hydration (z.B. nach Project-Load mit erhaltener Selection).
  // ReactFlows getNodes() ist ein imperativer External-Store, der erst nach
  // dem Canvas-Mount befüllt ist — daher einmaliger Sync per Effect statt
  // Lazy-useState-Initializer (der einen leeren Store läse).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external-store sync
    setSelectedEquipmentIds(
      getNodes()
        .filter((n) => n.selected && n.type === 'equipment')
        .map((n) => n.id),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const hasSelection = selectedEquipmentIds.length >= 1
  // v7.9.50 — Wenn eines der selektierten Geräte selbst ein Rack ist
  // (also rackInternalSnapshot trägt = Black-Box-Rack auf dem Canvas),
  // ist "im 2D-Rack-Builder anordnen" verboten. Sonst könnte der User
  // ein Rack-Black-Box in ein neues Rack packen → endlose Verschachtelung
  // ohne sinnvolle Bedeutung.
  const selectionContainsRack = selectedEquipmentIds.some((id) => {
    const eq = equipmentList.find((e) => e.id === id)
    return !!eq?.rackInternalSnapshot
  })
  // v7.9.28 — Align-Buttons schon ab 1 Selection (richtet am Viewport
  // aus, Figma-Pattern). Distribute braucht 3+ Items.
  const alignEnabled = selectedEquipmentIds.length >= 1
  const distributeEnabled = selectedEquipmentIds.length >= 3

  return (
    <div
      ref={containerRef}
      className="nodrag nopan"
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        maxWidth: 'min(880px, calc(100% - 16px))',
        padding: '4px 6px',
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        boxShadow: isLight
          ? '0 8px 24px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)'
          : '0 8px 24px rgba(0,0,0,0.40), 0 2px 6px rgba(0,0,0,0.30)',
        fontSize: 11,
        ...containerStyle,
        color: T.text,
        alignItems: 'center',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* ── Drag-Grip (verschiebt die Toolbar) ─────────────────────── */}
      <span
        {...headerProps}
        title={t('toolbar.dragHandle', 'Toolbar verschieben')}
        aria-label={t('toolbar.dragHandle', 'Toolbar verschieben')}
        style={{
          ...headerProps.style,
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

      {/* ── Gruppe 1: Defaults-Dropdown ─────────────────────────────
          v7.9.30 — Snap-to-Grid Toggle und Grid-Size Input entfernt.
          Diese Werte sind jetzt fest (snapToGrid=true, gridSize=11) und
          aufeinander abgestimmt mit dem Equipment-Layout — User-
          Konfiguration brach das symmetrische Dot-Reihen-Alignment. */}
      <DefaultsMenu
        T={T}
        defaultRouting={defaultRouting}
        setDefaultRouting={setDefaultRouting}
        defaultArrow={defaultArrow}
        setDefaultArrow={setDefaultArrow}
        cableBumps={cableBumps}
        setCableBumps={setCableBumps}
        hideAllCableLabels={hideAllCableLabels}
        setHideAllCableLabels={setHideAllCableLabels}
        cableLabelShortForm={cableLabelShortForm}
        setCableLabelShortForm={setCableLabelShortForm}
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
          <IconButton T={T}
            title={
              hasSelection
                ? format(t('toolbar.location.addAround', 'Rahmen um die {count} markierten Geräte'), { count: selectedEquipmentIds.length })
                : t('toolbar.location.add', 'Neuen Location-Rahmen einfügen')
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
                name: t('toolbar.location.defaultName', 'Neue Location'),
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
            <IconButton T={T}
              title={format(t('toolbar.group.save', '{count} markierte Geräte als Gruppe speichern'), { count: selectedEquipmentIds.length })}
              onClick={() => setNamingGroup(true)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2" y="2" width="6" height="5" rx="0.5" />
                <rect x="8" y="2" width="6" height="5" rx="0.5" />
                <rect x="5" y="9" width="6" height="5" rx="0.5" />
              </svg>
            </IconButton>
          )}
          {hasSelection && !selectionContainsRack && (
            <IconButton T={T}
              title={format(t('toolbar.rack.arrange', '{count} markierte Geräte im 2D-Rack-Builder anordnen'), { count: selectedEquipmentIds.length })}
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
          {/* v7.9.51 — Rack-Bearbeiten-Button erscheint, wenn genau EIN
              Rack (Black-Box mit rackInternalSnapshot) selektiert ist.
              Öffnet den 2D-Rack-Builder mit dem Source-Preset des Racks. */}
          {selectedEquipmentIds.length === 1 && selectionContainsRack && (
            <IconButton T={T}
              title={t('toolbar.rack.edit', 'Dieses Rack im 2D-Rack-Builder bearbeiten')}
              onClick={() => triggerRackBuilderEditFromBlackBox(selectedEquipmentIds[0])}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="2" width="10" height="12" rx="0.5" />
                <line x1="3" y1="5" x2="13" y2="5" />
                <line x1="3" y1="8" x2="13" y2="8" />
                <line x1="3" y1="11" x2="13" y2="11" />
                <path d="M9 10.5 L12 7.5 L13.5 9 L10.5 12 L9 12 Z" fill="currentColor" stroke="none" />
              </svg>
            </IconButton>
          )}
        </>
      )}

      {namingGroup && hasSelection && (
        <form
          style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 4 }}
          onSubmit={async (e) => {
            e.preventDefault()
            const trimmed =
              groupName.trim() ||
              format(t('toolbar.group.defaultName', 'Gruppe {time}'), {
                time: new Date().toLocaleTimeString(),
              })
            // #425 — Bei Duplikat-Namen fragen ob die bestehende Vorlage
            // ueberschrieben werden soll, statt zwei Eintraege mit
            // demselben Namen zu erzeugen.
            const lower = trimmed.toLowerCase()
            if (existingPresetNames.includes(lower)) {
              const ok = await confirmDialog(
                format(
                  t(
                    'toolbar.group.overwriteConfirm',
                    'Es existiert bereits eine Vorlage namens "{name}". Ueberschreiben?',
                  ),
                  { name: trimmed },
                ),
                {
                  okLabel: t('toolbar.group.overwrite', 'Ueberschreiben'),
                  cancelLabel: t('common.cancel', 'Abbrechen'),
                  destructive: true,
                },
              )
              if (!ok) return
              const existing = groupPresetsForOverwrite.find(
                (p) => p.name.trim().toLowerCase() === lower,
              )
              if (existing) deleteGroupPreset(existing.id)
            }
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
            placeholder={t('toolbar.groupName.placeholder', 'Gruppenname…')}
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
            title={t('toolbar.groupName.save', 'Gruppe speichern')}
            style={{
              width: T.iconBtnSize,
              height: T.iconBtnSize,
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon icon={Check} size="sm" />
          </button>
          <IconButton T={T} title={t('toolbar.groupName.cancel', 'Abbrechen')} onClick={() => setNamingGroup(false)}>
            <Icon icon={X} size="sm" />
          </IconButton>
        </form>
      )}

      {/* ── Gruppe 4: Ausrichten ─────────────────────────────────────
          v7.9.28 — Figma-style SVG-Icons statt Unicode-Pfeile.
          1 Selection → richtet am Viewport aus. 2+ Selection →
          Selection-Bounding-Box. 3+ Selection → zusätzlich Distribute. */}
      {alignEnabled && (
        <>
          <span style={dividerStyle} />
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.leftViewport', 'An linkem Viewport-Rand ausrichten')
                : t('toolbar.align.left', 'Linksbündig')
            }
            onClick={() => alignSelected('left')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="2" y1="2" x2="2" y2="12" strokeLinecap="round" />
              <rect x="2.5" y="3" width="6" height="3" fill="currentColor" stroke="none" />
              <rect x="2.5" y="8" width="9" height="3" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.centerHViewport', 'Horizontal in Viewport zentrieren')
                : t('toolbar.align.centerH', 'Horizontal zentrieren')
            }
            onClick={() => alignSelected('center-h')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="7" y1="2" x2="7" y2="12" strokeLinecap="round" />
              <rect x="4" y="3" width="6" height="3" fill="currentColor" stroke="none" />
              <rect x="2.5" y="8" width="9" height="3" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.rightViewport', 'An rechtem Viewport-Rand ausrichten')
                : t('toolbar.align.right', 'Rechtsbündig')
            }
            onClick={() => alignSelected('right')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="12" y1="2" x2="12" y2="12" strokeLinecap="round" />
              <rect x="5.5" y="3" width="6" height="3" fill="currentColor" stroke="none" />
              <rect x="2.5" y="8" width="9" height="3" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.topViewport', 'An oberem Viewport-Rand ausrichten')
                : t('toolbar.align.top', 'Oben ausrichten')
            }
            onClick={() => alignSelected('top')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="2" y1="2" x2="12" y2="2" strokeLinecap="round" />
              <rect x="3" y="2.5" width="3" height="6" fill="currentColor" stroke="none" />
              <rect x="8" y="2.5" width="3" height="9" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.centerVViewport', 'Vertikal in Viewport zentrieren')
                : t('toolbar.align.centerV', 'Vertikal zentrieren')
            }
            onClick={() => alignSelected('center-v')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="2" y1="7" x2="12" y2="7" strokeLinecap="round" />
              <rect x="3" y="4" width="3" height="6" fill="currentColor" stroke="none" />
              <rect x="8" y="2.5" width="3" height="9" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          <IconButton T={T}
            title={
              selectedEquipmentIds.length === 1
                ? t('toolbar.align.bottomViewport', 'An unterem Viewport-Rand ausrichten')
                : t('toolbar.align.bottom', 'Unten ausrichten')
            }
            onClick={() => alignSelected('bottom')}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
              <line x1="2" y1="12" x2="12" y2="12" strokeLinecap="round" />
              <rect x="3" y="5.5" width="3" height="6" fill="currentColor" stroke="none" />
              <rect x="8" y="2.5" width="3" height="9" fill="currentColor" stroke="none" />
            </svg>
          </IconButton>
          {distributeEnabled && (
            <>
              <IconButton T={T}
                title={t('toolbar.align.distH', 'Horizontal gleichmäßig verteilen')}
                onClick={() => alignSelected('distribute-h')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                  <rect x="5.75" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                  <rect x="9.5" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                </svg>
              </IconButton>
              <IconButton T={T}
                title={t('toolbar.align.distV', 'Vertikal gleichmäßig verteilen')}
                onClick={() => alignSelected('distribute-v')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="3" y="2" width="8" height="2.5" fill="currentColor" stroke="none" />
                  <rect x="3" y="5.75" width="8" height="2.5" fill="currentColor" stroke="none" />
                  <rect x="3" y="9.5" width="8" height="2.5" fill="currentColor" stroke="none" />
                </svg>
              </IconButton>
            </>
          )}
        </>
      )}

      {/* ── Status-Gruppe (rechts gepusht): Plan-Lock + Annotations ─
          v7.9.12 — Im Rack-Mode komplett ausgeblendet. Plan-Lock und
          Annotations sind Project-Level-Concerns, nicht Rack-intern. */}
      {mode === 'main' && <>
      <span style={{ ...dividerStyle, marginLeft: 'auto' }} />
      {/* v7.9.85 / #123 — Layer-Visibility-Chips (Video/Audio/Control/
          Network/Power + Custom). Klick toggelt Layer-Sichtbarkeit;
          gefiltert wird nur das KABEL, nicht das Gerät (Option A aus
          #123). Aus AV-Industrie-Recherche: D-Tools, Stardraw, AVECAV
          nutzen genau diese 5 Top-Level-Layer als Branchenstandard. */}
      <LayerVisibilityChips />
      <span style={dividerStyle} />
      {/* v7.9.67 / #177 — 3 Lock-Mode-Buttons (Rahmen / Geräte / Kabel).
          Toggelt globalen Schutz gegen Verschieben pro Objektart. */}
      {([
        {
          key: 'frames',
          active: lockFrames,
          toggle: () => setLockFrames(!lockFrames),
          title: lockFrames
            ? t('toolbar.lock.frames.locked', 'Rahmen entsperren')
            : t('toolbar.lock.frames.unlocked', 'Rahmen sperren (keine Frame-Verschiebung)'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="1" />
            </svg>
          ),
        },
        {
          key: 'equipment',
          active: lockEquipment,
          toggle: () => setLockEquipment(!lockEquipment),
          title: lockEquipment
            ? t('toolbar.lock.equipment.locked', 'Geräte entsperren')
            : t('toolbar.lock.equipment.unlocked', 'Geräte sperren (keine Geräte-Verschiebung)'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="12" height="8" rx="1" />
              <circle cx="5" cy="8" r="0.8" fill="currentColor" />
              <circle cx="11" cy="8" r="0.8" fill="currentColor" />
            </svg>
          ),
        },
        {
          key: 'cables',
          active: lockCables,
          toggle: () => setLockCables(!lockCables),
          title: lockCables
            ? t('toolbar.lock.cables.locked', 'Kabel entsperren')
            : t('toolbar.lock.cables.unlocked', 'Kabel sperren (keine Waypoint-Bearbeitung)'),
          icon: (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 12c2 0 2-8 6-8s4 8 6 8" />
            </svg>
          ),
        },
      ] as const).map((btn) => (
        <button
          key={btn.key}
          type="button"
          onClick={btn.toggle}
          title={btn.title}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: T.iconBtnSize,
            height: T.iconBtnSize,
            background: btn.active ? '#0e7490' : T.btnBg,
            color: btn.active ? '#e0f2fe' : T.text,
            border: `1px solid ${btn.active ? '#06b6d4' : T.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          {btn.icon}
          {btn.active && (
            <svg
              width="8"
              height="8"
              viewBox="0 0 16 16"
              fill="currentColor"
              style={{ position: 'absolute', right: 2, bottom: 2 }}
            >
              <rect x="5" y="7" width="6" height="5" rx="0.5" />
              <path d="M6 7V5.5a2 2 0 0 1 4 0V7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>
      ))}
      <span style={dividerStyle} />
      <button
        type="button"
        onClick={async () => {
          if (projectMode === 'viewer') return
          if (projectMode === 'finalized') {
            const ok = await confirmDialog(
              t('toolbar.planLock.unlock.title', 'Planung wieder zur Bearbeitung freigeben?'),
              {
                body: t(
                  'toolbar.planLock.unlock.body',
                  'Geräte, Kabel und Layout können dann wieder verändert werden.',
                ),
                okLabel: t('toolbar.planLock.unlock.ok', 'Freigeben'),
              },
            )
            if (ok) setProjectMode('editing')
          } else {
            const ok = await confirmDialog(t('toolbar.planLock.finalize.title', 'Planung abschließen?'), {
              body: t(
                'toolbar.planLock.finalize.body',
                'Das Canvas wird gesperrt — keine Verschiebungen, neue Verbindungen oder Löschungen möglich. Du kannst die Sperre jederzeit wieder aufheben.',
              ),
              okLabel: t('toolbar.planLock.finalize.ok', 'Abschließen'),
            })
            if (ok) setProjectMode('finalized')
          }
        }}
        disabled={projectMode === 'viewer'}
        title={
          projectMode === 'viewer'
            ? t('toolbar.planLock.viewer', 'Viewer-Datei — read-only')
            : projectMode === 'finalized'
              ? t('toolbar.planLock.finalized', 'Planung ist abgeschlossen (Klick: Bearbeitung freigeben)')
              : t('toolbar.planLock.editing', 'Planung als abgeschlossen markieren')
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
            ? t('toolbar.planLock.label.viewer', 'Viewer')
            : projectMode === 'finalized'
              ? t('toolbar.planLock.label.finalized', 'Abgeschlossen')
              : t('toolbar.planLock.label.editing', 'Abschließen')}
        </span>
      </button>
      {/* v7.9.8 — Sichtbarkeits-Toggle für Canvas-Annotations. Versteckt
          die farbigen Kreis-Badges OHNE die Annotations zu löschen. */}
      <button
        type="button"
        onClick={() => setAnnotationsVisible(!annotationsVisible)}
        title={
          annotationsVisible
            ? t('toolbar.annotations.hide', 'Anmerkungen-Badges auf dem Canvas ausblenden (Daten bleiben erhalten)')
            : t('toolbar.annotations.show', 'Anmerkungen-Badges auf dem Canvas wieder einblenden')
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
            ? t('toolbar.annotations.openViewer', 'Anmerkungen — als Reviewer Notizen hinterlassen')
            : t('toolbar.annotations.open', 'Anmerkungen anzeigen / verwalten')
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
        <span>
          {t('toolbar.annotations.label', 'Anmerkungen')}
          {annotationsCount > 0 ? ` (${annotationsCount})` : ''}
        </span>
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
            {t('toolbar.lengthLegend.title', 'Längenfarben')}
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
              <span style={{ color: T.textMuted }}>{t(`toolbar.lengthLegend.${r.length}`, r.label)}</span>
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
            {t('toolbar.lengthLegend.close', 'Schließen')}
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
  hideAllCableLabels,
  setHideAllCableLabels,
  cableLabelShortForm,
  setCableLabelShortForm,
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
  hideAllCableLabels: boolean
  setHideAllCableLabels: (v: boolean) => void
  cableLabelShortForm: boolean
  setCableLabelShortForm: (v: boolean) => void
  colorPortsByType: boolean
  setColorPortsByType: (v: boolean) => void
  cableColorMode: 'manual' | 'byLength'
  setCableColorMode: (v: 'manual' | 'byLength') => void
  showLengthLegend: boolean
  setShowLengthLegend: (v: boolean) => void
  isLight: boolean
}) => {
  const t = useTranslation()
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
        title={t('toolbar.defaults.title', 'Standard-Verhalten für neue Kabel + Darstellung')}
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
        <span>{t('toolbar.defaults.button', 'Defaults')}</span>
        {anyNonDefault && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f59e0b',
              marginLeft: 1,
            }}
            title={t('toolbar.defaults.modified', 'Mindestens ein Default wurde verändert')}
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
            {t('toolbar.defaults.routing', 'Kabel-Routing')}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(
              [
                { value: 'orthogonal' as const, label: t('toolbar.defaults.routing.ortho', 'Ortho') },
                { value: 'straight' as const, label: t('toolbar.defaults.routing.straight', 'Direkt') },
                { value: 'curved' as const, label: t('toolbar.defaults.routing.curved', 'Kurve') },
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
            {t('toolbar.defaults.cableColor', 'Kabelfarbe')}
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
              {t('toolbar.defaults.cableColor.byType', 'Nach Typ')}
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
              {t('toolbar.defaults.cableColor.byLength', 'Nach Länge')}
            </button>
            {cableColorMode === 'byLength' && (
              <button
                type="button"
                onClick={() => setShowLengthLegend(!showLengthLegend)}
                title={t('toolbar.defaults.cableColor.legend', 'Legende der Längenfarben')}
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
            {t('toolbar.defaults.misc', 'Sonstiges')}
          </div>
          {(
            [
              {
                label: t('toolbar.defaults.arrowEnd', 'Pfeil am Kabel-Ende'),
                value: defaultArrow,
                set: setDefaultArrow,
                hint: t('toolbar.defaults.arrowEndHint', 'Frisch gezogene Kabel bekommen einen Pfeil'),
              },
              {
                label: t('toolbar.defaults.bumps', 'Kabelbrücken bei Kreuzungen'),
                value: cableBumps,
                set: setCableBumps,
                hint: t('toolbar.defaults.bumpsHint', 'Globaler Default — pro Kabel via Rechtsklick überschreibbar'),
              },
              {
                // v7.9.112 / Issue #234 — globaler Kabel-Label-Hide.
                label: t('toolbar.defaults.hideLabels', 'Alle Kabel-Labels ausblenden'),
                value: hideAllCableLabels,
                set: setHideAllCableLabels,
                hint: t(
                  'toolbar.defaults.hideLabelsHint',
                  'Globaler Toggle. Per-Kabel-Position bleibt erhalten — beim Ausschalten kommen die Labels wieder.',
                ),
              },
              {
                // Issue #240 — Kabel-Label Kurzform vs. Voller Name.
                label: t('toolbar.defaults.shortLabel', 'Kabel-Labels: Kurzform'),
                value: cableLabelShortForm,
                set: setCableLabelShortForm,
                hint: t(
                  'toolbar.defaults.shortLabelHint',
                  'Format-Suffix (z.B. "(1080p50/60)") aus dem Anzeige-Label entfernen. Voller Name bleibt in den Kabel-Eigenschaften gespeichert.',
                ),
              },
              {
                label: t('toolbar.defaults.portsByType', 'Ports nach Connector-Typ einfärben'),
                value: colorPortsByType,
                set: setColorPortsByType,
                hint: t('toolbar.defaults.portsByTypeHint', 'SDI = bernstein, HDMI = violett, Ethernet = grün, …'),
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
