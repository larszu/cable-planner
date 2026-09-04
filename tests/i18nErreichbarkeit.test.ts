import { describe, expect, it } from 'vitest'
import dictsSrc from '../src/renderer/lib/i18n/dicts.ts?raw'
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

const aufrufe = (s: string): string[] =>
  [...s.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])

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
const vonEn = roh.indexOf('export const en: Dict = {')
const vonDe = roh.indexOf('export const de: Dict = {')
const englisch = keysOf(roh.slice(vonEn, vonDe))
const deutsch = keysOf(roh.slice(vonDe))

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
    expect(vonEn, 'en-Dict nicht gefunden').toBeGreaterThanOrEqual(0)
    expect(vonDe, 'de-Dict nicht gefunden').toBeGreaterThan(vonEn)
    // Untergrenze: findet der Schneider die Woerterbuecher nicht mehr, soll
    // der Test das sagen statt reihenweise Fehltreffer zu melden.
    expect(englisch.size, 'Zu wenige englische Schluessel — Muster passt nicht mehr').toBeGreaterThan(3000)
  })

  it('hat fuer jeden erreichbaren Schluessel eine englische Fassung', () => {
    const fehlend = [...erreichbar].filter((k) => !englisch.has(k)).sort()
    expect(
      fehlend,
      `Ohne englische Fassung, obwohl die Stelle gerendert wird: ${fehlend.slice(0, 12).join(', ')}` +
        `${fehlend.length > 12 ? ` … (+${fehlend.length - 12})` : ''}. Der Sprachschalter ist ` +
        'erreichbar — was hier fehlt, sieht ein englischer Nutzer auf Deutsch.',
    ).toEqual([])
  })

  it('haelt kein deutsches Dict-Eintrag ohne englisches Gegenstueck', () => {
    // DIE FORM DES FEHLERS, nicht sein Wortlaut. Deutsch ist Quellsprache und
    // steht an der Aufrufstelle; ein `de`-Eintrag ist eine Ueberschreibung.
    // Eine Ueberschreibung, die es NUR auf Deutsch gibt, ist genau das, was
    // 451 fehlabgelegte englische Zeilen ausmachte — sie standen im de-Dict
    // und in keinem en-Dict.
    //
    // Bewusst nicht am Text geprueft: „ist dieser Wert deutsch?" ist bei
    // Fachbegriffen (Truss, Gain, Patch) nicht entscheidbar. Die Ablageform
    // ist es.
    const ohneEnglisch = [...deutsch].filter((k) => !englisch.has(k)).sort()
    expect(
      ohneEnglisch,
      `Nur im de-Dict, ohne englische Fassung: ${ohneEnglisch.slice(0, 12).join(', ')}. ` +
        'Entweder gehoert der Eintrag ins en-Dict, oder er ist ueberfluessig — der ' +
        'deutsche Text steht ohnehin als Fallback an der Aufrufstelle.',
    ).toEqual([])
  })

  it('nennt uebersetzten Code, der nirgends gerendert wird', () => {
    // Beide belegt: `PrintDialog.tsx` (34 Aufrufe) wird nirgends importiert —
    // gedruckt wird ueber `ExportDialog`, das `printPdfBlob` selbst aufruft.
    // `TitleBlock.tsx` (14) ebenso; der Schriftkopf im PDF-Export entsteht in
    // `exportPdfVector.ts` aus eigenem Code.
    //
    // Ob die beiden verdrahtet oder geloescht gehoeren, ist eine
    // Eigentuemer-Entscheidung. Bis dahin sollen sie bei jedem Lauf sichtbar
    // sein — und keine dritte Datei still dazukommen.
    expect(totUebersetzt.map(([f]) => f).sort()).toEqual([
      'components/Canvas/TitleBlock.tsx',
      'components/Print/PrintDialog.tsx',
    ])
  })
})
