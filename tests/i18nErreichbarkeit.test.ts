import { describe, expect, it } from 'vitest'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import deSrc from '../src/renderer/lib/i18n/de.ts?raw'
import { stripComments } from './support/stripComments'

// WAS HIER GEFUNDEN WURDE (2026-09-04).
//
// Der Sprachschalter ist erreichbar — Einstellungen → Darstellung
// (`AppearanceTab.tsx:180`). Und `translate()` (`lib/i18n.ts:62`) faellt bei
// fehlendem Schluessel auf den deutschen Inline-Fallback zurueck, in JEDER
// Sprache. Gemessen fehlten **492** erreichbare Schluessel im en-Dict.
//
// Die Ursache war keine fehlende Uebersetzung, sondern eine Fehlablage. Am
// Ende des DEUTSCHEN Woerterbuchs stand ein Block von **451** Eintraegen
// unter der Marke „i18n coverage completion (auto-merged)" — mit englischen
// Werten: „(empty)", „Click = show text", „Configure Videohub · Labels +
// Routing". Damit waren beide Sprachen falsch:
//
//   Deutsch    de-Dict trifft zu, liefert Englisch — der deutsche
//              Inline-Fallback kam nie zum Zug
//   Englisch   Schluessel fehlt im en-Dict, also greift der Fallback —
//              also Deutsch
//
// Der Umzug hat 434 der 492 erledigt; die restlichen 58 (Drum-Mikrofonierung,
// Schema-Builder, .avplan-Import, Quellen-Karte) sind nachtraeglich
// uebersetzt. Beide Zahlen stehen jetzt auf null, und dieser Test haelt sie
// dort.
//
// Die zweite Haelfte desselben Musters ist uebersetzter Code, den niemand
// rendert — in `light-planner` bedienten 40 von 42 englischen Schluesseln
// toten Code. Hier sind es zwei Dateien, und sie werden benannt.

const sources = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Quelltext ohne Kommentare — sonst zaehlt das `t('foo', '{n} cables')`
 *  aus dem Kopfkommentar von `lib/i18n.ts` als echter Aufruf mit. */
const code = new Map(Object.entries(sources).map(([p, s]) => [p, stripComments(s)]))

/** Wird die Datei irgendwo importiert — auch lazy? */
const wirdImportiert = (pfad: string): boolean => {
  const name = pfad.split('/').pop()!.replace(/\.tsx?$/, '')
  const muster = new RegExp(`from\\s+'[^']*/${name}'|import\\(\\s*'[^']*/${name}'`)
  for (const [p, s] of code) {
    if (p === pfad) continue
    if (muster.test(s)) return true
  }
  return false
}

/**
 * Die Schluessel, die eine Datei ruft.
 *
 * DREI FORMEN, und zwei davon fehlten hier. Funktions-Komponenten rufen
 * `t('key', …)`; KLASSEN-Komponenten koennen keinen Hook benutzen und rufen
 * stattdessen `translate(lang, 'key', …)`. Der `ErrorBoundary` ist so eine —
 * und mit dem Muster von vorher galten seine zehn Schluessel als „von
 * niemandem gerufen".
 *
 * Aufgefallen ist das erst bei der Sprachdrehung (E-28), weil vorher kein
 * Test in diese Richtung fragte. Der blinde Fleck war aber die ganze Zeit da:
 * ein fehlender Schluessel im Absturz-Schirm waere nicht gemeldet worden.
 *
 * DIE DRITTE FORM kam am 2026-09-09 dazu, beim Vendorieren: `tr('key', …)`
 * ist der Uebersetzer fuer Module ohne React (`lib/intercomMatrixXlsx.ts`,
 * `lib/importGreengo.ts`). `\bt\(` trifft ihn nicht — hinter dem `t` steht
 * ein `r`. Die Folge war ein Fehlalarm in die andere Richtung: sechs
 * deutsche Eintraege galten als „von niemandem gerufen", obwohl sie
 * Import-Fehlermeldungen uebersetzen. Derselbe blinde Fleck sass in
 * `scripts/quellsprache.mjs` und hat dort sechs deutsche Fallbacks durch die
 * Sprachdrehung gelassen.
 */
const aufrufe = (s: string): string[] => [
  ...[...s.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...s.matchAll(/\btr\(\s*'([^']+)'/g)].map((m) => m[1]),
  ...[...s.matchAll(/\btranslate\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g)].map((m) => m[1]),
]

/**
 * Die Schluessel eines Dict-Abschnitts — in BEIDEN Anfuehrungsformen.
 *
 * Der auto-merge-Block war doppelt gequotet, der Rest der Datei einfach. Eine
 * Zaehlung, die nur `'…':` kennt, haette ihn nicht gesehen — und damit genau
 * den Block uebersehen, um den es hier geht.
 */
const keysOf = (teil: string): Set<string> =>
  new Set([
    ...[...teil.matchAll(/^\s*'((?:[^'\\]|\\.)+)':/gm)].map((m) => m[1]),
    ...[...teil.matchAll(/^\s*"((?:[^"\\]|\\.)+)":/gm)].map((m) => m[1]),
  ])

const roh = stripComments(dictsSrc)
// Seit E-28 (2026-09-09) liegt die QUELLSPRACHE in `dicts.ts` (`en`) und die
// Uebersetzung in einer eigenen Datei je Sprache (`i18n/de.ts`). Vorher lagen
// beide in `dicts.ts` untereinander, und dieser Test schnitt sie an der Grenze
// `export const de` auseinander.
const englisch = keysOf(roh.slice(roh.indexOf('export const en: Dict = {')))
const deutsch = keysOf(deSrc)

const erreichbar = new Set<string>()
const totUebersetzt: Array<[string, number]> = []
for (const [pfad, s] of code) {
  const ks = aufrufe(s)
  if (!ks.length) continue
  const lebt = pfad.endsWith('/renderer/App.tsx') || wirdImportiert(pfad)
  if (lebt) ks.forEach((k) => erreichbar.add(k))
  else totUebersetzt.push([pfad.replace('../src/renderer/', ''), ks.length])
}

describe('i18n — die erreichbare Oberflaeche', () => {
  it('findet beide Woerterbuecher', () => {
    // Untergrenze: findet der Schneider die Woerterbuecher nicht mehr, soll
    // der Test das sagen statt reihenweise Fehltreffer zu melden.
    expect(englisch.size, 'Zu wenige Quell-Schluessel — Muster passt nicht mehr').toBeGreaterThan(3000)
    expect(deutsch.size, 'Zu wenige deutsche Schluessel — Muster passt nicht mehr').toBeGreaterThan(3000)
  })

  it('hat fuer jeden erreichbaren Schluessel eine deutsche Fassung', () => {
    // GEDREHT MIT E-28. Vorher wurde die englische Fassung eingefordert, weil
    // Deutsch die Quelle war; jetzt ist es umgekehrt. Die Frage ist dieselbe
    // geblieben — was hier fehlt, sieht der Nutzer in der ANDEREN Sprache.
    const fehlend = [...erreichbar].filter((k) => !deutsch.has(k)).sort()
    expect(
      fehlend,
      `Ohne deutsche Fassung, obwohl die Stelle gerendert wird: ${fehlend.slice(0, 12).join(', ')}` +
        `${fehlend.length > 12 ? ` … (+${fehlend.length - 12})` : ''}. Der Sprachschalter ist ` +
        'erreichbar — was hier fehlt, sieht ein deutscher Nutzer auf Englisch.',
    ).toEqual([])
  })

  it('haelt keinen deutschen Eintrag, den niemand benutzt', () => {
    // GEDREHT MIT E-28, und die Frage musste dabei neu gestellt werden.
    //
    // Vorher hiess sie: „gibt es zu jedem de-Eintrag einen en-Eintrag?" Das
    // war richtig, solange Deutsch die QUELLE war — ein `de`-Eintrag war dann
    // eine Ueberschreibung ohne Not, und genau so lagen 451 englische Zeilen
    // im falschen Woerterbuch.
    //
    // Jetzt ist Deutsch die UEBERSETZUNG, und die Quelle steht nicht mehr
    // vollstaendig im Woerterbuch: die meisten englischen Texte stehen als
    // Fallback an der Aufrufstelle. Ein deutscher Eintrag ist deshalb genau
    // dann ueberfluessig, wenn ihn NIEMAND ruft — weder ueber einen
    // erreichbaren `t()`-Aufruf noch ueber das Quell-Woerterbuch.
    //
    // Bewusst nicht am Text geprueft: „ist dieser Wert deutsch?" ist bei
    // Fachbegriffen (Truss, Gain, Patch) nicht entscheidbar. Die Ablageform
    // ist es.
    const benutzt = new Set([...englisch, ...erreichbar])
    const verwaist = [...deutsch].filter((k) => !benutzt.has(k)).sort()
    expect(
      verwaist,
      `Deutsche Eintraege, die niemand ruft: ${verwaist.slice(0, 12).join(', ')}` +
        `${verwaist.length > 12 ? ` … (+${verwaist.length - 12})` : ''}. Entweder ist ` +
        'die Aufrufstelle weggefallen, oder der Schluessel ist vertippt — in beiden ' +
        'Faellen uebersetzt hier jemand ins Leere.',
    ).toEqual([])
  })

  it('duldet KEINEN uebersetzten Code, der nirgends gerendert wird', () => {
    // Bis 2026-09-08 stand hier eine Liste mit zwei Namen: `PrintDialog.tsx`
    // (34 t()-Aufrufe) und `TitleBlock.tsx` (14) wurden nirgends importiert.
    // Beide waren Doppel, keine Luecken — gedruckt wird ueber `ExportDialog`,
    // das `printPdfBlob` selbst aufruft, und der Schriftkopf im PDF entsteht
    // in `exportPdfVector.ts` aus eigenem Code.
    //
    // E-16 hat entschieden: geloescht. Zwei Druckwege waeren zwei Stellen, an
    // denen der Stempel fehlen kann — `cable#673` hat gezeigt, wie das
    // ausgeht.
    //
    // Und damit wird aus der Liste die staerkere Zusicherung: LEER. Eine
    // Liste mit Namen darin haelt einen Zustand fest; die leere Liste
    // verbietet ihn. Wer eine dritte uebersetzte Datei anlegt und nirgends
    // einhaengt, wird hier rot — nicht bloss genannt.
    expect(totUebersetzt.map(([f]) => f).sort()).toEqual([])
  })
})
