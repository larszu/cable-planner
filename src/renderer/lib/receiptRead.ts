// ───────────────────────────────────────────────────────────────────────────
// BEDARF 97 (P3) — „Snap a receipt and get a filled expense line, linked to
// that line and to the job".
//
// Der Beleg, woertlich aus der Bedarfs-Datenbank:
//
//   > Every receipt hand-typed: date, type, description, amount. Images
//   > attach to the parent record, UNLINKED TO THE LINE. Trips produce no
//   > accounting consequence at all.
//
// und aus der Fundstelle (`frappe/hrms#4541`, offen seit 2026-05-16):
//
//   > tedious, error-prone
//   > significant friction — especially for employees who accumulate many
//   > small receipts (travel, meals, office supplies)
//   > The problem compounds on mobile
//
// Die Massnahme nennt beide Haelften: „ATTACH THE RECEIPT TO THE EXPENSE LINE,
// NOT THE PARENT, and hang the line on the project so it can become a
// BillingDoc line."
//
// Diese Datei ist die erste Haelfte der ersten Haelfte: aus dem, was auf einem
// Beleg maschinenlesbar dasteht, wird ein VORSCHLAG fuer eine Auslagenzeile.
// Das Anhaengen der Datei macht `main/services/receiptStore.ts`, die
// Verkettung mit den Kostenzeilen macht `receiptChain.ts`.
//
// ─── KEINE TEXTERKENNUNG, UND WARUM DAS KEINE LUECKE IST ───────────────────
//
// Hier laeuft KEIN OCR. Das Repo verspricht offline-first, und die einzige
// Texterkennung, die auf einem Kassenzettel etwas taugt, liegt heute bei
// einem Cloud-Dienst — das hiesse, jede Quittung dieses Nutzers zu einem
// Fremden zu schicken. Was stattdessen gelesen wird, ist alles, was OHNE
// Bilderkennung maschinenlesbar am Beleg haengt:
//
//   • eingefuegter oder abgetippter Text (Kassenbon-Mail, PDF-Textebene, die
//     zwei Zeilen, die jemand auf dem Handy tippt),
//   • der Aufnahmezeitpunkt aus den Bilddaten (EXIF) — ein echtes Datum aus
//     der Datei und keine Vermutung,
//   • der Dateiname und, als schwaechster Beleg, das Dateidatum.
//
// Jedes Feld traegt deshalb seine HERKUNFT mit (`ReadSource`). Ein Datum aus
// der EXIF-Zeile und eins aus dem Dateidatum sehen in der Maske gleich aus,
// und der Unterschied entscheidet, ob es der Tag des Einkaufs oder der Tag
// des Abfotografierens ist.
//
// ─── DIE REGEL, DIE DIESE DATEI TRAEGT ─────────────────────────────────────
//
// ES WIRD NICHTS ERFUNDEN. Findet sich kein Betrag, hat der Vorschlag keinen
// Betrag — und der Befund `no-amount` sagt es. Findet sich mehr als ein
// Betrag, der als Endsumme durchgeht, entsteht KEINE Auswahl per Muenzwurf:
// die Kandidaten kommen mit zurueck, der Mensch entscheidet. Der teuerste
// Fehler eines Beleglesers ist nicht, nichts zu finden, sondern den
// Rueckgeld-Betrag als Rechnungssumme einzutragen.
// ───────────────────────────────────────────────────────────────────────────
import { istTagZuerst, zuIsoDatum, type DateSeparator } from './dateStyle'
import type { CrewExpense, ExpenseKind } from '../types/labour'

/** Woher ein vorgeschlagener Wert stammt. Immer mitgefuehrt, nie weggelassen. */
export type ReadSource = 'text' | 'exif' | 'file-name' | 'file-date'

export const READ_SOURCE_LABEL: Readonly<Record<ReadSource, string>> = {
  text: 'aus dem Belegtext',
  exif: 'aus den Bilddaten',
  'file-name': 'aus dem Dateinamen',
  'file-date': 'aus dem Dateidatum',
}

/** Ein gelesener Wert mit seiner Herkunft und der Zeile, aus der er kommt. */
export interface ReadField<T> {
  value: T
  source: ReadSource
  /** Der Wortlaut, auf den sich der Wert stuetzt — nachprüfbar, nicht nur behauptet. */
  evidence: string
}

export type ReceiptFindingKind =
  | 'no-amount'
  | 'several-totals'
  | 'no-date'
  | 'date-from-file'
  | 'several-dates'
  | 'currency-unstated'
  | 'vat-unstated'
  | 'no-merchant'
  | 'nothing-readable'

export const RECEIPT_FINDING_LABEL: Readonly<Record<ReceiptFindingKind, string>> = {
  'no-amount': 'Kein Betrag im Beleg gefunden',
  'several-totals': 'Mehrere Beträge kommen als Endsumme in Frage',
  'no-date': 'Kein Datum im Beleg gefunden',
  'date-from-file': 'Datum stammt aus der Datei, nicht vom Beleg',
  'several-dates': 'Mehrere Daten im Beleg — das erste übernommen',
  'currency-unstated': 'Keine Währung angegeben',
  'vat-unstated': 'Kein Steuersatz angegeben',
  'no-merchant': 'Kein Aussteller erkennbar',
  'nothing-readable': 'Nichts Maschinenlesbares am Beleg',
}

export interface ReceiptFinding {
  kind: ReceiptFindingKind
  detail?: string
}

export interface ReceiptProposal {
  date?: ReadField<string>
  amount?: ReadField<number>
  /**
   * Alle Betraege, die als Endsumme in Frage kamen.
   *
   * Steht auch dann da, wenn `amount` gesetzt ist: wer den Vorschlag prueft,
   * soll sehen, WOGEGEN entschieden wurde. Bei `several-totals` ist das die
   * Liste, aus der der Mensch waehlt — die Arbeit des Lesens ist dann getan,
   * nur die Entscheidung nicht.
   */
  amountCandidates: ReadField<number>[]
  currency?: ReadField<string>
  vatPercent?: ReadField<number>
  merchant?: ReadField<string>
  kind?: ReadField<ExpenseKind>
  findings: ReceiptFinding[]
}

export interface ReceiptInput {
  /** Belegtext: eingefuegt, abgetippt, aus einer Textdatei oder PDF-Textebene. */
  text?: string
  fileName?: string
  /** EXIF `DateTimeOriginal` als ISO-String, falls das Bild einen trug. */
  takenAt?: string
  /** Änderungszeitpunkt der Datei als ISO-String. Der schwaechste Beleg. */
  fileDate?: string
}

// ─── Betraege ──────────────────────────────────────────────────────────────

/**
 * Eine Zahl aus einem Beleg lesen — deutsche und englische Schreibweise.
 *
 * `1.234,56` und `1,234.56` sind derselbe Betrag, `1.234` und `1,234` sind es
 * auch (tausend zweihundertvierunddreissig), und `1.23` ist ein Euro
 * dreiundzwanzig. Die Regel, die alle vier aufloest:
 *
 *   • Kommen BEIDE Trenner vor, ist der RECHTE das Dezimalzeichen.
 *   • Kommt nur einer vor, ist er das Dezimalzeichen, wenn genau zwei Stellen
 *     folgen und er nur einmal auftritt — sonst trennt er Tausender.
 *
 * Gibt `undefined` zurueck, wenn daraus keine Zahl wird. Ein `NaN` oder eine
 * Null waere hier schlimmer als nichts: eine Null sieht aus wie ein Betrag.
 */
export const parseBetrag = (roh: string): number | undefined => {
  const t = roh.replace(/[^\d.,-]/g, '').trim()
  if (!/\d/.test(t)) return undefined
  const negativ = t.startsWith('-')
  const kern = t.replace(/-/g, '')
  const punkte = (kern.match(/\./g) ?? []).length
  const kommas = (kern.match(/,/g) ?? []).length
  let normal: string
  if (punkte > 0 && kommas > 0) {
    const dezimal = kern.lastIndexOf('.') > kern.lastIndexOf(',') ? '.' : ','
    const tausender = dezimal === '.' ? ',' : '.'
    normal = kern.split(tausender).join('').replace(dezimal, '.')
  } else if (punkte + kommas === 0) {
    normal = kern
  } else {
    const zeichen = punkte > 0 ? '.' : ','
    const anzahl = punkte + kommas
    const nachkomma = kern.length - kern.lastIndexOf(zeichen) - 1
    normal =
      anzahl === 1 && (nachkomma === 1 || nachkomma === 2)
        ? kern.replace(zeichen, '.')
        : kern.split(zeichen).join('')
  }
  const n = Number(normal)
  if (!Number.isFinite(n)) return undefined
  return negativ ? -n : n
}

/** Woerter, die eine Zeile als Endsumme ausweisen. */
const SUMMEN_WORT =
  /(gesamt|gesamtbetrag|gesamtsumme|summe|endbetrag|rechnungsbetrag|zu zahlen|zahlbetrag|brutto|total|amount due|grand total)/i

/**
 * Woerter, die eine Zeile als Endsumme AUSSCHLIESSEN.
 *
 * Das ist die wichtigste Liste der Datei. Auf einem Kassenbon steht unter der
 * Summe fast immer, was gegeben und was herausgegeben wurde — und beide Zahlen
 * stehen naeher am Blattende als die Summe. Ein Leser, der „die letzte Zahl"
 * nimmt, traegt das Wechselgeld als Rechnungsbetrag ein. Auch die
 * Zwischensumme faellt hier heraus: sie sieht wie eine Summe aus und ist keine.
 */
const KEINE_SUMME =
  /(rückgeld|rueckgeld|wechselgeld|gegeben|zurück|zurueck|change|cash|bar\b|kartenzahlung|zwischensumme|subtotal|netto|nettobetrag|trinkgeld|tip\b|enthaltene|mwst|ust\.|umsatzsteuer|mehrwertsteuer|steuer)/i

/**
 * Eine Zahl mit Nachkommastellen oder direkt an einer Waehrung.
 *
 * Die Lookarounds sind kein Feinschliff: ohne sie liest die Zeile
 * `03.02.2026 08:14` den Betrag „3,02" heraus, und der stuende dann als
 * zweiter Summenkandidat neben dem echten Betrag. Deshalb wird zusaetzlich
 * `ohneZeitangaben` vorgeschaltet — Datum und Uhrzeit sind keine Betraege.
 */
const BETRAG_IN_ZEILE =
  /(?<![\d.,])(-?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}|-?\d+(?=\s*(?:€|EUR\b)))(?![\d])/gi

/** Datum und Uhrzeit aus einer Zeile nehmen, bevor Betraege gesucht werden. */
const ohneZeitangaben = (z: string): string =>
  z
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}([./])\d{1,2}\1\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')

const WAEHRUNG: ReadonlyArray<[RegExp, string]> = [
  [/€|\bEUR\b/i, 'EUR'],
  [/\bCHF\b|\bSFR\b/i, 'CHF'],
  [/\bUSD\b|\$/, 'USD'],
  [/\bGBP\b|£/, 'GBP'],
]

// ─── Datum ─────────────────────────────────────────────────────────────────

const DATUM_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/
const DATUM_GETRENNT = /\b(\d{1,2})([./])(\d{1,2})\2(\d{2,4})\b/
const DATUM_WORT = /(datum|date|belegdatum|rechnungsdatum|invoice date)/i

const datumAusZeile = (zeile: string): string | undefined => {
  const iso = DATUM_ISO.exec(zeile)
  if (iso) return zuIsoDatum(Number(iso[3]), Number(iso[2]), Number(iso[1]))
  const m = DATUM_GETRENNT.exec(zeile)
  if (!m) return undefined
  const a = Number(m[1])
  const b = Number(m[3])
  const tagZuerst = istTagZuerst(m[2] as DateSeparator, a)
  return zuIsoDatum(tagZuerst ? a : b, tagZuerst ? b : a, Number(m[4]))
}

// ─── Art der Auslage ───────────────────────────────────────────────────────

/**
 * Woerter, an denen die Art einer Auslage haengt.
 *
 * NUR EIN VORSCHLAG. Faellt keins, bleibt die Art offen und die Zeile
 * entsteht als „Sonstiges" — das ist ein gueltiger Wert und keine Luecke. Ein
 * geratenes „Übernachtung" auf einem Tankbeleg kostet nichts als eine
 * Korrektur; ein geratener Betrag kostet Geld.
 */
const ART_WOERTER: ReadonlyArray<[ExpenseKind, RegExp]> = [
  [
    'travel',
    /(taxi|uber|bahn|db\b|deutsche bahn|ticket|fahrkarte|flug|airline|tankstelle|aral|shell|esso|jet\b|diesel|benzin|super e10|parkhaus|parken|parkgebühr|maut|mietwagen|rental|bus\b|zug\b)/i,
  ],
  [
    'accommodation',
    /(hotel|pension|hostel|übernachtung|uebernachtung|gästehaus|gaestehaus|motel|apartment|zimmer)/i,
  ],
  [
    'per-diem',
    /(restaurant|gaststätte|gaststaette|café|cafe|bäckerei|baeckerei|imbiss|kantine|bistro|pizzeria|mittagessen|abendessen|frühstück|fruehstueck|catering)/i,
  ],
  [
    'material',
    /(baumarkt|obi|hornbach|bauhaus|conrad|reichelt|thomann|amazon|elektro|gaffa|klebeband|batterie|akku|kabel)/i,
  ],
]

// ─── Das Lesen ─────────────────────────────────────────────────────────────

const feld = <T>(value: T, source: ReadSource, evidence: string): ReadField<T> => ({
  value,
  source,
  evidence,
})

/**
 * Aus einem Beleg einen Vorschlag machen.
 *
 * Der Rueckgabewert ist NIE eine Auslagenzeile, sondern immer ein Vorschlag
 * mit Herkunft und Befunden. Wer daraus eine Zeile macht, ist
 * `expenseFromProposal` — und die weigert sich, wenn Betrag oder Datum fehlen.
 */
export const readReceipt = (input: ReceiptInput): ReceiptProposal => {
  const findings: ReceiptFinding[] = []
  const zeilen = (input.text ?? '')
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter(Boolean)

  // — Betrag —
  const kandidaten: ReadField<number>[] = []
  const alleBetraege: ReadField<number>[] = []
  for (const zeile of zeilen) {
    const treffer = ohneZeitangaben(zeile).match(BETRAG_IN_ZEILE)
    if (!treffer) continue
    for (const roh of treffer) {
      const wert = parseBetrag(roh)
      if (wert === undefined || wert <= 0) continue
      const f = feld(wert, 'text' as const, zeile)
      alleBetraege.push(f)
      if (KEINE_SUMME.test(zeile)) continue
      if (SUMMEN_WORT.test(zeile)) kandidaten.push(f)
    }
  }
  // Ohne Summenwort bleibt genau ein Fall uebrig, in dem ein Betrag sicher
  // ist: es gibt UEBERHAUPT nur einen. Das ist der haeufige Handy-Fall
  // („Taxi 24,50") — und wo nur eine Zahl steht, kann keine falsche gewaehlt
  // werden.
  const nichtAusgeschlossen = alleBetraege.filter((b) => !KEINE_SUMME.test(b.evidence))
  const werte = kandidaten.length > 0 ? kandidaten : nichtAusgeschlossen
  const eindeutig = [...new Set(werte.map((w) => w.value))]
  let amount: ReadField<number> | undefined
  if (eindeutig.length === 1) {
    amount = werte.find((w) => w.value === eindeutig[0])
  } else if (eindeutig.length === 0) {
    findings.push({ kind: 'no-amount' })
  } else {
    findings.push({
      kind: 'several-totals',
      detail: eindeutig.map((v) => v.toFixed(2)).join(' · '),
    })
  }

  // — Datum —
  const ausText: { iso: string; zeile: string }[] = []
  for (const zeile of zeilen) {
    const iso = datumAusZeile(zeile)
    if (iso) ausText.push({ iso, zeile })
  }
  const beschriftet = ausText.find((d) => DATUM_WORT.test(d.zeile))
  let date: ReadField<string> | undefined
  if (beschriftet) {
    date = feld(beschriftet.iso, 'text', beschriftet.zeile)
  } else if (ausText.length > 0) {
    date = feld(ausText[0].iso, 'text', ausText[0].zeile)
  }
  if (date && new Set(ausText.map((d) => d.iso)).size > 1 && !beschriftet) {
    findings.push({ kind: 'several-dates', detail: [...new Set(ausText.map((d) => d.iso))].join(' · ') })
  }
  if (!date && input.takenAt) {
    const iso = input.takenAt.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) date = feld(iso, 'exif', input.takenAt)
  }
  if (!date && input.fileDate) {
    const iso = input.fileDate.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      date = feld(iso, 'file-date', input.fileDate)
      // Das Dateidatum ist der Tag des Abfotografierens, nicht der des
      // Einkaufs. Es steht als Vorschlag da, aber nie unkommentiert.
      findings.push({ kind: 'date-from-file' })
    }
  }
  if (!date) findings.push({ kind: 'no-date' })

  // — Waehrung —
  let currency: ReadField<string> | undefined
  for (const [muster, code] of WAEHRUNG) {
    const zeile = zeilen.find((z) => muster.test(z))
    if (zeile) {
      currency = feld(code, 'text', zeile)
      break
    }
  }
  if (!currency) findings.push({ kind: 'currency-unstated' })

  // — Steuersatz —
  let vatPercent: ReadField<number> | undefined
  for (const zeile of zeilen) {
    if (!/(mwst|ust|umsatzsteuer|mehrwertsteuer|vat|tax)/i.test(zeile)) continue
    const m = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/.exec(zeile)
    if (!m) continue
    const wert = parseBetrag(m[1])
    if (wert === undefined) continue
    vatPercent = feld(wert, 'text', zeile)
    break
  }
  if (!vatPercent) findings.push({ kind: 'vat-unstated' })

  // — Aussteller —
  const istKopfzeile = (z: string) =>
    z.length >= 3 &&
    z.length <= 60 &&
    !/\d{2}[.:/]\d{2}/.test(z) &&
    !SUMMEN_WORT.test(z) &&
    !KEINE_SUMME.test(z) &&
    !/^\W+$/.test(z) &&
    /\p{L}{3}/u.test(z)
  const kopf = zeilen.find(istKopfzeile)
  let merchant: ReadField<string> | undefined
  if (kopf) merchant = feld(kopf, 'text', kopf)
  else if (input.fileName) {
    const stamm = input.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
    if (stamm && /\p{L}{3}/u.test(stamm)) merchant = feld(stamm, 'file-name', input.fileName)
  }
  if (!merchant) findings.push({ kind: 'no-merchant' })

  // — Art —
  const suchraum = [...zeilen, input.fileName ?? ''].join('\n')
  let kind: ReadField<ExpenseKind> | undefined
  for (const [art, muster] of ART_WOERTER) {
    const m = muster.exec(suchraum)
    if (m) {
      kind = feld(art, zeilen.some((z) => muster.test(z)) ? 'text' : 'file-name', m[0])
      break
    }
  }

  // `nothing-readable` heisst: da war NICHTS. Zwei erkannte Summenkandidaten
  // sind etwas — auch wenn keiner davon gewaehlt werden konnte. Wer den Fall
  // hier mit einschloesse, warfe die halbe Lesearbeit weg und meldete
  // zugleich das Falsche.
  if (!amount && !date && !merchant && eindeutig.length === 0) {
    return { amountCandidates: [], findings: [{ kind: 'nothing-readable' }] }
  }

  return {
    ...(date ? { date } : {}),
    ...(amount ? { amount } : {}),
    amountCandidates: eindeutig.map(
      (v) => werte.find((w) => w.value === v) as ReadField<number>,
    ),
    ...(currency ? { currency } : {}),
    ...(vatPercent ? { vatPercent } : {}),
    ...(merchant ? { merchant } : {}),
    ...(kind ? { kind } : {}),
    findings,
  }
}

export type ExpenseDraft = Omit<CrewExpense, 'id'>

export type ProposalResult =
  | { ok: true; expense: ExpenseDraft }
  | { ok: false; missing: ('amount' | 'date')[] }

/**
 * Aus einem Vorschlag eine Auslagenzeile machen — oder sagen, was fehlt.
 *
 * BETRAG UND DATUM SIND PFLICHT, und zwar hier und nicht in der Oberflaeche:
 * eine Auslage ohne Betrag ist keine Auslage, und eine ohne Datum faellt in
 * keinen Abrechnungszeitraum. Wer sie trotzdem anlegen will, tippt sie von
 * Hand — dann ist es eine Entscheidung und kein Lesefehler.
 */
export const expenseFromProposal = (
  p: ReceiptProposal,
  opts: { personId?: string; billable?: boolean; receiptRef?: string } = {},
): ProposalResult => {
  const missing: ('amount' | 'date')[] = []
  if (!p.amount) missing.push('amount')
  if (!p.date) missing.push('date')
  if (!p.amount || !p.date) return { ok: false, missing }
  const note = [p.merchant?.value, p.currency?.value && p.currency.value !== 'EUR' ? p.currency.value : '']
    .filter(Boolean)
    .join(' · ')
  return {
    ok: true,
    expense: {
      ...(opts.personId ? { personId: opts.personId } : {}),
      kind: p.kind?.value ?? 'other',
      date: p.date.value,
      amount: p.amount.value,
      billable: opts.billable === true,
      ...(opts.receiptRef ? { receiptRef: opts.receiptRef } : {}),
      ...(note ? { note } : {}),
    },
  }
}
