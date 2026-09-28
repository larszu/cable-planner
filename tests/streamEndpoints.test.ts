import { describe, expect, it } from 'vitest'
import {
  hatteZugang,
  istVorschauUrl,
  normaliseStreams,
  protokollAusUrl,
  streamUrlOhneZugang,
  vorschauStream,
} from '../src/renderer/lib/streamEndpoints'
import { fetchSnapshot, SNAPSHOT_MAX_BYTES } from '../src/main/services/streamSnapshot'

// #946 — Streams am Geraet und das Standbild dazu.

describe('Zugangsdaten verlassen die Adresse', () => {
  it('entfernt Benutzer und Passwort, laesst den Rest', () => {
    expect(streamUrlOhneZugang('rtsp://admin:geheim@10.0.0.5:554/stream1')).toBe('rtsp://10.0.0.5:554/stream1')
    expect(hatteZugang('rtsp://admin:geheim@10.0.0.5/s')).toBe(true)
    expect(hatteZugang('rtsp://10.0.0.5/s')).toBe(false)
  })

  it('laesst einen NDI-Quellnamen stehen', () => {
    expect(streamUrlOhneZugang('CAM-1 (Studio A)')).toBe('CAM-1 (Studio A)')
  })

  it('entfernt Zugangsdaten auch aus einer alten Projektdatei', () => {
    const s = normaliseStreams([{ id: 'a', protocol: 'rtsp', direction: 'send', url: 'rtsp://u:p@cam/1', previewUrl: 'http://u:p@cam/snap.jpg' }])
    expect(s?.[0]).toMatchObject({ url: 'rtsp://cam/1', previewUrl: 'http://cam/snap.jpg' })
  })
})

describe('Normalisierung', () => {
  it('verwirft Eintraege ohne Id und setzt Unbekanntes auf die Vorgaben', () => {
    const s = normaliseStreams([{ protocol: 'rtsp' }, { id: 'b', protocol: 'quic', direction: 'seitwaerts' }])
    expect(s).toEqual([{ id: 'b', protocol: 'other', direction: 'send' }])
  })

  it('laesst ein leeres Feld weg', () => {
    expect(normaliseStreams([])).toBeUndefined()
    expect(normaliseStreams('kaputt')).toBeUndefined()
  })
})

describe('Protokoll und Vorschau', () => {
  it('erkennt das Protokoll am Schema', () => {
    expect(protokollAusUrl('rtsps://cam/1')).toBe('rtsp')
    expect(protokollAusUrl('srt://1.2.3.4:9000')).toBe('srt')
    expect(protokollAusUrl('https://cdn/x/index.m3u8')).toBe('hls')
    expect(protokollAusUrl('https://cam/')).toBeNull()
  })

  it('nimmt nur http(s) als Vorschau-Quelle', () => {
    expect(istVorschauUrl('http://cam/snapshot.jpg')).toBe(true)
    expect(istVorschauUrl('rtsp://cam/1')).toBe(false)
    expect(istVorschauUrl('file:///etc/passwd')).toBe(false)
  })

  it('zeigt nur einen eingeschalteten Stream mit brauchbarer Adresse', () => {
    expect(vorschauStream([{ id: 'a', protocol: 'rtsp', direction: 'send', showPreview: true, previewUrl: 'rtsp://x' }])).toBeNull()
    const ok = { id: 'b', protocol: 'rtsp' as const, direction: 'send' as const, showPreview: true, previewUrl: 'http://cam/s.jpg' }
    expect(vorschauStream([{ id: 'a', protocol: 'rtsp', direction: 'send', previewUrl: 'http://cam/a.jpg' }, ok])).toBe(ok)
  })
})

describe('fetchSnapshot (Main-Prozess)', () => {
  const bild = (typ: string, bytes = new Uint8Array([1, 2, 3]), status = 200) =>
    (async () => new Response(bytes, { status, headers: { 'content-type': typ } })) as unknown as typeof fetch

  it('gibt ein Bild als data-URI mit Zeitstempel zurueck', async () => {
    const r = await fetchSnapshot('http://cam/s.jpg', bild('image/jpeg'), () => new Date('2026-09-28T10:00:00Z'))
    expect(r).toEqual({ ok: true, dataUri: 'data:image/jpeg;base64,AQID', fetchedAt: '2026-09-28T10:00:00.000Z' })
  })

  it('schickt keine Zugangsdaten und nimmt nur http(s)', async () => {
    let gefragt = ''
    const holen = (async (u: string) => {
      gefragt = u
      return new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })
    }) as unknown as typeof fetch
    await fetchSnapshot('http://admin:pw@cam/s.png', holen)
    expect(gefragt).toBe('http://cam/s.png')
    expect(await fetchSnapshot('file:///etc/passwd', holen)).toEqual({ ok: false, code: 'invalid-url' })
  })

  it('lehnt ab, was kein Bild ist, und sagt warum', async () => {
    expect(await fetchSnapshot('http://cam/', bild('text/html'))).toEqual({ ok: false, code: 'not-image' })
    expect(await fetchSnapshot('http://cam/', bild('image/jpeg', new Uint8Array([1]), 401))).toEqual({ ok: false, code: 'http', status: 401 })
    const unerreichbar = (async () => { throw new TypeError('fetch failed') }) as unknown as typeof fetch
    expect(await fetchSnapshot('http://cam/', unerreichbar)).toEqual({ ok: false, code: 'unreachable' })
  })

  it('bricht einen endlosen Strom an der Groessengrenze ab', async () => {
    const riesig = new Uint8Array(SNAPSHOT_MAX_BYTES + 10)
    expect(await fetchSnapshot('http://cam/', bild('image/jpeg', riesig))).toEqual({ ok: false, code: 'too-large' })
  })
})
