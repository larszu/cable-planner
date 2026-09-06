import { describe, expect, it } from 'vitest'
import { DOCUMENT_STANDS, DOCUMENT_LABELS, UNJUDGEABLE_DOCUMENTS } from '../src/renderer/lib/documentRegistry'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// WAS DIESER TEST GEFUNDEN HAT (2026-09-06).
//
// Beim Bau des Ablaufblatts (Bedarf 33) bekam der Export den Bezeichner
// `'ablaufblatt'` mit -- und niemand trug ihn in `documentRegistry` ein. Alle
// 117 Testdateien blieben gruen. Der Bezeichner landet im Stempel auf dem
// Blatt, und `docStandStatus` haette darauf geantwortet: „Dokument unbekannt",
// obwohl das Blatt aus dem Plan heraus perfekt nachrechenbar ist.
//
// Der Fehler ist NICHT der vergessene Eintrag -- den macht jeder. Der Fehler
// ist, dass ihn nichts bemerkt: es gab einen Guard dafuer, dass jeder
// EINGETRAGENE Bezeichner ein Label hat (`documentRegistry.test.ts`), aber
// keinen dafuer, dass jeder BENUTZTE Bezeichner eingetragen ist. Die Richtung
// war falsch herum -- ein Register kann nur pruefen, was in ihm steht.
//
// Dieser Test dreht sie um: er liest die Aufrufstellen und haelt sie gegen das
// Register. Ein Blatt mit einem Stempel, den niemand deuten kann, ist
// schlimmer als eins ohne Stempel: es sieht pruefbar aus.
// ---------------------------------------------------------------------------

const sources = import.meta.glob('../src/**/*.{ts,tsx,cts}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/**
 * Die Argumente eines `csvFromTable(...)`-Aufrufs, ueber balancierte Klammern
 * getrennt statt per Regex. Der erste Versuch war eine Regex, und sie hat
 * `csvFromTable(planDiffTable(before, after))` fuer einen berechneten
 * Bezeichner gehalten: das Komma INNERHALB der inneren Klammer sah aus wie
 * ein Argument-Trenner. Ein Argument-Trenner ist es nur auf Ebene null.
 */
const argumente = (code: string, ab: number): string[] | null => {
  let i = ab
  let tiefe = 0
  let quote: string | null = null
  const args: string[] = []
  let aktuell = ''
  for (; i < code.length; i++) {
    const c = code[i]
    if (quote) {
      aktuell += c
      if (c === '\\') {
        aktuell += code[++i] ?? ''
      } else if (c === quote) {
        quote = null
      }
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      aktuell += c
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      tiefe++
      if (tiefe === 1) continue
    }
    if (c === ')' || c === ']' || c === '}') {
      tiefe--
      if (tiefe === 0) {
        args.push(aktuell.trim())
        return args
      }
    }
    if (c === ',' && tiefe === 1) {
      args.push(aktuell.trim())
      aktuell = ''
      continue
    }
    aktuell += c
  }
  return null
}

const benutzte = new Map<string, string[]>()
const berechnete: string[] = []

for (const [pfad, roh] of Object.entries(sources)) {
  const code = stripComments(roh)
  let von = code.indexOf('csvFromTable(')
  while (von !== -1) {
    const args = argumente(code, von + 'csvFromTable'.length)
    const dritt = args?.[2]
    if (dritt) {
      const literal = /^'([a-z0-9-]+)'$/.exec(dritt)
      if (literal) {
        const id = literal[1]
        benutzte.set(id, [...(benutzte.get(id) ?? []), pfad])
      } else {
        // Ein Bezeichner aus einer Variablen laesst sich statisch nicht
        // aufloesen. Er wird nicht verboten, aber benannt -- sonst waechst
        // hier eine Luecke, die aussieht wie „keine Fundstelle".
        berechnete.push(`${pfad}: ${dritt}`)
      }
    }
    von = code.indexOf('csvFromTable(', von + 1)
  }
}

const bekannt = (id: string): boolean => id in DOCUMENT_STANDS || id in UNJUDGEABLE_DOCUMENTS

describe('jeder ausgegebene Dokument-Bezeichner ist registriert', () => {
  it('findet ueberhaupt Aufrufstellen', () => {
    // Ohne diese Zeile waere der Test tautologisch: eine Regex, die nichts
    // trifft, bestaetigt jede Behauptung ueber ihre Treffer.
    expect(benutzte.size).toBeGreaterThanOrEqual(5)
  })

  it('kennt jeden benutzten Bezeichner', () => {
    const unbekannt = [...benutzte.entries()]
      .filter(([id]) => !bekannt(id))
      .map(([id, orte]) => `${id} (${orte.join(', ')})`)
    expect(unbekannt, 'nicht in DOCUMENT_STANDS oder UNJUDGEABLE_DOCUMENTS').toEqual([])
  })

  it('hat fuer jeden benutzten Bezeichner einen lesbaren Namen', () => {
    const ohneLabel = [...benutzte.keys()].filter((id) => !DOCUMENT_LABELS[id])
    expect(ohneLabel).toEqual([])
  })

  it('benennt Aufrufstellen mit berechnetem Bezeichner', () => {
    // Heute keine. Wer die erste baut, sieht hier, dass dieser Guard sie
    // nicht mehr pruefen kann, und entscheidet bewusst.
    expect(berechnete).toEqual([])
  })
})
