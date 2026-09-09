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
import { PanelHint } from '../../shared/PanelHint'

export const ModulesTab = () => {
  const t = useTranslation()
  const enabledModules = useSettingsStore((s) => s.enabledModules)
  const setModuleEnabled = useSettingsStore((s) => s.setModuleEnabled)

  return (
    <div className="space-y-3">
      <PanelHint
        className="text-cp-base text-cp-text-secondary"
        text={t(
          'settings.modules.intro',
          'Turn feature areas on or off to tailor the interface to your use case. This only affects visibility — saved project data is always kept in full.',
        )}
      />
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
            {t('settings.modules.enable', 'Module enabled')}
          </label>
        </SettingsCard>
      ))}
    </div>
  )
}
