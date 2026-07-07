#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Eigener Signaling-Relay (y-webrtc-kompatibel) — für Zugriff über MOBILE DATEN.
//
// Cable/Light/MultiCam Planner nutzen y-webrtc für Live-Sync. y-webrtc verbindet
// Peers PEER-TO-PEER (WebRTC); der Relay hier vermittelt nur die Verbindung
// (Signaling) — die Plandaten laufen NICHT über diesen Server. Über Mobilfunk
// funktioniert das, sobald dieser Relay öffentlich erreichbar ist (VPS +
// Reverse-Proxy auf wss://). Für symmetrisches NAT/Mobilfunk zusätzlich einen
// TURN-Server (coturn) angeben — siehe docs/self-hosted-relay.md.
//
// Start:  PORT=4444 node scripts/signaling-server.mjs
// Jeder Nutzer hostet seinen eigenen; in der App unter „Zusammenarbeit" die
// URL wss://relay.example.com eintragen. Ohne eigenen Relay greifen die
// öffentlichen y-webrtc-Server (Default) — reicht zum Testen, nicht für Produktion.
// ───────────────────────────────────────────────────────────────────────────
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.PORT) || 4444
const HOST = process.env.HOST || '0.0.0.0'
const PING_TIMEOUT_MS = 30_000

const wss = new WebSocketServer({ port: PORT, host: HOST })

/** topic (room) → Set<connection> */
const topics = new Map()

const send = (conn, msg) => {
  if (conn.readyState !== 0 /* CONNECTING */ && conn.readyState !== 1 /* OPEN */) conn.close()
  try {
    conn.send(JSON.stringify(msg))
  } catch {
    conn.close()
  }
}

wss.on('connection', (conn) => {
  const subscribed = new Set()
  let closed = false
  let pongReceived = true

  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close()
      clearInterval(pingInterval)
      return
    }
    pongReceived = false
    try {
      conn.ping()
    } catch {
      conn.close()
    }
  }, PING_TIMEOUT_MS)

  conn.on('pong', () => {
    pongReceived = true
  })

  conn.on('close', () => {
    subscribed.forEach((name) => {
      const subs = topics.get(name)
      if (subs) {
        subs.delete(conn)
        if (subs.size === 0) topics.delete(name)
      }
    })
    subscribed.clear()
    closed = true
    clearInterval(pingInterval)
  })

  conn.on('message', (data) => {
    let m
    try {
      m = JSON.parse(typeof data === 'string' ? data : data.toString())
    } catch {
      return
    }
    if (!m || typeof m.type !== 'string' || closed) return
    switch (m.type) {
      case 'subscribe':
        ;(m.topics || []).forEach((name) => {
          if (typeof name !== 'string') return
          let subs = topics.get(name)
          if (!subs) topics.set(name, (subs = new Set()))
          subs.add(conn)
          subscribed.add(name)
        })
        break
      case 'unsubscribe':
        ;(m.topics || []).forEach((name) => {
          const subs = topics.get(name)
          if (subs) subs.delete(conn)
        })
        break
      case 'publish':
        if (m.topic) {
          const receivers = topics.get(m.topic)
          if (receivers) {
            m.clients = receivers.size
            receivers.forEach((r) => send(r, m))
          }
        }
        break
      case 'ping':
        send(conn, { type: 'pong' })
        break
    }
  })
})

console.log(`[signaling] y-webrtc relay hört auf ws://${HOST}:${PORT} — für Mobilfunk hinter wss:// Reverse-Proxy stellen.`)
