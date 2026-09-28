// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'

// #869 — der oeffentliche Relay (`deploy/relay`) laeuft mit genau diesem
// Skript. Die Grenzen werden am echten Prozess gemessen, nicht angenommen.
let proc: ChildProcess | null = null
afterEach(() => {
  proc?.kill()
  proc = null
})

const start = async (env: Record<string, string>) => {
  const port = 20000 + Math.floor(Math.random() * 20000)
  proc = spawn(process.execPath, ['scripts/signaling-server.mjs'], { env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ...env } })
  await new Promise<void>((res) => proc!.stdout!.once('data', () => res()))
  return `ws://127.0.0.1:${port}`
}
const open = (url: string) =>
  new Promise<WebSocket>((res, rej) => {
    const ws = new WebSocket(url)
    ws.once('open', () => res(ws))
    ws.once('error', rej)
  })
const closedWith = (ws: WebSocket) => new Promise<number>((res) => ws.once('close', (code) => res(code)))

describe('oeffentlicher Signaling-Relay (#869)', () => {
  it('begrenzt Verbindungen je Adresse', async () => {
    const url = await start({ MAX_PER_IP: '2' })
    const a = await open(url)
    const b = await open(url)
    const c = new WebSocket(url)
    expect(await closedWith(c)).toBe(1013)
    a.close()
    b.close()
  })

  it('vermittelt weiter und begrenzt die Raeume je Verbindung', async () => {
    const url = await start({ MAX_TOPICS: '1' })
    const a = await open(url)
    const b = await open(url)
    a.send(JSON.stringify({ type: 'subscribe', topics: ['raum-1', 'raum-2'] }))
    b.send(JSON.stringify({ type: 'subscribe', topics: ['raum-1'] }))
    await new Promise((r) => setTimeout(r, 100))
    const got = new Promise<string>((res) => a.once('message', (d) => res(String(d))))
    b.send(JSON.stringify({ type: 'publish', topic: 'raum-1', data: 'hallo' }))
    expect(JSON.parse(await got)).toMatchObject({ topic: 'raum-1', data: 'hallo', clients: 2 })
    // raum-2 war die zweite Anmeldung von a und ist abgewiesen: niemand empfaengt dort.
    const leer = new Promise<boolean>((res) => {
      a.once('message', () => res(false))
      setTimeout(() => res(true), 200)
    })
    b.send(JSON.stringify({ type: 'publish', topic: 'raum-2', data: 'x' }))
    expect(await leer).toBe(true)
    a.close()
    b.close()
  })
})
