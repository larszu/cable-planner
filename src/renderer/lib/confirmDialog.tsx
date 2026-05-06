import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Promise-based replacement for window.confirm(). Matches `promptDialog`
 * pattern: mounts a one-shot React modal, resolves with `true` on OK,
 * `false` on cancel/Escape/backdrop. Lets every dialog look consistent
 * (instead of a native window.confirm popup that breaks the dark theme)
 * and keeps the call sites short:
 *
 *   if (!(await confirmDialog('Wirklich löschen?'))) return
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
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const done = (value: boolean) => {
      root.unmount()
      container.remove()
      resolve(value)
    }
    root.render(<ConfirmDialog title={title} options={options} onDone={done} />)
  })
}

interface Props {
  title: string
  options: ConfirmDialogOptions
  onDone: (value: boolean) => void
}

const ConfirmDialog = ({ title, options, onDone }: Props) => {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDone(false)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onDone(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  const okBg = options.destructive ? '#dc2626' : '#10b981'
  const okHover = options.destructive ? '#b91c1c' : '#059669'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onDone(false)
      }}
    >
      <div
        style={{
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 16,
          minWidth: 360,
          maxWidth: 520,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ marginBottom: options.body ? 8 : 16, fontSize: 14, fontWeight: 600 }}>
          {title}
        </div>
        {options.body && (
          <div style={{ marginBottom: 16, fontSize: 13, color: '#cbd5e1' }}>
            {options.body}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => onDone(false)}
            style={{
              padding: '6px 14px',
              background: '#334155',
              border: 'none',
              borderRadius: 4,
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {options.cancelLabel ?? 'Abbrechen'}
          </button>
          <button
            ref={okRef}
            type="button"
            onClick={() => onDone(true)}
            style={{
              padding: '6px 14px',
              background: okBg,
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = okHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = okBg)}
          >
            {options.okLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
