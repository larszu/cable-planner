import { useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import {
  COMPANION_API,
  COMPANION_SCHNITTSTELLE_HINWEIS,
  companionAbfrage,
  leseCompanionStand,
  type CompanionAblesung,
} from '../../lib/companionVariablen'

/**
 * Der Companion-Variablenstand als ZWEITE Quelle (E-23, letzter offener Punkt).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM HIER EIN TEXTFELD STEHT UND KEIN „JETZT ABFRAGEN"-KNOPF
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Knopf, der Companion befragt und das Ergebnis anzeigt, wäre der
 * Anfang des Monitors, den die Bedarfs-Datenbank ausdrücklich verbietet
 * („a live monitoring dashboard, which would make the suite responsible
 * for a false all-clear"). Der zweite Schritt wäre ein Intervall, der
 * dritte eine Farbe, und dann steht dort ein Anlagenzustand.
 *
 * Deshalb dieselbe Bauform wie im übrigen Plan: **er benennt den Weg, er
 * geht ihn nicht.** Links stehen die Befehlszeilen zum Mitnehmen, rechts
 * kommt zurück, was jemand aus der Sitzung kopiert hat. Was dabei
 * herauskommt, trägt den Zeitpunkt des ABLESENS und behauptet nichts über
 * jetzt.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DIESER SCHRITT NOCH NICHT KANN — UND WARUM DAS SO DASTEHT
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Es fehlt die PLAN-SEITE. `companionAsBuilt` kann eine Ablesung gegen
 * einen erwarteten Wert stellen, aber der Plan hält nirgends fest, welchen
 * Kreuzpunkt er zuletzt über welche Variable gefahren hat — `controlCompanion`
 * trägt die Variablen-NAMEN, nicht ihre Werte. Diesen Wert hier zu raten
 * hiesse, eine Abweichung zu behaupten, die niemand gemessen hat.
 *
 * Die Zeile sagt das lieber, als es zu verschweigen: eine Ablesung ohne
 * Plan-Seite ist im As-built-Sinn `unexpected` („vorgefunden, nicht im
 * Plan") und kein Fehler.
 */
export const CompanionStandSection = () => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)

  // Die Variablennamen kommen aus dem Plan, nicht aus einer Eingabe: nur was
  // dort steht, kann der Plan hinterher auch zuordnen.
  const namen = useMemo(() => {
    const raus: string[] = []
    for (const item of equipment) {
      const c = item.controlCompanion
      if (!c) continue
      if (c.varOut.trim()) raus.push(c.varOut.trim())
      if (c.varIn.trim()) raus.push(c.varIn.trim())
    }
    return [...new Set(raus)]
  }, [equipment])

  const zeilen = useMemo(() => companionAbfrage(namen), [namen])
  const [antwort, setAntwort] = useState('')
  const [ablesungen, setAblesungen] = useState<CompanionAblesung[]>([])
  const [problem, setProblem] = useState<string | undefined>()

  const lesen = () => {
    // Die Uhr steht HIER und nicht im Baustein: der Zeitpunkt des Ablesens
    // ist eine Beobachtung dieses Augenblicks, und der Baustein bleibt rein.
    const erg = leseCompanionStand(antwort, namen, new Date().toISOString())
    setAblesungen(erg.ablesungen)
    setProblem(erg.problem)
  }

  return (
    <div className="mt-5 border-t border-cp-border-muted pt-3">
      <div className="mb-1 text-cp-xs font-semibold text-cp-text">
        {t('companion.title', 'Read back Companion variable values')}
      </div>
      <PanelHint
        className="mb-2 text-cp-xs text-cp-text-muted"
        text={t('companion.optIn', COMPANION_SCHNITTSTELLE_HINWEIS)}
      />

      {namen.length === 0 ? (
        <div className="rounded border border-cp-border-muted bg-cp-surface-2 p-3 text-cp-xs text-cp-text-muted">
          {t(
            'companion.noVars',
            'No device in the plan is switched through Companion — there is no variable to read back.',
          )}
        </div>
      ) : (
        <>
          <div className="mb-1 text-cp-xs text-cp-text-muted">
            {t(
              'companion.commandsHint',
              'Type these lines into the Companion control API (TCP, one line per command) and bring the answers back:',
            )}
          </div>
          <pre className="mb-2 max-h-32 overflow-auto rounded border border-cp-border bg-cp-surface-2 p-2 text-cp-xs text-cp-text-secondary">
            {zeilen.join('\n')}
          </pre>

          <label className="block text-cp-xs">
            <span className="mb-1 block text-cp-text-muted">
              {t('companion.paste', 'Paste the answers here')}
            </span>
            <textarea
              className="h-20 w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 font-mono text-cp-xs"
              value={antwort}
              placeholder={'+OK "3"\n+OK "5"'}
              onChange={(e) => setAntwort(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="mt-1 rounded bg-cp-surface-3 px-2 py-1 text-cp-xs hover:bg-cp-surface-4"
            onClick={lesen}
          >
            {t('companion.read', 'Take as a reading')}
          </button>

          {problem && (
            <div className="mt-2 rounded border border-cp-warn bg-cp-warn/10 p-2 text-cp-xs text-cp-warn">
              {problem}
            </div>
          )}

          {ablesungen.length > 0 && (
            <>
              <ul className="mt-2 max-h-40 overflow-y-auto text-cp-xs">
                {ablesungen.map((a) => (
                  <li
                    key={a.variable}
                    className="border-b border-cp-border-muted py-1 text-cp-text-secondary last:border-b-0"
                  >
                    <span className="font-mono">{a.variable}</span>
                    {' — '}
                    {a.antwort.fehler
                      ? t('companion.notRead', 'not read') + `: ${a.antwort.fehler}`
                      : (a.antwort.wert ?? t('companion.noValue', 'no value'))}
                    <span className="text-cp-text-faint">
                      {' '}
                      · {t('companion.readAt', 'read at')} {a.gelesenAm.slice(11, 19)}
                    </span>
                  </li>
                ))}
              </ul>
              <PanelHint
                className="mt-1 text-cp-xs text-cp-text-muted"
                text={t(
                  'companion.noPlanSide',
                  'This is a reading from a moment ago, not a state right now — and it stands without a plan side: the plan does not record which value it last wrote into this variable.',
                )}
              />
            </>
          )}
        </>
      )}
      <div className="mt-1 text-cp-xs text-cp-text-faint">
        {t('companion.source', 'Protocol details looked up in')} {COMPANION_API.gelesen}
      </div>
    </div>
  )
}
