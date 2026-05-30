// v7.9.22 — Promise-basierter Replacement für window.alert().
// Verwendet das gleiche Modal-Styling wie confirmDialog/promptDialog
// damit Info-Meldungen sich nicht aus dem dunklen Theme rausreißen.
//
//   await infoDialog('Datei gespeichert', { body: 'Pfad: …' })
//
// Optional kann `tone` auf 'info' | 'success' | 'warning' | 'error'
// gesetzt werden — dann wird das Icon + die Accent-Farbe angepasst.
//
// v7.9.45 — Mount-Lifecycle + Backdrop-Styles + Keyboard-Handler aus
// lib/modalRoot. Card-Style hat eigenen Border-Left-Accent, deshalb
// nicht 100% das MODAL_CARD-Style aus modalRoot.

import { useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Check, Info, XCircle } from 'lucide-react'
import { useTranslation } from './i18n'
import { Icon } from '../components/shared/Icon'
import {
  MODAL_BACKDROP,
  MODAL_CARD,
  backdropMouseDown,
  mountModal,
  useModalKeyboard,
} from './modalRoot'

export type InfoDialogTone = 'info' | 'success' | 'warning' | 'error'

export interface InfoDialogOptions {
  body?: string
  /** Body kann auch React-Content sein (z.B. <code>, Links). */
  bodyNode?: React.ReactNode
  okLabel?: string
  tone?: InfoDialogTone
}

const TONE_ACCENT: Record<InfoDialogTone, { bg: string; border: string; icon: LucideIcon }> = {
  info: { bg: '#0ea5e9', border: '#0369a1', icon: Info },
  success: { bg: '#10b981', border: '#059669', icon: Check },
  warning: { bg: '#f59e0b', border: '#b45309', icon: AlertTriangle },
  error: { bg: '#dc2626', border: '#991b1b', icon: XCircle },
}

export function infoDialog(title: string, options: InfoDialogOptions = {}): Promise<void> {
  return mountModal<void>((done) => (
    <InfoDialog title={title} options={options} onDone={() => done(undefined)} />
  ))
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

  useModalKeyboard(onDone, onDone)

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(onDone)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          ...MODAL_CARD,
          border: `1px solid ${accent.border}`,
          borderLeft: `4px solid ${accent.bg}`,
          minWidth: 360,
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
              flexShrink: 0,
            }}
          >
            <Icon icon={accent.icon} size={14} />
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
            autoFocus
          >
            {options.okLabel ?? t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  )
}
