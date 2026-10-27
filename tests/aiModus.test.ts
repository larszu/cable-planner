import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeWithAI,
  setApiKey,
  setSelectedAiProvider,
  suggestFromAI,
} from '../src/renderer/lib/aiSuggestions'
import {
  AI_MODUS_PROFILE,
  AI_MODUS_VORGABE,
  aiModell,
  setAiModus,
} from '../src/renderer/lib/aiModus'
import { kostenSchaetzen, verbrauchLeeren, verbrauchSumme } from '../src/renderer/lib/aiKosten'
import { cacheLeeren, setCacheAktiv } from '../src/renderer/lib/aiAntwortCache'

/**
 * Der KI-Modus entscheidet, was eine Abfrage kosten darf (#1172).
 *
 * WARUM ES DAS GIBT. Gemeldet 2026-10-27: „api abfragen zum generieren von
 * geraeten kosten ca 2,50 dollar pro 10 geraete. das ist zu teuer." Nachgerechnet
 * lagen die 25 Cent je Geraet nicht am Prompt, sondern an vier Werten, die fest
 * im Quelltext standen: `claude-opus-5-5`, Denktiefe nach Vorgabe, fuenf
 * Websuchen, 16000 Token. Jede Suche legt den Seiteninhalt in den Kontext, und
 * jeder weitere Schritt derselben Antwort zahlt ihn erneut als Eingabe.
 *
 * Diese Tests halten fest, dass die vier Werte aus dem Modus kommen und nicht
 * mehr aus dem Quelltext — und dass die Vorgabe nicht der teuerste Modus ist.
 * Genau das war der Fehler: `genau` war kein waehlbarer Modus, sondern der
 * einzige.
 */
const antwort = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

const CLAUDE_OK = {
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{"ports":[{"direction":"out","label":"SDI","connector":"BNC"}]}' }],
  usage: {
    input_tokens: 1200,
    output_tokens: 400,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    server_tool_use: { web_search_requests: 2 },
  },
}

const fetchMock = () => {
  const f = vi.fn(async () => antwort(CLAUDE_OK))
  vi.stubGlobal('fetch', f)
  return f
}

const koerper = (f: ReturnType<typeof fetchMock>, i = 0) =>
  JSON.parse((f.mock.calls[i][1] as RequestInit).body as string) as Record<string, never>

describe('KI-Modus', () => {
  beforeEach(() => {
    setSelectedAiProvider('claude')
    setApiKey('claude', 'sk-ant-test')
    cacheLeeren()
    verbrauchLeeren()
    setAiModus(AI_MODUS_VORGABE)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setApiKey('claude', '')
    cacheLeeren()
    verbrauchLeeren()
  })

  it('kommt nicht im teuersten Modus aus der Packung', () => {
    expect(AI_MODUS_VORGABE).not.toBe('genau')
    expect(aiModell('claude')).toBe('claude-sonnet-5-5')
    expect(AI_MODUS_PROFILE[AI_MODUS_VORGABE].webSuchen).toBeLessThan(
      AI_MODUS_PROFILE.genau.webSuchen,
    )
  })

  it('nimmt Modell, Denktiefe, Suchanzahl und Deckel aus dem Modus', async () => {
    setAiModus('genau')
    const f = fetchMock()
    await suggestFromAI('Sony BRC-X400', 'Kamera')
    const b1 = koerper(f) as unknown as {
      model: string
      max_tokens: number
      output_config: { effort: string }
      tools?: Array<{ max_uses: number }>
    }
    expect(b1.model).toBe('claude-opus-5-5')
    expect(b1.max_tokens).toBe(16000)
    expect(b1.output_config.effort).toBe('high')
    expect(b1.tools?.[0].max_uses).toBe(5)

    vi.unstubAllGlobals()
    cacheLeeren()
    setAiModus('sparsam')
    const g = fetchMock()
    await suggestFromAI('Sony BRC-X400', 'Kamera')
    const b2 = koerper(g) as unknown as {
      model: string
      max_tokens: number
      output_config: { effort: string }
      tools?: unknown
      fallbacks?: unknown
    }
    expect(b2.model).toBe('claude-haiku-5-5')
    expect(b2.max_tokens).toBe(4000)
    expect(b2.output_config.effort).toBe('low')
    // Ohne Suche gibt es kein Werkzeug — und Haiku 5.5 kennt den
    // Server-Ersatz bei Sicherheitsabsage nicht, ein `fallbacks` waere eine 400.
    expect(b2.tools).toBeUndefined()
    expect(b2.fallbacks).toBeUndefined()
  })

  it('schickt die unveraenderliche Anleitung als gecachten System-Block', async () => {
    const f = fetchMock()
    await suggestFromAI('Blackmagic ATEM 4 M/E', 'Mischer')
    const b = koerper(f) as unknown as {
      system: Array<{ type: string; text: string; cache_control: { type: string } }>
      messages: Array<{ content: string }>
    }
    expect(b.system[0].cache_control.type).toBe('ephemeral')
    // Die Vokabellisten gehoeren in den gecachten Teil, der Geraetename nicht.
    expect(b.system[0].text).toContain('JSON schema')
    expect(b.system[0].text).not.toContain('ATEM 4 M/E')
    expect(b.messages[0].content).toContain('Blackmagic ATEM 4 M/E')
  })

  it('fragt dieselbe Frage nur einmal', async () => {
    const f = fetchMock()
    await suggestFromAI('Panasonic AW-UE150', 'Kamera')
    await suggestFromAI('Panasonic AW-UE150', 'Kamera')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('cacht nicht ueber den Modus hinweg', async () => {
    const f = fetchMock()
    await suggestFromAI('Panasonic AW-UE150', 'Kamera')
    setAiModus('genau')
    await suggestFromAI('Panasonic AW-UE150', 'Kamera')
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('cacht nichts mit Anhang — Fotos sind zu gross und nie byteweise gleich', async () => {
    const f = fetchMock()
    const foto = 'data:image/jpeg;base64,AAAA'
    await completeWithAI('front panel', [foto])
    await completeWithAI('front panel', [foto])
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('kann abgeschaltet werden', async () => {
    setCacheAktiv(false)
    const f = fetchMock()
    await suggestFromAI('Ross Carbonite', 'Mischer')
    await suggestFromAI('Ross Carbonite', 'Mischer')
    expect(f).toHaveBeenCalledTimes(2)
    setCacheAktiv(true)
  })

  it('verbucht Token und Suchen der Antwort', async () => {
    fetchMock()
    await suggestFromAI('Sony BRC-X400', 'Kamera')
    const s = verbrauchSumme()
    expect(s.abfragen).toBe(1)
    expect(s.ein).toBe(1200)
    expect(s.aus).toBe(400)
    expect(s.suchen).toBe(2)
    // 1200 Eingabe + 400 Ausgabe bei Sonnet 5.5 + 2 Suchen = $0,0264.
    expect(s.usd).toBeCloseTo(0.0264, 4)
  })

  it('schaetzt den Preis je Modell und raet nicht bei unbekannten', () => {
    const roh = { provider: 'claude' as const, ein: 1e6, aus: 0, cache: 0, cacheNeu: 0, suchen: 0 }
    expect(kostenSchaetzen({ ...roh, modell: 'claude-opus-5-5' })).toBeCloseTo(4, 6)
    expect(kostenSchaetzen({ ...roh, modell: 'claude-haiku-5-5' })).toBeCloseTo(0.1, 6)
    expect(kostenSchaetzen({ ...roh, modell: 'was-neues' })).toBeUndefined()
  })
})
