import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  baueErgaenzung,
  geraeteRef,
  planKontext,
  vervollstaendigePlan,
} from '../src/renderer/lib/planVervollstaendigung'
import { dokumentArt } from '../src/renderer/lib/planDokumente'
import { leseClaudeStream, setApiKey, setSelectedAiProvider } from '../src/renderer/lib/aiSuggestions'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { LocationFrame } from '../src/renderer/types/location'

const port = (id: string, name: string, connectorType = 'HDMI') =>
  ({ id, name, type: 'HDMI', connectorType }) as EquipmentItem['inputs'][number]

const raum = (id: string, name: string, x: number, y: number, width = 1000, height = 400): LocationFrame => ({
  id, name, x, y, width, height, color: '#38bdf8',
})

const geraet = (id: string, name: string, x: number, y: number, extra: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id, name, category: 'Video', inputs: [], outputs: [], x, y, width: 300, height: 100, ...extra,
})

const projekt = () => ({
  locations: [raum('r1aaaaaaaa', 'Room A 1.001', 0, 0), raum('r2bbbbbbbb', 'Room B 1.002', 0, 500)],
  equipment: [
    geraet('e1aaaaaaaa-1', 'Encoder', 50, 50, { outputs: [port('p1', 'HDMI Out')] }),
    geraet('e2bbbbbbbb-2', 'Display', 50, 550, { inputs: [port('p2', 'HDMI 1')], ipAddress: '10.0.0.5' }),
  ],
  cables: [],
})

describe('planKontext', () => {
  it('nennt Räume, Geräte mit Kurzzeichen, Raum und Ports', () => {
    const k = planKontext(projekt())
    expect(k).toContain('- Room A 1.001')
    expect(k).toContain('@e1aaaaaa | Encoder | Video | Room A 1.001')
    expect(k).toContain('out: HDMI Out')
  })
})

describe('baueErgaenzung', () => {
  it('legt Räume, Geräte aus Typen und Kabel an und markiert die Herkunft', () => {
    const p = projekt()
    const e = baueErgaenzung(p, {
      rooms: [{ name: 'Room C', roomNumber: '1.003', floor: '1st floor' }],
      types: [{ id: 't1', name: 'Speaker X', category: 'Speakers', inputs: [['IN', 'speakON 4 Pole']] }],
      devices: [
        { id: 'd1', type: 't1', room: 'Room C', ip: '10.0.0.9', src: 'list.xlsx' },
        { id: 'd2', type: 't1', room: 'Room C' },
      ],
      connections: [['@e1aaaaaa', 'HDMI Out', '@e2bbbbbb', 'HDMI 1', 'box 12', 'diagram.pdf']],
    }, 'docs')
    expect(e.neueRaeume.map((r) => r.name)).toEqual(['Room C'])
    expect(e.neueGeraete).toHaveLength(2)
    expect(e.neueGeraete[0].ipAddress).toBe('10.0.0.9')
    expect(e.neueGeraete[0].specSource?.inputs?.source).toContain('list.xlsx')
    // beide Geräte liegen im neuen Rahmen
    const r = e.neueRaeume[0]
    for (const g of e.neueGeraete) {
      expect(g.x).toBeGreaterThanOrEqual(r.x)
      expect(g.y + g.height).toBeLessThanOrEqual(r.y + r.height)
    }
    expect(e.neueKabel).toHaveLength(1)
    expect(e.neueKabel[0]).toMatchObject({ fromPortId: 'p1', toPortId: 'p2', notes: 'box 12' })
    expect(e.neueKabel[0].specSource?.connection.source).toContain('diagram.pdf')
  })

  it('füllt nur leere Felder und meldet Widersprüche, statt zu überschreiben', () => {
    const p = projekt()
    const e = baueErgaenzung(p, {
      updates: [
        { ref: geraeteRef(p.equipment[1]), ip: '10.0.0.99', serial: 'SN1', addInputs: [['LAN', 'Ethernet/RJ45'], ['HDMI 1', 'HDMI']] },
      ],
    }, 'docs')
    const a = e.geraeteAenderungen[0]
    expect(a.patch.ipAddress).toBeUndefined()
    expect(a.patch.serialNumber).toBe('SN1')
    expect(a.inputs.map((x) => x.name)).toEqual(['LAN'])
    expect(e.warnungen.join(' ')).toMatch(/10\.0\.0\.5.*10\.0\.0\.99/)
  })

  it('lässt einen gewachsenen Raum den darunter mit Inhalt nachrücken', () => {
    const p = projekt()
    const viele = Array.from({ length: 12 }, (_, i) => ({ id: `d${i}`, type: 't', room: 'Room A' }))
    const e = baueErgaenzung(p, { types: [{ id: 't', name: 'Box', inputs: [['In', 'HDMI']] }], devices: viele }, 'docs')
    const a = e.raumGeometrie.find((g) => g.id === 'r1aaaaaaaa')!
    const b = e.raumGeometrie.find((g) => g.id === 'r2bbbbbbbb')!
    expect(a.height).toBeGreaterThan(400)
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height)
    const display = e.geraetePosition.find((g) => g.equipmentId === 'e2bbbbbbbb-2')!
    expect(display.y - b.y).toBe(550 - 500)
  })

  it('überspringt Verbindungen zu unbekannten Geräten mit Warnung', () => {
    const e = baueErgaenzung(projekt(), { connections: [['@nichtda', 'Out', 'x', 'In']] }, 'docs')
    expect(e.neueKabel).toHaveLength(0)
    expect(e.warnungen[0]).toMatch(/skipped/)
  })
})

describe('dokumentArt', () => {
  it('erkennt die Dateiarten', () => {
    expect(dokumentArt('Plan.PDF')).toBe('pdf')
    expect(dokumentArt('ips.xlsx')).toBe('tabelle')
    expect(dokumentArt('a.cableplan')).toBe('plan')
    expect(dokumentArt('foto.jpg')).toBe('bild')
    expect(dokumentArt('x.exe')).toBeNull()
  })
})

const sse = (events: unknown[]) =>
  new Response(events.map((e) => `event: x\ndata: ${JSON.stringify(e)}\n\n`).join(''), { status: 200 })

describe('Claude-Stream', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setApiKey('claude', '')
  })

  it('setzt den Text aus den Deltas zusammen', async () => {
    const text = await leseClaudeStream(
      sse([
        { type: 'content_block_delta', delta: { type: 'text_delta', text: '{"a":' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: '1}' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      ]),
    )
    expect(text).toBe('{"a":1}')
  })

  it('meldet eine abgeschnittene Antwort', async () => {
    await expect(leseClaudeStream(sse([{ type: 'message_delta', delta: { stop_reason: 'max_tokens' } }]))).rejects.toThrow(/cut off/)
  })

  it('schickt PDFs als document-Block und streamt bei großer Antwort', async () => {
    setSelectedAiProvider('claude')
    setApiKey('claude', 'sk-ant-test')
    const f = vi.fn(async () =>
      sse([{ type: 'content_block_delta', delta: { type: 'text_delta', text: '{"devices":[]}' } }]),
    )
    vi.stubGlobal('fetch', f)
    const pdf = 'data:application/pdf;base64,JVBERg=='
    await vervollstaendigePlan(projekt(), [{ name: 'a.pdf', art: 'pdf', bytes: 5, dataUri: pdf }])
    const body = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(body.stream).toBe(true)
    expect(body.max_tokens).toBeGreaterThan(16000)
    expect(body.messages[0].content[0]).toMatchObject({ type: 'document', source: { media_type: 'application/pdf' } })
  })
})
