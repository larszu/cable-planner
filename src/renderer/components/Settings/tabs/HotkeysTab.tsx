import { useState } from 'react'
import { X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import { HOTKEY_ACTION_LABEL, comboFromEvent } from '../../../lib/hotkeys'
import { SettingsCard } from '../SettingsCard'

/**
 * #307 — Hotkeys-Tab aus SettingsDialog ausgelagert.
 */

const HotkeyRow = ({
  action,
  combo,
  onChange,
}: {
  action: string
  combo: string
  onChange: (combo: string) => void
}) => {
  const t = useTranslation()
  const [capturing, setCapturing] = useState(false)
  const label = t(`hotkeys.action.${action}`, HOTKEY_ACTION_LABEL[action] ?? action)
  return (
    <li className="flex items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-3 px-2 py-1.5 text-cp-xs">
      <span className="flex-1 truncate text-cp-text-bright">{label}</span>
      <button
        type="button"
        onClick={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        onKeyDown={(e) => {
          if (!capturing) return
          e.preventDefault()
          const next = comboFromEvent(e)
          if (next) {
            onChange(next)
            setCapturing(false)
          }
        }}
        className={`min-w-[120px] rounded border px-2 py-1 text-center font-mono text-[11px] ${
          capturing
            ? 'border-sky-500 bg-sky-950/60 text-sky-200'
            : 'border-cp-border bg-cp-surface-1 text-cp-text-secondary hover:border-cp-surface-5'
        }`}
        title={
          capturing
            ? t('settings.hotkeys.captureTitle', 'Taste oder Tasten-Kombination drücken…')
            : t('settings.hotkeys.clickToCapture', 'Klicken und Taste(n) drücken')
        }
      >
        {capturing ? t('settings.hotkeys.pressKey', 'Taste drücken…') : combo || '—'}
      </button>
      <button
        type="button"
        onClick={() => onChange('')}
        className="rounded bg-cp-surface-2 px-1.5 py-0.5 text-[10px] text-cp-text-muted hover:bg-red-700 hover:text-white"
        title={t('settings.hotkeys.clear', 'Hotkey leeren')}
        aria-label={t('settings.hotkeys.clear', 'Hotkey leeren')}
      >
        <Icon icon={X} size="sm" />
      </button>
    </li>
  )
}

export const HotkeysTab = () => {
  const t = useTranslation()
  const hotkeys = useUiStore((s) => s.hotkeys)
  const setHotkey = useUiStore((s) => s.setHotkey)
  const resetHotkeys = useUiStore((s) => s.resetHotkeys)
  const actions = Object.keys(HOTKEY_ACTION_LABEL)
  return (
    <div className="space-y-3">
      <p className="text-cp-xs text-cp-text-muted">
        {t(
          'settings.hotkeys.intro',
          'Tastenkürzel können hier frei belegt werden. Klicke auf eine Combo-Zelle und drücke die gewünschten Tasten — Ctrl/Shift/Alt + Buchstabe oder Funktionstaste.',
        )}
      </p>
      <SettingsCard
        title={t('settings.hotkeys.title', 'Aktive Tastenkürzel')}
        description={t(
          'settings.hotkeys.desc',
          'Format: Ctrl+Shift+S. Leere Felder deaktivieren den Hotkey. Doppel-Belegungen sind erlaubt — der zuerst gefundene Hotkey gewinnt.',
        )}
      >
        <ul className="space-y-1">
          {actions.map((action) => (
            <HotkeyRow
              key={action}
              action={action}
              combo={hotkeys[action] ?? ''}
              onChange={(combo) => setHotkey(action, combo)}
            />
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={resetHotkeys}
            className="rounded bg-cp-surface-2 px-3 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-4"
          >
            {t('settings.hotkeys.reset', 'Auf Standard zurücksetzen')}
          </button>
        </div>
      </SettingsCard>
    </div>
  )
}
