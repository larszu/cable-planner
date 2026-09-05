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
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/**
 * Diese Datei laeuft auch in der vendorierten Kopie unter
 * `av-planner-suite/apps/cable-planner/`. Dort gibt es KEIN `ci.yml` — die
 * Suite faehrt die Tests der Kopie ueber `npm run test --workspaces`, und
 * verschachtelte `.github/workflows/` sind im Monorepo ohnehin inert.
 *
 * Der Unterschied wird gemessen, nicht geraten: vendoriert ist die Kopie dann,
 * wenn ein Elternverzeichnis eine `package.json` mit `workspaces` hat, unter
 * die dieses Verzeichnis faellt. Und er fuehrt NICHT zu einem stillen
 * Ueberspringen — in der Kopie wird stattdessen geprueft, dass die Suite die
 * Tests dieses Workspace ueberhaupt faehrt. Ein Guard, der sich in der Kopie
 * einfach abschaltet, waere genau der Fehler, gegen den er gebaut ist.
 */
const suiteWurzel = ((): string | null => {
  let verzeichnis = dirname(ROOT)
  for (let i = 0; i < 4; i++) {
    const pj = join(verzeichnis, 'package.json')
    if (existsSync(pj)) {
      const inhalt = JSON.parse(readFileSync(pj, 'utf8')) as { workspaces?: string[] }
      const muster = inhalt.workspaces ?? []
      const rel = relative(verzeichnis, ROOT).split(/[\\/]/)[0]
      if (muster.some((m) => m.split('/')[0] === rel)) return verzeichnis
    }
    const oben = dirname(verzeichnis)
    if (oben === verzeichnis) break
    verzeichnis = oben
  }
  return null
})()
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
}

/**
 * Der Workflow-Text OHNE reine Kommentarzeilen.
 *
 * Gemessen 2026-09-05: ein Kommentar, der `npm run actions:check` bloss
 * ERWAEHNT, hat diesen Guard zufriedengestellt -- der Lauf stand nirgends als
 * Schritt und waere bei keinem Merge gefahren. Genau die Zusicherung, die
 * dieser Test geben soll, war damit von einem Satz Prosa zu haben. Ein Guard,
 * den ein Kommentar besaenftigt, ist keiner.
 *
 * Nur ganze Kommentarzeilen fallen weg; ein `#` mitten in einer Zeile bleibt
 * stehen (es steckt in URLs und in Shell-Zeilen, und ein zu eifriges
 * Wegschneiden waere die naechste stille Fehlerquelle).
 */
const workflowsAus = (wurzel: string): string => {
  const verzeichnis = join(wurzel, '.github', 'workflows')
  if (!existsSync(verzeichnis)) return ''
  return readdirSync(verzeichnis)
    .filter((f) => /\.ya?ml$/.test(f))
    .map((f) =>
      readFileSync(join(verzeichnis, f), 'utf8')
        .split('\n')
        .filter((zeile) => !/^\s*#/.test(zeile))
        .join('\n'),
    )
    .join('\n')
}

describe.skipIf(suiteWurzel !== null)('CI faehrt jede Pruefung (eigenes Repo)', () => {
  const alle = Object.keys(skripte).filter(istPruefung).sort()
  const yml = workflowsAus(ROOT)

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

describe.skipIf(suiteWurzel === null)('CI faehrt jede Pruefung (vendorierte Kopie)', () => {
  // Hier gibt es kein eigenes `ci.yml`. Statt sich abzuschalten, prueft der
  // Guard, was in dieser Lage die tatsaechliche Zusicherung ist: dass die
  // Suite die Tests dieses Workspace ueberhaupt faehrt.
  it('die Suite faehrt die Tests dieses Workspace', () => {
    const yml = workflowsAus(suiteWurzel!)
    expect(yml.length, 'Die Suite hat keine Workflows — dann faehrt hier gar nichts.').toBeGreaterThan(200)
    expect(
      /npm run test --workspaces/.test(yml),
      'Die Suite-CI faehrt `npm run test --workspaces` nicht — die Tests dieser Kopie liefen dann bei keinem Merge.',
    ).toBe(true)
  })

  it('und die Suite prueft ihre eigene Guard-Liste', () => {
    // Das Gegenstueck zu diesem Test auf Suite-Ebene ist `npm run ci:complete`.
    // Gibt es das nicht mehr, faellt die Kette hier auf.
    const suitePaket = JSON.parse(readFileSync(join(suiteWurzel!, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    expect(suitePaket.scripts?.['ci:complete']).toBeDefined()
  })
})
