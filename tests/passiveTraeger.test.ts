import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { passiveTemplates } from '../src/renderer/lib/passiveCatalog'
import { isPatchPanelDevice, patchPanelCounterpart } from '../src/renderer/lib/patchPanel'
import { ALL_CONNECTOR_TYPES } from '../src/renderer/types/equipment'

/**
 * B-52 Teil 1 — passive Port-Traeger aus der Bibliothek.
 *
 * Nutzer-Frage 2026-09-08 nach Stromverteilern, Patchblenden,
 * Durchgangsbuchsen und Mehrfachsteckdosen. Der Waechter prueft die drei
 * Zusicherungen, die den Zuschnitt tragen:
 *
 *  1. Es sind FORMEN und keine Produkte — keine erfundene Herstellerangabe.
 *  2. Die Patchblende ist der ZWEITE Weg zu dem, was es schon gibt, und kein
 *     zweiter Patchblenden-Begriff.
 *  3. Die Absicherung steht am Abgang und wird nirgends geraten.
 */

const lies = (p: string): string => readFileSync(join(__dirname, '..', p), 'utf8')

describe('Formen, keine Produkte', () => {
  it('behauptet keine Herstellerangabe', () => {
    // Die Hausregel der Hersteller-Kataloge lautet „keine erfundenen Ports";
    // eine Steckdosenleiste hat kein Datenblatt. Ihr eine Quelle anzudichten
    // hoehlt die Regel dort aus, wo sie zaehlt.
    for (const t of passiveTemplates) {
      expect(t.manufacturerUrl).toBeUndefined()
      expect(t.deviceTypeId).toBeUndefined()
    }
  })

  it('benutzt nur Steckertypen, die es gibt', () => {
    const bekannt = new Set(ALL_CONNECTOR_TYPES)
    for (const t of passiveTemplates) {
      for (const p of [...t.inputs, ...t.outputs]) {
        expect(bekannt.has(p.connectorType)).toBe(true)
      }
    }
  })

  it('deckt alle vier gefragten Bauformen ab', () => {
    const namen = passiveTemplates.map((t) => t.name).join(' | ')
    expect(namen).toMatch(/Patch panel/)
    expect(namen).toMatch(/Feed-through/)
    expect(namen).toMatch(/Steckdosenleiste/)
    expect(namen).toMatch(/Distro/)
  })
})

describe('Die Patchblende ist dieselbe wie im Rack-Builder', () => {
  const blenden = passiveTemplates.filter((t) => t.name.startsWith('Patch panel'))

  it('laeuft durch dieselbe Erkennung', () => {
    // `isPatchPanelDevice` ist die EINE Stelle, die „ist das eine Blende?"
    // beantwortet. Eine Vorlage, die daran vorbeiginge, waere ein zweiter
    // Blenden-Begriff — genau das, was `patchPanel.ts` aufgeraeumt hat.
    expect(blenden.length).toBeGreaterThan(0)
    for (const t of blenden) expect(isPatchPanelDevice(t)).toBe(true)
  })

  it('leitet die Durchleitung positionsweise ab', () => {
    const t = blenden.find((b) => b.name.includes('24x BNC'))!
    const geraet = {
      ...t,
      id: 'pp1',
      x: 0,
      y: 0,
      inputs: t.inputs.map((p, i) => ({ ...p, id: `in-${i}` })),
      outputs: t.outputs.map((p, i) => ({ ...p, id: `out-${i}` })),
    }
    // Buchse n hinten liegt auf Buchse n vorn — die Bauart, nicht ein
    // Betriebszustand.
    expect(patchPanelCounterpart(geraet, { id: 'in-5' })?.id).toBe('out-5')
    expect(patchPanelCounterpart(geraet, { id: 'out-0' })?.id).toBe('in-0')
  })

  it('macht aus der Durchgangsbuchse eine Blende der Groesse 1', () => {
    const d = passiveTemplates.filter((t) => t.name.startsWith('Feed-through'))
    expect(d.length).toBeGreaterThan(0)
    for (const t of d) {
      expect(isPatchPanelDevice(t)).toBe(true)
      expect(t.inputs).toHaveLength(1)
      expect(t.outputs).toHaveLength(1)
    }
  })
})

describe('Die Absicherung steht am Abgang und wird nicht geraten', () => {
  it('gibt jedem Verteiler-Abgang seine Ampere', () => {
    const v = passiveTemplates.filter((t) => t.name.startsWith('Distro'))
    expect(v.length).toBeGreaterThan(0)
    for (const t of v) {
      for (const p of t.outputs) expect(p.absicherungA).toBeGreaterThan(0)
    }
  })

  it('laesst die Steckdosenleiste ohne — davor haengt nur der Hausanschluss', () => {
    // „Unbekannt" ist hier die richtige Antwort. Eine erfundene 16 A saehe
    // aus wie eine Angabe des Planers.
    for (const t of passiveTemplates.filter((x) => x.name.includes('leiste'))) {
      for (const p of t.outputs) expect(p.absicherungA).toBeUndefined()
    }
  })

  it('leitet sie nirgends aus dem Steckertyp ab', () => {
    // ADR-002: die Buchse sagt, was hineinpasst, nicht was davor haengt.
    const code = lies('src/renderer/lib/passiveCatalog.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((z) => !z.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/CEE(16|32|63)['"]?\s*(\?|&&|\|\||=>)[^\n]*absicherung/i)
    expect(code).not.toMatch(/absicherungA:\s*[a-zA-Z_$][\w$]*\.(connectorType|type)/)
  })
})

describe('Sie sind aus der Bibliothek erreichbar', () => {
  it('stehen in der Seed-Liste', () => {
    // Uebersetzte Vorlagen, die niemand ausliefert, sind kein Feature.
    const store = lies('src/renderer/store/projectStore.ts')
    expect(store).toContain('...passiveTemplates')
  })

  it('zieht die Migrations-Version hoch, sonst sieht sie niemand', () => {
    // Der Seed laeuft bei jedem Start, aber ohne neue Version bleibt die
    // Bibliothek eines bestehenden Nutzers unangetastet — die Vorlagen
    // waeren gebaut und unsichtbar.
    const store = lies('src/renderer/store/projectStore.ts')
    expect(store).toContain("LIB_MIGRATION_VERSION = '2026-09-passive-carriers'")
    // Und die alte Version bleibt geschuetzt, damit niemandem die eigene
    // Bibliothek geloescht wird.
    expect(store).toContain("'2026-04-greengo-catalog-v2'")
  })
})
