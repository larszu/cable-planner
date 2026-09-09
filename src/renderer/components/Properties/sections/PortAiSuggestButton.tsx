import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useProjectStore } from '../../../store/projectStore'
import { Icon } from '../../shared/Icon'
import { confirmDialog } from '../../../lib/confirmDialog'
import { suggestFromAI } from '../../../lib/aiSuggestions'
import { buildTemplateFromHints, type PortGroupHint } from '../../../lib/portSuggestions'
import type { EquipmentItem } from '../../../types/equipment'
import { format, useTranslation } from '../../../lib/i18n'

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
  const t = useTranslation()
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
        setError(t('props.aiPorts.noSuggestion', 'AI could not suggest any ports. Try a more specific device name.'))
      } else {
        setHints(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('props.aiPorts.requestFailed', 'AI request failed'))
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
    // Festhalten, dass diese Ports GERATEN sind — aus dem Geraetenamen, von
    // einem Modell. Ohne diese Zeile standen sie ununterscheidbar neben von
    // Hand eingetragenen, und Pruefung 18 („reale Anschluesse aus dem
    // Datenblatt ergaenzen") verstummte, weil ueberhaupt Ports da waren.
    // Genau die Pruefung, die einen Menschen zu belegten Daten zwingen soll.
    const beleg = {
      value: `${newInputs.length} In / ${newOutputs.length} Out`,
      source: t(
        'props.aiPorts.source',
        'AI suggestion from the device name — not from a datasheet',
      ),
    }
    updateEquipment(equipment.id, {
      inputs: newInputs,
      outputs: newOutputs,
      specSource: { ...(equipment.specSource ?? {}), inputs: beleg, outputs: beleg },
    })
    setHints(null)
    setError(null)
  }

  const totalSuggested = hints ? hints.reduce((sum, h) => sum + h.count, 0) : 0
  const hasExisting = equipment.inputs.length > 0 || equipment.outputs.length > 0

  return (
    <div className="rounded border border-purple-700/50 bg-purple-950/20 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-purple-200">
          <Icon icon={Sparkles} size="xs" /> {t('props.aiPorts.label', 'AI port suggestion')}
        </div>
        <button
          type="button"
          onClick={handleAsk}
          disabled={busy}
          className="rounded bg-purple-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-purple-600 disabled:opacity-50"
          title={format(
            t(
              'props.aiPorts.btnTitle',
              'Asks the provider selected in Settings → AI what "{name}" typically has for ports',
            ),
            { name: equipment.name },
          )}
        >
          {busy ? t('props.aiPorts.asking', 'Asking AI…') : t('props.aiPorts.suggest', 'Suggest ports')}
        </button>
      </div>
      {error && (
        <div className="mt-1 rounded bg-red-900/50 p-1.5 text-[10px] text-red-100">{error}</div>
      )}
      {hints && hints.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-purple-100/80">
            {format(t('props.aiPorts.summary', '{groups} group(s) / {ports} ports suggested:'), {
              groups: hints.length,
              ports: totalSuggested,
            })}
          </div>
          <ul className="ml-3 list-disc text-[10px] text-purple-100">
            {hints.map((h, idx) => (
              <li key={idx}>
                {h.count}× {h.connectorType} (
                {h.direction === 'in' ? t('props.aiPorts.input', 'Input') : t('props.aiPorts.output', 'Output')}
                ){h.label ? ` — ${h.label}` : ''}
              </li>
            ))}
          </ul>
          <div className="mt-1 flex flex-wrap gap-1">
            {hasExisting && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmDialog(
                    format(
                      t(
                        'props.aiPorts.confirmReplace',
                        'Replace existing {in} In / {out} Out with the AI suggestion?',
                      ),
                      { in: equipment.inputs.length, out: equipment.outputs.length },
                    ),
                  )
                  if (ok) apply('replace')
                }}
                className="rounded bg-amber-700 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-600"
                title={t('props.aiPorts.replaceTitle', 'Removes current ports and applies the AI suggestion')}
              >
                {t('props.aiPorts.replace', 'Replace')}
              </button>
            )}
            <button
              type="button"
              onClick={() => apply('append')}
              className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] text-emerald-100 hover:bg-emerald-600"
              title={t('props.aiPorts.appendTitle', 'Appends the AI suggestion to the existing ports')}
            >
              {hasExisting
                ? t('props.aiPorts.append', 'Append')
                : t('props.aiPorts.adopt', 'Adopt')}
            </button>
            <button
              type="button"
              onClick={() => setHints(null)}
              className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] text-cp-text-bright hover:bg-cp-surface-5"
            >
              {t('props.aiPorts.discard', 'Discard')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
