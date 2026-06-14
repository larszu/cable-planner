// #414 — KI-Plan-Generierung aus Text-Prompt.
//
// Der User beschreibt sein System in Klartext, das gewählte AI-Modell schlägt
// Geräte + Verbindungen vor. NICHTS wird ohne Bestätigung geschrieben: erst
// Vorschau (Geräte/Kabel/Warnungen), dann „Einfügen".

import { useState } from 'react'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation, format } from '../../lib/i18n'
import { hasAnyAiKey } from '../../lib/aiSuggestions'
import { generatePlanFromPrompt, type GeneratedPlan } from '../../lib/planGeneration'

export const AiPlanGenDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.aiPlanGen.open)
  const close = useUiStore((s) => s.closeAiPlanGen)
  const insertGeneratedPlan = useProjectStore((s) => s.insertGeneratedPlan)

  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)

  if (!open) return null

  const keyReady = hasAnyAiKey()

  const generate = async () => {
    setBusy(true)
    setError(null)
    setPlan(null)
    try {
      const result = await generatePlanFromPrompt(prompt)
      setPlan(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const insert = () => {
    if (!plan) return
    insertGeneratedPlan(plan.equipment, plan.cables)
    setPlan(null)
    setPrompt('')
    close()
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('aiPlan.title', 'KI-Plan-Generierung')}
      titleIcon={<Icon icon={Sparkles} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:aiplan"
    >
      <div className="flex flex-col gap-3 text-cp-base">
        {!keyReady && (
          <div className="rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
            {t(
              'aiPlan.noKey',
              'Kein AI-API-Key hinterlegt. Bitte in den Einstellungen → AI einen Provider-Key eintragen.',
            )}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">
            {t('aiPlan.promptLabel', 'System in Klartext beschreiben')}
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={t(
              'aiPlan.promptPlaceholder',
              'z. B. "2 Kameras über SDI in einen Switcher, PGM-Out auf einen Recorder und einen Multiviewer-Monitor"',
            )}
            className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-cp-text-muted">
            {t('aiPlan.reviewHint', 'Vorschau wird angezeigt — nichts wird ohne Bestätigung eingefügt.')}
          </span>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={busy || !keyReady || prompt.trim().length === 0}
            className="inline-flex items-center gap-1 rounded bg-purple-700 px-3 py-1.5 text-cp-xs hover:bg-purple-600 disabled:opacity-50"
          >
            <Icon icon={Sparkles} size="xs" />
            {busy ? t('aiPlan.generating', 'Generiere…') : t('aiPlan.generate', 'Generieren')}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-700/60 bg-red-900/20 p-2 text-cp-xs text-red-200">
            <Icon icon={AlertTriangle} size="xs" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {plan && (
          <div className="rounded border border-cp-border bg-cp-surface-1/40 p-2">
            <div className="mb-1 text-cp-xs font-semibold text-cp-text-bright">
              {format(t('aiPlan.preview', 'Vorschau: {d} Geräte, {c} Kabel'), {
                d: plan.equipment.length,
                c: plan.cables.length,
              })}
            </div>
            <ul className="max-h-40 overflow-auto text-[11px] text-cp-text-secondary">
              {plan.equipment.map((e) => (
                <li key={e.id}>
                  • {e.name} <span className="text-cp-text-faint">[{e.category}]</span>
                </li>
              ))}
            </ul>
            {plan.warnings.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-[10px] text-amber-300">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={insert}
                disabled={plan.equipment.length === 0}
                className="rounded bg-emerald-700 px-3 py-1.5 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
              >
                {t('aiPlan.insert', 'In den Plan einfügen')}
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
