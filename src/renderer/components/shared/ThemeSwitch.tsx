import { Monitor, Moon, Sun } from 'lucide-react'
import { setThemeChoice, useThemeChoice, type ThemeChoice } from '../../lib/themeChoice'
import { useEffect, useRef, useState } from 'react'
import { format, useTranslation } from '../../lib/i18n'
import { Tooltip } from './Tooltip'
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

/**
 * Compact theme button for the header (2026-10-14): one icon showing the
 * current choice, a small popover with the three options. The segment above
 * stays in Settings → Appearance; this is the quick way.
 */
export const ThemeHeaderButton = () => {
  const t = useTranslation()
  const choice = useThemeChoice()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: 'auto', label: t('settings.appearance.theme.auto', 'Auto'), icon: Monitor },
    { value: 'light', label: t('settings.appearance.theme.light', 'Light'), icon: Sun },
    { value: 'dark', label: t('settings.appearance.theme.dark', 'Dark'), icon: Moon },
  ]
  const current = options.find((o) => o.value === choice) ?? options[0]
  const name = format(t('app.theme.button', 'Theme: {mode}'), { mode: current.label })
  return (
    <div ref={wrap} className="relative">
      <Tooltip label={name} side="bottom">
        <button
          type="button"
          aria-label={name}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-cp-full text-cp-text hover:bg-cp-surface-2"
        >
          <Icon icon={current.icon} size="sm" />
        </button>
      </Tooltip>
      {open && (
        <div
          role="menu"
          aria-label={t('settings.appearance.theme', 'Theme')}
          className="absolute right-0 top-10 z-[var(--cp-z-menu)] w-44 border border-cp-border bg-cp-surface-raised text-cp-text"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={choice === o.value}
              onClick={() => {
                setThemeChoice(o.value)
                setOpen(false)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-cp-sm hover:bg-cp-surface-2 ${
                choice === o.value ? 'bg-cp-accent-soft font-semibold text-cp-text-bright' : ''
              }`}
            >
              <Icon icon={o.icon} size="sm" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
