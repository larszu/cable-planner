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
import { v4 as uuidv4 } from 'uuid'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
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
  const isEditing = !!editingMode
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [inputs, setInputs] = useState<PortDraft[]>([])
  const [outputs, setOutputs] = useState<PortDraft[]>([])

  // Seed state whenever the dialog opens. Keyed on open + editingMode
  // identity so re-opening with a different mode reseeds cleanly.
  useEffect(() => {
    if (!open) return
    if (editingMode) {
      setName(editingMode.name)
      setDescription(editingMode.description ?? '')
      setInputs(editingMode.inputs.map(toDraft))
      setOutputs(editingMode.outputs.map(toDraft))
    } else {
      setName(`Modus ${(equipment.modes ?? []).length + 1}`)
      setDescription('')
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
    const mode: DeviceMode = {
      id: editingMode?.id ?? `mode:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name: name.trim(),
      description: description.trim() || undefined,
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-2">
          <h3 className="text-sm font-semibold">
            {isEditing ? 'Modus bearbeiten' : 'Neuer Betriebsmodus'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4 text-xs">
          {/* Name & description */}
          <div className="space-y-2">
            <label className="block">
              <span className="text-slate-400">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='z.B. "12G Single-Link", "4K-Modus", "Workshop-Layout"'
                autoFocus
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              />
              {nameConflict && (
                <span className="mt-0.5 block text-[10px] text-amber-400">
                  ⚠ Modus mit diesem Namen existiert bereits.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-slate-400">Beschreibung (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="z.B. Begrenzt Outputs auf 2 für 4K-Modus (weniger Ressourcen)"
                className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10px] text-slate-500">
              {totalPortCount} {totalPortCount === 1 ? 'Port' : 'Ports'} in diesem Modus
            </div>
            <button
              type="button"
              onClick={seedFromCurrent}
              className="rounded bg-slate-700 px-2 py-1 text-[11px] hover:bg-slate-600"
              title="Übernimmt das AKTUELLE Port-Layout des Geräts als Startpunkt."
            >
              ⬇ Aus aktuellem Geräte-Layout übernehmen
            </button>
          </div>

          {/* Two columns: Inputs and Outputs */}
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {(
              [
                { side: 'in', label: 'Inputs', list: inputs, accent: 'cyan' },
                { side: 'out', label: 'Outputs', list: outputs, accent: 'emerald' },
              ] as const
            ).map(({ side, label, list, accent }) => (
              <div
                key={side}
                className="rounded border border-slate-800 bg-slate-950/40 p-2"
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
                    className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-700"
                  >
                    + Port
                  </button>
                </div>
                {list.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-700 p-3 text-center text-[10px] text-slate-500">
                    Keine {label.toLowerCase()} in diesem Modus.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {list.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-1 rounded border border-slate-800 bg-slate-900/60 p-1"
                      >
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => updatePort(side, p.id, { name: e.target.value })}
                          placeholder="Port-Name"
                          className="flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px]"
                        />
                        <select
                          value={p.connectorType}
                          onChange={(e) =>
                            updatePort(side, p.id, {
                              connectorType: e.target.value as ConnectorType,
                            })
                          }
                          className="w-28 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-[10px]"
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
                          title="Port entfernen"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isEditing ? 'Speichern' : 'Modus anlegen'}
          </button>
        </footer>
      </div>
    </div>
  )
}
