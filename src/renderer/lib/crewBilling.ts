// ───────────────────────────────────────────────────────────────────────────
// BEDARF 41 — die Stunden gehen EINMAL in die Buchhaltung.
//
// Woertlich aus dem Beleg: unterschriebener Stundenzettel vor Ort, dann in das
// Crew-Werkzeug des Kunden getippt, dann in den eigenen Tracker, dann in die
// Rechnung, dann in die Steuerunterlagen. Der Bedarf nennt die gewuenschte
// Form so genau, dass sie hier nur gebaut werden muss:
//
//   > one timesheet PDF per customer per period, exported for lexoffice,
//   > sevDesk or easybill
//
// Angefragt und als `wontfix` geschlossen (`kimai/kimai#3884`, 2023-02-28);
// die Sammelrechnung ueber mehrere Kunden ist dort bis heute offen
// (`kimai#5512`, 2025-06-01).
//
// ─── WAS DIESES BLATT IST, UND WAS ES NICHT IST ────────────────────────────
//
// Es ist die BELEGBARE MENGE fuer einen Zeitraum: Stunden je Person und
// Taetigkeit, mit ihrer Herleitung, und Auslagen mit ihrem Beleg. Es ist
// KEINE Rechnung: keine Nummer, kein Steuersatz, keine Faelligkeit, kein
// Zahlungszustand. Diese Grenze ist dieselbe wie bei den Kostenzeilen
// (Bedarf 79) und beim Sendebericht (Bedarf 87) — dieses Programm rechnet
// nicht ab, es LIEFERT die Zahlen, mit denen abgerechnet wird.
//
// Die Uebergabe (`crewBillingHandoff`) traegt deshalb Netto-Positionen ohne
// Steuer. Welcher Satz gilt, weiss die Buchhaltung; in der Suite fuellt
// `lexware-core` daraus einen `BillingDoc`.
//
// ─── EIN GRENZFALL, DER GELD KOSTET ────────────────────────────────────────
//
// Eine Nachtschicht am 30. gehoert in den Zeitraum, in dem sie BEGANN — auch
// wenn sie am 1. endet. Dieselbe Regel wie bei der Tagesschwelle in
// `labourCost`, und aus demselben Grund: ein Einsatz ist einer. Wer sie
// anders zieht, teilt eine Schicht auf zwei Rechnungen, und der Kunde
// bekommt zweimal eine Anfahrtspauschale.
// ───────────────────────────────────────────────────────────────────────────
import { toCsv, type CsvCell, type CsvTable } from './csv'
import { expenseTotals, formatHours, labourCosts, labourFindings } from './labourCost'
import { EXPENSE_KIND_LABEL, type CrewExpense, type CrewPlan } from '../types/labour'

export interface BillingPeriod {
  /** ISO-Datum, einschliesslich. */
  from: string
  /** ISO-Datum, einschliesslich. */
  to: string
}

export interface BillingRow {
  personName: string
  company?: string
  activity: string
  minutes: number
  overtimeMinutes: number
  /** Stundenanteil ohne Pauschalen. */
  amount: number
  callout: number
  total: number
}

/** Eine Auslage mit aufgeloestem Namen — das Blatt zeigt Menschen, keine Ids. */
export interface BillingExpenseRow {
  expense: CrewExpense
  /** Wer sie ausgelegt hat. Leer heisst: eine Auslage des Jobs, keine Person. */
  personName?: string
}

export interface CrewBilling {
  period: BillingPeriod
  rows: BillingRow[]
  /** Auslagen im Zeitraum, weiterberechenbare zuerst. */
  expenses: BillingExpenseRow[]
  hoursTotal: number
  labourTotal: number
  expensesBillable: number
  expensesOwn: number
  /**
   * Summe dessen, was an den Kunden geht: Arbeit plus weiterberechenbare
   * Auslagen. Eigene Auslagen stehen auf dem Blatt, aber NICHT hier.
   */
  billableTotal: number
  /**
   * Zeilen, die im Zeitraum liegen, aber nicht bewertet werden konnten.
   * Sie fehlen in jeder Summe — und deshalb steht ihre Zahl oben auf dem
   * Blatt statt in einer Fussnote.
   */
  unpricedEntries: number
}

/** Liegt das ISO-Datum im Zeitraum? Beide Grenzen zaehlen mit. */
const imZeitraum = (datum: string, p: BillingPeriod): boolean => datum >= p.from && datum <= p.to

const rundeCent = (n: number): number => Math.round(n * 100) / 100

/**
 * Der Abrechnungsstand eines Zeitraums.
 *
 * Die Bewertung selbst passiert in `labourCost` — hier wird gefiltert und
 * summiert, nicht gerechnet. Zwei Stellen, die Geld bilden, waeren genau der
 * Defekt aus dem Beleg zu Bedarf 40.
 */
export const crewBilling = (plan: CrewPlan, period: BillingPeriod): CrewBilling => {
  const personById = new Map(plan.people.map((p) => [p.id, p]))
  const kosten = labourCosts(plan).filter((c) => imZeitraum(c.date, period))
  const acc = new Map<string, BillingRow>()
  for (const c of kosten) {
    const person = personById.get(c.personId)
    const key = `${c.personId}|${c.activity}`
    const vorhanden = acc.get(key)
    if (vorhanden) {
      vorhanden.minutes += c.minutes
      vorhanden.overtimeMinutes += c.overtimeMinutes
      vorhanden.amount = rundeCent(vorhanden.amount + c.amount)
      vorhanden.callout = rundeCent(vorhanden.callout + c.callout)
      vorhanden.total = rundeCent(vorhanden.amount + vorhanden.callout)
    } else {
      acc.set(key, {
        personName: person?.name ?? c.personId,
        ...(person?.company ? { company: person.company } : {}),
        activity: c.activity,
        minutes: c.minutes,
        overtimeMinutes: c.overtimeMinutes,
        amount: c.amount,
        callout: c.callout,
        total: rundeCent(c.amount + c.callout),
      })
    }
  }
  const rows = [...acc.values()].sort(
    (a, b) =>
      a.personName.localeCompare(b.personName, 'de') || a.activity.localeCompare(b.activity, 'de'),
  )
  const imRaum = plan.expenses
    .filter((e) => imZeitraum(e.date, period))
    .sort((a, b) => Number(b.billable) - Number(a.billable) || a.date.localeCompare(b.date))
  const expenses: BillingExpenseRow[] = imRaum.map((e) => {
    const name = e.personId ? personById.get(e.personId)?.name : undefined
    return { expense: e, ...(name ? { personName: name } : {}) }
  })
  const { billable, own } = expenseTotals(imRaum)
  const labourTotal = rundeCent(rows.reduce((s, r) => s + r.total, 0))
  const unpriced = labourFindings(plan).filter((f) => f.kind === 'rate-missing').length
  return {
    period,
    rows,
    expenses,
    hoursTotal: rows.reduce((s, r) => s + r.minutes, 0),
    labourTotal,
    expensesBillable: billable,
    expensesOwn: own,
    billableTotal: rundeCent(labourTotal + billable),
    unpricedEntries: unpriced,
  }
}

/**
 * Das Blatt.
 *
 * Eine Tabelle mit BEIDEN Bloecken — Arbeit und Auslagen — und nicht zwei
 * Blaetter: der Bedarf verlangt „hours/expenses artefact", also eine
 * Lieferung. Zwei Dateien waeren wieder zwei Wege in dieselbe Buchhaltung.
 */
export const crewBillingTable = (b: CrewBilling): CsvTable => {
  const rows: CsvCell[][] = b.rows.map((r) => [
    'Arbeit',
    r.personName,
    r.company ?? '',
    r.activity,
    formatHours(r.minutes),
    r.overtimeMinutes > 0 ? formatHours(r.overtimeMinutes) : '',
    r.amount.toFixed(2),
    r.callout > 0 ? r.callout.toFixed(2) : '',
    r.total.toFixed(2),
  ])
  for (const { expense: e, personName } of b.expenses) {
    // Eine nicht weiterberechenbare Auslage steht IN KLAMMERN. Sie gehoert auf
    // das Blatt (die Projektleitung sieht ihre Kosten) und in keine Summe, die
    // an den Kunden geht — die Klammer sagt genau das, ohne eine zweite
    // Tabelle dafuer aufzumachen.
    rows.push([
      'Auslage',
      personName ?? '',
      '',
      EXPENSE_KIND_LABEL[e.kind],
      '',
      '',
      '',
      e.receiptRef ?? '',
      e.billable ? e.amount.toFixed(2) : `(${e.amount.toFixed(2)})`,
    ])
  }
  return {
    headers: [
      'Art',
      'Person',
      'Firma',
      'Tätigkeit',
      'Stunden',
      'davon Mehrarbeit',
      'Arbeitsbetrag',
      'Pauschale / Beleg',
      'Summe',
    ],
    rows,
  }
}

export const crewBillingCsv = (b: CrewBilling): string => {
  const t = crewBillingTable(b)
  return toCsv(t.headers, t.rows)
}

/** Eine Netto-Position fuer die Buchhaltung. */
export interface BillingHandoffLine {
  /** Was auf der Rechnung steht. */
  name: string
  /** Eine Zeile Erlaeuterung, die den Betrag herleitet. */
  description: string
  quantity: number
  /** „Stunde", „Pauschale", „Beleg". */
  unit: string
  /** NETTO. Steuer kennt dieses Programm nicht. */
  unitPriceNet: number
}

/**
 * Die Uebergabe an die Buchhaltung.
 *
 * NUR WEITERBERECHENBARES. Eigene Auslagen stehen auf dem Blatt, damit die
 * Projektleitung ihre Kosten sieht — auf einer Rechnung haetten sie nichts
 * zu suchen, und sie dort „nur zur Information" mitzufuehren ist genau der
 * Fehler, der einem Kunden fremde Betraege zeigt.
 *
 * STUNDEN GEHEN ALS DEZIMALSTUNDEN HINAUS und nicht als „7:30 h": die
 * Buchhaltung rechnet Menge mal Preis. Auf dem BLATT stehen sie als 7:30 h,
 * weil ein Mensch sie dort liest. Zwei Darstellungen derselben Zahl, jede an
 * ihrem Ort.
 */
export const crewBillingHandoff = (b: CrewBilling): BillingHandoffLine[] => {
  const out: BillingHandoffLine[] = []
  for (const r of b.rows) {
    if (r.minutes > 0 && r.amount > 0) {
      const stunden = Math.round((r.minutes / 60) * 100) / 100
      out.push({
        name: `${r.activity} — ${r.personName}`,
        description:
          r.overtimeMinutes > 0
            ? `${formatHours(r.minutes)}, davon ${formatHours(r.overtimeMinutes)} Mehrarbeit`
            : formatHours(r.minutes),
        quantity: stunden,
        unit: 'Stunde',
        unitPriceNet: rundeCent(r.amount / stunden),
      })
    }
    if (r.callout > 0) {
      out.push({
        name: `Einsatzpauschale — ${r.personName}`,
        description: `${r.activity}`,
        quantity: 1,
        unit: 'Pauschale',
        unitPriceNet: r.callout,
      })
    }
  }
  for (const { expense: e } of b.expenses) {
    if (!e.billable) continue
    out.push({
      name: `${EXPENSE_KIND_LABEL[e.kind]}${e.note ? ` — ${e.note}` : ''}`,
      description: e.receiptRef ? `Beleg ${e.receiptRef}` : 'ohne Beleg',
      quantity: 1,
      unit: 'Beleg',
      unitPriceNet: e.amount,
    })
  }
  return out
}
