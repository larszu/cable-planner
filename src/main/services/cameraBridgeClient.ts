/**
 * Verbindung zur LZ Camera Bridge — EIN WebSocket je Adresse, im Main-Prozess.
 *
 * Der Renderer hat keinen Netzzugang (CLAUDE.md); alles, was zur Bruecke geht,
 * laeuft hier durch. Die Bruecke schickt ihren ganzen Zustand von sich aus
 * (Kameras, Poses, Tally, Fortschritt der Presets); dieser Client reicht jede
 * Nachricht unveraendert an alle Fenster weiter (`camera:event`) und haelt
 * keinen eigenen Zustand — eine zweite Wahrheit neben der Bruecke waere die
 * erste Stelle, an der beide auseinanderlaufen.
 *
 * Ein Verbinden, das schon laeuft, wird nicht doppelt begonnen (Invariante 8).
 * Getrennt wird von Hand oder beim Beenden; ein Abbruch meldet sich als
 * `{ type: 'bridge', status: 'disconnected' }` an die Fenster.
 */
import { BrowserWindow } from 'electron'
import WebSocket from 'ws'

export interface BridgeAddress {
  host: string
  port: number
}

interface Connection {
  key: string
  ws: WebSocket
  address: BridgeAddress
  open: boolean
}

let current: Connection | null = null
let connectInFlight: Promise<{ ok: boolean; message: string }> | null = null

const keyOf = (a: BridgeAddress) => `${a.host}:${a.port}`

function broadcast(msg: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('camera:event', msg)
  }
}

export function bridgeStatus(): { connected: boolean; address: BridgeAddress | null } {
  return { connected: Boolean(current?.open), address: current?.address ?? null }
}

export function disconnectBridge(): void {
  const c = current
  current = null
  if (c) {
    try { c.ws.close() } catch { /* schon zu */ }
  }
  broadcast({ type: 'bridge', status: 'disconnected' })
}

export function connectBridge(address: BridgeAddress): Promise<{ ok: boolean; message: string }> {
  const host = address.host.trim()
  const port = Number.isInteger(address.port) && address.port > 0 ? address.port : 9700
  if (!host) return Promise.resolve({ ok: false, message: 'Keine Adresse der Brücke.' })
  const key = keyOf({ host, port })
  if (current?.open && current.key === key) return Promise.resolve({ ok: true, message: 'verbunden' })
  if (connectInFlight) return connectInFlight
  if (current) disconnectBridge()

  connectInFlight = new Promise((resolve) => {
    const ws = new WebSocket(`ws://${host}:${port}`)
    const conn: Connection = { key, ws, address: { host, port }, open: false }
    current = conn
    const timer = setTimeout(() => {
      if (!conn.open) {
        try { ws.close() } catch { /* egal */ }
        if (current === conn) current = null
        connectInFlight = null
        resolve({ ok: false, message: `Keine Antwort von ${key} innerhalb von 5 s.` })
      }
    }, 5000)
    ws.on('open', () => {
      clearTimeout(timer)
      conn.open = true
      connectInFlight = null
      broadcast({ type: 'bridge', status: 'connected', address: conn.address })
      resolve({ ok: true, message: 'verbunden' })
    })
    ws.on('message', (data) => {
      try {
        broadcast(JSON.parse(data.toString()))
      } catch {
        /* keine JSON-Nachricht: ignorieren, die Bruecke spricht nur JSON */
      }
    })
    ws.on('error', (err) => {
      clearTimeout(timer)
      if (!conn.open) {
        if (current === conn) current = null
        connectInFlight = null
        resolve({ ok: false, message: `Brücke ${key}: ${err.message}` })
      } else {
        broadcast({ type: 'error', message: `Brücke ${key}: ${err.message}` })
      }
    })
    ws.on('close', () => {
      clearTimeout(timer)
      if (current === conn) {
        current = null
        broadcast({ type: 'bridge', status: 'disconnected' })
      }
      if (!conn.open) {
        connectInFlight = null
        resolve({ ok: false, message: `Brücke ${key} hat die Verbindung nicht angenommen.` })
      }
    })
  })
  return connectInFlight
}

export function sendToBridge(msg: unknown): { ok: boolean; message: string } {
  if (!current?.open) return { ok: false, message: 'Nicht mit der Brücke verbunden.' }
  if (!msg || typeof msg !== 'object' || typeof (msg as { type?: unknown }).type !== 'string') {
    return { ok: false, message: 'Keine Nachricht.' }
  }
  try {
    current.ws.send(JSON.stringify(msg))
    return { ok: true, message: 'gesendet' }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}
