import { Moon, Sun } from 'lucide-react'
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
    { key: 'body', label: t('settings.eqColors.body', 'Karten-Body'), hint: t('settings.eqColors.bodyHint', 'Hintergrund der Geräte-Karte') },
    { key: 'header', label: t('settings.eqColors.header', 'Header-Strip'), hint: t('settings.eqColors.headerHint', 'Strip oben mit Name + IP') },
    { key: 'border', label: t('settings.eqColors.border', 'Rand'), hint: t('settings.eqColors.borderHint', '1-px Border um die Karte') },
    { key: 'text', label: t('settings.eqColors.text', 'Haupttext'), hint: t('settings.eqColors.textHint', 'Geräte-Name + Port-Labels') },
    { key: 'subtext', label: t('settings.eqColors.subtext', 'Sekundär-Text'), hint: t('settings.eqColors.subtextHint', 'Kategorie, IP, Connector-Typen') },
  ]
  return (
    <SettingsCard
      title={t('settings.eqColors.title', 'Geräte-Karten-Farben')}
      description={t(
        'settings.eqColors.description',
        'Hintergrund/Text/Rand für Equipment-Knoten — pro Theme separat anpassbar. Defaults sind so gewählt dass die Karten klar vom Canvas-Hintergrund abstehen. Einzelne Geräte können in den Properties zusätzlich eine individuelle Farbe bekommen.',
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(['light', 'dark'] as const).map((theme) => (
          <div key={theme} className="rounded border border-cp-border bg-cp-surface-3/40 p-2">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-cp-xs font-semibold text-cp-text-bright">
                <Icon icon={theme === 'light' ? Sun : Moon} size="xs" />
                {theme === 'light'
                  ? t('settings.eqColors.themeLight', 'Hell')
                  : t('settings.eqColors.themeDark', 'Dunkel')}
              </h4>
              <button
                type="button"
                onClick={() => resetEquipmentColors(theme)}
                className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
                title={t('settings.eqColors.resetTitle', 'Auf Default zurücksetzen')}
              >
                {t('settings.eqColors.reset', '↺ Reset')}
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
                    <span className="font-mono text-[10px] text-cp-text-muted">
                      {equipmentColors[theme][r.key]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[10px] text-cp-text-muted">
        {t(
          'settings.eqColors.note',
          'Hinweis: Geräte mit eigener Farbe (Properties → Gerätefarbe) überschreiben den Body-Wert weiterhin individuell.',
        )}
      </div>
      {/* v7.9.63 / #172 — Default-Farbe für NEU hinzugefügte Geräte. */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded border border-cp-border bg-cp-surface-3/40 p-2">
        <div>
          <div className="text-cp-xs font-semibold text-cp-text-bright">
            {t('settings.eqColors.defaultDeviceColor', 'Standard-Gerätefarbe')}
          </div>
          <div className="text-[10px] text-cp-text-muted">
            {t(
              'settings.eqColors.defaultDeviceColorHint',
              'Neu hinzugefügte Geräte starten mit dieser Farbe (Properties → Gerätefarbe lässt sich danach individuell ändern). Wenn leer: nutzt die Theme-Body-Farbe.',
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
              className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
            >
              {t('settings.eqColors.resetX', '✕ Reset')}
            </button>
          )}
        </div>
      </div>
    </SettingsCard>
  )
}
