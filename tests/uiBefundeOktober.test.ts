// Befunde aus dem UI-Durchgang vom 2026-10-22: tote Menueeintraege, eine
// Zaehlung, die nicht zum Import passte, und deutsche/englische Reste, die
// lang:check nicht sah. Jede Pruefung haelt die Stelle fest, an der es lag.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildImportPayload, countIncludedCables, type ImportPreview } from '../src/renderer/lib/graphml/semantics'
import { rentmanCategoryLabel } from '../src/renderer/components/Rentman/rentmanImportHelpers'
import { mvFindings, mvWindows } from '../src/renderer/lib/mvSheet'
import { satzText } from '../src/renderer/lib/satz'
import { translate } from '../src/renderer/lib/i18n'
import { useUiStore } from '../src/renderer/store/uiStore'
import type { AtemMvDefinition } from '../src/renderer/types/equipment'
// @ts-expect-error -- reines ESM-Skript ohne Typen
import { messeBefundtexte, messeWoerterbuch, messeDatenBeschriftungen } from '../scripts/quellsprache.mjs'

describe('Werkzeuge → Rack-Builder ohne Auswahl', () => {
  it('oeffnet den Builder statt still nichts zu tun', () => {
    const vorher = useUiStore.getState().newRackBuilderTrigger
    useUiStore.getState().triggerRackBuilderFromSelection([])
    const s = useUiStore.getState()
    expect(s.rackBuilderSeedTrigger).toBeNull()
    expect(s.newRackBuilderTrigger).not.toBe(vorher)
    expect(s.newRackBuilderTrigger).toBeGreaterThan(0)
  })

  it('mit Auswahl bleibt es beim Seed', () => {
    useUiStore.getState().triggerRackBuilderFromSelection(['a'])
    expect(useUiStore.getState().rackBuilderSeedTrigger).toEqual(['a'])
    useUiStore.getState().clearRackBuilderSeedTrigger()
  })
})

describe('GraphML: der Knopf zaehlt, was der Import uebernimmt', () => {
  const dev = (k: string) => ({ importKey: k, inputs: [], outputs: [], name: k, category: 'x', notes: [], position: { x: 0, y: 0 } })
  const cab = (k: string, a: string, b: string) => ({
    importKey: k,
    sourceDeviceImportKey: a,
    targetDeviceImportKey: b,
    inferredCableType: 'SDI',
    waypoints: [],
  })
  const preview = {
    devices: [dev('A'), dev('B'), dev('C')],
    cables: [cab('1', 'A', 'B'), cab('2', 'B', 'C'), cab('3', 'A', 'C')],
  } as unknown as ImportPreview

  it('ein abgewaehltes Geraet nimmt seine Kabel mit', () => {
    const skipDev = new Set(['C'])
    const skipCab = new Set<string>()
    expect(countIncludedCables(preview, skipDev, skipCab)).toBe(1)
    const payload = buildImportPayload(preview, { skipDeviceKeys: skipDev, skipCableKeys: skipCab })
    expect(payload.cables.length).toBe(countIncludedCables(preview, skipDev, skipCab))
  })

  it('abgewaehlte Kabel und Geraete zaehlen nicht doppelt', () => {
    expect(countIncludedCables(preview, new Set(['C']), new Set(['2', '1']))).toBe(0)
  })
})

describe('Rentman: Ersatz-Kategorie folgt der Sprache', () => {
  it('nur die Ersatz-Kategorie wird uebersetzt', () => {
    const de = (k: string, en: string) => translate('de', k, en)
    expect(rentmanCategoryLabel('Uncategorized', de)).toBe('Ohne Kategorie')
    expect(rentmanCategoryLabel('Kamera', de)).toBe('Kamera')
  })
})

describe('Multiviewer: die Fensterstelle', () => {
  const mv = { index: 0, layout: 0, windows: [] } as unknown as AtemMvDefinition
  it('Blatt bleibt kanonisch deutsch, Befund folgt der App-Sprache', () => {
    const w = mvWindows(mv)
    const klein = w.find((x) => !x.big)!
    expect(klein.position).toMatch(/Zelle 1$/)
    const en = (k: string, f: string) => translate('en', k, f)
    const befund = mvFindings([mv], new Map())[0] as { satz: Parameters<typeof satzText>[0] }
    expect(satzText(befund.satz, en)).not.toMatch(/Zelle|oben|unten/)
    expect(satzText(befund.satz, en)).toMatch(/top left|bottom/)
  })
})

describe('lang:check sieht die Luecken, durch die diese Befunde gingen', () => {
  const baue = (dateien: Record<string, string>): string => {
    const wurzel = mkdtempSync(join(tmpdir(), 'qs-'))
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(join(wurzel, pfad, '..'), { recursive: true })
      writeFileSync(join(wurzel, pfad), inhalt)
    }
    return wurzel
  }

  it('Woerterbuch: Kopie, fehlender Platzhalter, fehlender Eintrag', () => {
    const w = baue({
      'lib/i18n/de.ts': "export const de = {\n  'a.shown': '{n} of {m} shown',\n  'a.many': 'Einträge tragen Daten.',\n}\n",
      'c.tsx': "t('a.shown', '{n} of {m} shown'); t('a.many', '{n} entries carry data.'); t('a.neu', 'brand new text')",
    })
    const funde = (messeWoerterbuch(w) as { text: string }[]).map((f) => f.text)
    expect(funde.some((t) => t.startsWith('Kopie: a.shown'))).toBe(true)
    expect(funde.some((t) => t.startsWith('Platzhalter: a.many'))).toBe(true)
    expect(funde.some((t) => t.startsWith('fehlt: a.neu'))).toBe(true)
  })

  it('Befundtexte: Ternary-Else und push()-Literal in reinen Modulen', () => {
    const w = baue({
      'lib/x.ts': "const a = n === 0 ? 'none' : 'alle aktuell'\nparts.push(`${n} überholt`)\n",
    })
    const texte = (messeBefundtexte(w, 'en') as { text: string }[]).map((f) => f.text.trim())
    expect(texte).toContain('alle aktuell')
    expect(texte).toContain('überholt')
  })

  it('Daten: name neben nameKey ist ein Fallback', () => {
    const w = baue({ 'lib/t.ts': "const x = { nameKey: 'k', descKey: 'd', name: 'Konferenz / Corporate' }\n" })
    expect((messeDatenBeschriftungen(w, 'en') as { text: string }[]).map((f) => f.text)).toContain('Konferenz / Corporate')
  })
})
