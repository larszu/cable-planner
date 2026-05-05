import { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import type { AtemAudioConfig, AtemAudioSourceConfig } from '../../types/equipment'

/**
 * Issue #45 — ATEM Fairlight audio router. Offline-editable matrix of
 * audio sources × main-bus settings (gain, balance, on-air mode).
 *
 * Sources are seeded from the equipment's input ports so the user has
 * something concrete to work with even without a live ATEM connection.
 * Once the bridge gains a setFairlightMixerSourceProperties IPC, the
 * "Apply" path here will push these values to the live ATEM. For now,
 * "Save" only persists to the project file. This is the Fairlight-Live-
 * style planning surface the issue asked for; live push is follow-up.
 */
export const AtemAudioRouterDialog = () => {
  const { open, deviceId } = useUiStore((s) => s.atemAudioConfig)
  const close = useUiStore((s) => s.closeAtemAudioConfig)
  const equipment = useProjectStore((s) =>
    s.project.equipment.find((e) => e.id === deviceId),
  )
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const drag = useDraggablePosition('cable-planner:modal-pos:atem-audio', open)

  const seededSources = useMemo<AtemAudioSourceConfig[]>(() => {
    if (!equipment) return []
    const stored = equipment.atemAudioConfig?.sources ?? []
    if (stored.length > 0) return stored
    // Seed from the equipment's audio-bearing input ports.
    return equipment.inputs
      .filter((p) => /xlr|trs|aes|adat|madi|dante|audio/i.test(p.connectorType))
      .map((p, i) => ({
        sourceId: i + 1,
        label: p.name,
        mainGain: 0,
        balance: 0,
        onAir: 'afv' as const,
      }))
  }, [equipment])

  const [draft, setDraft] = useState<AtemAudioSourceConfig[]>(seededSources)
  useEffect(() => {
    if (open) setDraft(seededSources)
  }, [open, seededSources])

  if (!open || !equipment) return null

  const update = (sourceId: number, patch: Partial<AtemAudioSourceConfig>) =>
    setDraft((prev) =>
      prev.map((s) => (s.sourceId === sourceId ? { ...s, ...patch } : s)),
    )

  const addSource = () =>
    setDraft((prev) => [
      ...prev,
      {
        sourceId: prev.length === 0 ? 1 : Math.max(...prev.map((s) => s.sourceId)) + 1,
        label: `Source ${prev.length + 1}`,
        mainGain: 0,
        balance: 0,
        onAir: 'afv',
      },
    ])

  const removeSource = (sourceId: number) =>
    setDraft((prev) => prev.filter((s) => s.sourceId !== sourceId))

  const save = () => {
    const config: AtemAudioConfig = { sources: draft }
    updateEquipment(equipment.id, { atemAudioConfig: config })
    close()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="flex w-full max-w-3xl flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <header
          {...drag.headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-2 select-none"
        >
          <h2 className="text-base font-semibold">
            ATEM Audio-Router — {equipment.name}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Schließen
          </button>
        </header>

        <main className="max-h-[70vh] overflow-auto p-4">
          <p className="mb-3 text-xs text-slate-400">
            Fairlight-style Routing-Matrix: Quellen × Main-Bus. Werden im
            Projekt gespeichert. Live-Push zum ATEM ist Folge-Arbeit; aktuell
            wird nur die Konfiguration persistiert.
          </p>

          <table className="w-full border-collapse text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-700">
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Bezeichnung</th>
                <th className="px-2 py-1 text-right">Gain (dB)</th>
                <th className="px-2 py-1 text-right">Balance</th>
                <th className="px-2 py-1 text-center">On Air</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {draft.map((s) => (
                <tr key={s.sourceId} className="border-b border-slate-800">
                  <td className="px-2 py-1 font-mono text-slate-500">{s.sourceId}</td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={s.label ?? ''}
                      onChange={(e) => update(s.sourceId, { label: e.target.value })}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      step="0.1"
                      min={-Infinity}
                      max={6}
                      value={s.mainGain ?? ''}
                      placeholder="-inf"
                      onChange={(e) => {
                        const v = e.target.value
                        update(s.sourceId, {
                          mainGain: v === '' ? null : Number(v),
                        })
                      }}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={s.balance}
                      onChange={(e) =>
                        update(s.sourceId, { balance: Number(e.target.value) })
                      }
                      className="w-16 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-right"
                    />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <select
                      value={s.onAir}
                      onChange={(e) =>
                        update(s.sourceId, {
                          onAir: e.target.value as AtemAudioSourceConfig['onAir'],
                        })
                      }
                      className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5"
                    >
                      <option value="off">Off</option>
                      <option value="on">On</option>
                      <option value="afv">AFV</option>
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeSource(s.sourceId)}
                      title="Quelle entfernen"
                      className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 hover:bg-red-700 hover:text-white"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={addSource}
            className="mt-3 rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
          >
            + Quelle hinzufügen
          </button>
        </main>

        <footer className="flex justify-end gap-2 border-t border-slate-700 px-4 py-2">
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
          >
            Speichern
          </button>
        </footer>
      </div>
    </div>
  )
}
