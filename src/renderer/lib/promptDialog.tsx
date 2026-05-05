import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Promise-based replacement for window.prompt(). Electron disables the native
 * window.prompt() (it just returns null without showing anything), which is
 * why every "+ Neue Kategorie…" / rename action did nothing in production.
 * Mounts a one-shot modal, resolves with the trimmed string or null on cancel.
 */
export function promptDialog(title: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const done = (value: string | null) => {
      root.unmount()
      container.remove()
      resolve(value)
    }
    root.render(<PromptDialog title={title} defaultValue={defaultValue} onDone={done} />)
  })
}

interface Props {
  title: string
  defaultValue: string
  onDone: (value: string | null) => void
}

const PromptDialog = ({ title, defaultValue, onDone }: Props) => {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    onDone(trimmed.length > 0 ? trimmed : null)
  }

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
        if (e.target === e.currentTarget) onDone(null)
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{
          background: '#1e293b',
          color: '#e2e8f0',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 16,
          minWidth: 320,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
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
            style={{
              padding: '4px 12px',
              background: '#334155',
              border: 'none',
              borderRadius: 4,
              color: '#e2e8f0',
              cursor: 'pointer',
            }}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            style={{
              padding: '4px 12px',
              background: '#10b981',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </form>
    </div>
  )
}
