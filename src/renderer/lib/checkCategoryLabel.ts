// ───────────────────────────────────────────────────────────────────────────
// Die Kategorie eines Prüf-Befunds, in der Sprache der Oberfläche.
//
// ─── WARUM DAS EIN EIGENES MODUL IST (2026-09-10, #822) ────────────────────
//
// `drawingChecks.ts` ist ein reines Rechenmodul ohne React und ohne Store —
// es liefert Befunde, keine Beschriftungen. Seine `category` ist deshalb ein
// DATENWERT und seit heute in der Quellsprache (`Open ports`, `Missing
// length`, `Wire bundle`); vorher war sie deutsch, mitten in einem Repo mit
// Quellsprache `en`.
//
// Ein Datenwert, den jemand liest, braucht trotzdem eine Übersetzung. Sie
// steht hier und nicht in `drawingChecks.ts`: würde das Rechenmodul selbst
// übersetzen, hinge sein Ergebnis an der eingestellten Sprache — und jeder
// Test, der auf `category === 'Open ports'` prüft, wäre auf einem deutschen
// Rechner rot.
//
// Getrennt von `categoryTranslations.ts`, weil das die GERÄTE-Kategorien
// führt: die stehen in der Projektdatei und brauchen eine Migration, diese
// hier entstehen bei jedem Lauf neu und brauchen keine.
// ───────────────────────────────────────────────────────────────────────────

/** Der Schlüssel, unter dem eine Kategorie im Wörterbuch steht. */
const schluessel = (kategorie: string): string =>
  `check.category.${kategorie.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

/**
 * Die Beschriftung einer Befund-Kategorie.
 *
 * Der Wert selbst ist der Fallback — das ist derselbe Vertrag wie bei jedem
 * `t(key, 'English text')` im Repo, nur dass der englische Text hier aus den
 * Daten kommt statt aus dem Aufruf. Eine Kategorie ohne Wörterbuch-Eintrag
 * bleibt damit lesbar statt zu einem Schlüssel-Rest zu werden.
 */
export const checkCategoryLabel = (
  kategorie: string,
  t: (key: string, fallback: string) => string,
): string => (kategorie ? t(schluessel(kategorie), kategorie) : kategorie)
