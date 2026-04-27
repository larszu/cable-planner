import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, Port } from '../../types/equipment'

interface TemplateMergeDialogProps {
  open: boolean
  localTemplate: EquipmentTemplate | null
  incomingTemplate: EquipmentTemplate | null
  incomingLabel: string
  categoryOptions: string[]
  initialCategory?: string
  onCancel: () => void
  onConfirm: (merged: EquipmentTemplate) => void
}

const clonePort = (port: Port): Port => ({
  ...port,
  id: uuidv4(),
})

const makePortKey = (source: 'local' | 'incoming', side: 'in' | 'out', portId: string) =>
  `${source}:${side}:${portId}`

export const TemplateMergeDialog = ({
  open,
  localTemplate,
  incomingTemplate,
  incomingLabel,
  categoryOptions,
  initialCategory,
  onCancel,
  onConfirm,
}: TemplateMergeDialogProps) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (!open || !localTemplate) return
    const defaults = new Set<string>()
    for (const port of localTemplate.inputs) {
      defaults.add(makePortKey('local', 'in', port.id))
    }
    for (const port of localTemplate.outputs) {
      defaults.add(makePortKey('local', 'out', port.id))
    }
    setSelectedKeys(defaults)
    setCategory(initialCategory ?? localTemplate.category ?? categoryOptions[0] ?? '')
  }, [open, localTemplate, initialCategory, categoryOptions])

  const toggle = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedCount = selectedKeys.size

  const selectedTemplatePreview = useMemo(() => {
    if (!localTemplate || !incomingTemplate) return { inputs: 0, outputs: 0 }
    const inCount =
      localTemplate.inputs.filter((p) => selectedKeys.has(makePortKey('local', 'in', p.id))).length +
      incomingTemplate.inputs.filter((p) => selectedKeys.has(makePortKey('incoming', 'in', p.id))).length
    const outCount =
      localTemplate.outputs.filter((p) => selectedKeys.has(makePortKey('local', 'out', p.id))).length +
      incomingTemplate.outputs.filter((p) => selectedKeys.has(makePortKey('incoming', 'out', p.id))).length
    return { inputs: inCount, outputs: outCount }
  }, [incomingTemplate, localTemplate, selectedKeys])

  const buildMergedTemplate = (): EquipmentTemplate | null => {
    if (!localTemplate || !incomingTemplate) return null

    const mergedInputs = [
      ...localTemplate.inputs
        .filter((port) => selectedKeys.has(makePortKey('local', 'in', port.id)))
        .map(clonePort),
      ...incomingTemplate.inputs
        .filter((port) => selectedKeys.has(makePortKey('incoming', 'in', port.id)))
        .map(clonePort),
    ]
    const mergedOutputs = [
      ...localTemplate.outputs
        .filter((port) => selectedKeys.has(makePortKey('local', 'out', port.id)))
        .map(clonePort),
      ...incomingTemplate.outputs
        .filter((port) => selectedKeys.has(makePortKey('incoming', 'out', port.id)))
        .map(clonePort),
    ]

    const maxPorts = Math.max(mergedInputs.length, mergedOutputs.length, 3)
    return {
      ...localTemplate,
      category: category || localTemplate.category,
      inputs: mergedInputs,
      outputs: mergedOutputs,
      rackUnits: incomingTemplate.rackUnits ?? localTemplate.rackUnits,
      netboxPath: incomingTemplate.netboxPath ?? localTemplate.netboxPath,
      frontPanelImageUrl: incomingTemplate.frontPanelImageUrl ?? localTemplate.frontPanelImageUrl,
      rearPanelImageUrl: incomingTemplate.rearPanelImageUrl ?? localTemplate.rearPanelImageUrl,
      width: Math.max(localTemplate.width || 220, incomingTemplate.width || 220),
      height: 80 + maxPorts * 22,
      notes: [localTemplate.notes, incomingTemplate.notes].filter(Boolean).join('\n'),
    }
  }

  if (!open || !localTemplate || !incomingTemplate) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Gerate zusammenfuhren</h3>
            <p className="text-xs text-slate-400">
              Wahlen, welche Inputs/Outputs aus Lokal und {incomingLabel} ubernommen werden.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Schliessen
          </button>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
          <label className="block">
            Zielkategorie
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="">Bitte wahlen...</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="text-slate-400">Gewahlte Ports</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{selectedCount}</div>
          </div>
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="text-slate-400">Vorschau</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {selectedTemplatePreview.inputs} In / {selectedTemplatePreview.outputs} Out
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Lokal</div>
            <div className="mb-1 text-[11px] text-slate-500">{localTemplate.name}</div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">Inputs</div>
                <div className="space-y-1">
                  {localTemplate.inputs.map((port) => {
                    const key = makePortKey('local', 'in', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-500">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">Outputs</div>
                <div className="space-y-1">
                  {localTemplate.outputs.map((port) => {
                    const key = makePortKey('local', 'out', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-500">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{incomingLabel}</div>
            <div className="mb-1 text-[11px] text-slate-500">{incomingTemplate.name}</div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">Inputs</div>
                <div className="space-y-1">
                  {incomingTemplate.inputs.map((port) => {
                    const key = makePortKey('incoming', 'in', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-500">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">Outputs</div>
                <div className="space-y-1">
                  {incomingTemplate.outputs.map((port) => {
                    const key = makePortKey('incoming', 'out', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-500">{port.connectorType}</span>
                      </label>
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
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => {
              const merged = buildMergedTemplate()
              if (!merged) return
              if (!category) {
                window.alert('Bitte Zielkategorie auswahlen.')
                return
              }
              if (merged.inputs.length === 0 && merged.outputs.length === 0) {
                window.alert('Bitte mindestens einen Port auswahlen.')
                return
              }
              onConfirm(merged)
            }}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
          >
            Merge speichern
          </button>
        </div>
      </div>
    </div>
  )
}
