import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ───────────────────────────────────────────────────────────────────────────
// Die beiden schwebenden Leisten lassen sich schliessen — und wiederfinden.
//
// Nutzer-Meldung 2026-09-11: „Man muss ‚Gerät suchen' und die Leiste wo die
// Ebenen drauf stehen im Cable planner auch schliessen können und über das
// ‚Ansicht' Menü in der oberen Leiste auch wieder öffnen können."
//
// ─── WOGEGEN DIESER LAUF GEBAUT IST ───────────────────────────────────────
//
// Nicht gegen das Schliessen — das ist eine Zeile und faellt beim ersten
// Hinsehen auf, wenn sie fehlt. Sondern gegen die HAELFTE davon: eine Leiste,
// die sich schliessen laesst und deren Weg zurueck jemand vergisst. Der ist
// naemlich unsichtbar. Wer eine geschlossene Leiste sucht und den Menuepunkt
// nicht findet, hat ein Werkzeug verloren und weiss nicht einmal, ob es je
// da war.
//
// Deshalb prueft dieser Lauf PAARWEISE: zu jedem Schliessen gehoert ein
// Eintrag im Ansicht-Menue, und zu jedem Eintrag ein Haken, der seinen
// Zustand zeigt.
//
// ─── WAS ER NICHT KANN ────────────────────────────────────────────────────
//
// Er liest Quelltext. Ob der Knopf im laufenden Fenster wirklich trifft und
// der Menuepunkt die Leiste wirklich zurueckholt, misst er nicht — das tut
// `ui:overflow`/`ui:labels` an der gebauten App, und der Mensch davor.
// ───────────────────────────────────────────────────────────────────────────

const lies = (p: string): string => readFileSync(resolve(__dirname, '..', p), 'utf8')

const store = lies('src/renderer/store/uiStore.ts')
const menu = lies('src/renderer/components/Layout/MenuBar.tsx')
const suche = lies('src/renderer/components/Canvas/CanvasSearch.tsx')
const leiste = lies('src/renderer/components/Canvas/CanvasToolbar.tsx')
const flaeche = lies('src/renderer/components/Canvas/CanvasArea.tsx')

/** Die beiden Leisten, je mit ihrer Flagge und ihrem Setzer. */
const LEISTEN = [
  { was: 'Geräte-Suche', flagge: 'canvasSearchVisible', setzer: 'setCanvasSearchVisible' },
  { was: 'Werkzeugleiste', flagge: 'canvasToolbarVisible', setzer: 'setCanvasToolbarVisible' },
] as const

describe('der Zustand wird gemerkt, nicht nur gehalten', () => {
  for (const { was, flagge, setzer } of LEISTEN) {
    it(`${was}: Flagge, Vorgabe und Setzer stehen im uiStore`, () => {
      expect(store).toContain(`${flagge}: boolean`)
      // Vorgabe SICHTBAR. Eine Leiste, die nach der Installation fehlt, ist
      // keine aufgeraeumte Oberflaeche, sondern eine fehlende Funktion.
      expect(store).toContain(`${flagge}: true,`)
      expect(store).toContain(`${setzer}: (value) => set(applyPatch({ ${flagge}: value }))`)
    })

    it(`${was}: die Flagge liegt im persistierten Teil`, () => {
      // `applyPatch` ist im uiStore der Weg, der schreibt UND speichert. Ein
      // `set({...})` daneben haette denselben Effekt auf dem Bildschirm und
      // waere nach dem Neustart weg — genau der Unterschied, um den es hier
      // geht: wer eine Leiste wegraeumt, will sie nicht wiederfinden.
      const zeile = new RegExp(`${setzer}: \\(value\\) => set\\(applyPatch`)
      expect(zeile.test(store), `${setzer} schreibt nicht ueber applyPatch`).toBe(true)
    })
  }
})

describe('zu jedem Schliessen gehoert ein Weg zurueck', () => {
  for (const { was, flagge, setzer } of LEISTEN) {
    it(`${was}: steht im Ansicht-Menue`, () => {
      // Der Menuepunkt schaltet um (nicht nur ein) — sonst waere er der
      // zweite Weg zum Schliessen und keiner zurueck.
      expect(menu).toContain(`useUiStore.getState().${setzer}(!${flagge})`)
    })

    it(`${was}: der Menuepunkt zeigt seinen Zustand`, () => {
      // Das Haeckchen ist bei einer UNSICHTBAREN Sache der eigentliche
      // Dienst: ohne es sieht „geschlossen" aus wie „gibt es nicht".
      const haken = new RegExp(`${flagge} \\? <Icon icon=\\{Check\\}`)
      expect(haken.test(menu), `${flagge} ohne Haken im Menue`).toBe(true)
    })
  }

  it('die beiden Punkte stehen im Ansicht-Menue und nicht irgendwo', () => {
    const ansicht = menu.slice(
      menu.indexOf("t('app.menu.view'"),
      menu.indexOf("t('app.menu.help'"),
    )
    expect(ansicht.length).toBeGreaterThan(500)
    expect(ansicht).toContain('app.menu.view.canvasSearch')
    expect(ansicht).toContain('app.menu.view.canvasToolbar')
  })
})

describe('die Leisten tragen ihren eigenen Schliessen-Knopf', () => {
  it('die Suche schliesst sich selbst und sagt, wo sie wiederkommt', () => {
    expect(suche).toContain('setVisible(false)')
    // Die Beschriftung nennt den Weg zurueck. Ein blosses „Schliessen"
    // liesse den Nutzer mit einer verschwundenen Leiste allein.
    expect(suche).toContain("'canvas.search.close'")
  })

  it('die Werkzeugleiste auch', () => {
    expect(leiste).toContain('setCanvasToolbarVisible(false)')
    expect(leiste).toContain("'toolbar.close'")
  })

  it('Einklappen und Schliessen sind ZWEI Knoepfe', () => {
    // Der Unterschied ist der Grund fuer die Aenderung: bis 2026-09-11 gab
    // es nur das Einklappen, und eingeklappt stand die Pille weiter da.
    // Ein Knopf, der beides koennte, muesste sich fuer eine Bedeutung
    // entscheiden — und die andere waere wieder weg.
    expect(suche).toContain("'canvas.search.collapse'")
    expect(suche).toContain('setOpen(false)')
  })
})

describe('der Weg ueber die Tastatur ueberlebt das Schliessen', () => {
  it('Strg+F macht die Leiste SICHTBAR und klappt sie auf', () => {
    // Der Fehler, gegen den das steht: nur `setOpen(true)` liesse eine
    // geschlossene Leiste geschlossen, und das Kuerzel taete scheinbar
    // nichts.
    const block = suche.slice(suche.indexOf('e.preventDefault()'))
    const bisFokus = block.slice(0, block.indexOf('inputRef.current?.focus()'))
    expect(bisFokus).toContain('setVisible(true)')
    expect(bisFokus).toContain('setOpen(true)')
  })

  it('die Komponente bleibt gemountet, wenn sie nichts zeichnet', () => {
    // An ihr haengt der Strg+F-Hoerer. Waere sie am Aufrufort ausgehaengt,
    // gaebe es den Weg ueber die Tastatur nicht mehr.
    expect(suche).toContain('if (!visible) return null')
    expect(flaeche).toContain('<CanvasSearch />')
    expect(flaeche).not.toContain('canvasSearchVisible && <CanvasSearch')
  })

  it('Esc klappt ein und schliesst NICHT', () => {
    // Wer die Leiste versehentlich wegdrueckt, soll sie nicht im Menue
    // suchen muessen.
    const esc = suche.slice(suche.indexOf("e.key === 'Escape'"))
    const bisEnde = esc.slice(0, esc.indexOf('}\n    }'))
    expect(bisEnde).toContain('setOpen(false)')
    expect(bisEnde).not.toContain('setVisible(false)')
  })
})

describe('die Suche haengt nicht an einer Leiste, die es nicht mehr gibt', () => {
  it('ohne Werkzeugleiste faellt der gemessene Abstand auf 0 zurueck', () => {
    // Die Suche setzt sich unter die gemessene Unterkante der
    // Werkzeugleiste. Ist die geschlossen, gibt es keine Unterkante — ohne
    // das Zuruecksetzen behielte sie den letzten Wert und staende allein in
    // der Luft.
    const block = suche.slice(suche.indexOf('const [toolbarBottom'))
    const bisDeps = block.slice(0, block.indexOf('}, ['))
    expect(bisDeps).toContain('setToolbarBottom(0)')
  })

  it('die Messung haengt an der Sichtbarkeit der Werkzeugleiste', () => {
    // Ein ResizeObserver auf einem entfernten Element meldet nichts mehr.
    // Ohne diese Abhaengigkeit bliebe die alte Zahl stehen.
    expect(suche).toMatch(/\}, \[open, visible, toolbarVisible\]\)/)
  })
})

describe('zwei Hoerer auf demselben Kuerzel', () => {
  // GEMESSEN am 2026-09-11 im laufenden Fenster (1440x900, Beispielprojekt):
  // Schritt 6 der Messreihe — Suche schliessen, Fokus loeschen, Strg+F —
  // liess die Leiste geschlossen. `Suche=false`. Das Kuerzel tat sichtbar
  // nichts, und zwar genau in dem Moment, in dem es gebraucht wurde: als
  // Weg zurueck aus dem neuen geschlossenen Zustand.
  //
  // Die Ursache lag NICHT in `CanvasSearch`, sondern in einer zweiten Datei:
  // `LocalEquipmentTab` haengt einen eigenen Strg+F-Hoerer an dasselbe
  // `window` und fokussiert damit sein Bibliotheks-Suchfeld. Zwei Hoerer auf
  // einem Kuerzel, und der frueher registrierte gewinnt den Fokus. Der
  // spaetere las danach `document.activeElement`, fand ein INPUT, das vor
  // dem Tastendruck noch nicht dort stand, und hielt das fuer „der Nutzer
  // tippt gerade".
  //
  // Das ist keine Eigenheit dieser beiden Dateien. Es ist die Form: ein
  // Tipp-Schutz, der den Fokus NACH dem Ereignis liest, misst das Ergebnis
  // der anderen Hoerer mit. `e.target` ist die Stelle, an der die Taste
  // wirklich passiert ist, und die verschiebt kein fremder Hoerer.
  //
  // Was dieser Lauf NICHT kann: er liest Quelltext. Dass Strg+F im Fenster
  // wirklich trifft, hat die Messreihe oben gezeigt — nachher stand da
  // `Suche=true`. Hier steht nur, dass die Form erhalten bleibt.

  const bibliothek = lies('src/renderer/components/Library/tabs/LocalEquipmentTab.tsx')

  /**
   * Zeilenkommentare weg — der Rest ist, was laeuft.
   *
   * Ohne das waere die Pruefung unten unbestehbar: der Kommentar im Code
   * NENNT `document.activeElement`, weil er erklaert, warum es dort nicht
   * mehr steht. Ein `not.toContain` ueber den Rohtext faende genau diese
   * Erklaerung und meldete den Fehler, gegen den sie geschrieben ist.
   */
  const ohneKommentare = (t: string): string =>
    t
      .split('\n')
      .filter((z) => !z.trimStart().startsWith('//'))
      .join('\n')

  it('der Tipp-Schutz der Suche liest e.target, nicht den Fokus danach', () => {
    const block = ohneKommentare(
      suche.slice(suche.indexOf("e.key === 'f'"), suche.indexOf('e.preventDefault()')),
    )
    expect(block.length).toBeGreaterThan(50)
    expect(block).toContain('const el = e.target')
    expect(block, 'liest den Fokus NACH dem Ereignis').not.toContain('document.activeElement')
  })

  it('Gegenprobe: der Kommentar nennt die falsche Form weiter beim Namen', () => {
    // Sonst haette das Streichen der Kommentare oben eine zweite Wirkung,
    // die keiner wollte: die Begruendung koennte verschwinden und der Lauf
    // bliebe gruen. Die Erklaerung ist der eigentliche Wert dieser Stelle —
    // die Zeile selbst sieht harmlos aus.
    expect(suche).toContain('document.activeElement')
  })

  it('der zweite Hoerer ist wirklich da — sonst ist die Regel oben Folklore', () => {
    // Faellt dieser Test aus, weil jemand den Bibliotheks-Hoerer entfernt
    // hat, dann ist der Grund fuer die Regel weg und der Kommentar oben
    // erzaehlt von etwas, das es nicht mehr gibt. Dann gehoert beides
    // ueberprueft — nicht einfach der Test geloescht.
    expect(bibliothek).toContain("(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'")
    expect(bibliothek).toContain('e.target')
  })

  it('beide Hoerer messen dasselbe', () => {
    // Zwei Tipp-Schutz-Regeln auf einem Kuerzel, die verschiedene Dinge
    // lesen, sind zwei Rechnungen derselben Frage — und bei genau so einer
    // Abweichung ging das Kuerzel oben verloren.
    for (const [name, datei] of Object.entries({ suche, bibliothek })) {
      expect(datei, `${name} liest nicht e.target`).toContain('e.target')
    }
  })
})

describe('Gegenprobe zum Lauf selbst', () => {
  it('die gelesenen Dateien sind wirklich da', () => {
    // Ein `readFileSync`, das leer zurueckkaeme, machte jedes `toContain`
    // oben zu einer Pruefung gegen den leeren String — rot, aber aus dem
    // falschen Grund, und ein `not.toContain` waere still gruen.
    for (const [name, inhalt] of Object.entries({ store, menu, suche, leiste, flaeche })) {
      expect(inhalt.length, `${name} ist leer`).toBeGreaterThan(1000)
    }
  })

  it('ein Name, den es nicht gibt, wird auch nicht gefunden', () => {
    expect(store).not.toContain('canvasGibtEsNichtVisible')
  })
})
