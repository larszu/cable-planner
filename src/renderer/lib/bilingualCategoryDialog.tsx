import { useEffect, useRef, useState } from 'react'
import { useTranslation } from './i18n'
import { useUiStore } from '../store/uiStore'
import {
  MODAL_BACKDROP,
  MODAL_BUTTON_SECONDARY,
  MODAL_CARD,
  backdropMouseDown,
  modalButtonPrimary,
  mountModal,
} from './modalRoot'

/**
 * #309 — Bilinguale Kategorie-Eingabe. Statt zwei nacheinander
 * geöffneten promptDialogs (zu klick-lastig) ein einziger Dialog mit
 * zwei Feldern. Das Feld der aktiven UI-Sprache ist vorbefüllt mit
 * dem evtl. übergebenen `current`-Wert; das andere bleibt leer.
 *
 * Resolution-Vertrag:
 *   - User cancelt → resolves `null`
 *   - Beide Felder leer → `null` (wie cancel)
 *   - Sonst → { de, en, canonical } wobei `canonical` der nicht-leere
 *     Wert in der UI-Sprache ist (oder das nicht-leere Gegenfeld als
 *     Fallback). Damit landet die Eingabe in `knownCategories[]` in
 *     der Sprache in der der User gerade gearbeitet hat — Bestands-
 *     Verhalten bleibt erhalten.
 */
export interface BilingualCategoryResult {
  de: string
  en: string
  canonical: string
}

export function bilingualCategoryDialog(
  title: string,
  initial?: { de?: string; en?: string },
): Promise<BilingualCategoryResult | null> {
  return mountModal<BilingualCategoryResult | null>((done) => (
    <BilingualCategoryPrompt title={title} initial={initial} onDone={done} />
  ))
}

interface Props {
  title: string
  initial?: { de?: string; en?: string }
  onDone: (value: BilingualCategoryResult | null) => void
}

const BilingualCategoryPrompt = ({ title, initial, onDone }: Props) => {
  const t = useTranslation()
  const lang = useUiStore((s) => s.language)
  const [de, setDe] = useState(initial?.de ?? '')
  const [en, setEn] = useState(initial?.en ?? '')
  const firstInputRef = useRef<HTMLInputElement>(null)
  const secondInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstInputRef.current?.focus()
    firstInputRef.current?.select()
  }, [])

  const submit = () => {
    const deTrim = de.trim()
    const enTrim = en.trim()
    if (!deTrim && !enTrim) {
      onDone(null)
      return
    }
    // Canonical = die UI-Sprache des Users (falls leer, das andere Feld).
    const canonical =
      lang === 'de' ? deTrim || enTrim : enTrim || deTrim
    onDone({ de: deTrim, en: enTrim, canonical })
  }

  // In der aktiven UI-Sprache ist das Feld weiter oben, damit der User
  // direkt tippen kann, ohne zwischen den Inputs springen zu müssen.
  const fields: {
    key: 'de' | 'en'
    label: string
    placeholder: string
    value: string
    set: (v: string) => void
    ref?: React.RefObject<HTMLInputElement | null>
  }[] = (
    lang === 'de'
      ? [
          { key: 'de', label: t('category.bilingual.de', 'Deutsch'), placeholder: 'z. B. Kamera', value: de, set: setDe, ref: firstInputRef },
          { key: 'en', label: t('category.bilingual.en', 'Englisch'), placeholder: 'e.g. Camera', value: en, set: setEn, ref: secondInputRef },
        ]
      : [
          { key: 'en', label: t('category.bilingual.en', 'Englisch'), placeholder: 'e.g. Camera', value: en, set: setEn, ref: firstInputRef },
          { key: 'de', label: t('category.bilingual.de', 'Deutsch'), placeholder: 'z. B. Kamera', value: de, set: setDe, ref: secondInputRef },
        ]
  )

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(null))}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        style={{ ...MODAL_CARD, minWidth: 360 }}
      >
        <div style={{ marginBottom: 8, fontSize: 14 }}>{title}</div>
        <div style={{ marginBottom: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
          {t(
            'category.bilingual.hint',
            'Beide Sprachen ausfüllen — beim Umschalten der UI-Sprache wird der jeweilige Name angezeigt. Leer lassen ist OK, dann fällt die Anzeige auf die andere Sprache zurück.',
          )}
        </div>
        {fields.map((field, idx) => (
          <label key={field.key} style={{ display: 'block', marginBottom: idx === 0 ? 8 : 0 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
              {field.label}
            </div>
            <input
              ref={field.ref}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder={field.placeholder}
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
          </label>
        ))}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => onDone(null)} style={MODAL_BUTTON_SECONDARY}>
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
