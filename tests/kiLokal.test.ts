import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeWithAI, getSelectedAiProvider, setApiKey, setSelectedAiProvider } from '../src/renderer/lib/aiSuggestions'
import { AI_MODUS_PROFILE, aiModell, preisFuer, setAiModus, setLokalesModell } from '../src/renderer/lib/aiModus'
import { kostenSchaetzen } from '../src/renderer/lib/aiKosten'
import { cacheLeeren, setCacheAktiv } from '../src/renderer/lib/aiAntwortCache'

/**
 * Der lokale KI-Anbieter (Ollama) — 2026-11-05.
 *
 * WARUM ES DAS GIBT. Kundenanlagen gehoeren nicht in fremde Rechenzentren;
 * die Fallstudie Hahn 2026 (TH Koeln) mass beim lokalen Betrieb 0,0 MB
 * Datenabfluss gegen 27,7 MB im Cloud-Lauf. Diese Tests halten die drei
 * Zusagen fest, die die Einstellungen dazu machen: die Frage geht an die
 * eingetragene Adresse, ohne Schluessel und ohne Websuche, und sie kostet
 * nichts.
 */
describe('lokaler Anbieter', () => {
  let gesendet: { url: string; body: Record<string, unknown>; headers: Record<string, string> } | null = null

  beforeEach(() => {
    gesendet = null
    localStorage.clear()
    cacheLeeren()
    setCacheAktiv(false)
    vi.stubGlobal('fetch', async (url: string, init: { body: string; headers: Record<string, string> }) => {
      gesendet = { url, body: JSON.parse(init.body), headers: init.headers }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{"ports":[]}' } }], usage: { prompt_tokens: 900, completion_tokens: 40 } }),
        text: async () => '',
      }
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setCacheAktiv(true)
  })

  it('bleibt nach dem Neuladen gewaehlt', () => {
    setSelectedAiProvider('lokal')
    expect(getSelectedAiProvider()).toBe('lokal')
  })

  it('fragt die eingetragene Adresse, ohne Schluessel und ohne Websuche', async () => {
    setSelectedAiProvider('lokal')
    setApiKey('lokal', 'http://heimserver:11434/')
    setAiModus('genau')
    await completeWithAI('frage', [], { webSearch: true })
    expect(gesendet!.url).toBe('http://heimserver:11434/v1/chat/completions')
    expect(gesendet!.headers.Authorization).toBeUndefined()
    expect(JSON.stringify(gesendet!.body)).not.toContain('web_search')
    expect(gesendet!.body.model).toBe(AI_MODUS_PROFILE.genau.modelle.lokal)
  })

  it('nimmt das eingetragene Modell in jedem Modus', () => {
    setLokalesModell('qwen3.6:35b')
    expect(aiModell('lokal', 'sparsam')).toBe('qwen3.6:35b')
    expect(aiModell('lokal', 'genau')).toBe('qwen3.6:35b')
    expect(aiModell('claude', 'genau')).toBe(AI_MODUS_PROFILE.genau.modelle.claude)
    setLokalesModell('')
    expect(aiModell('lokal', 'sparsam')).toBe(AI_MODUS_PROFILE.sparsam.modelle.lokal)
  })

  it('kostet nichts, auch mit unbekanntem Modellnamen', () => {
    expect(preisFuer('irgendein:modell', 'lokal')).toEqual({ ein: 0, aus: 0, cache: 0, suche: 0 })
    expect(preisFuer('irgendein:modell')).toBeUndefined()
    expect(kostenSchaetzen({ provider: 'lokal', modell: 'x', ein: 1e6, aus: 1e6, cache: 0, cacheNeu: 0, suchen: 0 })).toBe(0)
  })

  it('meldet einen nicht laufenden Server mit Adresse statt „Failed to fetch"', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    setSelectedAiProvider('lokal')
    setApiKey('lokal', 'http://localhost:11434')
    await expect(completeWithAI('frage')).rejects.toThrow('http://localhost:11434')
  })
})
