import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { RackImageCropDialog } from './RackImageCropDialog'
import { RackLivePreview } from './RackLivePreview'
import { RackBuilder3DTab } from './RackBuilder3DTab'
import { PatchPanelCreateDialog } from './PatchPanelCreateDialog'
import { RackShelfCreateDialog } from './RackShelfCreateDialog'
import { PortDots2D } from './PortDots2D'
import { RackAddSplitButton } from './RackAddSplitButton'
import { NonRackAddDialog } from './NonRackAddDialog'
import { RackBuilderDialogExportMenu } from './RackBuilderDialogExportMenu'
import { RackBuilderFooter } from './RackBuilderFooter'
import { RackBuilderHeader } from './RackBuilderHeader'
import { RackConflictBadges } from './RackConflictBadges'
import { RackInternalWireOverlay } from './RackInternalWireOverlay'
import { RackPlacementProperties } from './RackPlacementProperties'
import { Splitter } from '../Layout/Splitter'
import { Icon } from '../shared/Icon'
import { Box, Columns2, FlipHorizontal2, GalleryVerticalEnd, Maximize2, Minus, Plus, RectangleVertical, Square } from 'lucide-react'
import type {
  RackDraft,
  RackPlacementDraft,
} from './rackBuilderTypes'
import { RACK_MOUNT_WIDTH_MM } from './rackBuilderTypes'
import * as THREE from 'three'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { confirmDialog } from '../../lib/confirmDialog'
import { LIMITS } from '../../lib/layoutConstants'
import { STORAGE_KEYS } from '../../lib/storageKeys'

interface RackBuilderDialogProps {
  open: boolean
  templates: EquipmentTemplate[]
  /** When set, the dialog opens in edit mode and seeds from this preset. */
  initialPreset?: GroupPreset | null
  onClose: () => void
  onSave: (preset: GroupPreset) => void
}

// 19" rack standard: outer width 482.6 mm, 1U height 44.45 mm.
// width / height ratio per 1 HE = 482.6 / 44.45 ≈ 10.857 — used to derive
// rowHeight in pixels from the measured panel width so the on-screen rack is
// proportional to a real 19" rack, regardless of available screen space.
import {
  RACK_PANEL_ASPECT_PER_1HE, RACK_OUTER_WIDTH_MM, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT,
  DEFAULT_ROW_HEIGHT, DRAFT_KEY, parseUnits, toPlacement, normalizeDraft,
  formatRackUnits, draftFromPreset,
} from './rackBuilderHelpers'

export const RackBuilderDialog = ({ open, templates, initialPreset, onClose, onSave }: RackBuilderDialogProps) => {
  const t = useTranslation()
  // v7.9.13 — Permanent-Mark-As-Rack-Device action.
  const markTemplateAsRack = useProjectStore((s) => s.markTemplateAsRack)
  const addCustomTemplate = useProjectStore((s) => s.addCustomTemplate)
  const autosaveIntervalMs = useSettingsStore((state) => state.autosaveIntervalMs)
  const editingId = initialPreset?.id
  const [draft, setDraft] = useState<RackDraft>({
    rackName: t('rack.newRack', 'Neues Rack'),
    totalUnits: 42,
    viewMode: 'front',
    placements: [],
    internalCables: [],
  })
  // #558 — Lokale Undo/Redo-History fuer den Rack-Builder. Die globale
  // projectHistory in store/projectHistory kennt nur den projectStore;
  // der Builder-Draft ist React-Komponenten-State und wuerde sonst
  // Strg+Z komplett ignorieren. Halten zwei Stacks past/future und einen
  // Suspend-Flag fuer programmatische Restores (sonst wuerde das Restore
  // selbst wieder einen History-Eintrag erzeugen).
  const draftHistoryRef = useRef<{ past: RackDraft[]; future: RackDraft[]; suspend: boolean }>({
    past: [],
    future: [],
    suspend: false,
  })
  const lastDraftRef = useRef<RackDraft>(draft)
  useEffect(() => {
    if (!open) return
    const hist = draftHistoryRef.current
    if (hist.suspend) {
      hist.suspend = false
      lastDraftRef.current = draft
      return
    }
    // Erster Snapshot beim Open: nichts pushen, nur Start-Punkt setzen.
    if (lastDraftRef.current === draft) return
    hist.past.push(lastDraftRef.current)
    if (hist.past.length > 100) hist.past.shift()
    hist.future = []
    lastDraftRef.current = draft
  }, [draft, open])
  useEffect(() => {
    if (!open) {
      // Beim Schliessen History komplett zuruecksetzen.
      draftHistoryRef.current = { past: [], future: [], suspend: false }
      lastDraftRef.current = draft
    }
    // Beim Open: lastDraftRef auf den initialen Draft setzen damit der
    // erste Effekt-Lauf nichts in past speichert.
    else if (lastDraftRef.current !== draft && draftHistoryRef.current.past.length === 0) {
      lastDraftRef.current = draft
    }
  }, [open])
  // #558 — Strg+Z / Strg+Umsch+Z / Strg+Y im Rack-Builder. Window-level
  // mit Capture-Phase damit der globale useUndoRedoShortcuts-Handler in
  // store/projectHistory.ts NICHT gleichzeitig die projectHistory zurueck-
  // popt — sonst macht jedes Strg+Z gleichzeitig den letzten Canvas-Step
  // UND den letzten Rack-Builder-Step rueckgaengig. Nur aktiv solange der
  // Dialog offen ist.
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const key = event.key.toLowerCase()
      const isUndo = key === 'z' && !event.shiftKey
      const isRedo = (key === 'z' && event.shiftKey) || key === 'y'
      if (!isUndo && !isRedo) return
      event.preventDefault()
      event.stopImmediatePropagation()
      const hist = draftHistoryRef.current
      if (isUndo) {
        const prev = hist.past.pop()
        if (!prev) return
        hist.future.push(lastDraftRef.current)
        hist.suspend = true
        setDraft(prev)
      } else {
        const next = hist.future.pop()
        if (!next) return
        hist.past.push(lastDraftRef.current)
        hist.suspend = true
        setDraft(next)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [open])
  const [wireDialogOpen, setWireDialogOpen] = useState(false)
  const [query, setQuery] = useState('')
  // v7.9.9 — Inline-Validation: Statt window.alert blockiert
  // saveError wird als Banner im Dialog gezeigt. Beim ersten gültigen
  // Submit-Versuch wird der Banner gelöscht.
  const [saveError, setSaveError] = useState<string | null>(null)
  const rackNameInputRef = useRef<HTMLInputElement | null>(null)
  // v7.9.0 / Issue #112 — zeige auch Templates die NICHT als 19"-
  // Rack-Gerät markiert sind, damit man sie aus dem Builder
  // suchen + nachträglich umflaggen kann.
  const [showNonRack, setShowNonRack] = useState(false)
  // #472 — Steckverbinder-Symbole statt einfacher Farb-Dots im 2D-Rack.
  const [showConnectorSymbols, setShowConnectorSymbols] = useState(false)
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  // v7.9.49 — Eigenschaften-Panel ist jetzt ein Popup, das per Doppelklick
  // auf ein Gerät im Rack aufgeht. Vorher war es immer als rechte Spalte
  // sichtbar — hat zuviel Platz im Builder gefressen für ein Detail-
  // Editing, das nur selten passiert.
  const [placementPropsOpen, setPlacementPropsOpen] = useState(false)
  // v7.9.73 / #170 — Tab in der Rack-Layout-Spalte: 2D-Panel-Ansicht
  // (default, identisch mit bisherigem Verhalten) vs. 3D-Orbit-Ansicht.
  const [viewTab, setViewTab] = useState<'2d' | '3d'>('2d')
  // v7.9.75 / #170 — Patch-Panel-Creation-Dialog.
  const [patchPanelDialogOpen, setPatchPanelDialogOpen] = useState(false)
  const [shelfDialogOpen, setShelfDialogOpen] = useState(false)
  // v7.9.80 / #170 — Non-Rack-Add-Dialog: Auswahl HE-Höhe vs. Shelf-Maße.
  const [nonRackDialog, setNonRackDialog] = useState<{
    template: EquipmentTemplate
    options?: { mountSide?: 'front' | 'rear' | 'full'; preferStartUnit?: number }
  } | null>(null)
  // v7.9.83 / #170 — WebGL-Refs vom 3D-Viewer für 3D/STL-Export (Export-Menu
  // selbst lebt in RackBuilderDialogExportMenu, #310).
  const canvas3DRefs = useRef<{
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
  } | null>(null)
  // v7.9.75 / #170 — View-Mode-Filter aus Issue-Kommentar 1:
  // 'all'      = alles sichtbar (Default)
  // 'free'     = nur freie Ports + Patchblenden + externe Patchfelder
  // 'released' = nur freigegebene Items (free + patch panels)
  const [renderMode, setRenderMode] = useState<'all' | 'free' | 'released'>('all')
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [dragState, setDragState] = useState<
    { placementId: string; offsetUnits: number; pointerId: number } | null
  >(null)
  const rackCanvasRef = useRef<HTMLDivElement | null>(null)

  // Crop-dialog state — same UX as EquipmentProperties: pick a file, the dialog
  // opens immediately so the user can position the panel inside the HE-aspect
  // crop frame before it's stored on the placement.
  const [cropDialog, setCropDialog] = useState<
    { placementId: string; side: 'front' | 'rear'; src: string } | null
  >(null)

  const { containerRef, containerStyle, headerProps } = useDraggablePosition(
    'cable-planner:modal-pos:rack-builder',
    open,
  )

  // Zoom multiplier on top of the auto-fit row height (1 = fit-to-width).
  const [zoom, setZoom] = useState(1)

  // Width + Height of one rack pane in pixels. Measured via ResizeObserver
  // damit der Rack responsiv schrumpft: wird das Dialog-Fenster kleiner,
  // wird auch der Rack kleiner statt zu scrollen.
  //
  // v7.9.10 — Auch die Höhe der verfügbaren Pane-Fläche berücksichtigen
  // (User-Request: "wenn das fenster klein ist, stelle doch auch das
  // rack klein dar. sonst muss man immer scrollen"). Vorher floss nur
  // die Breite in rowHeight ein → bei 42 HE & 30 px/HE = 1260 px hoch
  // → vertikaler Scroll. Jetzt nimmt rowHeight das Minimum aus
  // "Breiten-Fit" und "Höhen-Fit", sodass das Rack komplett in den
  // sichtbaren Bereich passt.
  const [paneWidth, setPaneWidth] = useState(0)
  const [paneHeight, setPaneHeight] = useState(0)
  // #509 / Layout — Breite der Bibliotheks-Spalte (per Splitter ziehbar,
  // persistiert). Wirkt erst ab md; darunter ist das Layout gestapelt.
  const [libraryColWidth, setLibraryColWidth] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.rackBuilderLibColV1)
      const n = raw ? parseInt(raw, 10) : NaN
      return Number.isFinite(n) ? clamp(n, 200, 520) : 260
    } catch {
      return 260
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.rackBuilderLibColV1, String(libraryColWidth))
    } catch {
      /* localStorage nicht verfügbar — Breite bleibt nur für diese Session */
    }
  }, [libraryColWidth])
  useEffect(() => {
    if (!open) return
    const el = rackCanvasRef.current
    if (!el) return
    const measure = () => {
      const cols = draft.viewMode === 'both' ? 2 : 1
      const gap = 8 // grid gap-2
      const padding = 8 * 2 // p-2 on inner side card
      const rect = el.getBoundingClientRect()
      const perPaneW = Math.max(0, (rect.width - (cols - 1) * gap) / cols - padding)
      setPaneWidth(perPaneW)
      // Verfügbare Höhe = Dialog-Viewport-Höhe minus Header/Properties
      // unten. Wir nutzen einen einfachen Heuristik: aktuelle Höhe der
      // rackCanvas-Wrapper-Box minus ~28 px für "Front"-Label
      // innerhalb des Panes.
      const perPaneH = Math.max(120, rect.height - 28)
      setPaneHeight(perPaneH)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // Auch bei window resize neu messen — manche Layout-Änderungen
    // landen nicht im ResizeObserver des Canvas-Refs.
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [open, draft.viewMode])

  // Derived row height in pixels. Falls back to a sensible default while the
  // ResizeObserver hasn't fired yet so the initial render isn't 0 px.
  // v7.7.0 — at zoom=1 the panel exactly fits paneWidth.
  // v7.9.10 — at zoom=1 the panel fits BOTH paneWidth and paneHeight.
  const rowHeight = useMemo(() => {
    if (paneWidth <= 0) return DEFAULT_ROW_HEIGHT
    const widthFit = paneWidth / RACK_PANEL_ASPECT_PER_1HE
    const heightFit = paneHeight > 0 ? paneHeight / Math.max(1, draft.totalUnits) : widthFit
    // Auto-fit = Minimum: damit das Rack in beide Dimensionen passt
    const autoFit = Math.min(widthFit, heightFit)
    return Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, autoFit * zoom))
  }, [paneWidth, paneHeight, draft.totalUnits, zoom])

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    // v7.9.0 / Issue #112 — Wenn showNonRack aktiv ist, zeigen wir ALLE
    // Templates an; sonst nur die als Rack-Gerät markierten. Beim
    // Hinzufügen eines nicht-rack-Templates fragen wir den User über
    // window.prompt nach der HE-Höhe, damit das Template danach für
    // alle zukünftigen Rack-Builds als Rack-Gerät zur Verfügung steht.
    const sorted = templates
      .filter((template) => showNonRack || template.isRackDevice || template.rackUnits)
      .slice()
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`))
    if (!q) return sorted
    return sorted.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(q))
  }, [query, templates, showNonRack])

  const selectedPlacement = useMemo(
    () => draft.placements.find((placement) => placement.id === selectedPlacementId) ?? null,
    [draft.placements, selectedPlacementId],
  )

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...templates.map((template) => template.category).filter(Boolean),
          ...draft.placements.map((placement) => placement.category).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [draft.placements, templates],
  )

  const draftSnapshot = useMemo(() => JSON.stringify(normalizeDraft(draft)), [draft])
  const dirty = draftSnapshot !== lastSavedSnapshot

  const isOverlapping = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    aStart <= bEnd && bStart <= aEnd

  // #521(d) — Zwei Geräte auf überlappenden HE-Bereichen kollidieren nur dann
  // TATSÄCHLICH, wenn sie sich auch in der TIEFE überschneiden. Ein 'front'-
  // und ein 'rear'-Gerät auf derselben HE sind benachbart (verschiedene Rail-
  // Tiefen, #170), KEINE Überdeckung. Default 'full' belegt beide Tiefen und
  // überlappt daher mit allem. Entschärft den Konflikt-Fehlalarm bei gültiger
  // Front/Rear-Doppelbelegung (z. B. Patchblende hinter einem Frontgerät).
  const mountsOverlapInDepth = (a: RackPlacementDraft, b: RackPlacementDraft): boolean => {
    const ma = a.mountSide ?? 'full'
    const mb = b.mountSide ?? 'full'
    return !((ma === 'front' && mb === 'rear') || (ma === 'rear' && mb === 'front'))
  }

  const conflicts = useMemo(() => {
    const issues: string[] = []
    for (const placement of draft.placements) {
      if (!placement.isRackDevice) {
        issues.push(
          format(t('rack.conflict.notRackDevice', '{name}: ist nicht als Rack-Gerät markiert.'), { name: placement.name }),
        )
      }
      if (placement.startUnit < 1) {
        issues.push(
          format(t('rack.conflict.startHe', '{name}: Start-HE muss >= 1 sein.'), { name: placement.name }),
        )
      }
      if (placement.startUnit + placement.rackUnits - 1 > draft.totalUnits) {
        issues.push(
          format(
            t('rack.conflict.doesNotFit', '{name}: {units} passt nicht ab HE {start} in {total}.'),
            {
              name: placement.name,
              units: formatRackUnits(placement.rackUnits),
              start: String(placement.startUnit),
              total: formatRackUnits(draft.totalUnits),
            },
          ),
        )
      }
    }
    for (let i = 0; i < draft.placements.length; i += 1) {
      for (let j = i + 1; j < draft.placements.length; j += 1) {
        const a = draft.placements[i]
        const b = draft.placements[j]
        if (
          isOverlapping(
            a.startUnit,
            a.startUnit + a.rackUnits - 1,
            b.startUnit,
            b.startUnit + b.rackUnits - 1,
          ) &&
          mountsOverlapInDepth(a, b)
        ) {
          issues.push(
            format(t('rack.conflict.overlaps', '{a} überlappt mit {b}.'), { a: a.name, b: b.name }),
          )
        }
      }
    }
    return issues
  }, [draft, t])

  useEffect(() => {
    if (!open) return
    // Edit mode: seed straight from the preset and skip the localStorage draft
    // so existing autosaves of an unrelated "new rack" don't leak in.
    if (initialPreset) {
      const seeded = normalizeDraft(draftFromPreset(initialPreset))
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft beim Dialog-Öffnen seeden (keyed sync)
      setDraft(seeded)
      setLastSavedSnapshot(JSON.stringify(seeded))
      setSelectedPlacementId(seeded.placements[0]?.id ?? null)
      return
    }
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) {
        setLastSavedSnapshot(JSON.stringify(normalizeDraft(draft)))
        return
      }
      const parsed = JSON.parse(raw) as RackDraft
      const normalized = normalizeDraft(parsed)
      setDraft(normalized)
      setLastSavedSnapshot(JSON.stringify(normalized))
      setSelectedPlacementId(normalized.placements[0]?.id ?? null)
    } catch {
      setLastSavedSnapshot(JSON.stringify(normalizeDraft(draft)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPreset])

  useEffect(() => {
    if (!open) return
    // In edit mode the dialog operates on a real saved preset — no need to
    // also persist a local autosave (would overwrite the "new rack" draft).
    if (initialPreset) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, draftSnapshot)
      } catch {
        /* ignore */
      }
    }, Math.max(100, autosaveIntervalMs || 400))
    return () => window.clearTimeout(timer)
  }, [autosaveIntervalMs, draftSnapshot, open, initialPreset])

  const closeWithConfirm = async () => {
    if (
      dirty &&
      !(await confirmDialog(t('rack.confirmDiscard.title', 'Ungespeicherte Rack-Änderungen verwerfen?'), {
        body: t('rack.confirmDiscard.body', 'Die Änderungen am Rack-Layout gehen verloren.'),
        okLabel: t('common.discard', 'Verwerfen'),
        destructive: true,
      }))
    )
      return
    onClose()
  }

  // v7.9.9 — Escape-Taste schliesst den Dialog (mit dirty-Confirm).
  // Nicht bindet wenn ein Sub-Dialog (Wire/Crop) offen ist — die haben
  // eigene Escape-Behandlung. NOTE: confirmDialog/promptDialog blocken
  // selber alle Tasten, daher kein extra Guard nötig.
  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (wireDialogOpen || cropDialog) return
      event.preventDefault()
      void closeWithConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wireDialogOpen, dirty])

  const addTemplate = async (
    template: EquipmentTemplate,
    options?: { mountSide?: 'front' | 'rear' | 'full'; preferStartUnit?: number },
  ) => {
    // v7.9.0 / Issue #112 — Wenn das Template (noch) nicht als 19"-
    // Rack-Gerät markiert ist, fragen wir den User nach der HE-Höhe
    // und markieren es im Draft entsprechend.
    // v7.9.13 — Zusätzlich: nach dem HE-Prompt fragen wir per
    // confirmDialog ob das Template auch PERMANENT (in der Library)
    // als Rack-Gerät markiert werden soll. Bei "Ja" greift
    // markTemplateAsRack und das Gerät erscheint künftig direkt unter
    // den Rack-Geräten ohne erneute HE-Abfrage.
    const effectiveTemplate = template
    if (!template.isRackDevice && !template.rackUnits) {
      // v7.9.80 / #170 — Statt einer simplen HE-Promptbox jetzt ein
      // richtiger Dialog mit zwei Pfaden: 19″-Rack-Gerät (HE) oder
      // Shelf-mounted (W/H/D in mm). Dialog stellt das Template asynchron
      // bereit; addTemplate kehrt hier zurück und der Dialog ruft später
      // selber wieder addTemplate auf — mit dem dimensionierten Template.
      setNonRackDialog({ template, options })
      return
    }
    const units = parseUnits(effectiveTemplate)
    let targetUnit = 1
    // v7.9.76 / #170 — Wenn der Caller eine bevorzugte Start-HE mitschickt
    // (z.B. Drag&Drop auf eine bestimmte Position im Rack), nehmen wir die,
    // andernfalls smart-search nach dem ersten freien Block von oben.
    if (
      typeof options?.preferStartUnit === 'number' &&
      options.preferStartUnit >= 1 &&
      options.preferStartUnit + units - 1 <= draft.totalUnits
    ) {
      targetUnit = options.preferStartUnit
    } else {
      const occupied = draft.placements
        .map((item) => ({ start: item.startUnit, end: item.startUnit + item.rackUnits - 1 }))
        .sort((a, b) => a.start - b.start)
      for (const block of occupied) {
        if (targetUnit + units - 1 < block.start) break
        targetUnit = block.end + 1
      }
      if (targetUnit + units - 1 > draft.totalUnits) {
        targetUnit = Math.max(1, draft.totalUnits - units + 1)
      }
    }
    const placement = toPlacement(effectiveTemplate, targetUnit)
    // v7.9.76 / #170 — Mount-Side direkt am Placement setzen falls der
    // Caller "vorne" oder "hinten" gewählt hat (Library-Quick-Button oder
    // Drag&Drop-Modifier). Default bleibt 'full' (= placement.mountSide
    // undefined, was die Box als full-depth rendert).
    if (options?.mountSide && options.mountSide !== 'full') {
      placement.mountSide = options.mountSide
    }
    setDraft((current) => ({ ...current, placements: [...current.placements, placement] }))
    setSelectedPlacementId(placement.id)
  }

  const updatePlacement = (id: string, patch: Partial<RackPlacementDraft>) => {
    setDraft((current) => ({
      ...current,
      placements: current.placements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const removePlacement = async (id: string) => {
    const item = draft.placements.find((p) => p.id === id)
    if (!item) return
    const ok = await confirmDialog(
      format(t('rack.confirmRemoveDevice.title', 'Gerät "{name}" aus Rack entfernen?'), { name: item.name }),
      {
        body: t(
          'rack.confirmRemoveDevice.body',
          'Position + Höhe gehen verloren. Internal-Cables an diesem Gerät werden ebenfalls entfernt.',
        ),
        okLabel: t('common.remove', 'Entfernen'),
        destructive: true,
      },
    )
    if (!ok) return
    setDraft((current) => ({
      ...current,
      placements: current.placements.filter((p) => p.id !== id),
      internalCables: current.internalCables.filter(
        (c) => c.fromPlacementId !== id && c.toPlacementId !== id,
      ),
    }))
    if (selectedPlacementId === id) setSelectedPlacementId(null)
  }

  const saveRack = () => {
    if (!draft.rackName.trim()) {
      setSaveError(t('rack.save.errNameRequired', 'Bitte Rack-Name angeben.'))
      rackNameInputRef.current?.focus()
      return
    }
    if (draft.placements.length === 0) {
      setSaveError(t('rack.save.errEmptyRack', 'Bitte mindestens ein Gerät ins Rack legen.'))
      return
    }
    // v7.9.73 / #170 (comment 2) — Konflikte (überlappende HE-Bereiche etc.)
    // werden als Warnung gezeigt, blockieren den Save aber nicht mehr.
    // Der User kann ein "kaputtes" Rack zwischenspeichern und später fixen.
    if (conflicts.length > 0) {
      setSaveError(
        `Rack hat Konflikte (wird trotzdem gespeichert):\n- ${conflicts.join('\n- ')}`,
      )
    } else {
      setSaveError(null)
    }

    const sorted = draft.placements.slice().sort((a, b) => a.startUnit - b.startUnit)

    const itemRecords: GroupPreset['items'] = sorted.map((placement) => ({
      name: placement.name,
      category: placement.category,
      inputs: placement.inputs,
      outputs: placement.outputs,
      isRackDevice: placement.isRackDevice,
      rackUnits: placement.rackUnits,
      frontPanelImageUrl: placement.frontPanelImageUrl,
      rearPanelImageUrl: placement.rearPanelImageUrl,
      frontPanelCrop: placement.frontPanelCrop,
      rearPanelCrop: placement.rearPanelCrop,
      // v7.9.73 / #170 — Engineering-Daten ans Item-Record durchreichen.
      depthMm: placement.depthMm,
      stlDataUri: placement.stlDataUri,
      // v7.9.75 / #170 — Patchblende-/Shelf-Marker persistieren.
      isPatchPanel: placement.isPatchPanel,
      isRackShelf: placement.isRackShelf,
      // #335 — Rentman-ID des Inhalts erhalten (nur wenn gesetzt).
      ...(placement.rentmanId ? { rentmanId: placement.rentmanId } : {}),
      width: 240,
      height: 80 + Math.max(placement.inputs.length, placement.outputs.length, 3) * 22,
      offsetX: 0,
      offsetY: (placement.startUnit - 1) * 44,
    }))

    const rackPlacements = sorted.map((placement, index) => ({
      itemIndex: index,
      startUnit: placement.startUnit,
      heightUnits: placement.rackUnits,
      // v7.9.73 / #170 — mountSide nur persistieren wenn explizit gesetzt.
      ...(placement.mountSide ? { mountSide: placement.mountSide } : {}),
      // #521 — Shelf-Offsets persistieren wenn GESETZT (auch 0!). Vorher ein
      // truthy-Check (`shelfOffsetX ? …`), der den gültigen Wert 0 (linke Kante
      // / Front) verwarf → X/Z-Position ging beim Speichern verloren. `!= null`
      // unterscheidet korrekt zwischen 0 (valide Position) und undefined.
      ...(placement.shelfOffsetX != null ? { shelfOffsetX: placement.shelfOffsetX } : {}),
      ...(placement.shelfOffsetZ != null ? { shelfOffsetZ: placement.shelfOffsetZ } : {}),
    }))

    // v7.8.5 — Map internal cables (referenced by placement id) onto the
    // post-sort item indices for the persisted preset. Cables whose
    // endpoints reference a placement that's been deleted are skipped.
    const placementIdToSortedIndex = new Map<string, number>()
    sorted.forEach((p, idx) => placementIdToSortedIndex.set(p.id, idx))
    const persistedCables: GroupPreset['cables'] = []
    for (const c of draft.internalCables) {
      const fromIdx = placementIdToSortedIndex.get(c.fromPlacementId)
      const toIdx = placementIdToSortedIndex.get(c.toPlacementId)
      if (fromIdx == null || toIdx == null) continue
      const entry: GroupPreset['cables'][number] = {
        fromItemIndex: fromIdx,
        fromPortName: c.fromPortName,
        toItemIndex: toIdx,
        toPortName: c.toPortName,
        name: c.name,
        type: c.type,
        length: c.length,
      }
      if (c.color != null) entry.color = c.color
      if (c.standard != null) entry.standard = c.standard
      // v7.9.115 / Issue #223 — User-Waypoints im Preset persistieren
      // damit Kabel-Positionen ueber Save/Reload erhalten bleiben.
      if (c.waypoints && c.waypoints.length > 0) {
        entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
      }
      persistedCables.push(entry)
    }

    // v7.9.14 — Persistente Canvas-Positionen für den
    // RackInternalCanvas. Nur Geräte mit User-gesetzten Positionen
    // landen hier; andere bleiben beim nächsten Öffnen auf der
    // Default-Position aus startUnit.
    const internalCanvasPositions: Record<number, { x: number; y: number }> = {}
    sorted.forEach((placement, index) => {
      if (placement.canvasX != null && placement.canvasY != null) {
        internalCanvasPositions[index] = { x: placement.canvasX, y: placement.canvasY }
      }
    })
    const hasPositions = Object.keys(internalCanvasPositions).length > 0

    const preset: GroupPreset = {
      id: editingId ?? uuidv4(),
      name: draft.rackName.trim(),
      rack: {
        totalUnits: draft.totalUnits,
        // #335 — Kombi-ID des Racks erhalten (nur wenn aus Rentman-Import).
        ...(draft.rentmanId ? { rentmanId: draft.rentmanId } : {}),
        // v7.9.73 / #170 — Rack-Tiefe nur persistieren wenn vom User gesetzt.
        ...(draft.depthMm ? { depthMm: draft.depthMm } : {}),
        placements: rackPlacements,
        ...(hasPositions ? { internalCanvasPositions } : {}),
      },
      items: itemRecords,
      cables: persistedCables,
    }

    onSave(preset)
    setLastSavedSnapshot(draftSnapshot)
    if (!editingId) {
      try {
        localStorage.setItem(DRAFT_KEY, draftSnapshot)
      } catch {
        /* ignore */
      }
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-2 sm:p-6">
      <div
        ref={containerRef}
        style={containerStyle}
        // v7.9.2 — responsive: kein fixes 1400px max-width, sondern
        // 100vw mit Padding. Verhindert horizontal-Scroll auf Laptops.
        className="flex max-h-[96vh] w-[min(1400px,calc(100vw-1rem))] flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 p-3 text-cp-text shadow-2xl sm:p-4"
      >
        <RackBuilderHeader
          editingId={editingId}
          rackName={draft.rackName}
          dirty={dirty}
          headerProps={headerProps}
          onClose={closeWithConfirm}
          exportMenuSlot={
            <RackBuilderDialogExportMenu
              rackName={draft.rackName}
              totalUnits={draft.totalUnits}
              depthMm={draft.depthMm}
              placements={draft.placements}
              editingId={editingId}
              rackCanvasRef={rackCanvasRef}
              canvas3DRefs={canvas3DRefs}
            />
          }
        />

        {/* Layout-Shell — fixer Header (oben) + fixer Footer mit Speichern
            (unten), NUR dieser Body scrollt. Vorher steckte alles in einem
            overflow-auto → auf kurzen Fenstern scrollte der ganze Dialog und
            der Speichern-Button lag unter der Falz. -mx/px hebt das p-3/sm:p-4
            des Containers auf, damit der Scrollbalken am Rand sitzt. */}
        <div className="-mx-3 min-h-0 flex-1 overflow-auto px-3 sm:-mx-4 sm:px-4">

        {/* v7.9.11 — Control-Bar mit gewichteten Spalten. Name (Pflichtfeld
            + längster Inhalt) bekommt 2 Spalten, Höhe + Ansicht + Zoom je 1.
            Zoom hat jetzt explizite +/- Buttons für Tastatur/Maus-User. */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="block text-cp-xs font-medium text-cp-text-secondary lg:col-span-2">
            {t('rack.field.name', 'Rack-Name')} *
            <input
              ref={rackNameInputRef}
              value={draft.rackName}
              onChange={(event) => {
                if (saveError) setSaveError(null)
                setDraft((current) => ({ ...current, rackName: event.target.value }))
              }}
              aria-required="true"
              aria-invalid={!draft.rackName.trim() && !!saveError}
              placeholder={t('rack.field.namePlaceholder', 'z.B. "Power Rack A" oder "Main Video Rack"')}
              className={`mt-1 w-full rounded border bg-cp-surface-3 px-2.5 py-1.5 text-cp-base font-normal text-cp-text placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                !draft.rackName.trim() && saveError
                  ? 'border-red-600 ring-1 ring-red-600/40'
                  : 'border-cp-border'
              }`}
            />
          </label>
          <label className="block text-cp-xs font-medium text-cp-text-secondary">
            {t('rack.field.height', 'Höhe')} <span className="text-cp-text-faint">(HE)</span>
            <input
              type="number"
              min={1}
              max={LIMITS.MAX_RACK_HEIGHT_HE}
              value={draft.totalUnits}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  totalUnits: Math.max(1, Math.min(LIMITS.MAX_RACK_HEIGHT_HE, Number(event.target.value) || 1)),
                }))
              }
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 px-2.5 py-1.5 text-cp-base font-normal text-cp-text focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          {/* v7.9.73 / #170 — Rack-Tiefe in mm. Wird vom 3D-Builder genutzt
              um zu prüfen ob hinten noch Platz für Patchblenden ist. */}
          <label className="block text-cp-xs font-medium text-cp-text-secondary">
            {t('rack.field.depth', 'Tiefe')} <span className="text-cp-text-faint">(mm)</span>
            <input
              type="number"
              min={200}
              max={1500}
              step={50}
              value={draft.depthMm ?? 800}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  depthMm: Math.max(200, Math.min(1500, Number(event.target.value) || 800)),
                }))
              }
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 px-2.5 py-1.5 text-cp-base font-normal text-cp-text focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              title={t('rack.depthTitle', 'Rack-Tiefe in mm. Standard: 800 mm. Gängige Werte: 350/450/600/800/1000/1200.')}
            />
          </label>
        </div>

        <RackConflictBadges
          conflicts={conflicts}
          saveError={saveError}
          onDismissSaveError={() => setSaveError(null)}
        />

        {/* v7.9.2 — responsiver: 1-Spalter bis md, 2-Spalter md (Library
            + Rack), 3-Spalter ab xl. Verhindert horizontal-Overflow. */}
        {/* Layout — responsives 3-Spalten-Grid (Bibliothek | Rack | Properties).
            Bibliotheks-Spalte ist per Splitter ziehbar (--lib-col). minmax(0,1fr)
            lässt die Rack-Spalte echt schrumpfen (sonst Overflow bei schmal).
            3 Spalten schon ab lg (statt xl), damit Laptops alle Panels sehen. */}
        <div
          style={{ '--lib-col': `${libraryColWidth}px` } as CSSProperties}
          className="grid grid-cols-1 gap-3 md:grid-cols-[var(--lib-col)_minmax(0,1fr)] lg:grid-cols-[var(--lib-col)_minmax(0,1fr)_300px]"
        >
          <div className="relative rounded border border-cp-border bg-cp-surface-3/50 p-2">
            {/* v7.9.11 — Library-Header mit Counter, dann Search-Input
                mit Magnifier-Icon + Clear-Button für bessere Affordance. */}
            <div className="mb-2 flex items-center justify-between">
              <div className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                {t('library.title', 'Library')}
              </div>
              <span className="rounded bg-cp-surface-2 px-1.5 py-0.5 text-[10px] text-cp-text-muted">
                {filteredTemplates.length} / {templates.length}
              </span>
            </div>
            {/* v7.9.75 / #170 — Schnellzugriff: Patchblende anlegen.
                Erzeugt ein EquipmentTemplate mit isPatchPanel=true und
                schickt es durch addTemplate, sodass es genau wie eine
                normale 19"-Komponente platziert wird (smart startUnit,
                Properties-Panel, internal-Cables). */}
            <div className="mb-2 grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setPatchPanelDialogOpen(true)}
                className="rounded border border-amber-700 bg-amber-900/30 px-2 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/50"
                title={t('rack.patchPanelTitle', 'Neue Patchblende anlegen: Höhe, Port-Count, Connector-Typ')}
              >
                {t('rack.patchPanelBtn', '+ Patchblende')}
              </button>
              <button
                type="button"
                onClick={() => setShelfDialogOpen(true)}
                className="rounded border border-emerald-700 bg-emerald-900/30 px-2 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/50"
                title={t('rack.shelfTitle', 'Rack-Shelf für Non-19"-Gear anlegen')}
              >
                {t('rack.shelfBtn', '+ Rack-Shelf')}
              </button>
            </div>
            <div className="relative mb-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-cp-text-faint"
              >
                <circle cx="7" cy="7" r="4" />
                <path d="M10.5 10.5 L14 14" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('rack.searchDevicesPlaceholder', 'Gerät suchen…')}
                aria-label={t('rack.searchDevicesPlaceholder', 'Gerät suchen…')}
                className="w-full rounded border border-cp-border bg-cp-surface-3 pl-7 pr-7 py-1.5 text-cp-xs placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  title={t('library.search.clear', 'Suche löschen')}
                  aria-label={t('library.search.clear', 'Suche löschen')}
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-cp-text-faint hover:bg-cp-surface-2 hover:text-cp-text-bright"
                >
                  ×
                </button>
              )}
            </div>
            <label
              className="mb-2 flex items-center gap-1.5 text-[10px] text-cp-text-muted"
              title={t(
                'rack.showNonRackTitle',
                'Wenn aktiv, werden auch Templates angezeigt die nicht als 19"-Rack-Gerät markiert sind. Beim Hinzufügen wirst du nach der HE-Höhe gefragt.',
              )}
            >
              <input
                type="checkbox"
                checked={showNonRack}
                onChange={(e) => setShowNonRack(e.target.checked)}
                className="accent-sky-500"
              />
              <span>{t('rack.showNonRack', 'Auch Nicht-Rack-Geräte')}</span>
            </label>
            <div className="max-h-[58vh] space-y-1 overflow-auto">
              {filteredTemplates.length === 0 && (
                <div className="rounded border border-dashed border-cp-border bg-cp-surface-3/40 p-4 text-center text-[11px] text-cp-text-muted">
                  {query ? (
                    <>
                      {t('rack.noMatchesPre', 'Keine Treffer für')}{' '}
                      <strong className="text-cp-text-secondary">"{query}"</strong>.
                    </>
                  ) : (
                    <>
                      {t('rack.noRackDevices', 'Keine Rack-Geräte verfügbar.')}{' '}
                      <span className="text-cp-text-muted">
                        "{t('rack.showNonRack', 'Auch Nicht-Rack-Geräte')}"
                      </span>{' '}
                      {t('rack.activatePrompt', 'aktivieren?')}
                    </>
                  )}
                </div>
              )}
              {filteredTemplates.map((template) => {
                const isRack = template.isRackDevice || !!template.rackUnits
                // v7.9.9 — "Bereits im Rack"-Marker. Mehrfachzuweisung
                // bleibt erlaubt (Stage-Setups haben oft mehrere
                // identische Geräte) aber der User sieht jetzt sofort
                // wie oft das Template schon platziert ist.
                const placedCount = draft.placements.filter(
                  (p) => p.templateName === template.name,
                ).length
                return (
                  <div
                    key={template.name}
                    // v7.9.76 / #170 — Library-Card ist jetzt draggable.
                    // Drop-Target ist die Rack-Canvas-Div (2D) bzw. die
                    // 3D-Canvas-Wrapper-Div. Beim Drop wird targetStartUnit
                    // aus der Drop-Y-Position errechnet und an addTemplate
                    // weitergegeben.
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy'
                      event.dataTransfer.setData(
                        'application/x-cable-planner-rack-template',
                        JSON.stringify({ name: template.name }),
                      )
                    }}
                    className={`group rounded border p-2 text-cp-xs transition-colors ${
                      isRack
                        ? 'cursor-grab border-cp-border-muted bg-cp-surface-1/60 hover:border-cp-surface-5 hover:bg-cp-surface-1 active:cursor-grabbing'
                        : 'cursor-grab border-amber-800/40 bg-amber-950/20 hover:border-amber-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start gap-x-1 gap-y-0.5">
                          {/* #509 — Name bricht in weitere Zeilen um statt mit
                              … abzuschneiden (min-w-0 + break-words lassen den
                              Flex-Text wirklich umbrechen). */}
                          <span className="min-w-0 break-words font-medium leading-snug text-cp-text">{template.name}</span>
                          {placedCount > 0 && (
                            <span
                              className="shrink-0 rounded bg-emerald-800/70 px-1 text-[8px] font-semibold uppercase text-emerald-200"
                              title={format(t('rack.placedCountTitle', '{count}× im Rack platziert'), { count: placedCount })}
                            >
                              ✓ {placedCount}×
                            </span>
                          )}
                          {!isRack && (
                            <span
                              className="shrink-0 rounded bg-amber-800/60 px-1 text-[8px] font-semibold uppercase text-amber-200"
                              title={t('rack.notRackTitle', 'Nicht als 19"-Rack-Gerät markiert — wird beim Hinzufügen abgefragt.')}
                            >
                              No-HE
                            </span>
                          )}
                        </div>
                        <div className="break-words text-[10px] text-cp-text-muted">{template.category}</div>
                      </div>
                      {/* v7.9.80 / #170 — Split-Button: Hauptaktion
                          "+ Hinzufügen" (Default = full-depth) + kleines
                          ▾ Chevron das die alternativen Mount-Optionen
                          (Vorne / Hinten) zeigt. Cleanere Hierarchie als
                          drei gleichberechtigte Buttons. */}
                      <RackAddSplitButton
                        onAddFull={() => void addTemplate(template, { mountSide: 'full' })}
                        onAddFront={() => void addTemplate(template, { mountSide: 'front' })}
                        onAddRear={() => void addTemplate(template, { mountSide: 'rear' })}
                        primaryLabel={placedCount > 0 ? t('rack.addMore', '+ Weitere') : t('rack.addToRack', '+ Ins Rack')}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-cp-text-muted">
                      {isRack ? `${parseUnits(template)} HE · ` : 'HE ? · '}
                      {template.inputs.length} In · {template.outputs.length} Out
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Layout — Splitter zum Verbreitern/Verschmälern der Bibliotheks-
                Spalte. Nur ab md sichtbar (darunter ist alles gestapelt). */}
            <div className="absolute inset-y-0 right-0 hidden md:block">
              <Splitter side="left" onResize={(d) => setLibraryColWidth((w) => clamp(w + d, 200, 520))} />
            </div>
          </div>

          <div className="min-w-0 rounded border border-cp-border bg-cp-surface-3/50 p-2">
            {/* v7.9.11 — Rack-Header mit Live-HE-Belegung + Drag-Hint. */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
                  {t('rack.layout', 'Rack-Layout')}
                </div>
                {/* v7.9.73 / #170 — 2D/3D Tab-Toggle. 2D ist der bestehende
                    Front/Rear-Panel-Editor; 3D ist die neue Orbit-Ansicht
                    auf Basis von react-three-fiber. */}
                <div className="ml-2 inline-flex overflow-hidden rounded-cp-control border border-cp-border text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setViewTab('2d')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 ${
                      viewTab === '2d'
                        ? 'bg-sky-600 text-white'
                        : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                    }`}
                    title={t('rack.tab2dTitle', '2D-Editor: Vorderseite/Rückseite als Panel-Ansichten')}
                  >
                    <Icon icon={Square} size="xs" /> 2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('3d')}
                    className={`inline-flex items-center gap-1 border-l border-cp-border px-2.5 py-1 ${
                      viewTab === '3d'
                        ? 'bg-purple-600 text-white'
                        : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
                    }`}
                    title={t('rack.tab3dTitle', '3D-Visualisierung mit Front/Rear-Tiefe und Rotation. Nur-Lesen — bearbeitet wird im 2D-Tab.')}
                  >
                    <Icon icon={Box} size="xs" /> 3D
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom — direkt an der Rack-Ansicht statt im Kopf-Grid; intuitiver
                    Stepper (−/Prozent/+/Einpassen) statt Slider. Nur im 2D-Tab,
                    weil 3D per Orbit/Scroll zoomt. Klick aufs Prozent = Auto-Fit. */}
                {viewTab === '2d' && (
                  <div className="flex items-center gap-0.5 rounded-cp-control border border-cp-border bg-cp-surface-1/60 p-0.5 text-cp-text-secondary">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-cp-surface-2"
                      title={t('rack.zoomOut', 'Verkleinern')}
                      aria-label={t('rack.zoomOut', 'Verkleinern')}
                    >
                      <Icon icon={Minus} size="xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="min-w-[2.75rem] rounded px-1 text-center text-[11px] tabular-nums hover:bg-cp-surface-2"
                      title={t('rack.zoomFitTitle', 'Auf 100 % zurück (Auto-Fit)')}
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-cp-surface-2"
                      title={t('rack.zoomIn', 'Vergrößern')}
                      aria-label={t('rack.zoomIn', 'Vergrößern')}
                    >
                      <Icon icon={Plus} size="xs" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(1)}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-cp-surface-2"
                      title={t('rack.zoomFit', 'Einpassen (Auto-Fit)')}
                      aria-label={t('rack.zoomFit', 'Einpassen')}
                    >
                      <Icon icon={Maximize2} size="xs" />
                    </button>
                  </div>
                )}
                <div className="hidden items-center gap-1.5 text-[10px] text-cp-text-muted sm:flex">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2 L8 14 M5 5 L8 2 L11 5 M5 11 L8 14 L11 11" />
                  </svg>
                  <span>Drag &amp; Drop</span>
                </div>
              </div>
            </div>
            {draft.placements.length === 0 && (
              <div className="rounded border border-dashed border-cp-border bg-cp-surface-3/40 p-8 text-center text-cp-xs text-cp-text-faint">
                <div className="mb-2 text-3xl">▥</div>
                <div className="mb-1 font-semibold text-cp-text-secondary">{t('rack.empty', 'Rack ist leer')}</div>
                <div>{t('rack.addFromLibraryHint', 'Geräte aus der Library links hinzufügen (Button "+ Rack").')}</div>
                <div className="mt-2 text-[10px]">
                  {t('rack.tipPrefix', 'Tipp:')}{' '}
                  <span className="text-cp-text-muted">"{t('rack.showNonRack', 'Auch Nicht-Rack-Geräte')}"</span>{' '}
                  {t('rack.tipBody', 'aktivieren wenn das Wunschgerät fehlt.')}
                </div>
              </div>
            )}
            {viewTab === '3d' && (
              <RackBuilder3DTab
                totalUnits={draft.totalUnits}
                rackDepthMm={draft.depthMm}
                placements={draft.placements}
                internalCables={draft.internalCables}
                templates={templates}
                selectedPlacementId={selectedPlacementId}
                renderMode={renderMode}
                showSymbols={showConnectorSymbols}
                onSelectPlacement={setSelectedPlacementId}
                onSetRenderMode={setRenderMode}
                onCanvasRefsReady={(refs) => {
                  canvas3DRefs.current = refs
                }}
                onShelfDeviceMoved={(placementId, offset) => {
                  updatePlacement(placementId, {
                    shelfOffsetX: offset.x,
                    shelfOffsetZ: offset.z,
                  })
                }}
                onPortMoved={(placementId, portId, side, pos) => {
                  setDraft((current) => ({
                    ...current,
                    placements: current.placements.map((p) => {
                      if (p.id !== placementId) return p
                      const key = side === 'front' ? 'inputs' : 'outputs'
                      return {
                        ...p,
                        [key]: p[key].map((port) =>
                          port.id === portId
                            ? { ...port, panelPosX: pos.x, panelPosY: pos.y }
                            : port,
                        ),
                      }
                    }),
                  }))
                }}
                onTemplateDropped={(template, mount) => {
                  void addTemplate(template, { mountSide: mount })
                }}
              />
            )}
            {/* v7.9.80 / #170 — Front/Rear/Both-Toggle ist jetzt Teil der
                2D-Rack-Spalte (war vorher als Select im Header). */}
            {viewTab === '2d' && (
              <div className="mb-2 flex overflow-hidden rounded-cp-control border border-cp-border text-[11px]">
                {([
                  ['front', t('rack.viewMode.front', 'Vorne'), RectangleVertical],
                  ['rear', t('rack.viewMode.rear', 'Hinten'), FlipHorizontal2],
                  ['both', t('rack.viewMode.both', 'Beide'), Columns2],
                  ['side', t('rack.viewMode.side', 'Seite'), GalleryVerticalEnd],
                ] as const).map(([mode, label, icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((cur) => ({ ...cur, viewMode: mode }))}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 font-medium transition ${
                      draft.viewMode === mode
                        ? 'bg-sky-600 text-white'
                        : 'bg-cp-surface-1/50 text-cp-text-muted hover:bg-cp-surface-2/60'
                    }`}
                    aria-pressed={draft.viewMode === mode}
                    title={label}
                  >
                    <Icon icon={icon} size="xs" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            {/* #472 — Steckverbinder-Symbole im 2D- UND 3D-Rack ein-/ausblenden. */}
            {(viewTab === '2d' || viewTab === '3d') && (
              <label className="mb-2 flex cursor-pointer items-center gap-1.5 text-[11px] text-cp-text-secondary">
                <input
                  type="checkbox"
                  checked={showConnectorSymbols}
                  onChange={(e) => setShowConnectorSymbols(e.target.checked)}
                />
                {t('rack.showConnectorSymbols', 'Stecker-Symbole zeigen')}
              </label>
            )}
            {/* v7.9.10 — max-h begrenzt den Rack-Canvas auf die
                Viewport-Höhe minus Header/Footer; in Kombi mit dem
                neuen height-fit in rowHeight passt sich das Rack
                automatisch dem sichtbaren Bereich an.
                v7.9.73 / #170 — nur zeigen wenn Tab='2d'. */}
            <div
              ref={rackCanvasRef}
              className={`grid gap-2 overflow-auto ${draft.viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'} ${viewTab === '3d' ? 'hidden' : ''}`}
              style={{ maxHeight: 'min(75vh, 800px)' }}
            >
              {/* v7.9.87 / #208 — 'side' mode: rendere ein einzelnes Side-
                  Panel (Tiefenansicht). Front/Rear/Both Modi laufen wie
                  vorher. */}
              {draft.viewMode === 'side' && (
                <div className="rounded border border-cp-border-muted bg-cp-surface-3 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#0ea5e9' }} />
                      Seitenansicht (Tiefe)
                    </span>
                    <span className="text-[10px] text-cp-text-muted">
                      Vorne ◀ {draft.depthMm ?? 800} mm ▶ Hinten
                    </span>
                  </div>
                  {(() => {
                    const depthMm = draft.depthMm ?? 800
                    const sideWidthPx = rowHeight * RACK_PANEL_ASPECT_PER_1HE
                    const sidePxPerMm = sideWidthPx / depthMm
                    return (
                      <div
                        className="relative mx-auto overflow-hidden rounded border border-cp-border bg-cp-surface-1"
                        style={{ width: sideWidthPx, height: draft.totalUnits * rowHeight }}
                      >
                        {/* HE-Grid */}
                        {Array.from({ length: draft.totalUnits }).map((_, idx) => {
                          const unit = idx + 1
                          return (
                            <div
                              key={`side-grid-${unit}`}
                              className="absolute left-0 right-0 border-t border-cp-border-muted/80"
                              style={{ top: idx * rowHeight, height: rowHeight }}
                            >
                              <span className="absolute left-1 top-0.5 text-[9px] text-cp-text-muted">U{unit}</span>
                            </div>
                          )
                        })}
                        {/* Front + Rear Rail-Markierungen */}
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-green-700/60" title={t('rack.frontRail', 'Front-Rail')} />
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-0.5 bg-purple-700/60" title={t('rack.rearRail', 'Rear-Rail')} />
                        {/* Placements als horizontale Streifen (Front-of-Box bis Rear-of-Box) */}
                        {draft.placements.map((item) => {
                          const top = (item.startUnit - 1) * rowHeight
                          const height = item.rackUnits * rowHeight - 1
                          const tpl = templates.find((t) => t.name === item.templateName)
                          const devDepthMm = item.depthMm ?? tpl?.depthMm ?? 400
                          const mount = item.mountSide ?? 'full'
                          // zStart in der Rack-Welt (0 = Front, depthMm = Rear)
                          const zStart = mount === 'rear'
                            ? depthMm - devDepthMm
                            : (item.shelfOffsetZ ?? 0)
                          const leftPx = zStart * sidePxPerMm
                          const widthPx = devDepthMm * sidePxPerMm
                          const isSelected = selectedPlacementId === item.id
                          const colorClass = mount === 'rear'
                            ? 'border-purple-500 bg-purple-900/40'
                            : mount === 'front'
                              ? 'border-green-500 bg-green-900/40'
                              : 'border-slate-500 bg-cp-surface-4/40'
                          return (
                            <div
                              key={`side-block-${item.id}`}
                              onClick={() => setSelectedPlacementId(item.id)}
                              className={`absolute cursor-pointer overflow-hidden rounded border-2 text-[9px] text-white transition ${
                                isSelected ? 'border-amber-300 ring-1 ring-amber-400/40' : colorClass
                              }`}
                              style={{ top, height, left: leftPx, width: widthPx }}
                              title={`${item.name} (${item.rackUnits} HE, Tiefe ${devDepthMm} mm, Mount ${mount})`}
                            >
                              <div className="px-1 py-0.5 truncate">{item.name}</div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
              {draft.viewMode !== 'side' && (draft.viewMode === 'both' ? ['front', 'rear'] : [draft.viewMode]).map((side) => (
                <div key={side} className="rounded border border-cp-border-muted bg-cp-surface-3 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        side === 'front'
                          ? 'bg-sky-900/50 text-sky-200'
                          : 'bg-purple-900/50 text-purple-200'
                      }`}
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: side === 'front' ? '#38bdf8' : '#a855f7' }}
                      />
                      {side === 'front' ? t('rack.viewMode.front', 'Vorne') : t('rack.viewMode.rear', 'Hinten')}
                    </span>
                  </div>
                  <div
                    className="relative mx-auto overflow-hidden rounded border border-cp-border bg-cp-surface-1"
                    // Lock the panel width to the 19"-rack aspect so the rows
                    // always look correct, even in single-side view where the
                    // grid would otherwise stretch the panel to the full pane
                    // width once rowHeight hits MAX_ROW_HEIGHT.
                    style={{
                      width: rowHeight * RACK_PANEL_ASPECT_PER_1HE,
                      height: draft.totalUnits * rowHeight,
                    }}
                    // v7.9.76 / #170 — Drag&Drop von Library-Cards auf
                    // diese Panel-Seite. Drop-Y → Start-HE, Panel-Seite
                    // (front/rear) → mountSide. Wenn viewMode='both' und
                    // der User auf die linke Seite droppt → front, rechts
                    // → rear. Bei single-side wird die aktive Seite genommen.
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes(
                        'application/x-cable-planner-rack-template',
                      )) {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'copy'
                      }
                    }}
                    onDrop={(event) => {
                      const raw = event.dataTransfer.getData(
                        'application/x-cable-planner-rack-template',
                      )
                      if (!raw) return
                      event.preventDefault()
                      try {
                        const parsed = JSON.parse(raw) as { name: string }
                        const template = templates.find((t) => t.name === parsed.name)
                        if (!template) return
                        const host = event.currentTarget.getBoundingClientRect()
                        const y = clamp(event.clientY - host.top, 0, host.height)
                        const dropUnit = Math.max(
                          1,
                          Math.min(draft.totalUnits, Math.floor(y / rowHeight) + 1),
                        )
                        const mount: 'front' | 'rear' | 'full' =
                          side === 'front' ? 'front' : 'rear'
                        void addTemplate(template, { mountSide: mount, preferStartUnit: dropUnit })
                      } catch {
                        /* ignore malformed drop payload */
                      }
                    }}
                    onPointerMove={(event) => {
                      if (!dragState || dragState.pointerId !== event.pointerId) return
                      const host = event.currentTarget.getBoundingClientRect()
                      const y = clamp(event.clientY - host.top, 0, host.height)
                      // #521(b) — Alt gedrückt = freie (Off-Grid-)Höhe; sonst rastet
                      // die HE-Position ganzzahlig ein (Backward-Compat, unverändert).
                      const unitAtPointer = event.altKey
                        ? Math.max(1, Math.min(draft.totalUnits, y / rowHeight + 1))
                        : Math.max(1, Math.min(draft.totalUnits, Math.floor(y / rowHeight) + 1))
                      const placement = draft.placements.find((p) => p.id === dragState.placementId)
                      if (!placement) return
                      const rawStart = Math.max(1, Math.min(draft.totalUnits - placement.rackUnits + 1, unitAtPointer - dragState.offsetUnits))
                      const nextStart = event.altKey ? Math.round(rawStart * 100) / 100 : rawStart
                      updatePlacement(placement.id, { startUnit: nextStart })
                    }}
                    onPointerUp={() => setDragState(null)}
                  >
                    {Array.from({ length: draft.totalUnits }).map((_row, index) => {
                      const unit = index + 1
                      return (
                        <div
                          key={`${side}-grid-${unit}`}
                          className="absolute left-0 right-0 border-t border-cp-border-muted/80"
                          style={{ top: index * rowHeight, height: rowHeight }}
                        >
                          <span className="absolute left-1 top-0.5 text-[9px] text-cp-text-muted">U{unit}</span>
                        </div>
                      )
                    })}

                    {draft.placements.map((item) => {
                      const top = (item.startUnit - 1) * rowHeight
                      const height = item.rackUnits * rowHeight
                      const image = side === 'front' ? item.frontPanelImageUrl : item.rearPanelImageUrl
                      // v7.9.82 / #170 — Shelf-Device-Rendering: nutze die
                      // physischen mm-Maße (widthMm) + shelfOffsetX statt
                      // der vollen HE-Breite. Mapping: 1 mm = (rackWidthPx /
                      // RACK_MOUNT_WIDTH_MM). Klassische 19″-Geräte:
                      // full-width wie bisher (left:0, right:0).
                      const rackTpl = templates.find((t) => t.name === item.templateName)
                      const isShelfDevice = !!(rackTpl?.widthMm && rackTpl?.heightMm)
                      const rackWidthPx = rowHeight * RACK_PANEL_ASPECT_PER_1HE
                      const mmToPx = rackWidthPx / RACK_OUTER_WIDTH_MM
                      const railInsetPx = ((RACK_OUTER_WIDTH_MM - RACK_MOUNT_WIDTH_MM) / 2) * mmToPx
                      // v7.9.87 / #204 — In der Rear-Ansicht ist links/rechts
                      // perspektivisch GESPIEGELT zu vorne (User guckt von
                      // hinten aufs Rack). Ein Shelf-Device mit shelfOffsetX=
                      // "10 mm vom linken Rail" muss in der Rear-Ansicht
                      // als "10 mm vom RECHTEN Rail" rendern, damit der
                      // physische Punkt im Rack identisch bleibt.
                      const effectiveOffsetX = item.shelfOffsetX ?? 0
                      const maxOffsetX = (rackTpl?.widthMm ?? 0)
                        ? Math.max(0, RACK_MOUNT_WIDTH_MM - (rackTpl?.widthMm ?? 0))
                        : 0
                      const renderedOffsetX = side === 'rear'
                        ? maxOffsetX - effectiveOffsetX
                        : effectiveOffsetX
                      // #506 — Shelf-Device unten-bündig rendern (wie im 3D: das
                      // Gerät ruht auf dem Boden seiner HE-Reihe). Vorher war es
                      // oben-bündig, was nicht zur 3D-Ansicht passte.
                      // #510 — NUR dereferenzieren wenn isShelfDevice (dann ist
                      // rackTpl garantiert gesetzt, s. Definition oben). Sonst ist
                      // rackTpl ggf. undefined (Placement referenziert ein Template
                      // das NICHT in `templates` liegt: frisch erstelltes Rack-Shelf,
                      // nicht-persistiertes Shelf-Device, oder veralteter Draft) —
                      // ein unbedingter `rackTpl!.heightMm!` warf dann
                      // "Cannot read properties of undefined (reading 'heightMm')".
                      const shelfBoxHeight = isShelfDevice
                        ? Math.min(rackTpl!.heightMm! * mmToPx, height)
                        : height
                      const shelfStyle = isShelfDevice
                        ? {
                            top: top + (height - shelfBoxHeight),
                            height: shelfBoxHeight,
                            left: railInsetPx + renderedOffsetX * mmToPx,
                            width: rackTpl!.widthMm! * mmToPx,
                          }
                        : { top, height, left: 0, right: 0 }
                      return (
                        <div
                          key={`${side}-block-${item.id}`}
                          className={`absolute cursor-grab touch-none select-none overflow-hidden rounded border-2 active:cursor-grabbing ${
                            selectedPlacementId === item.id
                              ? 'border-amber-300 bg-amber-900/40 shadow-[0_0_0_2px_rgba(252,211,77,0.45)] ring-1 ring-amber-400/40'
                              : isShelfDevice
                                ? 'border-emerald-600/70 bg-emerald-900/30 hover:border-emerald-400/80'
                                : 'border-sky-600/70 bg-sky-900/30 hover:border-sky-400/80 hover:bg-sky-900/40'
                          }`}
                          style={shelfStyle}
                          title={`${item.name} (${item.rackUnits} HE, Start HE${item.startUnit}${isShelfDevice ? `, Shelf-Device ${rackTpl!.widthMm}×${rackTpl!.heightMm} mm` : ''})`}
                          onPointerDown={(event) => {
                            // Capture so onPointerMove fires reliably even
                            // when the cursor leaves the small block.
                            event.preventDefault()
                            event.stopPropagation()
                            event.currentTarget.setPointerCapture?.(event.pointerId)
                            const host = event.currentTarget.parentElement?.getBoundingClientRect()
                            if (!host) return
                            const pointerUnit = Math.max(1, Math.min(draft.totalUnits, Math.floor((event.clientY - host.top) / rowHeight) + 1))
                            setSelectedPlacementId(item.id)
                            setDragState({ placementId: item.id, offsetUnits: pointerUnit - item.startUnit, pointerId: event.pointerId })
                          }}
                          onPointerMove={(event) => {
                            if (!dragState || dragState.pointerId !== event.pointerId) return
                            const host = event.currentTarget.parentElement?.getBoundingClientRect()
                            if (!host) return
                            const y = clamp(event.clientY - host.top, 0, host.height)
                            // #521(b) — Alt = freie (Off-Grid-)Höhe; sonst ganzzahlig (unverändert).
                            const unitAtPointer = event.altKey
                              ? Math.max(1, Math.min(draft.totalUnits, y / rowHeight + 1))
                              : Math.max(1, Math.min(draft.totalUnits, Math.floor(y / rowHeight) + 1))
                            const placement = draft.placements.find((p) => p.id === dragState.placementId)
                            if (!placement) return
                            const rawStart = Math.max(1, Math.min(draft.totalUnits - placement.rackUnits + 1, unitAtPointer - dragState.offsetUnits))
                            const nextStart = event.altKey ? Math.round(rawStart * 100) / 100 : rawStart
                            const patch: Partial<RackPlacementDraft> = { startUnit: nextStart }
                            // #506 — Vertikales Stapeln-Snap: an die Ober-/Unter-
                            // kante anderer Geräte andocken (Tops bündig, direkt
                            // unter deren Unterkante, oder direkt über ihnen).
                            // Schwelle 1 HE — analog zum horizontalen Edge-Snap.
                            {
                              let bestVDelta = 2
                              for (const other of draft.placements) {
                                if (other.id === placement.id) continue
                                const vTargets = [
                                  other.startUnit,
                                  other.startUnit + other.rackUnits,
                                  other.startUnit - placement.rackUnits,
                                ]
                                for (const target of vTargets) {
                                  const clampedT = Math.max(
                                    1,
                                    Math.min(draft.totalUnits - placement.rackUnits + 1, target),
                                  )
                                  const d = Math.abs(nextStart - clampedT)
                                  if (d < bestVDelta) {
                                    bestVDelta = d
                                    patch.startUnit = clampedT
                                  }
                                }
                              }
                            }
                            // v7.9.82 / #170 — Shelf-Devices auch horizontal
                            // verschiebbar machen: Drop-X-Position relativ zum
                            // Panel in mm umrechnen, in [0..(RACK_MOUNT_WIDTH_MM
                            // - widthMm)] klemmen.
                            if (isShelfDevice && rackTpl?.widthMm) {
                              const mmToPxLocal = host.width / RACK_OUTER_WIDTH_MM
                              const railInsetLocal =
                                ((RACK_OUTER_WIDTH_MM - RACK_MOUNT_WIDTH_MM) / 2) * mmToPxLocal
                              const x = clamp(event.clientX - host.left, 0, host.width)
                              const renderedOffsetMm = (x - railInsetLocal) / mmToPxLocal - rackTpl.widthMm / 2
                              const maxOffset = Math.max(0, RACK_MOUNT_WIDTH_MM - rackTpl.widthMm)
                              let clampedRendered = clamp(renderedOffsetMm, 0, maxOffset)

                              // v7.9.114 / Issue #229 — Soft edge-snap an
                              // anderen Shelf-Devices auf demselben oder
                              // ueberlappenden HE-Bereich. Threshold ~5mm
                              // (~10 px bei typischem Zoom): wenn die
                              // Drag-Position nah an einer anderen
                              // Geraete-Kante ist (links/rechts/aligned-
                              // left/aligned-right), snappt sie ein.
                              // 'Sehr schwach' im Issue-Sinne — der
                              // Threshold ist klein genug, dass weiteres
                              // Schieben die Snap-Distanz schnell ueber-
                              // windet.
                              const SNAP_MM = 5
                              const myWidth = rackTpl.widthMm
                              const candidates: number[] = [0, maxOffset]
                              for (const other of draft.placements) {
                                if (other.id === placement.id) continue
                                const otherTpl = templates.find(
                                  (t) => t.name === other.templateName,
                                )
                                if (!otherTpl?.widthMm) continue
                                // Same-row check: HE-Ranges ueberlappen?
                                const myEnd = nextStart + placement.rackUnits
                                const otherEnd = other.startUnit + other.rackUnits
                                const overlapping =
                                  !(myEnd <= other.startUnit || otherEnd <= nextStart)
                                if (!overlapping) continue
                                const otherLeft = other.shelfOffsetX ?? 0
                                const otherRight = otherLeft + otherTpl.widthMm
                                // Snap-Targets fuer mein left-edge:
                                //   align left edges: otherLeft
                                //   stack right of other: otherRight
                                //   stack left of other: otherLeft - myWidth
                                //   align right edges: otherRight - myWidth
                                candidates.push(
                                  otherLeft,
                                  otherRight,
                                  otherLeft - myWidth,
                                  otherRight - myWidth,
                                )
                              }
                              let bestDelta = SNAP_MM
                              for (const target of candidates) {
                                const clamped = clamp(target, 0, maxOffset)
                                const delta = Math.abs(clampedRendered - clamped)
                                if (delta < bestDelta) {
                                  bestDelta = delta
                                  clampedRendered = clamped
                                }
                              }
                              // v7.9.87 / #204 — In der Rear-Ansicht wird
                              // der Render-Offset gespiegelt; beim Drag
                              // dort müssen wir die Spiegelung umkehren
                              // bevor wir den physischen shelfOffsetX
                              // speichern. (effectiveOffsetX = maxOffset -
                              // renderedOffsetX in Rear-Ansicht.)
                              patch.shelfOffsetX = side === 'rear'
                                ? maxOffset - clampedRendered
                                : clampedRendered
                            }
                            updatePlacement(placement.id, patch)
                          }}
                          onPointerUp={(event) => {
                            event.currentTarget.releasePointerCapture?.(event.pointerId)
                            setDragState(null)
                          }}
                          onPointerCancel={() => setDragState(null)}
                          onClick={() => setSelectedPlacementId(item.id)}
                          onDoubleClick={(event) => {
                            event.stopPropagation()
                            setSelectedPlacementId(item.id)
                            setPlacementPropsOpen(true)
                          }}
                        >
                          {image ? (
                            <img
                              src={image}
                              alt={`${item.name} ${side}`}
                              draggable={false}
                              className="pointer-events-none h-full w-full object-contain"
                            />
                          ) : (
                            <div className="pointer-events-none flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold text-sky-100">{item.name}</div>
                          )}
                          {/* v7.9.78 / #170 — Port-Dots-Overlay im 2D
                              Rack-Editor. Front-Side zeigt inputs[],
                              Rear-Side zeigt outputs[]. Dots sind via
                              Pointer-Drag positionierbar — Position als
                              normalisierte 0..1 auf den Port persistiert
                              (panelPosX/Y). Default-Verteilung wenn kein
                              Override gesetzt. */}
                          <PortDots2D
                            // v7.9.81 / #170 — Filter nach port.rackSide
                            // (Default 'rear'). Patchblende = Sonderfall:
                            // inputs auf front, outputs auf rear.
                            ports={[...item.inputs, ...item.outputs].filter((port) => {
                              if (item.isPatchPanel) {
                                const isInput = item.inputs.some((i) => i.id === port.id)
                                return side === 'front' ? isInput : !isInput
                              }
                              return (port.rackSide ?? 'rear') === side
                            })}
                            allInputs={item.inputs}
                            allOutputs={item.outputs}
                            placementId={item.id}
                            placementWidth={rowHeight * RACK_PANEL_ASPECT_PER_1HE}
                            placementHeight={height}
                            updatePlacement={updatePlacement}
                            side={side as 'front' | 'rear'}
                            showSymbols={showConnectorSymbols}
                          />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
                            {item.inputs.length} In · {item.outputs.length} Out
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* v7.9.2 — Auf md-Bildschirmen (2 Spalten) spannen sich die
              Geräte-Properties über die volle Breite unterhalb der
              Library/Rack-Spalten. Ab xl sind sie wieder die 3. Spalte. */}
          <div className="space-y-3 md:col-span-2 lg:col-span-1">
          {/* v7.9.9 — Live-Preview-Pane: Black-Box auf Canvas + interne
              Verkabelung — Updates live mit jeder Draft-Änderung. */}
          <div className="rounded border border-cp-border bg-cp-surface-3/50 p-2">
            <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
              Live-Preview
            </div>
            <RackLivePreview
              rackName={draft.rackName}
              totalUnits={draft.totalUnits}
              placements={draft.placements.map((p) => ({
                id: p.id,
                name: p.name,
                startUnit: p.startUnit,
                rackUnits: p.rackUnits,
                inputs: p.inputs.map((port) => ({ id: port.id, name: port.name, connectorType: port.connectorType as string })),
                outputs: p.outputs.map((port) => ({ id: port.id, name: port.name, connectorType: port.connectorType as string })),
              }))}
              cables={draft.internalCables.map((c) => ({
                fromPlacementId: c.fromPlacementId,
                fromPortName: c.fromPortName,
                toPlacementId: c.toPlacementId,
                toPortName: c.toPortName,
                color: c.color,
              }))}
            />
          </div>

          {/* v7.9.49 — Eigenschaften-Panel ist jetzt ein Popup
              (PlacementPropertiesDialog am Ende der Component), das per
              Doppelklick auf ein Gerät im Rack aufgeht. Hier nur ein
              kleiner Hinweis statt der dauerhaft offenen Sidebar. */}
          <div className="rounded border border-dashed border-cp-border bg-cp-surface-3/30 px-2 py-3 text-center text-[10px] text-cp-text-muted">
            Doppelklick auf ein Gerät im Rack → öffnet Eigenschaften-Popup
            (Höhe, Start-HE, Panel-Bilder, Entfernen).
          </div>

          </div>
        </div>
        </div>{/* /Layout-Shell-Body */}

        {selectedPlacement && (
          <RackPlacementProperties
            open={placementPropsOpen}
            selectedPlacement={selectedPlacement}
            totalUnits={draft.totalUnits}
            rackDepthMm={draft.depthMm}
            templates={templates}
            categoryOptions={categoryOptions}
            onClose={() => setPlacementPropsOpen(false)}
            onUpdate={updatePlacement}
            onRemove={removePlacement}
            onPickPanelImage={(placementId, side, src) =>
              setCropDialog({ placementId, side, src })
            }
            onSyncStlToTemplate={(templateName, stlDataUri) => {
              const tpl = templates.find((tpl2) => tpl2.name === templateName)
              if (!tpl) return
              if (stlDataUri === undefined && !tpl.stlDataUri) return
              addCustomTemplate({ ...tpl, stlDataUri })
            }}
          />
        )}

        <RackBuilderFooter
          devicesCount={draft.placements.length}
          occupiedUnits={draft.placements.reduce((sum, p) => sum + p.rackUnits, 0)}
          totalUnits={draft.totalUnits}
          internalCablesCount={draft.internalCables.length}
          conflictsCount={conflicts.length}
          dirty={dirty}
          editingId={editingId}
          internWireDisabled={draft.placements.length < 1}
          onOpenInternalCanvas={() => setWireDialogOpen(true)}
          onCancel={closeWithConfirm}
          onSave={saveRack}
        />
      </div>

      <RackInternalWireOverlay
        open={wireDialogOpen}
        rackName={draft.rackName}
        placements={draft.placements}
        internalCables={draft.internalCables}
        onClose={() => setWireDialogOpen(false)}
        onCablesChanged={(next) =>
          setDraft((current) => ({ ...current, internalCables: next }))
        }
        onPlacementRenamed={(placementId, newName) => {
          updatePlacement(placementId, { name: newName })
        }}
        onPlacementMoved={(placementId, x, y) => {
          // v7.9.14 — Canvas-Position des Geräts im Internal-Canvas in den
          // Draft persistieren. Beim Save landet sie in
          // GroupPreset.rack.internalCanvasPositions.
          updatePlacement(placementId, { canvasX: x, canvasY: y })
        }}
      />

      <RackImageCropDialog
        open={!!cropDialog}
        imageSrc={cropDialog?.src ?? null}
        rackUnits={(cropDialog && draft.placements.find((p) => p.id === cropDialog.placementId)?.rackUnits) || 1}
        side={cropDialog?.side ?? 'front'}
        onCancel={() => setCropDialog(null)}
        onConfirm={({ dataUrl, crop }) => {
          if (!cropDialog) return
          if (cropDialog.side === 'front') {
            updatePlacement(cropDialog.placementId, { frontPanelImageUrl: dataUrl, frontPanelCrop: crop })
          } else {
            updatePlacement(cropDialog.placementId, { rearPanelImageUrl: dataUrl, rearPanelCrop: crop })
          }
          setCropDialog(null)
        }}
      />

      {/* v7.9.75 / #170 — Patch-Panel-Create-Dialog. Wenn der User
          "Patchblende erstellen" klickt, schicken wir das fertige
          EquipmentTemplate durch addTemplate, das die smart-Slot-Suche +
          das Platzieren übernimmt — Patchblende landet im nächsten freien
          HE-Block. Falls mountSide=rear gesetzt war, schreiben wir
          direkt nach addTemplate noch das mountSide-Flag auf den
          frischen Placement. */}
      <PatchPanelCreateDialog
        open={patchPanelDialogOpen}
        onClose={() => setPatchPanelDialogOpen(false)}
        onCreated={(template) => {
          void addTemplate(template).then(() => {
            // Wenn das Template mit notes "Mount: rear" geflagged ist,
            // patchen wir mountSide auf das frisch hinzugefügte Placement.
            const notes = template.notes ?? ''
            const mount: 'front' | 'rear' | 'full' = notes.includes('Mount: rear')
              ? 'rear'
              : notes.includes('Mount: front')
                ? 'front'
                : 'full'
            if (mount !== 'full') {
              setDraft((cur) => {
                const last = cur.placements[cur.placements.length - 1]
                if (!last || last.templateName !== template.name) return cur
                return {
                  ...cur,
                  placements: cur.placements.map((p) =>
                    p.id === last.id ? { ...p, mountSide: mount } : p,
                  ),
                }
              })
            }
          })
        }}
      />
      <RackShelfCreateDialog
        open={shelfDialogOpen}
        onClose={() => setShelfDialogOpen(false)}
        onCreated={(template) => {
          void addTemplate(template)
        }}
      />
      {/* v7.9.80 / #170 — Non-Rack-Add-Dialog. Bei Confirm wird das
          Template mit den gewählten Maßen angereichert und addTemplate
          rekursiv neu aufgerufen — diesmal MIT isRackDevice + rackUnits
          gesetzt, sodass der early-return nicht mehr greift. Optional
          auch ins Library-Template-Storage geschrieben (persistFlag). */}
      {nonRackDialog && (
        <NonRackAddDialog
          open
          templateName={nonRackDialog.template.name}
          initialDimensions={{
            widthMm: nonRackDialog.template.widthMm,
            heightMm: nonRackDialog.template.heightMm,
            depthMm: nonRackDialog.template.depthMm,
          }}
          onCancel={() => setNonRackDialog(null)}
          onConfirm={(result) => {
            const base = nonRackDialog.template
            const options = nonRackDialog.options
            const enrichedTemplate: EquipmentTemplate = {
              ...base,
              isRackDevice: true,
              rackUnits: result.rackUnits,
              ...(result.mode === 'shelf'
                ? {
                    widthMm: result.widthMm,
                    heightMm: result.heightMm,
                    depthMm: result.depthMm,
                  }
                : {}),
            }
            if (result.persistToTemplate) {
              if (result.mode === 'rack') {
                markTemplateAsRack(base.name, result.rackUnits)
              } else {
                addCustomTemplate(enrichedTemplate)
              }
            }
            setNonRackDialog(null)
            void addTemplate(enrichedTemplate, options)
          }}
        />
      )}
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

