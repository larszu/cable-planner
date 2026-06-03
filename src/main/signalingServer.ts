// #413 — Lokaler y-webrtc-Signaling-Server (LAN-Fallback für Live-Kollaboration).
//
// y-webrtc findet Peers über einen Signaling-Server; der eingebaute Default ist
// EIN einziger öffentlicher Server (wss://y-webrtc-eu.fly.dev). Ist der nicht
// erreichbar (Show-LAN ohne Internet, Firewall, Server down), verbinden sich
// zwei Geräte NIE — jeder sieht nur sich selbst ("nur du im Raum") und es kommt
// kein Host-Plan an. Dieser Server schließt die Lücke: der Host startet ihn auf
// einem LAN-Port und bewirbt die `ws://<lan-ip>:<port>`-Adresse via mDNS
// (collabDiscoveryIpc); Beitretende übernehmen sie automatisch.
//
// Protokoll = minimales y-webrtc-Signaling (reines Pub/Sub-Relay):
//   subscribe/unsubscribe {topics:[…]}, publish {topic,…} → an alle Abonnenten
//   des Topics weiterreichen, ping → pong. Der Server hält nur die Zuordnung
//   Topic↦Abonnenten und sieht ausschließlich (bei gesetztem Raum-Passwort
//   verschlüsselte) Signaling-Nachrichten — niemals Plandaten.
//
// Bewusst OHNE electron-Import, damit der Server in plain Node testbar ist
// (scripts/signaling-relay-check.mjs). `ws` ist transitiv über y-webrtc (Prod-
// Dependency) vorhanden, daher require ohne eigene Dependency-Deklaration.

import os from 'node:os'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Minimal-Ausschnitt der `ws`-API, den wir nutzen (kein @types/ws nötig).
interface WsClient {
  readyState: number
  send(data: string): void
  ping(): void
  terminate(): void
  on(event: 'message', cb: (data: unknown, isBinary: boolean) => void): void
  on(event: 'close', cb: () => void): void
  on(event: 'pong', cb: () => void): void
  on(event: 'error', cb: (err: Error) => void): void
}
interface WsServer {
  on(event: 'connection', cb: (socket: WsClient) => void): void
  on(event: 'listening', cb: () => void): void
  on(event: 'error', cb: (err: Error) => void): void
  address(): { port: number } | string | null
  close(cb?: (err?: Error) => void): void
}
interface WsModule {
  WebSocketServer: new (opts: { port?: number; host?: string }) => WsServer
}

const WS_OPEN = 1

let serverHandle: WsServer | null = null
let serverPort = 0
let pingTimer: NodeJS.Timeout | null = null
const conns = new Set<WsClient>()
const topics = new Map<string, Set<WsClient>>()
const alive = new WeakSet<WsClient>()

/** Erste nicht-interne IPv4 (LAN), private Bereiche bevorzugt. */
const lanIpv4 = (): string => {
  const addrs: string[] = []
  for (const list of Object.values(os.networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) addrs.push(ni.address)
    }
  }
  const isPrivate = (ip: string): boolean =>
    ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  return addrs.find(isPrivate) ?? addrs[0] ?? '127.0.0.1'
}

interface SignalMsg {
  type?: string
  topics?: unknown
  topic?: unknown
  clients?: number
}

const send = (conn: WsClient, payload: string): void => {
  if (conn.readyState !== WS_OPEN) return
  try {
    conn.send(payload)
  } catch {
    /* Verbindung evtl. gerade zu */
  }
}

const handleConnection = (conn: WsClient): void => {
  conns.add(conn)
  alive.add(conn)
  const subscribed = new Set<string>()

  conn.on('pong', () => alive.add(conn))
  conn.on('error', () => {
    /* ignorieren — 'close' räumt auf */
  })
  conn.on('close', () => {
    for (const name of subscribed) {
      const subs = topics.get(name)
      subs?.delete(conn)
      if (subs && subs.size === 0) topics.delete(name)
    }
    subscribed.clear()
    conns.delete(conn)
  })

  conn.on('message', (data) => {
    const text =
      typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : ''
    if (!text) return
    let msg: SignalMsg
    try {
      msg = JSON.parse(text) as SignalMsg
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return

    switch (msg.type) {
      case 'subscribe': {
        const names = Array.isArray(msg.topics) ? msg.topics : []
        for (const name of names) {
          if (typeof name !== 'string') continue
          let set = topics.get(name)
          if (!set) {
            set = new Set()
            topics.set(name, set)
          }
          set.add(conn)
          subscribed.add(name)
        }
        break
      }
      case 'unsubscribe': {
        const names = Array.isArray(msg.topics) ? msg.topics : []
        for (const name of names) {
          if (typeof name === 'string') topics.get(name)?.delete(conn)
        }
        break
      }
      case 'publish': {
        // An ALLE Abonnenten des Topics weiterreichen (inkl. Sender — der
        // y-webrtc-Client filtert eigene Nachrichten per Peer-Id selbst).
        if (typeof msg.topic === 'string') {
          const receivers = topics.get(msg.topic)
          if (receivers && receivers.size > 0) {
            msg.clients = receivers.size
            const out = JSON.stringify(msg)
            for (const r of receivers) send(r, out)
          }
        }
        break
      }
      case 'ping':
        send(conn, '{"type":"pong"}')
        break
    }
  })
}

/** Startet den Signaling-Server (idempotent). Bindet an alle Interfaces, damit
 *  LAN-Peers ihn erreichen; Port wird vom OS vergeben (ephemeral). */
export const startSignalingServer = (): Promise<{ url: string; port: number }> => {
  if (serverHandle) {
    return Promise.resolve({ url: `ws://${lanIpv4()}:${serverPort}`, port: serverPort })
  }
  const { WebSocketServer } = require('ws') as WsModule
  return new Promise((resolve, reject) => {
    let wss: WsServer
    try {
      wss = new WebSocketServer({ port: 0, host: '0.0.0.0' })
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)))
      return
    }
    wss.on('error', (err) => reject(err))
    wss.on('connection', handleConnection)
    wss.on('listening', () => {
      const addr = wss.address()
      serverPort = typeof addr === 'object' && addr ? addr.port : 0
      serverHandle = wss
      // Tote TCP-Verbindungen aussortieren (hart gekillte Clients feuern kein
      // 'close'): selbst pingen, wer nicht mit 'pong' antwortet → terminieren.
      pingTimer = setInterval(() => {
        for (const conn of [...conns]) {
          if (!alive.has(conn)) {
            conn.terminate()
            conns.delete(conn)
            continue
          }
          alive.delete(conn)
          try {
            conn.ping()
          } catch {
            /* ignore */
          }
        }
      }, 30000)
      pingTimer.unref?.()
      resolve({ url: `ws://${lanIpv4()}:${serverPort}`, port: serverPort })
    })
  })
}

/** Stoppt den Server und trennt alle Verbindungen. */
export const stopSignalingServer = (): void => {
  if (pingTimer) {
    clearInterval(pingTimer)
    pingTimer = null
  }
  for (const conn of [...conns]) {
    try {
      conn.terminate()
    } catch {
      /* ignore */
    }
  }
  conns.clear()
  topics.clear()
  const wss = serverHandle
  serverHandle = null
  serverPort = 0
  if (!wss) return
  try {
    wss.close()
  } catch {
    /* ignore */
  }
}
