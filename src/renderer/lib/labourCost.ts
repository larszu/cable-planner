// ───────────────────────────────────────────────────────────────────────────
// BEDARF 40 — die Rechnung hinter den Stunden.
//
// Die Engstelle dieses Bedarfs: es gibt GENAU EINE Stelle, die aus Schichten
// Geld macht, und sie rechnet minutenweise. Jede zweite Ableitung (Blatt,
// Rechnungs-Uebergabe, Befunde) ruft sie auf, statt selbst zu multiplizieren.
// Der Beleg zeigt, was passiert, wenn das nicht so ist: „10 h zu 50 und 2 h
// zu 55" wurde zu „12 x 50", weil zwei Stellen dieselbe Zahl verschieden
// bildeten (`kimai/kimai#5913`).
//
// WARUM MINUTENWEISE UND NICHT IN BLOECKEN. Ein Band beginnt um 17:00, eine
// Schicht um 16:40, die Ueberstunde faellt um 19:00 an. Wer in Bloecken
// rechnet, muss die Schnittpunkte selbst finden — und genau dort liegen die
// Fehler des Belegs. 1440 Schritte je Tag sind billig; eine Schicht ist ein
// Durchlauf ueber hoechstens ein paar hundert Minuten.
// ───────────────────────────────────────────────────────────────────────────
import type {
  Approval,
  BookingState,
  ApprovalScope,
  CrewExpense,
  CrewPerson,
  CrewPlan,
  CrewRate,
  DayKind,
  RateBand,
  TimeEntry,
} from '../types/labour'
import { BILLABLE_BOOKINGS } from '../types/labour'

/** Wochentag -> Tagesart. Feiertage schlagen den Wochentag. */
export const dayKindOf = (isoDate: string, holidays: ReadonlySet<string>): DayKind => {
  if (holidays.has(isoDate)) return 'holiday'
  // `T12:00` statt Mitternacht: sonst kippt die Zeitzone das Datum um einen Tag.
  const tag = new Date(`${isoDate}T12:00:00`).getDay()
  if (tag === 0) return 'sunday'
  if (tag === 6) return 'saturday'
  return 'weekday'
}

/** Datum plus n Tage, als ISO-Datum. */
export const addDays = (isoDate: string, n: number): string => {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Gilt das Band an dieser Tagesart? Leere Liste = an jeder. */
const bandGiltAmTag = (band: RateBand, tag: DayKind): boolean =>
  band.days.length === 0 || band.days.includes(tag)

/** Faellt die Minute (0..1439) in das Band? Baender duerfen ueber Mitternacht laufen. */
const bandGiltZurZeit = (band: RateBand, minuteImTag: number): boolean =>
  band.toMinute > band.fromMinute
    ? minuteImTag >= band.fromMinute && minuteImTag < band.toMinute
    : minuteImTag >= band.fromMinute || minuteImTag < band.toMinute

/**
 * Das teuerste Band auf dieser Minute, oder `undefined`.
 *
 * Siehe `BAND_RULE`: Baender stapeln nicht. Bei Gleichstand gewinnt das
 * zuerst eingetragene — die Reihenfolge ist die des Nutzers, und eine
 * alphabetische Sortierung hier waere eine zweite, unsichtbare Regel.
 */
export const bandFuerMinute = (
  baender: readonly RateBand[],
  tag: DayKind,
  minuteImTag: number,
): RateBand | undefined => {
  let treffer: RateBand | undefined
  for (const b of baender) {
    if (!bandGiltAmTag(b, tag) || !bandGiltZurZeit(b, minuteImTag)) continue
    if (!treffer || b.surchargePercent > treffer.surchargePercent) treffer = b
  }
  return treffer
}

/** Ein Abschnitt gleicher Behandlung innerhalb einer Schicht. */
export interface LabourSegment {
  /** Minuten in diesem Abschnitt. */
  minutes: number
  /** Das Band, das hier galt — leer, wenn keines griff. */
  bandLabel?: string
  bandPercent: number
  /** Gilt hier der Ueberstundenzuschlag? */
  overtime: boolean
  overtimePercent: number
  /** Betrag dieses Abschnitts. */
  amount: number
}

export interface EntryCost {
  entryId: string
  personId: string
  rateId: string
  activity: string
  date: string
  minutes: number
  /** Davon jenseits der Tagesschwelle. */
  overtimeMinutes: number
  segments: LabourSegment[]
  /** Stundenanteil ohne Pauschale. */
  amount: number
  /** Die Pauschale, wenn sie auf DIESEN Eintrag faellt (erster des Tages). */
  callout: number
}

const rundeCent = (n: number): number => Math.round(n * 100) / 100

/**
 * Eine Schicht in Abschnitte zerlegen und bewerten.
 *
 * `bereitsGeleistet` sind die Minuten, die diese Person an DIESEM Tag vor
 * diesem Eintrag schon gearbeitet hat — nur so kann die Tagesschwelle ueber
 * mehrere Eintraege hinweg greifen. Ohne dieses Argument koennte man die
 * Ueberstunde umgehen, indem man den Tag in zwei Eintraege schneidet, und
 * genau das tun Leute, wenn eine Software es belohnt.
 */
export const entryCost = (
  entry: TimeEntry,
  rate: CrewRate,
  baender: readonly RateBand[],
  holidays: ReadonlySet<string>,
  bereitsGeleistet: number,
  istErsterDesTages: boolean,
): EntryCost => {
  const eigene = baender.filter((b) => rate.bandIds.includes(b.id))
  const schwelle =
    rate.overtimeAfterHours !== undefined ? Math.round(rate.overtimeAfterHours * 60) : undefined
  const otProzent = rate.overtimePercent ?? 0
  const minutensatz = rate.hourlyAmount / 60

  // Gleiche Behandlung zusammenfassen: der Schluessel ist Band + Ueberstunde.
  const nachSchluessel = new Map<string, LabourSegment>()
  let overtimeMinutes = 0
  const laenge = Math.max(0, entry.endMinute - entry.startMinute)

  for (let i = 0; i < laenge; i += 1) {
    const absolut = entry.startMinute + i
    // Eine Schicht ueber Mitternacht steht ab Minute 1440 im FOLGETAG — der
    // Sonntagszuschlag beginnt um 00:00 und nicht am Schichtende.
    const tagesversatz = Math.floor(absolut / 1440)
    const tagesart = dayKindOf(addDays(entry.date, tagesversatz), holidays)
    const band = bandFuerMinute(eigene, tagesart, absolut % 1440)

    // DIE TAGESSCHWELLE HAENGT AM SCHICHTBEGINN, nicht am Kalendertag der
    // einzelnen Minute: eine Nachtschicht 20:00-06:00 gehoert zu dem Tag, an
    // dem sie begann. Sonst erreichte sie nie eine Schwelle, und der Bedarf
    // waere fuer genau die Schichten wirkungslos, die ihn ausgeloest haben.
    const ueberstunde = schwelle !== undefined && bereitsGeleistet + i >= schwelle
    if (ueberstunde) overtimeMinutes += 1

    const bandPercent = band?.surchargePercent ?? 0
    const schluessel = `${band?.id ?? ''}|${ueberstunde ? 'ot' : ''}`
    const vorhanden = nachSchluessel.get(schluessel)
    const betrag = minutensatz * (1 + bandPercent / 100 + (ueberstunde ? otProzent / 100 : 0))
    if (vorhanden) {
      vorhanden.minutes += 1
      vorhanden.amount += betrag
    } else {
      nachSchluessel.set(schluessel, {
        minutes: 1,
        ...(band ? { bandLabel: band.label } : {}),
        bandPercent,
        overtime: ueberstunde,
        overtimePercent: ueberstunde ? otProzent : 0,
        amount: betrag,
      })
    }
  }

  const segments = [...nachSchluessel.values()].map((s) => ({ ...s, amount: rundeCent(s.amount) }))
  const amount = rundeCent(segments.reduce((sum, s) => sum + s.amount, 0))
  return {
    entryId: entry.id,
    personId: entry.personId,
    rateId: rate.id,
    activity: rate.activity,
    date: entry.date,
    minutes: laenge,
    overtimeMinutes,
    segments,
    amount,
    callout: istErsterDesTages ? (rate.calloutAmount ?? 0) : 0,
  }
}

/**
 * Alle Eintraege des Plans bewerten.
 *
 * Eintraege ohne aufloesbaren Satz werden UEBERSPRUNGEN und nicht mit null
 * bewertet — `labourFindings` meldet sie namentlich. Eine Null in der Summe
 * liest sich als „hat nichts gekostet"; das ist der Unterschied zwischen
 * einer Luecke und einem Betrag.
 */
/**
 * Zaehlt diese Schicht in eine Summe?
 *
 * Ein fehlender Buchungsstand heisst `worked` — siehe `TimeEntry.booking`.
 * Diese eine Stelle entscheidet es fuer alle: Blatt, Uebergabe und Befunde
 * fragen hier, statt den Vergleich je dreimal zu schreiben.
 */
export const zaehltInSumme = (booking: BookingState | undefined): boolean =>
  BILLABLE_BOOKINGS.includes(booking ?? 'worked')

export const labourCosts = (plan: CrewPlan): EntryCost[] => {
  const holidays = new Set(plan.holidays ?? [])
  const rateById = new Map(plan.rates.map((r) => [r.id, r]))
  // Je Person und Tag chronologisch: die Schwelle und die Pauschale haengen
  // an der Reihenfolge, nicht an der Eingabereihenfolge.
  const sortiert = [...plan.entries].sort(
    (a, b) =>
      a.personId.localeCompare(b.personId) ||
      a.date.localeCompare(b.date) ||
      a.startMinute - b.startMinute,
  )
  const geleistet = new Map<string, number>()
  const pauschaleGesetzt = new Set<string>()
  const out: EntryCost[] = []
  for (const e of sortiert) {
    const rate = rateById.get(e.rateId)
    if (!rate) continue
    // Vormerkung und Reservierung sind Planung, keine Rechnung (Bedarf 39).
    // Sie fallen hier heraus und stehen dafuer eigens auf dem Blatt.
    if (!zaehltInSumme(e.booking)) continue
    const tagesschluessel = `${e.personId}|${e.date}`
    const bisher = geleistet.get(tagesschluessel) ?? 0
    const erster = !pauschaleGesetzt.has(tagesschluessel)
    pauschaleGesetzt.add(tagesschluessel)
    out.push(entryCost(e, rate, plan.bands, holidays, bisher, erster))
    geleistet.set(tagesschluessel, bisher + Math.max(0, e.endMinute - e.startMinute))
  }
  return out
}

export interface LabourPersonTotal {
  personId: string
  personName: string
  activity: string
  minutes: number
  overtimeMinutes: number
  /** Stundenanteil. */
  amount: number
  /** Pauschalen. */
  callout: number
  total: number
}

/** Summen je Person UND Taetigkeit — zwei Saetze derselben Person bleiben getrennt. */
export const labourTotals = (plan: CrewPlan): LabourPersonTotal[] => {
  const nameById = new Map(plan.people.map((p) => [p.id, p.name]))
  const acc = new Map<string, LabourPersonTotal>()
  for (const c of labourCosts(plan)) {
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
        personId: c.personId,
        personName: nameById.get(c.personId) ?? c.personId,
        activity: c.activity,
        minutes: c.minutes,
        overtimeMinutes: c.overtimeMinutes,
        amount: c.amount,
        callout: c.callout,
        total: rundeCent(c.amount + c.callout),
      })
    }
  }
  return [...acc.values()].sort(
    (a, b) => a.personName.localeCompare(b.personName, 'de') || a.activity.localeCompare(b.activity, 'de'),
  )
}

export type LabourFindingKind =
  | 'rate-missing'
  | 'person-missing'
  | 'band-missing'
  | 'overlap'
  | 'zero-length'
  | 'overtime-unapproved'
  | 'expense-without-receipt'

export const LABOUR_FINDING_LABEL: Readonly<Record<LabourFindingKind, string>> = {
  'rate-missing': 'Satz fehlt',
  'person-missing': 'Person fehlt',
  'band-missing': 'Band fehlt',
  overlap: 'Zeiten überlappen',
  'zero-length': 'Schicht ohne Dauer',
  'overtime-unapproved': 'Mehrarbeit ohne Zusage',
  'expense-without-receipt': 'Auslage ohne Beleg',
}

export interface LabourFinding {
  kind: LabourFindingKind
  /** Der Eintrag, die Auslage oder der Satz, um den es geht. */
  refId: string
  text: string
}

/**
 * Was an dieser Crew-Seite nicht aufgeht.
 *
 * `overtime-unapproved` ist der Punkt, an dem Bedarf 40 und Bedarf 42
 * zusammenlaufen: der Beleg nennt die Freigabe von Mehrarbeit ausdruecklich
 * als „the disputed invoice line". Die Zusage steht seit Bedarf 42 im Plan —
 * hier wird sie das erste Mal GEBRAUCHT. Gemeldet wird nur, wo wirklich
 * Ueberstunden entstanden sind: eine Warnung an Tagen ohne Mehrarbeit waere
 * die Sorte Hinweis, die man wegklickt.
 */
export const labourFindings = (plan: CrewPlan): LabourFinding[] => {
  const out: LabourFinding[] = []
  const rateById = new Map(plan.rates.map((r) => [r.id, r]))
  const personById = new Map(plan.people.map((p) => [p.id, p]))
  const bandIds = new Set(plan.bands.map((b) => b.id))

  for (const r of plan.rates) {
    if (!personById.has(r.personId)) {
      out.push({
        kind: 'person-missing',
        refId: r.id,
        text: `Der Satz „${r.activity}" zeigt auf eine Person, die es im Plan nicht gibt.`,
      })
    }
    for (const b of r.bandIds) {
      if (!bandIds.has(b)) {
        out.push({
          kind: 'band-missing',
          refId: r.id,
          text: `Der Satz „${r.activity}" nennt ein Band, das es nicht gibt (${b}).`,
        })
      }
    }
  }

  for (const e of plan.entries) {
    if (!rateById.has(e.rateId)) {
      out.push({
        kind: 'rate-missing',
        refId: e.id,
        text: `Die Schicht am ${e.date} hat keinen auflösbaren Satz — sie geht in keine Summe ein.`,
      })
    }
    if (e.endMinute <= e.startMinute) {
      out.push({
        kind: 'zero-length',
        refId: e.id,
        text: `Die Schicht am ${e.date} endet nicht nach ihrem Beginn.`,
      })
    }
  }

  // Ueberlappungen je Person: zwei Schichten zur selben Zeit werden doppelt
  // bezahlt, und das faellt in der Summe niemandem auf.
  const jePerson = new Map<string, TimeEntry[]>()
  for (const e of plan.entries) jePerson.set(e.personId, [...(jePerson.get(e.personId) ?? []), e])
  for (const [personId, liste] of jePerson) {
    const mitAbsolut = liste
      .map((e) => ({
        e,
        von: Date.parse(`${e.date}T00:00:00Z`) / 60000 + e.startMinute,
        bis: Date.parse(`${e.date}T00:00:00Z`) / 60000 + e.endMinute,
      }))
      .sort((a, b) => a.von - b.von)
    for (let i = 1; i < mitAbsolut.length; i += 1) {
      if (mitAbsolut[i].von < mitAbsolut[i - 1].bis) {
        out.push({
          kind: 'overlap',
          refId: mitAbsolut[i].e.id,
          text: `${personById.get(personId)?.name ?? personId} hat am ${mitAbsolut[i].e.date} zwei Schichten, die sich überschneiden.`,
        })
      }
    }
  }

  const zusageFuer = new Set(
    plan.approvals
      .filter((a) => a.covers.kind === 'overtime')
      .map((a) =>
        a.covers.kind === 'overtime' ? `${a.covers.personId}|${a.covers.date}` : '',
      ),
  )
  const mehrarbeit = new Map<string, number>()
  for (const c of labourCosts(plan)) {
    if (c.overtimeMinutes <= 0) continue
    const key = `${c.personId}|${c.date}`
    mehrarbeit.set(key, (mehrarbeit.get(key) ?? 0) + c.overtimeMinutes)
  }
  for (const [key, minuten] of mehrarbeit) {
    if (zusageFuer.has(key)) continue
    const [personId, datum] = key.split('|')
    out.push({
      kind: 'overtime-unapproved',
      refId: key,
      text: `${personById.get(personId)?.name ?? personId} hat am ${datum} ${(minuten / 60).toFixed(1)} h Mehrarbeit — dazu liegt keine Zusage im Plan.`,
    })
  }

  for (const a of plan.expenses) {
    if (a.billable && !a.receiptRef) {
      out.push({
        kind: 'expense-without-receipt',
        refId: a.id,
        text: `Die weiterberechenbare Auslage vom ${a.date} über ${a.amount.toFixed(2)} nennt keinen Beleg.`,
      })
    }
  }
  return out
}

/** Auslagen im Zeitraum, getrennt nach weiterberechenbar. */
export const expenseTotals = (
  expenses: readonly CrewExpense[],
): { billable: number; own: number } => ({
  billable: rundeCent(expenses.filter((e) => e.billable).reduce((s, e) => s + e.amount, 0)),
  own: rundeCent(expenses.filter((e) => !e.billable).reduce((s, e) => s + e.amount, 0)),
})

/** Minuten als „7:30 h" — Dezimalstunden lesen sich auf einem Blatt falsch. */
export const formatHours = (minutes: number): string =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`

/**
 * Den gespeicherten Crew-Plan beim Laden geradeziehen.
 *
 * VERWORFEN WIRD NUR, WAS UNLESBAR IST. Eine Schicht ohne Id, ohne Person
 * oder ohne Datum ist keine Schicht; ein Satz ohne Stundenbetrag ist kein
 * Satz. Alles andere BLEIBT und wird zum Befund: eine Schicht, deren Satz
 * geloescht wurde, verschwindet nicht still aus der Abrechnung, sie meldet
 * sich als `rate-missing`. Das ist derselbe Grundsatz wie beim Kostenplan —
 * eine stillschweigend entfernte Zeile ist eine Stunde, die niemand mehr
 * abrechnet.
 */
export const normaliseCrewPlan = (
  raw: unknown,
  onDrop?: (d: { reason: 'missing-required' | 'duplicate-id'; label: string }) => void,
): CrewPlan | undefined => {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined
  const iso = (v: unknown): string | undefined =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined

  const gesammelt = <T>(
    liste: unknown,
    lies: (r: Record<string, unknown>) => T | undefined,
    idVon: (t: T) => string,
    name: (r: Record<string, unknown>) => string,
  ): T[] => {
    const seen = new Set<string>()
    const out: T[] = []
    for (const rohEintrag of Array.isArray(liste) ? liste : []) {
      const r = (rohEintrag ?? {}) as Record<string, unknown>
      const t = lies(r)
      if (!t) {
        onDrop?.({ reason: 'missing-required', label: name(r) })
        continue
      }
      if (seen.has(idVon(t))) {
        onDrop?.({ reason: 'duplicate-id', label: name(r) })
        continue
      }
      seen.add(idVon(t))
      out.push(t)
    }
    return out
  }

  const people = gesammelt<CrewPerson>(
    o.people,
    (r) => {
      const id = str(r.id)
      const name = str(r.name)
      if (!id || !name) return undefined
      const company = str(r.company)
      const note = str(r.note)
      return { id, name, ...(company ? { company } : {}), ...(note ? { note } : {}) }
    },
    (p) => p.id,
    (r) => str(r.name) ?? str(r.id) ?? '',
  )

  const minute = (v: unknown, fallback: number): number => {
    const n = num(v)
    return n !== undefined && n >= 0 ? Math.round(n) : fallback
  }
  const bands = gesammelt<RateBand>(
    o.bands,
    (r) => {
      const id = str(r.id)
      const label = str(r.label)
      const surcharge = num(r.surchargePercent)
      if (!id || !label || surcharge === undefined) return undefined
      const days = (Array.isArray(r.days) ? r.days : []).filter(
        (d): d is DayKind =>
          d === 'weekday' || d === 'saturday' || d === 'sunday' || d === 'holiday',
      )
      return {
        id,
        label,
        days,
        fromMinute: minute(r.fromMinute, 0),
        toMinute: minute(r.toMinute, 1440),
        surchargePercent: surcharge,
      }
    },
    (b) => b.id,
    (r) => str(r.label) ?? str(r.id) ?? '',
  )

  const rates = gesammelt<CrewRate>(
    o.rates,
    (r) => {
      const id = str(r.id)
      const personId = str(r.personId)
      const activity = str(r.activity)
      const hourlyAmount = num(r.hourlyAmount)
      if (!id || !personId || !activity || hourlyAmount === undefined) return undefined
      const callout = num(r.calloutAmount)
      const otAfter = num(r.overtimeAfterHours)
      const otPercent = num(r.overtimePercent)
      const bandIds = (Array.isArray(r.bandIds) ? r.bandIds : []).filter(
        (b): b is string => typeof b === 'string',
      )
      return {
        id,
        personId,
        activity,
        hourlyAmount,
        ...(callout !== undefined ? { calloutAmount: callout } : {}),
        ...(otAfter !== undefined ? { overtimeAfterHours: otAfter } : {}),
        ...(otPercent !== undefined ? { overtimePercent: otPercent } : {}),
        bandIds,
      }
    },
    (r) => r.id,
    (r) => str(r.activity) ?? str(r.id) ?? '',
  )

  const entries = gesammelt<TimeEntry>(
    o.entries,
    (r) => {
      const id = str(r.id)
      const personId = str(r.personId)
      const rateId = str(r.rateId)
      const date = iso(r.date)
      const start = num(r.startMinute)
      const end = num(r.endMinute)
      if (!id || !personId || !rateId || !date || start === undefined || end === undefined) {
        return undefined
      }
      const note = str(r.note)
      const booking =
        r.booking === 'pencil' || r.booking === 'hold' || r.booking === 'confirmed' || r.booking === 'worked'
          ? (r.booking as BookingState)
          : undefined
      return {
        id,
        personId,
        rateId,
        date,
        startMinute: Math.round(start),
        endMinute: Math.round(end),
        ...(booking ? { booking } : {}),
        ...(note ? { note } : {}),
      }
    },
    (e) => e.id,
    (r) => iso(r.date) ?? str(r.id) ?? '',
  )

  const expenses = gesammelt<CrewExpense>(
    o.expenses,
    (r) => {
      const id = str(r.id)
      const date = iso(r.date)
      const amount = num(r.amount)
      if (!id || !date || amount === undefined) return undefined
      const kind = ((): CrewExpense['kind'] =>
        r.kind === 'travel' ||
        r.kind === 'accommodation' ||
        r.kind === 'per-diem' ||
        r.kind === 'material'
          ? r.kind
          : 'other')()
      const personId = str(r.personId)
      const receiptRef = str(r.receiptRef)
      const note = str(r.note)
      return {
        id,
        ...(personId ? { personId } : {}),
        kind,
        date,
        amount,
        ...(receiptRef ? { receiptRef } : {}),
        // `billable` ist Pflicht im Modell; fehlt es in der Datei, gilt NICHT
        // weiterberechenbar. Die andere Richtung braechte fremde Betraege auf
        // eine Rechnung, weil ein Feld fehlte.
        billable: r.billable === true,
        ...(note ? { note } : {}),
      }
    },
    (e) => e.id,
    (r) => iso(r.date) ?? str(r.id) ?? '',
  )

  const approvals = gesammelt<Approval>(
    o.approvals,
    (r) => {
      const id = str(r.id)
      const capturedAt = str(r.capturedAt)
      const by = str(r.by)
      const text = typeof r.text === 'string' ? r.text : undefined
      if (!id || !capturedAt || !by || text === undefined) return undefined
      const c = (r.covers ?? {}) as Record<string, unknown>
      const covers = ((): ApprovalScope => {
        const costLineId = str(c.costLineId)
        if (c.kind === 'cost-line' && costLineId) return { kind: 'cost-line', costLineId }
        const personId = str(c.personId)
        const date = iso(c.date)
        if (c.kind === 'overtime' && personId && date) return { kind: 'overtime', personId, date }
        const expenseId = str(c.expenseId)
        if (c.kind === 'expense' && expenseId) return { kind: 'expense', expenseId }
        return { kind: 'free' }
      })()
      const givenAt = str(r.givenAt)
      const capturedBy = str(r.capturedBy)
      const channel = ((): Approval['channel'] =>
        r.channel === 'chat' ||
        r.channel === 'email' ||
        r.channel === 'phone' ||
        r.channel === 'in-person'
          ? r.channel
          : 'unstated')()
      return {
        id,
        ...(givenAt ? { givenAt } : {}),
        capturedAt,
        channel,
        by,
        ...(capturedBy ? { capturedBy } : {}),
        text,
        covers,
      }
    },
    (a) => a.id,
    (r) => str(r.by) ?? str(r.id) ?? '',
  )

  const holidays = (Array.isArray(o.holidays) ? o.holidays : []).filter(
    (d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
  )

  return {
    people,
    bands,
    rates,
    entries,
    expenses,
    approvals,
    ...(holidays.length ? { holidays } : {}),
  }
}
