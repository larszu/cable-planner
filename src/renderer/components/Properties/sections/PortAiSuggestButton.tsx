import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { confirmDialog } from '../../../lib/confirmDialog'
import { suggestFromAI } from '../../../lib/aiSuggestions'
import { buildTemplateFromHints, type PortGroupHint } from '../../../lib/portSuggestions'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — AI-Port-Vorschlag-Button aus EquipmentProperties ausgelagert.
 * Klick → ruft suggestFromAI(equipment.name, equipment.category) via dem
 * im Settings gewählten Provider (Gemini/Claude/OpenAI) und schlägt
 * Port-Gruppen vor. Diese kann der User dann ersetzen/anhängen/verwerfen.
 */
export const PortAiSuggestButton = ({
  equipment,
}: {
  equipment: EquipmentItem
}) => {
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hints, setHints] = useState<PortGroupHint[] | null>(null)

  const handleAsk = async () => {
    setError(null)
    setHints(null)
    setBusy(true)
    try {
      const result = await suggestFromAI(equipment.name ?? '', equipment.category ?? '')
      if (result.length === 0) {
        setError('AI konnte keine Ports vorschlagen. Geraete-Name praeziseren?')
      } else {
        setHints(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI-Request fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  const apply = (mode: 'replace' | 'append') => {
    if (!hints || hints.length === 0) return
    // Wir nutzen buildTemplateFromHints um die Hints in Port-Objekte
    // mit IDs umzurechnen — die liefert ein ganzes Template; wir nehmen
    // nur die inputs/outputs raus.
    const synthesized = buildTemplateFromHints(equipment.name ?? '', equipment.category ?? '', hints)
    const newInputs =
      mode === 'replace' ? synthesized.inputs : [...equipment.inputs, ...synthesized.inputs]
    const newOutputs =
      mode === 'replace' ? synthesized.outputs : [...equipment.outputs, ...synthesized.outputs]
    updateEquipment(equipment.id, { inputs: newInputs, outputs: newOutputs })
    setHints(null)
    setError(null)
  }

  const totalSuggested = hints ? hints.reduce((sum, h) => sum + h.count, 0) : 0
  const hasExisting = equipment.inputs.length > 0 || equipment.outputs.length > 0

  return (
    <div className="rounded border border-purple-700/50 bg-purple-950/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-purple-200">✨ AI-Port-Vorschlag</div>
        <button
          type="button"
          onClick={handleAsk}
          disabled={busy}
          className="rounded bg-purple-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          title={`Fragt den im Einstellungen → AI gewaehlten Provider was "${equipment.name}" ueblicherweise fuer Ports hat`}
        >
          {busy ? 'Asking AI…' : 'Ports vorschlagen'}
        </button>
      </div>
      {error && (
        <div className="mt-1 rounded bg-red-900/50 p-1.5 text-[10px] text-red-100">{error}</div>
      )}
      {hints && hints.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-purple-100/80">
            {hints.length} Gruppe(n) / {totalSuggested} Ports vorgeschlagen:
          </div>
          <ul className="ml-3 list-disc text-[10px] text-purple-100">
            {hints.map((h, idx) => (
              <li key={idx}>
                {h.count}× {h.connectorType} ({h.direction === 'in' ? 'Input' : 'Output'})
                {h.label ? ` — ${h.label}` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-1 flex flex-wrap gap-1">
            {hasExisting && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDialog(
                    `Bestehende ${equipment.inputs.length} In / ${equipment.outputs.length} Out durch AI-Vorschlag ueberschreiben?`,
                  )
                  if (ok) apply('replace')
                }}
                className="rounded bg-amber-700 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-600"
                title="Loescht aktuelle Ports und nimmt die AI-Vorschlaege"
              >
                Ersetzen
              </button>
            )}
            <button
              type="button"
              onClick={() => apply('append')}
              className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-600"
              title="Haengt die AI-Vorschlaege an die bestehenden Ports an"
            >
              {hasExisting ? 'Anhaengen' : 'Uebernehmen'}
            </button>
            <button
              type="button"
              onClick={() => setHints(null)}
              className="rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-600"
            >
              Verwerfen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
