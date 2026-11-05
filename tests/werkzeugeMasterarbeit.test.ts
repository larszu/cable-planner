import { describe, expect, it } from 'vitest'
// @ts-expect-error -- .mjs ohne Typen
import { chrF, platzhalter, pruefe, quellTexte, vorhandeneSchluessel } from '../scripts/uebersetzer/luecken.mjs'
// @ts-expect-error -- .mjs ohne Typen
import { kosinus, vektoren, woerter } from '../scripts/issues/triage.mjs'
// @ts-expect-error -- .mjs ohne Typen
import { bewerte } from '../scripts/ki-bench/lauf.mjs'

/**
 * Die Werkzeuge aus der Auswertung von Hahn 2026 (Uebersetzer, Triage,
 * KI-Bench) — ihre Rechenregeln. Netz und Modelle kommen hier nicht vor;
 * getestet wird, was ein falsches Urteil liefern wuerde.
 */
describe('Uebersetzer', () => {
  it('verwirft eine Uebersetzung, die einen Platzhalter verliert oder umbenennt', () => {
    expect(pruefe('{n} cables on {rack}', '{n} Kabel in {rack}')).toBe(true)
    expect(pruefe('{n} cables', 'Kabel')).toBe(false)
    expect(pruefe('{n} cables', '{anzahl} Kabel')).toBe(false)
    expect(pruefe('Save', '  ')).toBe(false)
    expect(platzhalter('{b} {a}')).toBe(platzhalter('{a} {b}'))
  })

  it('chrF: gleich = 1, nichts gemeinsam = 0', () => {
    expect(chrF('Gerät hinzufügen', 'Gerät hinzufügen')).toBe(1)
    expect(chrF('xyz', 'Gerät')).toBe(0)
    expect(chrF('Gerät ergänzen', 'Gerät hinzufügen')).toBeGreaterThan(0.2)
  })

  it('liest Schluessel aus dem Woerterbuch und findet t()-Aufrufe ausserhalb von Kommentaren', () => {
    expect(vorhandeneSchluessel("  'a.b': 'x',\n  'c': 'y',")).toEqual(new Set(['a.b', 'c']))
    const quelle = quellTexte()
    expect(quelle.get('err.ai.lokalUnreachable')?.en).toContain('{url}')
    expect(quelle.has('foo')).toBe(false)
  })
})

describe('Triage', () => {
  it('haelt fast gleiche Titel fuer aehnlich und fremde fuer unaehnlich', () => {
    const v = vektoren([
      { title: 'yEd Import', body: 'GraphML aus yEd lesen' },
      { title: 'yED import', body: 'Import von yEd-Dateien' },
      { title: 'Rack-Ansicht druckt leer', body: 'PDF ohne Inhalt' },
    ])
    expect(kosinus(v[0], v[1])).toBeGreaterThan(0.45)
    expect(kosinus(v[0], v[2])).toBeLessThan(0.1)
    expect(woerter('Der Import von https://x.de geht nicht')).toEqual(['import', 'geht'])
  })
})

describe('KI-Bench', () => {
  it('zaehlt Ports je Richtung und Stecker, nicht nach Beschriftung', () => {
    const soll = new Map([
      ['in|BNC', 4],
      ['out|HDMI', 1],
    ])
    expect(bewerte(soll, [{ direction: 'in', connectorType: 'BNC', count: 4 }, { direction: 'out', connectorType: 'HDMI', count: 1 }]).f1).toBe(1)
    const halb = bewerte(soll, [{ direction: 'in', connectorType: 'BNC', count: 2 }])
    expect(halb.genau).toBe(1)
    expect(halb.voll).toBeCloseTo(0.4)
    expect(bewerte(soll, []).f1).toBe(0)
  })
})
