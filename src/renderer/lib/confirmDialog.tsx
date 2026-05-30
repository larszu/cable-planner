import { useRef } from 'react'
import { useTranslation } from './i18n'
import {
  MODAL_BACKDROP,
  MODAL_BUTTON_SECONDARY,
  MODAL_CARD,
  backdropMouseDown,
  modalButtonPrimary,
  mountModal,
  useModalKeyboard,
} from './modalRoot'

/**
 * Promise-based replacement for window.confirm(). Matches `promptDialog`
 * pattern: mounts a one-shot React modal, resolves with `true` on OK,
 * `false` on cancel/Escape/backdrop. Lets every dialog look consistent
 * (instead of a native window.confirm popup that breaks the dark theme)
 * and keeps the call sites short:
 *
 *   if (!(await confirmDialog('Wirklich löschen?'))) return
 *
 * v7.9.45 — Mount-Lifecycle + Backdrop-/Card-/Button-Styles + Keyboard-
 * Handler kommen aus lib/modalRoot. Vorher waren sie in jeder der drei
 * Dialog-Dateien dupliziert.
 */
export interface ConfirmDialogOptions {
  /** Body paragraph below the title. Optional. */
  body?: string
  /** Custom OK button label. Default "OK". */
  okLabel?: string
  /** Custom cancel button label. Default "Abbrechen". */
  cancelLabel?: string
  /**
   * Render OK button red instead of green. Use for destructive actions
   * (delete, overwrite, etc.). Default: false.
   */
  destructive?: boolean
}

export function confirmDialog(
  title: string,
  options: ConfirmDialogOptions = {},
): Promise<boolean> {
  return mountModal<boolean>((done) => (
    <ConfirmDialog title={title} options={options} onDone={done} />
  ))
}

interface Props {
  title: string
  options: ConfirmDialogOptions
  onDone: (value: boolean) => void
}

const ConfirmDialog = ({ title, options, onDone }: Props) => {
  const okRef = useRef<HTMLButtonElement>(null)
  const t = useTranslation()

  useModalKeyboard(
    () => onDone(false),
    () => onDone(true),
  )

  const okColor = options.destructive ? '#dc2626' : '#10b981'
  const okHover = options.destructive ? '#b91c1c' : '#059669'

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(false))}>
      <div style={MODAL_CARD} role="dialog" aria-modal="true" aria-label={title}>
        <div style={{ marginBottom: options.body ? 8 : 16, fontSize: 14, fontWeight: 600 }}>
          {title}
        </div>
        {options.body && (
          <div style={{ marginBottom: 16, fontSize: 13, color: '#cbd5e1' }}>
            {options.body}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => onDone(false)} style={MODAL_BUTTON_SECONDARY}>
            {options.cancelLabel ?? t('common.cancel', 'Abbrechen')}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => onDone(true)}
            style={modalButtonPrimary(okColor)}
            onMouseEnter={(e) => (e.currentTarget.style.background = okHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = okColor)}
            autoFocus
          >
            {options.okLabel ?? t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
