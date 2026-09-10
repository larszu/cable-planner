// ---------------------------------------------------------------------------
// Die FORM eines Woerterbuchs — mehr steht hier nicht, und das ist der Punkt.
//
// Bis 2026-09-10 wohnte dieser Typ in `i18n/dicts.ts`, zusammen mit einem
// `en`-Objekt von 5036 Eintraegen. Das Objekt war tot: die Registry in
// `lib/i18n.ts` fuehrt Englisch seit E-28 mit Absicht NICHT, weil es die
// Quellsprache ist und als Fallback im JSX steht. Importiert wurde aus der
// Datei nur noch dieser Typ.
//
// Beim Lesen sah die tote Kopie trotzdem aus wie die Quelle der Wahrheit —
// und lief auseinander: `scene.import` stand dort noch als
// `'\u{1F39B} Read scene file'`, waehrend die Quelle laengst
// `'Read scene file'` sagte (#818). 25 Testdateien lasen sie ausserdem als
// Schluessel-Register und waren damit gruen, auch wenn die Oberflaeche den
// Schluessel nie benutzte (#820).
//
// Eine Datei namens `dicts.ts` OHNE Woerterbuecher darin waere der naechste
// Stolperstein gewesen. Deshalb dieser Name: `dict.ts`, ein Typ.
// ---------------------------------------------------------------------------

/** Ein Woerterbuch: Schluessel -> uebersetzter Text. */
export type Dict = Record<string, string>
