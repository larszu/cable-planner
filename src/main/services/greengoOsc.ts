/**
 * Green-GO live — OSC über UDP zu einem Green-GO-Geraet, auf dem das
 * Geraeteskript `osc-remote.gg5t` laeuft.
 *
 * Green-GO hat KEINE dauerhaft laufende Steuerschnittstelle. Ein Geraet
 * spricht OSC nur, solange ein Skript darauf laeuft (Green-GO-Handbuch,
 * „Scripting / API" und „Companion"); das Skript des Bitfocus-Moduls
 * (github.com/bitfocus/companion-module-greengo-intercom) ist die
 * veroeffentlichte Referenz. Es braucht Firmware 5.0.3.0255 oder neuer und
 * deckt die Kanaele 1–6 ab. Geraete: BCN, BPX, BPXSP, DNTI, MCX, MCXD, Q4WR,
 * RDX, Si2WR, Si4WR.
 *
 * Befehle gehen als `/ggo/cmd/...` an `<geraet>:<port>` (Vorgabe 8000), der
 * Zustand kommt als `/ggo/state/...` auf DEMSELBEN Port zurueck (das Skript
 * schickt an die Adresse, die in ihm als `remoteIP` steht). Alle Argumente
 * sind OSC int32.
 *
 * Ein Socket je Sitzung; ein zweites Geraet ersetzt das erste. Jede
 * Zustandsmeldung geht als `greengo:event` an die Fenster; hier wird nichts
 * gemerkt und nichts ins Projekt geschrieben (Invariante 14).
 */
import { BrowserWindow } from 'electron'
import dgram from 'node:dgram'
import { decodeOsc, encodeOsc } from './osc.js'

// ── Verbindung ─────────────────────────────────────────────────────────────

interface Session {
  socket: dgram.Socket
  host: string
  port: number
  lastHeard: number
}

let session: Session | null = null

function broadcast(msg: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('greengo:event', msg)
  }
}

export function greengoStop(): void {
  const s = session
  session = null
  if (s) {
    try { s.socket.close() } catch { /* schon zu */ }
  }
  broadcast({ type: 'status', connected: false })
}

export function greengoStart(host: string, port: number): Promise<{ ok: boolean; message: string }> {
  const h = host.trim()
  const p = Number.isInteger(port) && port > 0 ? port : 8000
  if (!h) return Promise.resolve({ ok: false, message: 'Keine Adresse des Green-GO-Geräts.' })
  greengoStop()
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    const s: Session = { socket, host: h, port: p, lastHeard: 0 }
    socket.on('message', (msg) => {
      const m = decodeOsc(msg)
      if (!m) return
      s.lastHeard = Date.now()
      broadcast({ type: 'osc', address: m.address, args: m.args, at: s.lastHeard })
    })
    socket.on('error', (err) => {
      broadcast({ type: 'error', message: `Green-GO ${h}:${p}: ${err.message}` })
    })
    // Das Skript antwortet an den Port, an den es selbst sendet: derselbe.
    socket.bind(p, () => {
      session = s
      broadcast({ type: 'status', connected: true, host: h, port: p })
      // Das Skript schickt auf `update` seinen ganzen Zustand.
      socket.send(encodeOsc('/ggo/cmd/update', [1]), p, h)
      resolve({ ok: true, message: '' })
    })
    socket.once('error', (err) => {
      if (session !== s) resolve({ ok: false, message: `Port ${p} ist belegt oder gesperrt: ${err.message}` })
    })
  })
}

/** Einen Befehl `/ggo/cmd/<pfad>` mit int-Argumenten schicken. Der Pfad wird geprueft, nicht durchgereicht. */
export function greengoSend(path: string, args: number[]): { ok: boolean; message: string } {
  if (!session) return { ok: false, message: 'Nicht mit einem Green-GO-Gerät verbunden.' }
  if (!/^[a-z]+(\/[a-z]+)*$/.test(path)) return { ok: false, message: 'Unbekannter Befehl.' }
  if (!args.every((a) => Number.isFinite(a))) return { ok: false, message: 'Ungültige Werte.' }
  session.socket.send(encodeOsc(`/ggo/cmd/${path}`, args), session.port, session.host)
  return { ok: true, message: '' }
}

export function greengoStatus(): { connected: boolean; host: string | null; port: number | null; lastHeard: number } {
  return { connected: Boolean(session), host: session?.host ?? null, port: session?.port ?? null, lastHeard: session?.lastHeard ?? 0 }
}
