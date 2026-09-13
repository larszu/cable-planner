import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Die zweite Sorte unbestaetigter Werte — und warum sie eine eigene Liste
// braucht.
//
// `tests/deviceReadSites.test.ts` haelt die Stellen fest, an denen ein
// GERAETE-BEFUND in den Plan geschrieben wird. Diese Datei haelt die andere
// Sorte fest: einen Wert, den weder ein Geraet gemeldet noch ein Mensch
// geplant hat, sondern den eine Maschine GERATEN hat — aus einem
// Geraetenamen, einer Beschreibung oder einem Wikipedia-Schnipsel.
//
// WARUM GERECHNET UND NICHT AUFGEZAEHLT. Ich habe diese Stellen zweimal
// hintereinander falsch im Kopf gehabt. Erst waren es „die drei" —
// `PortAiSuggestButton`, `AiPlanGenDialog`, `NewRentmanDeviceWizard`. Die
// Messung ergab eine vierte, die ich nicht kannte: `LibraryPanel`. Und die
// brachte eine ganze Quelle mit, an die ich nicht gedacht hatte —
// `suggestFromWeb`, das Ports aus einem Wikipedia-/DuckDuckGo-Schnipsel
// zaehlt.
//
// Mein erster grep sammelte zusaetzlich `IntegrationsTab` ein, weil er nach
// dem Import-Pfad suchte statt nach dem Aufruf; die Datei verwaltet nur
// Schluessel. Zu weit, zu eng, wieder zu weit — dreimal an einem Tag.
//
// Eine Liste, die man aufschreibt, ist der Kenntnisstand ihres Autors. Eine,
// die aus dem Quelltext gerechnet wird, ist der Zustand des Programms.
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')

/**
 * Ruft eine Maschine, die Werte erfindet — KI oder Web-Ableitung.
 *
 * `felderAusfuellen` steht seit #858 mit drin, und das ist kein Zusatz,
 * sondern die Bedingung dafuer, dass dieser Lauf ueberhaupt noch etwas
 * sieht: der eine Ausfuellen-Knopf ruft nicht mehr `suggestFromAI` oder
 * `suggestFromWeb` direkt, sondern die Weiche darueber. Ohne diese Zeile
 * faenden drei der vier eingeordneten Dateien nicht mehr statt — der
 * Waechter waere gruen, weil er nichts mehr FINDET, und genau diese Form von
 * Gruen ist die gefaehrlichste.
 *
 * `suggestPortGroups` steht NICHT mehr drin: die Heuristik ist mit #858
 * ersatzlos entfernt (siehe `lib/portSuggestions.ts`). Sie hier stehen zu
 * lassen waere ein Muster, das nie wieder trifft — und das sieht aus wie
 * Abdeckung.
 */
const CALLS_MACHINE =
  /felderAusfuellen|suggestFromAI|suggestFromWeb|completeWithAI|generatePlanFromPrompt/

/** Beruehrt den Projekt-Store. Bewusst grob, wie beim Geraete-Register. */
const TOUCHES_PLAN = /useProjectStore|projectStore/

type Verdict =
  /** Der geratene Wert landet im Plan und traegt seine Herkunft mit. */
  | 'markiert'
  /** Der geratene Wert landet im Plan OHNE Herkunft — offene Luecke. */
  | 'ungedeckt'
  /** Ein Mensch prueft und bearbeitet, bevor etwas in den Plan geht. */
  | 'mensch-dazwischen'

interface Site {
  file: string
  verdict: Verdict
  reason: string
}

const CLASSIFIED: Site[] = [
  {
    file: 'components/Properties/sections/PortAiSuggestButton.tsx',
    verdict: 'markiert',
    reason:
      'cable#650: ein Klick leitete Ports aus dem Geraetenamen ab und brachte ' +
      'Pruefung 18 zum Schweigen. Traegt jetzt `specSource`, und die Pruefung ' +
      'kennt den geratenen Fall.',
  },
  {
    file: 'components/Project/AiPlanGenDialog.tsx',
    verdict: 'markiert',
    reason:
      'cable#651: fuegt einen GANZEN generierten Plan ein. Die Geraete tragen ' +
      'ihre Herkunft; ob ein erfundenes KABEL eine tragen soll, ist bewusst ' +
      'offen (siehe planGeneration.ts) und gehoert dem Eigentuemer.',
  },
  {
    file: 'components/Library/LibraryPanel.tsx',
    verdict: 'markiert',
    reason:
      'Der eine Ausfuellen-Knopf (#858) holt Port-Gruppen aus Web ODER Modell — ' +
      'keine davon ist ein Datenblatt. Beide setzen `groupsOrigin`, und ' +
      '`buildTemplate` traegt es als `specSource` in die Vorlage. Der Web-Weg ' +
      'bewahrt zusaetzlich Fundstelle und Textschnipsel: er hatte sie als ' +
      'einziger und warf sie vorher in eine Statusmeldung. Seit #858 gibt es ' +
      'hier einen dritten Weg in dieselbe Vorlage — das Abschreiben von einer ' +
      'vorhandenen (`library.origin.preset`); auch der traegt seine Herkunft, ' +
      'weil sonst geratene Ports beim Kopieren zu Tatsachen wuerden. Bei einer ' +
      'Vorlage wiegt das schwerer als bei einem Geraet — jedes daraus erzeugte ' +
      'erbt die geratenen Ports.',
  },
  {
    file: 'components/Rentman/NewRentmanDeviceWizard.tsx',
    verdict: 'mensch-dazwischen',
    reason:
      'Baut sein Template aus (teils KI-)Hinweisen, aber der Nutzer prueft und ' +
      'bearbeitet sie Geraet fuer Geraet, bevor gespeichert wird. Die ' +
      'schwaechste der Formen — ein Mensch bestaetigt. Bis #858 war sie ' +
      'schwaecher als das: die Heuristik lief bei JEDEM Schrittwechsel ohne ' +
      'Klick und fuellte die Gruppen, und weil sie nie leer lieferte, stand ' +
      'immer etwas da. Wer es uebersah, bestaetigte Erfundenes. Jetzt beginnt ' +
      'jedes Geraet leer.',
  },
]

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(entry) ? [full] : []
  })

const measured = (): string[] =>
  walk(RENDERER)
    .filter((f) => {
      const src = readFileSync(f, 'utf8')
      return CALLS_MACHINE.test(src) && TOUCHES_PLAN.test(src)
    })
    .map((f) => relative(RENDERER, f).split(sep).join('/'))
    .sort()

describe('jede Stelle, an der eine Maschine Plan-Werte erfindet, ist eingeordnet', () => {
  it('kennt genau die gemessenen Dateien', () => {
    expect(measured()).toEqual(CLASSIFIED.map((s) => s.file).sort())
  })

  it('benennt die offenen Luecken, statt sie zu verschweigen', () => {
    // ADR-005 Regel 3 — melden, wo es passiert. Die Liste war nicht leer:
    // `LibraryPanel` stand hier, bis der Beleg dort aufbewahrt wurde. Sie
    // bleibt der Ort, an dem die naechste Luecke sichtbar wird.
    const offen = CLASSIFIED.filter((s) => s.verdict === 'ungedeckt').map((s) => s.file)
    expect(offen).toEqual([])
  })

  it('gibt zu jeder Einordnung eine Begruendung, die etwas behauptet', () => {
    for (const s of CLASSIFIED) expect(s.reason.length, s.file).toBeGreaterThan(80)
  })
})

describe('die Library-Vorlage traegt ihre Herkunft', () => {
  it('jeder Weg in die Vorlage setzt eine Herkunft', async () => {
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    // Drei Wege, drei Belege. `library.origin.heuristic` steht hier nicht
    // mehr: die Heuristik ist mit #858 entfernt. `library.origin.preset` ist
    // der neue dritte — das Abschreiben von einer vorhandenen Vorlage.
    for (const key of ['library.origin.ai', 'library.origin.web', 'library.origin.preset']) {
      expect(src, key).toContain(key)
    }
  })

  it('die Heuristik ist weg, und zwar ueberall', async () => {
    // Die Gegenprobe zur Zeile darueber. Ein entfernter Knopf, dessen
    // Rechenweg im Programm bleibt, ist kein entfernter Rechenweg — der
    // naechste Aufruf findet ihn wieder.
    const lib = (await import('../src/renderer/lib/portSuggestions.ts?raw')).default
    expect(lib).not.toContain('export const suggestPortGroups')
    for (const datei of [
      '../src/renderer/components/Library/LibraryPanel.tsx?raw',
      '../src/renderer/components/Rentman/NewRentmanDeviceWizard.tsx?raw',
    ]) {
      const src = (await import(/* @vite-ignore */ datei)).default as string
      expect(src, datei).not.toContain('suggestPortGroups(')
    }
  })

  it('der Web-Weg bewahrt Fundstelle UND Schnipsel', async () => {
    // Der Punkt: er hatte beides als einziger und warf es weg. Ein blosses
    // „aus dem Web" waere kein Beleg, sondern nur ein Etikett.
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    expect(src).toMatch(/source: ergebnis\.fundstelle/)
    expect(src).toMatch(/snippet: \(ergebnis\.schnipsel \?\? ''\)/)
  })

  it('die Vorlage bekommt die Herkunft, nicht nur der Dialog', async () => {
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    expect(src).toContain('groupsOrigin && (inputs.length > 0 || outputs.length > 0)')
  })

  it('ein Zuruecksetzen loescht die Herkunft mit', async () => {
    // Sonst truege die naechste, von Hand gebaute Vorlage den Beleg der
    // vorherigen — eine Herkunft, die nie stattgefunden hat.
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    expect(src).toContain('setGroupsOrigin(null)')
  })
})

describe('die Messung selbst', () => {
  it('findet die Stelle, die ich nicht im Kopf hatte', () => {
    // Die Gegenprobe zur Begruendung oben: `LibraryPanel` fehlte in meiner
    // aufgeschriebenen Liste vollstaendig.
    expect(measured()).toContain('components/Library/LibraryPanel.tsx')
  })

  it('nimmt eine Datei NICHT mit, die nur Schluessel verwaltet', () => {
    // `IntegrationsTab` importiert aus `aiSuggestions` die Schluessel-
    // Verwaltung und fasst den Store an — ruft aber keine erfindende
    // Funktion. Ein grober Griff nach dem Import-Pfad hatte sie
    // faelschlich eingesammelt; das Kriterium fragt nach dem AUFRUF.
    //
    // Damit ist es dreimal an einem Tag passiert, dass ein ad-hoc-grep in
    // dieser Gegend zu weit oder zu eng griff. Genau deshalb steht die
    // Liste hier nicht als Aufzaehlung, sondern als Rechnung.
    expect(measured()).not.toContain('components/Settings/tabs/IntegrationsTab.tsx')
  })

  it('faengt auch die Web-Ableitung, nicht nur die KI', () => {
    // `suggestFromWeb` zaehlt Stecker-Woerter in einem Wikipedia-/DDG-
    // Schnipsel. Das ist keine KI, aber genauso geraten — und ohne diesen
    // Teil des Musters faele `LibraryPanel` je nach Aufruf durchs Raster.
    expect(CALLS_MACHINE.test('const x = await suggestFromWeb(a, b)')).toBe(true)
  })
})
