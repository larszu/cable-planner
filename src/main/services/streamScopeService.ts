// ───────────────────────────────────────────────────────────────────────────
// larszu/lz-scopes#15 — Live-Scopes fuer die Streams am Geraet.
//
// DIESELBEN RIEGEL WIE DIE VORSCHAU (`streamPreviewService`): nur lokales
// Netz, nur Protokolle, die ffmpeg oeffnen kann, Zugangsdaten aus dem
// Schluesselbund, die den Main-Prozess nie verlassen. Es gibt keinen zweiten
// Weg zur Kamera, nur eine zweite Ausgabe desselben Wegs.
//
// TRANSPORT UEBER EINEN MESSAGEPORT, NICHT UEBER EINEN WEBSOCKET. Ein
// WebSocket braeuchte einen offenen Port auf diesem Rechner und `connect-src`
// in der CSP; die Adresse mit Passwort laege in einem Dienst, den jedes
// Programm im LAN fragen kann. Der Port aus `MessageChannelMain` verbindet
// genau dieses Fenster mit genau diesem Prozess.
//
// EIN FFMPEG JE STROM, egal wie viele Panels hinsehen: Kameras erlauben oft
// nur wenige RTSP-Sitzungen. ffmpeg laeuft nur, solange ein Panel offen ist —
// der letzte Port, der schliesst, beendet ihn.
//
// BILDER WERDEN VERWORFEN, NICHT GEPUFFERT. Jedes Abo hat hoechstens
// `MAX_UNTERWEGS` Bilder ohne Quittung; kommt der Renderer nicht hinterher,
// faellt das naechste Bild fuer dieses Panel weg. Ein Scope will das neueste
// Bild, keine Warteschlange.
//
// STDERR WIRD WEDER GELESEN NOCH GELOGGT: ffmpeg schreibt die Adresse samt
// Zugangsdaten in seine Fehlermeldungen. Der Renderer bekommt nur Codes.
// ───────────────────────────────────────────────────────────────────────────
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { MessageChannelMain, type MessagePortMain, type WebContents } from 'electron'
import { allesLokal, findFfmpeg, pruefeFfmpegStrom, zugang } from './streamPreviewService.js'
import { FAST_PROBE, ffmpegRawArgs, ffprobeArgs, inputFlags, mergeStreamSecrets, parseStreamUrl, type PreviewProtocol } from '../util/streamUrl.js'
import {
  FrameSplitter,
  decodeParams,
  parseFfmpegBanner,
  parseFfprobeJson,
  parseScopeRequest,
  scopeInfo,
  type ScopeInfo,
  type ScopeRequest,
  type StreamProbe,
} from '../util/streamScope.js'

export type ScopeStartResult =
  | { ok: true }
  | { ok: false; code: 'invalid-url' | 'unsupported' | 'not-local' | 'no-ffmpeg' | 'busy' }

/** Was ueber den Port an den Renderer geht. */
export type ScopePortMessage =
  | { type: 'info'; info: ScopeInfo }
  | { type: 'frame'; buf: ArrayBuffer }
  | { type: 'end'; code: 'unreachable' | 'ended' }

/** Gleichzeitig offene Stroeme. Jeder ist eine RTSP-Sitzung und ein Decoder. */
export const MAX_LEITUNGEN = 4
const MAX_UNTERWEGS = 2
const PROBE_TIMEOUT_MS = 15_000

interface Abo {
  id: string
  port: MessagePortMain
  unterwegs: number
}

interface Leitung {
  key: string
  abos: Set<Abo>
  child?: ChildProcess
  info?: ScopeInfo
  beendet: boolean
}

const leitungen = new Map<string, Leitung>()
const abos = new Map<string, { abo: Abo; leitung: Leitung }>()
const beobachtet = new WeakSet<WebContents>()
const jeFenster = new WeakMap<WebContents, Set<string>>()

const lauf = (
  binary: string,
  args: string[],
): Promise<{ code: number | null; out: string; err: string } | null> =>
  new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    } catch {
      resolve(null)
      return
    }
    let out = ''
    let err = ''
    const uhr = setTimeout(() => child.kill('SIGKILL'), PROBE_TIMEOUT_MS)
    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString()
    })
    // Nur fuer die Stream-Zeile der Probe gelesen, nie weitergegeben.
    child.stderr?.on('data', (d: Buffer) => {
      err = (err + d.toString()).slice(-8000)
    })
    child.once('error', () => {
      clearTimeout(uhr)
      resolve(null)
    })
    child.once('close', (code) => {
      clearTimeout(uhr)
      resolve({ code, out, err })
    })
  })

/** Groesse und Farbangaben: ffprobe neben ffmpeg, sonst ffmpegs Stream-Zeile. */
async function probe(ffmpeg: string, protocol: PreviewProtocol, url: string): Promise<StreamProbe | null> {
  const name = path.basename(ffmpeg)
  const ffprobe = path.join(path.dirname(ffmpeg), name.replace(/^ffmpeg/, 'ffprobe'))
  const r = await lauf(ffprobe, ffprobeArgs(protocol, url))
  if (r) return parseFfprobeJson(r.out)
  const b = await lauf(ffmpeg, ['-hide_banner', ...FAST_PROBE, ...inputFlags(protocol), '-i', url])
  return b ? parseFfmpegBanner(b.err) : null
}

const senden = (l: Leitung, m: ScopePortMessage) => {
  for (const abo of l.abos) abo.port.postMessage(m)
}

function beenden(l: Leitung, code: 'unreachable' | 'ended') {
  if (l.beendet) return
  l.beendet = true
  if (leitungen.get(l.key) === l) leitungen.delete(l.key)
  l.child?.kill('SIGKILL')
  for (const abo of l.abos) {
    abo.port.postMessage({ type: 'end', code } satisfies ScopePortMessage)
    abo.port.close()
    abos.delete(abo.id)
  }
  l.abos.clear()
}

export function stopScope(id: string) {
  const e = abos.get(id)
  if (!e) return
  abos.delete(id)
  e.leitung.abos.delete(e.abo)
  e.abo.port.close()
  if (e.leitung.abos.size === 0 && !e.leitung.beendet) {
    e.leitung.beendet = true
    e.leitung.child?.kill('SIGKILL')
    if (leitungen.get(e.leitung.key) === e.leitung) leitungen.delete(e.leitung.key)
  }
}

export function stopAllScopes() {
  for (const id of [...abos.keys()]) stopScope(id)
}

async function anlaufen(l: Leitung, req: ScopeRequest, ffmpeg: string) {
  const protocol = req.protocol as PreviewProtocol
  const url = mergeStreamSecrets(req.url, await zugang(req.credentialId))
  const p = await probe(ffmpeg, protocol, url)
  if (l.beendet) return
  if (!p) return beenden(l, 'unreachable')
  const info = scopeInfo(p, req.width, req.depth)
  const { decodeRange } = decodeParams(p)
  l.info = info
  senden(l, { type: 'info', info })

  let child: ChildProcess
  try {
    child = spawn(
      ffmpeg,
      ffmpegRawArgs(protocol, url, { width: info.width, height: info.height, depth: req.depth, decodeMatrix: info.decodeMatrix, decodeRange }),
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    )
  } catch {
    return beenden(l, 'unreachable')
  }
  l.child = child
  const splitter = new FrameSplitter(info.width * info.height * 4 * (req.depth / 8))
  child.stdout?.on('data', (chunk: Buffer) => {
    for (const buf of splitter.push(chunk)) {
      for (const abo of l.abos) {
        if (abo.unterwegs >= MAX_UNTERWEGS) continue
        abo.unterwegs++
        abo.port.postMessage({ type: 'frame', buf } satisfies ScopePortMessage)
      }
    }
  })
  child.stdout?.on('error', () => undefined)
  child.once('error', () => beenden(l, 'unreachable'))
  child.once('close', (code) => beenden(l, code === 0 ? 'ended' : 'unreachable'))
}

export async function startScope(wc: WebContents, raw: unknown): Promise<ScopeStartResult> {
  const req = parseScopeRequest(raw)
  if (!req || abos.has(req.id)) return { ok: false, code: 'invalid-url' }
  const falsch = pruefeFfmpegStrom(req.protocol, req.url)
  if (falsch) return { ok: false, code: falsch }
  const teile = parseStreamUrl(req.url)
  if (!teile || !(await allesLokal(teile.host))) return { ok: false, code: 'not-local' }
  const ffmpeg = await findFfmpeg()
  if (!ffmpeg) return { ok: false, code: 'no-ffmpeg' }

  const key = [req.credentialId, req.protocol, req.url, req.depth, req.width].join('\n')
  let l = leitungen.get(key)
  const neu = !l
  if (!l) {
    if (leitungen.size >= MAX_LEITUNGEN) return { ok: false, code: 'busy' }
    l = { key, abos: new Set(), beendet: false }
    leitungen.set(key, l)
  }

  const { port1, port2 } = new MessageChannelMain()
  const abo: Abo = { id: req.id, port: port1, unterwegs: 0 }
  l.abos.add(abo)
  abos.set(req.id, { abo, leitung: l })
  port1.on('message', (e) => {
    const d = e.data as { type?: unknown } | null
    if (d?.type === 'ack') abo.unterwegs = Math.max(0, abo.unterwegs - 1)
    else if (d?.type === 'stop') stopScope(req.id)
  })
  port1.on('close', () => stopScope(req.id))
  port1.start()

  // Ein geschlossenes oder neu geladenes Fenster raeumt seine Abos ab.
  let ids = jeFenster.get(wc)
  if (!ids) jeFenster.set(wc, (ids = new Set()))
  ids.add(req.id)
  if (!beobachtet.has(wc)) {
    beobachtet.add(wc)
    const raeumen = () => {
      for (const id of jeFenster.get(wc) ?? []) stopScope(id)
      jeFenster.get(wc)?.clear()
    }
    wc.on('destroyed', raeumen)
    wc.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) raeumen()
    })
  }

  wc.postMessage('streamScope:port', { id: req.id }, [port2])
  if (l.info) port1.postMessage({ type: 'info', info: l.info } satisfies ScopePortMessage)
  if (neu) void anlaufen(l, req, ffmpeg)
  return { ok: true }
}
