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

import { KANONISCH_DE } from './kanonischDe'

/** Deutscher Text zu `key`, sonst die englische Quelle. */
export const kanonisch = (key: string, englisch: string): string => KANONISCH_DE[key] ?? englisch
