import { useEffect, useState } from 'react'
import { ModalShell } from '../shared/ModalShell'
import { format, useTranslation } from '../../lib/i18n'
import { markTourSeen } from './onboardingState'

/**
 * Short tour (five steps) shown once after the start dialog (#1025) and
 * re-openable from the Help menu. The last step hands over to the command
 * palette, the way to every function the tour does not mention. Renders as a centered modal with sequential slides. We avoid
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
}

const stepsForLang = (
  t: (key: string, fallback?: string) => string,
): TourStep[] => [
  {
    title: t('onboarding.steps.library.title', 'Library on the left'),
    body: t(
      'onboarding.steps.library.body2',
      'Drag devices and cables from the left column onto the canvas. Drag from one port to another to draw a cable.',
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
    title: t('onboarding.steps.planCheck.title', 'Plan check'),
    body: t(
      'onboarding.steps.planCheck.body',
      'Tools → Plan check finds gaps and contradictions. Nothing is mandatory: plan first, the check points out what is missing.',
    ),
  },
  {
    title: t('onboarding.steps.export.title', 'Export menu'),
    body: t(
      'onboarding.steps.export.body2',
      'File → Export & Print produces the PDF plan, the cable list and the patch list.',
    ),
  },
  {
    title: t('onboarding.steps.palette.title', 'Find any function'),
    body: t(
      'onboarding.steps.palette.body',
      'Press Ctrl/Cmd+K and type what you need — for example "label", "power" or "rack". The command palette finds every tool and dialog. This tour stays available under Help.',
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
        <span className="text-cp-xs text-cp-text-muted">
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
                  className={`h-1.5 w-4 ${
                    index === step
                      ? 'bg-cp-accent'
                      : index < step
                        ? 'bg-cp-accent-soft'
                        : 'bg-cp-surface-4'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep((index) => Math.max(0, index - 1))}
              disabled={step === 0}
              className="bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('onboarding.back', 'Back')}
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={() => {
                  finish()
                  window.dispatchEvent(new CustomEvent('cp:open-command-palette'))
                }}
                className="rounded-cp-control bg-cp-accent px-3 py-1 text-cp-xs font-semibold text-cp-bg hover:brightness-110"
              >
                {t('onboarding.openPalette', 'Open command palette')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((index) => Math.min(STEPS.length - 1, index + 1))}
                className="rounded-cp-control bg-cp-accent px-3 py-1 text-cp-xs font-semibold text-cp-bg hover:brightness-110"
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
      </div>
    </ModalShell>
  )
}
