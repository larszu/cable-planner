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

/** Ruft eine Maschine, die Werte erfindet — KI oder Web-Ableitung. */
const CALLS_MACHINE = /suggestFromAI|suggestFromWeb|completeWithAI|generatePlanFromPrompt/

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
      'Bietet KI, Web und Heuristik als Quelle fuer Port-Gruppen — keine davon ' +
      'ist ein Datenblatt. Alle drei setzen jetzt `groupsOrigin`, und ' +
      '`buildTemplate` traegt es als `specSource` in die Vorlage. Der Web-Weg ' +
      'bewahrt zusaetzlich Fundstelle und Textschnipsel: er hatte sie als ' +
      'einziger und warf sie vorher in eine Statusmeldung. Bei einer Vorlage ' +
      'wiegt das schwerer als bei einem Geraet — jedes daraus erzeugte erbt ' +
      'die geratenen Ports.',
  },
  {
    file: 'components/Rentman/NewRentmanDeviceWizard.tsx',
    verdict: 'mensch-dazwischen',
    reason:
      'Baut sein Template aus (teils KI-)Hinweisen, aber der Nutzer prueft und ' +
      'bearbeitet sie Geraet fuer Geraet, bevor gespeichert wird. Die ' +
      'schwaechste der Formen — ein Mensch bestaetigt. Steht hier, weil das ' +
      'Kriterium bewusst zu breit faengt.',
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
  it('alle drei Vorschlagswege setzen eine Herkunft', async () => {
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    for (const key of ['library.origin.ai', 'library.origin.web', 'library.origin.heuristic']) {
      expect(src, key).toContain(key)
    }
  })

  it('der Web-Weg bewahrt Fundstelle UND Schnipsel', async () => {
    // Der Punkt: er hatte beides als einziger und warf es weg. Ein blosses
    // „aus dem Web" waere kein Beleg, sondern nur ein Etikett.
    const src = (await import('../src/renderer/components/Library/LibraryPanel.tsx?raw')).default
    expect(src).toMatch(/\{ source, snippet: snippet/)
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
