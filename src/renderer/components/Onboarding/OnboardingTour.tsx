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
    title: t('onboarding.steps.welcome.title', 'Welcome to Cable Planner'),
    body: t(
      'onboarding.steps.welcome.body',
      'A short tour shows where the main features live. You can re-open it any time from the Help menu in the top right.',
    ),
  },
  {
    title: t('onboarding.steps.file.title', 'File menu (top left)'),
    body: t(
      'onboarding.steps.file.body',
      'Use "File" to create projects, open saved files and persist changes. Project metadata is editable from "Project properties" there.',
    ),
  },
  {
    title: t('onboarding.steps.export.title', 'Export menu'),
    body: t(
      'onboarding.steps.export.body',
      'The "Export" menu hosts PDF plan export, the cable BOM and two Rentman actions: attach PDF to Rentman and send cables to Rentman.',
    ),
    hint: t(
      'onboarding.steps.export.hint',
      'The Rentman entries are only active if a Rentman project is linked.',
    ),
  },
  {
    title: t('onboarding.steps.settings.title', 'Settings → Rentman'),
    body: t(
      'onboarding.steps.settings.body',
      'Save the token, test the connection and link/switch Rentman projects from the "Rentman API" tab in Settings.',
    ),
  },
  {
    title: t('onboarding.steps.library.title', 'Library on the left'),
    body: t(
      'onboarding.steps.library.body',
      'The left column holds equipment, cable library and groups. In the Equipment tab you can switch between local and Rentman-imported devices.',
    ),
  },
  {
    title: t('onboarding.steps.properties.title', 'Properties on the right'),
    body: t(
      'onboarding.steps.properties.body',
      'Selecting an item on the canvas opens its details and editing tools on the right.',
    ),
  },
  {
    title: t('onboarding.steps.cablePlan.title', 'Cable plan & warnings'),
    body: t(
      'onboarding.steps.cablePlan.body',
      'If you import cable quantities from Rentman, Cable Planner warns when you wire more cables than available. "Send cables to Rentman" syncs back the assembled totals.',
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
        <span className="text-cp-xs uppercase tracking-wider text-cp-text-muted">
          {format(t('onboarding.header', 'Getting-started tour · step {step} / {total}'), {
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
            {t('onboarding.end', 'End tour')}
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
              {t('onboarding.back', 'Back')}
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="rounded bg-orange-600 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-orange-500"
              >
                {t('onboarding.start', "Let's go")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((index) => Math.min(STEPS.length - 1, index + 1))}
                className="rounded bg-orange-600 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-orange-500"
              >
                {t('onboarding.next', 'Next')}
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
          <div className="rounded border border-cp-border-muted bg-cp-surface-3/40 px-2 py-1 text-cp-xs text-cp-text-muted">
            {t('onboarding.tip', 'Tip:')} {current.hint}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
