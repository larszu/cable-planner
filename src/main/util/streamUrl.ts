// Reine Helfer des Standbild-Abrufs (Nachtrag #946) — ohne Schluesselbund, ohne IO,
// damit die Tests sie ohne natives `keytar` laden koennen. Begruendung der
// Regeln in `services/streamPreviewService.ts`.
import { isIP } from 'node:net'

/** Protokolle, die ffmpeg zu einem Standbild macht — Kennungen wie `types/stream.ts`. */
export type PreviewProtocol = 'rtsp' | 'rtmp' | 'srt' | 'hls' | 'mjpeg'

export const SCHEMES: Record<PreviewProtocol, readonly string[]> = {
  rtsp: ['rtsp', 'rtsps'],
  rtmp: ['rtmp', 'rtmps'],
  srt: ['srt'],
  hls: ['http', 'https'],
  mjpeg: ['http', 'https'],
}

export const isPreviewProtocol = (p: string): p is PreviewProtocol => Object.hasOwn(SCHEMES, p)

const AUTHORITY = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/?#]*@)?(\[[^\]]+\]|[^:/?#]*)/i

/** Schema und Host einer Adresse, oder `null`. */
export const parseStreamUrl = (url: string): { scheme: string; host: string } | null => {
  const m = AUTHORITY.exec(url.trim())
  if (!m || !m[2]) return null
  return { scheme: m[1].toLowerCase(), host: m[2].replace(/^\[|\]$/g, '') }
}

/** Privat, Loopback oder Link-Local — IPv4 und IPv6. */
export const isLocalAddress = (addr: string): boolean => {
  const v = isIP(addr)
  if (v === 4) {
    const [a, b] = addr.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }
  if (v === 6) {
    const s = addr.toLowerCase()
    if (s === '::1') return true
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s)
    if (mapped) return isLocalAddress(mapped[1])
    return /^f[cd][0-9a-f]{2}:/.test(s) || /^fe[89ab][0-9a-f]:/.test(s)
  }
  return false
}

/** Setzt die Zugangsdaten aus dem Schluesselbund wieder in die Adresse. */
export const mergeStreamSecrets = (url: string, secretsJson: string | null): string => {
  if (!secretsJson) return url
  let secrets: { userinfo?: unknown; query?: unknown }
  try {
    secrets = JSON.parse(secretsJson) as typeof secrets
  } catch {
    return url
  }
  let out = url
  if (typeof secrets.userinfo === 'string' && secrets.userinfo) {
    out = out.replace(/^([a-z][a-z0-9+.-]*:\/\/)(?:[^@/?#]*@)?/i, `$1${secrets.userinfo}@`)
  }
  if (Array.isArray(secrets.query)) {
    const pairs = secrets.query
      .filter((p): p is [string, string] => Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string')
      .map(([k, v]) => (v ? `${k}=${v}` : k))
    if (pairs.length > 0) {
      const hashAt = out.indexOf('#')
      const base = hashAt >= 0 ? out.slice(0, hashAt) : out
      const hash = hashAt >= 0 ? out.slice(hashAt) : ''
      out = base + (base.includes('?') ? '&' : '?') + pairs.join('&') + hash
    }
  }
  return out
}

/** Die ffmpeg-Argumente. Ein Bild, 320 px breit, JPEG auf stdout. */
export const ffmpegArgs = (protocol: PreviewProtocol, url: string): string[] => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-nostdin',
  ...(protocol === 'rtsp' ? ['-rtsp_transport', 'tcp'] : []),
  '-i',
  url,
  '-frames:v',
  '1',
  '-an',
  '-vf',
  'scale=320:-2',
  '-f',
  'image2pipe',
  '-c:v',
  'mjpeg',
  '-q:v',
  '6',
  'pipe:1',
]
