import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  erkennePortsAusFotos,
  leseFotoAntwort,
  steckerAbbilden,
} from '../src/renderer/lib/fotoPortErkennung'
import { setApiKey, setSelectedAiProvider, zerlegeDataUri, type AiProvider } from '../src/renderer/lib/aiSuggestions'
import { buildPorts, erkennungZuGruppen } from '../src/renderer/components/Library/libraryPanelHelpers'

// Ports aus einem Foto (2026-09-28). Die Anbieter-Antworten sind gemockt:
// geprueft wird, was WIR daraus machen — Stecker aufs Vokabular, unsichere
// Zeilen markiert, nichts erfunden.

const ANTWORT = JSON.stringify({
  manufacturer: 'Blackmagic Design',
  model: 'ATEM Mini Pro',
  modelSure: true,
  ports: [
    { direction: 'in', label: 'HDMI IN 1-4', count: 4, connector: 'HDMI', sure: true },
    { direction: 'out', label: 'HDMI OUT', count: 1, connector: 'hdmi', standard: 'HDMI-2.0', sure: true },
    { direction: 'bidirectional', label: 'ETHERNET', count: 1, connector: 'RJ45', sure: true },
    { direction: 'in', label: 'MIC 1', count: 2, connector: '3.5 mm jack', sure: true },
    { direction: 'in', label: '12V', count: 1, connector: 'weird barrel', sure: true },
    { direction: 'unknown', label: 'USB', count: 1, connector: 'USB-C', sure: true },
    { direction: 'out', label: '?', count: 1, connector: 'BNC', sure: false },
  ],
})

describe('Stecker aufs Vokabular', () => {
  it('nimmt Vokabular-Namen in jeder Schreibweise und belegte Aliase', () => {
    expect(steckerAbbilden('hdmi')).toEqual({ connectorType: 'HDMI', sicher: true })
    expect(steckerAbbilden('RJ-45')).toEqual({ connectorType: 'Ethernet/RJ45', sicher: true })
    expect(steckerAbbilden('HD BNC')).toEqual({ connectorType: 'HD-BNC', sicher: true })
  })
  it('macht Unbekanntes zu Custom und unsicher', () => {
    expect(steckerAbbilden('weird barrel')).toEqual({ connectorType: 'Custom', sicher: false })
    expect(steckerAbbilden(undefined)).toEqual({ connectorType: 'Custom', sicher: false })
  })
})

describe('Antwort lesen', () => {
  const r = leseFotoAntwort('```json\n' + ANTWORT + '\n```')

  it('liest Hersteller und Modell vom Typenschild', () => {
    expect(r).toMatchObject({ manufacturer: 'Blackmagic Design', model: 'ATEM Mini Pro', modelUnsicher: false })
  })

  it('bildet Richtung, Anzahl und Stecker ab', () => {
    expect(r.ports[0]).toMatchObject({ direction: 'in', count: 4, connectorType: 'HDMI', unsicher: false })
    expect(r.ports[1]).toMatchObject({ direction: 'out', connectorType: 'HDMI', standard: 'HDMI-2.0', unsicher: false })
    expect(r.ports[2]).toMatchObject({ direction: 'bidirectional', connectorType: 'Ethernet/RJ45' })
    expect(r.ports[3]).toMatchObject({ connectorType: 'Jack 3.5 mm', count: 2, unsicher: false })
  })

  it('markiert unsichere Felder statt sie zu glauben', () => {
    expect(r.ports[4]).toMatchObject({ connectorType: 'Custom', unsicher: true, connectorRoh: 'weird barrel' })
    expect(r.ports[5]).toMatchObject({ unsicher: true }) // Richtung unbekannt
    expect(r.ports[6]).toMatchObject({ connectorType: 'BNC', unsicher: true }) // Modell selbst unsicher
  })

  it('nimmt „null" nicht als Modellnamen und wirft bei kaputtem JSON', () => {
    expect(leseFotoAntwort('{"manufacturer":"null","model":null,"ports":[]}')).toEqual({ modelUnsicher: true, ports: [] })
    expect(() => leseFotoAntwort('nope')).toThrow(/invalid JSON/)
  })

  it('uebernimmt nur angehakte Zeilen und traegt Zweiwege-Ports als solche', () => {
    const zeilen = r.ports.map((p, i) => ({ ...p, id: String(i), an: !p.unsicher }))
    const gruppen = erkennungZuGruppen(zeilen)
    expect(gruppen).toHaveLength(4)
    const inputs = buildPorts(gruppen, 'in')
    expect(inputs.filter((p) => p.direction === 'bidirectional').map((p) => p.connectorType)).toEqual(['Ethernet/RJ45'])
    expect(buildPorts(gruppen, 'out')[0]).toMatchObject({ connectorType: 'HDMI', standard: 'HDMI-2.0' })
  })
})

describe('Bild an den Anbieter', () => {
  const bild = 'data:image/jpeg;base64,QUJD'
  let gesendet: { url: string; body: Record<string, unknown>; headers: Record<string, string> } | null = null

  beforeEach(() => {
    gesendet = null
    vi.stubGlobal('fetch', async (url: string, init: { body: string; headers: Record<string, string> }) => {
      gesendet = { url, body: JSON.parse(init.body), headers: init.headers }
      const text = ANTWORT
      const json = url.includes('generativelanguage')
        ? { candidates: [{ content: { parts: [{ text }] } }] }
        : url.includes('anthropic')
          ? { content: [{ type: 'text', text }] }
          : { choices: [{ message: { content: text } }] }
      return { ok: true, json: async () => json, text: async () => '' }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('zerlegt die Data-URI', () => {
    expect(zerlegeDataUri(bild)).toEqual({ mime: 'image/jpeg', data: 'QUJD' })
  })

  it.each<AiProvider>(['gemini', 'claude', 'openai'])('%s bekommt das Bild in derselben Nachricht', async (p) => {
    setSelectedAiProvider(p)
    setApiKey(p, 'test-key')
    const r = await erkennePortsAusFotos([bild])
    expect(r.ports).toHaveLength(7)
    const body = JSON.stringify(gesendet!.body)
    if (p === 'openai') expect(body).toContain(bild)
    else expect(body).toContain('"QUJD"')
    expect(body).not.toContain('test-key')
  })
})
