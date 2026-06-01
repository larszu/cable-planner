import type { EdgeRouting } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'

/** Default labels — fallback for `t()` and the source list rendered below. */
const ROUTING_OPTIONS: { value: EdgeRouting; label: string; hint: string }[] = [
  { value: 'orthogonal', label: 'Ortho', hint: 'Rechtwinkliges Routing (draw.io Standard)' },
  { value: 'straight', label: 'Linie', hint: 'Gerade Linie' },
  { value: 'curved', label: 'Kurve', hint: 'Bézier-Kurve' },
]

interface RoutingToggleProps {
  value: EdgeRouting
  onChange: (value: EdgeRouting) => void
  /** Visual style — toolbar uses pill-style buttons, dialogs use larger pills. */
  variant?: 'toolbar' | 'pills'
  /** Override the light-theme detection (for canvas-toolbar embedding). */
  isLight?: boolean
  className?: string
}

/**
 * Three-button group "Ortho / Linie / Kurve". Single source of truth for the
 * cable-routing chooser — replaces three hand-rolled copies in CanvasToolbar,
 * CableProperties and SettingsDialog.
 */
export const RoutingToggle = ({
  value,
  onChange,
  variant = 'pills',
  isLight = false,
  className,
}: RoutingToggleProps) => {
  const t = useTranslation()
  const options = ROUTING_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`routing.${opt.value}.label`, opt.label),
    hint: t(`routing.${opt.value}.hint`, opt.hint),
  }))
  if (variant === 'toolbar') {
    return (
      <div className={className} style={{ display: 'flex', gap: 4 }}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.hint}
            style={{
              padding: '2px 6px',
              background:
                value === opt.value ? '#0369a1' : isLight ? '#e2e8f0' : '#1e293b',
              border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
              color: isLight ? '#1e293b' : '#e2e8f0',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )
  }

  // Default 'pills' variant — used in property panels and settings.
  // (Über die übersetzten `options` mappen, nicht über die deutsche Rohliste.)
  return (
    <div className={className ?? 'flex gap-1'}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          title={opt.hint}
          className={`flex-1 rounded px-2 py-1 text-cp-xs ${
            value === opt.value
              ? 'bg-sky-700 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
