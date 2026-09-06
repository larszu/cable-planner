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
import type { TemplateScope } from './templateScope'

/**
 * BEDARF 91 — die Frage, die beim Speichern einer Vorlage gestellt wird.
 *
 * Dieselbe Bauform und dieselbe Begruendung wie `credentialChoiceDialog`
 * (Design-Frage 5): am einzelnen Vorgang fragen statt pauschal entscheiden,
 * weil beide Pauschalen einen echten Preis haben.
 *
 * Immer strippen kostet genau das, was der Bedarf will — „the most valuable
 * document in the role is the one least likely to exist": die Antworten des
 * Hauses waeren beim naechsten Mal wieder weg, und jemand fragt zum zweiten
 * Mal dieselbe IT-Abteilung.
 *
 * Immer mitgeben bringt die Genehmigungen der Halle A in eine Vorlage, mit
 * der jemand im Kongresszentrum arbeitet. Die Zeilen sehen dort aus wie
 * Auskunft, und niemand fragt nach.
 *
 * GEFRAGT WIRD NUR, WENN ETWAS DRANHAENGT. `venueBoundCount` entscheidet das
 * beim Aufrufer. Eine Rueckfrage, die meistens „nichts dabei" bedeutet, wird
 * zur Klickgewohnheit — und dann liest sie niemand mehr an dem einen Tag, an
 * dem sie zaehlt.
 */
export function venueScopeDialog(
  /** Wie viele ortsgebundene Angaben dranhaengen — steht im Text. */
  count: number,
  /** Der Ort, um den es geht. Leer, wenn das Projekt keinen nennt. */
  venue: string,
): Promise<TemplateScope | null> {
  return mountModal<TemplateScope | null>((done) => (
    <VenueScopeDialog count={count} venue={venue} onDone={done} />
  ))
}

interface Props {
  count: number
  venue: string
  onDone: (value: TemplateScope | null) => void
}

const VenueScopeDialog = ({ count, venue, onDone }: Props) => {
  const t = useTranslation()
  // Escape bricht ab und speichert gar nichts. „Ich habe nicht geantwortet"
  // ist kein Grund, die Antworten eines Hauses weiterzureichen.
  useModalKeyboard(() => onDone(null))

  return (
    <div style={MODAL_BACKDROP} onMouseDown={backdropMouseDown(() => onDone(null))}>
      <div style={{ ...MODAL_CARD, maxWidth: 560 }} role="dialog" aria-modal="true">
        <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          {t('tplScope.title', 'Vorlage an dieses Haus binden?')}
        </div>
        <div style={{ marginBottom: 16, fontSize: 13, color: '#cbd5e1' }}>
          {t(
            'tplScope.body',
            '{n} ortsgebundene Angaben hängen an diesem Projekt — die Antworten der Haus-IT und die Adresse{venue}. Eine neutrale Vorlage lässt sie weg; eine Haus-Vorlage nimmt sie mit und merkt sich, für welches Haus sie gelten.',
          )
            .replace('{n}', String(count))
            .replace('{venue}', venue ? ` (${venue})` : '')}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onDone(null)} style={MODAL_BUTTON_SECONDARY}>
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button type="button" onClick={() => onDone('venue')} style={MODAL_BUTTON_SECONDARY}>
            {t('tplScope.venue', 'Für dieses Haus')}
          </button>
          <button
            type="button"
            onClick={() => onDone('neutral')}
            style={modalButtonPrimary('#10b981')}
          >
            {t('tplScope.neutral', 'Neutral (nur die Form)')}
          </button>
        </div>
      </div>
    </div>
  )
}
