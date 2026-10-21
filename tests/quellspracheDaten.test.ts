import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — reines JS-Hilfsmodul ohne Typen, absichtlich
import { messeDatenBeschriftungen, mapWerte } from '../scripts/quellsprache.mjs'
import { PRESETS } from '../src/renderer/lib/modules'
import { de } from '../src/renderer/lib/i18n/de'

describe('Daten-Beschriftungen in der Quellsprache', () => {
  it('Erststart-Presets sind englisch, Deutsch steht im Woerterbuch', () => {
    const funde = messeDatenBeschriftungen(resolve(__dirname, '../src/renderer/lib'), 'en') as {
      datei: string
      text: string
    }[]
    expect(funde.filter((f) => f.datei === 'modules.ts' && /Temporäre Produktionen|Dauerhafte Anlagen|Lagerbestand &/.test(f.text))).toEqual([])
    for (const p of PRESETS) {
      expect(de[`onboarding.preset.${p.id}.label`]).toBeTruthy()
      expect(de[`onboarding.preset.${p.id}.desc`]).toBeTruthy()
    }
    expect(PRESETS.find((p) => p.id === 'festinstallation')?.label).toBe('Fixed installation')
  })

  it('Anmerkungs-Status haben englische Fallbacks und deutsche Eintraege', () => {
    const panel = readFileSync(resolve(__dirname, '../src/renderer/components/Annotations/AnnotationsPanel.tsx'), 'utf8')
    expect(panel).not.toMatch(/'offen'|'gebaut'|'erledigt'/)
    for (const s of ['open', 'built', 'resolved']) {
      expect(de[`annotations.status.${s}`]).toBeTruthy()
      expect(de[`annotations.statusFull.${s}`]).toBeTruthy()
    }
  })
})

describe('Modale Dialoge folgen dem Theme', () => {
  it('Karte, Zweitknopf und Rumpftext nutzen Tokens statt Dunkel-Hex', () => {
    for (const f of ['modalRoot.tsx', 'infoDialog.tsx', 'confirmDialog.tsx', 'promptDialog.tsx']) {
      const src = readFileSync(resolve(__dirname, '../src/renderer/lib', f), 'utf8')
      expect(src, f).not.toMatch(/#1e293b|#334155|#cbd5e1|#e2e8f0/)
    }
  })
})

describe('Maps als t()-Fallback', () => {
  it('liest die Werte einer Map, die an t() geht', () => {
    const quelle = "const STATUS_LABEL: Record<S, string> = {\n  open: 'offen',\n  built: { x: 'gebaut' },\n}"
    expect(mapWerte(quelle, 'STATUS_LABEL')).toEqual(['offen', 'gebaut'])
  })
})
