import { useState } from 'react'
import { useTranslation } from '../../lib/i18n'
import { teile } from '../../lib/panelHint'

/**
 * Der Erklärsatz über einem Panel — erste Zeile sichtbar, Rest auf Wunsch.
 *
 * WARUM ES DAS GIBT (Nutzer-Rückmeldung 2026-09-07): „Auch viele schriftliche
 * Informationen die überladen wirken aus Enduser-Ansicht." Nachgemessen im
 * laufenden Fenster: das Hauptfenster trägt 219 Zeichen Fließtext — der
 * Analysen-Dialog auf dem Netzwerk-Reiter **3.327 Zeichen in 25 Blöcken**,
 * einzelne davon 349 Zeichen lang. Auf einem Blatt, dessen Aufgabe eine
 * Tabelle ist.
 *
 * WAS HIER NICHT PASSIERT: den Text löschen. Er ist nicht falsch, und er
 * beantwortet echte Fragen („Vergibt das Werkzeug selbst Adressen?"). Er ist
 * nur dauerhaft im Weg. Diese Codebasis erklärt bewusst, WARUM etwas so ist —
 * die Regel dafür lautet, dass die Begründung dorthin gehört, wo jemand sie
 * SUCHT, und nicht dorthin, wo jeder an ihr vorbei muss.
 *
 * DIE TEILUNG. Sichtbar bleibt der erste Satz — in den Texten dieser Codebasis
 * ist das durchweg die Tatsache („Die Haus-Ebene ersetzt einen stehenden
 * Bereich mit demselben Schlüssel"). Der Rest ist die Begründung und steht
 * hinter „mehr". Ein einsätziger Hinweis bleibt unverändert und bekommt keinen
 * Knopf: ein Aufklapper, hinter dem nichts steckt, ist schlimmer als der Satz
 * selbst.
 */
/**
 * `className` ERSETZT die Vorgabe, statt sie zu ergaenzen. Zwei Tailwind-
 * Utilities derselben Eigenschaft (`mb-2` und `mb-3`, `text-cp-text-muted` und
 * `text-cp-text-secondary`) entscheiden sich nicht ueber die Reihenfolge im
 * Attribut, sondern ueber die Reihenfolge im Stylesheet — beim Ergaenzen kaeme
 * also mal die eine, mal die andere durch, und zwar unvorhersehbar. Wer eine
 * eigene Klasse mitgibt, gibt die ganze mit.
 */
const KLASSE_VORGABE = 'mb-2 text-cp-text-muted'

export const PanelHint = ({ text, className }: { text: string; className?: string }) => {
  const t = useTranslation()
  const [offen, setOffen] = useState(false)

  const { kopf, rest } = teile(text)

  if (!rest) {
    return <p className={className ?? KLASSE_VORGABE}>{text}</p>
  }

  return (
    <p className={className ?? KLASSE_VORGABE}>
      {offen ? text : kopf}{' '}
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="underline decoration-dotted underline-offset-2 hover:text-cp-text"
      >
        {offen ? t('common.less', 'weniger') : t('common.more', 'mehr')}
      </button>
    </p>
  )
}
