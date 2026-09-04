import { describe, expect, it } from 'vitest'
import appSrc from '../src/renderer/App.tsx?raw'
import libSrc from '../src/renderer/components/Library/LibraryPanel.tsx?raw'
import { stripComments } from './support/stripComments'

// Die Architektur-Invariante in CLAUDE.md lautete: "Three.js nur in
// components/Rack/ -- Imports ausserhalb ziehen ~600 KB in den Hauptbundle."
//
// Der Satz war irrefuehrend. Gemessen ist nicht der Import-ORT entscheidend,
// sondern die LAZY-GRENZE: solange ein statisch importiertes Modul nach
// `Rack/` hineinreicht, liegt Three im Haupt-Chunk, egal wie diszipliniert
// die Imports sind. Genau so war es -- `LibraryPanel` importierte
// `RackBuilderDialog` statisch, und Three lag im Haupt-Chunk (8 Marker),
// obwohl bis auf `lib/exportRack.ts` alle Three-Importe brav in `Rack/`
// standen.
//
// Nach der Umstellung: Haupt-Chunk 4.193 -> 2.938 kB (gzip 1.165 -> 822),
// Three-Marker im Haupt-Chunk 8 -> 0.
//
// Dieser Test bewacht die zwei Eintritte. Er kann den Bundle nicht messen
// (dafuer braeuchte es einen Build), aber er faengt den Rueckbau auf einen
// statischen Import -- und das ist der Weg, auf dem der Gewinn verloren ginge.

const code = (s: string) => stripComments(s)

describe('Three.js bleibt hinter der Lazy-Grenze', () => {
  it('App laedt den Rack-Editor lazy', () => {
    const c = code(appSrc)
    expect(c).toMatch(/lazy\(\(\) =>\s*import\('\.\/components\/Rack\/RackEditorDialog'\)/)
    expect(c).not.toMatch(/^import \{[^}]*RackEditorDialog[^}]*\} from/m)
  })

  it('LibraryPanel laedt den Rack-Builder lazy', () => {
    const c = code(libSrc)
    expect(c).toMatch(/lazy\(\(\) => import\('\.\.\/Rack\/RackBuilderDialog'\)/)
    expect(c).not.toMatch(/^import \{[^}]*RackBuilderDialog[^}]*\} from/m)
  })

  it('beide werden nur gemountet, wenn sie offen sind', () => {
    // `lazy` allein genuegt NICHT: ein unbedingt gerendertes Element zieht
    // seinen Chunk sofort beim ersten Render nach. Der Dialog gibt intern
    // `null` zurueck, solange er zu ist -- das half dem Bundle nicht.
    expect(code(appSrc)).toContain('rackEditorOpen && (')
    expect(code(libSrc)).toContain('showRackBuilderDialog && (')
  })

  it('kein weiterer statischer Eintritt nach components/Rack/', () => {
    for (const [name, src] of [['App', appSrc], ['LibraryPanel', libSrc]] as const) {
      const statisch = code(src).match(/^import .*from '[^']*(?:components\/)?Rack\/[^']*'/gm) ?? []
      // Typ-Importe sind erlaubt (werden beim Build geloescht).
      const wert = statisch.filter((l) => !l.startsWith('import type'))
      expect(wert, `${name} hat einen statischen Rack-Import: ${wert.join(', ')}`).toEqual([])
    }
  })
})
