import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { useSettingsStore } from '../../store/settingsStore'

interface RackBuilderDialogProps {
  open: boolean
  templates: EquipmentTemplate[]
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
}

const ROW_HEIGHT = 22
const RACK_PANEL_ASPECT_PER_1HE = 10.86
const RACK_PANEL_WIDTH = Math.round(ROW_HEIGHT * RACK_PANEL_ASPECT_PER_1HE)
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

const normalizeDraft = (draft: RackDraft): RackDraft => ({
  ...draft,
  rackName: draft.rackName.trim() || 'Neues Rack',
  totalUnits: Math.max(1, Math.min(60, Math.round(draft.totalUnits) || 42)),
  placements: draft.placements.map((p) => ({
    ...p,
    startUnit: Math.max(1, Math.round(p.startUnit) || 1),
    rackUnits: Math.max(1, Math.round(p.rackUnits) || 1),
  })),
})

const formatRackUnits = (value: number): string => `${value} HE`

export const RackBuilderDialog = ({ open, templates, onClose, onSave }: RackBuilderDialogProps) => {
  const autosaveIntervalMs = useSettingsStore((state) => state.autosaveIntervalMs)
  const [draft, setDraft] = useState<RackDraft>({
    rackName: 'Neues Rack',
    totalUnits: 42,
    viewMode: 'front',
    placements: [],
  })
  const [query, setQuery] = useState('')
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('')
  const [dragState, setDragState] = useState<
    { placementId: string; offsetUnits: number; pointerId: number } | null
  >(null)
  const rackCanvasRef = useRef<HTMLDivElement | null>(null)

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = templates
      .filter((template) => template.isRackDevice || template.rackUnits)
      .slice()
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`))
    if (!q) return sorted
    return sorted.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(q))
  }, [query, templates])

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
        issues.push(`${placement.name}: ist nicht als Rack-Gerat markiert.`)
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
          issues.push(`${a.name} uberlappt mit ${b.name}.`)
        }
      }
    }
    return issues
  }, [draft])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, draftSnapshot)
      } catch {
        /* ignore */
      }
    }, Math.max(100, autosaveIntervalMs || 400))
    return () => window.clearTimeout(timer)
  }, [autosaveIntervalMs, draftSnapshot, open])

  const closeWithConfirm = () => {
    if (dirty && !window.confirm('Ungespeicherte Rack-Anderungen verwerfen und schliessen?')) return
    onClose()
  }

  const addTemplate = (template: EquipmentTemplate) => {
    const units = parseUnits(template)
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
    const placement = toPlacement(template, targetUnit)
    setDraft((current) => ({ ...current, placements: [...current.placements, placement] }))
    setSelectedPlacementId(placement.id)
  }

  const updatePlacement = (id: string, patch: Partial<RackPlacementDraft>) => {
    setDraft((current) => ({
      ...current,
      placements: current.placements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }

  const removePlacement = (id: string) => {
    setDraft((current) => ({
      ...current,
      placements: current.placements.filter((item) => item.id !== id),
    }))
    if (selectedPlacementId === id) setSelectedPlacementId(null)
  }

  const saveRack = () => {
    if (!draft.rackName.trim()) {
      window.alert('Bitte Rack-Name angeben.')
      return
    }
    if (draft.placements.length === 0) {
      window.alert('Bitte mindestens ein Gerat ins Rack legen.')
      return
    }
    if (conflicts.length > 0) {
      window.alert(`Rack hat Konflikte:\n\n- ${conflicts.join('\n- ')}`)
      return
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

    const preset: GroupPreset = {
      id: uuidv4(),
      name: draft.rackName.trim(),
      rack: {
        totalUnits: draft.totalUnits,
        placements: rackPlacements,
      },
      items: itemRecords,
      cables: [],
    }

    onSave(preset)
    setLastSavedSnapshot(draftSnapshot)
    try {
      localStorage.setItem(DRAFT_KEY, draftSnapshot)
    } catch {
      /* ignore */
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[94vh] w-full max-w-7xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">2D Rack Builder</h3>
            <p className="mt-1 text-xs text-slate-400">HE-Slots, Drag-and-Drop nach oben/unten, Front/Rear Ansicht, Port-Sichtbarkeit.</p>
          </div>
          <button type="button" onClick={closeWithConfirm} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Schliessen
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <label className="block text-sm">
            Rack-Name
            <input
              value={draft.rackName}
              onChange={(event) => setDraft((current) => ({ ...current, rackName: event.target.value }))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <label className="block text-sm">
            Rack-Hohe (HE)
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
        </div>

        {conflicts.length > 0 && (
          <div className="mb-3 rounded border border-red-700/60 bg-red-900/30 px-3 py-2 text-xs text-red-100">
            <div className="font-semibold">Konflikte</div>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {conflicts.map((issue, index) => (
                <li key={`${issue}-${index}`}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-[320px_1fr_320px] gap-3">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rack-Gerate aus Library</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suchen..."
              className="mb-2 w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
            />
            <div className="max-h-[58vh] space-y-1 overflow-auto">
              {filteredTemplates.map((template) => (
                <div key={template.name} className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-100">{template.name}</div>
                      <div className="truncate text-[10px] text-slate-500">{template.category}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTemplate(template)}
                      className="rounded bg-emerald-700 px-2 py-0.5 text-[11px] hover:bg-emerald-600"
                    >
                      + Rack
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-400">
                    {parseUnits(template)} HE · {template.inputs.length} In · {template.outputs.length} Out
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Rack-Slots (Drag & Drop hoch/runter)</div>
            <div
              ref={rackCanvasRef}
              className={`grid gap-2 ${draft.viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              {(draft.viewMode === 'both' ? ['front', 'rear'] : [draft.viewMode]).map((side) => (
                <div key={side} className="rounded border border-slate-800 bg-slate-950 p-2">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-400">{side === 'front' ? 'Front' : 'Rear'}</div>
                  <div
                    className="relative overflow-hidden rounded border border-slate-700 bg-slate-900"
                    style={{ height: draft.totalUnits * ROW_HEIGHT }}
                    onPointerMove={(event) => {
                      if (!dragState || dragState.pointerId !== event.pointerId) return
                      const host = event.currentTarget.getBoundingClientRect()
                      const y = clamp(event.clientY - host.top, 0, host.height)
                      const unitAtPointer = Math.max(1, Math.min(draft.totalUnits, Math.floor(y / ROW_HEIGHT) + 1))
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
                          style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                        >
                          <span className="absolute left-1 top-0.5 text-[9px] text-slate-600">U{unit}</span>
                        </div>
                      )
                    })}

                    {draft.placements.map((item) => {
                      const top = (item.startUnit - 1) * ROW_HEIGHT
                      const height = item.rackUnits * ROW_HEIGHT
                      const image = side === 'front' ? item.frontPanelImageUrl : item.rearPanelImageUrl
                      return (
                        <div
                          key={`${side}-block-${item.id}`}
                          className={`absolute overflow-hidden rounded border ${selectedPlacementId === item.id ? 'border-amber-400 bg-amber-900/30' : 'border-sky-600/70 bg-sky-900/40'}`}
                          style={{ top, height, left: '50%', width: RACK_PANEL_WIDTH, transform: 'translateX(-50%)' }}
                          title={`${item.name} (${item.rackUnits} HE)`}
                          onPointerDown={(event) => {
                            event.preventDefault()
                            const host = event.currentTarget.parentElement?.getBoundingClientRect()
                            if (!host) return
                            const pointerUnit = Math.max(1, Math.min(draft.totalUnits, Math.floor((event.clientY - host.top) / ROW_HEIGHT) + 1))
                            setSelectedPlacementId(item.id)
                            setDragState({ placementId: item.id, offsetUnits: pointerUnit - item.startUnit, pointerId: event.pointerId })
                          }}
                          onClick={() => setSelectedPlacementId(item.id)}
                        >
                          {image ? (
                            <img src={image} alt={`${item.name} ${side}`} className="h-full w-full object-contain" />
                          ) : (
                            <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold text-sky-100">{item.name}</div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
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

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Gerate-Properties im Rack</div>
            {!selectedPlacement ? (
              <div className="rounded border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">Gerat im Rack anklicken.</div>
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
                  <select
                    value={selectedPlacement.category}
                    onChange={(event) => {
                      const value = event.target.value
                      if (value === '__new__') {
                        const entered = window.prompt('Neue Kategorie')?.trim()
                        if (entered) updatePlacement(selectedPlacement.id, { category: entered })
                        return
                      }
                      updatePlacement(selectedPlacement.id, { category: value })
                    }}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {!categoryOptions.includes(selectedPlacement.category) && selectedPlacement.category && (
                      <option value={selectedPlacement.category}>{selectedPlacement.category}</option>
                    )}
                    <option value="__new__">+ Neue Kategorie…</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPlacement.isRackDevice}
                    onChange={(event) => updatePlacement(selectedPlacement.id, { isRackDevice: event.target.checked })}
                  />
                  <span>Ist Rack-Gerat</span>
                </label>
                <label className="block">
                  Hohe (HE)
                  <input
                    type="number"
                    min={1}
                    max={draft.totalUnits}
                    value={selectedPlacement.rackUnits}
                    onChange={(event) => updatePlacement(selectedPlacement.id, { rackUnits: Math.max(1, Number(event.target.value) || 1) })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <label className="block">
                  Start-HE
                  <input
                    type="number"
                    min={1}
                    max={draft.totalUnits}
                    value={selectedPlacement.startUnit}
                    onChange={(event) => updatePlacement(selectedPlacement.id, { startUnit: Math.max(1, Number(event.target.value) || 1) })}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1.5"
                  />
                </label>
                <div className="rounded border border-slate-800 bg-slate-900/40 p-2 text-[11px] text-slate-400">
                  Ports sichtbar: {selectedPlacement.inputs.length} Inputs / {selectedPlacement.outputs.length} Outputs
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">Panel-Bilder</div>
                  {(['front', 'rear'] as const).map((side) => {
                    const urlKey = side === 'front' ? 'frontPanelImageUrl' : 'rearPanelImageUrl'
                    const currentUrl = selectedPlacement[urlKey]
                    return (
                      <div key={side} className="flex items-center gap-2">
                        <span className="w-12 text-[10px] text-slate-500 capitalize">{side === 'front' ? 'Vorne' : 'Hinten'}</span>
                        <label className="cursor-pointer rounded bg-slate-700 px-2 py-0.5 text-[10px] hover:bg-slate-600">
                          {currentUrl ? 'Ändern' : '+ Bild'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = () => updatePlacement(selectedPlacement.id, { [urlKey]: reader.result as string })
                              reader.readAsDataURL(file)
                            }}
                          />
                        </label>
                        {currentUrl && (
                          <button
                            type="button"
                            onClick={() => updatePlacement(selectedPlacement.id, { [urlKey]: undefined })}
                            className="text-[10px] text-red-400 hover:text-red-300"
                            title="Bild entfernen"
                          >
                            ✕
                          </button>
                        )}
                        {currentUrl && (
                          <img src={currentUrl} alt={`${side} panel`} className="h-6 rounded border border-slate-700 object-contain" style={{ maxWidth: 60 }} />
                        )}
                      </div>
                    )
                  })}
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

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">{dirty ? 'Ungespeicherte Anderungen vorhanden (Autosave aktiv).' : 'Keine ungespeicherten Anderungen.'}</div>
          <div className="flex gap-2">
            <button type="button" onClick={closeWithConfirm} className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600">
              Abbrechen
            </button>
            <button type="button" onClick={saveRack} className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500">
              Als Rack-Gruppe speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
