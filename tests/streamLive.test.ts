import { describe, expect, it } from 'vitest'
import { liveFehlerText, liveGrundText, liveWeg } from '../src/renderer/lib/streamLive'
import type { StreamEndpoint } from '../src/renderer/types/stream'

// #959 — welcher Weg ein Strom zum Live-Bild nimmt.
const s = (p: Partial<StreamEndpoint>): StreamEndpoint => ({ id: 'cam#1', protocol: 'rtsp', direction: 'send', ...p })
const desktop = { desktop: true }
const browser = { desktop: false, seitenProtokoll: 'http:', nativesHls: true }

describe('liveWeg', () => {
  it('Desktop: RTSP ueber ffmpeg mit Schluesselbund-Account', () => {
    const w = liveWeg(s({ url: 'rtsp://10.0.0.5/s1' }), desktop)
    expect(w).toMatchObject({ ok: true, weg: 'ffmpeg', url: 'rtsp://10.0.0.5/s1', credentialId: 'cam_1-url' })
  })
  it('ohne Adresse oder nur empfangend: Grund', () => {
    expect(liveWeg(s({}), desktop)).toEqual({ ok: false, grund: 'no-url' })
    expect(liveWeg(s({ url: 'rtsp://x', direction: 'receive' }), desktop)).toEqual({ ok: false, grund: 'receive-only' })
  })
  it('Desktop: NDI nicht, WHEP nur im Browser', () => {
    expect(liveWeg(s({ protocol: 'ndi', url: 'CAM (1)' }), desktop)).toEqual({ ok: false, grund: 'unsupported' })
    expect(liveWeg(s({ protocol: 'whep', url: 'http://10.0.0.5/whep' }), desktop)).toEqual({ ok: false, grund: 'browser-only' })
  })
  it('Browser: RTSP nur in der Desktop-App', () => {
    expect(liveWeg(s({ url: 'rtsp://10.0.0.5/s1' }), browser)).toEqual({ ok: false, grund: 'desktop-only' })
  })
  it('Browser: HLS nativ, MJPEG als Bild, WHEP ueber WebRTC', () => {
    expect(liveWeg(s({ protocol: 'hls', url: 'http://10.0.0.5/a.m3u8' }), browser)).toMatchObject({ ok: true, weg: 'hls' })
    expect(liveWeg(s({ protocol: 'mjpeg', url: 'http://10.0.0.5/mjpg' }), browser)).toMatchObject({ ok: true, weg: 'mjpeg' })
    expect(liveWeg(s({ protocol: 'webrtc', url: 'http://10.0.0.5/whep' }), browser)).toMatchObject({ ok: true, weg: 'whep' })
  })
  it('Browser: HLS ohne native Unterstuetzung und Mixed Content', () => {
    expect(liveWeg(s({ protocol: 'hls', url: 'http://10.0.0.5/a.m3u8' }), { ...browser, nativesHls: false })).toEqual({ ok: false, grund: 'no-native-hls' })
    expect(liveWeg(s({ protocol: 'hls', url: 'http://10.0.0.5/a.m3u8' }), { ...browser, seitenProtokoll: 'https:' })).toEqual({ ok: false, grund: 'mixed-content' })
    expect(liveWeg(s({ protocol: 'hls', url: 'https://cam.local/a.m3u8' }), { ...browser, seitenProtokoll: 'https:' })).toMatchObject({ ok: true })
  })
  it('jeder Grund und Fehler hat einen Satz', () => {
    const t = (_k: string, f: string) => f
    for (const g of ['no-url', 'receive-only', 'unsupported', 'desktop-only', 'browser-only', 'mixed-content', 'no-native-hls'] as const) {
      expect(liveGrundText(g, t).length).toBeGreaterThan(10)
    }
    expect(liveFehlerText('not-local', t)).toMatch(/local network/)
    expect(liveFehlerText('whatever', t)).toMatch(/Not reachable/)
  })
})
