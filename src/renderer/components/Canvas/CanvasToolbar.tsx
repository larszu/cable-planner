import { useEffect, useMemo, useRef, useState } from 'react'
import { useOnSelectionChange, useReactFlow } from 'reactflow'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { LENGTH_COLOR_RULES } from '../../lib/cableColors'
import { LayerVisibilityChips } from './LayerVisibilityChips'
import { FlowModeChip } from './FlowModeChip'
import { CircuitChip } from './CircuitChip'
import { PatternChip } from './PatternChip'
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
  label,
  onClick,
  active,
  disabled,
  children,
  color,
  T,
}: {
  title: string
  /**
   * Sichtbare Beschriftung neben dem Symbol.
   *
   * Optional, weil nicht jedes Symbol eine braucht: die Ausrichte-Knoepfe
   * tragen in jedem Zeichenprogramm dieselben Zeichen, und sie erscheinen nur
   * bei Auswahl. Wo ein Knopf aber DAUERHAFT steht und sein Symbol nichts
   * Gelerntes ist, gehoert das Wort daneben — der Tooltip kommt erst nach
   * Zeigen und Warten, und danach sucht niemand.
   */
  label?: string
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
        ...(label ? { height: T.iconBtnSize, padding: '0 8px', gap: 4 } : { width: T.iconBtnSize, height: T.iconBtnSize, padding: 0 }),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
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
      {label && <span>{label}</span>}
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
  const intercom = useProjectStore((state) => state.project.intercom)
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
    const { width, height } = computeEquipmentLayout(item, intercom)
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

  /**
   * v7.9.5 — Unified design tokens fuer die Toolbar.
   *
   * SEIT 2026-09-10 AUF DER MARKEN-PALETTE statt auf Schiefer (Phase 2 der
   * UI-Pruefung). Die Werte standen vorher als Paare hier, je einer pro
   * Theme, und waren Tailwind-Slate: `#0f172a`, `#1e293b`, `#cbd5e1`. Die
   * uebrige App laeuft seit ADR-007 auf Zumpe Navy — die Werkzeugleiste war
   * damit die einzige Flaeche, die sichtbar aus der Palette fiel, und jede
   * Farbaenderung am Haus ging an ihr vorbei.
   *
   * `var(--cp-*)` loest hier richtig auf, auch beim PDF-Export: `App.tsx`
   * setzt `document.documentElement.dataset.theme` auf
   * `pdfExportThemeOverride ?? canvasTheme`, das Attribut traegt also
   * waehrend des Exports das Export-Theme. Nachgemessen in beiden Themes im
   * echten Fenster.
   *
   * ZWEI STELLEN BLEIBEN ABSICHTLICH FEST:
   *   `btnActiveBg`/`btnActiveText` sind eine ZUSTANDS-Farbe, keine
   *   Flaeche — sie sagen „dieser Knopf ist an". `--cp-accent` ist im
   *   Dunkel-Theme Off-White (#F6F5F0); ein aktiver Knopf wuerde damit
   *   weiss statt blau, und das ist eine andere Entscheidung als „auf die
   *   Palette heben".
   */
  const T: ToolbarTokens = {
    // #463 — groessere Touch-/Klick-Ziele (war 28px, < komfortable Zielgroesse).
    iconBtnSize: 32,
    bg: 'color-mix(in srgb, var(--cp-surface-1) 92%, transparent)',
    border: 'var(--cp-border)',
    text: 'var(--cp-text)',
    textMuted: 'var(--cp-text-muted)',
    btnBg: 'transparent',
    btnBgHover: 'color-mix(in srgb, var(--cp-text) 8%, transparent)',
    btnActiveBg: '#0284c7',
    btnActiveText: '#ffffff',
    dividerColor: 'var(--cp-border-muted)',
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
      /* Marke fuer die Geraete-Suche: sie legt sich sonst genau hierhin.
         Die Leiste UMBRICHT (`flexWrap`), ihre Hoehe ist also nicht
         konstant — wer sie umgehen will, muss sie MESSEN. Siehe
         `CanvasSearch.tsx`. */
      data-cp-canvas-toolbar=""
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
        title={t('toolbar.dragHandle', 'Move toolbar')}
        aria-label={t('toolbar.dragHandle', 'Move toolbar')}
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
          {/* BESCHRIFTET 2026-09-07: dieser Knopf ist immer sichtbar und trug
              nur ein gestricheltes Rechteck. „Ein Rahmen" ist nichts, was man
              aus einem Symbol errät, und der Tooltip kommt erst nach Zeigen
              und Warten. Die Ausrichte-Knöpfe daneben bleiben Symbole: sie
              erscheinen nur bei Auswahl, und ihre Zeichen (links/mittig/
              verteilen) sind in jedem Zeichenprogramm dieselben. */}
          <IconButton T={T}
            label={t('toolbar.location.label', 'Frame')}
            title={
              hasSelection
                ? format(t('toolbar.location.addAround', 'Frame around the {count} selected devices'), { count: selectedEquipmentIds.length })
                : t('toolbar.location.add', 'Add new location frame')
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
                name: t('toolbar.location.defaultName', 'New location'),
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
          {/* GENAU ZWEI markiert: Mehrfach-Verkabelung, mit beiden Geraeten
              schon eingesetzt (2026-09-07).

              Das Werkzeug stand nur im Menue, und dort verlangte es die
              Auswahl von Quelle und Ziel in zwei Aufklapplisten — obwohl
              genau das die Frage ist, die der Nutzer mit seiner Markierung
              bereits beantwortet hat. Der Menue-Eintrag bleibt: er ist der
              Weg fuer den, der nichts markiert hat, und die Listen sind dort
              der richtige Rueckfall.

              Bei EINEM oder DREI markierten Geraeten erscheint der Knopf
              nicht: „von wo nach wo" hat dann keine eindeutige Antwort, und
              eine geratene waere schlimmer als die Aufklappliste. */}
          {selectedEquipmentIds.length === 2 && (
            <IconButton T={T}
              label={t('toolbar.bulkConnect.label', 'Connect cables')}
              title={t(
                'toolbar.bulkConnect.title',
                'Create several cables between the two selected devices at once',
              )}
              onClick={() =>
                useUiStore
                  .getState()
                  .openBulkConnect(selectedEquipmentIds[0], selectedEquipmentIds[1])
              }
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M2 5h4M2 8h4M2 11h4M10 5h4M10 8h4M10 11h4" strokeLinecap="round" />
                <path d="M6 5h4M6 8h4M6 11h4" strokeLinecap="round" opacity="0.5" />
              </svg>
            </IconButton>
          )}
          {hasSelection && (
            <IconButton T={T}
              title={format(t('toolbar.group.save', 'Save {count} selected devices as a group'), { count: selectedEquipmentIds.length })}
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
              title={format(t('toolbar.rack.arrange', 'Arrange the {count} selected devices in the 2D rack builder'), { count: selectedEquipmentIds.length })}
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
              title={t('toolbar.rack.edit', 'Edit this rack in the 2D rack builder')}
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
              format(t('toolbar.group.defaultName', 'Group {time}'), {
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
                    'A template named "{name}" already exists. Overwrite?',
                  ),
                  { name: trimmed },
                ),
                {
                  okLabel: t('toolbar.group.overwrite', 'Overwrite'),
                  cancelLabel: t('common.cancel', 'Cancel'),
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
            placeholder={t('toolbar.groupName.placeholder', 'Group name…')}
            style={{
              width: 140,
              height: T.iconBtnSize - 4,
              background: 'var(--cp-surface-3)',
              border: `1px solid ${T.border}`,
              color: T.text,
              padding: '0 6px',
              borderRadius: 4,
              fontSize: 11,
            }}
          />
          <button
            type="submit"
            title={t('toolbar.groupName.save', 'Save group')}
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
          <IconButton T={T} title={t('toolbar.groupName.cancel', 'Cancel')} onClick={() => setNamingGroup(false)}>
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
                ? t('toolbar.align.leftViewport', 'Align to left viewport edge')
                : t('toolbar.align.left', 'Left align')
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
                ? t('toolbar.align.centerHViewport', 'Centre horizontally in viewport')
                : t('toolbar.align.centerH', 'Centre horizontally')
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
                ? t('toolbar.align.rightViewport', 'Align to right viewport edge')
                : t('toolbar.align.right', 'Right align')
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
                ? t('toolbar.align.topViewport', 'Align to top viewport edge')
                : t('toolbar.align.top', 'Top align')
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
                ? t('toolbar.align.centerVViewport', 'Centre vertically in viewport')
                : t('toolbar.align.centerV', 'Centre vertically')
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
                ? t('toolbar.align.bottomViewport', 'Align to bottom viewport edge')
                : t('toolbar.align.bottom', 'Bottom align')
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
                title={t('toolbar.align.distH', 'Distribute horizontally')}
                onClick={() => alignSelected('distribute-h')}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                  <rect x="5.75" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                  <rect x="9.5" y="3" width="2.5" height="8" fill="currentColor" stroke="none" />
                </svg>
              </IconButton>
              <IconButton T={T}
                title={t('toolbar.align.distV', 'Distribute vertically')}
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
      {/* Die Betriebsart des Signalflusses. Sie steht neben der
          Layer-Legende, weil beide dasselbe beantworten: wonach ist dieses
          Bild zu lesen. */}
      <FlowModeChip />
      <CircuitChip />
      <PatternChip />
      <span style={dividerStyle} />
      {/* v7.9.67 / #177 — der Schutz gegen versehentliches Verschieben, je
          Objektart (Rahmen / Geräte / Kabel).

          ZUSAMMENGELEGT 2026-09-07, auf Zuruf des Nutzers: „Nicht jeder
          Button ist beschriftet und man erkennt nicht auf den ersten Blick
          wofür er gut sein soll." Hier standen DREI Knöpfe nebeneinander,
          alle gleich gross, alle ohne Text, unterschieden nur durch ein
          Rechteck, ein Rechteck mit zwei Punkten und eine Wellenlinie. Wer
          die drei nicht kennt, kann sie nicht auseinanderhalten — und die
          Beschriftung stand nur im Tooltip, also erst nach Zeigen und
          Warten.

          Jetzt EIN Knopf mit dem Wort „Sperren" und der Zahl der aktiven
          Sperren; die drei Schalter stehen beschriftet im Menü darunter.
          Das nimmt der Leiste zwei Bedienelemente und gibt dem dritten
          einen lesbaren Namen. */}
      <LockMenu
        lockFrames={lockFrames}
        setLockFrames={setLockFrames}
        lockEquipment={lockEquipment}
        setLockEquipment={setLockEquipment}
        lockCables={lockCables}
        setLockCables={setLockCables}
        T={T}
      />
      <span style={dividerStyle} />
      <button
        type="button"
        onClick={async () => {
          if (projectMode === 'viewer') return
          if (projectMode === 'finalized') {
            const ok = await confirmDialog(
              t('toolbar.planLock.unlock.title', 'Re-enable plan editing?'),
              {
                body: t(
                  'toolbar.planLock.unlock.body',
                  'Devices, cables and layout can then be changed again.',
                ),
                okLabel: t('toolbar.planLock.unlock.ok', 'Re-enable'),
              },
            )
            if (ok) setProjectMode('editing')
          } else {
            const ok = await confirmDialog(t('toolbar.planLock.finalize.title', 'Finalise plan?'), {
              body: t(
                'toolbar.planLock.finalize.body',
                'The canvas will be locked — no moving, new connections or deletions. You can re-enable editing any time.',
              ),
              okLabel: t('toolbar.planLock.finalize.ok', 'Finalise'),
            })
            if (ok) setProjectMode('finalized')
          }
        }}
        disabled={projectMode === 'viewer'}
        title={
          projectMode === 'viewer'
            ? t('toolbar.planLock.viewer', 'Viewer file — read-only')
            : projectMode === 'finalized'
              ? t('toolbar.planLock.finalized', 'Plan is finalised (click: re-enable editing)')
              : t('toolbar.planLock.editing', 'Mark plan as finalised')
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: T.iconBtnSize,
          padding: '0 10px',
          background:
            projectMode === 'viewer'
              ? 'var(--cp-surface-2)'
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
              ? t('toolbar.planLock.label.finalized', 'Finalised')
              : t('toolbar.planLock.label.editing', 'Finalise')}
        </span>
      </button>
      {/* v7.9.8 — Sichtbarkeits-Toggle für Canvas-Annotations. Versteckt
          die farbigen Kreis-Badges OHNE die Annotations zu löschen. */}
      <button
        type="button"
        onClick={() => setAnnotationsVisible(!annotationsVisible)}
        title={
          annotationsVisible
            ? t('toolbar.annotations.hide', 'Hide annotation badges on canvas (data stays)')
            : t('toolbar.annotations.show', 'Show annotation badges on canvas')
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          justifyContent: 'center',
          height: T.iconBtnSize,
          padding: '0 8px',
          background: annotationsVisible ? T.btnBg : T.btnActiveBg,
          color: annotationsVisible ? T.text : '#ffffff',
          border: `1px solid ${annotationsVisible ? T.border : T.btnActiveBg}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
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
        {/* „Badges" und nicht „Anmerkungen": der Knopf DANEBEN oeffnet die
            Anmerkungen, dieser blendet nur ihre Marken auf der Zeichnung aus.
            Zweimal dasselbe Wort waere schlimmer als das blosse Auge. */}
        <span>{t('toolbar.annotations.badgeLabel', 'Badges')}</span>
      </button>
      <button
        type="button"
        onClick={() => setAnnotationsPanelOpen(!annotationsPanelOpen)}
        title={
          projectMode === 'viewer'
            ? t('toolbar.annotations.openViewer', 'Annotations — leave reviewer notes')
            : t('toolbar.annotations.open', 'Show / manage annotations')
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
          {t('toolbar.annotations.label', 'Annotations')}
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
            {t('toolbar.lengthLegend.title', 'Length colours')}
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
                  border: '1px solid var(--cp-text-faint)',
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
            {t('toolbar.lengthLegend.close', 'Close')}
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
  cableColorMode: 'manual' | 'byLength' | 'byLayer'
  setCableColorMode: (v: 'manual' | 'byLength' | 'byLayer') => void
  showLengthLegend: boolean
  setShowLengthLegend: (v: boolean) => void
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
        title={t('toolbar.defaults.title', 'Default behaviour for new cables + appearance')}
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
            title={t('toolbar.defaults.modified', 'At least one default has been changed')}
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
            {t('toolbar.defaults.routing', 'Cable routing')}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            {(
              [
                { value: 'orthogonal' as const, label: t('toolbar.defaults.routing.ortho', 'Ortho') },
                { value: 'straight' as const, label: t('toolbar.defaults.routing.straight', 'Direct') },
                { value: 'curved' as const, label: t('toolbar.defaults.routing.curved', 'Curved') },
              ]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDefaultRouting(opt.value)}
                style={{
                  flex: 1,
                  padding: 4,
                  background: defaultRouting === opt.value ? T.btnActiveBg : 'var(--cp-surface-2)',
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
            {t('toolbar.defaults.cableColor', 'Cable colour')}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setCableColorMode('manual')}
              style={{
                flex: 1,
                padding: 4,
                background: cableColorMode === 'manual' ? T.btnActiveBg : 'var(--cp-surface-2)',
                color: cableColorMode === 'manual' ? T.btnActiveText : T.text,
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              {t('toolbar.defaults.cableColor.byType', 'By type')}
            </button>
            <button
              type="button"
              onClick={() => setCableColorMode('byLength')}
              style={{
                flex: 1,
                padding: 4,
                background: cableColorMode === 'byLength' ? T.btnActiveBg : 'var(--cp-surface-2)',
                color: cableColorMode === 'byLength' ? T.btnActiveText : T.text,
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              {t('toolbar.defaults.cableColor.byLength', 'By length')}
            </button>
            {cableColorMode === 'byLength' && (
              <button
                type="button"
                onClick={() => setShowLengthLegend(!showLengthLegend)}
                title={t('toolbar.defaults.cableColor.legend', 'Show length-colour legend')}
                style={{
                  padding: '4px 6px',
                  background: 'var(--cp-surface-2)',
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
            {t('toolbar.defaults.misc', 'Other')}
          </div>
          {(
            [
              {
                label: t('toolbar.defaults.arrowEnd', 'Arrow at cable end'),
                value: defaultArrow,
                set: setDefaultArrow,
                hint: t('toolbar.defaults.arrowEndHint', 'Newly drawn cables get an arrow'),
              },
              {
                label: t('toolbar.defaults.bumps', 'Cable bumps at crossings'),
                value: cableBumps,
                set: setCableBumps,
                hint: t('toolbar.defaults.bumpsHint', 'Global default — overridable per cable via right-click'),
              },
              {
                // v7.9.112 / Issue #234 — globaler Kabel-Label-Hide.
                label: t('toolbar.defaults.hideLabels', 'Hide all cable labels'),
                value: hideAllCableLabels,
                set: setHideAllCableLabels,
                hint: t(
                  'toolbar.defaults.hideLabelsHint',
                  'Global toggle. Per-cable label position is preserved — re-enable to bring labels back.',
                ),
              },
              {
                // Issue #240 — Kabel-Label Kurzform vs. Voller Name.
                label: t('toolbar.defaults.shortLabel', 'Cable labels: short form'),
                value: cableLabelShortForm,
                set: setCableLabelShortForm,
                hint: t(
                  'toolbar.defaults.shortLabelHint',
                  'Strip the format suffix (e.g. "(1080p50/60)") from the display label. Full name stays in the cable properties.',
                ),
              },
              {
                label: t('toolbar.defaults.portsByType', 'Colour ports by connector type'),
                value: colorPortsByType,
                set: setColorPortsByType,
                hint: t('toolbar.defaults.portsByTypeHint', 'SDI = amber, HDMI = violet, Ethernet = green, …'),
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


/**
 * Der Sperren-Knopf mit seinen drei beschrifteten Schaltern.
 *
 * WARUM EIN MENUE UND NICHT DREI KNOEPFE. Weil drei gleich grosse Symbole
 * ohne Text nicht unterscheidbar sind — das war die Beschwerde. Ein Wort auf
 * dem Knopf sagt, worum es geht; die Zahl daneben sagt, ob gerade etwas
 * gesperrt ist, ohne dass man das Menue oeffnen muss. Erst wer wirklich
 * umschalten will, klickt hinein, und dort steht jeder Schalter ausgeschrieben.
 *
 * Sperren ist eine Einstellung, die man einmal setzt und dann stehen laesst —
 * ein zusaetzlicher Klick kostet hier nichts. Bei einer Handlung, die man
 * dutzendfach am Tag ausloest, waere dieselbe Aenderung falsch.
 */
const LockMenu = ({
  lockFrames,
  setLockFrames,
  lockEquipment,
  setLockEquipment,
  lockCables,
  setLockCables,
  T,
}: {
  lockFrames: boolean
  setLockFrames: (v: boolean) => void
  lockEquipment: boolean
  setLockEquipment: (v: boolean) => void
  lockCables: boolean
  setLockCables: (v: boolean) => void
  T: ToolbarTokens
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

  const schalter = [
    {
      key: 'frames',
      an: lockFrames,
      um: () => setLockFrames(!lockFrames),
      label: t('toolbar.lock.frames.label', 'Frames'),
      note: t('toolbar.lock.frames.note', 'No frame moves'),
    },
    {
      key: 'equipment',
      an: lockEquipment,
      um: () => setLockEquipment(!lockEquipment),
      label: t('toolbar.lock.equipment.label', 'Devices'),
      note: t('toolbar.lock.equipment.note', 'No device moves'),
    },
    {
      key: 'cables',
      an: lockCables,
      um: () => setLockCables(!lockCables),
      label: t('toolbar.lock.cables.label', 'Cables'),
      note: t('toolbar.lock.cables.note', 'No waypoint editing'),
    },
  ]
  const aktiv = schalter.filter((s) => s.an).length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('toolbar.lock.title', 'Protection against accidental moves')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          height: T.iconBtnSize,
          padding: '0 8px',
          background: aktiv > 0 ? '#0e7490' : open ? T.btnActiveBg : T.btnBg,
          color: aktiv > 0 ? '#e0f2fe' : open ? T.btnActiveText : T.text,
          border: `1px solid ${aktiv > 0 ? '#06b6d4' : 'transparent'}`,
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="7" width="8" height="6" rx="1" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        <span>{t('toolbar.lock.button', 'Lock')}</span>
        {/* Die Zahl steht AUSSEN, damit „ist gerade etwas gesperrt" ohne
            Oeffnen beantwortet ist. Bei null wird nichts gezeigt: eine „0"
            waere eine Angabe ueber nichts. */}
        {aktiv > 0 && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{aktiv}/3</span>}
        <span style={{ fontSize: 9 }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            // RECHTS verankert, nicht links: dieser Knopf sitzt am rechten
            // Ende der Werkzeugleiste, und ein nach rechts aufklappendes
            // Menue laeuft dort in den Inspector und wird abgeschnitten —
            // gesehen im ersten Screenshot dieser Aenderung, „Keine
            // Waypoint-Bearbeitun". Nach links klappt es ins Freie.
            right: 0,
            minWidth: 220,
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
          {schalter.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={s.um}
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: 8,
                padding: '5px 6px',
                marginBottom: 2,
                background: s.an ? T.btnActiveBg : 'transparent',
                color: s.an ? T.btnActiveText : T.text,
                border: '1px solid transparent',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: `1px solid ${s.an ? '#06b6d4' : T.border}`,
                  background: s.an ? '#0e7490' : 'transparent',
                  flexShrink: 0,
                }}
              >
                {s.an && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#e0f2fe" strokeWidth="2.5">
                    <path d="M3 8.5l3.5 3.5L13 5" />
                  </svg>
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block' }}>{s.label}</span>
                <span style={{ display: 'block', color: T.textMuted, fontSize: 10 }}>{s.note}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
