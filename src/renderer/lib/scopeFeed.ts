// larszu/lz-scopes#15 — die Renderer-Seite des Scope-Transports.
//
// Fragt den Main-Prozess nach einem Strom, nimmt den MessagePort an, den er
// zurueckschickt, und reicht Info und Bilder an eine Senke weiter —
// `Source.pushInfo`/`pushFrame` aus lz-scopes. Jedes Bild wird quittiert; der
// Main-Prozess schickt nur, solange hoechstens zwei unquittiert sind, und
// verwirft sonst (`streamScopeService.ts`).
//
// OHNE lz-scopes-Import: dieses Modul liegt im Haupt-Chunk, die Scopes selbst
// werden erst geladen, wenn ein Panel aufgeht (`components/Scopes`).

import type { CablePlannerApi, StreamScopeStartResult } from './bridge'
import { scopeQuelle } from './scopes'
import type { StreamEndpoint } from '../types/stream'

/** Wie `StreamInfo` in lz-scopes (`sources.ts`); `ScopeInfo` im Main-Prozess. */
export interface ScopeStreamInfo {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  depth: 8 | 16
  fps: number
  codec?: string
  pixFmt?: string
  decodeMatrix?: string
  transfer?: string
  primaries?: string
  matrix?: string
  range?: string
}

export interface ScopeSink {
  pushInfo: (info: ScopeStreamInfo) => void
  pushFrame: (buf: ArrayBuffer) => void
}

export type ScopeFeedZustand =
  | { phase: 'start' }
  /** Main hat angenommen und oeffnet den Strom (Probe, bis ~15 s). */
  | { phase: 'oeffnet' }
  | { phase: 'live'; info: ScopeStreamInfo }
  | { phase: 'fehler'; code: Extract<StreamScopeStartResult, { ok: false }>['code'] | 'unreachable' | 'ended' }

type PortNachricht =
  | { type: 'info'; info: ScopeStreamInfo }
  | { type: 'frame'; buf: ArrayBuffer }
  | { type: 'end'; code: 'unreachable' | 'ended' }

/** Wo der Port ankommt: `window` (Preload → Hauptwelt, `preload.cts`). */
export interface PortEmpfang {
  addEventListener: (type: 'message', fn: (e: MessageEvent) => void) => void
  removeEventListener: (type: 'message', fn: (e: MessageEvent) => void) => void
}

export interface ScopeFeedOptionen {
  depth?: 8 | 16
  /** Analysebreite in px; 0 = nativ. */
  width?: number
  api?: CablePlannerApi['streamScope']
  empfang?: PortEmpfang
}

const neueId = (): string => `s${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`

/**
 * Oeffnet einen Scope-Strom fuer `stream`. Gibt eine Funktion zurueck, die ihn
 * wieder schliesst — ruft sie beim Abbau des Panels, sonst laeuft ffmpeg weiter.
 */
export async function oeffneScopeFeed(
  stream: StreamEndpoint,
  sink: ScopeSink,
  onZustand: (z: ScopeFeedZustand) => void,
  o: ScopeFeedOptionen = {},
): Promise<() => void> {
  const quelle = scopeQuelle(stream)
  if (!quelle) {
    onZustand({ phase: 'fehler', code: 'unsupported' })
    return () => {}
  }
  const api = o.api ?? (await import('./bridge')).cablePlannerApi.streamScope
  const empfang: PortEmpfang = o.empfang ?? window
  const id = neueId()
  let port: MessagePort | null = null
  let zu = false

  const aufPort = (e: MessageEvent) => {
    const d = e.data as { lzScopePort?: unknown } | null
    if (d?.lzScopePort !== id || e.ports.length !== 1) return
    // Nur vom eigenen Fenster: ein Frame in der Seite kaeme sonst mit
    // einem eigenen Port durch dieselbe Tuer.
    if (e.source !== null && e.source !== (empfang as unknown)) return
    empfang.removeEventListener('message', aufPort)
    port = e.ports[0]
    if (zu) {
      port.postMessage({ type: 'stop' })
      port.close()
      return
    }
    port.onmessage = (m: MessageEvent<PortNachricht>) => {
      const n = m.data
      if (n.type === 'frame') {
        sink.pushFrame(n.buf)
        port?.postMessage({ type: 'ack' })
      } else if (n.type === 'info') {
        sink.pushInfo(n.info)
        onZustand({ phase: 'live', info: n.info })
      } else if (n.type === 'end') {
        onZustand({ phase: 'fehler', code: n.code })
      }
    }
    onZustand({ phase: 'oeffnet' })
    port.start()
  }
  empfang.addEventListener('message', aufPort)
  onZustand({ phase: 'start' })

  const r = await api
    .start({ id, credentialId: quelle.credentialId, protocol: stream.protocol, url: quelle.url, depth: o.depth ?? 8, width: o.width ?? 960 })
    .catch(() => ({ ok: false as const, code: 'unreachable' as const }))
  if (!r.ok) {
    empfang.removeEventListener('message', aufPort)
    if (!zu) onZustand({ phase: 'fehler', code: r.code })
  } else if (!zu && !port) {
    onZustand({ phase: 'oeffnet' })
  }

  return () => {
    zu = true
    empfang.removeEventListener('message', aufPort)
    if (port) {
      port.postMessage({ type: 'stop' })
      port.close()
    } else if (r.ok) {
      void api.stop(id)
    }
  }
}

/** Text zum Zustand; `null` = live, dann zeigt die Zeile Format und Bildrate. */
export function scopeZustandText(z: ScopeFeedZustand, t: (k: string, f: string) => string): string | null {
  switch (z.phase) {
    case 'start':
      return t('scopes.starting', 'Starting …')
    case 'oeffnet':
      return t('scopes.opening', 'Opening the stream (ffmpeg) …')
    case 'live':
      return null
    default:
      switch (z.code) {
        case 'desktop-only':
          return t('scopes.err.desktopOnly', 'Scopes need the desktop app (ffmpeg).')
        case 'not-local':
          return t('scopes.err.notLocal', 'No scopes: the stream address is not in the local network.')
        case 'no-ffmpeg':
          return t('scopes.err.noFfmpeg', 'No scopes: ffmpeg was not found. Install ffmpeg to measure this stream.')
        case 'unsupported':
          return t('scopes.err.unsupported', 'No scopes for this protocol. Measurable: RTSP, RTMP, SRT, HLS, MJPEG.')
        case 'invalid-url':
          return t('scopes.err.invalidUrl', 'No scopes: the stream address cannot be read.')
        case 'busy':
          return t('scopes.err.busy', 'No scopes: four streams are already being measured. Close one first.')
        case 'ended':
          return t('scopes.err.ended', 'The stream has ended.')
        default:
          return t('scopes.err.unreachable', 'No scopes: the stream cannot be opened.')
      }
  }
}
