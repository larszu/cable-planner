import { useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { PanelHint } from '../shared/PanelHint'
import {
  ACTION_SOURCE_LABEL,
  ACTION_URGENCY_LABEL,
  actionCounts,
  actionItems,
  type ActionUrgency,
} from '../../lib/actionItems'
import { useAusgaben, useBestand } from '../../lager'

/**
 * BEDARF 108 — die Liste, die sagt, was ansteht.
 *
 * Der Bedarf sagt, was diese Seite NICHT ist: „a notification-and-derivation
 * product, NOT an authoring product". Hier wird deshalb nichts bearbeitet.
 * Jede Zeile nennt ihre Quelle, und wer sie erledigen will, geht dorthin —
 * auf die Crew-Seite, auf die Kostenseite, ins Lager. Ein zweiter
 * Bearbeitungsweg neben dem vorhandenen waere die zweite Stelle, an der
 * dieselbe Zahl entsteht.
 *
 * WAS HIER GERECHNET WIRD: nichts. `actionItems` sammelt ein, was die
 * Fachmodule ohnehin melden.
 */
const TON: Readonly<Record<ActionUrgency, string>> = {
  overdue: 'text-cp-danger',
  today: 'text-cp-warn',
  ahead: 'text-cp-text',
  undated: 'text-cp-text-muted',
}

const heute = (): string => new Date().toISOString().slice(0, 10)

export const ActionTab = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const inventory = useBestand()
  const checkouts = useAusgaben()

  // Der Stichtag wird EINMAL beim Rendern geholt und dann durchgereicht —
  // `actionItems` selbst liest keine Uhr, sonst waere sie nicht pruefbar.
  const items = useMemo(
    () => actionItems({ today: heute(), project, inventory, checkouts }),
    [project, inventory, checkouts],
  )
  const zahlen = actionCounts(items)

  return (
    <div className="flex flex-col gap-2 text-cp-sm">
      <PanelHint
        text={t(
          'analysis.action.hint',
          'Diese Seite sagt, was ansteht — sie bearbeitet nichts. Jede Zeile kommt aus der Stelle, die sie meldet: Crew, Kosten, Belege, Lager. Was hier fehlt, fehlt auch dort; hier entsteht keine zweite Rechnung.',
        )}
      />

      {items.length === 0 ? (
        <p className="text-cp-xs text-cp-text-muted">
          {t('analysis.action.none', 'Nichts offen — es gibt zu diesem Stand nichts zu melden.')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-cp-xs">
            {(['overdue', 'today', 'ahead', 'undated'] as ActionUrgency[])
              .filter((u) => zahlen[u] > 0)
              .map((u) => (
                <span key={u} className={TON[u]}>
                  {ACTION_URGENCY_LABEL[u]}: <strong>{zahlen[u]}</strong>
                </span>
              ))}
          </div>
          <table className="block overflow-x-auto w-full border-collapse text-cp-xs">
            <thead>
              <tr className="border-b border-cp-border text-left text-cp-text-secondary">
                <th className="py-1 pr-2">{t('analysis.action.when', 'Termin')}</th>
                <th className="py-1 pr-2">{t('analysis.action.urgency', 'Stand')}</th>
                <th className="py-1 pr-2">{t('analysis.action.source', 'Quelle')}</th>
                <th className="py-1 pr-2">{t('analysis.action.what', 'Was')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-cp-border-muted align-top">
                  <td className="py-1 pr-2 tabular-nums">
                    {i.when ?? t('analysis.action.noDate', '—')}
                  </td>
                  <td className={`py-1 pr-2 ${TON[i.urgency]}`}>
                    {ACTION_URGENCY_LABEL[i.urgency]}
                  </td>
                  <td className="py-1 pr-2 text-cp-text-muted">{ACTION_SOURCE_LABEL[i.source]}</td>
                  <td className="py-1 pr-2">
                    {i.title}
                    {i.detail && <span className="text-cp-text-muted"> — {i.detail}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-cp-xs text-cp-text-muted">
            {format(t('analysis.action.count', '{n} Zeilen, sortiert nach Dringlichkeit.'), {
              n: items.length,
            })}
          </p>
        </>
      )}
    </div>
  )
}
