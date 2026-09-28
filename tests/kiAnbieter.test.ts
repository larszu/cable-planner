import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getAiProviderConfig,
  getApiKey,
  getSelectedAiProvider,
  listAiProviders,
  setApiKey,
  setSelectedAiProvider,
} from '../src/renderer/lib/aiSuggestions'

/**
 * Der KI-Anbieter, den das Menue nennt, ist der, den die Knoepfe fragen.
 *
 * WARUM ES DAS GIBT. Gemeldet am 2026-09-28: „in den KI Ausfuellen der
 * geraeteinfos wenn man neues geraet anlegt ist immer gemini hinterlegt
 * unabhaengig von dem was im menue ausgewaehlt ist, das ist falsch."
 *
 * Die Ursache war nicht die Auswahl und nicht der Aufruf — `completeWithAI`
 * liest `getSelectedAiProvider()` und verzweigt korrekt. Sie lag in ZWEI
 * Zeilen, die aussahen wie „der KI-Schluessel" und es nicht waren:
 *
 *     export const getGeminiApiKey = (): string => getApiKey('gemini')
 *     export const setGeminiApiKey = (key: string): void => setApiKey('gemini', key)
 *
 * Als sanfte Migration eingefuehrt, von beiden Anlegen-Dialogen gerufen. Mit
 * gewaehltem Claude fragte der Knopf damit den LEEREN Gemini-Platz, meldete
 * „kein API-Key", und der im Fenster nachgetragene Schluessel landete
 * ebenfalls unter Gemini — wo ihn der Aufruf danach nicht las. Ein Schluessel,
 * den man eingibt und der nirgends ankommt, ist schlimmer als eine
 * Fehlermeldung.
 *
 * WARUM DIESER TEST AM QUELLTEXT SUCHT. Der Fehler war nicht, dass eine
 * Funktion das Falsche TUT — `getApiKey('gemini')` tut genau, was dort steht.
 * Der Fehler war, WER sie ruft. Das sieht man nur an der Aufrufstelle, und
 * ein Verhaltenstest an der Bibliothek haette ihn nie gefunden: die
 * Bibliothek war in Ordnung.
 */
const lies = (...teile: string[]) => readFileSync(join(process.cwd(), ...teile), 'utf8')

const DIALOGE = [
  ['LibraryPanel', lies('src', 'renderer', 'components', 'Library', 'LibraryPanel.tsx')],
  [
    'NewRentmanDeviceWizard',
    lies('src', 'renderer', 'components', 'Rentman', 'NewRentmanDeviceWizard.tsx'),
  ],
] as const

describe('kein Dialog verdrahtet einen Anbieter fest', () => {
  for (const [name, quelle] of DIALOGE) {
    it(`${name} ruft die Gemini-Kurzschluesse nicht`, () => {
      // Kommentare duerfen sie nennen — dort steht, warum sie hier weg sind.
      const ohneKommentare = quelle
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      expect(ohneKommentare).not.toMatch(/getGeminiApiKey\s*\(/)
      expect(ohneKommentare).not.toMatch(/setGeminiApiKey\s*\(/)
      // Und auch nicht am Umweg vorbei: ein festes 'gemini' im Aufruf waere
      // derselbe Fehler mit anderer Schreibweise.
      expect(ohneKommentare).not.toMatch(/(get|set)ApiKey\(\s*'gemini'/)
    })

    it(`${name} liest den gewaehlten Anbieter`, () => {
      expect(quelle).toContain('getApiKey(getSelectedAiProvider())')
    })

    it(`${name} nennt keine Gemini-Adresse und keinen Gemini-Platzhalter fest`, () => {
      const ohneKommentare = quelle
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      // Titel, Adresse und Platzhalter standen fest auf Gemini — ein Fenster,
      // das nach einem `AIza…` fragt, waehrend Claude gewaehlt ist, laedt zu
      // genau dem Fehler ein, den es ausloest.
      expect(ohneKommentare).not.toContain('aistudio.google.com')
      expect(ohneKommentare).not.toContain('AIza')
      expect(ohneKommentare).not.toMatch(/'Gemini API key'/)
    })
  }
})

describe('jeder Anbieter ist vollstaendig beschrieben', () => {
  it('traegt Name, Konsolen-Adresse und die Form seines Schluessels', () => {
    for (const { id, config } of listAiProviders()) {
      expect(config.label, id).toBeTruthy()
      expect(() => new URL(config.consoleUrl), id).not.toThrow()
      expect(config.keyHint, id).toBeTruthy()
    }
  })

  it('jeder Anbieter hat seinen EIGENEN Speicherplatz', () => {
    const plaetze = listAiProviders().map(({ config }) => config.storageKey)
    expect(new Set(plaetze).size).toBe(plaetze.length)
  })
})

describe('Auswahl und Schluessel gehen nicht durcheinander', () => {
  it('ein Schluessel bei einem Anbieter macht keinen beim anderen', () => {
    setApiKey('claude', 'sk-ant-test')
    expect(getApiKey('claude')).toBe('sk-ant-test')
    expect(getApiKey('gemini')).toBe('')
    expect(getApiKey('openai')).toBe('')
    setApiKey('claude', '')
  })

  it('die Auswahl ueberlebt und die Vorgabe ist Gemini', () => {
    setSelectedAiProvider('openai')
    expect(getSelectedAiProvider()).toBe('openai')
    expect(getAiProviderConfig(getSelectedAiProvider()).label).toBe('OpenAI')
    setSelectedAiProvider('gemini')
    expect(getSelectedAiProvider()).toBe('gemini')
  })
})
