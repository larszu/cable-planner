// ───────────────────────────────────────────────────────────────────────────
// BEDARFE 40, 41, 42, 83 (alle P2) — die Crew-Seite eines Jobs.
//
// Vier Bedarfe, ein Modell, weil sie dieselbe Zahl betreffen: was die Arbeit
// an diesem Job gekostet hat, und woher diese Zahl kommt.
//
//   40  „A labour rate model that matches AV reality: overtime, night and
//        weekend bands, a flat call-out on top of hourly, and several rates
//        for one person"
//   41  „Hours to reach the invoice and the accounting tool without being
//        typed three times"
//   42  „A ten-second way to turn a WhatsApp 'yes, do it, invoice us' into a
//        dated record on the job"
//   83  „Travel, accommodation and receipts chained to job cost instead of
//        entered three times"
//
// ─── WARUM STUNDE MAL SATZ NICHT REICHT ────────────────────────────────────
//
// Der Beleg zu 40 sind sechs Meldungen aus einem einzigen Tracker, von sechs
// Meldern, zwischen 2018 und 2026 — die Rechnung „10 h zu 50 und 2 h zu 55"
// kam dort als „12 x 50" heraus (`kimai/kimai#5913`, 2026-04-20). Daneben:
// Zuschlaege nach Tageszeit (`#3403`, offen seit 2022: 09-17 = 100 %, 17-20
// = +10 %, spaeter = +25 %) und eine Pauschale ZUSAETZLICH zum Stundensatz
// (`#5223`). Wer Stunden mal einer Zahl rechnet, ist auf dem ersten AV-Job
// falsch — nicht knapp daneben, sondern in der Groessenordnung.
//
// ─── WAS HIER NICHT GEBAUT WIRD ────────────────────────────────────────────
//
// Keine Lohnbuchhaltung, keine Steuer, keine Sozialabgaben, kein Zahlungs-
// zustand. Dieselbe Grenze wie bei den Kostenzeilen (Bedarf 79): „ERPs
// store, spreadsheets compare." Hier entsteht die BELEGBARE MENGE — Stunden
// mit ihrer Herleitung und Auslagen mit ihrem Beleg —, und ein Blatt, das
// genau diese Menge in die Buchhaltung traegt. Was daraus eine Rechnung
// macht, macht die Buchhaltung.
//
// ─── EIN FELD, DAS ES BEWUSST NICHT GIBT: `breakMinutes` ────────────────────
//
// Eine Pause als blosse Minutenzahl zwingt die Rechnung zu einer Entscheidung,
// die sie nicht treffen darf: WELCHE Minuten sind unbezahlt? Faellt die Pause
// in den Nachtzuschlag oder in die Regelzeit, unterscheidet sich das Geld —
// und jede Regel dafuer („vom Ende abziehen", „anteilig verteilen") waere eine
// Erfindung dieses Programms. Eine Pause ist deshalb eine LUECKE ZWISCHEN ZWEI
// EINTRAEGEN: 09:00-13:00 und 13:30-18:00. Dann steht jede Minute in ihrem
// echten Band, und niemand muss raten.
// ───────────────────────────────────────────────────────────────────────────

/** Tagesart, auf die ein Zuschlagsband zielt. */
export type DayKind = 'weekday' | 'saturday' | 'sunday' | 'holiday'

export const DAY_KIND_LABEL: Readonly<Record<DayKind, string>> = {
  weekday: 'Werktag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
  holiday: 'Feiertag',
}

/**
 * Ein Zuschlagsband: eine Tageszeit an bestimmten Tagesarten, mit Aufschlag.
 *
 * `fromMinute`/`toMinute` zaehlen ab Mitternacht (0..1440). Ist `toMinute`
 * kleiner oder gleich `fromMinute`, laeuft das Band UEBER MITTERNACHT — der
 * Nachtzuschlag 22:00-06:00 ist der Normalfall dieses Gewerbes und keine
 * Ausnahme, die man mit zwei Baendern nachbauen sollte.
 */
export interface RateBand {
  id: string
  label: string
  /** Leer = gilt an jedem Tag. */
  days: readonly DayKind[]
  fromMinute: number
  toMinute: number
  /** Aufschlag in Prozent auf den Stundensatz (25 = +25 %). */
  surchargePercent: number
}

/**
 * Ein Satz einer Person fuer eine Taetigkeit.
 *
 * MEHRERE SAETZE JE PERSON sind der Kern von Bedarf 40 („several rates for one
 * person"): dieselbe Person faehrt morgens den LKW und steht abends an der
 * Kamera, und das sind zwei Zahlen. Im Beleg legen sich Leute dafuer ein
 * zweites Benutzerkonto an — hier ist es ein zweiter Satz.
 */
export interface CrewRate {
  id: string
  personId: string
  /** Die Taetigkeit im Klartext („Kamera", „Ton", „Fahrer", „Auf-/Abbau"). */
  activity: string
  /** Grundsatz je Stunde, in der Waehrung des Kostenplans. */
  hourlyAmount: number
  /**
   * Pauschale je Einsatz, ZUSAETZLICH zum Stundensatz (`kimai#5223`).
   * Faellt einmal je Person und Kalendertag an — siehe `CALLOUT_RULE`.
   */
  calloutAmount?: number
  /** Ab wie vielen Stunden am TAG Ueberstunden gelten. */
  overtimeAfterHours?: number
  /** Aufschlag auf die Ueberstunden, in Prozent. */
  overtimePercent?: number
  /** Welche Baender fuer diesen Satz gelten. */
  bandIds: readonly string[]
}

export interface CrewPerson {
  id: string
  name: string
  /** Firma oder „freiberuflich"; steht auf dem Blatt, wird nicht geraten. */
  company?: string
  note?: string
}

/**
 * Eine tatsaechlich geleistete Schicht.
 *
 * `endMinute` darf ueber 1440 hinausgehen: eine Schicht bis 02:00 des
 * Folgetags ist 1560. Sie in zwei Eintraege zu schneiden waere dieselbe
 * Erfindung wie die Pausenregel — der Einsatz war einer.
 */
export interface TimeEntry {
  id: string
  personId: string
  rateId: string
  /** ISO-Datum (YYYY-MM-DD) des SCHICHTBEGINNS. */
  date: string
  startMinute: number
  endMinute: number
  /**
   * Der Buchungsstand (Bedarf 39). Fehlt er, gilt die Schicht als
   * `worked` — jede Schicht, die vor diesem Feld eingetragen wurde, ist
   * geleistete Arbeit, und sie ploetzlich als „unbestaetigt" zu behandeln
   * nähme sie aus jeder Abrechnung.
   */
  booking?: BookingState
  note?: string
}

/**
 * Der Buchungsstand einer Schicht (Bedarf 39).
 *
 * DER BELEG BESCHREIBT DEN SCHADEN GENAU: „a pencil at company A is invisible
 * to company B, so the freelancer is the only conflict-detection engine in the
 * system." Und den Ausgang: eine Verlaengerung wurde ohne Konfliktpruefung
 * zugesagt und fiel erst auf, als der zweite Besteller vor der Tuer stand.
 *
 * VIER ZUSTAENDE, UND DIE MASSNAHME NENNT DREI DAVON. Sie sagt aber auch
 * ausdruecklich: „but verify that convention first, it is unverified". Diese
 * Sitzung konnte die Konvention NICHT an einer Primaerquelle pruefen — die
 * Anbieterseiten liegen hinter dem Egress-Filter. Die drei Namen stehen
 * deshalb so da, wie der Bedarf sie nennt, und nicht als bewiesene
 * Branchenkonvention. `worked` ist der vierte und kommt aus dieser Anwendung
 * selbst: eine geleistete Schicht ist kein Buchungsstand mehr.
 */
export type BookingState = 'pencil' | 'hold' | 'confirmed' | 'worked'

export const BOOKING_STATE_LABEL: Readonly<Record<BookingState, string>> = {
  pencil: 'vorgemerkt',
  hold: 'reserviert',
  confirmed: 'bestätigt',
  worked: 'geleistet',
}

/**
 * WELCHE ZUSTAENDE IN DIE ABRECHNUNG GEHEN.
 *
 * Nur `confirmed` und `worked`. Eine Vormerkung ist kein Auftrag; sie in eine
 * Summe zu nehmen hiesse, Geld zu zeigen, das niemand zugesagt hat — und die
 * Zahl faende ihren Weg in ein Angebot. Die uebrigen verschwinden nicht: das
 * Blatt nennt sie eigens (`plannedEntries`).
 */
export const BILLABLE_BOOKINGS: readonly BookingState[] = ['confirmed', 'worked']

export type ExpenseKind = 'travel' | 'accommodation' | 'per-diem' | 'material' | 'other'

export const EXPENSE_KIND_LABEL: Readonly<Record<ExpenseKind, string>> = {
  travel: 'Fahrt',
  accommodation: 'Übernachtung',
  'per-diem': 'Verpflegung',
  material: 'Material',
  other: 'Sonstiges',
}

/**
 * Eine Auslage (Bedarf 83).
 *
 * `billable` ist ein Pflichtfeld und kein Vorgabewert: ob eine Auslage an den
 * Kunden weitergeht, entscheidet der Vertrag und nicht dieses Programm. Ein
 * stillschweigendes „ja" braechte fremde Betraege auf die Rechnung, ein
 * stillschweigendes „nein" liesse eigenes Geld liegen.
 */
export interface CrewExpense {
  id: string
  /** Wer sie ausgelegt hat. Ohne Person: eine Auslage des Jobs. */
  personId?: string
  kind: ExpenseKind
  /** ISO-Datum. */
  date: string
  amount: number
  /** Belegnummer oder Dateiname. Fehlt sie, faellt das auf (Befund). */
  receiptRef?: string
  /**
   * Die Belegdatei selbst (Bedarf 97).
   *
   * SIE HAENGT AN DER ZEILE UND NICHT AM PROJEKT. Die Massnahme sagt es
   * woertlich: „Attach the receipt to the expense line, not the parent."
   * Der Beleg beschreibt den Gegenzustand — „Images attach to the parent
   * record, unlinked to the line" —, und genau der macht die Zahl im
   * Streitfall unbelegbar: der Ordner ist voll, aber niemand weiss, welches
   * Foto zu welcher Zeile gehoert.
   *
   * `receiptRef` bleibt daneben stehen und wird nicht ersetzt: eine
   * Belegnummer aus der Buchhaltung und eine abfotografierte Quittung sind
   * zwei verschiedene Dinge, und ein Job hat oft nur eines von beiden.
   */
  receipt?: import('./receipt').ReceiptAttachment
  /**
   * Auf welche Kostenzeile diese Auslage zeigt (Bedarf 97, zweite Haelfte:
   * „hang the line on the project so it can become a BillingDoc line").
   *
   * Ohne diesen Zeiger ist die Auslage genau das, was der Beleg beklagt:
   * „Trips produce no accounting consequence at all." Der Zeiger RECHNET
   * NICHTS — er stellt nur die Verbindung her, aus der `receiptChain` einen
   * VORSCHLAG fuer den Ist-Wert macht. Geschrieben wird der Ist-Wert nur von
   * einem Menschen; siehe `types/costLines.ts`.
   */
  costLineId?: string
  billable: boolean
  note?: string
}

export type ApprovalChannel = 'chat' | 'email' | 'phone' | 'in-person' | 'unstated'

export const APPROVAL_CHANNEL_LABEL: Readonly<Record<ApprovalChannel, string>> = {
  chat: 'Chat',
  email: 'E-Mail',
  phone: 'Telefon',
  'in-person': 'persönlich',
  unstated: 'Weg nicht angegeben',
}

/** Worauf sich eine Zusage bezieht. */
export type ApprovalScope =
  | { kind: 'cost-line'; costLineId: string }
  | { kind: 'overtime'; personId: string; date: string }
  | { kind: 'expense'; expenseId: string }
  | { kind: 'free' }

/**
 * Eine festgehaltene Zusage (Bedarf 42).
 *
 * DIE BEDARFS-DATENBANK SCHLIESST DEN NAHELIEGENDEN WEG AUS: „Do not attempt
 * interception — build the paste-and-attribute capture." Kein Bot im Chat,
 * keine Anbindung an einen Messenger. Der Nutzer kopiert die Nachricht
 * hinein, das Programm zerlegt sie, soweit sie sich zerlegen laesst, und
 * haengt sie an den Vorgang.
 *
 * ZWEI ZEITEN, UND SIE SIND NICHT DASSELBE. `capturedAt` ist immer bekannt —
 * es ist der Moment des Einfuegens. `givenAt` ist der Moment der Zusage, und
 * den gibt es nur, wenn er im eingefuegten Text steht. Ihn aus `capturedAt`
 * abzuleiten waere die teuerste Luege dieses Modells: die strittige Frage im
 * Beleg ist „ab wann war die Mehrarbeit freigegeben", und eine erfundene
 * Antwort darauf sieht aus wie ein Beweis.
 */
export interface Approval {
  id: string
  givenAt?: string
  capturedAt: string
  channel: ApprovalChannel
  /** Wer zugesagt hat, im Klartext. */
  by: string
  /** Wer sie festgehalten hat. */
  capturedBy?: string
  /** Der Wortlaut. Wird NIE zusammengefasst — er ist der Beleg. */
  text: string
  covers: ApprovalScope
}

/**
 * Die Crew-Seite eines Projekts.
 *
 * Liegt im Projektfile und nicht im Lager-Store: sie gehoert zu DIESEM Job,
 * geht mit ihm per Mail und muss beim Empfaenger aufloesbar sein — dieselbe
 * Begruendung wie bei den Kostenzeilen.
 */
export interface CrewPlan {
  people: CrewPerson[]
  bands: RateBand[]
  rates: CrewRate[]
  entries: TimeEntry[]
  expenses: CrewExpense[]
  approvals: Approval[]
  /**
   * Feiertage als ISO-Daten, vom Nutzer gesetzt.
   *
   * ES GIBT KEINEN EINGEBAUTEN KALENDER, und das ist keine Faulheit: welcher
   * Tag ein Feiertag ist, haengt am Bundesland und am Land, und ein
   * mitgelieferter Kalender waere oefter falsch als richtig — auf einem Job
   * in Zuerich, in Wien oder in Bayern jeweils anders. Ein falscher Feiertag
   * erzeugt einen Zuschlag, den niemand zugesagt hat.
   */
  holidays?: readonly string[]
}

export const EMPTY_CREW_PLAN: CrewPlan = {
  people: [],
  bands: [],
  rates: [],
  entries: [],
  expenses: [],
  approvals: [],
}

/**
 * ZWEI BAENDER AUF DERSELBEN MINUTE STAPELN NICHT — das hoechste gewinnt.
 *
 * Sonntag UND Nacht ergaeben sonst +75 %, ohne dass irgendein Beleg das
 * verlangt; der Korpus nennt Baender einzeln. Das hoechste zu nehmen ist die
 * Regel, die man in der Branche findet, und sie steht hier als benannte
 * Konstante, damit sie im Blatt zitierbar ist statt im Code zu verschwinden.
 */
export const BAND_RULE =
  'Überlappende Bänder stapeln nicht — auf jeder Minute gilt der höchste Zuschlag.'

/**
 * UEBERSTUNDEN UND BAENDER SIND VERSCHIEDENE DINGE UND ADDIEREN SICH.
 *
 * Das Band beschreibt, WANN gearbeitet wurde, die Ueberstunde WIE LANGE. Eine
 * Nachtstunde nach der zehnten ist beides. Sie zu verrechnen hiesse, eine der
 * beiden Zusagen zu unterschlagen.
 */
export const OVERTIME_RULE =
  'Überstundenzuschlag und Bandzuschlag addieren sich — sie messen Verschiedenes.'

/**
 * DIE PAUSCHALE FAELLT EINMAL JE PERSON UND KALENDERTAG AN.
 *
 * Der Beleg nennt sie „flat call-out added to hourly", also je Einsatz. Zwei
 * Eintraege am selben Tag sind ein Einsatz mit einer Pause dazwischen — sie
 * zweimal zu berechnen waere dieselbe Doppelzaehlung, gegen die Bedarf 40
 * geschrieben ist. Zwei Tage sind zwei Einsaetze.
 */
export const CALLOUT_RULE =
  'Die Einsatzpauschale fällt einmal je Person und Kalendertag an, nicht je Eintrag.'
