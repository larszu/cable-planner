import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { RackImageCropDialog } from './RackImageCropDialog'
import { RackInternalCanvas } from './RackInternalCanvas'
import { RackLivePreview } from './RackLivePreview'
import { Rack3DView } from './Rack3DView'
import { PatchPanelCreateDialog } from './PatchPanelCreateDialog'
import { RackShelfCreateDialog } from './RackShelfCreateDialog'
import { PortDots2D } from './PortDots2D'
import { RackAddSplitButton } from './RackAddSplitButton'
import { NonRackAddDialog } from './NonRackAddDialog'
import { StlPreview } from './StlPreview'
import { RackBuilderDialogExportMenu } from './RackBuilderDialogExportMenu'
import { RackBuilderFooter } from './RackBuilderFooter'
import { RackBuilderHeader } from './RackBuilderHeader'
import { RackConflictBadges } from './RackConflictBadges'
import * as THREE from 'three'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { CategorySelect } from '../shared/CategorySelect'
import { ModalShell } from '../shared/ModalShell'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { confirmDialog } from '../../lib/confirmDialog'
import { STORAGE_KEYS } from '../../lib/storageKeys'
import { LIMITS } from '../../lib/layoutConstants'

interface RackBuilderDialogProps {
  open: boolean
  templates: EquipmentTemplate[]
  /** When set, the dialog opens in edit mode and seeds from this preset. */
  initialPreset?: GroupPreset | null
  onClose: () => void
  onSave: (preset: GroupPreset) => void
}

interface RackPlacementDraft {
  id: string
  templateName: string
  name: string
  category: string
  startUnit: number
  rackUnits: number
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
  isRackDevice: boolean
  /** v7.9.14 — Optionale Position des Geräts im RackInternalCanvas
   *  (eigenständige 2D-Ansicht der Internal-Verkabelung). Wird wie
   *  beim normalen Canvas frei vom User gesetzt und persistiert mit
   *  dem GroupPreset; Default-Position aus startUnit. */
  canvasX?: number
  canvasY?: number
  frontPanelImageUrl?: string
  rearPanelImageUrl?: string
  frontPanelCrop?: EquipmentTemplate['frontPanelCrop']
  rearPanelCrop?: EquipmentTemplate['rearPanelCrop']
  /** v7.9.73 / #170 — Tiefe in mm (lokaler Override, sonst Template-Default).
   *  Beim Rendering in der 3D-Ansicht greift erst dieser, dann template.depthMm,
   *  dann 400 mm Standard. */
  depthMm?: number
  /** v7.9.73 / #170 — Front-/Rear-/Full-Mount. Default 'full'. */
  mountSide?: 'front' | 'rear' | 'full'
  /** v7.9.73 / #170 — Optional STL als data:base64 für die 3D-Geometrie. */
  stlDataUri?: string
  /** v7.9.75 / #170 — Patchblende-Marker, vererbt vom Template. */
  isPatchPanel?: boolean
  /** v7.9.75 / #170 — Rack-Shelf-Marker. */
  isRackShelf?: boolean
  /** v7.9.82 / #170 — Shelf-Device horizontal-Offset (mm von links). */
  shelfOffsetX?: number
  /** v7.9.82 / #170 — Shelf-Device depth-Offset (mm von vorne). */
  shelfOffsetZ?: number
}

interface RackDraft {
  rackName: string
  totalUnits: number
  viewMode: 'front' | 'rear' | 'both' | 'side'
  /** v7.9.73 / #170 — Rack-Tiefe in mm. Default 800 mm. */
  depthMm?: number
  placements: RackPlacementDraft[]
  /** v7.8.5 — internal wiring between rack devices. Authored in the
   *  RackInternalWireDialog and persisted into the GroupPreset on save.
   *  References placements by `id` (not array index) so re-ordering
   *  placements doesn't invalidate cables. The save step maps ids back
   *  to indices when building the preset. */
  internalCables: InternalCableDraft[]
}

interface InternalCableDraft {
  fromPlacementId: string
  fromPortName: string
  toPlacementId: string
  toPortName: string
  name: string
  type: string
  length: number
  color?: string
  standard?: string
  /** v7.9.115 / Issue #223 — User-Waypoints persistieren ueber den
   *  Save-Round-Trip. Optional. */
  waypoints?: Array<{ x: number; y: number }>
}

// 19" rack standard: outer width 482.6 mm, 1U height 44.45 mm.
// width / height ratio per 1 HE = 482.6 / 44.45 ≈ 10.857 — used to derive
// rowHeight in pixels from the measured panel width so the on-screen rack is
// proportional to a real 19" rack, regardless of available screen space.
const RACK_PANEL_ASPECT_PER_1HE = 10.857
// v7.9.82 / #170 — geteilt mit Rack3DView.tsx: 19″ standardisierte
// Außenbreite + Mounting-Raum (innen zwischen den Rails). Werden für
// die Shelf-Device Horizontal-Positionierung in 2D gebraucht.
const RACK_OUTER_WIDTH_MM = 482.6
const RACK_MOUNT_WIDTH_MM = 450
// v7.9.10 — MIN auf 6 px gesenkt damit bei kleinem Dialog + vielen HE
// (42 HE) der Rack noch in den sichtbaren Bereich passt. Wer Details
// sehen will dreht den Zoom hoch.
const MIN_ROW_HEIGHT = 6
const MAX_ROW_HEIGHT = 56
const DEFAULT_ROW_HEIGHT = 22
const DRAFT_KEY = STORAGE_KEYS.rackBuilderDraftV2

const parseUnits = (template?: EquipmentTemplate): number => {
  const raw = template?.rackUnits
  if (!raw || Number.isNaN(raw)) return 1
  return Math.max(1, Math.round(raw))
}

// v7.9.13 — Port-IDs sanitisieren. Die Catalog-Templates (Blackmagic,
// Misc, Camera, …) emittieren ihre Ports mit `id: ''`. Wenn die Ports
// hier mit leerem ID in den RackPlacementDraft kopiert werden, sind die
// Internal-Cable-Refs (per Port-NAME) zwar stabil — aber bei Render-
// Wiederverwendung als ReactFlow-Nodes (z.B. im RackInternalCanvas)
// kollidieren die leeren IDs als React-Keys → "Ports gestapelt". Bonus:
// Old presets die schon mit leeren IDs in localStorage liegen, werden
// beim Laden ebenfalls über sanitizeTemplatePorts (s.u.) geheilt.
const sanitizeTemplatePorts = <T extends { id?: string }>(ports: T[]): T[] => {
  const seen = new Set<string>()
  return ports.map((p) => {
    let id = p.id ?? ''
    if (!id || seen.has(id)) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `port-${Math.random().toString(36).slice(2, 11)}`
    }
    seen.add(id)
    return { ...p, id }
  })
}

const toPlacement = (template: EquipmentTemplate, startUnit: number): RackPlacementDraft => ({
  id: uuidv4(),
  templateName: template.name,
  name: template.name,
  category: template.category,
  startUnit,
  rackUnits: parseUnits(template),
  inputs: sanitizeTemplatePorts(template.inputs),
  outputs: sanitizeTemplatePorts(template.outputs),
  isRackDevice: template.isRackDevice ?? !!template.rackUnits,
  frontPanelImageUrl: template.frontPanelImageUrl,
  rearPanelImageUrl: template.rearPanelImageUrl,
  frontPanelCrop: template.frontPanelCrop,
  rearPanelCrop: template.rearPanelCrop,
  // v7.9.75 / #170 — Tiefe + STL aus dem Template (Patchblende kommt
  // bereits mit depthMm=50 aus dem Create-Dialog).
  depthMm: template.depthMm,
  stlDataUri: template.stlDataUri,
  isPatchPanel: template.isPatchPanel,
  isRackShelf: template.isRackShelf,
  // v7.9.82 / #170 — Shelf-Offsets initial 0 (= linke vordere Ecke der HE).
  shelfOffsetX: 0,
  shelfOffsetZ: 0,
})

const normalizeDraft = (draft: RackDraft): RackDraft => {
  const normalizedPlacements = draft.placements.map((p) => ({
    ...p,
    startUnit: Math.max(1, Math.round(p.startUnit) || 1),
    rackUnits: Math.max(1, Math.round(p.rackUnits) || 1),
  }))
  // Drop internal cables that point at placements that no longer exist
  // (user removed a device after wiring it).
  const livePlacementIds = new Set(normalizedPlacements.map((p) => p.id))
  const normalizedCables = (draft.internalCables ?? []).filter(
    (c) => livePlacementIds.has(c.fromPlacementId) && livePlacementIds.has(c.toPlacementId),
  )
  return {
    ...draft,
    rackName: draft.rackName.trim() || 'Neues Rack',
    totalUnits: Math.max(1, Math.min(LIMITS.MAX_RACK_HEIGHT_HE, Math.round(draft.totalUnits) || 42)),
    placements: normalizedPlacements,
    internalCables: normalizedCables,
  }
}

const formatRackUnits = (value: number): string => `${value} HE`

// Reverse of saveRack: rebuild a draft from a previously stored GroupPreset.
// Used when opening the dialog in edit mode so the user can refine an existing
// rack instead of starting empty.
const draftFromPreset = (preset: GroupPreset): RackDraft => {
  const placementsByIndex = new Map<number, { startUnit: number; heightUnits: number }>()
  for (const placement of preset.rack?.placements ?? []) {
    placementsByIndex.set(placement.itemIndex, {
      startUnit: placement.startUnit,
      heightUnits: placement.heightUnits,
    })
  }
  // v7.9.14 — Hydrate Canvas-Positionen aus gespeichertem Preset.
  const savedPositions = preset.rack?.internalCanvasPositions ?? {}
  // v7.9.73 / #170 — mountSide aus preset.rack.placements[].mountSide hydraten
  const mountSideByIndex = new Map<number, 'front' | 'rear' | 'full' | undefined>()
  // v7.9.82 / #170 — Shelf-Offsets dito.
  const shelfOffsetByIndex = new Map<number, { x?: number; z?: number }>()
  for (const p of preset.rack?.placements ?? []) {
    if (p.mountSide) mountSideByIndex.set(p.itemIndex, p.mountSide)
    if (p.shelfOffsetX != null || p.shelfOffsetZ != null) {
      shelfOffsetByIndex.set(p.itemIndex, { x: p.shelfOffsetX, z: p.shelfOffsetZ })
    }
  }
  const placements: RackPlacementDraft[] = preset.items.map((item, index) => {
    const meta = placementsByIndex.get(index)
    const pos = savedPositions[index]
    return {
      id: uuidv4(),
      templateName: item.name,
      name: item.name,
      category: item.category,
      startUnit: meta?.startUnit ?? 1,
      rackUnits: meta?.heightUnits ?? Math.max(1, item.rackUnits ?? 1),
      inputs: item.inputs,
      outputs: item.outputs,
      isRackDevice: item.isRackDevice ?? !!item.rackUnits,
      canvasX: pos?.x,
      canvasY: pos?.y,
      frontPanelImageUrl: item.frontPanelImageUrl,
      rearPanelImageUrl: item.rearPanelImageUrl,
      frontPanelCrop: item.frontPanelCrop,
      rearPanelCrop: item.rearPanelCrop,
      // v7.9.73 / #170 — Engineering-/3D-Felder.
      depthMm: item.depthMm,
      mountSide: mountSideByIndex.get(index),
      stlDataUri: item.stlDataUri,
      isPatchPanel: item.isPatchPanel,
      isRackShelf: item.isRackShelf,
      shelfOffsetX: shelfOffsetByIndex.get(index)?.x,
      shelfOffsetZ: shelfOffsetByIndex.get(index)?.z,
    }
  })
  // Hydrate internal cables: cables in the stored preset reference items
  // by INDEX; the new placements have fresh ids, so we map index → id.
  const indexToPlacementId = new Map<number, string>()
  placements.forEach((p, idx) => indexToPlacementId.set(idx, p.id))
  const internalCables: InternalCableDraft[] = []
  for (const c of preset.cables ?? []) {
    const fromId = indexToPlacementId.get(c.fromItemIndex)
    const toId = indexToPlacementId.get(c.toItemIndex)
    if (!fromId || !toId) continue
    const entry: InternalCableDraft = {
      fromPlacementId: fromId,
      fromPortName: c.fromPortName,
      toPlacementId: toId,
      toPortName: c.toPortName,
      name: c.name,
      type: c.type,
      length: c.length,
    }
    if (c.color != null) entry.color = c.color
    if (c.standard != null) entry.standard = c.standard
    // v7.9.115 / Issue #223 — Waypoints aus dem Preset wieder herstellen.
    if (c.waypoints && c.waypoints.length > 0) {
      entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
    }
    internalCables.push(entry)
  }
  return {
    rackName: preset.name,
    totalUnits: preset.rack?.totalUnits ?? 42,
    depthMm: preset.rack?.depthMm,
    viewMode: 'front',
    placements,
    internalCables,
  }
}

export const RackBuilderDialog = ({ open, templates, initialPreset, onClose, onSave }: RackBuilderDialogProps) => {
  const t = useTranslation()
  // v7.9.13 — Permanent-Mark-As-Rack-Device action.
  const markTemplateAsRack = useProjectStore((s) => s.markTemplateAsRack)
  const addCustomTemplate = useProjectStore((s) => s.addCustomTemplate)
  const autosaveIntervalMs = useSettingsStore((state) => state.autosaveIntervalMs)
  const editingId = initialPreset?.id
  const [draft, setDraft] = useState<RackDraft>({
    rackName: 'Neues Rack',
    totalUnits: 42,
    viewMode: 'front',
    placements: [],
    internalCables: [],
  })
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

  const drag = useDraggablePosition('cable-planner:modal-pos:rack-builder', open)

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
          )
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
    let effectiveTemplate = template
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
      // v7.9.82 / #170 — Shelf-Offsets nur wenn != 0.
      ...(placement.shelfOffsetX ? { shelfOffsetX: placement.shelfOffsetX } : {}),
      ...(placement.shelfOffsetZ ? { shelfOffsetZ: placement.shelfOffsetZ } : {}),
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
        ref={drag.containerRef}
        style={drag.containerStyle}
        // v7.9.2 — responsive: kein fixes 1400px max-width, sondern
        // 100vw mit Padding. Verhindert horizontal-Scroll auf Laptops.
        className="max-h-[96vh] w-[min(1400px,calc(100vw-1rem))] overflow-auto rounded border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-2xl sm:p-4"
      >
        <RackBuilderHeader
          editingId={editingId}
          rackName={draft.rackName}
          dirty={dirty}
          headerProps={drag.headerProps}
          onClose={closeWithConfirm}
          exportMenuSlot={
            <RackBuilderDialogExportMenu
              rackName={draft.rackName}
              totalUnits={draft.totalUnits}
              depthMm={draft.depthMm}
              placements={draft.placements}
              editingId={editingId}
              rackCanvasEl={rackCanvasRef.current}
              canvas3DRefs={canvas3DRefs.current}
            />
          }
        />

        {/* v7.9.11 — Control-Bar mit gewichteten Spalten. Name (Pflichtfeld
            + längster Inhalt) bekommt 2 Spalten, Höhe + Ansicht + Zoom je 1.
            Zoom hat jetzt explizite +/- Buttons für Tastatur/Maus-User. */}
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <label className="block text-xs font-medium text-slate-300 lg:col-span-2">
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
              className={`mt-1 w-full rounded border bg-slate-950 px-2.5 py-1.5 text-sm font-normal text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                !draft.rackName.trim() && saveError
                  ? 'border-red-600 ring-1 ring-red-600/40'
                  : 'border-slate-700'
              }`}
            />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            {t('rack.field.height', 'Höhe')} <span className="text-slate-500">(HE)</span>
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
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-normal text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </label>
          {/* v7.9.73 / #170 — Rack-Tiefe in mm. Wird vom 3D-Builder genutzt
              um zu prüfen ob hinten noch Platz für Patchblenden ist. */}
          <label className="block text-xs font-medium text-slate-300">
            {t('rack.field.depth', 'Tiefe')} <span className="text-slate-500">(mm)</span>
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
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm font-normal text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              title={t('rack.depthTitle', 'Rack-Tiefe in mm. Standard: 800 mm. Gängige Werte: 350/450/600/800/1000/1200.')}
            />
          </label>
          {/* v7.9.80 / #170 — "Ansicht" (Front/Rear/Both) ist nach
              unten in die 2D-Rack-Spalte gewandert (als Tab-Bar dort);
              Grid hier ist auf 4 Spalten reduziert (Name=2fr, Höhe,
              Tiefe, Zoom). */}
          <div className="block text-xs font-medium text-slate-300">
            <div className="flex items-baseline justify-between">
              <span>{t('rack.zoom', 'Zoom')}</span>
              <span className="text-[10px] font-normal text-slate-500">
                {Math.round(zoom * 100)}% · {Math.round(rowHeight)} px/HE
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 text-sm text-slate-300 hover:bg-slate-800"
                title={t('rack.zoomOut', 'Verkleinern')}
              >
                −
              </button>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value) || 1)}
                className="flex-1 accent-sky-500"
                title={t('rack.zoomSliderTitle', 'Skaliert die HE-Höhe. Auto-Fit passt das Rack in den sichtbaren Bereich.')}
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 text-sm text-slate-300 hover:bg-slate-800"
                title={t('rack.zoomIn', 'Vergrößern')}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="flex h-7 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900 px-2 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title={t('rack.zoomFitTitle', 'Auf 100 % zurück (Auto-Fit)')}
              >
                {t('rack.zoomFit', 'Fit')}
              </button>
            </div>
          </div>
        </div>

        <RackConflictBadges
          conflicts={conflicts}
          saveError={saveError}
          onDismissSaveError={() => setSaveError(null)}
        />

        {/* v7.9.2 — responsiver: 1-Spalter bis md, 2-Spalter md (Library
            + Rack), 3-Spalter ab xl. Verhindert horizontal-Overflow. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr_300px]">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            {/* v7.9.11 — Library-Header mit Counter, dann Search-Input
                mit Magnifier-Icon + Clear-Button für bessere Affordance. */}
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('library.title', 'Library')}
              </div>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
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
                className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500"
              >
                <circle cx="7" cy="7" r="4" />
                <path d="M10.5 10.5 L14 14" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('rack.searchDevicesPlaceholder', 'Gerät suchen…')}
                className="w-full rounded border border-slate-700 bg-slate-950 pl-7 pr-7 py-1.5 text-xs placeholder-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  title={t('library.search.clear', 'Suche löschen')}
                  aria-label={t('library.search.clear', 'Suche löschen')}
                  className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                >
                  ×
                </button>
              )}
            </div>
            <label
              className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-400"
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
                <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center text-[11px] text-slate-500">
                  {query ? (
                    <>
                      {t('rack.noMatchesPre', 'Keine Treffer für')}{' '}
                      <strong className="text-slate-300">"{query}"</strong>.
                    </>
                  ) : (
                    <>
                      {t('rack.noRackDevices', 'Keine Rack-Geräte verfügbar.')}{' '}
                      <span className="text-slate-400">
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
                    className={`group rounded border p-2 text-xs transition-colors ${
                      isRack
                        ? 'cursor-grab border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-900 active:cursor-grabbing'
                        : 'cursor-grab border-amber-800/40 bg-amber-950/20 hover:border-amber-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium text-slate-100">{template.name}</span>
                          {placedCount > 0 && (
                            <span
                              className="shrink-0 rounded bg-emerald-800/70 px-1 text-[8px] font-semibold uppercase text-emerald-200"
                              title={`${placedCount}× im Rack platziert`}
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
                        <div className="truncate text-[10px] text-slate-500">{template.category}</div>
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
                        primaryLabel={placedCount > 0 ? '+ Weitere' : '+ Ins Rack'}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {isRack ? `${parseUnits(template)} HE · ` : 'HE ? · '}
                      {template.inputs.length} In · {template.outputs.length} Out
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="min-w-0 rounded border border-slate-700 bg-slate-950/50 p-2">
            {/* v7.9.11 — Rack-Header mit Live-HE-Belegung + Drag-Hint. */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {t('rack.layout', 'Rack-Layout')}
                </div>
                {/* v7.9.73 / #170 — 2D/3D Tab-Toggle. 2D ist der bestehende
                    Front/Rear-Panel-Editor; 3D ist die neue Orbit-Ansicht
                    auf Basis von react-three-fiber. */}
                <div className="ml-2 flex overflow-hidden rounded border border-slate-700 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setViewTab('2d')}
                    className={`px-2 py-0.5 ${
                      viewTab === '2d'
                        ? 'bg-sky-700 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title={t('rack.tab2dTitle', '2D-Editor: Vorderseite/Rückseite als Panel-Ansichten')}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('3d')}
                    className={`px-2 py-0.5 ${
                      viewTab === '3d'
                        ? 'bg-purple-700 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    title={t('rack.tab3dTitle', '3D-Visualisierung mit Front/Rear-Tiefe und Rotation. Nur-Lesen — bearbeitet wird im 2D-Tab.')}
                  >
                    3D
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2 L8 14 M5 5 L8 2 L11 5 M5 11 L8 14 L11 11" />
                </svg>
                <span>Drag &amp; Drop</span>
              </div>
            </div>
            {draft.placements.length === 0 && (
              <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-xs text-slate-500">
                <div className="mb-2 text-3xl">▥</div>
                <div className="mb-1 font-semibold text-slate-300">{t('rack.empty', 'Rack ist leer')}</div>
                <div>{t('rack.addFromLibraryHint', 'Geräte aus der Library links hinzufügen (Button "+ Rack").')}</div>
                <div className="mt-2 text-[10px]">
                  {t('rack.tipPrefix', 'Tipp:')}{' '}
                  <span className="text-slate-400">"{t('rack.showNonRack', 'Auch Nicht-Rack-Geräte')}"</span>{' '}
                  {t('rack.tipBody', 'aktivieren wenn das Wunschgerät fehlt.')}
                </div>
              </div>
            )}
            {/* v7.9.73 / #170 — 3D-Tab: nur lesende Orbit-Ansicht.
                Bearbeitung geht weiter im 2D-Tab.
                v7.9.75 / #170 — View-Mode-Filter über den Placements:
                'all' / 'free' / 'released' ausgewertet anhand
                draft.internalCables. */}
            {viewTab === '3d' && (
              <>
                <div className="mb-2 flex items-center gap-1 text-[10px]">
                  <span className="text-slate-500">{t('rack.view.label', 'Ansicht:')}</span>
                  {(['all', 'free', 'released'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setRenderMode(m)}
                      className={`rounded px-2 py-0.5 ${
                        renderMode === m
                          ? 'bg-purple-700 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                      title={
                        m === 'all'
                          ? t('rack.view.allTitle', 'Alle Geräte + freie Ports + Patchblenden')
                          : m === 'free'
                            ? t('rack.view.freeTitle', 'Nur Geräte mit freien Ports + Patchblenden')
                            : t('rack.view.releasedTitle', 'Nur freigegebene: Patchblenden + extern verkabelbare Geräte')
                      }
                    >
                      {m === 'all'
                        ? t('rack.view.all', 'Alle')
                        : m === 'free'
                          ? t('rack.view.free', 'Freie Ports')
                          : t('rack.view.released', 'Released')}
                    </button>
                  ))}
                </div>
                {draft.placements.length > 0 ? (
                  <div
                    style={{ height: 'min(75vh, 800px)' }}
                    className="rounded border border-slate-800 bg-slate-950"
                    // v7.9.76 / #170 — Drag&Drop von Library-Cards auf
                    // die 3D-Canvas. Da Raycast hier overkill wäre,
                    // nutzen wir smart-Placement: Drop fügt das Gerät
                    // in den nächsten freien HE-Block ein. Mount-Side
                    // wird aus dem Drop-Y-Verhältnis abgeleitet:
                    // oberer Bereich = front, untere Hälfte = rear,
                    // Mitte = full. Pragmatisch und intuitiv für 3D-
                    // Drops, wo präzise HE-Auswahl schwierig ist.
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
                        // Drop-X-Verhältnis: linkes Drittel = front,
                        // rechtes Drittel = rear, Mitte = full.
                        const host = event.currentTarget.getBoundingClientRect()
                        const fracX = (event.clientX - host.left) / host.width
                        const mount: 'front' | 'rear' | 'full' =
                          fracX < 0.33 ? 'front' : fracX > 0.66 ? 'rear' : 'full'
                        void addTemplate(template, { mountSide: mount })
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <Rack3DView
                      totalUnits={draft.totalUnits}
                      rackDepthMm={draft.depthMm}
                      placements={(() => {
                        // Berechne pro Placement wie viele Ports schon
                        // intern verkabelt sind. Patchblenden sind
                        // immer sichtbar (sie ZEIGEN die freien Ports).
                        const usedPortsByPlacement = new Map<string, Set<string>>()
                        for (const c of draft.internalCables) {
                          if (!usedPortsByPlacement.has(c.fromPlacementId)) {
                            usedPortsByPlacement.set(c.fromPlacementId, new Set())
                          }
                          if (!usedPortsByPlacement.has(c.toPlacementId)) {
                            usedPortsByPlacement.set(c.toPlacementId, new Set())
                          }
                          usedPortsByPlacement.get(c.fromPlacementId)!.add(c.fromPortName)
                          usedPortsByPlacement.get(c.toPlacementId)!.add(c.toPortName)
                        }
                        return draft.placements
                          .filter((p) => {
                            if (renderMode === 'all') return true
                            if (p.isPatchPanel || p.isRackShelf) return true
                            const usedSet = usedPortsByPlacement.get(p.id) ?? new Set()
                            const totalPorts = (p.inputs?.length ?? 0) + (p.outputs?.length ?? 0)
                            const hasFreePort = usedSet.size < totalPorts
                            if (renderMode === 'free') return hasFreePort
                            return hasFreePort
                          })
                          .map((p) => {
                            // v7.9.80 / #170 — Shelf-Device-Maße aus dem
                            // Template ziehen (sind im Builder nicht im
                            // RackPlacementDraft, sondern auf dem Library-
                            // Template gespeichert).
                            const tpl = templates.find((t) => t.name === p.templateName)
                            return {
                            id: p.id,
                            name: p.name,
                            startUnit: p.startUnit,
                            rackUnits: p.rackUnits,
                            depthMm: p.depthMm ?? tpl?.depthMm,
                            widthMm: tpl?.widthMm,
                            heightMm: tpl?.heightMm,
                            mountSide: p.mountSide,
                            stlDataUri: p.stlDataUri,
                            frontPanelImageUrl: p.frontPanelImageUrl,
                            rearPanelImageUrl: p.rearPanelImageUrl,
                            portCount: (p.inputs?.length ?? 0) + (p.outputs?.length ?? 0),
                            isPatchPanel: p.isPatchPanel,
                            isRackShelf: p.isRackShelf,
                            shelfOffsetX: p.shelfOffsetX,
                            shelfOffsetZ: p.shelfOffsetZ,
                            // v7.9.81 / #170 — Port-Side aus port.rackSide
                            // (Default 'rear' wenn nicht gesetzt). Inputs UND
                            // Outputs werden in einen Topf geworfen und nach
                            // rackSide aufgesplittet. Patchblenden sind die
                            // Ausnahme: dort wandert input → front, output →
                            // rear (klassisches Crossfield-Layout).
                            frontPorts: [...(p.inputs ?? []), ...(p.outputs ?? [])]
                              .filter((port) => {
                                if (p.isPatchPanel) {
                                  // Patchblende: inputs = front, outputs = rear
                                  return (p.inputs ?? []).some((i) => i.id === port.id)
                                }
                                return (port.rackSide ?? 'rear') === 'front'
                              })
                              .map((port) => ({
                                id: port.id,
                                name: port.name,
                                connectorType: port.connectorType,
                                panelPosX: port.panelPosX,
                                panelPosY: port.panelPosY,
                              })),
                            rearPorts: [...(p.inputs ?? []), ...(p.outputs ?? [])]
                              .filter((port) => {
                                if (p.isPatchPanel) {
                                  return (p.outputs ?? []).some((o) => o.id === port.id)
                                }
                                return (port.rackSide ?? 'rear') === 'rear'
                              })
                              .map((port) => ({
                                id: port.id,
                                name: port.name,
                                connectorType: port.connectorType,
                                panelPosX: port.panelPosX,
                                panelPosY: port.panelPosY,
                              })),
                          }
                          })
                      })()}
                      selectedPlacementId={selectedPlacementId}
                      onSelectPlacement={(id) => setSelectedPlacementId(id)}
                      // v7.9.83 / #170 — Canvas-Refs für den Export
                      // (PNG aus N Perspektiven, STL).
                      onCanvasRefsReady={(refs) => {
                        canvas3DRefs.current = refs
                      }}
                      // v7.9.82 / #170 — Shelf-Device-Drag im 3D-Tab
                      // persistieren.
                      onShelfDeviceMoved={(placementId, offset) => {
                        updatePlacement(placementId, {
                          shelfOffsetX: offset.x,
                          shelfOffsetZ: offset.z,
                        })
                      }}
                      // v7.9.77 / #170 — Port-Dot-Drag persistieren: setzt
                      // panelPosX/Y am Port (in inputs ODER outputs je
                      // nach side) im Draft.
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
                      // v7.9.78 / #170 — Internal cables: portName aus
                      // dem Cable-Eintrag → portId-Lookup + side-Ableitung
                      // (im input → Front, im output → Rear).
                      internalCables={draft.internalCables
                        .map((c) => {
                          const fromP = draft.placements.find((x) => x.id === c.fromPlacementId)
                          const toP = draft.placements.find((x) => x.id === c.toPlacementId)
                          if (!fromP || !toP) return null
                          const fromInput = fromP.inputs.find((p) => p.name === c.fromPortName)
                          const fromOutput = fromP.outputs.find((p) => p.name === c.fromPortName)
                          const toInput = toP.inputs.find((p) => p.name === c.toPortName)
                          const toOutput = toP.outputs.find((p) => p.name === c.toPortName)
                          const fromPort = fromInput ?? fromOutput
                          const toPort = toInput ?? toOutput
                          if (!fromPort || !toPort) return null
                          return {
                            fromPlacementId: c.fromPlacementId,
                            fromPortId: fromPort.id,
                            fromSide: (fromInput ? 'front' : 'rear') as 'front' | 'rear',
                            toPlacementId: c.toPlacementId,
                            toPortId: toPort.id,
                            toSide: (toInput ? 'front' : 'rear') as 'front' | 'rear',
                            color: c.color,
                          }
                        })
                        .filter((c): c is NonNullable<typeof c> => c !== null)}
                    />
                  </div>
                ) : (
                  <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-xs text-slate-500">
                    Erst Geräte ins Rack legen, dann erscheint die 3D-Ansicht.
                  </div>
                )}
              </>
            )}
            {/* v7.9.80 / #170 — Front/Rear/Both-Toggle ist jetzt Teil der
                2D-Rack-Spalte (war vorher als Select im Header). */}
            {viewTab === '2d' && (
              <div className="mb-2 flex overflow-hidden rounded-md border border-slate-700 text-[11px]">
                {([
                  ['front', t('rack.viewMode.front', 'Nur vorne'), '#22c55e'],
                  ['both', t('rack.viewMode.both', 'Beide'), '#64748b'],
                  ['rear', t('rack.viewMode.rear', 'Nur hinten'), '#a855f7'],
                  ['side', t('rack.viewMode.side', 'Seite (Tiefe)'), '#0ea5e9'],
                ] as const).map(([mode, label, color]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((cur) => ({ ...cur, viewMode: mode }))}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-1 font-medium transition ${
                      draft.viewMode === mode
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-900/50 text-slate-400 hover:bg-slate-800/60'
                    }`}
                    aria-pressed={draft.viewMode === mode}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: color }}
                    />
                    {label}
                  </button>
                ))}
              </div>
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
                <div className="rounded border border-slate-800 bg-slate-950 p-2">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#0ea5e9' }} />
                      Seitenansicht (Tiefe)
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Vorne ◀ {draft.depthMm ?? 800} mm ▶ Hinten
                    </span>
                  </div>
                  {(() => {
                    const depthMm = draft.depthMm ?? 800
                    const sideWidthPx = rowHeight * RACK_PANEL_ASPECT_PER_1HE
                    const sidePxPerMm = sideWidthPx / depthMm
                    return (
                      <div
                        className="relative mx-auto overflow-hidden rounded border border-slate-700 bg-slate-900"
                        style={{ width: sideWidthPx, height: draft.totalUnits * rowHeight }}
                      >
                        {/* HE-Grid */}
                        {Array.from({ length: draft.totalUnits }).map((_, idx) => {
                          const unit = idx + 1
                          return (
                            <div
                              key={`side-grid-${unit}`}
                              className="absolute left-0 right-0 border-t border-slate-800/80"
                              style={{ top: idx * rowHeight, height: rowHeight }}
                            >
                              <span className="absolute left-1 top-0.5 text-[9px] text-slate-600">U{unit}</span>
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
                              : 'border-slate-500 bg-slate-700/40'
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
                <div key={side} className="rounded border border-slate-800 bg-slate-950 p-2">
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
                      {side === 'front' ? 'Vorne' : 'Hinten'}
                    </span>
                  </div>
                  <div
                    className="relative mx-auto overflow-hidden rounded border border-slate-700 bg-slate-900"
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
                      const unitAtPointer = Math.max(1, Math.min(draft.totalUnits, Math.floor(y / rowHeight) + 1))
                      const placement = draft.placements.find((p) => p.id === dragState.placementId)
                      if (!placement) return
                      const nextStart = Math.max(1, Math.min(draft.totalUnits - placement.rackUnits + 1, unitAtPointer - dragState.offsetUnits))
                      updatePlacement(placement.id, { startUnit: nextStart })
                    }}
                    onPointerUp={() => setDragState(null)}
                  >
                    {Array.from({ length: draft.totalUnits }).map((_row, index) => {
                      const unit = index + 1
                      return (
                        <div
                          key={`${side}-grid-${unit}`}
                          className="absolute left-0 right-0 border-t border-slate-800/80"
                          style={{ top: index * rowHeight, height: rowHeight }}
                        >
                          <span className="absolute left-1 top-0.5 text-[9px] text-slate-600">U{unit}</span>
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
                      const shelfStyle = isShelfDevice
                        ? {
                            top,
                            height: Math.min(rackTpl!.heightMm! * mmToPx, height),
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
                            const unitAtPointer = Math.max(1, Math.min(draft.totalUnits, Math.floor(y / rowHeight) + 1))
                            const placement = draft.placements.find((p) => p.id === dragState.placementId)
                            if (!placement) return
                            const nextStart = Math.max(1, Math.min(draft.totalUnits - placement.rackUnits + 1, unitAtPointer - dragState.offsetUnits))
                            const patch: Partial<RackPlacementDraft> = { startUnit: nextStart }
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
          <div className="space-y-3 md:col-span-2 xl:col-span-1">
          {/* v7.9.9 — Live-Preview-Pane: Black-Box auf Canvas + interne
              Verkabelung — Updates live mit jeder Draft-Änderung. */}
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
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
          <div className="rounded border border-dashed border-slate-700 bg-slate-950/30 px-2 py-3 text-center text-[10px] text-slate-500">
            Doppelklick auf ein Gerät im Rack → öffnet Eigenschaften-Popup
            (Höhe, Start-HE, Panel-Bilder, Entfernen).
          </div>

          </div>
        </div>

        {/* v7.9.49 — Eigenschaften-Popup für ein einzelnes Rack-Gerät.
            Vorher als immer-sichtbares Side-Panel im Builder; jetzt nur
            bei Doppelklick auf ein Gerät. */}
        {selectedPlacement && placementPropsOpen && (() => {
          const heightInvalid =
            selectedPlacement.rackUnits + selectedPlacement.startUnit - 1 >
            draft.totalUnits
          const startMax = Math.max(
            1,
            draft.totalUnits - selectedPlacement.rackUnits + 1,
          )
          const heRange =
            selectedPlacement.rackUnits > 1
              ? `HE${selectedPlacement.startUnit}–${selectedPlacement.startUnit + selectedPlacement.rackUnits - 1}`
              : `HE${selectedPlacement.startUnit}`
          return (
            <ModalShell
              open={placementPropsOpen}
              onClose={() => setPlacementPropsOpen(false)}
              title={format(t('rack.props.title', 'Eigenschaften · {name}'), { name: selectedPlacement.name })}
              titleIcon={
                <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                  {heRange}
                </span>
              }
              maxWidth="lg"
              zIndex={70}
              footer={
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      removePlacement(selectedPlacement.id)
                      setPlacementPropsOpen(false)
                    }}
                    className="rounded bg-red-900/60 px-3 py-1 text-xs hover:bg-red-800"
                  >
                    {t('rack.props.removeFromRack', 'Aus Rack entfernen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlacementPropsOpen(false)}
                    className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
                  >
                    {t('common.close', 'Schließen')}
                  </button>
                </div>
              }
            >
              <div className="space-y-2 text-xs">
                <label className="block">
                  {t('rack.props.name', 'Name')}
                  <input
                    value={selectedPlacement.name}
                    onChange={(event) => updatePlacement(selectedPlacement.id, { name: event.target.value })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <label className="block">
                  {t('rack.props.category', 'Kategorie')}
                  <CategorySelect
                    value={selectedPlacement.category}
                    onChange={(category) => updatePlacement(selectedPlacement.id, { category })}
                    extraOptions={[...categoryOptions, selectedPlacement.category]}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <label className="flex items-center gap-2 opacity-60" title={t('rack.readonlyInBuilder', 'Im Builder schreibgeschützt — wurde beim Hinzufügen gesetzt.')}>
                  <input type="checkbox" checked={selectedPlacement.isRackDevice} disabled readOnly />
                  <span>{t('rack.isRackInBuilder', 'Ist Rack-Gerät (im Builder fix)')}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    {t('rack.props.heightHe', 'Höhe (HE)')}
                    <input
                      type="number"
                      min={1}
                      max={draft.totalUnits}
                      value={selectedPlacement.rackUnits}
                      aria-invalid={heightInvalid}
                      onChange={(event) => {
                        const raw = Math.max(1, Number(event.target.value) || 1)
                        const clamped = Math.min(
                          raw,
                          draft.totalUnits - selectedPlacement.startUnit + 1,
                        )
                        updatePlacement(selectedPlacement.id, { rackUnits: clamped })
                      }}
                      className={`mt-1 w-full rounded border bg-slate-950 p-1.5 ${
                        heightInvalid ? 'border-red-600 ring-1 ring-red-600/40' : 'border-slate-700'
                      }`}
                    />
                    {heightInvalid && (
                      <span className="mt-0.5 block text-[10px] text-red-400">
                        {format(
                          t(
                            'rack.props.heightOverflow',
                            'Höhe + Start-HE überschreitet Rack ({total} HE).',
                          ),
                          { total: draft.totalUnits },
                        )}
                      </span>
                    )}
                  </label>
                  <label className="block">
                    {t('rack.props.startHe', 'Start-HE')}
                    <input
                      type="number"
                      min={1}
                      max={startMax}
                      value={selectedPlacement.startUnit}
                      aria-invalid={heightInvalid}
                      onChange={(event) => {
                        const raw = Math.max(1, Number(event.target.value) || 1)
                        const clamped = Math.min(raw, startMax)
                        updatePlacement(selectedPlacement.id, { startUnit: clamped })
                      }}
                      className={`mt-1 w-full rounded border bg-slate-950 p-1.5 ${
                        heightInvalid ? 'border-red-600 ring-1 ring-red-600/40' : 'border-slate-700'
                      }`}
                    />
                    <span className="mt-0.5 block text-[10px] text-slate-500">
                      {format(
                        t('rack.props.maxHint', 'max {max} (Höhe {he} HE)'),
                        { max: startMax, he: selectedPlacement.rackUnits },
                      )}
                    </span>
                  </label>
                </div>
                {/* v7.9.73 / #170 — 3D-Felder: Tiefe + Mount-Side + STL. */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    {t('rack.props.depthMm', 'Tiefe (mm)')}
                    <input
                      type="number"
                      min={20}
                      max={1500}
                      step={10}
                      value={selectedPlacement.depthMm ?? ''}
                      placeholder="400"
                      onChange={(event) => {
                        const v = event.target.value
                        updatePlacement(selectedPlacement.id, {
                          depthMm: v === '' ? undefined : Math.max(20, Math.min(1500, Number(v))),
                        })
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                      title={t('rack.deviceDepthTitle', 'Geräte-Tiefe in mm. Leer = 400 mm Standard. Wird vom 3D-Tab visualisiert.')}
                    />
                  </label>
                  <label className="block">
                    {t('rack.mountLabel', 'Montage')}
                    <select
                      value={selectedPlacement.mountSide ?? 'full'}
                      onChange={(event) =>
                        updatePlacement(selectedPlacement.id, {
                          mountSide: event.target.value as 'front' | 'rear' | 'full',
                        })
                      }
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                      title={t('rack.mountTitle', 'full = volle Rack-Tiefe. front = nur vorne. rear = nur hinten (z.B. Patchblende).')}
                    >
                      <option value="full">{t('rack.mount.full', 'Full-Depth')}</option>
                      <option value="front">{t('props.rack.frontOnly', 'Nur vorne')}</option>
                      <option value="rear">{t('props.rack.rearOnly', 'Nur hinten')}</option>
                    </select>
                  </label>
                </div>
                {/* STL-Upload für 3D-Modell.
                    v7.9.80 / #170 — Eigener gestylter "Datei wählen…"-
                    Button (statt nacktem <input type="file">, der je nach
                    OS nur "Keine ausgewählt" zeigt). Speichert die STL
                    zusätzlich aufs Template via addCustomTemplate, damit
                    sie über librarySync in die zentrale .cpdevice-Datei
                    landet und beim nächsten Mal aus der Library schon
                    mit STL kommt. */}
                <div className="block">
                  <div className="mb-1 text-xs text-slate-300">{t('rack.stl.header', '3D-Modell (STL, optional)')}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <label
                      className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-600 bg-sky-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-600"
                      title={t('rack.stlUploadTitle', 'STL-Datei (.stl, max 5 MB) zum Gerät hochladen')}
                    >
                      <span>📁</span>
                      <span>{selectedPlacement.stlDataUri
                        ? t('rack.stl.replace', 'STL ersetzen…')
                        : t('rack.stl.pick', 'STL auswählen…')}</span>
                      <input
                        type="file"
                        accept=".stl,application/octet-stream"
                        onChange={async (event) => {
                          const file = event.target.files?.[0]
                          if (!file) return
                          if (file.size > 5 * 1024 * 1024) {
                            await confirmDialog(t('rack.stl.tooBigTitle', 'Datei zu groß'), {
                              body: t('rack.stl.tooBigBody', 'STL-Dateien über 5 MB werden nicht angenommen, sonst explodiert der Projekt-Save.'),
                              okLabel: 'OK',
                            })
                            event.target.value = ''
                            return
                          }
                          const buf = await file.arrayBuffer()
                          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
                          const dataUri = `data:application/octet-stream;base64,${b64}`
                          updatePlacement(selectedPlacement.id, { stlDataUri: dataUri })
                          // Auch ins Template heften: librarySync schreibt
                          // das .cpdevice (mit STL inline base64) in den
                          // zentralen Library-Ordner — damit ist die STL
                          // permanent ans Gerät gebunden.
                          const tpl = templates.find(
                            (t) => t.name === selectedPlacement.templateName,
                          )
                          if (tpl) {
                            addCustomTemplate({ ...tpl, stlDataUri: dataUri })
                          }
                          event.target.value = '' // reset so user can re-upload same file
                        }}
                        className="hidden"
                      />
                    </label>
                    {selectedPlacement.stlDataUri && (
                      <button
                        type="button"
                        onClick={() => {
                          updatePlacement(selectedPlacement.id, { stlDataUri: undefined })
                          // Auch im Template entfernen, falls dort gespeichert
                          const tpl = templates.find(
                            (t) => t.name === selectedPlacement.templateName,
                          )
                          if (tpl && tpl.stlDataUri) {
                            addCustomTemplate({ ...tpl, stlDataUri: undefined })
                          }
                        }}
                        className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-600"
                        title={t('rack.stlRemoveTitle', 'STL entfernen — Gerät wird wieder als Box gerendert')}
                      >
                        ✕ {t('common.remove', 'Entfernen')}
                      </button>
                    )}
                  </div>
                  {/* v7.9.87 / #205 — STL-Mini-Vorschau wenn ein Model
                      hinterlegt ist. Analog zu Front/Rear-Foto-Thumbnails. */}
                  {selectedPlacement.stlDataUri && (
                    <div className="mt-2">
                      <StlPreview stlDataUri={selectedPlacement.stlDataUri} size={120} />
                    </div>
                  )}
                  <span className="mt-1 block text-[10px] text-slate-500">
                    {selectedPlacement.stlDataUri
                      ? t('rack.stl.loaded', '✓ STL geladen — wird im 3D-Tab gerendert und permanent am Gerät gespeichert (Library + Projekt).')
                      : t('rack.stl.noStl', 'Ohne STL wird das Gerät als Box mit Front-/Rear-Foto dargestellt.')}
                  </span>
                </div>
                {/* v7.9.82 / #170 — Shelf-Device-Position-Editor.
                    Nur sichtbar wenn das Template echte mm-Maße hat
                    (Shelf-Device). Erlaubt präzises Eingeben der
                    horizontal- + Tiefen-Position innerhalb des Racks. */}
                {(() => {
                  const tpl = templates.find((t) => t.name === selectedPlacement.templateName)
                  if (!tpl?.widthMm || !tpl?.heightMm) return null
                  const maxX = Math.max(0, RACK_MOUNT_WIDTH_MM - tpl.widthMm)
                  const rackDepthRender = draft.depthMm ?? 800
                  const devDepth = tpl.depthMm ?? 400
                  const maxZ = Math.max(0, rackDepthRender - devDepth)
                  return (
                    <details className="rounded border border-emerald-800 bg-emerald-900/20 p-2" open>
                      <summary className="cursor-pointer text-[11px] font-semibold text-emerald-200">
                        🪑 Shelf-Position
                        <span className="ml-1 text-emerald-400">
                          ({tpl.widthMm}×{tpl.heightMm}×{tpl.depthMm ?? 400} mm)
                        </span>
                      </summary>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="block text-[10px]">
                          <span className="mb-0.5 block text-emerald-300/80">
                            Horizontal (mm vom linken Rail)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={maxX}
                            step={5}
                            value={Math.round(selectedPlacement.shelfOffsetX ?? 0)}
                            onChange={(e) =>
                              updatePlacement(selectedPlacement.id, {
                                shelfOffsetX: Math.max(0, Math.min(maxX, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                          />
                          <span className="text-[9px] text-slate-500">max {Math.round(maxX)} mm</span>
                        </label>
                        <label className="block text-[10px]">
                          <span className="mb-0.5 block text-emerald-300/80">
                            Tiefe (mm von vorne)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={maxZ}
                            step={10}
                            value={Math.round(selectedPlacement.shelfOffsetZ ?? 0)}
                            onChange={(e) =>
                              updatePlacement(selectedPlacement.id, {
                                shelfOffsetZ: Math.max(0, Math.min(maxZ, Number(e.target.value) || 0)),
                              })
                            }
                            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                          />
                          <span className="text-[9px] text-slate-500">max {Math.round(maxZ)} mm</span>
                        </label>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Tipp: Im 2D-Tab kannst du das Gerät auch horizontal per Maus
                        verschieben. Tiefen-Position nur hier oder im 3D-Tab editierbar.
                      </div>
                    </details>
                  )
                })()}
                {/* v7.9.81 / #170 — Port-Side-Editor.
                    Default-Annahme: alle Ports hinten. User kann einzelne
                    Ports auf vorne flippen oder alle in einer Aktion
                    spiegeln. */}
                <details className="rounded border border-slate-800 bg-slate-900/40 p-2" open>
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-300">
                    Port-Seite (Front/Rear)
                    <span className="ml-1 text-slate-500">
                      ({selectedPlacement.inputs.length} Inputs / {selectedPlacement.outputs.length} Outputs)
                    </span>
                  </summary>
                  {/* Bulk-Buttons */}
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        updatePlacement(selectedPlacement.id, {
                          inputs: selectedPlacement.inputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                          outputs: selectedPlacement.outputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                        })
                      }}
                      className="rounded bg-purple-900/40 px-2 py-1 text-purple-200 hover:bg-purple-900/60"
                      title={t('rack.portsAllRear', 'Alle Ports nach hinten (Default für klassische Server-Geräte)')}
                    >
                      ⏬ alle nach hinten
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlacement(selectedPlacement.id, {
                          inputs: selectedPlacement.inputs.map((p) => ({
                            ...p,
                            rackSide: (p.rackSide ?? 'rear') === 'front' ? ('rear' as const) : ('front' as const),
                          })),
                          outputs: selectedPlacement.outputs.map((p) => ({
                            ...p,
                            rackSide: (p.rackSide ?? 'rear') === 'front' ? ('rear' as const) : ('front' as const),
                          })),
                        })
                      }}
                      className="rounded bg-slate-700 px-2 py-1 text-slate-100 hover:bg-slate-600"
                      title={t('rack.portsSwap', 'Front-Ports werden zu Rear-Ports und umgekehrt')}
                    >
                      ↔ spiegeln
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updatePlacement(selectedPlacement.id, {
                          inputs: selectedPlacement.inputs.map((p) => ({ ...p, rackSide: 'front' as const })),
                          outputs: selectedPlacement.outputs.map((p) => ({ ...p, rackSide: 'front' as const })),
                        })
                      }}
                      className="rounded bg-green-900/40 px-2 py-1 text-green-200 hover:bg-green-900/60"
                      title={t('rack.portsAllFront', 'Alle Ports nach vorne (z.B. Frontpanel-Geräte)')}
                    >
                      ⏫ alle nach vorne
                    </button>
                  </div>
                  {/* Per-Port-Toggle-Liste */}
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-800">
                    {[
                      ...selectedPlacement.inputs.map((p) => ({ port: p, dir: 'in' as const })),
                      ...selectedPlacement.outputs.map((p) => ({ port: p, dir: 'out' as const })),
                    ].map(({ port, dir }) => {
                      const side: 'front' | 'rear' = port.rackSide ?? 'rear'
                      return (
                        <div
                          key={port.id}
                          className="flex items-center justify-between gap-2 border-t border-slate-800/60 px-2 py-0.5 text-[10px] first:border-t-0"
                        >
                          <span className="flex min-w-0 items-center gap-1">
                            <span
                              className={`shrink-0 rounded px-1 text-[8px] font-bold uppercase ${
                                dir === 'in' ? 'bg-cyan-900/60 text-cyan-200' : 'bg-emerald-900/60 text-emerald-200'
                              }`}
                              title={dir === 'in' ? 'Input (Signal-Eingang)' : 'Output (Signal-Ausgang)'}
                            >
                              {dir}
                            </span>
                            <span className="truncate text-slate-300">{port.name}</span>
                            <span className="shrink-0 text-slate-500">· {port.connectorType}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const newSide: 'front' | 'rear' = side === 'front' ? 'rear' : 'front'
                              if (dir === 'in') {
                                updatePlacement(selectedPlacement.id, {
                                  inputs: selectedPlacement.inputs.map((p) =>
                                    p.id === port.id ? { ...p, rackSide: newSide } : p,
                                  ),
                                })
                              } else {
                                updatePlacement(selectedPlacement.id, {
                                  outputs: selectedPlacement.outputs.map((p) =>
                                    p.id === port.id ? { ...p, rackSide: newSide } : p,
                                  ),
                                })
                              }
                            }}
                            className={`shrink-0 rounded border px-1.5 py-0.5 font-semibold transition ${
                              side === 'front'
                                ? 'border-green-700 bg-green-900/40 text-green-200 hover:bg-green-900/60'
                                : 'border-purple-700 bg-purple-900/40 text-purple-200 hover:bg-purple-900/60'
                            }`}
                            title={format(
                              t('rack.portSide.toggleTitle', 'Port-Seite umschalten (aktuell: {side})'),
                              { side: side === 'front' ? t('rack.portSide.front', 'vorne') : t('rack.portSide.rear', 'hinten') },
                            )}
                          >
                            {side === 'front'
                              ? '⏫ ' + t('rack.portSide.front', 'vorne')
                              : '⏬ ' + t('rack.portSide.rear', 'hinten')}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </details>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-400">{t('rack.panelImages.header', 'Panel-Bilder (Import + Zuschneiden)')}</div>
                    {/* v7.9.76 / #170 — Swap-Button: vertauscht Front- und
                        Rear-Foto, falls der User sie versehentlich falsch
                        zugeordnet hat. Tauscht sowohl URL als auch Crop-
                        Meta-Daten, damit der Crop nicht verzerrt. */}
                    {(selectedPlacement.frontPanelImageUrl || selectedPlacement.rearPanelImageUrl) && (
                      <button
                        type="button"
                        onClick={() =>
                          updatePlacement(selectedPlacement.id, {
                            frontPanelImageUrl: selectedPlacement.rearPanelImageUrl,
                            rearPanelImageUrl: selectedPlacement.frontPanelImageUrl,
                            frontPanelCrop: selectedPlacement.rearPanelCrop,
                            rearPanelCrop: selectedPlacement.frontPanelCrop,
                          })
                        }
                        className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
                        title={t('rack.swapPhotos', 'Front- und Rear-Foto vertauschen (falls die Zuordnung falsch ist)')}
                      >
                        ↔ Front/Rear tauschen
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['front', 'rear'] as const).map((side) => {
                      const urlKey = side === 'front' ? 'frontPanelImageUrl' : 'rearPanelImageUrl'
                      const currentUrl = selectedPlacement[urlKey]
                      const label = side === 'front' ? 'Vorne' : 'Hinten'
                      const btnColor = side === 'front' ? 'bg-sky-700 hover:bg-sky-600' : 'bg-purple-700 hover:bg-purple-600'
                      return (
                        <div key={side} className="space-y-1">
                          <button
                            type="button"
                            className={`w-full rounded ${btnColor} px-2 py-1 text-[11px]`}
                            onClick={async () => {
                              const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                              if (dataUri)
                                setCropDialog({ placementId: selectedPlacement.id, side, src: dataUri })
                            }}
                          >
                            {currentUrl ? `${label} ersetzen…` : `${label} importieren…`}
                          </button>
                          {currentUrl && (
                            <div className="flex items-center gap-1">
                              <img src={currentUrl} alt={`${side} panel`} className="h-7 flex-1 rounded border border-slate-700 object-contain" />
                              <button
                                type="button"
                                onClick={() => updatePlacement(selectedPlacement.id, { [urlKey]: undefined, [side === 'front' ? 'frontPanelCrop' : 'rearPanelCrop']: undefined })}
                                className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/40 hover:text-red-300"
                                title={t('rack.removeImage', 'Bild entfernen')}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </ModalShell>
          )
        })()}

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

      {wireDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-6">
          <div className="flex h-[92vh] w-[min(1500px,calc(100vw-1rem))] flex-col rounded border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{t('rack.wire.title', 'Rack-Verkabelung')}: {draft.rackName || t('rack.unnamed', '(unbenannt)')}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {t(
                    'rack.wire.intro',
                    'Ziehe Linien Output → Input. Rechtsklick auf Kabel = Menü, Doppelklick = Eigenschaften, Entf = Löschen. Verwendet jetzt die echte Canvas-Komponente — Toolbar, Routing, Waypoints, A*-Routing alles wie im Hauptcanvas.',
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWireDialogOpen(false)}
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
              >
                {t('common.done', 'Fertig')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded border border-slate-700">
              <RackInternalCanvas
                rackName={draft.rackName}
                placements={draft.placements.map((p) => ({
                  id: p.id,
                  name: p.name,
                  category: p.category,
                  startUnit: p.startUnit,
                  rackUnits: p.rackUnits,
                  inputs: p.inputs,
                  outputs: p.outputs,
                  isRackDevice: p.isRackDevice,
                  canvasX: p.canvasX,
                  canvasY: p.canvasY,
                }))}
                initialCables={(() => {
                  // draft.internalCables (per-id) → GroupPreset.cables (per-index)
                  const result: GroupPreset['cables'] = []
                  for (const c of draft.internalCables) {
                    const fromIdx = draft.placements.findIndex((p) => p.id === c.fromPlacementId)
                    const toIdx = draft.placements.findIndex((p) => p.id === c.toPlacementId)
                    if (fromIdx < 0 || toIdx < 0) continue
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
                    // v7.9.115 / Issue #223 — Waypoints durchreichen.
                    if (c.waypoints && c.waypoints.length > 0) {
                      entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
                    }
                    result.push(entry)
                  }
                  return result
                })()}
                onCablesChanged={(cables) => {
                  // GroupPreset.cables (per-index) → draft.internalCables (per-id)
                  const next: InternalCableDraft[] = []
                  for (const c of cables) {
                    const fromId = draft.placements[c.fromItemIndex]?.id
                    const toId = draft.placements[c.toItemIndex]?.id
                    if (!fromId || !toId) continue
                    const entry: InternalCableDraft = {
                      fromPlacementId: fromId,
                      fromPortName: c.fromPortName,
                      toPlacementId: toId,
                      toPortName: c.toPortName,
                      name: c.name,
                      type: c.type,
                      length: c.length,
                    }
                    if (c.color != null) entry.color = c.color
                    if (c.standard != null) entry.standard = c.standard
                    // v7.9.115 / Issue #223 — Waypoints durchreichen.
                    if (c.waypoints && c.waypoints.length > 0) {
                      entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
                    }
                    next.push(entry)
                  }
                  setDraft((current) => ({ ...current, internalCables: next }))
                }}
                onPlacementRenamed={(placementId, newName) => {
                  updatePlacement(placementId, { name: newName })
                }}
                onPlacementMoved={(placementId, x, y) => {
                  // v7.9.14 — Canvas-Position des Geräts im Internal-
                  // Canvas in den Draft persistieren. Beim Save landet
                  // sie in GroupPreset.rack.internalCanvasPositions.
                  updatePlacement(placementId, { canvasX: x, canvasY: y })
                }}
              />
            </div>
          </div>
        </div>
      )}

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
