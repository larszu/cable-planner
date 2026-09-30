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
  ...inputFlags(protocol),
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

/** Eingangsoptionen je Protokoll — dieselben fuer Standbild, Scopes und Probe. */
export const inputFlags = (protocol: PreviewProtocol): string[] =>
  protocol === 'rtsp' ? ['-rtsp_transport', 'tcp'] : []

/**
 * Kuerzere Probe als ffmpegs 5 s: das erste Bild kommt nach rund 3 s statt
 * 4,5 s (gemessen in lz-camera-bridge, 1080p25 ueber RTSP, 2026-09-29).
 */
export const FAST_PROBE = ['-analyzeduration', '1000000', '-probesize', '2000000']

/**
 * larszu/lz-scopes#15 — die Rohbild-Variante fuer die Scopes: unkomprimiertes
 * R'G'B'A auf stdout, Format wie `docs/frame-protocol.md` in lz-scopes.
 *
 * KEIN JPEG, weil ein Scope Pegel misst: JPEG quantisiert neu, und die
 * Farbunterabtastung verschmiert das Vectorscope. Die Matrix steht
 * AUSDRUECKLICH da (`decodeParams` in `streamScope.ts`) — swscale nimmt fuer
 * ungetaggtes HD sonst BT.601, und jede Farbe laege auf dem Vectorscope
 * daneben. Die Transferfunktion bleibt unberuehrt: PQ/HLG kommen als
 * Codewerte an.
 */
export const ffmpegRawArgs = (
  protocol: PreviewProtocol,
  url: string,
  o: { width: number; height: number; depth: 8 | 16; decodeMatrix: string; decodeRange: 'full' | 'limited' },
): string[] => [
  '-hide_banner',
  '-loglevel',
  'error',
  '-nostdin',
  '-fflags',
  'nobuffer',
  '-flags',
  'low_delay',
  ...FAST_PROBE,
  ...inputFlags(protocol),
  '-i',
  url,
  '-an',
  '-sn',
  '-dn',
  '-map',
  '0:v:0',
  '-vf',
  `scale=${o.width}:${o.height}:flags=area:in_color_matrix=${o.decodeMatrix}:in_range=${o.decodeRange}`,
  '-pix_fmt',
  o.depth === 16 ? 'rgba64le' : 'rgba',
  '-f',
  'rawvideo',
  'pipe:1',
]

/** ffprobe: Groesse und Farbangaben des ersten Videostroms als JSON. */
export const ffprobeArgs = (protocol: PreviewProtocol, url: string): string[] => [
  '-v',
  'error',
  ...FAST_PROBE,
  ...inputFlags(protocol),
  '-select_streams',
  'v:0',
  '-show_entries',
  'stream=width,height,codec_name,avg_frame_rate,r_frame_rate,color_transfer,color_primaries,color_space,color_range,pix_fmt',
  '-of',
  'json',
  '-i',
  url,
]
