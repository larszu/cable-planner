import { describe, expect, it } from 'vitest'
import { EINGEBAUTE_SYMBOLE, SYMBOL_KATEGORIEN } from '../src/renderer/lib/symbole/eingebaut'
import { svgBereinigen } from '../src/renderer/lib/symbole/svg'
import { kiSymbolLesen, kiSymbolPrompt } from '../src/renderer/lib/symbole/kiSymbol'
import { symbolTabelle } from '../src/renderer/lib/symbole/symbolListe'
import kiQuelle from '../src/renderer/lib/symbole/kiSymbol.ts?raw'
import panelQuelle from '../src/renderer/components/Grundriss/SymbolPanel.tsx?raw'

describe('Eingebaute Symbole', () => {
  it('haben eindeutige Ids und decken jede Fachkategorie ab', () => {
    const ids = EINGEBAUTE_SYMBOLE.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const k of SYMBOL_KATEGORIEN.filter((k) => k !== 'eigen')) {
      expect(EINGEBAUTE_SYMBOLE.some((d) => d.kategorie === k)).toBe(true)
    }
  })

  it('sind gueltige SVGs im 48er-Raster und bestehen die eigene Bereinigung unveraendert', () => {
    for (const d of EINGEBAUTE_SYMBOLE) {
      expect(d.svg).toMatch(/^<svg [^>]*viewBox="0 0 48 48"/)
      expect(svgBereinigen(d.svg!)).toBe(d.svg)
    }
  })
})

describe('SVG aus fremder Hand', () => {
  it('entfernt Skripte, Event-Handler, foreignObject und externe Verweise', () => {
    const roh =
      '<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><foreignObject><div/></foreignObject>' +
      '<image href="https://example.com/x.png"/><use href="#a"/><rect width="5" height="5"/></svg>'
    const s = svgBereinigen(roh)!
    expect(s).not.toMatch(/script|onload|foreignObject|example\.com/i)
    expect(s).toContain('href="#a"')
    expect(s).toContain('<rect')
  })

  it('ergaenzt die viewBox aus width/height, damit das Zeichen skaliert', () => {
    expect(svgBereinigen('<svg width="24" height="12"><path d="M0 0"/></svg>')).toMatch(/viewBox="0 0 24 12"/)
  })

  it('lehnt Text ohne SVG ab', () => {
    expect(svgBereinigen('kein Zeichen')).toBeNull()
  })
})

describe('KI-Symbol', () => {
  it('liest JSON-Antworten und Antworten mit Begleittext', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="10"/></svg>'
    expect(kiSymbolLesen(JSON.stringify({ name: 'Emergency stop', svg }), 'Not-Aus')).toEqual({ name: 'Emergency stop', svg })
    expect(kiSymbolLesen(`Here you go:\n${svg}\nEnjoy`, 'Not-Aus')).toEqual({ name: 'Not-Aus', svg })
    expect(kiSymbolLesen('{"name":"x"}', 'x')).toBeNull()
  })

  it('verlangt das Raster und die Strichstaerke der eingebauten Zeichen', () => {
    const p = kiSymbolPrompt('DMX splitter')
    expect(p).toContain('viewBox="0 0 48 48"')
    expect(p).toContain('stroke-width="2"')
    expect(p).toContain('DMX splitter')
  })

  it('laeuft ueber den unter Einstellungen → AI hinterlegten Anbieter und keinen eigenen Schluessel', () => {
    expect(kiQuelle).toContain("import { completeWithAI } from '../aiSuggestions'")
    expect(kiQuelle).not.toMatch(/localStorage|keytar|apiKey/)
    // Der Knopf erscheint nur mit hinterlegtem Schluessel.
    expect(panelQuelle).toMatch(/const kiMoeglich = getApiKey\(provider\)\.length > 0/)
    expect(panelQuelle).toMatch(/\{kiMoeglich && \(/)
  })
})

describe('Symbolliste', () => {
  it('zaehlt je Zeichen und nennt unbekannte Definitionen', () => {
    const defs = new Map(EINGEBAUTE_SYMBOLE.map((d) => [d.id, d]))
    const t = symbolTabelle(
      [
        { id: '1', defId: 'builtin:rauchmelder', x: 0, y: 0, groesse: 48, beschriftung: 'RM 2' },
        { id: '2', defId: 'builtin:rauchmelder', x: 0, y: 0, groesse: 48, beschriftung: 'RM 10' },
        { id: '3', defId: 'custom:weg', x: 0, y: 0, groesse: 48 },
      ],
      defs,
      (d) => d.name,
      { symbol: 'S', kategorie: 'K', anzahl: 'N', beschriftungen: 'B', unbekannt: 'Unknown' },
    )
    expect(t.rows).toEqual([
      ['Unknown (custom:weg)', '', 1, ''],
      ['Smoke detector', 'bma', 2, 'RM 2, RM 10'],
    ])
  })
})
