import { useState } from 'react'
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
 * Design-Frage 5, entschieden: bei jedem Ausgang, der die Datei aus der Hand
 * gibt, wird gefragt — statt sie pauschal zu strippen oder pauschal mitzugeben.
 *
 * WARUM NICHT PAUSCHAL. Beide Pauschalen haben einen echten Preis. Immer
 * strippen kostet den Ausroll-Nutzen (wer 24 gleiche Beltpacks ausrollt, will
 * die Werks-Zugangsdaten nicht 24-mal tippen) und beim `.avplan` sogar den
 * verlustfreien Round-Trip — ADR-005 in die andere Richtung. Immer mitgeben
 * schreibt Switch-Passwoerter in einen Team-Ordner oder in eine Datei, die an
 * einen Lichtplaner geht. Die Abwaegung haengt am einzelnen Vorgang, also
 * gehoert sie an den einzelnen Vorgang.
 *
 * WANN NICHT GEFRAGT WIRD. Wenn nichts dabei ist. Eine Rueckfrage, die bei
 * jedem Export erscheint und meistens „nichts dabei" bedeutet, wird zur
 * Klickgewohnheit — und dann liest sie niemand mehr an dem einen Tag, an dem
 * sie zaehlt. Das ist dieselbe Ueberlegung, mit der `avPlanImportWarning` im
 * light-planner bei leerem Bestand schweigt.
 */
export type CredentialChoice = 'include' | 'strip'

export function credentialChoiceDialog(
  /** Wie viele Eintraege Zugangsdaten tragen — steht im Text. */
  count: number,
  /** Wohin es geht, in einem Halbsatz: „in den geteilten Ordner". */
  destination: string,
): Promise<CredentialChoice | null> {
  return mountModal<CredentialChoice | null>((done) => (
    <CredentialChoiceDialog count={count} destination={destination} onDone={done} />
  ))
}

interface Props {
  count: number
  destination: string
  onDone: (value: CredentialChoice | null) => void
}

const CredentialChoiceDialog = ({ count, destination, onDone }: Props) => {
  const t = useTranslation()
  // #1171 — ein Kaestchen statt zweier Knoepfe: „mit oder ohne Passwoerter
  // ankreuzbar". Es steht AUS — wer nichts ankreuzt, gibt nichts mit. Das ist
  // dieselbe Richtung wie bei Escape: bei einer Frage nach Zugangsdaten ist
  // „ich habe nicht hingesehen" kein Grund, sie mitzugeben.
  const [mit, setMit] = useState(false)
  const weiter = () => onDone(mit ? 'include' : 'strip')
  useModalKeyboard(() => onDone(null), weiter)

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(null))}>
      <div style={{ ...MODAL_CARD, maxWidth: 520 }} role="dialog" aria-modal="true">
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          {t('cred.title', 'Include credentials?')}
        </div>
        <div style={{ marginBottom: 12, fontSize: 13, color: '#cbd5e1' }}>
          {count === 1
            ? t('cred.body.one', 'One entry carries a device username or password.')
            : t('cred.body.many', '{n} entries carry a device username or password.').replace(
                '{n}',
                String(count),
              )}{' '}
          {destination}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={mit} onChange={(e) => setMit(e.target.checked)} />
          {t('cred.checkbox', 'Include usernames and passwords')}
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onDone(null)} style={MODAL_BUTTON_SECONDARY}>
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="button" onClick={weiter} style={modalButtonPrimary('#10b981')}>
            {mit ? t('cred.include', 'Include') : t('cred.strip', 'Without credentials')}
          </button>
        </div>
      </div>
    </div>
  )
}
