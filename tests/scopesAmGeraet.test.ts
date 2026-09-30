import { describe, expect, it, vi } from 'vitest'
import { messpunkt, plaketteStream, scopeQuelle, scopeQuellName, vergleichsStreams } from '../src/renderer/lib/scopes'
import { normaliseStream } from '../src/renderer/lib/streamEndpoints'
import { oeffneScopeFeed, type PortEmpfang, type ScopeFeedZustand } from '../src/renderer/lib/scopeFeed'
import { PATTERN_GROUPS_EN, PATTERN_NAMES_EN } from '../src/renderer/lib/testPatternNames'
import { PATTERNS } from '../src/renderer/vendor/lz-scopes/src/patterns'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { StreamEndpoint } from '../src/renderer/types/stream'

// larszu/lz-scopes#15 — Scopes am Geraet: Auswahl der Quelle, Messpunkt am
// Kabel, Vergleich, Transport im Renderer.

const rtsp: StreamEndpoint = { id: 'cam1#stream-a', protocol: 'rtsp', direction: 'send', url: 'rtsp://10.0.0.5/main', label: 'Main' }
const geraet = (id: string, streams?: StreamEndpoint[]) => ({ id, name: id.toUpperCase(), streams }) as unknown as EquipmentItem

describe('welcher Strom sich messen laesst', () => {
  it('nur gesendete Stroeme in einem Protokoll, das ffmpeg oeffnet', () => {
    expect(scopeQuelle(rtsp)).toEqual({ url: 'rtsp://10.0.0.5/main', credentialId: 'cam1_stream-a-url' })
    expect(scopeQuelle({ ...rtsp, direction: 'receive' })).toBeNull()
    expect(scopeQuelle({ ...rtsp, protocol: 'ndi' })).toBeNull()
    expect(scopeQuelle({ ...rtsp, url: undefined, previewUrl: 'http://10.0.0.5/snap.jpg' })).toBeNull()
  })

  it('die Plakette ist aus, bis sie jemand einschaltet, und reist mit der Datei', () => {
    expect(plaketteStream([rtsp])).toBeNull()
    expect(plaketteStream([{ ...rtsp, showScope: true }])?.id).toBe(rtsp.id)
    expect(normaliseStream({ ...rtsp, showScope: true })?.showScope).toBe(true)
    expect(normaliseStream({ ...rtsp, showScope: 'ja' })?.showScope).toBeUndefined()
  })

  it('Quellname', () => {
    expect(scopeQuellName('Kamera 1', rtsp)).toBe('Kamera 1 · RTSP Main')
  })
})

describe('Signal messen am Kabel', () => {
  const kabel = { fromEquipmentId: 'cam1', type: 'BNC' as const, standard: 'SDI-12G' as never }

  it('misst den Strom des Geraets am Anfang der Leitung', () => {
    const r = messpunkt(kabel, [geraet('cam1', [rtsp]), geraet('mon')])
    expect(r.ok && r.stream.id).toBe(rtsp.id)
  })

  it('ohne Strom sagt die Antwort, was auf der Leitung laeuft', () => {
    expect(messpunkt(kabel, [geraet('cam1')])).toEqual({ ok: false, grund: 'no-stream', signal: 'SDI-12G' })
    expect(messpunkt({ ...kabel, standard: undefined }, [geraet('cam1', [{ ...rtsp, protocol: 'ndi' }])])).toEqual({
      ok: false,
      grund: 'no-stream',
      signal: 'BNC',
    })
    expect(messpunkt(kabel, [])).toEqual({ ok: false, grund: 'no-source' })
  })
})

describe('Scopes vergleichen', () => {
  it('je Geraet der erste messbare Strom, in der Reihenfolge der Auswahl', () => {
    const b: StreamEndpoint = { ...rtsp, id: 'cam2#stream-b' }
    const eq = [geraet('cam1', [rtsp]), geraet('cam2', [{ ...b, protocol: 'dante' }, { ...b, id: 'cam2#stream-c' }]), geraet('mic')]
    expect(vergleichsStreams(['cam2', 'mic', 'cam1'], eq)).toEqual(['cam2#stream-c', rtsp.id])
  })
})

describe('Transport im Renderer', () => {
  const aufbau = () => {
    const hoerer = new Set<(e: MessageEvent) => void>()
    const empfang: PortEmpfang = {
      addEventListener: (_t, fn) => hoerer.add(fn),
      removeEventListener: (_t, fn) => hoerer.delete(fn),
    }
    const kanal = new MessageChannel()
    const api = {
      start: vi.fn(async (req: { id: string }) => {
        for (const fn of [...hoerer]) {
          fn({ data: { lzScopePort: 'fremd' }, ports: [new MessageChannel().port1], source: empfang } as unknown as MessageEvent)
          fn({ data: { lzScopePort: req.id }, ports: [kanal.port2], source: empfang } as unknown as MessageEvent)
        }
        return { ok: true as const }
      }),
      stop: vi.fn(async () => {}),
    }
    return { empfang, kanal, api, hoerer }
  }

  it('reicht Info und Bilder an die Senke und quittiert jedes Bild', async () => {
    const { empfang, kanal, api, hoerer } = aufbau()
    const sink = { pushInfo: vi.fn(), pushFrame: vi.fn() }
    const zustaende: ScopeFeedZustand[] = []
    const acks: unknown[] = []
    kanal.port1.onmessage = (m) => acks.push(m.data)
    const zu = await oeffneScopeFeed(rtsp, sink, (z) => zustaende.push(z), { api, empfang })
    expect(api.start).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'rtsp', url: 'rtsp://10.0.0.5/main', credentialId: 'cam1_stream-a-url', depth: 8 }))
    expect(hoerer.size).toBe(0)
    const info = { width: 4, height: 2, sourceWidth: 1920, sourceHeight: 1080, depth: 8, fps: 25 }
    kanal.port1.postMessage({ type: 'info', info })
    kanal.port1.postMessage({ type: 'frame', buf: new ArrayBuffer(32) })
    await vi.waitFor(() => expect(sink.pushFrame).toHaveBeenCalledTimes(1))
    expect(sink.pushInfo).toHaveBeenCalledWith(info)
    expect(zustaende.map((z) => z.phase)).toContain('live')
    await vi.waitFor(() => expect(acks).toContainEqual({ type: 'ack' }))
    zu()
    await vi.waitFor(() => expect(acks).toContainEqual({ type: 'stop' }))
    kanal.port1.close()
  })

  it('meldet den Code, wenn der Main-Prozess ablehnt', async () => {
    const zustaende: ScopeFeedZustand[] = []
    const api = { start: vi.fn(async () => ({ ok: false as const, code: 'no-ffmpeg' as const })), stop: vi.fn(async () => {}) }
    const empfang: PortEmpfang = { addEventListener: () => {}, removeEventListener: () => {} }
    await oeffneScopeFeed(rtsp, { pushInfo: vi.fn(), pushFrame: vi.fn() }, (z) => zustaende.push(z), { api, empfang })
    expect(zustaende.at(-1)).toEqual({ phase: 'fehler', code: 'no-ffmpeg' })
  })

  it('fragt fuer einen nicht messbaren Strom gar nicht erst', async () => {
    const api = { start: vi.fn(), stop: vi.fn() }
    const zustaende: ScopeFeedZustand[] = []
    await oeffneScopeFeed({ ...rtsp, protocol: 'ndi' }, { pushInfo: vi.fn(), pushFrame: vi.fn() }, (z) => zustaende.push(z), { api: api as never })
    expect(api.start).not.toHaveBeenCalled()
    expect(zustaende).toEqual([{ phase: 'fehler', code: 'unsupported' }])
  })
})

describe('Testbild-Namen', () => {
  it('jedes Muster aus lz-scopes hat einen englischen Namen und eine Gruppe', () => {
    expect(PATTERNS.filter((p) => !PATTERN_NAMES_EN[p.id]).map((p) => p.id)).toEqual([])
    expect([...new Set(PATTERNS.map((p) => p.group))].filter((g) => !PATTERN_GROUPS_EN[g])).toEqual([])
  })
})
