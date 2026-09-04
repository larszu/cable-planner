// ───────────────────────────────────────────────────────────────────────────
// Jeder Pruef-Lauf aus `package.json` faehrt auch in CI — oder hat hier einen
// Grund stehen.
//
// WARUM ES DAS GIBT. `light-planner` hatte am 2026-09-04 einen Guard
// (`mvr:check`), der existierte, gruen war und bei keinem Merge lief. Sein
// `ci-runs-every-check.ts` fand das und verhindert es seither dort. Hier gab es
// diese Pruefung nicht — gemessen standen `ui:smoke` und `test:drag` in
// `package.json` und in `CLAUDE.md`, aber in keinem Workflow.
//
// Ein Guard, den niemand faehrt, ist keine Zusicherung, sondern eine Notiz. Und
// er ist schlimmer als gar keiner: er steht in der Doku, jemand liest ihn als
// „das ist abgesichert", und niemand merkt, dass die Absicherung nie ausgeloest
// wurde.
//
// WIE ER PRUEFT. Die Liste der Laeufe kommt aus `package.json`, nicht aus einer
// Aufzaehlung hier — sonst waere genau diese Datei die Liste, die veraltet.
// Ausnahmen stehen mit BEGRUENDUNG in `OHNE_CI`; eine Ausnahme ohne Text
// zaehlt nicht, und eine Ausnahme fuer ein Skript, das es nicht mehr gibt,
// faellt ebenfalls auf. Damit ist „laeuft nicht in CI" eine sichtbare
// Entscheidung statt eines Versehens.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const skripte = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}).scripts

/**
 * Was als Pruef-Lauf zaehlt. Bewusst ueber die Form des Namens und nicht ueber
 * eine Liste: `foo:check` von morgen faellt hier auf, ohne dass jemand diese
 * Datei kennt.
 */
const istPruefung = (name: string): boolean =>
  name === 'lint' || name === 'test' || /(^|:)(check|smoke)$/.test(name) || /^test:/.test(name)

/**
 * Laeufe, die absichtlich NICHT in CI stehen. Der Text ist Pflicht — er ist
 * der ganze Zweck dieser Tabelle.
 */
const OHNE_CI: Record<string, string> = {
  'test:watch': 'Interaktiver Watch-Modus. In CI waere er ein Lauf, der nie endet.',
  'test:drag':
    'Braucht einen laufenden `dev:renderer` auf localhost:5173 und einen echten Browser. ' +
    'Ein CI-Job dafuer muesste den Dev-Server hochfahren und wieder abraeumen; bis jemand das baut, ' +
    'ist der Lauf ein Werkzeug fuer die Hand, keine Zusicherung.',
  'ui:smoke':
    'Startet die GEBAUTE Electron-App und braucht dafuer `npm run build`, fuer Electron gebaute ' +
    'native Module und unter Linux `xvfb-run`. Das ist ein eigener, langsamer Job — er gehoert in CI, ' +
    'aber als bewusste Erweiterung mit Zeitbudget, nicht nebenbei. Backlog-Punkt, kein Versehen.',
}

const workflows = (): string => {
  const verzeichnis = join(ROOT, '.github', 'workflows')
  return readdirSync(verzeichnis)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) => readFileSync(join(verzeichnis, f), 'utf8'))
    .join('\n')
}

describe('CI faehrt jede Pruefung', () => {
  const alle = Object.keys(skripte).filter(istPruefung).sort()
  const yml = workflows()

  it('findet ueberhaupt Pruef-Laeufe und Workflows', () => {
    // Ein leerer Suchlauf ist gruen und wertlos; der haeufigste Weg dorthin ist
    // ein umbenanntes Verzeichnis.
    expect(alle.length).toBeGreaterThan(3)
    expect(yml.length).toBeGreaterThan(200)
  })

  it('jeder Lauf steht im Workflow oder hat eine begruendete Ausnahme', () => {
    const fehlend = alle.filter((n) => !yml.includes(`npm run ${n}`) && !(n in OHNE_CI))
    expect(
      fehlend,
      'Diese Pruef-Laeufe stehen in package.json, aber in keinem Workflow. Entweder ' +
        'als Schritt in .github/workflows/ eintragen — oder hier in OHNE_CI mit Grund.',
    ).toEqual([])
  })

  it('jede Ausnahme nennt einen Grund und gilt einem Lauf, den es gibt', () => {
    for (const [name, grund] of Object.entries(OHNE_CI)) {
      expect(skripte[name], `OHNE_CI nennt "${name}", das Skript gibt es nicht mehr`).toBeDefined()
      expect(grund.trim().length, `OHNE_CI["${name}"] ohne Begruendung`).toBeGreaterThan(40)
    }
  })

  it('keine Ausnahme fuer einen Lauf, der doch in CI steht', () => {
    // Sonst bliebe eine Ausnahme stehen, nachdem jemand den Lauf eingetragen
    // hat — und der naechste Leser haelt ihn weiter fuer ungeprueft.
    const ueberfluessig = Object.keys(OHNE_CI).filter((n) => yml.includes(`npm run ${n}`))
    expect(ueberfluessig).toEqual([])
  })
})
