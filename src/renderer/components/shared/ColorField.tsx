// v7.9.43 — Wiederverwendbares Color-Picker-Field.
//
// Vorher gab es drei sehr ähnliche Color-Input-Setups: CableProperties
// (vertikal, full-width), LocationProperties (vertikal, full-width),
// EquipmentProperties (horizontal mit Reset-Button). Jedes Setup hatte
// minimale Style-Abweichungen (h-7 vs h-8 vs h-9, rounded, padding-1),
// was zwischen den Properties-Panels leicht uneinheitlich wirkte.
//
// Jetzt: ein ColorField mit `layout`-Variante. Default "block" für
// vertikal+fullwidth, "inline" für die horizontale Variante mit
// optionalem Reset-Button.

import { useTranslation } from '../../lib/i18n'

interface ColorFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Wenn gesetzt: zeigt einen kleinen Reset-Button rechts neben dem
   *  Swatch (nur sinnvoll wenn der Wert optional ist und ein Default-
   *  Fallback existiert). */
  onReset?: () => void
  /** 'block' = Label oben, Swatch full-width darunter (Default).
   *  'inline' = Label links, Swatch+Reset rechts. */
  layout?: 'block' | 'inline'
  /** Optional tooltip für den Swatch. */
  title?: string
}

export const ColorField = ({
  label,
  value,
  onChange,
  onReset,
  layout = 'block',
  title,
}: ColorFieldProps) => {
  const t = useTranslation()
  if (layout === 'inline') {
    return (
      <label className="flex items-center justify-between gap-2">
        <span className="text-cp-text-secondary">{label}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-7 w-12 cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-0.5"
            title={title}
            aria-label={label}
          />
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="rounded bg-cp-surface-4 px-1.5 py-0.5 text-[10px] hover:bg-cp-surface-5"
              title={t('colorField.resetTitle', 'Farbe zurücksetzen')}
            >
              {t('colorField.resetBtn', '✕ Reset')}
            </button>
          )}
        </div>
      </label>
    )
  }
  return (
    <label className="block">
      <span className="mb-1 block text-cp-text-secondary">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-1"
        title={title}
        aria-label={label}
      />
    </label>
  )
}
