import { describe, expect, it } from 'vitest'
import { aufrufSaetze } from '../scripts/quellsprache.mjs'
import { CompanionFehler } from '../src/renderer/lib/companionControl'
import { SatzFehler, satz, satzKanonisch } from '../src/renderer/lib/satz'

// #1142 — die dritte Form der Befundtext-Messung: der Satz direkt als
// Argument eines Aufrufs. Gegenprobe an einer festen Probe, nicht an einer
// Mindestzahl im Repo (die sinkt genau dann, wenn die Arbeit gelingt).
describe('aufrufSaetze — Saetze als Funktionsargument', () => {
  const probe = [
    "return stop('schleife', 'Der Weg läuft in sich zurück')",
    "throw new Error('Keine gültige Datei gefunden.')",
    "lines.push(`- Geräte: **${n}**`)",
    // erlaubt: die Rueckfall-Stelle der Uebersetzer
    "tr('err.x', 'Not a valid file found.')",
    "kanonisch('k', 'Der Text bleibt hier')",
    "satz('k', 'A sentence with {n}', { n })",
    // keine Saetze: Kennungen und kurze Werte
    "finish('mehrdeutig', x)",
    "push('leer')",
    // Konsole ist Entwickler-Ausgabe
    "console.warn('Das ist nur für Entwickler gedacht')",
  ].join('\n')

  it('findet genau die drei Saetze in Aufrufen', () => {
    expect(aufrufSaetze(probe)).toEqual([
      'Der Weg läuft in sich zurück',
      'Keine gültige Datei gefunden.',
      '- Geräte: ** **',
    ])
  })
})

describe('SatzFehler — der Fehler traegt seinen Satz', () => {
  it('meldet englisch und liest sich deutsch', () => {
    const fehler = new CompanionFehler(satz('err.companion.sameVar', 'Output and input point to the same variable.'))
    expect(fehler).toBeInstanceOf(SatzFehler)
    expect(fehler.message).toBe('Output and input point to the same variable.')
    expect(satzKanonisch(fehler.satz)).toBe('Ausgang und Eingang zeigen auf dieselbe Variable.')
  })
})
