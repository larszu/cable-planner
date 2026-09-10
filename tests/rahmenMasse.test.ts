import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import menuSrc from '../src/renderer/components/Layout/MenuBar.tsx?raw'
import statusSrc from '../src/renderer/components/Layout/StatusBar.tsx?raw'
import modalSrc from '../src/renderer/components/shared/ModalShell.tsx?raw'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// ADR-007 Abschnitt 6 — der Rahmen, in Zahlen.
//
//   > Damit alle acht Werkzeuge gleich zu bedienen sind, steht der Rahmen
//   > fest. … Kopfzeile 40 px … Statusleiste unten, 24 px.
//
// WARUM DAS EINEN TEST BRAUCHT. Vor dieser Aenderung stand die Hoehe der
// Kopfzeile nirgends: sie ergab sich aus `py-1.5` plus dem hoechsten Kind.
// Das ist keine Zahl, sondern ein Zufall — er aendert sich, sobald jemand
// einen Knopf mit mehr Innenabstand einbaut, und niemand merkt es. Genau so
// laufen acht Werkzeuge auseinander, die „eigentlich gleich" aussehen sollen.
//
// Der Test misst die CSS-Klasse und nicht das Markup. Das ist Absicht: eine
// Utility (`h-10`) am Element waere dieselbe Zahl, aber keine Regel — sie
// stuende an einer Stelle und liesse sich beim naechsten Umbau still
// zuruecksetzen. Eine benannte Klasse ist eine Zusage.
//
// GEGENGEPROBT: Hoehe in `.cp-topbar` auf 44 px geaendert -> rot; `cp-topbar`
// im MenuBar durch die alte Utility-Kette ersetzt -> rot; `shadow-2xl` am
// Dialog wieder eingesetzt -> rot.
// ---------------------------------------------------------------------------

const css = readFileSync(resolve(__dirname, '..', 'src', 'renderer', 'index.css'), 'utf8')

/** Der Rumpf einer Klasse aus `index.css` — ohne Kommentare. */
const regel = (klasse: string): string => {
  const m = new RegExp(`\\.${klasse}\\s*\\{([^}]*)\\}`).exec(stripComments(css))
  expect(m, `Regel .${klasse} fehlt in index.css`).not.toBeNull()
  return m![1]
}

describe('ADR-007 Abschnitt 6: der Rahmen steht fest', () => {
  it('die Kopfzeile ist 40 px hoch', () => {
    expect(regel('cp-topbar')).toMatch(/height:\s*40px/)
  })

  it('die Statusleiste ist 24 px hoch — plus die sichere Zone des Geraets', () => {
    // ERWEITERT am 2026-09-10, nicht gelockert: geprueft werden jetzt ZWEI
    // Dinge statt einem.
    //
    // Die Zahl aus ADR-007 steht unveraendert da. Dazu kommt die sichere
    // Zone: `index.html` sagt `viewport-fit=cover`, die Seite laeuft also
    // bis unter den Griffbereich des Telefons, und die Statusleiste ist das
    // unterste Element. Mit flachen 24 px lag ihre Schrift dort unter dem
    // Home-Balken — gemeldet am 2026-09-10 als „die Statuszeile ist
    // abgeschnitten".
    //
    // `env(safe-area-inset-bottom)` ist ueberall dort 0, wo das Geraet
    // nichts fuer sich beansprucht: auf dem Schreibtisch bleibt die Leiste
    // also exakt 24 px, und das Rahmenmass von ADR-007 gilt unveraendert.
    // Der zweite Ausdruck haelt fest, dass die Zone auch wirklich
    // freigehalten und nicht nur dazugerechnet wird.
    expect(regel('cp-statusbar')).toMatch(
      /height:\s*calc\(24px \+ env\(safe-area-inset-bottom\)\)/,
    )
    expect(regel('cp-statusbar')).toMatch(/padding-bottom:\s*env\(safe-area-inset-bottom\)/)
  })

  it('beide sind unnachgiebig — sie schrumpfen nicht mit', () => {
    // `flex: none` statt `shrink-0`: ohne das gibt eine volle Arbeitsflaeche
    // der Kopfzeile Pixel weg, und die feste Zahl waere wieder keine.
    expect(regel('cp-topbar')).toMatch(/flex:\s*none/)
    expect(regel('cp-statusbar')).toMatch(/flex:\s*none/)
  })

  it('die Kopflinie eines Dialogs ist der Akzent', () => {
    // „Kopflinie oben" — eine LINIE, kein Balken in Akzentfarbe. Deshalb
    // border-bottom und kein background.
    const kopf = regel('cp-panel-head')
    expect(kopf).toMatch(/border-bottom:\s*1px solid var\(--cp-accent\)/)
    expect(kopf).not.toMatch(/background/)
  })

  it('Kopfzeile, Statusleiste und Dialogkopf benutzen die Klassen wirklich', () => {
    // Eine Regel, die niemand anwendet, ist Dekoration in einer CSS-Datei.
    expect(stripComments(menuSrc)).toMatch(/<header className="cp-topbar/)
    expect(stripComments(statusSrc)).toMatch(/<footer className="cp-statusbar/)
    expect(stripComments(modalSrc)).toMatch(/className="cp-panel-head/)
  })

  it('Dialoge sind Flaechen, keine Karten — kein Schatten', () => {
    // „Dialoge sind Flaechen, keine Karten: kein Radius, kein Schatten."
    // Der Radius liegt bereits bei 0 (Token-Schicht); der Schatten stand
    // noch am Panel.
    expect(stripComments(modalSrc)).not.toMatch(/shadow-2xl|shadow-xl|shadow-lg/)
  })
})
