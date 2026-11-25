// #413 — Headless-Test für den lokalen LAN-Signaling-Server.
//
// Startet den echten Server (dist/main/signalingServer.js) und verifiziert mit
// zwei/drei `ws`-Clients das y-webrtc-Signaling-Relay: Subscribe → Publish wird
// an alle Topic-Abonnenten weitergereicht, Ping → Pong, Topic-Isolation und
// Unsubscribe. Das ist die headless prüfbare Hälfte der Live-Kollaboration
// (der WebRTC-/Cross-Maschine-Teil braucht echte Geräte).
//
// Nutzung:  npm run test:signaling   (baut zuerst dist/main, dann dieser Test)
// Exit 0 = alle Asserts grün, Exit 1 = Fehler (CI-tauglich).

import { spawn } from 'node:child_process'
import { WebSocket } from 'ws'
import { startSignalingServer, stopSignalingServer } from '../dist/main/signalingServer.js'

let failures = 0
const assert = (cond, msg) => {
  console.log(cond ? '  OK ' : '  XX ', msg)
  if (!cond) failures++
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
const open = (ws) =>
  new Promise((res, rej) => {
    ws.on('open', res)
    ws.on('error', rej)
  })
/** Wartet auf die nächste Nachricht eines bestimmten Typs (mit Timeout). */
const waitFor = (ws, type, ms = 1000) =>
  new Promise((res) => {
    const onMsg = (data) => {
      let m
      try {
        m = JSON.parse(data.toString())
      } catch {
        return
      }
      if (m && m.type === type) {
        ws.off('message', onMsg)
        res(m)
      }
    }
    ws.on('message', onMsg)
    setTimeout(() => {
      ws.off('message', onMsg)
      res(null)
    }, ms)
  })

/** Ergebnis eines Verbindungsversuchs: 'open' oder der HTTP-Status der Ablehnung. */
const tryConnect = (url, headers) =>
  new Promise((res) => {
    const ws = new WebSocket(url, { headers })
    ws.on('open', () => {
      ws.close()
      res('open')
    })
    ws.on('unexpected-response', (_req, r) => res(r.statusCode))
    ws.on('error', () => res('error'))
  })

// Oeffentlicher Relay (scripts/signaling-server.mjs, deploy/relay): Origin-
// Pruefung, Nachrichtengroesse und Publish-Drossel.
const checkPublicRelay = async () => {
  const port = 45000 + Math.floor(Math.random() * 5000)
  const proc = spawn(process.execPath, ['scripts/signaling-server.mjs'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', PUBLISH_RATE: '1', PUBLISH_BURST: '5', ALLOWED_ORIGINS: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise((res) => proc.stdout.on('data', (d) => String(d).includes('hört auf') && res()))
  const url = `ws://127.0.0.1:${port}`
  try {
    assert((await tryConnect(url)) === 'open', 'Relay: ohne Origin (Desktop) erlaubt')
    assert((await tryConnect(url, { Origin: 'https://larszu.github.io' })) === 'open', 'Relay: App-Origin erlaubt')
    assert((await tryConnect(url, { Origin: 'file://' })) === 'open', 'Relay: Electron (file://) erlaubt')
    assert((await tryConnect(url, { Origin: 'https://fremd.example' })) === 403, 'Relay: fremde Origin abgelehnt (403)')

    const big = new WebSocket(url)
    await open(big)
    const closed = new Promise((res) => big.on('close', (code) => res(code)))
    big.send('x'.repeat(65 * 1024))
    assert((await closed) === 1009, 'Relay: Nachricht ueber 64 kB trennt die Verbindung (1009)')

    const p = new WebSocket(url)
    const q = new WebSocket(url)
    await Promise.all([open(p), open(q)])
    q.send(JSON.stringify({ type: 'subscribe', topics: ['t'] }))
    p.send(JSON.stringify({ type: 'subscribe', topics: ['t'] }))
    await delay(50)
    let count = 0
    q.on('message', (d) => {
      if (JSON.parse(String(d)).type === 'publish') count++
    })
    for (let i = 0; i < 20; i++) p.send(JSON.stringify({ type: 'publish', topic: 't', data: i }))
    await delay(300)
    assert(count === 5, `Relay: Publish-Drossel laesst nur den Burst durch (5, war ${count})`)
    p.close()
    q.close()
  } finally {
    proc.kill()
  }
}

const run = async () => {
  const { url, port } = await startSignalingServer()
  assert(port > 0 && url.startsWith('ws://'), `Server lauscht auf ${url}`)

  const a = new WebSocket(url)
  const b = new WebSocket(url)
  await Promise.all([open(a), open(b)])

  // Beide abonnieren denselben Raum (Topic).
  a.send(JSON.stringify({ type: 'subscribe', topics: ['room-x'] }))
  b.send(JSON.stringify({ type: 'subscribe', topics: ['room-x'] }))
  await delay(50)

  // A published → B muss es bekommen, mit clients=2 annotiert.
  const bGot = waitFor(b, 'publish')
  a.send(JSON.stringify({ type: 'publish', topic: 'room-x', data: { hi: 1 } }))
  const got = await bGot
  assert(!!got && got.topic === 'room-x' && got.data?.hi === 1, 'B empfängt A’s publish im selben Topic')
  assert(!!got && got.clients === 2, `Server annotiert clients=2 (war ${got?.clients})`)

  // Ping → Pong (eigene Publish-Echos werden weggefiltert).
  const pong = waitFor(a, 'pong')
  a.send(JSON.stringify({ type: 'ping' }))
  assert(!!(await pong), 'ping → pong')

  // Topic-Isolation: ein Abonnent eines anderen Topics bekommt nichts.
  const c = new WebSocket(url)
  await open(c)
  c.send(JSON.stringify({ type: 'subscribe', topics: ['other-room'] }))
  await delay(50)
  let cGot = false
  c.once('message', () => {
    cGot = true
  })
  a.send(JSON.stringify({ type: 'publish', topic: 'room-x', data: { hi: 2 } }))
  await delay(200)
  assert(!cGot, 'Abonnent eines anderen Topics empfängt NICHTS')

  // Unsubscribe → keine Zustellung mehr an B.
  b.send(JSON.stringify({ type: 'unsubscribe', topics: ['room-x'] }))
  await delay(50)
  let bGot2 = false
  b.once('message', () => {
    bGot2 = true
  })
  a.send(JSON.stringify({ type: 'publish', topic: 'room-x', data: { hi: 3 } }))
  await delay(200)
  assert(!bGot2, 'nach Unsubscribe empfängt B nichts mehr')

  a.close()
  b.close()
  c.close()
  stopSignalingServer()
  await delay(50)

  await checkPublicRelay()

  console.log(
    failures === 0
      ? '\n✓ Alle Signaling-Relay-Checks grün'
      : `\n✗ ${failures} Check(s) fehlgeschlagen`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
