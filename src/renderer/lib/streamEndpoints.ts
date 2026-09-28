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
import type { EquipmentItem } from '../types/equipment'
import type { CsvCell, CsvTable } from './csv'

/**
 * Was aus einer Stream-Adresse herausgetrennt wurde (Nachtrag #946). Liegt im
 * Schluesselbund dieses Rechners, nie im Projekt.
 */
export interface StreamZugang {
  /** `benutzer:passwort` bzw. `benutzer` aus `schema://benutzer:passwort@host`. */
  userinfo?: string
  /** Geheime Query-Parameter, roh und in ihrer Reihenfolge. */
  query?: Array<[string, string]>
}

/**
 * Query-Parameter, die ein Geheimnis tragen. `passphrase` ist der SRT-
 * Schluessel; die uebrigen sind die Namen, unter denen Kamera-Firmwares und
 * Mediaserver Passwoerter und Tokens in die Adresse legen.
 */
const GEHEIME_PARAMETER = new Set([
  'passphrase',
  'password',
  'passwd',
  'pass',
  'pwd',
  'user',
  'username',
  'token',
  'access_token',
  'auth',
  'key',
  'streamkey',
  'stream_key',
  'secret',
  'sig',
  'signature',
])

/**
 * Trennt Benutzer/Passwort und geheime Query-Parameter aus einer Adresse.
 * Der Rest bleibt Zeichen fuer Zeichen, wie er eingegeben wurde — kein
 * `new URL()`, das einen NDI-Quellnamen fuer ungueltig erklaert oder einen
 * Host umschreibt.
 */
export function trenneZugang(raw: string): { url: string; zugang: StreamZugang | null } {
  let url = raw.trim()
  const zugang: StreamZugang = {}
  const m = /^([a-z][a-z0-9+.-]*:\/\/)([^/?#@]*)@(.*)$/i.exec(url)
  if (m) {
    zugang.userinfo = m[2]
    url = `${m[1]}${m[3]}`
  }
  const q = url.indexOf('?')
  if (q >= 0) {
    const hashAt = url.indexOf('#', q)
    const query = url.slice(q + 1, hashAt >= 0 ? hashAt : undefined)
    const hash = hashAt >= 0 ? url.slice(hashAt) : ''
    const bleibt: string[] = []
    const raus: Array<[string, string]> = []
    for (const teil of query.split('&')) {
      if (!teil) continue
      const eq = teil.indexOf('=')
      const name = eq >= 0 ? teil.slice(0, eq) : teil
      let klar = name
      try {
        klar = decodeURIComponent(name)
      } catch {
        // kaputte Prozent-Kodierung: roh vergleichen
      }
      if (GEHEIME_PARAMETER.has(klar.toLowerCase())) raus.push([name, eq >= 0 ? teil.slice(eq + 1) : ''])
      else bleibt.push(teil)
    }
    if (raus.length > 0) {
      zugang.query = raus
      url = url.slice(0, q) + (bleibt.length ? `?${bleibt.join('&')}` : '') + hash
    }
  }
  return { url, zugang: zugang.userinfo !== undefined || zugang.query ? zugang : null }
}

/**
 * Entfernt Zugangsdaten aus einer Adresse (`rtsp://u:p@host/…` →
 * `rtsp://host/…`, `srt://h:9000?passphrase=…` → `srt://h:9000`). Was sich
 * nicht als URL lesen laesst (NDI-Quellname, halb getippte Adresse), bleibt
 * unveraendert.
 */
export const streamUrlOhneZugang = (raw: string): string => trenneZugang(raw).url

/** Hatte die Adresse Zugangsdaten? Die Oberflaeche sagt es, statt still zu kuerzen. */
export const hatteZugang = (raw: string): boolean => trenneZugang(raw).zugang !== null

/**
 * Der Schluesselbund-Account fuer die Zugangsdaten eines Feldes. Stream-Ids
 * tragen `#` (`<geraet>#stream-…`); der Account darf nur `[A-Za-z0-9_-]`
 * enthalten — dieselbe Regel wie `isSafeDestinationId` im Main-Prozess.
 */
export const zugangsSchluessel = (streamId: string, feld: 'url' | 'previewUrl'): string =>
  `${streamId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 52)}-${feld === 'url' ? 'url' : 'prev'}`

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
    ...(typeof r.port === 'number' && Number.isInteger(r.port) && r.port > 0 && r.port <= 65535 ? { port: r.port } : {}),
    ...(text(r.codec) ? { codec: text(r.codec) } : {}),
    ...(text(r.format) ? { format: text(r.format) } : {}),
  }
}

export function normaliseStreams(raw: unknown): StreamEndpoint[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw.map(normaliseStream).filter((s): s is StreamEndpoint => s !== null)
  return out.length > 0 ? out : undefined
}

/**
 * Protokolle, deren Strom der Desktop per ffmpeg zu EINEM Standbild macht
 * (Nachtrag #946). NDI, Dante, AES67 und ST 2110 brauchen eigene SDKs oder
 * PTP-synchronen Empfang, WebRTC/WHIP/WHEP eine Signalisierung, RTP ein SDP —
 * dafuer gibt es ehrlich keine Vorschau.
 */
export const FFMPEG_PROTOKOLLE: ReadonlySet<StreamProtocol> = new Set<StreamProtocol>(['rtsp', 'rtmp', 'srt', 'hls', 'mjpeg'])

export interface VorschauQuelle {
  feld: 'url' | 'previewUrl'
  url: string
  /** `http` = Standbild-Adresse holen, `ffmpeg` = ein Bild aus dem Strom. */
  weg: 'http' | 'ffmpeg'
}

/**
 * Woher das Standbild kommt: zuerst die Standbild-Adresse (billig, jede
 * Kamera kann das), sonst der Strom selbst ueber ffmpeg — aber nur, wenn das
 * Geraet ihn SENDET. An einem reinen Empfaenger liegt nichts zum Abholen.
 */
export const vorschauQuelle = (s: StreamEndpoint): VorschauQuelle | null => {
  if (istVorschauUrl(s.previewUrl)) return { feld: 'previewUrl', url: s.previewUrl!.trim(), weg: 'http' }
  if (s.url && s.direction !== 'receive' && FFMPEG_PROTOKOLLE.has(s.protocol)) {
    return { feld: 'url', url: s.url.trim(), weg: 'ffmpeg' }
  }
  return null
}

/** Der Strom, dessen Standbild die Kachel am Canvas zeigt: der erste mit
 *  eingeschalteter Vorschau und brauchbarer Quelle. */
export const vorschauStream = (streams: StreamEndpoint[] | undefined): StreamEndpoint | null =>
  streams?.find((s) => s.showPreview && vorschauQuelle(s) !== null) ?? null

const PROTOKOLL_NAMEN: Partial<Record<StreamProtocol, string>> = {
  st2110: 'ST 2110',
  webrtc: 'WebRTC',
  dante: 'Dante',
  other: '',
}

export const protokollName = (p: StreamProtocol): string => PROTOKOLL_NAMEN[p] ?? p.toUpperCase()

// ─── Nachtrag #946: Listen, Blaetter, MCP ──────────────────────────────────

/** Die Richtung in der Oberflaechensprache — eine Stelle fuer Formular, Liste und Blatt. */
export const streamDirectionText = (d: StreamDirection, t: (key: string, fallback: string) => string): string =>
  d === 'send'
    ? t('streams.dir.send', 'Sends')
    : d === 'receive'
      ? t('streams.dir.receive', 'Receives')
      : t('streams.dir.both', 'Sends and receives')

/** Die Adresse mit Port, wenn der Port nicht ohnehin darin steht. */
export const streamAdresse = (s: StreamEndpoint): string => {
  const u = s.url ?? ''
  if (s.port === undefined) return u
  if (!u) return String(s.port)
  return new RegExp(`:${s.port}(?:[/?#]|$)`).test(u) ? u : `${u} :${s.port}`
}

export interface StreamZeile {
  equipmentId: string
  geraet: string
  stream: StreamEndpoint
  protokoll: string
  adresse: string
  /** VLAN des Geraets (Schnittstelle 0), wenn eingetragen. */
  vlanId?: number
}

export const streamZeilen = (equipment: readonly EquipmentItem[]): StreamZeile[] =>
  equipment.flatMap((e) =>
    (e.streams ?? []).map((s) => ({
      equipmentId: e.id,
      geraet: e.name,
      stream: s,
      protokoll: protokollName(s.protocol) || 'Other',
      adresse: streamAdresse(s),
      ...(typeof e.managementVlanId === 'number' ? { vlanId: e.managementVlanId } : {}),
    })),
  )

const RICHTUNG_DE: Record<StreamDirection, string> = {
  send: 'sendet',
  receive: 'empfängt',
  both: 'sendet und empfängt',
}

/**
 * Die Stream-Liste als Tabelle. Kanonisches Deutsch wie alle Blatt-Texte; die
 * Spalten stehen im Spaltenlexikon. Zugangsdaten stehen nicht darin — sie
 * sind nicht im Plan.
 */
export const streamsTable = (equipment: readonly EquipmentItem[]): CsvTable => ({
  headers: ['Gerät', 'Richtung', 'Protokoll', 'Stream-Adresse', 'VLAN', 'Codec', 'Format', 'Beschreibung'],
  rows: streamZeilen(equipment).map((r): CsvCell[] => [
    r.geraet,
    RICHTUNG_DE[r.stream.direction],
    r.protokoll,
    r.adresse,
    r.vlanId ?? '',
    r.stream.codec ?? '',
    r.stream.format ?? '',
    [r.stream.label, r.stream.notes].filter(Boolean).join(' — '),
  ]),
})
