// ───────────────────────────────────────────────────────────────────────────
// EINE STELLE ENTSCHEIDET, OB `09.10.26` DER 9. OKTOBER ODER DER 10. SEPTEMBER
// IST.
//
// Die Regel stand bisher in `approvalCapture.ts` und galt dort fuer
// eingefuegte Chat-Kopfzeilen. Mit dem Beleg-Einlesen (Bedarf 97) braucht sie
// eine zweite Stelle — und zwei Stellen, die dieselbe Mehrdeutigkeit
// unabhaengig voneinander aufloesen, sind genau die Sorte Fehler, die
// niemandem auffaellt: dieselbe Zahlenfolge wird im Zusage-Blatt zum 9.
// Oktober und im Beleg zum 10. September, und beide Blaetter behaupten, den
// gleichen Vorgang zu belegen.
//
// ─── DIE REGEL, UND WORAUF SIE SICH STUETZT ────────────────────────────────
//
//   PUNKTE          → Tag zuerst   (09.10.26 = 9. Oktober; deutsche Schreibweise)
//   SCHRAEGSTRICHE  → Monat zuerst (9/10/26  = 10. September; US-Schreibweise)
//   BINDESTRICHE    → Jahr zuerst  (2026-10-09; ISO 8601, eindeutig)
//   ausser: die erste Zahl ist groesser als zwoelf — dann kann sie nur der Tag
//   sein, egal welches Trennzeichen davorsteht.
//
// Das ist die Konvention der Exporte und Kassenzettel, keine Vermutung ueber
// den Nutzer. Wo sie nicht traegt (3.2. gegen 2.3. aus einem US-Geraet),
// bleibt die erkannte Form im Ergebnis stehen, damit die Oberflaeche sie
// zeigen und der Mensch sie widerlegen kann. Still geraten wird nie.
// ───────────────────────────────────────────────────────────────────────────

/** Wie das Datum geschrieben war — Teil jedes Ergebnisses, nie nur intern. */
export type DateStyle = 'day-first' | 'month-first' | 'iso' | 'none'

/** Die Trennzeichen, fuer die die Regel gilt. */
export type DateSeparator = '.' | '/' | '-'

/**
 * Steht der Tag vorn?
 *
 * `erste` ist die erste Zahl der Angabe. Ist sie groesser als zwoelf, kann sie
 * kein Monat sein — diese Ausnahme schlaegt das Trennzeichen, weil sie aus der
 * Zahl selbst folgt und nicht aus einer Konvention.
 */
export const istTagZuerst = (trenner: DateSeparator, erste: number): boolean =>
  erste > 12 ? true : trenner === '.'

/** Zweistelliges Jahr auf vier ergaenzen — `26` ist 2026, nicht 1926. */
export const vierstelligesJahr = (j: number): number => (j < 100 ? 2000 + j : j)

/**
 * Tag, Monat und Jahr zu `YYYY-MM-DD` zusammensetzen.
 *
 * Gibt `undefined` zurueck, wenn die Zahlen kein Datum ergeben koennen — und
 * zwar OHNE sie zurechtzubiegen. Ein Monat 13 wird nicht zum Januar des
 * Folgejahres: dass die Erkennung danebenlag, ist die Auskunft, die gebraucht
 * wird.
 *
 * KEINE PRUEFUNG GEGEN DIE MONATSLAENGE. Der 31. Februar faellt hier durch die
 * Grenze `tag <= 31` und bleibt stehen; ihn abzulehnen hiesse, aus einem
 * schlecht gelesenen Beleg gar keinen zu machen, statt eines mit einem
 * sichtbar falschen Datum, das jemand korrigieren kann.
 */
export const zuIsoDatum = (tag: number, monat: number, jahr: number): string | undefined => {
  if (!Number.isInteger(tag) || !Number.isInteger(monat) || !Number.isInteger(jahr)) return undefined
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return undefined
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(vierstelligesJahr(jahr), 4)}-${p(monat)}-${p(tag)}`
}
