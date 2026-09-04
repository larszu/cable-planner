import { describe, expect, it } from 'vitest'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
import { stripComments } from './support/stripComments'

// Der Sprachschalter ist hier ERREICHBAR: Einstellungen → Darstellung
// (`AppearanceTab.tsx:180`) setzt `setLanguage`. Was das Woerterbuch nicht
// hat, bekommt der englische Nutzer deshalb auf Deutsch zu sehen --
// `translate()` (`lib/i18n.ts:62`) faellt bei fehlendem Schluessel auf den
// deutschen Inline-Fallback zurueck, in JEDER Sprache.
//
// GEMESSEN 2026-09-04: 3.490 Schluessel werden von gerenderten Komponenten
// aufgerufen, 492 davon haben keine englische Fassung. Das englische
// Woerterbuch hat 3.396 Eintraege -- eine reine Zaehlung sieht daher
// "praktisch vollstaendig" und ist es nicht. Betroffen sind ganze Bereiche:
// Export (75), ATEM (68), Bibliothek (37), Doku (36), Kabel (34), Rack (34).
//
// Dieser Test uebersetzt nichts. Er haelt die Zahl fest, damit sie nicht
// weiter waechst, und benennt uebersetzten Code, der nirgends gerendert wird
// -- die zweite Haelfte desselben Musters: Arbeit, die in unsichtbaren Code
// geflossen ist, waehrend die sichtbare Oberflaeche unuebersetzt blieb.
// (Dieselbe Erhebung hat in `light-planner` ergeben, dass 40 von 42
// englischen Schluesseln toten Code bedienten.)

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

const aufrufe = (s: string): string[] =>
  [...s.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])

/** Die englischen Schluessel: `export const en: Dict = { … }` bis zum `de`. */
const englisch = (() => {
  const roh = stripComments(dictsSrc)
  const von = roh.indexOf('export const en: Dict = {')
  const bis = roh.indexOf('export const de: Dict = {')
  expect(von, 'Das en-Woerterbuch wurde nicht gefunden').toBeGreaterThanOrEqual(0)
  expect(bis, 'Das de-Woerterbuch wurde nicht gefunden').toBeGreaterThan(von)
  const keys = new Set([...roh.slice(von, bis).matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]))
  // Untergrenze: findet der Schneider das Woerterbuch nicht mehr, soll der
  // Test das sagen und nicht reihenweise Fehltreffer melden.
  expect(keys.size, 'Zu wenige englische Schluessel — das Muster passt nicht mehr').toBeGreaterThan(1000)
  return keys
})()

const erreichbar = new Set<string>()
const totUebersetzt: Array<[string, number]> = []
for (const [pfad, s] of code) {
  const ks = aufrufe(s)
  if (!ks.length) continue
  const lebt = pfad.endsWith('/renderer/App.tsx') || wirdImportiert(pfad)
  if (lebt) ks.forEach((k) => erreichbar.add(k))
  else totUebersetzt.push([pfad.replace('../src/renderer/', ''), ks.length])
}

const ohneEnglisch = [...erreichbar].filter((k) => !englisch.has(k)).sort()

/**
 * Die Decke, unter der die Zahl bleiben muss.
 *
 * Sie ist KEIN Ziel, sondern der heutige Stand. Wer uebersetzt, zieht sie
 * herunter; wer einen neuen Schluessel ohne englische Fassung anlegt, laesst
 * den Test hier auflaufen. Absichtlich eine Obergrenze und keine Gleichheit:
 * eine Uebersetzung soll den Test nicht brechen, nur weil sie hilft.
 */
const DECKE = 492

describe('i18n — die erreichbare Oberflaeche', () => {
  it('bekommt nicht mehr unuebersetzte Schluessel als heute', () => {
    const domaenen = new Map<string, number>()
    for (const k of ohneEnglisch) {
      const d = k.split('.')[0]
      domaenen.set(d, (domaenen.get(d) ?? 0) + 1)
    }
    const top = [...domaenen].sort((a, b) => b[1] - a[1]).slice(0, 6)
    expect(
      ohneEnglisch.length,
      `${ohneEnglisch.length} erreichbare Schluessel ohne englische Fassung ` +
        `(Decke ${DECKE}). Groesste Bereiche: ${top.map(([d, n]) => `${d} ${n}`).join(', ')}. ` +
        'Der Sprachschalter ist erreichbar — was hier fehlt, sieht ein englischer ' +
        'Nutzer auf Deutsch.',
    ).toBeLessThanOrEqual(DECKE)
  })

  it('nennt uebersetzten Code, der nirgends gerendert wird', () => {
    // Zwei Dateien, beide belegt: `PrintDialog.tsx` (34 Aufrufe) wird nirgends
    // importiert -- gedruckt wird ueber `ExportDialog`, das `printPdfBlob`
    // selbst aufruft. `TitleBlock.tsx` (14) ebenso; der Schriftkopf im
    // PDF-Export entsteht in `exportPdfVector.ts` aus eigenem Code.
    //
    // Ob die beiden verdrahtet oder geloescht gehoeren, ist eine
    // Eigentuemer-Entscheidung (B-24). Bis dahin sollen sie bei jedem Lauf
    // sichtbar sein statt in einer Zaehlung zu verschwinden -- und keine
    // dritte Datei still dazukommen.
    expect(totUebersetzt.map(([f]) => f).sort()).toEqual([
      'components/Canvas/TitleBlock.tsx',
      'components/Print/PrintDialog.tsx',
    ])
  })
})
