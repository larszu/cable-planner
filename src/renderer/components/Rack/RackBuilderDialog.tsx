import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'

interface RackBuilderDialogProps {
  open: boolean
  templates: EquipmentTemplate[]
  onClose: () => void
  onSave: (preset: GroupPreset) => void
}

interface RackPlacementDraft {
  id: string
  templateName: string
  startUnit: number
}

const ROW_HEIGHT = 22

const parseUnits = (template?: EquipmentTemplate): number => {
  const raw = template?.rackUnits
  if (!raw || Number.isNaN(raw)) return 1
  return Math.max(1, Math.round(raw))
}

const formatRackUnits = (value: number): string => `${value} HE`

export const RackBuilderDialog = ({ open, templates, onClose, onSave }: RackBuilderDialogProps) => {
  const [rackName, setRackName] = useState('Neues Rack')
  const [totalUnits, setTotalUnits] = useState(42)
  const [query, setQuery] = useState('')
  const [placements, setPlacements] = useState<RackPlacementDraft[]>([])

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = templates
      .slice()
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`))
    if (!q) return sorted
    return sorted.filter((t) => `${t.name} ${t.category}`.toLowerCase().includes(q))
  }, [query, templates])

  const draftWithTemplate = useMemo(() => {
    return placements.map((placement) => ({
      ...placement,
      template: templates.find((t) => t.name === placement.templateName),
    }))
  }, [placements, templates])

  const isOverlapping = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
    aStart <= bEnd && bStart <= aEnd

  const conflicts = useMemo(() => {
    const issues: string[] = []
    for (const placement of draftWithTemplate) {
      const units = parseUnits(placement.template)
      if (placement.startUnit < 1) {
        issues.push(`${placement.templateName}: Start-HE muss >= 1 sein.`)
      }
      if (placement.startUnit + units - 1 > totalUnits) {
        issues.push(
          `${placement.templateName}: ${formatRackUnits(units)} passt nicht ab HE ${placement.startUnit} in ${formatRackUnits(totalUnits)}.`,
        )
      }
    }
    for (let i = 0; i < draftWithTemplate.length; i += 1) {
      for (let j = i + 1; j < draftWithTemplate.length; j += 1) {
        const a = draftWithTemplate[i]
        const b = draftWithTemplate[j]
        const aUnits = parseUnits(a.template)
        const bUnits = parseUnits(b.template)
        if (
          isOverlapping(
            a.startUnit,
            a.startUnit + aUnits - 1,
            b.startUnit,
            b.startUnit + bUnits - 1,
          )
        ) {
          issues.push(`${a.templateName} überlappt mit ${b.templateName}.`)
        }
      }
    }
    return issues
  }, [draftWithTemplate, totalUnits])

  const addTemplate = (template: EquipmentTemplate) => {
    const units = parseUnits(template)
    let targetUnit = 1
    const occupied = draftWithTemplate
      .map((item) => ({ start: item.startUnit, end: item.startUnit + parseUnits(item.template) - 1 }))
      .sort((a, b) => a.start - b.start)
    for (const block of occupied) {
      if (targetUnit + units - 1 < block.start) break
      targetUnit = block.end + 1
    }
    if (targetUnit + units - 1 > totalUnits) {
      targetUnit = Math.max(1, totalUnits - units + 1)
    }
    setPlacements((current) => [...current, { id: uuidv4(), templateName: template.name, startUnit: targetUnit }])
  }

  const updatePlacement = (id: string, patch: Partial<RackPlacementDraft>) => {
    setPlacements((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removePlacement = (id: string) => {
    setPlacements((current) => current.filter((item) => item.id !== id))
  }

  const saveRack = () => {
    if (!rackName.trim()) {
      window.alert('Bitte Rack-Name angeben.')
      return
    }
    if (draftWithTemplate.length === 0) {
      window.alert('Bitte mindestens ein Gerät ins Rack legen.')
      return
    }
    if (conflicts.length > 0) {
      window.alert(`Rack hat Konflikte:\n\n- ${conflicts.join('\n- ')}`)
      return
    }

    const sorted = draftWithTemplate
      .slice()
      .sort((a, b) => a.startUnit - b.startUnit)

    const itemRecords: GroupPreset['items'] = sorted.map((placement) => {
      const template = placement.template
      if (!template) {
        throw new Error(`Template not found: ${placement.templateName}`)
      }
      const units = parseUnits(template)
      return {
        ...template,
        rackUnits: units,
        offsetX: 0,
        offsetY: (placement.startUnit - 1) * 44,
      }
    })

    const rackPlacements = sorted.map((placement, index) => ({
      itemIndex: index,
      startUnit: placement.startUnit,
      heightUnits: parseUnits(placement.template),
    }))

    onSave({
      id: uuidv4(),
      name: rackName.trim(),
      rack: {
        totalUnits,
        placements: rackPlacements,
      },
      items: itemRecords,
      cables: [],
    })
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">2D Rack Builder</h3>
            <p className="mt-1 text-xs text-slate-400">
              Geräte in Rack-Slots (HE) anordnen und als Gruppen-Preset speichern.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Schließen
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <label className="block text-sm">
            Rack-Name
            <input
              value={rackName}
              onChange={(event) => setRackName(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <label className="block text-sm">
            Rack-Höhe (HE)
            <input
              type="number"
              min={1}
              max={60}
              value={totalUnits}
              onChange={(event) => setTotalUnits(Math.max(1, Number(event.target.value) || 1))}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <div className="rounded border border-slate-700 bg-slate-950/60 p-2 text-xs text-slate-400">
            Slots laufen oben nach unten in HE. Geräte mit leerem Rackmaß gelten als 1 HE.
          </div>
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

        <div className="grid grid-cols-[340px_1fr] gap-3">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Geräte aus Library
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Suchen…"
              className="mb-2 w-full rounded border border-slate-700 bg-slate-950 p-1.5 text-xs"
            />
            <div className="max-h-[58vh] space-y-1 overflow-auto">
              {filteredTemplates.map((template) => {
                const units = parseUnits(template)
                return (
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
                      {units} HE · {template.inputs.length} In · {template.outputs.length} Out
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Rack-Layout
            </div>
            <div className="grid grid-cols-[1fr_300px] gap-2">
              <div className="space-y-1">
                {draftWithTemplate.length === 0 ? (
                  <div className="rounded border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
                    Noch keine Geräte platziert.
                  </div>
                ) : (
                  draftWithTemplate
                    .slice()
                    .sort((a, b) => a.startUnit - b.startUnit)
                    .map((item) => {
                      const units = parseUnits(item.template)
                      return (
                        <div key={item.id} className="rounded border border-slate-800 bg-slate-900/60 p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-slate-100">{item.templateName}</span>
                            <button
                              type="button"
                              onClick={() => removePlacement(item.id)}
                              className="rounded bg-red-900/60 px-2 py-0.5 hover:bg-red-800"
                            >
                              Entfernen
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label>
                              Start-HE
                              <input
                                type="number"
                                min={1}
                                max={totalUnits}
                                value={item.startUnit}
                                onChange={(event) =>
                                  updatePlacement(item.id, {
                                    startUnit: Math.max(1, Number(event.target.value) || 1),
                                  })
                                }
                                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-1"
                              />
                            </label>
                            <div>
                              Höhe
                              <div className="mt-1 rounded border border-slate-700 bg-slate-950 p-1 text-slate-300">
                                {units} HE
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>

              <div className="rounded border border-slate-800 bg-slate-950 p-2">
                <div
                  className="relative overflow-hidden rounded border border-slate-700 bg-slate-900"
                  style={{ height: totalUnits * ROW_HEIGHT }}
                >
                  {Array.from({ length: totalUnits }).map((_row, index) => {
                    const unit = index + 1
                    return (
                      <div
                        key={`grid-${unit}`}
                        className="absolute left-0 right-0 border-t border-slate-800/80"
                        style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                      >
                        <span className="absolute left-1 top-0.5 text-[9px] text-slate-600">U{unit}</span>
                      </div>
                    )
                  })}

                  {draftWithTemplate.map((item) => {
                    const units = parseUnits(item.template)
                    const top = (item.startUnit - 1) * ROW_HEIGHT
                    const height = units * ROW_HEIGHT
                    return (
                      <div
                        key={`block-${item.id}`}
                        className="absolute left-8 right-2 overflow-hidden rounded border border-sky-600/70 bg-sky-900/40"
                        style={{ top, height }}
                        title={`${item.templateName} (${units} HE)`}
                      >
                        {item.template?.frontPanelImageUrl ? (
                          <img
                            src={item.template.frontPanelImageUrl}
                            alt={item.templateName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold text-sky-100">
                            {item.templateName}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
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
  )
}
