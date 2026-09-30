// larszu/lz-scopes#15 — reine Helfer der Live-Scopes: Probe lesen, Matrix und
// Groesse bestimmen, den ffmpeg-Rohstrom in Bilder schneiden. Ohne IO und ohne
// Schluesselbund, damit die Tests sie ohne natives `keytar` laden koennen. Der
// Ablauf steht in `services/streamScopeService.ts`.
//
// Uebernommen aus lz-camera-bridge `ScopeStream.ts`, das denselben
// Frame-Vertrag spricht (lz-scopes `docs/frame-protocol.md`).

export interface StreamProbe {
  width: number
  height: number
  codec?: string
  pixFmt?: string
  fps: number
  transfer: string
  primaries: string
  matrix: string
  range: string
}

/** Was der Renderer als `StreamInfo` an `Source.pushInfo` gibt. */
export interface ScopeInfo {
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  depth: 8 | 16
  fps: number
  codec?: string
  pixFmt?: string
  decodeMatrix: string
  transfer: string
  primaries: string
  matrix: string
  range: string
}

export const SCOPE_WIDTH = 960
export const SCOPE_MAX_WIDTH = 1920

const rate = (r: unknown): number => {
  const [n, d] = String(r ?? '0/1').split('/').map(Number)
  return d ? n / d : 0
}

export function parseFfprobeJson(out: string): StreamProbe | null {
  let s: Record<string, unknown> | undefined
  try {
    s = (JSON.parse(out) as { streams?: Record<string, unknown>[] }).streams?.[0]
  } catch {
    return null
  }
  if (!s || !s.width || !s.height) return null
  return {
    width: Number(s.width),
    height: Number(s.height),
    codec: s.codec_name as string | undefined,
    pixFmt: s.pix_fmt as string | undefined,
    fps: Math.round((rate(s.avg_frame_rate) || rate(s.r_frame_rate)) * 100) / 100,
    transfer: (s.color_transfer as string) ?? 'unknown',
    primaries: (s.color_primaries as string) ?? 'unknown',
    matrix: (s.color_space as string) ?? 'unknown',
    range: (s.color_range as string) ?? 'unknown',
  }
}

/**
 * Dieselben Angaben aus ffmpegs eigener Stream-Zeile — fuer Rechner ohne
 * ffprobe. Der Farbteil lautet `yuv420p(tv, bt709, progressive)`, wenn Matrix,
 * Primaries und Transfer gleich heissen, sonst
 * `yuv420p10le(tv, bt2020nc/bt2020/smpte2084)`.
 */
export function parseFfmpegBanner(stderr: string): StreamProbe | null {
  const line = stderr.split('\n').find((l) => /Stream #\d+:\d+.*: Video: /.test(l))
  if (!line) return null
  const size = /,\s*(\d{2,5})x(\d{2,5})\b/.exec(line)
  if (!size) return null
  const codec = /Video: ([\w-]+)/.exec(line)?.[1]
  const fmt = /Video: [^,]+,\s*(\w+)(?:\(([^)]*)\))?/.exec(line)
  let range = 'unknown'
  let matrix = 'unknown'
  let primaries = 'unknown'
  let transfer = 'unknown'
  for (const part of (fmt?.[2] ?? '').split(',').map((p) => p.trim())) {
    if (part === 'tv' || part === 'pc') range = part
    else if (/^[\w-]+\/[\w-]+\/[\w-]+$/.test(part)) [matrix, primaries, transfer] = part.split('/')
    else if (/^(bt|smpte|arib|iec|gbr|ycgco|fcc|bt470)/.test(part)) matrix = primaries = transfer = part
  }
  const fps = Number(/([\d.]+) fps/.exec(line)?.[1] ?? /([\d.]+) tbr/.exec(line)?.[1] ?? 0)
  return { width: Number(size[1]), height: Number(size[2]), codec, pixFmt: fmt?.[1], fps, transfer, primaries, matrix, range }
}

/**
 * Matrix und Bereich fuer Y'CbCr → R'G'B': getaggter Wert zuerst, sonst
 * BT.709 oberhalb von SD und BT.601 fuer SD.
 */
export function decodeParams(info: Pick<StreamProbe, 'matrix' | 'range' | 'height'>): {
  decodeMatrix: string
  decodeRange: 'full' | 'limited'
} {
  const m = String(info.matrix ?? '')
  const decodeMatrix = m.startsWith('bt2020')
    ? 'bt2020'
    : m === 'bt709'
      ? 'bt709'
      : m === 'smpte170m' || m === 'bt470bg'
        ? 'bt601'
        : m === 'smpte240m'
          ? 'smpte240m'
          : info.height > 576
            ? 'bt709'
            : 'bt601'
  return { decodeMatrix, decodeRange: info.range === 'pc' ? 'full' : 'limited' }
}

/** In `maxWidth` einpassen, Seitenverhaeltnis halten, gerade Kanten. */
export function outputSize(w: number, h: number, maxWidth: number): { width: number; height: number } {
  if (!w || !h) return { width: SCOPE_WIDTH, height: 540 }
  const width = maxWidth > 0 && w > maxWidth ? maxWidth : w
  const height = Math.round((h * width) / w)
  return { width: width & ~1, height: Math.max(2, height & ~1) }
}

export function scopeInfo(probe: StreamProbe, maxWidth: number, depth: 8 | 16): ScopeInfo {
  const { width, height } = outputSize(probe.width, probe.height, maxWidth)
  const { decodeMatrix } = decodeParams(probe)
  return {
    width,
    height,
    sourceWidth: probe.width,
    sourceHeight: probe.height,
    depth,
    fps: probe.fps,
    ...(probe.codec ? { codec: probe.codec } : {}),
    ...(probe.pixFmt ? { pixFmt: probe.pixFmt } : {}),
    decodeMatrix,
    transfer: probe.transfer,
    primaries: probe.primaries,
    matrix: probe.matrix,
    range: probe.range,
  }
}

/**
 * Schneidet den ffmpeg-Rohstrom in ganze Bilder. stdout liefert Stuecke
 * beliebiger Groesse; ein Bild ist `width × height × 4 × depth/8` Bytes.
 * Jedes Bild kommt als EIGENER `ArrayBuffer` heraus, weil es ueber einen
 * MessagePort geht und dort geklont wird — ein Blick in einen grossen Puffer
 * nahme den ganzen Puffer mit.
 */
export class FrameSplitter {
  private teile: Buffer[] = []
  private summe = 0

  constructor(readonly bytesPerFrame: number) {}

  push(chunk: Buffer): ArrayBuffer[] {
    this.teile.push(chunk)
    this.summe += chunk.length
    const out: ArrayBuffer[] = []
    if (this.summe < this.bytesPerFrame) return out
    let alles = this.teile.length === 1 ? this.teile[0] : Buffer.concat(this.teile, this.summe)
    while (alles.length >= this.bytesPerFrame) {
      const bild = new ArrayBuffer(this.bytesPerFrame)
      new Uint8Array(bild).set(alles.subarray(0, this.bytesPerFrame))
      out.push(bild)
      alles = alles.subarray(this.bytesPerFrame)
    }
    this.teile = alles.length ? [alles] : []
    this.summe = alles.length
    return out
  }
}

export interface ScopeRequest {
  /** Vom Renderer gewaehlt; benennt den MessagePort, der zurueckkommt. */
  id: string
  credentialId: string
  protocol: string
  url: string
  depth: 8 | 16
  /** Analysebreite in px (0 = nativ, gedeckelt auf `SCOPE_MAX_WIDTH`). */
  width: number
}

/** Prueft die Form der Anfrage aus dem Renderer. Inhaltliche Riegel stehen im Service. */
export function parseScopeRequest(raw: unknown): ScopeRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.id)) return null
  if (typeof r.credentialId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(r.credentialId)) return null
  if (typeof r.protocol !== 'string' || typeof r.url !== 'string' || !r.url.trim()) return null
  const width = r.width === undefined ? SCOPE_WIDTH : Math.round(Number(r.width))
  return {
    id: r.id,
    credentialId: r.credentialId,
    protocol: r.protocol,
    url: r.url.trim(),
    depth: r.depth === 16 ? 16 : 8,
    width: Number.isFinite(width) && width >= 0 ? Math.min(SCOPE_MAX_WIDTH, width) : SCOPE_WIDTH,
  }
}
