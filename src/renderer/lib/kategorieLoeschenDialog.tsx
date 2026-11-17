import { useState } from 'react'
import { format, useTranslation } from './i18n'
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
 * #1273 — Kategorie loeschen, in der noch Geraete liegen.
 *
 * Gefragt wird, was mit den Geraeten geschieht: mitloeschen oder ohne
 * Kategorie unten im Pool behalten. Vorgewaehlt ist BEHALTEN — wer nicht
 * hinsieht und Enter drueckt, verliert keine Vorlage. Eine leere Kategorie
 * fragt der Aufrufer mit dem einfachen `confirmDialog`.
 */
export type KategorieLoeschenWahl = 'behalten' | 'mitloeschen'

export function kategorieLoeschenDialog(name: string, anzahl: number): Promise<KategorieLoeschenWahl | null> {
  return mountModal<KategorieLoeschenWahl | null>((done) => (
    <KategorieLoeschenDialog name={name} anzahl={anzahl} onDone={done} />
  ))
}

const KategorieLoeschenDialog = ({
  name,
  anzahl,
  onDone,
}: {
  name: string
  anzahl: number
  onDone: (wahl: KategorieLoeschenWahl | null) => void
}) => {
  const t = useTranslation()
  const [wahl, setWahl] = useState<KategorieLoeschenWahl>('behalten')
  useModalKeyboard(() => onDone(null), () => onDone(wahl))
  const option = (wert: KategorieLoeschenWahl, text: string) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, cursor: 'pointer' }}>
      <input type="radio" name="kategorie-loeschen" checked={wahl === wert} onChange={() => setWahl(wert)} />
      {text}
    </label>
  )
  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(null))}>
      <div style={{ ...MODAL_CARD, maxWidth: 480 }} role="dialog" aria-modal="true">
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          {format(t('library.deleteCategory.title', 'Delete category "{name}"?'), { name })}
        </div>
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          {anzahl === 1
            ? t('library.deleteCategory.bodyOne', 'One device is still in this category.')
            : format(t('library.deleteCategory.bodyMany', '{n} devices are still in this category.'), { n: anzahl })}
        </div>
        {option('behalten', t('library.deleteCategory.keep', 'Keep the devices, listed without a category'))}
        {option('mitloeschen', t('library.deleteCategory.deleteDevices', 'Delete the devices too'))}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" onClick={() => onDone(null)} style={MODAL_BUTTON_SECONDARY}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="button" onClick={() => onDone(wahl)} style={modalButtonPrimary('#dc2626')}>
            {t('library.deleteCategory.ok', 'Delete category')}
          </button>
        </div>
      </div>
    </div>
  )
}
