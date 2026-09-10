import { stripComments } from './stripComments'

// ---------------------------------------------------------------------------
// Wird dieser Schluessel in der Oberflaeche BENUTZT?
//
// ─── WARUM ES DIESES MODUL GIBT (2026-09-10, #820) ─────────────────────────
//
// Weil 25 Testdateien dieselbe Frage stellten und dabei die falsche Datei
// lasen. Die Form war ueberall gleich:
//
//     import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'
//     …
//     expect(dictsQuelle).toContain(`'${key}'`)
//
// Gemeint war „dieser Schluessel wird irgendwo angezeigt". Gemessen wurde
// „dieser Schluessel steht in einer Datei, die NIEMAND LAEDT": der
// `en`-Export von `dicts.ts` war seit E-28 (2026-09-09) tot — die Registry
// in `lib/i18n.ts` fuehrt ihn mit Absicht nicht, weil Englisch die
// Quellsprache ist und als Fallback im JSX steht.
//
// Eine Zusicherung, die eine tote Datei liest, ist gruen, wenn die
// Oberflaeche den Schluessel nie benutzt — und rot, wenn jemand die tote
// Datei aufraeumt. Beides ist das Gegenteil dessen, was sie soll.
//
// ─── DREI FORMEN, UND EINE VIERTE ──────────────────────────────────────────
//
// Die Muster sind dieselben wie in `tests/i18nErreichbarkeit.test.ts`, und
// sie stehen hier, damit es sie nur EINMAL gibt — zwei Fassungen desselben
// Musters sind die Defektform, an der der Quellsprachen-Waechter schon
// gescheitert ist.
//
//   t('key', …)                 Funktions-Komponenten
//   tr('key', …)                Module ohne React (intercomMatrixXlsx …)
//   translate(lang, 'key', …)   Klassen-Komponenten (ErrorBoundary)
//
// Die vierte ist kein Aufruf: ein DYNAMISCHER Schluessel, der als Konstante
// im Quelltext steht und erst zur Laufzeit aufgeloest wird —
// `notesKey: 'catalog.cable.sdi-12g.notes'` in `types/cableSpec.ts`, spaeter
// `t(spec.notesKey, spec.notesSource)`. Gemessen sind das 48 Schluessel, und
// ohne sie waere jede Deckungsrechnung um genau diese 48 zu streng.
// ---------------------------------------------------------------------------

const sources = import.meta.glob('../../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Quelltext ohne Kommentare — sonst zaehlt ein `t('foo', …)` aus einem
 *  Kopfkommentar als echter Aufruf mit. */
const dateien = new Map(Object.entries(sources).map(([p, s]) => [p, stripComments(s)]))

/** Der gesamte Renderer-Quelltext ohne Kommentare, fuer Textproben. */
export const rendererQuelltext: string = [...dateien.values()].join('\n')

const AUFRUF_MUSTER = [
  /\bt\(\s*'([^']+)'/g,
  /\btr\(\s*'([^']+)'/g,
  /\btranslate\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g,
]

const gerufen = new Set<string>()
for (const quelle of dateien.values()) {
  for (const muster of AUFRUF_MUSTER) {
    for (const m of quelle.matchAll(muster)) gerufen.add(m[1])
  }
}

/** Jeder Schluessel, den eine Renderer-Datei woertlich ruft. */
export const gerufeneSchluessel: ReadonlySet<string> = gerufen

/**
 * Benutzt die Oberflaeche diesen Schluessel?
 *
 * Woertlich gerufen ODER als Konstante hinterlegt (dynamischer Schluessel).
 * Die zweite Haelfte ist keine Aufweichung: `notesKey` steht im Katalog und
 * wird im Dialog aufgeloest — der Schluessel ist genauso benutzt wie einer,
 * der direkt im Aufruf steht, nur eine Indirektion weiter.
 */
export const schluesselWirdBenutzt = (key: string): boolean =>
  gerufen.has(key) || rendererQuelltext.includes(`'${key}'`)

/**
 * Die Zusicherung in einem Satz, mit einer Meldung, die sagt, was zu tun ist.
 *
 * Bewusst als Funktion und nicht als blosses `expect(...).toBe(true)` an 30
 * Stellen: die Begruendung soll dort stehen, wo sie gelesen wird — im
 * Fehlertext des Tests, der gerade rot ist.
 */
export const meldungFehlenderSchluessel = (key: string): string =>
  `Der Schluessel '${key}' wird von keiner Datei unter src/renderer benutzt — ` +
  'weder als `t()`/`tr()`/`translate()`-Aufruf noch als Konstante fuer einen ' +
  'dynamischen Schluessel. Entweder ist die Aufrufstelle weggefallen, oder er ' +
  'ist vertippt; in beiden Faellen zeigt die Oberflaeche diesen Text nicht.'
