import { useEffect, useState } from 'react'
import { ModalShell } from '../shared/ModalShell'
import { format, useTranslation } from '../../lib/i18n'
import { markTourSeen } from './onboardingState'

/**
 * One-time onboarding tour shown on first launch (and re-openable from the
 * Help menu). Renders as a centered modal with sequential slides. We avoid
 * real DOM spotlights on purpose — they are fragile across panel resizes and
 * platform-specific scrollbars, and the slides describe relocations more
 * concisely as plain text.
 *
 * Persistence helpers (`hasSeenTour` / `markTourSeen`) live in
 * `./onboardingState` so this module only exports the component.
 */

interface TourStep {
  title: string
  body: string
  hint?: string
}

const stepsForLang = (
  t: (key: string, fallback?: string) => string,
): TourStep[] => [
  {
    title: t('onboarding.steps.welcome.title', 'Willkommen im Cable Planner'),
    body: t(
      'onboarding.steps.welcome.body',
      'Eine kurze Tour zeigt dir, wo du die wichtigsten Funktionen findest. Du kannst sie jederzeit über das Hilfe-Menü oben rechts wieder öffnen.',
    ),
  },
  {
    title: t('onboarding.steps.file.title', 'Datei-Menü oben links'),
    body: t(
      'onboarding.steps.file.body',
      'Über „Datei" legst du Projekte an, öffnest gespeicherte Dateien und sicherst Änderungen. Die Projekt-Metadaten bearbeitest du dort über „Projekt-Eigenschaften".',
    ),
  },
  {
    title: t('onboarding.steps.export.title', 'Export-Menü'),
    body: t(
      'onboarding.steps.export.body',
      'Im „Export"-Menü findest du den PDF-Plan-Export, die Kabel-Stückliste sowie zwei Rentman-Aktionen: PDF an Rentman anhängen und Kabel an Rentman senden.',
    ),
    hint: t(
      'onboarding.steps.export.hint',
      'Die Rentman-Einträge sind nur aktiv, wenn ein Rentman-Projekt verknüpft ist.',
    ),
  },
  {
    title: t('onboarding.steps.settings.title', 'Einstellungen → Rentman'),
    body: t(
      'onboarding.steps.settings.body',
      'Token speichern, Verbindung testen und Rentman-Projekt verknüpfen oder wechseln machst du in den Einstellungen im Tab „Rentman API".',
    ),
  },
  {
    title: t('onboarding.steps.library.title', 'Bibliothek links'),
    body: t(
      'onboarding.steps.library.body',
      'Die linke Spalte enthält Equipment, Kabel-Library und Gruppen. Im Equipment-Tab kannst du zwischen lokalen und aus Rentman importierten Geräten umschalten.',
    ),
  },
  {
    title: t('onboarding.steps.properties.title', 'Eigenschaften rechts'),
    body: t(
      'onboarding.steps.properties.body',
      'Wenn du ein Element auf der Canvas auswählst, erscheinen rechts die Details und Werkzeuge zur Bearbeitung.',
    ),
  },
  {
    title: t('onboarding.steps.cablePlan.title', 'Kabel-Plan & Warnung'),
    body: t(
      'onboarding.steps.cablePlan.body',
      'Importierst du Kabelmengen aus Rentman, warnt der Cable Planner beim Verkabeln, sobald du mehr Kabel verbaust als vorhanden sind. Über „Kabel an Rentman senden" gleichst du fertige Mengen zurück.',
    ),
  },
]

interface OnboardingTourProps {
  open: boolean
  onClose: () => void
}

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const t = useTranslation()
  const [step, setStep] = useState(0)
  const STEPS = stepsForLang(t)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Beim Öffnen auf den ersten Schritt zurücksetzen
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const isLast = step >= STEPS.length - 1
  const current = STEPS[step]
  const finish = () => {
    markTourSeen()
    onClose()
  }

  return (
    <ModalShell
      open={open}
      onClose={finish}
      title={
        <span className="text-[11px] uppercase tracking-wider text-cp-text-muted">
          {format(t('onboarding.header', 'Erste-Schritte-Tour · Schritt {step} / {total}'), {
            step: step + 1,
            total: STEPS.length,
          })}
        </span>
      }
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-cp-xs text-cp-text-faint hover:text-cp-text-secondary"
          >
            {t('onboarding.end', 'Tour beenden')}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {STEPS.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 w-4 rounded-full ${
                    index === step
                      ? 'bg-orange-500'
                      : index < step
                        ? 'bg-orange-700/60'
                        : 'bg-cp-surface-4'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep((index) => Math.max(0, index - 1))}
              disabled={step === 0}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('onboarding.back', 'Zurück')}
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="rounded bg-orange-600 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-orange-500"
              >
                {t('onboarding.start', "Los geht's")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((index) => Math.min(STEPS.length - 1, index + 1))}
                className="rounded bg-orange-600 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-orange-500"
              >
                {t('onboarding.next', 'Weiter')}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <h2 className="text-cp-xl font-semibold text-cp-text">{current.title}</h2>
        <p className="text-cp-base leading-relaxed text-cp-text-secondary">{current.body}</p>
        {current.hint && (
          <div className="rounded border border-cp-border-muted bg-cp-surface-3/40 px-2 py-1 text-[11px] text-cp-text-muted">
            {t('onboarding.tip', 'Tipp:')} {current.hint}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
