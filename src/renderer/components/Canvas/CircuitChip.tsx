import { useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useCircuitStore } from '../../store/circuitStore'
import { useCircuitOverview } from '../../hooks/useCircuit'
import { useTranslation } from '../../lib/i18n'
import { CircuitSuggestDialog } from './CircuitSuggestDialog'

/**
 * Das Schaltbild — an oder aus, und was es gerade sagt.
 *
 * DIESELBE AUFLAGE WIE BEIM SIGNALFLUSS-STREIFEN, aus derselben Wurzel: eine
 * leuchtende Leuchte auf dem Plan ist eine Aussage über die Anlage. Sie ist
 * hier eine RECHNUNG und keine Messung — „so würde es sich verhalten, wenn
 * die Schalter so stehen" —, und dieser Streifen ist die Stelle, an der das
 * steht. Ohne ihn sähe eine gerechnete Leuchte aus wie eine gemessene.
 *
 * ER NENNT AUCH, WAS NICHT GERECHNET WERDEN KONNTE. Geräte an einem
 * Strom-Kabel ohne angegebene Bauart sind für den Rechner nicht vorhanden;
 * ihre Leuchten „brennen nicht". Diese Zahl ist der Unterschied zwischen
 * „aus" und „niemand hat es angegeben", und sie ist der einzige Ort, an dem
 * er sichtbar wird.
 */
export function CircuitChip() {
  const t = useTranslation()
  const an = useUiStore((s) => s.circuitOverlay)
  const setAn = useUiStore((s) => s.setCircuitOverlay)
  const zuruecksetzen = useCircuitStore((s) => s.zuruecksetzen)
  const { brennen, leuchten, ohneBauart, knoten } = useCircuitOverview()
  const [vorschlaegeOffen, setVorschlaegeOffen] = useState(false)

  const titel = !an
    ? t(
        'canvas.circuit.offTitle',
        'Schaltbild einblenden: brennende Leuchten, Schalterstellungen und Leitungen unter Spannung.',
      )
    : knoten === 0
      ? t(
          'canvas.circuit.emptyTitle',
          'Kein Gerät im Plan trägt eine Schaltbild-Bauart. Sie wird in den Eigenschaften angegeben und nicht aus der Kategorie geraten.',
        )
      : t(
          'canvas.circuit.onTitle',
          'GERECHNET, nicht gemessen: so verhält sich die Schaltung bei den eingestellten Schalterstellungen. Die Stellungen stehen nicht im Plan.',
        )

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setAn(!an)}
        title={titel}
        aria-pressed={an}
        className={`av-focus flex items-center gap-1.5 rounded-full border border-cp-border px-2 py-0.5 text-[11px] ${
          an ? 'bg-cp-surface-3 text-cp-text' : 'text-cp-text-secondary hover:bg-cp-surface-3'
        }`}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: an && brennen > 0 ? '#facc15' : 'var(--cp-text-faint, #64748b)' }}
        />
        <span>{t('canvas.circuit.label', 'Schaltbild')}</span>
        {an && knoten > 0 && (
          <span className="tabular-nums text-cp-text-muted">{`· ${brennen}/${leuchten}`}</span>
        )}
        {an && knoten === 0 && (
          <span className="text-cp-text-muted">{t('canvas.circuit.empty', '· nichts angegeben')}</span>
        )}
        {an && ohneBauart > 0 && (
          <span className="tabular-nums text-cp-warn">{`· ${ohneBauart} ohne Bauart`}</span>
        )}
      </button>
      {an && knoten > 0 && (
        <button
          type="button"
          onClick={zuruecksetzen}
          title={t(
            'canvas.circuit.resetTitle',
            'Alle Schalter zurück auf die Vorgabe. Der Plan ändert sich dadurch nicht — er hat die Stellungen nie getragen.',
          )}
          className="av-focus rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
        >
          {t('canvas.circuit.reset', 'Schalter zurück')}
        </button>
      )}
      {an && knoten > 0 && (
        <button
          type="button"
          onClick={() => setVorschlaegeOffen(true)}
          title={t(
            'canvas.circuit.suggestTitle',
            'Warum tut die Schaltung nicht, was sie soll — und welche Ader würde es ändern. Jeder Vorschlag ist durchgerechnet und bringt seine Wahrheitstafel mit; eingetragen wird nur auf Knopfdruck.',
          )}
          className="av-focus rounded-full border border-cp-border px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-3"
        >
          {t('canvas.circuit.suggest', 'Vorschläge')}
        </button>
      )}
      <CircuitSuggestDialog open={vorschlaegeOffen} onClose={() => setVorschlaegeOffen(false)} />
    </span>
  )
}
