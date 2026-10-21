import { describe, expect, it } from 'vitest'
import { KANONISCH_DE } from '../src/renderer/lib/kanonischDe'
import { de } from '../src/renderer/lib/i18n/de'

// #1142 — Befundsaetze mit englischer Quelle. `satz('key', …)` ist kein
// t()-Aufruf; der Erreichbarkeits-Guard sieht diese Schluessel deshalb nicht.
// Hier steht die Gegenprobe: jeder Satz-Schluessel hat eine deutsche Fassung,
// und zwar in KANONISCH_DE — das Blatt braucht ihn ohne das Desktop-Woerterbuch.

const quellen = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Saetze, die in beiden Sprachen gleich lauten. */
const GLEICH = new Set(['list.one', 'list.comma', 'multicast.reserved.line', 'fallback.field.offline'])

describe('Befundsaetze haben eine deutsche Fassung', () => {
  const schluessel = new Set<string>()
  for (const src of Object.values(quellen)) {
    for (const m of src.matchAll(/\bsatz\(\s*'([\w.-]+)'/g)) schluessel.add(m[1])
  }

  it('findet ueberhaupt Saetze', () => {
    expect(schluessel.size).toBeGreaterThan(80)
  })

  it('jeder Schluessel steht kanonisch deutsch (und damit auch in de.ts)', () => {
    const fehlend = [...schluessel].filter((k) => !GLEICH.has(k) && !(k in KANONISCH_DE))
    expect(fehlend).toEqual([])
    for (const k of schluessel) if (k in KANONISCH_DE) expect(de[k]).toBe(KANONISCH_DE[k])
  })
})
