// ───────────────────────────────────────────────────────────────────────────
// Der kanonische Text eines gestempelten Blatts (#1128).
//
// Die Quelle der Beschriftungen ist englisch (E-28), die gestempelten Blaetter
// tragen aber kanonisches Deutsch — unabhaengig von der eingestellten Sprache,
// weil der Dokument-Stand aus `headers`/`rows` gerechnet wird
// (`documentFingerprint`). Ein Blatt, dessen Zellen mit dem Sprachschalter
// wechselten, meldete jedes gedruckte Exemplar als veraltet.
//
// Deshalb hier kein `tr()` (das folgt dem uiStore), sondern fest das deutsche
// Woerterbuch: dieselbe Uebersetzung wie in der Oberflaeche, ein Ort fuer den
// Text, und die Zelle bleibt Zeichen fuer Zeichen, was sie vorher war.
// ───────────────────────────────────────────────────────────────────────────

import { KANONISCH_DE, SPALTEN_DE } from './kanonischDe'

/** Deutscher Text zu `key`, sonst die englische Quelle. */
export const kanonisch = (key: string, englisch: string): string => KANONISCH_DE[key] ?? englisch

/**
 * Die Kopfzeile eines gestempelten Blatts: englische Spaltennamen in der
 * Quelle, kanonisch deutsch im Blatt. `lang:check` misst die Liste in der
 * Klammer wie eine `headers: [...]`-Liste, der Lexikon-Guard
 * (`tests/dataDictionary.test.ts`) prueft die deutschen Namen.
 */
export const spalten = (englisch: readonly string[]): string[] =>
  englisch.map((name) => SPALTEN_DE[name] ?? name)
