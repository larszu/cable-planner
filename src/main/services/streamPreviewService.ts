// ───────────────────────────────────────────────────────────────────────────
// Nachtrag #946 — der Standbild-Abruf fuer die Stream-Vorschau, mit den drei
// Riegeln, die `fetchSnapshot` allein nicht hat.
//
// NUR IM LOKALEN NETZ. Jede aufgeloeste Adresse des Hosts muss privat,
// Loopback oder Link-Local sein. Eine Projektdatei aus fremder Hand kann eine
// Vorschau-Adresse im Internet tragen; ohne diese Pruefung verbaende ein
// Klick auf „Vorschau" diesen Rechner dorthin — ein Zaehlpixel, das meldet,
// wann wer den Plan geoeffnet hat.
//
// ZUGANGSDATEN AUS DEM SCHLUESSELBUND. Sie stehen nie im Projekt
// (`streamUrlOhneZugang`) und gehen nie an den Renderer zurueck. Hier werden
// sie wieder eingesetzt: als `Authorization: Basic` beim Standbild-Abruf, in
// der Adresse beim ffmpeg-Aufruf.
//
// FFMPEG FUER DEN STROM SELBST. Chromium spielt RTSP, RTMP und SRT nicht ab
// und HLS nur mit einer Bibliothek. Statt eines Players je Protokoll im
// Renderer (CSP `media-src`/`connect-src` auf beliebige Hosts) holt der
// Main-Prozess EIN Bild per ffmpeg und gibt es als `data:`-URI zurueck — die
// CSP des Fensters bleibt, wie sie ist. ffmpeg wird nicht mitgeliefert
// (Groesse, Codec-Lizenzen); fehlt es, sagt die Antwort `no-ffmpeg`.
// ───────────────────────────────────────────────────────────────────────────
import { execFile } from 'node:child_process'
import { access, constants } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import { streamCredentialService } from './credentialsService.js'
import { fetchSnapshot, type SnapshotResult } from './streamSnapshot.js'
import {
  SCHEMES,
  ffmpegArgs,
  isLocalAddress,
  isPreviewProtocol,
  mergeStreamSecrets,
  parseStreamUrl,
} from '../util/streamUrl.js'

export interface SnapshotRequest {
  /** Schluesselbund-Account der Zugangsdaten (`zugangsSchluessel`). */
  credentialId: string
  /** `http` = Standbild-Adresse, `ffmpeg` = ein Bild aus dem Strom. */
  weg: 'http' | 'ffmpeg'
  protocol: string
  url: string
}

export type PreviewResult =
  | SnapshotResult
  | { ok: false; code: 'not-local' | 'no-ffmpeg' | 'unsupported' | 'busy'; status?: undefined }

const allesLokal = async (host: string): Promise<boolean> => {
  if (isIP(host)) return isLocalAddress(host)
  try {
    const addrs = await lookup(host, { all: true })
    return addrs.length > 0 && addrs.every((a) => isLocalAddress(a.address))
  } catch {
    return false
  }
}

/**
 * Wo ffmpeg liegt. Eine aus dem Finder gestartete App erbt den PATH der
 * Shell NICHT — die Homebrew-Pfade stehen deshalb ausdruecklich in der Liste.
 */
const ffmpegKandidaten = (): string[] => {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  if (process.platform === 'darwin') dirs.push('/opt/homebrew/bin', '/usr/local/bin')
  if (process.platform === 'linux') dirs.push('/usr/bin', '/usr/local/bin')
  return [...new Set(dirs)].map((d) => path.join(d, exe))
}

let ffmpegPfad: string | undefined

export const findFfmpeg = async (): Promise<string | null> => {
  if (ffmpegPfad) return ffmpegPfad
  for (const p of ffmpegKandidaten()) {
    try {
      await access(p, constants.X_OK)
      ffmpegPfad = p
      return p
    } catch {
      // naechster Kandidat
    }
  }
  // Ein Fehlschlag wird nicht gemerkt: wer ffmpeg nachinstalliert, soll die
  // App nicht neu starten muessen.
  return null
}

const MAX_GLEICHZEITIG = 2
const FFMPEG_TIMEOUT_MS = 10_000
let laufend = 0

const zugang = async (credentialId: string): Promise<string | null> =>
  streamCredentialService.get(credentialId).catch(() => null)

const basicAuth = (secretsJson: string | null): string | undefined => {
  if (!secretsJson) return undefined
  try {
    const { userinfo } = JSON.parse(secretsJson) as { userinfo?: unknown }
    if (typeof userinfo !== 'string' || !userinfo) return undefined
    return `Basic ${Buffer.from(decodeURIComponent(userinfo)).toString('base64')}`
  } catch {
    return undefined
  }
}

export const takeSnapshot = async (req: SnapshotRequest): Promise<PreviewResult> => {
  if (
    !req ||
    typeof req.url !== 'string' ||
    typeof req.protocol !== 'string' ||
    typeof req.credentialId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(req.credentialId) ||
    (req.weg !== 'http' && req.weg !== 'ffmpeg')
  ) {
    return { ok: false, code: 'invalid-url' }
  }
  const teile = parseStreamUrl(req.url)
  if (!teile) return { ok: false, code: 'invalid-url' }
  if (req.weg === 'ffmpeg') {
    if (!isPreviewProtocol(req.protocol)) return { ok: false, code: 'unsupported' }
    if (!SCHEMES[req.protocol].includes(teile.scheme)) return { ok: false, code: 'invalid-url' }
    // Ein SRT-Listener oeffnete auf DIESEM Rechner einen Port.
    if (req.protocol === 'srt' && /[?&]mode=listener\b/i.test(req.url)) return { ok: false, code: 'invalid-url' }
  }
  if (!(await allesLokal(teile.host))) return { ok: false, code: 'not-local' }
  if (laufend >= MAX_GLEICHZEITIG) return { ok: false, code: 'busy' }

  laufend++
  try {
    const secrets = await zugang(req.credentialId)
    if (req.weg === 'http') return await fetchSnapshot(req.url, fetch, () => new Date(), basicAuth(secrets))

    const ffmpeg = await findFfmpeg()
    if (!ffmpeg) return { ok: false, code: 'no-ffmpeg' }
    const url = mergeStreamSecrets(req.url, secrets)
    const jpeg = await new Promise<Buffer | null>((resolve) => {
      execFile(
        ffmpeg,
        ffmpegArgs(req.protocol as Parameters<typeof ffmpegArgs>[0], url),
        { encoding: 'buffer', timeout: FFMPEG_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        // stderr wird NICHT weitergegeben und nicht geloggt: ffmpeg schreibt
        // die Adresse samt Zugangsdaten in seine Fehlermeldungen.
        (err, stdout) => resolve(err || !stdout?.length ? null : stdout),
      )
    })
    if (!jpeg) return { ok: false, code: 'unreachable' }
    return { ok: true, dataUri: `data:image/jpeg;base64,${jpeg.toString('base64')}`, fetchedAt: new Date().toISOString() }
  } finally {
    laufend--
  }
}
