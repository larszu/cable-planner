import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Jeder Eintrittspunkt, der Oberflaeche rendert, wird auf seine Sprache
// geprueft — und keiner von ihnen schleppt das Desktop-Woerterbuch mit.
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// `lang:check` lief bis 2026-09-10 nur auf `src/renderer`. Es gibt aber drei
// Ordner, die im Browser laufen — `renderer`, `mobile`, `viewer`; sie stehen
// so in `tsconfig.app.json` und in `CLAUDE.md`. Die beiden ungeprueften waren
// vollstaendig deutsch beschriftet: 63 Zeichenketten in `src/mobile`, 12 in
// `src/viewer`, mitten in einem Repo, dessen Quellsprache seit E-28 `en` ist.
//
// Der Waechter stand also an EINER Tuer von dreien und meldete „0 Verstoesse".
// Das ist dieselbe Form wie beim Typ-Check, der `src/mobile` nicht ansah
// (siehe `typpruefungDecktSrc.test.ts`): eine Pruefung, die nur einen Teil
// des Baums sieht, ist auf dem Rest nicht etwa weniger streng — sie ist blind
// und sagt es nicht.
//
// Geprueft wird deshalb nicht „steht `src/mobile` im Skript" (das waere die
// Liste, die beim naechsten Ordner wieder fehlt), sondern: JEDER Ordner, den
// `tsconfig.app.json` als Browser-Code fuehrt, kommt im `lang:check`-Skript
// vor. Wer einen vierten Eintrittspunkt anlegt, wird hier rot.
//
// ─── UND DIE ZWEITE HAELFTE: DAS WOERTERBUCH BLEIBT AM DESKTOP ─────────────
//
// `renderer/lib/i18n.ts` importiert `de.ts` STATISCH — 316 KB, 5276
// Schluessel. Der Mobile-Chunk ist 72 KB gross (57 KB davor, +15 KB fuer
// sein eigenes Woerterbuch — gemessen am 2026-09-10). Ein einziger Import von
// `lib/i18n` in `src/mobile` oder `src/viewer` (auch ein mittelbarer, ueber
// irgendein Helfer-Modul) vervierfacht die Seite, die ein Telefon im
// Hallen-WLAN laedt — und zwar unbemerkt, weil nichts kaputtgeht.
//
// Genau deshalb gibt es `lib/i18nLite.ts` und die zwei kleinen
// Woerterbuecher. Diese Pruefung haelt die Grenze: sie folgt den Importen
// beider Eintrittspunkte durch den ganzen Baum und faellt, wenn `lib/i18n`
// oder `lib/i18n/de` darin auftaucht.
// ---------------------------------------------------------------------------

const WURZEL = process.cwd()

const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), 'utf8')

/** Die Ordner unter `src/`, die `tsconfig.app.json` als Browser-Code fuehrt. */
const browserOrdner = (): string[] => {
  const konfig = JSON.parse(lies('tsconfig.app.json')) as { include: string[] }
  return konfig.include.filter((e) => e.startsWith('src/') && !e.endsWith('.ts'))
}

describe('lang:check deckt jeden Browser-Eintrittspunkt', () => {
  it('kennt ueberhaupt Ordner — sonst prueft der Test nichts', () => {
    // Eine leere Liste erfuellt die Regel unten muehelos. Ein Waechter, der
    // bei kaputtem Muster gruen wird, behauptet eine Deckung, die es nicht
    // gibt — dieselbe Zusicherung wie in den anderen Waechtern dieses Repos.
    expect(browserOrdner().length).toBeGreaterThanOrEqual(3)
  })

  it('nennt jeden davon im npm-Skript', () => {
    const pkg = JSON.parse(lies('package.json')) as { scripts: Record<string, string> }
    const skript = pkg.scripts['lang:check'] ?? ''
    const fehlend = browserOrdner().filter((o) => !skript.includes(o))
    expect(
      fehlend,
      `Diese Ordner rendern Oberflaeche, werden aber nicht auf ihre Sprache ` +
        `geprueft — der Waechter waere dort blind und meldete trotzdem 0:\n  ` +
        `${fehlend.join('\n  ')}\n(Skript: ${skript})`,
    ).toEqual([])
  })
})

/**
 * Jedes Modul, das von `start` aus ueber relative Importe erreichbar ist.
 *
 * Bewusst der ganze Graph und nicht nur die erste Zeile der Datei: der teure
 * Import kommt selten direkt: er kommt ueber ein Helfer-Modul, das jemand
 * arglos mitnimmt. `src/mobile` importiert heute schon sechs Module aus
 * `renderer/lib` — genau der Weg, auf dem `lib/i18n` hereinkaeme.
 */
const erreichbar = (start: string): Set<string> => {
  const gesehen = new Set<string>()
  const offen = [resolve(WURZEL, start)]
  const aufloesen = (basis: string, spez: string): string | null => {
    const roh = resolve(dirname(basis), spez)
    for (const kandidat of [roh, `${roh}.ts`, `${roh}.tsx`, join(roh, 'index.ts')]) {
      if (existsSync(kandidat) && /\.tsx?$/.test(kandidat)) return kandidat
    }
    return null
  }
  while (offen.length > 0) {
    const pfad = offen.pop()!
    if (gesehen.has(pfad)) continue
    gesehen.add(pfad)
    const quelle = readFileSync(pfad, 'utf8')
    for (const m of quelle.matchAll(/(?:from|import)\s*['"](\.[^'"]+)['"]/g)) {
      const ziel = aufloesen(pfad, m[1])
      if (ziel) offen.push(ziel)
    }
  }
  return gesehen
}

describe('Die kleinen Eintrittspunkte tragen kein Desktop-Woerterbuch', () => {
  /**
   * Die Registry und der Ordner mit den Woerterbuechern — und NICHT
   * `i18nLite.ts`.
   *
   * Die erste Fassung prueft auf den Praefix `src/renderer/lib/i18n` und
   * meldete damit `i18nLite.ts` als Verstoss: also genau das Modul, das die
   * Grenze herstellt. Ein Waechter, der die Loesung fuer den Defekt haelt,
   * bringt den naechsten Leser dazu, sie wieder auszubauen.
   */
  const schwer = (pfad: string): boolean =>
    pfad === 'src/renderer/lib/i18n.ts' || pfad.startsWith('src/renderer/lib/i18n/')

  for (const [name, start] of [
    ['Mobile-Ansicht', 'src/mobile/main.tsx'],
    ['Viewer', 'src/viewer/main.tsx'],
  ] as const) {
    it(`${name}: kein Weg nach lib/i18n`, () => {
      const module = erreichbar(start)
      // Zusicherung gegen die eigene Aufloesung: findet sie nichts, ist die
      // Regel darunter leer erfuellt.
      expect(module.size, `${start} erreicht keine Module — Aufloesung kaputt?`).toBeGreaterThan(5)

      const treffer = [...module]
        .map((p) => relative(WURZEL, p).split(sep).join('/'))
        .filter(schwer)
      expect(
        treffer,
        `Diese Seite laedt damit das ganze Desktop-Woerterbuch (de.ts, 316 KB) ` +
          `auf ein Geraet, das davon keinen Schluessel zeigt. Das kleine Werk ` +
          `steht in renderer/lib/i18nLite.ts:\n  ${treffer.join('\n  ')}`,
      ).toEqual([])
    })
  }

  it('der Renderer dagegen nutzt das echte Woerterbuch, nicht das kleine Werk', () => {
    // Die Gegenrichtung, und sie ist kein Zierrat: `i18nLite` liefert fuer
    // jeden Schluessel den Fallback. Wer es im Renderer benutzt, bekommt eine
    // Oberflaeche, die beim Sprachwechsel STEHENBLEIBT — und nichts wird rot,
    // weil der Fallback ja ein gueltiger Text ist.
    const module = [...erreichbar('src/renderer/main.tsx')]
      .map((p) => relative(WURZEL, p).split(sep).join('/'))
      .filter((p) => p.endsWith('i18nLite.ts'))
    expect(
      module,
      `i18nLite ist fuer mobile/viewer da. Im Renderer gehoert lib/i18n hin — ` +
        `sonst zeigt die Stelle immer den englischen Fallback, egal welche ` +
        `Sprache eingestellt ist.`,
    ).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Jeder Schluessel hat eine deutsche Fassung — oder ist ausdruecklich als
// „in beiden Sprachen gleich" erklaert.
//
// ─── WARUM DAS EINE EIGENE PRUEFUNG BRAUCHT ────────────────────────────────
//
// Weil `lang:check` diese Luecke NICHT sehen kann. Fehlt ein Schluessel im
// Woerterbuch, zeigt die Seite den englischen Fallback — und der ist eine
// voellig regelkonforme Zeichenkette. Der Sprachmix-Zaehler misst den
// Quelltext, nicht das, was ein deutsches Telefon anzeigt.
//
// Gefunden wurde es genau so, wie es sich sonst nicht finden laesst: die
// gebaute Seite im Browser mit deutscher Spracheinstellung. Zwischen lauter
// deutschen Zeilen stand „.cpviewer or .json" — ein Wort, weil ich beim
// Eintragen geschaetzt hatte, die Zeile sei in beiden Sprachen gleich. Sie
// ist es nicht.
//
// Die Liste unten ist die Umkehr davon: was hier steht, ist eine ERKLAERUNG
// („dieses Wort ist im Deutschen dasselbe"), kein Freibrief. Wer einen
// Schluessel ohne deutsche Fassung anlegt, muss ihn hier hinschreiben und
// dabei hinsehen — dieselbe Form wie die `HARMLOS`-Liste in
// `asciiDrift.test.ts`.
// ---------------------------------------------------------------------------

/** Schluessel, deren deutsche Fassung Wort fuer Wort die englische ist. */
const GLEICH_IN_BEIDEN: Record<string, string> = {
  'mobile.view.plan': 'Plan',
  'mobile.conn.remote': 'Remote',
  'mobile.name': 'Name',
  'mobile.report.kindIssue': 'Problem',
  'mobile.report.optionalPlaceholder': 'optional…',
  'mobile.walk.namePlaceholder': 'Name (optional)',
}

describe('Die Woerterbuecher haben keine stillen Luecken', () => {
  const EINTRITTE = [
    { ordner: 'src/mobile', quellen: ['MobileApp.tsx', 'PatternWalk.tsx'] },
    { ordner: 'src/viewer', quellen: ['ViewerApp.tsx'] },
  ]

  /** Jeder `t('key', 'Source')`-Aufruf einer Seite — Schluessel auf Quelle. */
  const benutzteSchluessel = (ordner: string, quellen: string[]): Map<string, string> => {
    const gefunden = new Map<string, string>()
    for (const datei of quellen) {
      const quelle = lies(`${ordner}/${datei}`)
      for (const m of quelle.matchAll(/\bt\(\s*'([\w.]+)'\s*,\s*(['"])((?:[^\\]|\\.)*?)\2/g)) {
        gefunden.set(m[1], m[3])
      }
      // `BEOBACHTUNGEN` traegt Schluessel und Quelle als Datenfelder, weil der
      // `wert` ueber die Leitung geht und die Beschriftung nicht.
      for (const m of quelle.matchAll(/schluessel:\s*'([\w.]+)',\s*label:\s*'([^']*)'/g)) {
        gefunden.set(m[1], m[2])
      }
    }
    return gefunden
  }

  const uebersetzteSchluessel = (ordner: string): Set<string> =>
    new Set([...lies(`${ordner}/i18n.ts`).matchAll(/^\s*'([\w.]+)':/gm)].map((m) => m[1]))

  for (const { ordner, quellen } of EINTRITTE) {
    it(`${ordner}: findet ueberhaupt Aufrufe — sonst prueft der Test nichts`, () => {
      expect(benutzteSchluessel(ordner, quellen).size).toBeGreaterThan(20)
    })

    it(`${ordner}: jeder Schluessel ist uebersetzt oder erklaert`, () => {
      const uebersetzt = uebersetzteSchluessel(ordner)
      const offen = [...benutzteSchluessel(ordner, quellen)]
        .filter(([k]) => !uebersetzt.has(k) && !(k in GLEICH_IN_BEIDEN))
        .map(([k, quelle]) => `${k} = ${JSON.stringify(quelle)}`)
      expect(
        offen,
        `Ohne deutsche Fassung zeigt die Seite hier den englischen Fallback — ` +
          `mitten in einer sonst deutschen Oberflaeche, und kein Waechter sieht ` +
          `es. Entweder uebersetzen oder in GLEICH_IN_BEIDEN erklaeren:\n  ` +
          `${offen.join('\n  ')}`,
      ).toEqual([])
    })

    it(`${ordner}: kein Eintrag ohne Nutzer`, () => {
      // Ein verwaister Eintrag ist keine Uebersetzung mehr, sondern ein Rest:
      // er sieht beim Lesen aus wie Deckung fuer eine Stelle, die es nicht
      // mehr gibt — dieselbe Regel wie beim Light-Theme-Remap.
      const benutzt = benutzteSchluessel(ordner, quellen)
      const verwaist = [...uebersetzteSchluessel(ordner)].filter((k) => !benutzt.has(k))
      expect(verwaist, `Schluessel im Woerterbuch, die niemand ruft: ${verwaist.join(', ')}`)
        .toEqual([])
    })
  }

  it('die Erklaerungen stimmen mit der Quelle ueberein', () => {
    // GEGENPROBE. Ein Eintrag in GLEICH_IN_BEIDEN behauptet etwas ueber den
    // Quelltext („diese Zeile lautet so"). Aendert jemand die Quelle, ist die
    // Behauptung still falsch — und der Schluessel bliebe unuebersetzt, ohne
    // dass die Pruefung oben etwas merkt.
    const alle = new Map<string, string>()
    for (const { ordner, quellen } of EINTRITTE) {
      for (const [k, v] of benutzteSchluessel(ordner, quellen)) alle.set(k, v)
    }
    const falsch = Object.entries(GLEICH_IN_BEIDEN)
      .filter(([k, text]) => alle.get(k) !== text)
      .map(([k, text]) => `${k}: erklaert ${JSON.stringify(text)}, Quelle ${JSON.stringify(alle.get(k))}`)
    expect(falsch, `Erklaerung passt nicht mehr zur Quelle:\n  ${falsch.join('\n  ')}`).toEqual([])
  })
})
