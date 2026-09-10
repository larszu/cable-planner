import { Moon, RotateCcw, Sun, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { SettingsCard } from './SettingsCard'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'

/**
 * #307 — Equipment-Karten-Farben-Konfiguration. Wird im AppearanceTab
 * eingebunden. Eigene Datei weil ~90 LOC selbständig genug sind.
 */
export const EquipmentColorsSection = () => {
  const t = useTranslation()
  const equipmentColors = useUiStore((s) => s.equipmentColors)
  const setEquipmentColors = useUiStore((s) => s.setEquipmentColors)
  const resetEquipmentColors = useUiStore((s) => s.resetEquipmentColors)
  const defaultDeviceColor = useUiStore((s) => s.defaultDeviceColor)
  const setDefaultDeviceColor = useUiStore((s) => s.setDefaultDeviceColor)
  const roles: Array<{ key: keyof typeof equipmentColors.light; label: string; hint: string }> = [
    { key: 'body', label: t('settings.eqColors.body', 'Card body'), hint: t('settings.eqColors.bodyHint', 'Background of the device card') },
    { key: 'header', label: t('settings.eqColors.header', 'Header strip'), hint: t('settings.eqColors.headerHint', 'Top strip with name + IP') },
    { key: 'border', label: t('settings.eqColors.border', 'Border'), hint: t('settings.eqColors.borderHint', '1px border around the card') },
    { key: 'text', label: t('settings.eqColors.text', 'Main text'), hint: t('settings.eqColors.textHint', 'Device name + port labels') },
    { key: 'subtext', label: t('settings.eqColors.subtext', 'Secondary text'), hint: t('settings.eqColors.subtextHint', 'Category, IP, connector types') },
  ]
  return (
    <SettingsCard
      title={t('settings.eqColors.title', 'Device card colors')}
      description={t(
        'settings.eqColors.description',
        'Background/text/border for equipment nodes — adjustable per theme. Defaults are chosen so the cards stand out from the canvas background. Individual devices can have their own color in Properties.',
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(['light', 'dark'] as const).map((theme) => (
          <div key={theme} className="rounded border border-cp-border bg-cp-surface-3/40 p-2">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-cp-xs font-semibold text-cp-text-bright">
                <Icon icon={theme === 'light' ? Sun : Moon} size="xs" />
                {theme === 'light'
                  ? t('settings.eqColors.themeLight', 'Light')
                  : t('settings.eqColors.themeDark', 'Dark')}
              </h4>
              <button
                type="button"
                onClick={() => resetEquipmentColors(theme)}
                className="inline-flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-5"
                title={t('settings.eqColors.resetTitle', 'Reset to default')}
              >
                <Icon icon={RotateCcw} size="xs" />
                {t('settings.eqColors.reset', 'Reset')}
              </button>
            </div>
            <div className="space-y-1.5">
              {roles.map((r) => (
                <label key={r.key} className="flex items-center justify-between gap-2 text-cp-xs">
                  <span className="text-cp-text-secondary" title={r.hint}>{r.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={equipmentColors[theme][r.key]}
                      onChange={(e) => setEquipmentColors(theme, { [r.key]: e.target.value })}
                      className="h-6 w-10 cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-0.5"
                      title={r.hint}
                    />
                    <span className="font-mono text-cp-xs text-cp-text-muted">
                      {equipmentColors[theme][r.key]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-cp-xs text-cp-text-muted">
        {t(
          'settings.eqColors.note',
          'Note: Devices with their own color (Properties → device color) still override the body value individually.',
        )}
      </div>
      {/* v7.9.63 / #172 — Default-Farbe für NEU hinzugefügte Geräte. */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded border border-cp-border bg-cp-surface-3/40 p-2">
        <div>
          <div className="text-cp-xs font-semibold text-cp-text-bright">
            {t('settings.eqColors.defaultDeviceColor', 'Default device color')}
          </div>
          <div className="text-cp-xs text-cp-text-muted">
            {t(
              'settings.eqColors.defaultDeviceColorHint',
              'Newly added devices start with this color (Properties → device color can change it individually). Empty: uses the theme body color.',
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={defaultDeviceColor ?? '#475569'}
            onChange={(e) => setDefaultDeviceColor(e.target.value)}
            className="h-7 w-12 cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-0.5"
          />
          {defaultDeviceColor && (
            <button
              type="button"
              onClick={() => setDefaultDeviceColor(undefined)}
              className="inline-flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-0.5 text-cp-xs hover:bg-cp-surface-5"
            >
              <Icon icon={X} size="xs" />
              {t('settings.eqColors.resetX', 'Reset')}
            </button>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
