import { useEffect, useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { PanelHint } from '../shared/PanelHint'
import { useTranslation } from '../../lib/i18n'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { hasAnyAiKey } from '../../lib/aiSuggestions'
import { fragePlan } from '../../lib/planFrage'

/**
 * #1225 — Hilfe > „Frage zum Plan…". Die verbundene KI bekommt den ganzen
 * Plan (Geräte mit technischen Angaben und Ports, Kabel) und beantwortet
 * technische Fragen dazu. Nur lesen: die Antwort ändert nichts am Plan.
 * Geöffnet über `cp:open-plan-question`, wie die Befehlspalette.
 */
export const PlanFrageDialog = () => {
  const t = useTranslation()
  const sprache = useUiStore((s) => s.language)
  const [open, setOpen] = useState(false)
  const [frage, setFrage] = useState('')
  const [antwort, setAntwort] = useState('')
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    const auf = () => setOpen(true)
    window.addEventListener('cp:open-plan-question', auf)
    return () => window.removeEventListener('cp:open-plan-question', auf)
  }, [])

  if (!open) return null
  const keyReady = hasAnyAiKey()

  const fragen = async () => {
    setBusy(true)
    setFehler(null)
    try {
      setAntwort(await fragePlan(useProjectStore.getState().project, frage, sprache))
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title={t('planQuestion.title', 'Ask about this plan')}
      titleIcon={<Icon icon={MessageCircleQuestion} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:planfrage"
    >
      <div className="flex flex-col gap-3 text-cp-base">
        {!keyReady && (
          <div className="rounded-cp-control border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
            {t('aiPlan.noKey', 'No AI API key set. Add a provider key under Settings → AI.')}
          </div>
        )}
        <PanelHint
          text={t(
            'planQuestion.hint',
            'The AI sees every device with its ports and specs and every cable of the open plan — never login data. It only answers; the plan stays unchanged.',
          )}
        />
        <textarea
          value={frage}
          onChange={(e) => setFrage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && frage.trim() && !busy) void fragen()
          }}
          rows={3}
          placeholder={t('planQuestion.placeholder', 'e.g. What is the best signal path from camera 1 to the recorder?')}
          className="w-full rounded-cp-control border border-cp-border bg-cp-surface-2 p-2 text-cp-base text-cp-text-bright"
        />
        <div className="flex justify-end">
          <Button onClick={() => void fragen()} disabled={!keyReady || busy || !frage.trim()}>
            {busy ? t('planQuestion.busy', 'Asking…') : t('planQuestion.ask', 'Ask')}
          </Button>
        </div>
        {fehler && <div className="text-cp-xs text-red-300">{fehler}</div>}
        {antwort && (
          <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-cp-control bg-cp-surface-2 p-3 text-cp-text-bright">
            {antwort}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
