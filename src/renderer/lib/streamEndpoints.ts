// #946 — Streams am Geraet: Normalisierung und Ableitungen. Typen und die
// Begruendung stehen in `types/stream.ts`.
//
// REIN: keine Uhr, kein Store, kein IO.

import {
  STREAM_DIRECTIONS,
  STREAM_PROTOCOLS,
  type StreamDirection,
  type StreamEndpoint,
  type StreamProtocol,
} from '../types/stream'

/**
 * Entfernt Benutzer und Passwort aus einer Adresse (`rtsp://u:p@host/…` →
 * `rtsp://host/…`). Was sich nicht als URL lesen laesst (NDI-Quellname,
 * halb getippte Adresse), bleibt unveraendert — ausser es enthaelt
 * erkennbar `schema://…@`, dann wird der Teil davor trotzdem entfernt.
 */
export function streamUrlOhneZugang(raw: string): string {
  const s = raw.trim()
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#@]*@)(.*)$/i.exec(s)
  return m ? `${m[1]}${m[3]}` : s
}

/** Hatte die Adresse Zugangsdaten? Die Oberflaeche sagt es, statt still zu kuerzen. */
export const hatteZugang = (raw: string): boolean => streamUrlOhneZugang(raw) !== raw.trim()

/** Protokoll aus dem Schema der Adresse, soweit eindeutig. */
export function protokollAusUrl(raw: string): StreamProtocol | null {
  const schema = /^([a-z][a-z0-9+.-]*):\/\//i.exec(raw.trim())?.[1]?.toLowerCase()
  switch (schema) {
    case 'rtsp':
    case 'rtsps':
      return 'rtsp'
    case 'srt':
      return 'srt'
    case 'rtmp':
    case 'rtmps':
      return 'rtmp'
    case 'ndi':
      return 'ndi'
    default:
      return raw.trim().toLowerCase().endsWith('.m3u8') ? 'hls' : null
  }
}

/** Nur http(s) taugt als Vorschau-Quelle: die App holt ein Standbild, keinen Strom. */
export function istVorschauUrl(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

/** Ein gespeicherter Eintrag, wie er aus einer (fremden, alten) Datei kommt. */
export function normaliseStream(raw: unknown): StreamEndpoint | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !r.id) return null
  const protocol = STREAM_PROTOCOLS.includes(r.protocol as StreamProtocol) ? (r.protocol as StreamProtocol) : 'other'
  const direction = STREAM_DIRECTIONS.includes(r.direction as StreamDirection)
    ? (r.direction as StreamDirection)
    : 'send'
  const url = text(r.url)
  const previewUrl = text(r.previewUrl)
  return {
    id: r.id,
    protocol,
    direction,
    ...(text(r.label) ? { label: text(r.label) } : {}),
    ...(url ? { url: streamUrlOhneZugang(url) } : {}),
    ...(previewUrl ? { previewUrl: streamUrlOhneZugang(previewUrl) } : {}),
    ...(r.showPreview === true ? { showPreview: true } : {}),
    ...(text(r.notes) ? { notes: text(r.notes) } : {}),
  }
}

export function normaliseStreams(raw: unknown): StreamEndpoint[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw.map(normaliseStream).filter((s): s is StreamEndpoint => s !== null)
  return out.length > 0 ? out : undefined
}

/** Der Strom, dessen Standbild die Kachel am Canvas zeigt: der erste mit
 *  eingeschalteter Vorschau und brauchbarer Adresse. */
export const vorschauStream = (streams: StreamEndpoint[] | undefined): StreamEndpoint | null =>
  streams?.find((s) => s.showPreview && istVorschauUrl(s.previewUrl)) ?? null

export const protokollName = (p: StreamProtocol): string =>
  p === 'st2110' ? 'ST 2110' : p === 'webrtc' ? 'WebRTC' : p === 'other' ? '' : p.toUpperCase()
