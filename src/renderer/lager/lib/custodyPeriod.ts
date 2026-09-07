// ───────────────────────────────────────────────────────────────────────────
// BEDARF 98 (P3) — „A booking/custody model that matches how gear actually
// moves: start in the past, extend mid-run, Load out / Load in."
//
// Zwei Saetze aus der Bedarfs-Datenbank, beide direkt gelesen:
//
//   > Ability to create a booking STARTING IN PAST, for items picked up in
//   > hurry
//   > edit bookings end date WHILE IT'S GOING ON (need to pull stuff for
//   > another place early, or to extend)
//
// Beides beschreibt denselben Umstand: der Vorgang auf der Platte entsteht
// NACH dem Vorgang in der Halle. Wer erst laedt und dann eintraegt, bekommt
// von einer Software, die nur „jetzt" kennt, einen falschen Zeitpunkt — und
// die Ueberfaelligkeit rechnet sich ab da an der falschen Stelle.
//
// ─── WAS DIESE DATEI ERLAUBT, UND WAS NICHT ────────────────────────────────
//
// RUECKWIRKEND JA, VORAUSWIRKEND NEIN. Eine Ausgabe, die in der Zukunft
// beginnt, ist keine Ausgabe, sondern eine Reservierung: das Material liegt
// noch im Regal, und ein Vorgang, der es als draussen fuehrt, macht die
// Lagerdeckung falsch. Das ist ein benannter Befund (`in-the-future`) und
// keine stille Korrektur auf „jetzt" — wer sich vertippt, soll es sehen.
//
// ─── DER ALTE TERMIN BLEIBT STEHEN ─────────────────────────────────────────
//
// `applyExtension` schreibt den neuen Rueckgabetermin UND haengt den alten an
// die Vorgangs-Historie. Eine Verlaengerung, die den urspruenglichen Termin
// ueberschreibt, loescht genau die Auskunft, wegen der jemand nachsieht:
// „war das von Anfang an so geplant oder ist es dreimal verschoben worden?".
// Beim Sub-Hire haengt daran die Rechnung des Lieferanten.
//
// ─── ZUR VOKABEL „LOAD OUT / LOAD IN" ──────────────────────────────────────
//
// Die Massnahme nennt sie: „adopt the load-out/load-in vocabulary". Sie wird
// hier NICHT uebernommen, und das ist eine Entscheidung und kein Vergessen.
// Der Grund der Quelle ist, dass „check out / check in" nach Bibliothek
// klingt und nicht nach Halle. Diese Oberflaeche ist deutsch und sagt
// „Ausgabe" und „Rueckgabe" — das IST das Hallenwort, und es steht so auch
// auf dem Ausgabeschein und in der Dokument-Kennung (`ausgabeschein`,
// ADR-004). Ein englisches Lehnwort daruebergelegt machte den Text
// schlechter und die Kennung des Dokuments ungueltig.
//
// REIN: keine Uhr, kein Store, kein IO. Der Stichtag kommt von aussen.
// ───────────────────────────────────────────────────────────────────────────
import type { CheckoutRecord, CustodyExtension } from '../types/checkout'

export type CustodyStartRefusal =
  /** Der Zeitpunkt liegt in der Zukunft — das waere eine Reservierung. */
  | 'in-the-future'
  /** Kein lesbarer Zeitpunkt. */
  | 'not-a-time'

export const CUSTODY_START_REFUSAL_TEXT: Readonly<Record<CustodyStartRefusal, string>> = {
  'in-the-future':
    'Die Ausgabe liegt in der Zukunft. Was noch im Regal liegt, ist reserviert und nicht ausgegeben.',
  'not-a-time': 'Kein lesbarer Zeitpunkt.',
}

/**
 * Darf die Ausgabe auf diesen Zeitpunkt gebucht werden?
 *
 * `undefined` heisst ja — auch fuer einen Zeitpunkt weit in der
 * Vergangenheit. Eine Grenze nach hinten waere eine Vermutung darueber, wie
 * spaet jemand seine Vorgaenge nachtraegt, und der Bedarf sagt ausdruecklich,
 * dass genau das passiert („picked up in hurry").
 */
export const custodyStartRefusal = (
  at: string,
  now: string,
): CustodyStartRefusal | undefined => {
  const t = Date.parse(at)
  const n = Date.parse(now)
  if (!Number.isFinite(t) || !Number.isFinite(n)) return 'not-a-time'
  return t > n ? 'in-the-future' : undefined
}

export type ExtendRefusal =
  /** Der Vorgang ist schon zurueck — dann gibt es nichts zu verlaengern. */
  | 'already-back'
  /** Der neue Termin liegt vor der Ausgabe. */
  | 'before-start'
  /** Derselbe Termin wie bisher. */
  | 'unchanged'
  /** Kein lesbares Datum. */
  | 'not-a-date'

export const EXTEND_REFUSAL_TEXT: Readonly<Record<ExtendRefusal, string>> = {
  'already-back': 'Der Vorgang ist bereits zurückgebucht.',
  'before-start': 'Der Rückgabetermin liegt vor der Ausgabe.',
  unchanged: 'Das ist der Termin, der schon eingetragen ist.',
  'not-a-date': 'Kein lesbares Datum.',
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/

/**
 * Darf der Rueckgabetermin auf `to` gesetzt werden?
 *
 * BEIDE RICHTUNGEN sind erlaubt — der Beleg nennt beide in einem Atemzug:
 * „need to pull stuff for another place EARLY, or to EXTEND". Ein Werkzeug,
 * das nur nach hinten laesst, zwingt zum Loeschen und Neuanlegen, und dabei
 * geht die Ausgabeliste verloren.
 */
export const extendRefusal = (
  record: CheckoutRecord,
  to: string,
): ExtendRefusal | undefined => {
  if (record.in) return 'already-back'
  if (!ISO_DATUM.test(to)) return 'not-a-date'
  if (to === (record.out.dueBack ?? '')) return 'unchanged'
  if (to < record.out.at.slice(0, 10)) return 'before-start'
  return undefined
}

/**
 * Den Rueckgabetermin aendern und den alten festhalten.
 *
 * Gibt einen NEUEN Vorgang zurueck; der Aufrufer setzt ihn in seine Liste.
 * `at` ist der Zeitpunkt der Aenderung und kommt von aussen — diese Datei
 * liest keine Uhr.
 */
export const applyExtension = (
  record: CheckoutRecord,
  to: string,
  at: string,
  by?: string,
  note?: string,
): CheckoutRecord => ({
  ...record,
  out: { ...record.out, dueBack: to },
  extensions: [
    ...(record.extensions ?? []),
    {
      at,
      ...(record.out.dueBack ? { from: record.out.dueBack } : {}),
      to,
      ...(by && by.trim() ? { by: by.trim() } : {}),
      ...(note && note.trim() ? { note: note.trim() } : {}),
    } satisfies CustodyExtension,
  ],
})

/**
 * Wie oft der Termin dieses Vorgangs schon verschoben wurde.
 *
 * Steht als Zahl auf der Liste. Ein Vorgang, der dreimal verlaengert wurde,
 * sieht sonst aus wie einer, der von Anfang an so lange geplant war.
 */
export const extensionCount = (record: CheckoutRecord): number => record.extensions?.length ?? 0

/** Der urspruengliche Rueckgabetermin, wenn er verschoben wurde. */
export const originalDueBack = (record: CheckoutRecord): string | undefined =>
  record.extensions?.[0]?.from

/**
 * Der Zeitraum eines Vorgangs als deutscher Satz.
 *
 * OHNE TERMIN steht „offen" da und kein leeres Feld: ein leeres Feld liest
 * sich als „steht noch nicht fest oder es gibt keinen", und der Unterschied
 * entscheidet, ob jemand nachfragt.
 */
export const custodyPeriodText = (record: CheckoutRecord, heute: string): string => {
  const seit = record.out.at.slice(0, 10)
  const bis = record.out.dueBack
  const teile = [`ausgegeben ${seit}`]
  if (!bis) teile.push('Rückgabe offen')
  else if (record.in) teile.push(`zurück ${record.in.at.slice(0, 10)}`)
  else teile.push(bis < heute ? `überfällig seit ${bis}` : `zurück ${bis}`)
  const n = extensionCount(record)
  if (n > 0) {
    const erst = originalDueBack(record)
    teile.push(n === 1 ? `einmal verschoben${erst ? ` (zuerst ${erst})` : ''}` : `${n}-mal verschoben${erst ? ` (zuerst ${erst})` : ''}`)
  }
  return teile.join(' · ')
}
