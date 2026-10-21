/**
 * Der eine Einstieg beim Erststart (#1025).
 *
 * Ersetzt den frueheren Willkommens-Dialog (Projekt waehlen) und die
 * Modul-Frage (wofuer nutzt du die App?), die nacheinander als zwei Schleier
 * kamen. Jetzt eine Ansicht: optional ankreuzen, was geplant wird — das
 * schaltet die passenden Module ein —, dann eine Aktion. Nichts davon ist
 * Pflicht; ohne Auswahl gelten die Default-Module.
 */
import { useState } from 'react'
import { Check, FileText, FolderOpen, Sparkles } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { PRESETS, type PresetId } from '../../lib/modules'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'

interface StartDialogProps {
  open: boolean
  onNew: () => void
  onOpen: () => void
  onDemo: () => void
  /** Schliesst den Dialog und merkt sich, dass er gesehen wurde. */
  onClose: () => void
}

export const StartDialog = ({ open, onNew, onOpen, onDemo, onClose }: StartDialogProps) => {
  const t = useTranslation()
  const applyModulePreset = useSettingsStore((s) => s.applyModulePreset)
  const setOnboardingDone = useSettingsStore((s) => s.setOnboardingDone)
  const [selected, setSelected] = useState<PresetId[]>([])

  const toggle = (id: PresetId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Ohne Auswahl bleiben die Defaults (Kern + bisher Sichtbares) — NICHT das
  // leere Preset, das wuerde alles ausschalten.
  const finish = (action?: () => void) => {
    if (selected.length > 0) applyModulePreset(selected)
    setOnboardingDone(true)
    onClose()
    action?.()
  }

  const secondary =
    'flex flex-1 items-center justify-center gap-2 rounded-cp-control border border-cp-border bg-cp-surface-2 px-3 py-2 text-cp-sm text-cp-text hover:bg-cp-surface-3'

  return (
    <ModalShell
      open={open}
      onClose={() => finish()}
      title={t('start.title', 'Welcome — what are you planning?')}
      maxWidth="lg"
      zIndex={60}
      closeOnBackdrop={false}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => finish()}
            className="rounded-cp-control px-3 py-1 text-cp-xs text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text"
          >
            {t('project.welcome.later', 'Decide later')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-cp-xs text-cp-text-muted">
          {t(
            'start.intro',
            'Optional: pick what you plan and the matching modules are switched on. You can change this any time under Settings → Modules.',
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESETS.map((p) => {
            const on = selected.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                className={`rounded-cp-card border p-3 text-left text-cp-xs ${
                  on
                    ? 'border-cp-accent bg-cp-accent-soft'
                    : 'border-cp-border bg-cp-surface-1 hover:border-cp-border-strong'
                }`}
              >
                <span className="mb-1 flex items-center gap-2 font-semibold text-cp-text">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-cp-s border ${
                      on ? 'border-cp-accent bg-cp-accent text-cp-bg' : 'border-cp-border'
                    }`}
                  >
                    {on ? <Icon icon={Check} size="xs" /> : null}
                  </span>
                  {t(`onboarding.preset.${p.id}.label`, p.label)}
                </span>
                <span className="block text-cp-text-muted">
                  {t(`onboarding.preset.${p.id}.desc`, p.description)}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => finish(onNew)}
          className="flex w-full items-center justify-center gap-2 rounded-cp-control bg-cp-accent px-4 py-2.5 text-cp-base font-semibold text-cp-bg hover:brightness-110"
        >
          <Icon icon={FileText} size="sm" />
          {t('project.welcome.newTitle', 'New project')}
        </button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => finish(onDemo)} className={secondary}>
            <Icon icon={Sparkles} size="sm" />
            {t('canvas.empty.loadDemo', 'Load example project')}
          </button>
          <button type="button" onClick={() => finish(onOpen)} className={secondary}>
            <Icon icon={FolderOpen} size="sm" />
            {t('project.welcome.openTitle', 'Open project…')}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
