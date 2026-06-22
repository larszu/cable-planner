// v7.9.0 / Issue #113 — Betriebsmodi-Editor.
//
// Bisher konnte man nur das AKTUELLE Port-Layout via window.prompt-Name
// als Modus abspeichern. Der User möchte aber einen richtigen Editor in
// dem er Name, Beschreibung, Inputs und Outputs vor dem Speichern
// konfiguriert.
//
// Dieses Dialog ist standalone und bekommt:
//   - das aktuelle Equipment (für "aus aktuellem Layout übernehmen")
//   - einen optionalen initial-Mode (für Bearbeiten eines bestehenden)
//   - einen onSave-Callback der den fertigen Modus zurückgibt
//
// Speichern delegiert an den Caller — der Dialog selbst schreibt
// nichts in den Store. Macht das Komponent eigenständig testbar und
// für Edit + Create wiederverwendbar.

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Icon } from '../shared/Icon'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import { ModalShell } from '../shared/ModalShell'
import { format, useTranslation } from '../../lib/i18n'
import type { ConnectorType, DeviceMode, EquipmentItem, Port } from '../../types/equipment'

export interface ModeEditorDialogProps {
  open: boolean
  equipment: EquipmentItem
  /** When set, dialog opens in EDIT mode and seeds from this mode. */
  editingMode?: DeviceMode | null
  onCancel: () => void
  onSave: (mode: DeviceMode) => void
}

interface PortDraft {
  id: string
  name: string
  connectorType: ConnectorType
}

const toDraft = (p: Port): PortDraft => ({
  id: p.id,
  name: p.name,
  connectorType: p.connectorType,
})

const toPort = (d: PortDraft): Port => ({
  id: d.id,
  name: d.name.trim() || 'Port',
  type: d.connectorType,
  connectorType: d.connectorType,
})

export const ModeEditorDialog = ({
  open,
  equipment,
  editingMode,
  onCancel,
  onSave,
}: ModeEditorDialogProps) => {
  const t = useTranslation()
  const isEditing = !!editingMode
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [powerWatts, setPowerWatts] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [inputs, setInputs] = useState<PortDraft[]>([])
  const [outputs, setOutputs] = useState<PortDraft[]>([])

  // Seed state whenever the dialog opens. Keyed on open + editingMode
  // identity so re-opening with a different mode reseeds cleanly.
  useEffect(() => {
    if (!open) return
    if (editingMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft beim Dialog-Öffnen seeden (keyed sync)
      setName(editingMode.name)
      setDescription(editingMode.description ?? '')
      setPowerWatts(editingMode.powerWatts != null ? String(editingMode.powerWatts) : '')
      setWeightKg(editingMode.weightKg != null ? String(editingMode.weightKg) : '')
      setInputs(editingMode.inputs.map(toDraft))
      setOutputs(editingMode.outputs.map(toDraft))
    } else {
      setName(`Modus ${(equipment.modes ?? []).length + 1}`)
      setDescription('')
      setPowerWatts('')
      setWeightKg('')
      setInputs([])
      setOutputs([])
    }
  }, [open, editingMode, equipment.modes])

  const seedFromCurrent = () => {
    setInputs(equipment.inputs.map(toDraft))
    setOutputs(equipment.outputs.map(toDraft))
  }

  const addPort = (side: 'in' | 'out') => {
    const newDraft: PortDraft = {
      id: uuidv4(),
      name:
        side === 'in'
          ? `In ${inputs.length + 1}`
          : `Out ${outputs.length + 1}`,
      connectorType: 'Custom',
    }
    if (side === 'in') setInputs((cur) => [...cur, newDraft])
    else setOutputs((cur) => [...cur, newDraft])
  }

  const updatePort = (
    side: 'in' | 'out',
    id: string,
    patch: Partial<PortDraft>,
  ) => {
    const updater = (list: PortDraft[]) =>
      list.map((p) => (p.id === id ? { ...p, ...patch } : p))
    if (side === 'in') setInputs(updater)
    else setOutputs(updater)
  }

  const removePort = (side: 'in' | 'out', id: string) => {
    if (side === 'in') setInputs((cur) => cur.filter((p) => p.id !== id))
    else setOutputs((cur) => cur.filter((p) => p.id !== id))
  }

  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    const parseNum = (s: string): number | undefined => {
      const v = Number(s.replace(',', '.'))
      return s.trim() !== '' && Number.isFinite(v) && v >= 0 ? v : undefined
    }
    const mode: DeviceMode = {
      id: editingMode?.id ?? `mode:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      description: description.trim() || undefined,
      powerWatts: parseNum(powerWatts),
      weightKg: parseNum(weightKg),
      inputs: inputs.map(toPort),
      outputs: outputs.map(toPort),
    }
    onSave(mode)
  }

  const totalPortCount = inputs.length + outputs.length
  const existingNames = useMemo(
    () => (equipment.modes ?? []).map((m) => m.name),
    [equipment.modes],
  )
  const nameConflict =
    !isEditing && existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase())

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title={isEditing ? t('modeEditor.titleEdit', 'Modus bearbeiten') : t('modeEditor.titleNew', 'Neuer Betriebsmodus')}
      maxWidth="2xl"
      zIndex={60}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded bg-emerald-600 px-3 py-1 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isEditing ? t('common.save', 'Speichern') : t('modeEditor.createBtn', 'Modus anlegen')}
          </button>
        </div>
      }
    >
      <div className="text-cp-xs">
        {/* Name & description */}
        <div className="space-y-2">
          <label className="block">
            <span className="text-cp-text-muted">{t('common.name', 'Name')}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('modeEditor.namePlaceholder', 'z.B. "12G Single-Link", "4K-Modus", "Workshop-Layout"')}
                autoFocus
                className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-text"
              />
              {nameConflict && (
                <span className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-400">
                  <Icon icon={AlertTriangle} size="xs" />
                  {t('modeEditor.nameConflict', 'Modus mit diesem Namen existiert bereits.')}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-cp-text-muted">{t('modeEditor.descLabel', 'Beschreibung (optional)')}</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t('modeEditor.descPlaceholder', 'z.B. Begrenzt Outputs auf 2 für 4K-Modus (weniger Ressourcen)')}
                className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-text"
              />
            </label>
            {/* #124 — optionale Ressourcen-Werte pro Modus */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-cp-text-muted">{t('modeEditor.powerWatts', 'Leistung (W) in diesem Modus')}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={powerWatts}
                  onChange={(e) => setPowerWatts(e.target.value)}
                  placeholder={t('modeEditor.resourcePlaceholder', 'optional — überschreibt Gerätewert')}
                  className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1 font-mono text-cp-text"
                />
              </label>
              <label className="block">
                <span className="text-cp-text-muted">{t('modeEditor.weightKg', 'Gewicht (kg) in diesem Modus')}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder={t('modeEditor.resourcePlaceholder', 'optional — überschreibt Gerätewert')}
                  className="mt-0.5 w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1 font-mono text-cp-text"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-cp-text-muted">
              {format(
                t('modeEditor.portCount', '{count} Port(s) in diesem Modus'),
                { count: totalPortCount },
              )}
            </div>
            <button
              type="button"
              onClick={seedFromCurrent}
              className="rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5"
              title={t('modeEditor.seedTitle', 'Übernimmt das AKTUELLE Port-Layout des Geräts als Startpunkt.')}
            >
              <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('modeEditor.seedBtn', 'Aus aktuellem Geräte-Layout übernehmen')}
            </button>
          </div>

          {/* Two columns: Inputs and Outputs */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {(
              [
                { side: 'in', label: t('ports.title.inputs', 'Inputs'), list: inputs, accent: 'cyan' },
                { side: 'out', label: t('ports.title.outputs', 'Outputs'), list: outputs, accent: 'emerald' },
              ] as const
            ).map(({ side, label, list, accent }) => (
              <div
                key={side}
                className="rounded border border-cp-border-muted bg-cp-surface-3/40 p-2"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${
                    accent === 'cyan' ? 'text-cyan-300' : 'text-emerald-300'
                  }`}>
                    {label} ({list.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => addPort(side)}
                    className="rounded bg-cp-surface-2 px-2 py-0.5 text-[10px] text-cp-text-secondary hover:bg-cp-surface-4"
                  >
                    + {t('modeEditor.addPort', 'Port')}
                  </button>
                </div>
                {list.length === 0 ? (
                  <div className="rounded border border-dashed border-cp-border p-3 text-center text-[10px] text-cp-text-muted">
                    {format(t('modeEditor.emptySide', 'Keine {kind} in diesem Modus.'), { kind: label.toLowerCase() })}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-1 rounded border border-cp-border-muted bg-cp-surface-1/60 p-1"
                      >
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updatePort(side, p.id, { name: e.target.value })}
                          placeholder={t('ports.namePlaceholder', 'Port-Name')}
                          className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-1.5 py-0.5 text-[11px]"
                        />
                        <select
                          value={p.connectorType}
                          onChange={(e) =>
                            updatePort(side, p.id, {
                              connectorType: e.target.value as ConnectorType,
                            })
                          }
                          className="w-28 rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-[10px]"
                        >
                          {ALL_CONNECTOR_TYPES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removePort(side, p.id)}
                          className="rounded px-1 py-0.5 text-[11px] text-red-400 hover:bg-red-900/40"
                          title={t('modeEditor.removePort', 'Port entfernen')}
                          aria-label={t('modeEditor.removePort', 'Port entfernen')}
                        >
                          <Icon icon={X} size="sm" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
    </ModalShell>
  )
}
