import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// WARUM ES DAS GIBT (ADR-015, 2026-09-28).
//
// Gemeinsamer Code der Suite (`av-planner-suite/packages/<name>/src`)
// erreicht diesen Planer als zeichengleiche Kopie unter `…/avplan/<name>/`,
// mit einem MANIFEST.json (SHA-256 je Datei). Vor ADR-015 wuchsen genau so
// Parallelfassungen: drei `venueExchange.ts`, deren Kommentare sich
// „byte-gleich" nannten und es nicht waren — geprueft wurden nur Schluessel,
// nie Bytes. Dieser Waechter rechnet die Bytes. Wer die Kopie hier aendert,
// wird rot und erfaehrt, wohin die Aenderung gehoert.

const WURZEL = join(__dirname, '..')
const SRC = join(WURZEL, 'src')

const manifeste = (dir: string): string[] => {
  const treffer: string[] = []
  for (const eintrag of readdirSync(dir)) {
    if (eintrag === 'node_modules') continue
    const pfad = join(dir, eintrag)
    if (!statSync(pfad).isDirectory()) continue
    if (eintrag === 'avplan') {
      for (const paket of readdirSync(pfad)) {
        const m = join(pfad, paket, 'MANIFEST.json')
        try {
          if (statSync(m).isFile()) treffer.push(m)
        } catch {
          // Ordner ohne Manifest: faellt unten auf.
        }
      }
    } else {
      treffer.push(...manifeste(pfad))
    }
  }
  return treffer
}

const sha256 = (datei: string) => createHash('sha256').update(readFileSync(datei, 'utf8'), 'utf8').digest('hex')

const quellDateien = (dir: string, basis = dir): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) return quellDateien(p, basis)
    return /\.tsx?$/.test(e) ? [relative(basis, p).split('\\').join('/')] : []
  })

const hinweis = (name: string) =>
  `Kopie eines Suite-Pakets (ADR-015) — Aenderung gehoert nach av-planner-suite/packages/${name}, dann npm run pakete:verteilen`

describe('avplan-Kopien (ADR-015)', () => {
  const gefunden = manifeste(SRC)

  it('findet mindestens die Kopie von @avplan/floorplan', () => {
    expect(gefunden.map((m) => relative(WURZEL, m).split('\\').join('/'))).toContain(
      'src/renderer/avplan/floorplan/MANIFEST.json',
    )
  })

  for (const manifest of gefunden) {
    const ordner = join(manifest, '..')
    const name = ordner.split(/[\\/]/).pop() as string
    const m = JSON.parse(readFileSync(manifest, 'utf8')) as { dateien: Record<string, string> }

    it(`${relative(WURZEL, ordner)}: jede Datei entspricht dem Manifest`, () => {
      const abweichend = Object.entries(m.dateien)
        .filter(([datei, soll]) => {
          try {
            return sha256(join(ordner, datei)) !== soll
          } catch {
            return true
          }
        })
        .map(([datei]) => datei)
      expect(abweichend, `${hinweis(name)}\nAbweichend oder fehlend: ${abweichend.join(', ')}`).toEqual([])
    })

    it(`${relative(WURZEL, ordner)}: keine Quelldatei ausserhalb des Manifests`, () => {
      const fremd = quellDateien(ordner).filter((d) => !(d in m.dateien))
      expect(fremd, `${hinweis(name)}\nNicht im Manifest: ${fremd.join(', ')}`).toEqual([])
    })
  }
})
