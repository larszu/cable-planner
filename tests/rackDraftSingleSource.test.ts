import { describe, expect, it } from 'vitest'

// ADR-005, Inkrement 4 — der Draft-Typ und seine Gegenrichtung stehen genau
// einmal.
//
// Neben rackBuilderTypes.ts und rackBuilderHelpers.ts lag `rackBuilderModel.ts`:
// 260 Zeilen, die NIEMAND importierte und die dieselben Typen, dieselben
// Konstanten und dieselbe `draftFromPreset` ein zweites Mal fuehrten — auf dem
// Stand VOR #335. Gemessen: der Typ dort kannte `rentmanId` nicht, und die
// Gegenrichtung trug weder die Rentman-Id je Inhalt noch die Kombi-Id des
// Racks. Wer sie benutzt haette — der Name legt es naeher als „helpers" —
// haette die Rentman-Herkunft still verloren.
//
// Genau diese Klasse hat in diesem Inkrement drei PRs gekostet (#626, #631,
// #635): eine zweite Fassung derselben Umwandlung, die niemand nachzieht.
// Die Datei ist geloescht; dieser Test haelt fest, dass keine neue entsteht.
//
// Er ist auch die Absicherung des Guards aus #631: der liest den
// Interface-Rumpf von `RackPlacementDraft` aus rackBuilderTypes.ts. Gaebe es
// eine zweite Deklaration, koennte jemand die andere aendern und der Guard
// saehe es nicht.

const rackSources = import.meta.glob('../src/renderer/components/Rack/*.ts*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const declaringFiles = (pattern: RegExp): string[] =>
  Object.entries(rackSources)
    .filter(([, src]) => pattern.test(src))
    .map(([path]) => path.split('/').pop()!)
    .sort()

describe('der Rack-Draft hat genau eine Quelle', () => {
  it('findet die Rack-Dateien ueberhaupt', () => {
    // Sonst prueft der Test still nichts — der Glob ist die halbe Zusage.
    expect(Object.keys(rackSources).length).toBeGreaterThan(5)
  })

  it.each([
    ['RackPlacementDraft', /\binterface\s+RackPlacementDraft\b/],
    ['RackDraft', /\binterface\s+RackDraft\b/],
    ['InternalCableDraft', /\binterface\s+InternalCableDraft\b/],
  ])('%s ist genau einmal deklariert', (_name, pattern) => {
    expect(declaringFiles(pattern)).toEqual(['rackBuilderTypes.ts'])
  })

  it('draftFromPreset gibt es genau einmal', () => {
    expect(declaringFiles(/\bconst\s+draftFromPreset\b/)).toEqual(['rackBuilderHelpers.ts'])
  })

  it('die verwaiste Zweitfassung ist weg und kommt nicht wieder', () => {
    expect(Object.keys(rackSources).some((p) => p.endsWith('rackBuilderModel.ts'))).toBe(false)
  })
})
