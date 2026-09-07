import { useMemo, useState } from 'react'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { Icon } from '../shared/Icon'
import { PanelHint } from '../shared/PanelHint'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation, format } from '../../lib/i18n'
import { crewBilling, crewBillingCsv, crewBillingHandoff } from '../../lib/crewBilling'
import {
  LABOUR_FINDING_LABEL,
  formatHours,
  labourCosts,
  labourFindings,
} from '../../lib/labourCost'
import { bestApprovalCandidate, parsePastedApproval } from '../../lib/approvalCapture'
import {
  BAND_RULE,
  CALLOUT_RULE,
  EMPTY_CREW_PLAN,
  EXPENSE_KIND_LABEL,
  OVERTIME_RULE,
  type ApprovalScope,
  type CrewExpense,
} from '../../types/labour'

/**
 * BEDARFE 40/41/42/83 — die Crew-Seite eines Jobs, an einem Ort.
 *
 * WARUM IN DEN ANALYSEN UND NICHT IN EINEM EIGENEN DIALOG: hier steht schon
 * „Kosten: Plan gegen Ist" (Bedarf 79), und das ist dieselbe Frage aus der
 * anderen Richtung — was hat der Job gekostet. Ein eigener Menue-Eintrag
 * waere der elfte in einer Liste, aus der gerade Eintraege verschwunden sind
 * (cable#753/#754), und der Nutzer suchte die Stunden dann an zwei Stellen.
 *
 * DIE RECHNUNG STEHT NICHT HIER. Sie steht in `labourCost` und wird gerufen.
 * Zwei Stellen, die Geld bilden, sind genau der Defekt aus dem Beleg zu
 * Bedarf 40 („10 h zu 50 und 2 h zu 55" als „12 x 50").
 */
const minuteToHhmm = (m: number): string =>
  `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

const hhmmToMinute = (v: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 47 || min > 59) return undefined
  return h * 60 + min
}

const heute = (): string => new Date().toISOString().slice(0, 10)

export const CrewTab = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const plan = useProjectStore((s) => s.project.crewPlan) ?? EMPTY_CREW_PLAN
  const addCrewPerson = useProjectStore((s) => s.addCrewPerson)
  const removeCrewPerson = useProjectStore((s) => s.removeCrewPerson)
  const addCrewRate = useProjectStore((s) => s.addCrewRate)
  const updateCrewRate = useProjectStore((s) => s.updateCrewRate)
  const removeCrewRate = useProjectStore((s) => s.removeCrewRate)
  const addRateBand = useProjectStore((s) => s.addRateBand)
  const removeRateBand = useProjectStore((s) => s.removeRateBand)
  const addTimeEntry = useProjectStore((s) => s.addTimeEntry)
  const updateTimeEntry = useProjectStore((s) => s.updateTimeEntry)
  const removeTimeEntry = useProjectStore((s) => s.removeTimeEntry)
  const addCrewExpense = useProjectStore((s) => s.addCrewExpense)
  const removeCrewExpense = useProjectStore((s) => s.removeCrewExpense)
  const addApproval = useProjectStore((s) => s.addApproval)
  const removeApproval = useProjectStore((s) => s.removeApproval)

  // Der Zeitraum: von der ersten bis zur letzten Schicht. Ein voreingestellter
  // Kalendermonat waere eine Annahme ueber den Job — die meisten dauern keinen.
  const grenzen = useMemo(() => {
    const daten = plan.entries.map((e) => e.date).sort()
    return { von: daten[0] ?? heute(), bis: daten[daten.length - 1] ?? heute() }
  }, [plan.entries])
  const [von, setVon] = useState<string | null>(null)
  const [bis, setBis] = useState<string | null>(null)
  const period = { from: von ?? grenzen.von, to: bis ?? grenzen.bis }

  const abrechnung = useMemo(() => crewBilling(plan, period), [plan, period.from, period.to])
  const befunde = useMemo(() => labourFindings(plan), [plan])
  const kosten = useMemo(() => labourCosts(plan), [plan])
  const uebergabe = useMemo(() => crewBillingHandoff(abrechnung), [abrechnung])

  const [paste, setPaste] = useState('')
  const [scope, setScope] = useState<string>('free')

  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  const knopf =
    'inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs'

  const exportCsv = () =>
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, 'stunden-auslagen', 'csv'),
      crewBillingCsv(abrechnung),
      'text/csv',
    )

  const zusageUebernehmen = () => {
    const nachrichten = parsePastedApproval(paste)
    const beste = bestApprovalCandidate(nachrichten)
    if (!beste) return
    const covers: ApprovalScope =
      scope === 'free'
        ? { kind: 'free' }
        : (() => {
            const [personId, datum] = scope.split('|')
            return { kind: 'overtime', personId, date: datum }
          })()
    addApproval({
      // `by` faellt auf einen benannten Platzhalter zurueck und nicht auf
      // einen leeren String: „wer hat zugesagt" ist die Frage, um die es geht.
      by: beste.by ?? t('analysis.crew.unknownBy', 'Absender nicht angegeben'),
      text: beste.text,
      capturedAt: new Date().toISOString(),
      ...(beste.givenAt ? { givenAt: beste.givenAt } : {}),
      channel: beste.givenAt ? 'chat' : 'unstated',
      covers,
    })
    setPaste('')
  }

  const tageMitMehrarbeit = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of kosten) {
      if (c.overtimeMinutes <= 0) continue
      const person = plan.people.find((p) => p.id === c.personId)
      m.set(`${c.personId}|${c.date}`, `${person?.name ?? c.personId} · ${c.date}`)
    }
    return [...m.entries()]
  }, [kosten, plan.people])

  return (
    <div className="flex flex-col gap-3">
      <PanelHint
        className="mb-1 text-cp-xs text-[var(--cp-text-muted)]"
        text={t(
          'analysis.crew.intro',
          `Stunden, Sätze und Auslagen dieses Jobs — und das Blatt, das sie in die Buchhaltung trägt. ${BAND_RULE} ${OVERTIME_RULE} ${CALLOUT_RULE} Eine Pause ist eine Lücke zwischen zwei Einträgen, kein Abzug: nur so steht jede Minute in ihrem echten Band.`,
        )}
      />

      {/* ── Zeitraum und Summen ── */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
          {t('analysis.crew.from', 'von')}
          <input
            type="date"
            value={period.from}
            onChange={(e) => setVon(e.target.value)}
            className={inp}
          />
        </label>
        <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
          {t('analysis.crew.to', 'bis')}
          <input
            type="date"
            value={period.to}
            onChange={(e) => setBis(e.target.value)}
            className={inp}
          />
        </label>
        <button type="button" onClick={exportCsv} className={knopf}>
          <Icon icon={Download} size="xs" /> {t('analysis.crew.csv', 'Blatt als CSV')}
        </button>
      </div>

      <div className="flex flex-wrap gap-3 rounded border border-cp-border bg-cp-surface-2 p-2 text-cp-xs">
        <span>
          {t('analysis.crew.hours', 'Stunden')}: <strong>{formatHours(abrechnung.hoursTotal)}</strong>
        </span>
        <span>
          {t('analysis.crew.labour', 'Arbeit')}: <strong>{abrechnung.labourTotal.toFixed(2)}</strong>
        </span>
        <span>
          {t('analysis.crew.expensesBillable', 'Auslagen weiterberechenbar')}:{' '}
          <strong>{abrechnung.expensesBillable.toFixed(2)}</strong>
        </span>
        <span className="text-cp-text-muted">
          {t('analysis.crew.expensesOwn', 'eigene Auslagen')}:{' '}
          {abrechnung.expensesOwn.toFixed(2)}
        </span>
        <span>
          {t('analysis.crew.billable', 'an den Kunden')}:{' '}
          <strong>{abrechnung.billableTotal.toFixed(2)}</strong>
        </span>
        {abrechnung.unpricedEntries > 0 && (
          <span className="text-amber-300">
            {format(
              t('analysis.crew.unpriced', '{n} Schicht(en) ohne Satz — in keiner Summe enthalten'),
              { n: abrechnung.unpricedEntries },
            )}
          </span>
        )}
      </div>

      {befunde.length > 0 && (
        <ul className="flex flex-col gap-0.5 rounded border border-amber-700/60 bg-amber-900/20 p-2 text-cp-xs text-amber-100">
          {befunde.map((f, i) => (
            <li key={`${f.kind}-${f.refId}-${i}`}>
              <strong>{LABOUR_FINDING_LABEL[f.kind]}</strong> — {f.text}
            </li>
          ))}
        </ul>
      )}

      {/* ── Personen ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.people', 'Personen')}</h3>
        {plan.people.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 text-cp-xs">
            <span className="min-w-[10rem]">{p.name}</span>
            <span className="text-cp-text-muted">{p.company ?? ''}</span>
            <button
              type="button"
              onClick={() => removeCrewPerson(p.id)}
              title={t('analysis.crew.removePerson', 'Person mit ihren Sätzen und Schichten entfernen')}
              aria-label={t('analysis.crew.removePerson', 'Person mit ihren Sätzen und Schichten entfernen')}
              className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </div>
        ))}
        <NeuePerson onAdd={(name, company) => addCrewPerson({ name, ...(company ? { company } : {}) })} />
      </section>

      {/* ── Zuschlagsbänder ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.bands', 'Zuschlagsbänder')}</h3>
        {plan.bands.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5 text-cp-xs">
            <span className="min-w-[8rem]">{b.label}</span>
            <span className="tabular-nums text-cp-text-muted">
              {minuteToHhmm(b.fromMinute)}–{minuteToHhmm(b.toMinute)} · +{b.surchargePercent} %
              {b.days.length ? ` · ${b.days.join(', ')}` : ''}
            </span>
            <button
              type="button"
              onClick={() => removeRateBand(b.id)}
              aria-label={t('analysis.crew.removeBand', 'Band entfernen')}
              title={t('analysis.crew.removeBand', 'Band entfernen')}
              className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </div>
        ))}
        <NeuesBand
          onAdd={(label, fromMinute, toMinute, surchargePercent, days) =>
            addRateBand({ label, fromMinute, toMinute, surchargePercent, days })
          }
        />
      </section>

      {/* ── Sätze ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.rates', 'Sätze')}</h3>
        {plan.rates.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-1.5 text-cp-xs">
            <span className="min-w-[8rem]">{plan.people.find((p) => p.id === r.personId)?.name ?? r.personId}</span>
            <input
              value={r.activity}
              onChange={(e) => updateCrewRate(r.id, { activity: e.target.value })}
              aria-label={t('analysis.crew.activity', 'Tätigkeit')}
              className={`${inp} w-[8rem]`}
            />
            <input
              value={r.hourlyAmount}
              onChange={(e) => updateCrewRate(r.id, { hourlyAmount: Number(e.target.value.replace(',', '.')) || 0 })}
              aria-label={t('analysis.crew.hourly', 'Stundensatz')}
              className={`${inp} w-[5rem] tabular-nums`}
            />
            <input
              value={r.calloutAmount ?? ''}
              onChange={(e) =>
                updateCrewRate(r.id, {
                  calloutAmount: e.target.value.trim() ? Number(e.target.value.replace(',', '.')) : undefined,
                })
              }
              placeholder={t('analysis.crew.calloutPh', 'Pauschale')}
              aria-label={t('analysis.crew.callout', 'Einsatzpauschale')}
              className={`${inp} w-[6rem] tabular-nums`}
            />
            <input
              value={r.overtimeAfterHours ?? ''}
              onChange={(e) =>
                updateCrewRate(r.id, {
                  overtimeAfterHours: e.target.value.trim() ? Number(e.target.value.replace(',', '.')) : undefined,
                })
              }
              placeholder={t('analysis.crew.otAfterPh', 'ab h')}
              aria-label={t('analysis.crew.otAfter', 'Mehrarbeit ab Stunden')}
              className={`${inp} w-[4.5rem] tabular-nums`}
            />
            <input
              value={r.overtimePercent ?? ''}
              onChange={(e) =>
                updateCrewRate(r.id, {
                  overtimePercent: e.target.value.trim() ? Number(e.target.value.replace(',', '.')) : undefined,
                })
              }
              placeholder={t('analysis.crew.otPercentPh', '+ %')}
              aria-label={t('analysis.crew.otPercent', 'Mehrarbeitszuschlag')}
              className={`${inp} w-[4.5rem] tabular-nums`}
            />
            {plan.bands.map((b) => (
              <label key={b.id} className="flex items-center gap-1 text-cp-text-muted">
                <input
                  type="checkbox"
                  checked={r.bandIds.includes(b.id)}
                  onChange={(e) =>
                    updateCrewRate(r.id, {
                      bandIds: e.target.checked
                        ? [...r.bandIds, b.id]
                        : r.bandIds.filter((x) => x !== b.id),
                    })
                  }
                />
                {b.label}
              </label>
            ))}
            <button
              type="button"
              onClick={() => removeCrewRate(r.id)}
              aria-label={t('analysis.crew.removeRate', 'Satz mit seinen Schichten entfernen')}
              title={t('analysis.crew.removeRate', 'Satz mit seinen Schichten entfernen')}
              className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </div>
        ))}
        {plan.people.length > 0 && (
          <NeuerSatz
            people={plan.people}
            onAdd={(personId, activity, hourlyAmount) => addCrewRate({ personId, activity, hourlyAmount })}
          />
        )}
      </section>

      {/* ── Schichten ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.entries', 'Schichten')}</h3>
        {plan.entries.map((e) => {
          const c = kosten.find((x) => x.entryId === e.id)
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-1.5 text-cp-xs">
              <input
                type="date"
                value={e.date}
                onChange={(ev) => updateTimeEntry(e.id, { date: ev.target.value })}
                aria-label={t('analysis.crew.date', 'Datum')}
                className={inp}
              />
              <select
                value={e.rateId}
                onChange={(ev) => {
                  const rate = plan.rates.find((r) => r.id === ev.target.value)
                  updateTimeEntry(e.id, {
                    rateId: ev.target.value,
                    ...(rate ? { personId: rate.personId } : {}),
                  })
                }}
                aria-label={t('analysis.crew.rate', 'Satz')}
                className={inp}
              >
                {plan.rates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {plan.people.find((p) => p.id === r.personId)?.name ?? r.personId} · {r.activity}
                  </option>
                ))}
              </select>
              <input
                value={minuteToHhmm(e.startMinute)}
                onChange={(ev) => {
                  const m = hhmmToMinute(ev.target.value)
                  if (m !== undefined) updateTimeEntry(e.id, { startMinute: m })
                }}
                aria-label={t('analysis.crew.start', 'Beginn')}
                className={`${inp} w-[4.5rem] tabular-nums`}
              />
              {/* Ein Ende KLEINER als der Beginn heisst „am Folgetag" — die
                  Nachtschicht ist der Normalfall und kein Tippfehler. */}
              <input
                value={minuteToHhmm(e.endMinute)}
                onChange={(ev) => {
                  const m = hhmmToMinute(ev.target.value)
                  if (m !== undefined) {
                    updateTimeEntry(e.id, { endMinute: m <= e.startMinute ? m + 1440 : m })
                  }
                }}
                aria-label={t('analysis.crew.end', 'Ende')}
                className={`${inp} w-[4.5rem] tabular-nums`}
              />
              <span className="tabular-nums text-cp-text-muted">
                {formatHours(Math.max(0, e.endMinute - e.startMinute))}
                {e.endMinute > 1440 ? ` (${t('analysis.crew.nextDay', 'Folgetag')})` : ''}
              </span>
              {c && (
                <span className="tabular-nums">
                  {c.amount.toFixed(2)}
                  {c.callout > 0 ? ` + ${c.callout.toFixed(2)}` : ''}
                  {c.overtimeMinutes > 0
                    ? ` · ${formatHours(c.overtimeMinutes)} ${t('analysis.crew.ot', 'Mehrarbeit')}`
                    : ''}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeTimeEntry(e.id)}
                aria-label={t('analysis.crew.removeEntry', 'Schicht entfernen')}
                title={t('analysis.crew.removeEntry', 'Schicht entfernen')}
                className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
              >
                <Icon icon={Trash2} size="xs" />
              </button>
            </div>
          )
        })}
        {plan.rates.length > 0 && (
          <button
            type="button"
            onClick={() => {
              const rate = plan.rates[0]
              addTimeEntry({
                personId: rate.personId,
                rateId: rate.id,
                date: heute(),
                startMinute: 8 * 60,
                endMinute: 16 * 60,
              })
            }}
            className={knopf}
          >
            <Icon icon={Plus} size="xs" /> {t('analysis.crew.addEntry', 'Schicht')}
          </button>
        )}
      </section>

      {/* ── Auslagen ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.expenses', 'Auslagen')}</h3>
        {plan.expenses.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center gap-1.5 text-cp-xs">
            <span className="tabular-nums">{x.date}</span>
            <span className="min-w-[7rem]">{EXPENSE_KIND_LABEL[x.kind]}</span>
            <span className="tabular-nums">{x.amount.toFixed(2)}</span>
            <span className="text-cp-text-muted">
              {x.receiptRef ?? t('analysis.crew.noReceipt', 'ohne Beleg')}
            </span>
            <span className={x.billable ? '' : 'text-cp-text-muted'}>
              {x.billable
                ? t('analysis.crew.billableYes', 'geht an den Kunden')
                : t('analysis.crew.billableNo', 'eigene Kosten')}
            </span>
            <button
              type="button"
              onClick={() => removeCrewExpense(x.id)}
              aria-label={t('analysis.crew.removeExpense', 'Auslage entfernen')}
              title={t('analysis.crew.removeExpense', 'Auslage entfernen')}
              className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </div>
        ))}
        <NeueAuslage
          onAdd={(x) => addCrewExpense(x)}
          people={plan.people}
        />
      </section>

      {/* ── Zusagen (Bedarf 42) ── */}
      <section className="flex flex-col gap-1">
        <h3 className="text-cp-xs font-semibold text-cp-text">{t('analysis.crew.approvals', 'Zusagen')}</h3>
        <PanelHint
          className="mb-1 text-cp-xs text-[var(--cp-text-muted)]"
          text={t(
            'analysis.crew.approvalHint',
            'Nachricht hineinkopieren — Zeitpunkt und Absender werden gelesen, soweit sie im Text stehen. Steht kein Zeitpunkt darin, bekommt die Zusage keinen: ein erfundenes Datum wäre im Streitfall genau die Zeile, an der das Geld hängt.',
          )}
        />
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={3}
          placeholder={t(
            'analysis.crew.pastePh',
            '[09.09.26, 20:14] Max Mustermann: ja, macht die Überstunden',
          )}
          aria-label={t('analysis.crew.paste', 'Nachricht einfügen')}
          className={`${inp} w-full`}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label={t('analysis.crew.scope', 'Wofür gilt die Zusage')}
            className={inp}
          >
            <option value="free">{t('analysis.crew.scopeFree', '— allgemein —')}</option>
            {tageMitMehrarbeit.map(([key, label]) => (
              <option key={key} value={key}>
                {t('analysis.crew.scopeOvertime', 'Mehrarbeit')}: {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={zusageUebernehmen} disabled={!paste.trim()} className={knopf}>
            <Icon icon={Plus} size="xs" /> {t('analysis.crew.addApproval', 'Zusage festhalten')}
          </button>
        </div>
        {plan.approvals.map((a) => (
          <div key={a.id} className="flex flex-wrap items-start gap-1.5 text-cp-xs">
            <span className="min-w-[9rem] tabular-nums text-cp-text-muted">
              {a.givenAt ?? t('analysis.crew.noGivenAt', 'Zeitpunkt nicht angegeben')}
            </span>
            <span className="min-w-[8rem]">{a.by}</span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap">{a.text}</span>
            <span className="text-cp-text-muted">
              {a.covers.kind === 'overtime'
                ? `${t('analysis.crew.scopeOvertime', 'Mehrarbeit')} ${a.covers.date}`
                : t('analysis.crew.scopeFree', '— allgemein —')}
            </span>
            <button
              type="button"
              onClick={() => removeApproval(a.id)}
              aria-label={t('analysis.crew.removeApproval', 'Zusage entfernen')}
              title={t('analysis.crew.removeApproval', 'Zusage entfernen')}
              className="rounded p-0.5 text-cp-text-muted hover:text-cp-danger"
            >
              <Icon icon={Trash2} size="xs" />
            </button>
          </div>
        ))}
      </section>

      {/* ── Übergabe an die Buchhaltung ── */}
      {uebergabe.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-cp-xs font-semibold text-cp-text">
            {t('analysis.crew.handoff', 'Übergabe an die Buchhaltung (netto)')}
          </h3>
          <table className="w-full text-cp-xs">
            <tbody>
              {uebergabe.map((l, i) => (
                <tr key={`${l.name}-${i}`} className="border-b border-cp-border-muted">
                  <td className="py-0.5">{l.name}</td>
                  <td className="py-0.5 text-cp-text-muted">{l.description}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {l.quantity} {l.unit}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{l.unitPriceNet.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Formulare */

const NeuePerson = ({ onAdd }: { onAdd: (name: string, company: string) => void }) => {
  const t = useTranslation()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('analysis.crew.namePh', 'Name')}
        aria-label={t('analysis.crew.name', 'Name')}
        className={`${inp} w-[10rem]`}
      />
      <input
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder={t('analysis.crew.companyPh', 'Firma / freiberuflich')}
        aria-label={t('analysis.crew.company', 'Firma')}
        className={`${inp} w-[10rem]`}
      />
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() => {
          onAdd(name.trim(), company.trim())
          setName('')
          setCompany('')
        }}
        className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
      >
        <Icon icon={Plus} size="xs" /> {t('analysis.crew.addPerson', 'Person')}
      </button>
    </div>
  )
}

const NeuesBand = ({
  onAdd,
}: {
  onAdd: (
    label: string,
    fromMinute: number,
    toMinute: number,
    surchargePercent: number,
    days: ('weekday' | 'saturday' | 'sunday' | 'holiday')[],
  ) => void
}) => {
  const t = useTranslation()
  const [label, setLabel] = useState('')
  const [von, setVon] = useState('20:00')
  const [bis, setBis] = useState('06:00')
  const [prozent, setProzent] = useState('25')
  const [nurSonntag, setNurSonntag] = useState(false)
  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder={t('analysis.crew.bandPh', 'Bandname, z. B. Nacht')}
        aria-label={t('analysis.crew.bandName', 'Bandname')}
        className={`${inp} w-[10rem]`}
      />
      <input
        value={von}
        onChange={(e) => setVon(e.target.value)}
        aria-label={t('analysis.crew.bandFrom', 'Band von')}
        className={`${inp} w-[4.5rem] tabular-nums`}
      />
      <input
        value={bis}
        onChange={(e) => setBis(e.target.value)}
        aria-label={t('analysis.crew.bandTo', 'Band bis')}
        className={`${inp} w-[4.5rem] tabular-nums`}
      />
      <input
        value={prozent}
        onChange={(e) => setProzent(e.target.value)}
        aria-label={t('analysis.crew.bandPercent', 'Zuschlag in Prozent')}
        className={`${inp} w-[4rem] tabular-nums`}
      />
      <label className="flex items-center gap-1 text-cp-xs text-cp-text-muted">
        <input type="checkbox" checked={nurSonntag} onChange={(e) => setNurSonntag(e.target.checked)} />
        {t('analysis.crew.sundayOnly', 'nur sonntags')}
      </label>
      <button
        type="button"
        disabled={!label.trim()}
        onClick={() => {
          const v = hhmmToMinute(von)
          const b = hhmmToMinute(bis)
          if (v === undefined || b === undefined) return
          onAdd(label.trim(), v, b, Number(prozent.replace(',', '.')) || 0, nurSonntag ? ['sunday'] : [])
          setLabel('')
        }}
        className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
      >
        <Icon icon={Plus} size="xs" /> {t('analysis.crew.addBand', 'Band')}
      </button>
    </div>
  )
}

const NeuerSatz = ({
  people,
  onAdd,
}: {
  people: readonly { id: string; name: string }[]
  onAdd: (personId: string, activity: string, hourlyAmount: number) => void
}) => {
  const t = useTranslation()
  const [personId, setPersonId] = useState(people[0]?.id ?? '')
  const [activity, setActivity] = useState('')
  const [betrag, setBetrag] = useState('')
  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        aria-label={t('analysis.crew.person', 'Person')}
        className={inp}
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        value={activity}
        onChange={(e) => setActivity(e.target.value)}
        placeholder={t('analysis.crew.activityPh', 'Tätigkeit')}
        aria-label={t('analysis.crew.activity', 'Tätigkeit')}
        className={`${inp} w-[8rem]`}
      />
      <input
        value={betrag}
        onChange={(e) => setBetrag(e.target.value)}
        placeholder={t('analysis.crew.hourlyPh', 'Stundensatz')}
        aria-label={t('analysis.crew.hourly', 'Stundensatz')}
        className={`${inp} w-[6rem] tabular-nums`}
      />
      <button
        type="button"
        disabled={!activity.trim() || !personId}
        onClick={() => {
          onAdd(personId, activity.trim(), Number(betrag.replace(',', '.')) || 0)
          setActivity('')
          setBetrag('')
        }}
        className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
      >
        <Icon icon={Plus} size="xs" /> {t('analysis.crew.addRate', 'Satz')}
      </button>
    </div>
  )
}

const NeueAuslage = ({
  people,
  onAdd,
}: {
  people: readonly { id: string; name: string }[]
  onAdd: (x: Partial<CrewExpense> & { date: string; amount: number }) => void
}) => {
  const t = useTranslation()
  const [datum, setDatum] = useState(heute())
  const [art, setArt] = useState<CrewExpense['kind']>('travel')
  const [betrag, setBetrag] = useState('')
  const [beleg, setBeleg] = useState('')
  const [personId, setPersonId] = useState('')
  const [billable, setBillable] = useState(false)
  const inp = 'rounded border border-[var(--cp-border)] bg-[var(--cp-surface-3)] p-1 text-cp-xs'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        value={datum}
        onChange={(e) => setDatum(e.target.value)}
        aria-label={t('analysis.crew.expenseDate', 'Datum der Auslage')}
        className={inp}
      />
      <select
        value={art}
        onChange={(e) => setArt(e.target.value as CrewExpense['kind'])}
        aria-label={t('analysis.crew.expenseKind', 'Art der Auslage')}
        className={inp}
      >
        {(Object.keys(EXPENSE_KIND_LABEL) as CrewExpense['kind'][]).map((k) => (
          <option key={k} value={k}>
            {EXPENSE_KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <select
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        aria-label={t('analysis.crew.expensePerson', 'Wer hat ausgelegt')}
        className={inp}
      >
        <option value="">{t('analysis.crew.expenseNoPerson', '— Job —')}</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        value={betrag}
        onChange={(e) => setBetrag(e.target.value)}
        placeholder={t('analysis.crew.amountPh', 'Betrag')}
        aria-label={t('analysis.crew.amount', 'Betrag')}
        className={`${inp} w-[6rem] tabular-nums`}
      />
      <input
        value={beleg}
        onChange={(e) => setBeleg(e.target.value)}
        placeholder={t('analysis.crew.receiptPh', 'Beleg')}
        aria-label={t('analysis.crew.receipt', 'Beleg')}
        className={`${inp} w-[7rem]`}
      />
      {/* KEIN Vorgabewert: ob eine Auslage an den Kunden geht, entscheidet der
          Vertrag. Deshalb steht der Haken auf aus und muss gesetzt werden. */}
      <label className="flex items-center gap-1 text-cp-xs text-cp-text-muted">
        <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} />
        {t('analysis.crew.billableYes', 'geht an den Kunden')}
      </label>
      <button
        type="button"
        disabled={!betrag.trim()}
        onClick={() => {
          onAdd({
            date: datum,
            amount: Number(betrag.replace(',', '.')) || 0,
            kind: art,
            billable,
            ...(beleg.trim() ? { receiptRef: beleg.trim() } : {}),
            ...(personId ? { personId } : {}),
          })
          setBetrag('')
          setBeleg('')
        }}
        className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] px-2 py-1 text-cp-xs"
      >
        <Icon icon={Plus} size="xs" /> {t('analysis.crew.addExpense', 'Auslage')}
      </button>
    </div>
  )
}
