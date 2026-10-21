// #414 — KI-Plan-Generierung aus Text-Prompt, seit 2026-10 auch aus
// Dokumenten: Blockschaltbilder, IP-Listen, Stücklisten, Grundrisse per
// Drag & Drop. Mit Dokumenten ergänzt das Modell den OFFENEN Plan, statt
// einen neuen zu beginnen.
//
// NICHTS wird ohne Bestätigung geschrieben: erst Vorschau (Räume, Geräte,
// Kabel, Ergänzungen, Warnungen), dann „Einfügen".

import { useRef, useState } from 'react'
import { Sparkles, AlertTriangle, FileUp, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { Button } from '../shared/Button'
import { useTranslation, format } from '../../lib/i18n'
import { hasAnyAiKey } from '../../lib/aiSuggestions'
import { generatePlanFromPrompt, type GeneratedPlan } from '../../lib/planGeneration'
import { vervollstaendigePlan, type PlanErgaenzung } from '../../lib/planVervollstaendigung'
import {
  leseDokument,
  PLAN_DOKUMENT_ACCEPT,
  PLAN_DOKUMENTE_MAX_BYTES,
  type PlanDokument,
} from '../../lib/planDokumente'

const groesse = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} kB`)

export const AiPlanGenDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.aiPlanGen.open)
  const close = useUiStore((s) => s.closeAiPlanGen)
  const insertGeneratedPlan = useProjectStore((s) => s.insertGeneratedPlan)
  const applyPlanErgaenzung = useProjectStore((s) => s.applyPlanErgaenzung)

  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<GeneratedPlan | null>(null)
  const [ergaenzung, setErgaenzung] = useState<PlanErgaenzung | null>(null)
  const [dokumente, setDokumente] = useState<PlanDokument[]>([])
  const [ziehen, setZiehen] = useState(false)
  const dateiFeld = useRef<HTMLInputElement>(null)

  if (!open) return null

  const keyReady = hasAnyAiKey()
  const summe = dokumente.reduce((n, d) => n + d.bytes, 0)
  const zuGross = summe > PLAN_DOKUMENTE_MAX_BYTES

  const hinzu = async (files: File[]) => {
    setError(null)
    const gelesen: PlanDokument[] = []
    const fehler: string[] = []
    for (const f of files) {
      try {
        gelesen.push(await leseDokument(f))
      } catch (e) {
        fehler.push(e instanceof Error ? e.message : String(e))
      }
    }
    setDokumente((alt) => [...alt, ...gelesen.filter((g) => !alt.some((a) => a.name === g.name && a.bytes === g.bytes))])
    setErgaenzung(null)
    setPlan(null)
    if (fehler.length) setError(fehler.join(' · '))
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    setPlan(null)
    setErgaenzung(null)
    try {
      if (dokumente.length > 0) {
        setErgaenzung(await vervollstaendigePlan(useProjectStore.getState().project, dokumente, prompt))
      } else {
        setPlan(await generatePlanFromPrompt(prompt))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setPlan(null)
    setErgaenzung(null)
    setPrompt('')
    setDokumente([])
  }

  const insert = () => {
    if (ergaenzung) applyPlanErgaenzung(ergaenzung)
    else if (plan) insertGeneratedPlan(plan.equipment, plan.cables)
    else return
    reset()
    close()
  }

  const ergaenzteGeraete = ergaenzung?.geraeteAenderungen.length ?? 0
  const leer =
    ergaenzung &&
    ergaenzung.neueGeraete.length + ergaenzung.neueKabel.length + ergaenzung.neueRaeume.length + ergaenzteGeraete === 0

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('aiPlan.title', 'AI plan generation')}
      titleIcon={<Icon icon={Sparkles} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:aiplan"
    >
      <div className="flex flex-col gap-3 text-cp-base">
        {!keyReady && (
          <div className="rounded-cp-control border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-200">
            {t('aiPlan.noKey', 'No AI API key set. Add a provider key under Settings → AI.')}
          </div>
        )}

        <div
          data-testid="aiplan-drop"
          className={`rounded-cp-control border-2 border-dashed p-3 text-cp-xs ${ziehen ? 'border-cp-accent bg-cp-surface-3' : 'border-cp-border bg-cp-surface-2'}`}
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes('Files')) {
              e.preventDefault()
              e.stopPropagation()
              setZiehen(true)
            }
          }}
          onDragLeave={() => setZiehen(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setZiehen(false)
            void hinzu([...e.dataTransfer.files])
          }}
        >
          <input
            ref={dateiFeld}
            type="file"
            multiple
            accept={PLAN_DOKUMENT_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const d = [...(e.target.files ?? [])]
              e.target.value = ''
              void hinzu(d)
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-cp-text-muted">
              {t(
                'aiPlan.dropHint',
                'Drop documents here — block diagrams, IP lists, bills of material, floor plans (PDF, Excel, CSV, images, .cableplan). The open plan is completed from them.',
              )}
            </span>
            <Button size="sm" variant="secondary" leftIcon={FileUp} onClick={() => dateiFeld.current?.click()}>
              {t('aiPlan.pickFiles', 'Choose files')}
            </Button>
          </div>
          {dokumente.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {dokumente.map((d) => (
                <li key={`${d.name}-${d.bytes}`} className="flex items-center justify-between gap-2 text-cp-text-secondary">
                  <span className="truncate">
                    {d.name} <span className="text-cp-text-faint">· {groesse(d.bytes)}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={format(t('aiPlan.removeFile', 'Remove {name}'), { name: d.name })}
                    onClick={() => setDokumente((alt) => alt.filter((a) => a !== d))}
                    className="rounded-cp-control p-1 text-cp-text-muted hover:bg-cp-surface-4"
                  >
                    <Icon icon={X} size="xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {zuGross && (
            <div className="mt-2 text-amber-300">
              {format(t('aiPlan.tooLarge', 'Together {size} — more than one request can carry. Send the documents in several rounds.'), {
                size: groesse(summe),
              })}
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-cp-xs text-cp-text-muted">
            {dokumente.length > 0
              ? t('aiPlan.notesLabel', 'Note for the AI (optional)')
              : t('aiPlan.promptLabel', 'Describe the system in plain language')}
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={dokumente.length > 0 ? 2 : 4}
            placeholder={
              dokumente.length > 0
                ? t('aiPlan.notesPlaceholder', 'e.g. "Only seminar rooms 1–5; the IP list is authoritative"')
                : t(
                    'aiPlan.promptPlaceholder',
                    'e.g. "2 cameras over SDI into a switcher, PGM out to a recorder and a multiviewer monitor"',
                  )
            }
            className="w-full rounded-cp-control border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-cp-xs text-cp-text-muted">
            {t('aiPlan.reviewHint', 'A preview is shown — nothing is inserted without confirmation.')}
          </span>
          <Button
            variant="primary"
            leftIcon={Sparkles}
            onClick={() => void generate()}
            disabled={busy || !keyReady || zuGross || (dokumente.length === 0 && prompt.trim().length === 0)}
          >
            {busy
              ? dokumente.length > 0
                ? t('aiPlan.reading', 'Reading documents…')
                : t('aiPlan.generating', 'Generating…')
              : dokumente.length > 0
                ? t('aiPlan.complete', 'Complete plan')
                : t('aiPlan.generate', 'Generate')}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-cp-control border border-red-700/60 bg-red-900/20 p-2 text-cp-xs text-red-200">
            <Icon icon={AlertTriangle} size="xs" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {ergaenzung && (
          <div data-testid="aiplan-ergaenzung" className="rounded-cp-control border border-cp-border bg-cp-surface-1/40 p-2">
            <div className="mb-1 text-cp-xs font-semibold text-cp-text-bright">
              {leer
                ? t('aiPlan.nothingMissing', 'The documents add nothing the plan does not already contain.')
                : format(t('aiPlan.completionPreview', 'Preview: {r} new rooms, {d} new devices, {c} cables, {u} devices completed'), {
                    r: ergaenzung.neueRaeume.length,
                    d: ergaenzung.neueGeraete.length,
                    c: ergaenzung.neueKabel.length,
                    u: ergaenzteGeraete,
                  })}
            </div>
            <ul className="max-h-40 overflow-auto text-cp-xs text-cp-text-secondary">
              {ergaenzung.neueRaeume.map((r) => (
                <li key={r.id}>+ {r.name}</li>
              ))}
              {ergaenzung.neueGeraete.map((e) => (
                <li key={e.id}>
                  • {e.name} <span className="text-cp-text-faint">[{e.category}]{e.ipAddress ? ` ${e.ipAddress}` : ''}</span>
                </li>
              ))}
            </ul>
            {ergaenzung.warnungen.length > 0 && (
              <ul className="mt-1 max-h-32 list-inside list-disc overflow-auto text-cp-xs text-amber-300">
                {ergaenzung.warnungen.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex justify-end">
              <Button variant="success" onClick={insert} disabled={!!leer}>
                {t('aiPlan.insert', 'Insert into plan')}
              </Button>
            </div>
          </div>
        )}

        {plan && (
          <div className="rounded-cp-control border border-cp-border bg-cp-surface-1/40 p-2">
            <div className="mb-1 text-cp-xs font-semibold text-cp-text-bright">
              {format(t('aiPlan.preview', 'Preview: {d} devices, {c} cables'), {
                d: plan.equipment.length,
                c: plan.cables.length,
              })}
            </div>
            <ul className="max-h-40 overflow-auto text-cp-xs text-cp-text-secondary">
              {plan.equipment.map((e) => (
                <li key={e.id}>
                  • {e.name} <span className="text-cp-text-faint">[{e.category}]</span>
                </li>
              ))}
            </ul>
            {plan.warnings.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-cp-xs text-amber-300">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex justify-end">
              <Button variant="success" onClick={insert} disabled={plan.equipment.length === 0}>
                {t('aiPlan.insert', 'Insert into plan')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
