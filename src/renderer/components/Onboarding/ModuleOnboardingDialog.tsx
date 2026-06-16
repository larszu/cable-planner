/**
 * Modulares UI — überspringbarer Erststart-Dialog.
 *
 * EINE Intent-Frage („wofür nutzt du die App?") mit Mehrfachauswahl von
 * Use-Case-Presets, die ein Modul-Set setzen. NN/g-konform: kurz, begründet,
 * jederzeit überspringbar. Ohne Antwort gilt der Default (Kern an, Nische aus).
 * Siehe `docs/modular-ui-concept.md`.
 */
import { useState } from 'react'
import { Blocks } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../lib/i18n'
import { PRESETS, type PresetId } from '../../lib/modules'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'

export const ModuleOnboardingDialog = () => {
  const t = useTranslation()
  const onboardingDone = useSettingsStore((s) => s.onboardingDone)
  const applyModulePreset = useSettingsStore((s) => s.applyModulePreset)
  const setOnboardingDone = useSettingsStore((s) => s.setOnboardingDone)
  const [selected, setSelected] = useState<PresetId[]>([])

  if (onboardingDone) return null

  const toggle = (id: PresetId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // Überspringen behält die Defaults (Kern + bisher Sichtbares), NICHT das
  // leere Preset (das würde alles ausschalten).
  const skip = () => setOnboardingDone(true)
  const confirm = () => {
    if (selected.length === 0) return skip()
    applyModulePreset(selected)
    setOnboardingDone(true)
  }

  return (
    <ModalShell
      open
      onClose={skip}
      maxWidth="lg"
      titleIcon={<Icon icon={Blocks} size="sm" />}
      title={t('onboarding.title', 'Willkommen — wofür nutzt du Cable-Planner?')}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skip}
            className="rounded px-3 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-2"
          >
            {t('onboarding.skip', 'Später entscheiden')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={selected.length === 0}
            className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('onboarding.confirm', 'Loslegen')}
          </button>
        </div>
      }
    >
      <div className="space-y-3 text-cp-xs">
        <p className="text-cp-text-secondary">
          {t(
            'onboarding.intro',
            'Wähle einen oder mehrere Anwendungsfälle — passende Funktionsmodule werden aktiviert. Du kannst alles jederzeit unter Einstellungen → Module ändern.',
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
                className={`rounded border p-3 text-left transition ${
                  on
                    ? 'border-emerald-500 bg-emerald-900/20'
                    : 'border-cp-border bg-cp-surface-1 hover:border-cp-border-muted'
                }`}
              >
                <div className="mb-1 flex items-center gap-2 font-semibold text-cp-text-bright">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[10px] ${
                      on ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-cp-border'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  {t(`onboarding.preset.${p.id}.label`, p.label)}
                </div>
                <p className="text-cp-text-muted">
                  {t(`onboarding.preset.${p.id}.desc`, p.description)}
                </p>
              </button>
            )
          })}
        </div>
      </div>
    </ModalShell>
  )
}
