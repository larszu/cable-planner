import { useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useCircuitStore } from '../../store/circuitStore'
import { useCircuitOverview } from '../../hooks/useCircuit'
import { useTranslation, format } from '../../lib/i18n'
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
        'Show the circuit: which luminaires are lit, switch positions, and which lines are live.',
      )
    : knoten === 0
      ? t(
          'canvas.circuit.emptyTitle',
          'No device in the plan carries a circuit role. It is declared in the properties panel and never guessed from the category.',
        )
      : t(
          'canvas.circuit.onTitle',
          'CALCULATED, not measured: this is how the circuit behaves with the switch positions as set. The positions are not part of the plan.',
        )

  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => setAn(!an)}
        title={titel}
        aria-pressed={an}
        className={`av-focus flex items-center gap-1.5 border border-cp-border px-2 py-0.5 text-cp-xs ${
          an ? 'bg-cp-surface-3 text-cp-text' : 'text-cp-text-secondary hover:bg-cp-surface-3'
        }`}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5"
          style={{ background: an && brennen > 0 ? '#facc15' : 'var(--cp-text-faint, #64748b)' }}
        />
        <span>{t('canvas.circuit.label', 'Circuit')}</span>
        {an && knoten > 0 && (
          <span className="tabular-nums text-cp-text-muted">{`· ${brennen}/${leuchten}`}</span>
        )}
        {an && knoten === 0 && (
          <span className="text-cp-text-muted">{t('canvas.circuit.empty', '· nothing declared')}</span>
        )}
        {an && ohneBauart > 0 && (
          <span className="tabular-nums text-cp-warn">
            {format(t('canvas.circuit.withoutKind', '· {n} without a declared type'), {
              n: ohneBauart,
            })}
          </span>
        )}
      </button>
      {an && knoten > 0 && (
        <button
          type="button"
          onClick={zuruecksetzen}
          title={t(
            'canvas.circuit.resetTitle',
            'All switches back to their default. The plan does not change — it never carried the positions.',
          )}
          className="av-focus border border-cp-border px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3"
        >
          {t('canvas.circuit.reset', 'Reset switches')}
        </button>
      )}
      {an && knoten > 0 && (
        <button
          type="button"
          onClick={() => setVorschlaegeOffen(true)}
          title={t(
            'canvas.circuit.suggestTitle',
            'Why the circuit does not do what it should — and which wire would change that. Every suggestion is computed through and brings its own truth table; nothing is entered without a click.',
          )}
          className="av-focus border border-cp-border px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3"
        >
          {t('canvas.circuit.suggest', 'Suggestions')}
        </button>
      )}
      <CircuitSuggestDialog open={vorschlaegeOffen} onClose={() => setVorschlaegeOffen(false)} />
    </span>
  )
}
