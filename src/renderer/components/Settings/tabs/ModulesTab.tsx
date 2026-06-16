/**
 * Modulares UI — Settings-Tab „Module" (ClickApps-artiger Schaltplatz).
 *
 * Dauerhafte, durchsuchbare Heimat zum Ein-/Ausschalten der Funktionsmodule.
 * Module steuern NUR die UI-Sichtbarkeit; Projektdaten bleiben unberührt.
 * Siehe `docs/modular-ui-concept.md`.
 */
import { useSettingsStore } from '../../../store/settingsStore'
import { useTranslation } from '../../../lib/i18n'
import { MODULES } from '../../../lib/modules'
import { SettingsCard } from '../SettingsCard'

export const ModulesTab = () => {
  const t = useTranslation()
  const enabledModules = useSettingsStore((s) => s.enabledModules)
  const setModuleEnabled = useSettingsStore((s) => s.setModuleEnabled)

  return (
    <div className="space-y-3">
      <p className="text-cp-base text-cp-text-secondary">
        {t(
          'settings.modules.intro',
          'Schalte Funktionsbereiche ein oder aus, um die Oberfläche auf deinen Anwendungsfall zuzuschneiden. Das betrifft nur die Sichtbarkeit — gespeicherte Projektdaten bleiben immer vollständig erhalten.',
        )}
      </p>
      {MODULES.map((m) => (
        <SettingsCard
          key={m.id}
          title={t(`settings.modules.${m.id}.label`, m.label)}
          description={t(`settings.modules.${m.id}.desc`, m.description)}
        >
          <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
            <input
              type="checkbox"
              checked={enabledModules[m.id]}
              onChange={(e) => setModuleEnabled(m.id, e.target.checked)}
            />
            {t('settings.modules.enable', 'Modul aktiviert')}
          </label>
        </SettingsCard>
      ))}
    </div>
  )
}
