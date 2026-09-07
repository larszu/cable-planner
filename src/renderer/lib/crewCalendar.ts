// ───────────────────────────────────────────────────────────────────────────
// BEDARF 39 — eine Verfuegbarkeit, die andere ABFRAGEN koennen.
//
// Der Beleg beschreibt den Schaden und den Mechanismus:
//
//   > Phone calendar is the only copy and nobody else can read it. Every
//   > enquiry is answered by hand in WhatsApp; a pencil at company A is
//   > INVISIBLE TO COMPANY B, so the freelancer is the only
//   > conflict-detection engine in the system.
//
// Der Ausgang steht daneben: eine zugesagte Verlaengerung ohne
// Konfliktpruefung, entdeckt, als der zweite Besteller vor der Tuer stand.
//
// ─── WARUM EIN ABONNIERBARER FEED UND KEIN DOWNLOAD ────────────────────────
//
// Die Massnahme sagt es woertlich: „Serve a subscribable webcal:// feed from
// the local project file RATHER THAN an .ics download". Eine
// heruntergeladene Datei ist eine Kopie und veraltet in dem Moment, in dem
// sich der Plan aendert — genau der Zustand, den der Bedarf beklagt. Ein
// Abonnement holt sich den Stand selbst.
//
// Ausgeliefert wird er vom Server, den es schon gibt (`mobileShareServer`,
// derselbe, der die Mobile-Ansicht traegt) und unter derselben
// Token-Pruefung. KEIN Cloud-Dienst, kein Konto: das Repo verspricht
// offline-first, und ein Kalender-Relay waere die erste Ausnahme davon.
//
// ─── DIE ABBILDUNG AUF RFC 5545, UND WO SIE ENDET ──────────────────────────
//
// iCalendar kennt `STATUS:TENTATIVE`, `CONFIRMED` und `CANCELLED`
// (RFC 5545, 3.8.1.11). „Vorgemerkt" und „reserviert" sind beide TENTATIVE —
// die Norm hat keinen dritten Zwischenzustand, und einen zu erfinden hiesse,
// einen Wert auszuliefern, den kein Kalender versteht. Damit der Unterschied
// trotzdem ankommt, steht er im TITEL: „[vorgemerkt] Kamera — Anna Berg".
// Das ist die ehrliche Loesung; die andere waere, zwei verschiedene Dinge
// gleich aussehen zu lassen.
// ───────────────────────────────────────────────────────────────────────────
import {
  BOOKING_STATE_LABEL,
  type BookingState,
  type CrewPlan,
  type TimeEntry,
} from '../types/labour'

/** RFC 5545 kennt genau diese drei. */
type IcalStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

const STATUS_FUER: Readonly<Record<BookingState, IcalStatus>> = {
  pencil: 'TENTATIVE',
  hold: 'TENTATIVE',
  confirmed: 'CONFIRMED',
  worked: 'CONFIRMED',
}

/**
 * Zeilenumbruch nach RFC 5545, 3.1: laenger als 75 Oktett wird gefaltet, die
 * Folgezeile beginnt mit einem Leerzeichen. Ohne das schneiden manche Leser
 * mitten im Text ab — und der abgeschnittene Teil ist der Name der Person.
 */
const falte = (zeile: string): string => {
  if (zeile.length <= 75) return zeile
  const teile: string[] = [zeile.slice(0, 75)]
  let rest = zeile.slice(75)
  while (rest.length > 74) {
    teile.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest) teile.push(` ${rest}`)
  return teile.join('\r\n')
}

/** Escape nach RFC 5545, 3.3.11: Komma, Semikolon, Backslash, Zeilenumbruch. */
const escape = (v: string): string =>
  v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/**
 * Lokaler Zeitstempel ohne Zone (`DTSTART;VALUE=DATE-TIME` in „floating time",
 * RFC 5545, 3.3.5, Form 1).
 *
 * MIT ABSICHT OHNE ZONE. Eine Schicht ist im Plan als Datum plus Minute
 * eingetragen, ohne Zeitzone — sie in UTC umzurechnen setzte voraus, dass der
 * Rechner, der den Plan schrieb, in derselben Zone stand wie der Job. Bei
 * einer Produktion, die in einem anderen Land steht, waere die Kalenderzeile
 * um Stunden verschoben, und niemand saehe warum. „Floating" heisst: die
 * Uhrzeit gilt dort, wo der Leser ist — und das ist beim Aufbau die richtige
 * Antwort.
 */
const stempel = (datum: string, minute: number): string => {
  const tage = Math.floor(minute / 1440)
  const d = new Date(`${datum}T12:00:00`)
  d.setDate(d.getDate() + tage)
  const tag = d.toISOString().slice(0, 10).replace(/-/g, '')
  const m = minute % 1440
  const p = (n: number) => String(n).padStart(2, '0')
  return `${tag}T${p(Math.floor(m / 60))}${p(m % 60)}00`
}

export interface CrewCalendarOptions {
  /** Name des Projekts — er steht im Kalendernamen und in jeder Beschreibung. */
  projectName: string
  /**
   * Zeitpunkt der Erzeugung als ISO-String. WIRD UEBERGEBEN und nicht hier
   * geholt: dieselbe Regel wie beim Dokument-Stempel — eine Funktion, die die
   * Uhr liest, ist nicht pruefbar.
   */
  now: string
  /**
   * Stabiler Teil der Ereignis-Kennung. Ohne ihn brauechte jeder Aufruf eine
   * neue `UID`, und ein Abonnement zeigte bei jedem Abruf dieselbe Schicht
   * noch einmal — der Kalender fuellte sich mit Doppeln.
   */
  projectId: string
}

const zeitstempelUtc = (iso: string): string => {
  const d = new Date(iso)
  return `${d.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/**
 * Der Kalender einer Crew-Planung als iCalendar-Text.
 *
 * EIN EREIGNIS JE SCHICHT, und die `UID` haengt an der Schicht-Id: derselbe
 * Plan ergibt denselben Kalender, eine geaenderte Schicht aktualisiert ihr
 * Ereignis statt ein zweites anzulegen. Genau das ist der Unterschied
 * zwischen einem Abonnement und einem Stapel Downloads.
 */
export const crewCalendar = (plan: CrewPlan, opt: CrewCalendarOptions): string => {
  const nameById = new Map(plan.people.map((p) => [p.id, p.name]))
  const rateById = new Map(plan.rates.map((r) => [r.id, r]))
  const zeilen: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cable Planner//Crew//DE',
    'CALSCALE:GREGORIAN',
    // Ein Abonnement fragt sonst im Minutentakt; eine Stunde ist die uebliche
    // Empfehlung der Leser und fuer eine Produktionsplanung schnell genug.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    falte(`X-WR-CALNAME:${escape(opt.projectName)}`),
  ]
  for (const e of plan.entries) {
    const person = nameById.get(e.personId) ?? e.personId
    const rate = rateById.get(e.rateId)
    const stand: BookingState = e.booking ?? 'worked'
    const titel =
      stand === 'confirmed' || stand === 'worked'
        ? `${rate?.activity ?? ''} — ${person}`.trim()
        : `[${BOOKING_STATE_LABEL[stand]}] ${rate?.activity ?? ''} — ${person}`.trim()
    zeilen.push(
      'BEGIN:VEVENT',
      falte(`UID:${e.id}@${opt.projectId || 'cable-planner'}`),
      `DTSTAMP:${zeitstempelUtc(opt.now)}`,
      `DTSTART:${stempel(e.date, e.startMinute)}`,
      `DTEND:${stempel(e.date, e.endMinute)}`,
      falte(`SUMMARY:${escape(titel)}`),
      `STATUS:${STATUS_FUER[stand]}`,
      // Der Buchungsstand steht ZUSAETZLICH als eigene Eigenschaft: wer den
      // Feed maschinell liest, soll „vorgemerkt" von „reserviert"
      // unterscheiden koennen, ohne den Titel zu zerlegen.
      `X-CP-BOOKING:${stand}`,
      falte(
        `DESCRIPTION:${escape(
          [opt.projectName, e.note ?? '', rate ? `${rate.activity}` : '']
            .filter(Boolean)
            .join(' · '),
        )}`,
      ),
      'END:VEVENT',
    )
  }
  zeilen.push('END:VCALENDAR')
  // RFC 5545, 3.1: Zeilen enden mit CRLF.
  return `${zeilen.join('\r\n')}\r\n`
}

/**
 * Schichten, die sich fuer dieselbe Person ueberschneiden — die Frage, die der
 * Beleg stellt („the freelancer is the only conflict-detection engine").
 *
 * WAS DIESE FUNKTION NICHT KANN, und das steht hier, damit es niemand
 * annimmt: sie sieht nur DIESES Projekt. Ein Konflikt zwischen zwei
 * Bestellern liegt zwischen zwei Dateien, und keine Datei kennt die andere.
 * Genau dafuer ist der Feed da — er macht die eigene Belegung fuer andere
 * lesbar, statt sie hier zu erraten.
 */
export const bookingConflicts = (
  plan: CrewPlan,
): { personId: string; a: TimeEntry; b: TimeEntry }[] => {
  const out: { personId: string; a: TimeEntry; b: TimeEntry }[] = []
  const jePerson = new Map<string, TimeEntry[]>()
  for (const e of plan.entries) jePerson.set(e.personId, [...(jePerson.get(e.personId) ?? []), e])
  for (const [personId, liste] of jePerson) {
    const sortiert = liste
      .map((e) => ({
        e,
        von: Date.parse(`${e.date}T00:00:00Z`) / 60000 + e.startMinute,
        bis: Date.parse(`${e.date}T00:00:00Z`) / 60000 + e.endMinute,
      }))
      .sort((x, y) => x.von - y.von)
    for (let i = 1; i < sortiert.length; i += 1) {
      if (sortiert[i].von < sortiert[i - 1].bis) {
        out.push({ personId, a: sortiert[i - 1].e, b: sortiert[i].e })
      }
    }
  }
  return out
}
