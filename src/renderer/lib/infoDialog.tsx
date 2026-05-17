// v7.9.22 — Promise-basierter Replacement für window.alert().
// Verwendet das gleiche Modal-Styling wie confirmDialog/promptDialog
// damit Info-Meldungen sich nicht aus dem dunklen Theme rausreißen.
//
//   await infoDialog('Datei gespeichert', { body: 'Pfad: …' })
//
// Optional kann `tone` auf 'info' | 'success' | 'warning' | 'error'
// gesetzt werden — dann wird das Icon + die Accent-Farbe angepasst.

import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from './i18n'

export type InfoDialogTone = 'info' | 'success' | 'warning' | 'error'

export interface InfoDialogOptions {
  body?: string
  /** Body kann auch React-Content sein (z.B. <code>, Links). */
  bodyNode?: React.ReactNode
  okLabel?: string
  tone?: InfoDialogTone
}

const TONE_ACCENT: Record<InfoDialogTone, { bg: string; border: string; icon: string }> = {
  info: { bg: '#0ea5e9', border: '#0369a1', icon: 'ℹ' },
  success: { bg: '#10b981', border: '#059669', icon: '✓' },
  warning: { bg: '#f59e0b', border: '#b45309', icon: '⚠' },
  error: { bg: '#dc2626', border: '#991b1b', icon: '⛌' },
}

export function infoDialog(title: string, options: InfoDialogOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const done = () => {
      root.unmount()
      container.remove()
      resolve()
    }
    root.render(<InfoDialog title={title} options={options} onDone={done} />)
  })
}

interface Props {
  title: string
  options: InfoDialogOptions
  onDone: () => void
}

const InfoDialog = ({ title, options, onDone }: Props) => {
  const okRef = useRef<HTMLButtonElement>(null)
  const t = useTranslation()
  const tone = options.tone ?? 'info'
  const accent = TONE_ACCENT[tone]

  useEffect(() => {
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        onDone()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

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
        if (e.target === e.currentTarget) onDone()
      }}
    >
      <div
        style={{
          background: '#1e293b',
          color: '#e2e8f0',
          border: `1px solid ${accent.border}`,
          borderLeft: `4px solid ${accent.bg}`,
          borderRadius: 8,
          padding: 16,
          minWidth: 360,
          maxWidth: 560,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: options.body || options.bodyNode ? 8 : 16,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: accent.bg,
              color: '#0f172a',
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {accent.icon}
          </span>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '22px' }}>{title}</div>
        </div>
        {(options.body || options.bodyNode) && (
          <div
            style={{
              marginBottom: 16,
              fontSize: 13,
              color: '#cbd5e1',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {options.bodyNode ?? options.body}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            ref={okRef}
            type="button"
            onClick={onDone}
            style={{
              padding: '6px 16px',
              background: accent.bg,
              border: 'none',
              borderRadius: 4,
              color: '#0f172a',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {options.okLabel ?? t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
