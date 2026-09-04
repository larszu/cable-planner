// ───────────────────────────────────────────────────────────────────────────
// Jedes Dokument unter `docs/` ist von einer Einstiegsseite aus erreichbar.
//
// WARUM ES DAS GIBT. Gemessen 2026-09-04: von dreizehn Dokumenten in `docs/`
// waren ZWÖLF von keiner Einstiegsseite aus verlinkt — README, CLAUDE.md,
// CONTRIBUTING, TESTING, SECURITY nannten sie nicht, und untereinander
// verlinkten sie sich auch nicht. Darunter `self-hosted-relay.md`: ausgerechnet
// die Seite, die jemand sucht, wenn die Live-Zusammenarbeit über Mobilfunk
// nicht zustande kommt.
//
// Das ist dieselbe Form wie der Sprachschalter, der existierte, aber in einer
// nie gerenderten Datei lag (B-13): die Sache ist da, sie ist sorgfältig
// gemacht, und sie liegt außerhalb des Weges, der zu ihr führt. Ein Dokument,
// das nur findet, wer den Ordner durchblättert, ist praktisch nicht vorhanden.
//
// WIE ER PRUEFT. Nicht „steht jedes Dokument im Index" — dann wäre der Index
// selbst die Liste, die veraltet. Er läuft den LINK-GRAPHEN von den
// Einstiegsseiten aus ab: ein Dokument zählt als erreichbar, wenn irgendein
// erreichbares Dokument darauf verlinkt. Ein neuer Unterordner mit eigener
// Index-Seite funktioniert damit ohne Änderung an diesem Test.
//
// WAS ER NICHT PRUEFT: ob der Link-Text zum Ziel passt, und ob das Dokument
// inhaltlich stimmt. Nur, dass ein Weg dorthin existiert.
// ───────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/** Wo ein Leser anfängt. Alles andere muss von hier aus verlinkt sein. */
const EINSTIEGE = ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'TESTING.md', 'SECURITY.md']

const alleDokumente = (): string[] => {
  // Auch die Dokumente in der Wurzel, nicht nur `docs/`: `THIRD-PARTY-LICENSES.md`
  // war von nirgends verlinkt (gemessen 2026-09-04). Das ist ein
  // Attributions-Artefakt, dessen Reproduktion die Fremdlizenzen VERLANGEN — es
  // nutzt niemandem in einer Datei, die keiner findet.
  const treffer: string[] = readdirSync(ROOT)
    .filter((e) => /\.md$/i.test(e) && !EINSTIEGE.includes(e))
    .map((e) => relative(ROOT, join(ROOT, e)))
  const lauf = (verzeichnis: string) => {
    for (const eintrag of readdirSync(verzeichnis)) {
      const pfad = join(verzeichnis, eintrag)
      if (statSync(pfad).isDirectory()) {
        if (eintrag === 'node_modules' || eintrag.startsWith('.')) continue
        lauf(pfad)
        continue
      }
      if (/\.md$/i.test(eintrag)) treffer.push(relative(ROOT, pfad))
    }
  }
  lauf(join(ROOT, 'docs'))
  return treffer.sort()
}

/** Relative Markdown-Links einer Datei, auf Repo-Wurzel normalisiert. */
const linksIn = (relativerPfad: string): string[] => {
  const voll = join(ROOT, relativerPfad)
  if (!existsSync(voll)) return []
  const inhalt = readFileSync(voll, 'utf8')
  const ziele: string[] = []
  for (const treffer of inhalt.matchAll(/\]\(([^)\s]+?\.md)(?:#[^)]*)?\)/g)) {
    const ziel = treffer[1]
    if (/^[a-z]+:\/\//i.test(ziel)) continue
    ziele.push(normalize(relative(ROOT, resolve(join(ROOT, dirname(relativerPfad)), ziel))))
  }
  return ziele
}

const erreichbar = (): Set<string> => {
  const gesehen = new Set<string>()
  const offen = [...EINSTIEGE]
  while (offen.length > 0) {
    const aktuell = offen.pop()!
    if (gesehen.has(aktuell)) continue
    gesehen.add(aktuell)
    offen.push(...linksIn(aktuell))
  }
  return gesehen
}

describe('Dokumentation ist auffindbar', () => {
  it('die Einstiegsseiten existieren', () => {
    // Ohne diese Prüfung wäre ein umbenanntes README ein grüner, leerer Lauf.
    for (const e of EINSTIEGE) expect(existsSync(join(ROOT, e)), `${e} fehlt`).toBe(true)
  })

  it('es gibt überhaupt Dokumente zu prüfen', () => {
    expect(alleDokumente().length).toBeGreaterThan(5)
  })

  it('kein Dokument unter docs/ ist verwaist', () => {
    const gesehen = erreichbar()
    const waisen = alleDokumente().filter((d) => !gesehen.has(d))
    expect(
      waisen,
      'Diese Dokumente sind von keiner Einstiegsseite aus verlinkt. Ein Dokument, ' +
        'das nur findet, wer den Ordner durchblättert, ist praktisch nicht vorhanden — ' +
        'in `docs/README.md` eintragen (oder von dort aus in einen Unter-Index).',
    ).toEqual([])
  })

  it('jeder Link zeigt auf eine Datei, die es gibt', () => {
    // Ein toter Link macht ein Dokument genauso unerreichbar wie gar kein Link,
    // sieht aber im Index nach Vollständigkeit aus.
    const tot: string[] = []
    for (const quelle of [...EINSTIEGE, ...alleDokumente()]) {
      for (const ziel of linksIn(quelle)) {
        if (!existsSync(join(ROOT, ziel))) tot.push(`${quelle} -> ${ziel}`)
      }
    }
    expect(tot).toEqual([])
  })
})
