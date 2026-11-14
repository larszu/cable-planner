import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { IOS_BEKANNTE_ENDUNGEN, acceptFuerGeraet, istIos } from '../src/renderer/lib/pickFile'

// #1197: Auf dem iPhone liess sich eine .cableplan ueber „Oeffnen" nicht
// waehlen. Safari uebersetzt `accept` in iOS-Dateitypen; eine Endung, die
// iOS nicht kennt, faellt heraus, und die Datei ist ausgegraut.

describe('acceptFuerGeraet', () => {
  it('laesst den Filter am Desktop unveraendert', () => {
    expect(acceptFuerGeraet('.cableplan,.json,application/json', false)).toBe('.cableplan,.json,application/json')
  })
  it('hebt den Filter auf iOS auf, sobald eine eigene Endung darin steht', () => {
    expect(acceptFuerGeraet('.cableplan,.json,application/json', true)).toBe('')
    expect(acceptFuerGeraet('.cpviewer,.json', true)).toBe('')
  })
  it('behaelt auf iOS Filter, die nur bekannte Typen nennen', () => {
    expect(acceptFuerGeraet('image/*', true)).toBe('image/*')
    expect(acceptFuerGeraet('.csv,text/csv', true)).toBe('.csv,text/csv')
  })
})

describe('istIos', () => {
  it('erkennt iPhone und das iPad im Desktop-Modus', () => {
    expect(istIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 })).toBe(true)
    expect(istIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
  })
  it('haelt einen Mac ohne Touch fuer keinen iOS-Rechner', () => {
    expect(istIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
  })
})

// Waechter: ein neues `accept` mit eigener Endung, das nicht durch
// acceptFuerGeraet laeuft, wuerde auf dem iPhone wieder still ausgrauen.
const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (n === 'vendor' || n === 'node_modules') return []
    return statSync(p).isDirectory() ? dateien(p) : /\.tsx?$/.test(n) ? [p] : []
  })

describe('accept-Literale', () => {
  it('nennen eigene Endungen nur ueber acceptFuerGeraet', () => {
    const verstoesse: string[] = []
    for (const f of ['src/renderer', 'src/viewer', 'src/mobile'].flatMap(dateien)) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/accept(?:="| = ')([^"']*)["']/g)) {
        const eigene = m[1].split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.startsWith('.') && !IOS_BEKANNTE_ENDUNGEN.has(s))
        if (eigene.length) verstoesse.push(`${f}: ${m[1]}`)
      }
    }
    expect(verstoesse).toEqual([])
  })
})
