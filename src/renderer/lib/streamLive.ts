// #959 — Live-Bild der Streams am Geraet. REIN: kein Store, kein IO.
//
// Welcher Weg ein Strom zum Bild nimmt, haengt an der Ausgabe:
//
//  * DESKTOP: was ffmpeg oeffnet (RTSP, RTMP, SRT, HLS, MJPEG), laeuft ueber
//    denselben Weg wie die Scopes (`streamScopeService`, MessagePort, nur
//    lokales Netz, Zugangsdaten aus dem Schluesselbund). Kein zweiter Weg zur
//    Kamera und keine neue Abhaengigkeit: die Rohbilder landen in einem
//    Canvas. Die CSP des Fensters bleibt, wie sie ist — deshalb gibt es dort
//    kein WebRTC/WHEP (das braeuchte `connect-src` auf beliebige Hosts).
//  * BROWSER (Pages, dev:renderer): kein ffmpeg. Abspielbar ist, was der
//    Browser selbst kann: HLS, wo er es nativ spielt (Safari, neuere
//    Chromium), MJPEG als Bild, WebRTC ueber WHEP. Eine https-Seite darf keine
//    http-Adresse laden (Mixed Content) — das wird gesagt, statt ein
//    schwarzes Feld zu zeigen.
//
// Alles andere (NDI, Dante, ST 2110 …) bekommt einen klaren Satz statt eines
// Players.

import { FFMPEG_PROTOKOLLE, zugangsSchluessel } from './streamEndpoints'
import type { StreamEndpoint } from '../types/stream'

export type LiveWeg =
  | { ok: true; weg: 'ffmpeg'; url: string; credentialId: string }
  | { ok: true; weg: 'hls' | 'mjpeg' | 'whep'; url: string }
  | { ok: false; grund: LiveGrund }

export type LiveGrund =
  /** Keine Adresse eingetragen. */
  | 'no-url'
  /** Das Geraet empfaengt diesen Strom nur. */
  | 'receive-only'
  /** Protokoll, das hier niemand abspielt (NDI, Dante, ST 2110 …). */
  | 'unsupported'
  /** Im Browser nicht abspielbar; die Desktop-App kann es (ffmpeg). */
  | 'desktop-only'
  /** WebRTC/WHEP spielt nur der Browser, nicht die Desktop-App. */
  | 'browser-only'
  /** https-Seite, http-Adresse: der Browser blockiert. */
  | 'mixed-content'
  /** HLS, aber dieser Browser spielt es nicht nativ. */
  | 'no-native-hls'

export interface LiveUmgebung {
  /** Desktop-App mit Main-Prozess (ffmpeg-Weg). */
  desktop: boolean
  /** `location.protocol` der Seite. */
  seitenProtokoll?: string
  /** `video.canPlayType('application/vnd.apple.mpegurl')` ist nicht leer. */
  nativesHls?: boolean
}

const istHttp = (url: string) => /^http:\/\//i.test(url)
const istHttpOderHttps = (url: string) => /^https?:\/\//i.test(url)

export function liveWeg(s: StreamEndpoint, u: LiveUmgebung): LiveWeg {
  const url = s.url?.trim()
  if (!url) return { ok: false, grund: 'no-url' }
  if (s.direction === 'receive') return { ok: false, grund: 'receive-only' }
  const webrtc = s.protocol === 'webrtc' || s.protocol === 'whep'

  if (u.desktop) {
    if (FFMPEG_PROTOKOLLE.has(s.protocol)) {
      return { ok: true, weg: 'ffmpeg', url, credentialId: zugangsSchluessel(s.id, 'url') }
    }
    return { ok: false, grund: webrtc && istHttpOderHttps(url) ? 'browser-only' : 'unsupported' }
  }

  const browserWeg = s.protocol === 'hls' ? 'hls' : s.protocol === 'mjpeg' ? 'mjpeg' : webrtc ? 'whep' : null
  if (!browserWeg) {
    return { ok: false, grund: FFMPEG_PROTOKOLLE.has(s.protocol) ? 'desktop-only' : 'unsupported' }
  }
  if (!istHttpOderHttps(url)) return { ok: false, grund: 'unsupported' }
  if (u.seitenProtokoll === 'https:' && istHttp(url)) return { ok: false, grund: 'mixed-content' }
  if (browserWeg === 'hls' && !u.nativesHls) return { ok: false, grund: 'no-native-hls' }
  return { ok: true, weg: browserWeg, url }
}

/** Erreichbarkeit, wie die Oberflaeche sie zeigt. */
export type LiveZustand =
  | { phase: 'verbindet' }
  | { phase: 'live'; breite?: number; hoehe?: number; fps?: number }
  | { phase: 'fehler'; code: string }

export function liveGrundText(g: LiveGrund, t: (k: string, f: string) => string): string {
  switch (g) {
    case 'no-url':
      return t('streams.live.why.noUrl', 'No live view: enter the stream address first.')
    case 'receive-only':
      return t('streams.live.why.receiveOnly', 'No live view: this device only receives the stream.')
    case 'desktop-only':
      return t('streams.live.why.desktopOnly', 'No live view in the browser: RTSP, RTMP and SRT are played by the desktop app (needs ffmpeg). In the browser: HLS, MJPEG and WebRTC (WHEP).')
    case 'browser-only':
      return t('streams.live.why.browserOnly', 'No live view in the desktop app for WebRTC. Open the plan in the browser to play WHEP.')
    case 'mixed-content':
      return t('streams.live.why.mixedContent', 'No live view: this page is served over https and the browser blocks the http address of the stream.')
    case 'no-native-hls':
      return t('streams.live.why.noNativeHls', 'No live view: this browser does not play HLS by itself. Use Safari or the desktop app.')
    default:
      return t('streams.live.why.unsupported', 'No live view for this protocol. Playable: RTSP, RTMP, SRT, HLS, MJPEG (desktop app) and HLS, MJPEG, WebRTC/WHEP (browser).')
  }
}

export function liveFehlerText(code: string, t: (k: string, f: string) => string): string {
  switch (code) {
    case 'not-local':
      return t('streams.live.err.notLocal', 'Not reachable: the stream address is not in the local network.')
    case 'no-ffmpeg':
      return t('streams.live.err.noFfmpeg', 'No live view: ffmpeg was not found. Install ffmpeg to play this stream.')
    case 'busy':
      return t('streams.live.err.busy', 'No live view: four streams are already open. Close one first.')
    case 'invalid-url':
      return t('streams.live.err.invalidUrl', 'No live view: the stream address cannot be read.')
    case 'ended':
      return t('streams.live.err.ended', 'The stream has ended.')
    case 'unsupported':
    case 'desktop-only':
      return t('streams.live.err.unsupported', 'No live view for this protocol here.')
    default:
      return t('streams.live.err.unreachable', 'Not reachable: the device does not answer on this address.')
  }
}

/** Ein WHEP-Angebot: nur empfangen, Bild und Ton. */
export const WHEP_CONTENT_TYPE = 'application/sdp'
