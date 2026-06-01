import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, Port } from '../../types/equipment'
import { infoDialog } from '../../lib/infoDialog'
import { ModalShell } from '../shared/ModalShell'
import { Button } from '../shared/Button'
import { format, useTranslation } from '../../lib/i18n'

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
  const t = useTranslation()
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Auswahl/Kategorie beim Dialog-Öffnen seeden (keyed sync)
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

  if (!localTemplate || !incomingTemplate) return null

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={t('templateMerge.title', 'Geräte zusammenführen')}
      maxWidth="4xl"
      zIndex={80}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel', 'Abbrechen')}
          </Button>
          <Button
            variant="success"
            onClick={() => {
              const merged = buildMergedTemplate()
              if (!merged) return
              if (!category) {
                void infoDialog(t('templateMerge.needCategoryTitle', 'Kategorie wählen'), {
                  body: t('templateMerge.needCategoryBody', 'Bitte Zielkategorie auswählen.'),
                  tone: 'warning',
                })
                return
              }
              if (merged.inputs.length === 0 && merged.outputs.length === 0) {
                void infoDialog(t('templateMerge.needPortTitle', 'Port wählen'), {
                  body: t('templateMerge.needPortBody', 'Bitte mindestens einen Port auswählen.'),
                  tone: 'warning',
                })
                return
              }
              onConfirm(merged)
            }}
          >
            {t('templateMerge.save', 'Merge speichern')}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-cp-xs text-slate-400">
        {format(
          t(
            'templateMerge.intro',
            'Wählen, welche Inputs/Outputs aus Lokal und {label} übernommen werden.',
          ),
          { label: incomingLabel },
        )}
      </p>

      <div className="mb-3 grid grid-cols-3 gap-2 text-cp-xs">
          <label className="block">
            {t('templateMerge.targetCategory', 'Zielkategorie')}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              <option value="">{t('templateMerge.pleaseSelect', 'Bitte wählen...')}</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="text-slate-400">{t('templateMerge.selectedPorts', 'Gewählte Ports')}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{selectedCount}</div>
          </div>
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="text-slate-400">{t('templateMerge.preview', 'Vorschau')}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">
              {format(t('templateMerge.previewCounts', '{in} In / {out} Out'), {
                in: selectedTemplatePreview.inputs,
                out: selectedTemplatePreview.outputs,
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('templateMerge.local', 'Lokal')}
            </div>
            <div className="mb-1 text-[11px] text-slate-400">{localTemplate.name}</div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">{t('templateMerge.inputs', 'Inputs')}</div>
                <div className="space-y-1">
                  {localTemplate.inputs.map((port) => {
                    const key = makePortKey('local', 'in', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-cp-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">{t('templateMerge.outputs', 'Outputs')}</div>
                <div className="space-y-1">
                  {localTemplate.outputs.map((port) => {
                    const key = makePortKey('local', 'out', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-cp-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-700 bg-slate-950/50 p-2">
            <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-slate-400">{incomingLabel}</div>
            <div className="mb-1 text-[11px] text-slate-400">{incomingTemplate.name}</div>
            <div className="space-y-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">{t('templateMerge.inputs', 'Inputs')}</div>
                <div className="space-y-1">
                  {incomingTemplate.inputs.map((port) => {
                    const key = makePortKey('incoming', 'in', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-cp-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-300">{t('templateMerge.outputs', 'Outputs')}</div>
                <div className="space-y-1">
                  {incomingTemplate.outputs.map((port) => {
                    const key = makePortKey('incoming', 'out', port.id)
                    return (
                      <label key={key} className="flex items-center gap-2 rounded px-1 py-0.5 text-cp-xs hover:bg-slate-900">
                        <input type="checkbox" checked={selectedKeys.has(key)} onChange={() => toggle(key)} />
                        <span className="truncate">{port.name}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{port.connectorType}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

    </ModalShell>
  )
}
