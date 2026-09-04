// ───────────────────────────────────────────────────────────────────────────
// `docs/architecture.md` ist Pflicht-Lektuere vor strukturellen Aenderungen.
// Genau deshalb sind falsche Aussagen dort teurer als anderswo: wer sie liest,
// liest sie STATT in den Code zu sehen.
//
// Drei gemessene Befunde (2026-09-04):
//
//   (a) „mobileShareServer startet Express" — zweimal, im ASCII-Diagramm und
//       im Prosa-Abschnitt, und zusaetzlich in `CLAUDE.md`. Die App hat kein
//       Web-Framework in den Dependencies; `mobileShareServer.ts` nutzt
//       `node:http`. Wer Express erwartet, sucht Middleware, Router und
//       `app.use` — und findet nichts davon.
//   (b) „`@julusian/freetype2` (transitiv via Three)". Er kommt via
//       `atem-connection`. Die falsche Herkunft ist keine Kleinigkeit: sie
//       legt nahe, dass ein Three-Update den nativen Rebuild betrifft.
//   (c) Invariante 7 lautete „Three.js-Imports nur in `components/Rack/`".
//       `lib/exportRack.ts` importiert Three und tat das schon damals. Der
//       Satz war ausserdem in der Sache irrefuehrend — was den Bundle klein
//       haelt, ist die Lazy-Grenze, nicht der Import-Ort.
//
// WAS DIESER TEST NICHT PRUEFT: die Doku als ganze. Er prueft die drei
// Aussagen, die sich gegen den Code rechnen lassen — und (c) als Regel ueber
// ALLE Three-Importe statt ueber die zwei bekannten Dateien.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')
const doku = readFileSync(join(ROOT, 'docs', 'architecture.md'), 'utf8')
const paket = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

describe('die Doku nennt keine Abhaengigkeit, die es nicht gibt', () => {
  it('Express steht weder im package.json noch als Behauptung in der Doku', () => {
    // Beide Richtungen, damit die Aussage nicht einseitig veraltet: kaeme
    // Express je dazu, muesste die „kein Express"-Klammer wieder weg.
    const hatExpress = Boolean(paket.dependencies?.express || paket.devDependencies?.express)
    expect(hatExpress, 'Express ist neu dabei — dann stimmt die Doku-Klammer nicht mehr.').toBe(false)
    expect(doku, 'Die Doku behauptet wieder Express.').not.toMatch(/startet Express/)
  })

  it('freetype2 wird nicht Three zugeschrieben', () => {
    // Er ist keine direkte Abhaengigkeit; die Herkunft steht in
    // `atem-connection`. Eine falsche Herkunftsangabe schickt den naechsten
    // Leser beim naechsten nativen Rebuild in die falsche Richtung.
    expect(paket.dependencies?.['@julusian/freetype2']).toBeUndefined()
    expect(doku).not.toMatch(/freetype2[^\n]*transitiv via Three/)
    expect(doku).toMatch(/freetype2[^\n]*atem-connection/)
  })
})

describe('Invariante 7 sagt, was gilt', () => {
  /** Alle Renderer-Dateien, die Three (oder R3F) importieren — gemessen, nicht gelistet. */
  const dreiImporte = (): string[] => {
    const treffer: string[] = []
    const lauf = (verzeichnis: string) => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag)
        if (statSync(pfad).isDirectory()) {
          lauf(pfad)
          continue
        }
        if (!/\.tsx?$/.test(eintrag)) continue
        const inhalt = readFileSync(pfad, 'utf8')
        if (/from\s+['"](three|three-stdlib|@react-three\/[^'"]+)['"]/.test(inhalt)) {
          treffer.push(relative(join(ROOT, 'src', 'renderer'), pfad))
        }
      }
    }
    lauf(join(ROOT, 'src', 'renderer'))
    return treffer.sort()
  }

  it('es gibt Three-Importe ausserhalb von components/Rack/ — die Invariante darf das nicht leugnen', () => {
    const aussen = dreiImporte().filter((p) => !p.startsWith(join('components', 'Rack')))
    // Der Befund ist nicht „es gibt sie", sondern „die Doku behauptete das
    // Gegenteil". Solange es welche gibt, darf der Satz „nur in
    // components/Rack/" nicht dastehen.
    if (aussen.length > 0) {
      expect(
        doku,
        `Three wird auch ausserhalb von components/Rack/ importiert (${aussen.join(', ')}) — ` +
          'die Invariante darf nicht „Imports nur in components/Rack/" behaupten.',
      ).not.toMatch(/Three\.js-Imports nur in/)
    }
    // Und die heute geltende Formulierung nennt das, was tatsaechlich schuetzt.
    expect(doku).toMatch(/Three\.js bleibt hinter der Lazy-Grenze/)
  })

  it('die genannte Ausnahme ist noch die richtige', () => {
    // `lib/exportRack.ts` ist der einzige Three-Import ausserhalb von `Rack/`.
    // Kaeme ein zweiter dazu, waere die Erklaerung in der Invariante unvollstaendig.
    const aussen = dreiImporte().filter((p) => !p.startsWith(join('components', 'Rack')))
    expect(aussen).toEqual([join('lib', 'exportRack.ts')])
  })
})

describe('jede IPC-Domaene ist irgendwo beschrieben', () => {
  // Der Renderer kann nichts ausserhalb dieser Kanaele. Eine Domaene, die
  // nirgends beschrieben ist, ist eine Faehigkeit, von der nur erfaehrt, wer
  // `src/main/ipc/` durchblaettert -- gemessen 2026-09-04 traf das auf
  // `documentLog` zu (das Register der ausgegebenen Dokumente aus ADR-004).
  //
  // Die Liste kommt aus dem Dateisystem, nicht aus einer Aufzaehlung: eine
  // niedergeschriebene Liste waere am Tag ihrer Entstehung vollstaendig und am
  // naechsten nicht mehr -- genau so ist die Luecke ueberhaupt entstanden.
  const domaenen = readdirSync(join(ROOT, 'src', 'main', 'ipc'))
    .filter((f) => f.endsWith('Ipc.ts'))
    .map((f) => f.replace(/Ipc\.ts$/, ''))
    .sort()

  it('es gibt ueberhaupt Domaenen', () => {
    expect(domaenen.length).toBeGreaterThan(10)
  })

  it('keine Domaene fehlt in README oder architecture.md', () => {
    // Nutzerseitige Domaenen gehoeren ins README, infrastrukturelle in die
    // Architektur-Doku. Welche wohin, entscheidet der Mensch; der Test verlangt
    // nur, dass sie ueberhaupt irgendwo steht.
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8').toLowerCase()
    const arch = doku.toLowerCase()
    const fehlend = domaenen.filter((d) => {
      const n = d.toLowerCase()
      return !readme.includes(n) && !arch.includes(n)
    })
    expect(
      fehlend,
      'Diese IPC-Domaenen sind nirgends beschrieben. Nutzerseitiges ins README, ' +
        'Infrastruktur in die IPC-Tabelle von docs/architecture.md.',
    ).toEqual([])
  })
})
