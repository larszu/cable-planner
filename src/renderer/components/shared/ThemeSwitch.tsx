import { Monitor, Moon, Sun } from 'lucide-react'
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../lib/themeChoice'
import { useTranslation } from '../../lib/i18n'
import { Icon } from './Icon'

/**
 * Auto · Light · Dark as one segment (design contract 2026-10: the switch is
 * visible, Auto follows the system, the choice is stored with the UI settings).
 * Every option carries its word, not just an icon — `ui:labels` caps
 * icon-only buttons.
 */
export const ThemeSwitch = ({ className = '' }: { className?: string }) => {
  const t = useTranslation()
  const choice = useThemeChoice()
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'auto', label: t('settings.appearance.theme.auto', 'Auto'), icon: Monitor },
    { value: 'light', label: t('settings.appearance.theme.light', 'Light'), icon: Sun },
    { value: 'dark', label: t('settings.appearance.theme.dark', 'Dark'), icon: Moon },
  ]
  return (
    <div
      className={`cp-segment ${className}`}
      role="group"
      aria-label={t('settings.appearance.theme', 'Theme')}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={choice === o.value}
          onClick={() => setThemeChoice(o.value)}
        >
          <Icon icon={o.icon} size="xs" />
          {o.label}
        </button>
      ))}
    </div>
  )
}
