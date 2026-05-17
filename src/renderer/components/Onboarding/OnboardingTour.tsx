import { useEffect, useState } from 'react'
import { STORAGE_KEYS } from '../../lib/storageKeys'

const TOUR_STORAGE_KEY = STORAGE_KEYS.tourSeenV1

/**
 * One-time onboarding tour shown on first launch (and re-openable from the
 * Help menu). Renders as a centered modal with sequential slides. We avoid
 * real DOM spotlights on purpose — they are fragile across panel resizes and
 * platform-specific scrollbars, and the slides describe relocations more
 * concisely as plain text.
 *
 * Persistence: a `localStorage` flag is written once the user finishes (or
 * dismisses) the tour. Use `markTourSeen` from outside to skip future
 * automatic openings; use `resetTour` to reset for testing.
 */
export const hasSeenTour = (): boolean => {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export const markTourSeen = (): void => {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1')
  } catch {
    /* storage unavailable — skip */
  }
}

interface TourStep {
  title: string
  body: string
  hint?: string
}

const STEPS: TourStep[] = [
  {
    title: 'Willkommen im Cable Planner',
    body:
      'Eine kurze Tour zeigt dir, wo du die wichtigsten Funktionen findest. Du kannst sie jederzeit über das Hilfe-Menü oben rechts wieder öffnen.',
  },
  {
    title: 'Datei-Menü oben links',
    body:
      'Über „Datei" legst du Projekte an, öffnest gespeicherte Dateien und sicherst Änderungen. Die Projekt-Metadaten bearbeitest du dort über „Projekt-Eigenschaften".',
  },
  {
    title: 'Export-Menü',
    body:
      'Im „Export"-Menü findest du den PDF-Plan-Export, die Kabel-Stückliste sowie zwei Rentman-Aktionen: PDF an Rentman anhängen und Kabel an Rentman senden.',
    hint: 'Die Rentman-Einträge sind nur aktiv, wenn ein Rentman-Projekt verknüpft ist.',
  },
  {
    title: 'Einstellungen → Rentman',
    body:
      'Token speichern, Verbindung testen und Rentman-Projekt verknüpfen oder wechseln machst du in den Einstellungen im Tab „Rentman API".',
  },
  {
    title: 'Bibliothek links',
    body:
      'Die linke Spalte enthält Equipment, Kabel-Library und Gruppen. Im Equipment-Tab kannst du zwischen lokalen und aus Rentman importierten Geräten umschalten.',
  },
  {
    title: 'Eigenschaften rechts',
    body:
      'Wenn du ein Element auf der Canvas auswählst, erscheinen rechts die Details und Werkzeuge zur Bearbeitung.',
  },
  {
    title: 'Kabel-Plan & Warnung',
    body:
      'Importierst du Kabelmengen aus Rentman, warnt der Cable Planner beim Verkabeln, sobald du mehr Kabel verbaust als vorhanden sind. Über „Kabel an Rentman senden" gleichst du fertige Mengen zurück.',
  },
]

interface OnboardingTourProps {
  open: boolean
  onClose: () => void
}

export const OnboardingTour = ({ open, onClose }: OnboardingTourProps) => {
  const [step, setStep] = useState(0)

  useEffect(() => {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(event) => event.target === event.currentTarget && finish()}
    >
      <div className="flex w-[520px] max-w-[95vw] flex-col rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">
            Erste-Schritte-Tour · Schritt {step + 1} / {STEPS.length}
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
            title="Tour schließen"
          >
            ✕
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          <h2 className="text-base font-semibold text-slate-100">{current.title}</h2>
          <p className="text-sm leading-relaxed text-slate-300">{current.body}</p>
          {current.hint && (
            <div className="rounded border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-400">
              Tipp: {current.hint}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-slate-800 bg-slate-950/30 px-4 py-1.5">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-4 rounded-full ${
                index === step
                  ? 'bg-orange-500'
                  : index < step
                    ? 'bg-orange-700/60'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-700 px-4 py-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Tour beenden
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep((index) => Math.max(0, index - 1))}
              disabled={step === 0}
              className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Zurück
            </button>
            {isLast ? (
              <button
                type="button"
                onClick={finish}
                className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-500"
              >
                Los geht's
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((index) => Math.min(STEPS.length - 1, index + 1))}
                className="rounded bg-orange-600 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-500"
              >
                Weiter
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}
