import { useEffect, useRef, useState } from 'react'
import { useTranslation } from './i18n'
import {
  MODAL_BACKDROP,
  MODAL_BUTTON_SECONDARY,
  MODAL_CARD,
  backdropMouseDown,
  modalButtonPrimary,
  mountModal,
} from './modalRoot'

/**
 * Promise-based replacement for window.prompt(). Electron disables the native
 * window.prompt() (it just returns null without showing anything), which is
 * why every "+ Neue Kategorie…" / rename action did nothing in production.
 * Mounts a one-shot modal, resolves with the trimmed string or null on cancel.
 *
 * v7.9.45 — Mount-Lifecycle + Backdrop-/Card-/Button-Styles aus lib/modalRoot.
 */
export function promptDialog(title: string, defaultValue = ''): Promise<string | null> {
  return mountModal<string | null>((done) => (
    <PromptDialog title={title} defaultValue={defaultValue} onDone={done} />
  ))
}

interface Props {
  title: string
  defaultValue: string
  onDone: (value: string | null) => void
}

const PromptDialog = ({ title, defaultValue, onDone }: Props) => {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const t = useTranslation()

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    onDone(trimmed.length > 0 ? trimmed : null)
  }

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(null))}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{ ...MODAL_CARD, minWidth: 320 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ marginBottom: 8, fontSize: 14 }}>{title}</div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onDone(null)
            }
          }}
          style={{
            width: '100%',
            padding: '6px 8px',
            background: '#0f172a',
            border: '1px solid #475569',
            borderRadius: 4,
            color: '#e2e8f0',
            fontSize: 14,
          }}
        />
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onDone(null)}
            style={MODAL_BUTTON_SECONDARY}
          >
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button type="submit" style={modalButtonPrimary('#10b981')}>
            {t('common.ok', 'OK')}
          </button>
        </div>
      </form>
    </div>
  )
}
