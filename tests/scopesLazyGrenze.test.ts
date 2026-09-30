import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// larszu/lz-scopes#15 — lz-scopes bleibt hinter der Lazy-Grenze.
//
// Der vendorte Kern bringt WebGL-Renderer, Farbwissenschaft und Audio-DSP mit.
// Gebraucht wird er erst, wenn jemand ein Scope oder ein Testbild oeffnet.
// Dieselbe Lehre wie bei Three (`threeBundleGrenze.test.ts`): was den Chunk
// klein haelt, ist die Lazy-Grenze, und ein einziger statischer Import irgendwo
// reisst sie still ein. Deshalb wird der BAUM geprueft, nicht eine Liste.
//
// Erlaubt: Dateien IN `components/Scopes/` (die liegen selbst hinter der
// Grenze) und `vendor/` selbst. `ScopesLazy.tsx` darf nur per `import()`.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src', 'renderer')
const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e)
    return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx)$/.test(p) ? [p] : []
  })

const STATISCH = /^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm

describe('lz-scopes hinter der Lazy-Grenze', () => {
  it('niemand ausserhalb von components/Scopes importiert lz-scopes oder die Scope-Komponenten statisch', () => {
    const funde: string[] = []
    for (const f of dateien(WURZEL)) {
      const rel = relative(WURZEL, f).split(sep).join('/')
      if (rel.startsWith('vendor/') || rel.startsWith('components/Scopes/')) continue
      const src = stripComments(readFileSync(f, 'utf8'))
      for (const m of src.matchAll(STATISCH)) {
        if (m[0].includes('import type')) continue
        if (/vendor\/lz-scopes|Scopes\/(ScopeMonitor|ScopeDialog|TestPatternPanel)/.test(m[1])) funde.push(`${rel} → ${m[1]}`)
      }
    }
    expect(funde).toEqual([])
  })

  it('ScopesLazy laedt die drei Eintritte per import()', () => {
    const src = stripComments(readFileSync(join(WURZEL, 'components/Scopes/ScopesLazy.tsx'), 'utf8'))
    for (const n of ['ScopeMonitor', 'ScopeDialog', 'TestPatternPanel']) {
      expect(src).toMatch(new RegExp(`lazy\\(\\(\\) => import\\('\\./${n}'\\)\\)`))
      expect(src).not.toMatch(new RegExp(`^import [^;]*from '\\./${n}'`, 'm'))
    }
  })
})
