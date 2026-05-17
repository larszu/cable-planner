import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { useSettingsStore } from '../../store/settingsStore'
import { RackImageCropDialog } from './RackImageCropDialog'
import { RackInternalCanvas } from './RackInternalCanvas'
import { RackLivePreview } from './RackLivePreview'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { CategorySelect } from '../shared/CategorySelect'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { confirmDialog } from '../../lib/confirmDialog'
import { promptDialog } from '../../lib/promptDialog'

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
  frontPanelImageUrl?: string
  rearPanelImageUrl?: string
  frontPanelCrop?: EquipmentTemplate['frontPanelCrop']
  rearPanelCrop?: EquipmentTemplate['rearPanelCrop']
}

interface RackDraft {
  rackName: string
  totalUnits: number
  viewMode: 'front' | 'rear' | 'both'
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
}

// 19" rack standard: outer width 482.6 mm, 1U height 44.45 mm.
// width / height ratio per 1 HE = 482.6 / 44.45 ≈ 10.857 — used to derive
// rowHeight in pixels from the measured panel width so the on-screen rack is
// proportional to a real 19" rack, regardless of available screen space.
const RACK_PANEL_ASPECT_PER_1HE = 10.857
// v7.9.10 — MIN auf 6 px gesenkt damit bei kleinem Dialog + vielen HE
// (42 HE) der Rack noch in den sichtbaren Bereich passt. Wer Details
// sehen will dreht den Zoom hoch.
const MIN_ROW_HEIGHT = 6
const MAX_ROW_HEIGHT = 56
const DEFAULT_ROW_HEIGHT = 22
const DRAFT_KEY = 'cable-planner:rack-builder:draft:v2'

const parseUnits = (template?: EquipmentTemplate): number => {
  const raw = template?.rackUnits
  if (!raw || Number.isNaN(raw)) return 1
  return Math.max(1, Math.round(raw))
}

const toPlacement = (template: EquipmentTemplate, startUnit: number): RackPlacementDraft => ({
  id: uuidv4(),
  templateName: template.name,
  name: template.name,
  category: template.category,
  startUnit,
  rackUnits: parseUnits(template),
  inputs: template.inputs,
  outputs: template.outputs,
  isRackDevice: template.isRackDevice ?? !!template.rackUnits,
  frontPanelImageUrl: template.frontPanelImageUrl,
  rearPanelImageUrl: template.rearPanelImageUrl,
  frontPanelCrop: template.frontPanelCrop,
  rearPanelCrop: template.rearPanelCrop,
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
    totalUnits: Math.max(1, Math.min(60, Math.round(draft.totalUnits) || 42)),
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
  const placements: RackPlacementDraft[] = preset.items.map((item, index) => {
    const meta = placementsByIndex.get(index)
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
      frontPanelImageUrl: item.frontPanelImageUrl,
      rearPanelImageUrl: item.rearPanelImageUrl,
      frontPanelCrop: item.frontPanelCrop,
      rearPanelCrop: item.rearPanelCrop,
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
    internalCables.push(entry)
  }
  return {
    rackName: preset.name,
    totalUnits: preset.rack?.totalUnits ?? 42,
    viewMode: 'front',
    placements,
    internalCables,
  }
}

export const RackBuilderDialog = ({ open, templates, initialPreset, onClose, onSave }: RackBuilderDialogProps) => {
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
        issues.push(`${placement.name}: ist nicht als Rack-Gerät markiert.`)
      }
      if (placement.startUnit < 1) {
        issues.push(`${placement.name}: Start-HE muss >= 1 sein.`)
      }
      if (placement.startUnit + placement.rackUnits - 1 > draft.totalUnits) {
        issues.push(
          `${placement.name}: ${formatRackUnits(placement.rackUnits)} passt nicht ab HE ${placement.startUnit} in ${formatRackUnits(draft.totalUnits)}.`,
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
          issues.push(`${a.name} überlappt mit ${b.name}.`)
        }
      }
    }
    return issues
  }, [draft])

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
      !(await confirmDialog('Ungespeicherte Rack-Änderungen verwerfen?', {
        body: 'Die Änderungen am Rack-Layout gehen verloren.',
        okLabel: 'Verwerfen',
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

  const addTemplate = async (template: EquipmentTemplate) => {
    // v7.9.0 / Issue #112 — Wenn das Template (noch) nicht als 19"-
    // Rack-Gerät markiert ist, fragen wir den User nach der HE-Höhe
    // und markieren es im Draft entsprechend.
    // v7.9.2 — Verwendet jetzt den In-App promptDialog statt
    // window.prompt (User-Issue: "kann nicht im rack platzieren").
    // Der native prompt() ist in modern-Electron teilweise blockiert.
    let effectiveTemplate = template
    if (!template.isRackDevice && !template.rackUnits) {
      const answer = (
        await promptDialog(
          `Wieviele HE für "${template.name}" im Rack? (1-20, leer = Abbruch)`,
          '1',
        )
      )?.trim()
      if (!answer) return
      const heightHE = Math.max(1, Math.min(20, Math.round(Number(answer))))
      if (!Number.isFinite(heightHE) || heightHE < 1) {
        setSaveError(`Ungültige HE-Eingabe für "${template.name}". Bitte 1–20 angeben.`)
        return
      }
      effectiveTemplate = {
        ...template,
        isRackDevice: true,
        rackUnits: heightHE,
      }
    }
    const units = parseUnits(effectiveTemplate)
    let targetUnit = 1
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
    const placement = toPlacement(effectiveTemplate, targetUnit)
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
    const ok = await confirmDialog(`Gerät "${item.name}" aus Rack entfernen?`, {
      body: 'Position + Höhe gehen verloren. Internal-Cables an diesem Gerät werden ebenfalls entfernt.',
      okLabel: 'Entfernen',
      destructive: true,
    })
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
      setSaveError('Bitte Rack-Name angeben.')
      rackNameInputRef.current?.focus()
      return
    }
    if (draft.placements.length === 0) {
      setSaveError('Bitte mindestens ein Gerät ins Rack legen.')
      return
    }
    if (conflicts.length > 0) {
      setSaveError(`Rack hat Konflikte:\n- ${conflicts.join('\n- ')}`)
      return
    }
    setSaveError(null)

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
      width: 240,
      height: 80 + Math.max(placement.inputs.length, placement.outputs.length, 3) * 22,
      offsetX: 0,
      offsetY: (placement.startUnit - 1) * 44,
    }))

    const rackPlacements = sorted.map((placement, index) => ({
      itemIndex: index,
      startUnit: placement.startUnit,
      heightUnits: placement.rackUnits,
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
      persistedCables.push(entry)
    }

    const preset: GroupPreset = {
      id: editingId ?? uuidv4(),
      name: draft.rackName.trim(),
      rack: {
        totalUnits: draft.totalUnits,
        placements: rackPlacements,
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
        <div
          {...drag.headerProps}
          className="mb-3 flex items-center justify-between gap-3 select-none"
        >
          <div>
            <h3 className="text-base font-semibold">{editingId ? `Rack bearbeiten: ${draft.rackName}` : '2D Rack Builder'}</h3>
            <p className="mt-1 text-xs text-slate-400">HE-Slots, Drag-and-Drop nach oben/unten, Front/Rear Ansicht, Port-Sichtbarkeit.</p>
          </div>
          <button type="button" onClick={closeWithConfirm} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Schließen
          </button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            Rack-Name *
            <input
              ref={rackNameInputRef}
              value={draft.rackName}
              onChange={(event) => {
                if (saveError) setSaveError(null)
                setDraft((current) => ({ ...current, rackName: event.target.value }))
              }}
              aria-required="true"
              aria-invalid={!draft.rackName.trim() && !!saveError}
              placeholder='z.B. "Power Rack A" oder "Main Video Rack"'
              className={`mt-1 w-full rounded border bg-slate-950 p-2 ${
                !draft.rackName.trim() && saveError
                  ? 'border-red-600 ring-1 ring-red-600/40'
                  : 'border-slate-700'
              }`}
            />
          </label>
          <label className="block text-sm">
            Rack-Höhe (HE)
            <input
              type="number"
              min={1}
              max={60}
              value={draft.totalUnits}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  totalUnits: Math.max(1, Math.min(60, Number(event.target.value) || 1)),
                }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <label className="block text-sm">
            Ansicht
            <select
              value={draft.viewMode}
              onChange={(event) =>
                setDraft((current) => ({ ...current, viewMode: event.target.value as 'front' | 'rear' | 'both' }))
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="front">Nur vorne</option>
              <option value="rear">Nur hinten</option>
              <option value="both">Vorne + hinten</option>
            </select>
          </label>
          <label className="block text-sm">
            Zoom <span className="text-[10px] text-slate-500">({Math.round(zoom * 100)}% · {Math.round(rowHeight)} px/HE)</span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value) || 1)}
              className="mt-1 w-full"
              title="Skaliert die HE-Höhe. 100 % = an Spaltenbreite angepasst (19”-Aspekt 10.857:1)."
            />
          </label>
        </div>

        {/* v7.9.9 — Sticky-Konflikt+Save-Error-Banner. Bleibt beim
            Scrollen im Properties-Panel oben sichtbar, damit der User
            sieht ob sein Edit den Konflikt aufgelöst hat. */}
        {(conflicts.length > 0 || saveError) && (
          <div
            className="sticky top-0 z-20 mb-3 rounded border border-red-700/60 bg-red-900/40 px-3 py-2 text-xs text-red-100 shadow-lg backdrop-blur-sm"
          >
            {saveError && (
              <div className="mb-2 flex items-start gap-2">
                <span className="font-semibold">Speichern blockiert:</span>
                <span className="whitespace-pre-wrap flex-1">{saveError}</span>
                <button
                  type="button"
                  onClick={() => setSaveError(null)}
                  className="rounded bg-red-800/80 px-1.5 text-[10px] hover:bg-red-700"
                  title="Ausblenden"
                >
                  ×
                </button>
              </div>
            )}
            {conflicts.length > 0 && (
              <>
                <div className="font-semibold">Konflikte ({conflicts.length})</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {conflicts.map((issue, index) => (
                    <li key={`${issue}-${index}`}>{issue}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* v7.9.2 — responsiver: 1-Spalter bis md, 2-Spalter md (Library
            + Rack), 3-Spalter ab xl. Verhindert horizontal-Overflow. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr_300px]">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rack-Geräte aus Library</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suchen..."
              className="mb-2 w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
            />
            <label
              className="mb-2 flex items-center gap-1 text-[10px] text-slate-400"
              title="Wenn aktiv, werden auch Templates angezeigt die nicht als 19”-Rack-Gerät markiert sind. Beim Hinzufügen wirst du nach der HE-Höhe gefragt (Issue #112)."
            >
              <input
                type="checkbox"
                checked={showNonRack}
                onChange={(e) => setShowNonRack(e.target.checked)}
              />
              Auch Nicht-Rack-Geräte zeigen
            </label>
            <div className="max-h-[58vh] space-y-1 overflow-auto">
              {filteredTemplates.length === 0 && (
                <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-center text-[11px] text-slate-500">
                  Keine Treffer. Suche anpassen oder "Auch Nicht-Rack-Geräte zeigen" aktivieren.
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
                    className={`rounded border p-2 text-xs ${
                      isRack
                        ? 'border-slate-800 bg-slate-900/60'
                        : 'border-amber-800/40 bg-amber-950/20'
                    } ${placedCount > 0 ? 'opacity-75' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-medium text-slate-100">{template.name}</span>
                          {placedCount > 0 && (
                            <span
                              className="rounded bg-emerald-800/70 px-1 text-[8px] font-semibold uppercase text-emerald-200"
                              title={`${placedCount}× im Rack platziert`}
                            >
                              ✓ {placedCount}×
                            </span>
                          )}
                          {!isRack && (
                            <span
                              className="rounded bg-amber-800/60 px-1 text-[8px] font-semibold uppercase text-amber-200"
                              title="Nicht als 19”-Rack-Gerät markiert — wird beim Hinzufügen abgefragt."
                            >
                              No-HE
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[10px] text-slate-500">{template.category}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addTemplate(template)}
                        className="rounded bg-emerald-700 px-2 py-0.5 text-[11px] hover:bg-emerald-600"
                        title={placedCount > 0 ? 'Weitere Instanz hinzufügen' : 'Ins Rack hinzufügen'}
                      >
                        + Rack
                      </button>
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
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rack-Slots (Drag & Drop hoch/runter)</div>
            {draft.placements.length === 0 && (
              <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-xs text-slate-500">
                <div className="mb-2 text-3xl">▥</div>
                <div className="mb-1 font-semibold text-slate-300">Rack ist leer</div>
                <div>Geräte aus der Library links hinzufügen (Button "+ Rack").</div>
                <div className="mt-2 text-[10px]">Tipp: oben "Auch Nicht-Rack-Geräte zeigen" aktivieren, wenn dein Wunschgerät nicht erscheint.</div>
              </div>
            )}
            {/* v7.9.10 — max-h begrenzt den Rack-Canvas auf die
                Viewport-Höhe minus Header/Footer; in Kombi mit dem
                neuen height-fit in rowHeight passt sich das Rack
                automatisch dem sichtbaren Bereich an. */}
            <div
              ref={rackCanvasRef}
              className={`grid gap-2 overflow-auto ${draft.viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}
              style={{ maxHeight: 'min(75vh, 800px)' }}
            >
              {(draft.viewMode === 'both' ? ['front', 'rear'] : [draft.viewMode]).map((side) => (
                <div key={side} className="rounded border border-slate-800 bg-slate-950 p-2">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">{side === 'front' ? 'Front' : 'Rear'}</div>
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
                      return (
                        <div
                          key={`${side}-block-${item.id}`}
                          className={`absolute cursor-grab touch-none select-none overflow-hidden rounded border active:cursor-grabbing ${selectedPlacementId === item.id ? 'border-amber-400 bg-amber-900/30' : 'border-sky-600/70 bg-sky-900/40'}`}
                          style={{ top, height, left: 0, right: 0 }}
                          title={`${item.name} (${item.rackUnits} HE)`}
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
                            updatePlacement(placement.id, { startUnit: nextStart })
                          }}
                          onPointerUp={(event) => {
                            event.currentTarget.releasePointerCapture?.(event.pointerId)
                            setDragState(null)
                          }}
                          onPointerCancel={() => setDragState(null)}
                          onClick={() => setSelectedPlacementId(item.id)}
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

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Geräte-Properties im Rack</div>
            {!selectedPlacement ? (
              <div className="rounded border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">Gerät im Rack anklicken.</div>
            ) : (
              <div className="space-y-2 text-xs">
                <label className="block">
                  Name
                  <input
                    value={selectedPlacement.name}
                    onChange={(event) => updatePlacement(selectedPlacement.id, { name: event.target.value })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <label className="block">
                  Kategorie
                  <CategorySelect
                    value={selectedPlacement.category}
                    onChange={(category) => updatePlacement(selectedPlacement.id, { category })}
                    extraOptions={[...categoryOptions, selectedPlacement.category]}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <label className="flex items-center gap-2 opacity-60" title="Im Builder schreibgeschützt — wurde beim Hinzufügen gesetzt.">
                  <input
                    type="checkbox"
                    checked={selectedPlacement.isRackDevice}
                    disabled
                    readOnly
                  />
                  <span>Ist Rack-Gerät (im Builder fix)</span>
                </label>
                {(() => {
                  // v7.9.9 — Live-Constraints: Höhe + Start-HE müssen
                  // zusammen ins Rack passen. Wenn der User sie übergross
                  // tippt, clampen wir direkt + zeigen Inline-Hinweis.
                  const heightInvalid =
                    selectedPlacement.rackUnits + selectedPlacement.startUnit - 1 >
                    draft.totalUnits
                  const startMax = Math.max(
                    1,
                    draft.totalUnits - selectedPlacement.rackUnits + 1,
                  )
                  return (
                    <>
                      <label className="block">
                        Höhe (HE)
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
                            Höhe + Start-HE überschreitet Rack ({draft.totalUnits} HE).
                          </span>
                        )}
                      </label>
                      <label className="block">
                        Start-HE
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
                          max {startMax} (Höhe {selectedPlacement.rackUnits} HE)
                        </span>
                      </label>
                    </>
                  )
                })()}
                <div className="rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
                  Ports sichtbar: {selectedPlacement.inputs.length} Inputs / {selectedPlacement.outputs.length} Outputs
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400">Panel-Bilder (Import + Zuschneiden)</div>
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
                                title="Bild entfernen"
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
                <button
                  type="button"
                  onClick={() => removePlacement(selectedPlacement.id)}
                  className="w-full rounded bg-red-900/60 px-2 py-1 hover:bg-red-800"
                >
                  Entfernen
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {dirty ? 'Ungespeicherte Änderungen vorhanden (Autosave aktiv).' : 'Keine ungespeicherten Änderungen.'}
            {draft.internalCables.length > 0 && (
              <span className="ml-2 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] text-sky-200">
                🔌 {draft.internalCables.length} interne Verbindung{draft.internalCables.length === 1 ? '' : 'en'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setWireDialogOpen(true)}
              disabled={draft.placements.length < 1}
              className="rounded bg-sky-700 px-3 py-1 text-sm text-white hover:bg-sky-600 disabled:opacity-40"
              title="Geräte des Racks intern verkabeln (eigene Canvas-Ansicht)"
            >
              🔌 Intern verkabeln…
            </button>
            <button
              type="button"
              onClick={closeWithConfirm}
              className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={saveRack}
              className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
            >
              Als Rack-Gruppe speichern
            </button>
          </div>
        </div>
      </div>

      {wireDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-6">
          <div className="flex h-[92vh] w-[min(1500px,calc(100vw-1rem))] flex-col rounded border border-slate-700 bg-slate-900 p-3 text-slate-100 shadow-2xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Rack-Verkabelung: {draft.rackName || '(unbenannt)'}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Ziehe Linien Output → Input. Rechtsklick auf Kabel = Menü, Doppelklick = Eigenschaften, Entf = Löschen.
                  Verwendet jetzt die echte Canvas-Komponente — Toolbar, Routing, Waypoints, A*-Routing alles wie im Hauptcanvas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWireDialogOpen(false)}
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600"
              >
                Fertig
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
                    next.push(entry)
                  }
                  setDraft((current) => ({ ...current, internalCables: next }))
                }}
                onPlacementRenamed={(placementId, newName) => {
                  updatePlacement(placementId, { name: newName })
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
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
