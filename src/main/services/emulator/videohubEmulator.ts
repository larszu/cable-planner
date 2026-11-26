// ───────────────────────────────────────────────────────────────────────────
// Videohub-Emulator, TCP 9990 (#1240, Stufe 5).
//
// Das Text-Protokoll aus der oeffentlichen Blackmagic-Doku (Videohub
// Developer Information im Handbuch): Bloecke aus Kopfzeile, Zeilen und
// Leerzeile. Beim Verbinden schickt das Geraet PROTOCOL PREAMBLE, VIDEOHUB
// DEVICE, die Beschriftungen, Sperren und das Routing und zum Schluss
// END PRELUDE. Ein Block des Pults wird mit ACK oder NAK beantwortet; eine
// Aenderung geht danach an ALLE verbundenen Pulte. Ein Block mit Kopfzeile
// und ohne Zeilen fragt den Stand ab.
//
// Sperren: „L“ = von jemand anderem gesperrt, „O“ = von mir, „U“ = frei;
// ein Pult schickt O (sperren), U (freigeben) oder F (Freigabe erzwingen).
// Was der Plan sperrt, ist fuer jedes Pult „L“ und laesst sich nicht
// freigeben — der Plan ist hier der Besitzer.
// ───────────────────────────────────────────────────────────────────────────
import net from 'node:net'
import type { EmuValues, VideohubEmuTopology } from './emulatorTypes.js'

export const VIDEOHUB_PROTOCOL_VERSION = '2.8'

export interface VideohubEmulatorOptions {
  host: string
  port: number
  topology: VideohubEmuTopology
  values: EmuValues
  onChange?: (changed: EmuValues) => void
}

interface Conn {
  sock: net.Socket
  buf: string
  id: number
}

export class VideohubEmulator {
  private server: net.Server | null = null
  private conns = new Set<Conn>()
  private values: EmuValues
  /** Ausgang -> Pult, das ihn gesperrt hat. */
  private clientLocks = new Map<number, number>()
  private nextId = 1

  constructor(private readonly opts: VideohubEmulatorOptions) {
    this.values = { ...opts.values }
  }

  get clientCount(): number {
    return this.conns.size
  }

  snapshot(): EmuValues {
    return { ...this.values }
  }

  start(): Promise<{ address: string; port: number }> {
    return new Promise((resolve, reject) => {
      const srv = net.createServer((sock) => this.accept(sock))
      this.server = srv
      srv.once('error', reject)
      srv.listen(this.opts.port, this.opts.host, () => {
        srv.off('error', reject)
        const a = srv.address() as net.AddressInfo
        resolve({ address: a.address, port: a.port })
      })
    })
  }

  stop(): void {
    for (const c of this.conns) c.sock.destroy()
    this.conns.clear()
    this.server?.close()
    this.server = null
  }

  /** Aenderungen aus dem Plan uebernehmen und an alle Pulte melden. */
  update(changed: EmuValues): void {
    const keys = Object.keys(changed).filter((k) => this.values[k] !== changed[k])
    for (const k of keys) this.values[k] = changed[k]
    if (keys.length) this.broadcastKeys(keys)
  }

  private get t() {
    return this.opts.topology
  }

  private block(header: string, lines: string[]): string {
    return `${header}\n${lines.map((l) => `${l}\n`).join('')}\n`
  }

  private labels(prefix: 'in' | 'out', n: number, idx?: number[]): string[] {
    return (idx ?? [...Array(n).keys()]).map((i) => `${i} ${String(this.values[`${prefix}.${i}`] ?? `${prefix === 'in' ? 'Input' : 'Output'} ${i + 1}`)}`)
  }

  private routing(idx?: number[]): string[] {
    return (idx ?? [...Array(this.t.outputs).keys()]).map((o) => `${o} ${typeof this.values[`route.${o}`] === 'number' ? this.values[`route.${o}`] : 0}`)
  }

  private lockChar(o: number, conn: Conn): string {
    if (this.values[`lock.${o}`] === true) return 'L'
    const owner = this.clientLocks.get(o)
    if (owner === undefined) return 'U'
    return owner === conn.id ? 'O' : 'L'
  }

  private locks(conn: Conn, idx?: number[]): string[] {
    return (idx ?? [...Array(this.t.outputs).keys()]).map((o) => `${o} ${this.lockChar(o, conn)}`)
  }

  private deviceBlock(): string {
    return this.block('VIDEOHUB DEVICE:', [
        'Device present: true',
        `Model name: Blackmagic Videohub (${this.t.friendlyName})`,
        `Friendly name: ${this.t.friendlyName}`,
        'Unique ID: 00000000EE00',
        `Video inputs: ${this.t.inputs}`,
        'Video processing units: 0',
        `Video outputs: ${this.t.outputs}`,
        'Video monitoring outputs: 0',
        'Serial ports: 0',
      ])
  }

  private prelude(conn: Conn): string {
    return [
      this.block('PROTOCOL PREAMBLE:', [`Version: ${VIDEOHUB_PROTOCOL_VERSION}`]),
      this.deviceBlock(),
      this.block('INPUT LABELS:', this.labels('in', this.t.inputs)),
      this.block('OUTPUT LABELS:', this.labels('out', this.t.outputs)),
      this.block('VIDEO OUTPUT LOCKS:', this.locks(conn)),
      this.block('VIDEO OUTPUT ROUTING:', this.routing()),
      this.block('END PRELUDE:', []),
    ].join('')
  }

  private accept(sock: net.Socket): void {
    const conn: Conn = { sock, buf: '', id: this.nextId++ }
    this.conns.add(conn)
    sock.setEncoding('utf8')
    sock.on('data', (d: string) => {
      conn.buf += d.replace(/\r\n/g, '\n')
      let i: number
      while ((i = conn.buf.indexOf('\n\n')) !== -1) {
        const raw = conn.buf.slice(0, i)
        conn.buf = conn.buf.slice(i + 2)
        if (raw.trim()) this.handle(conn, raw)
      }
    })
    const drop = () => {
      this.conns.delete(conn)
      for (const [o, owner] of [...this.clientLocks]) if (owner === conn.id) this.clientLocks.delete(o)
    }
    sock.on('close', drop)
    sock.on('error', drop)
    sock.write(this.prelude(conn))
  }

  private handle(conn: Conn, raw: string): void {
    const [header, ...rest] = raw.split('\n').map((l) => l.trimEnd())
    const lines = rest.filter((l) => l !== '')
    const pairs = lines.map((l) => /^(\d+)\s+(.*)$/.exec(l))
    const ack = () => void conn.sock.write('ACK\n\n')
    const nak = () => void conn.sock.write('NAK\n\n')
    if (header === 'PING:') return ack()
    if (pairs.some((p) => !p)) return nak()
    const items = pairs.map((p) => ({ i: Number(p![1]), rest: p![2] }))

    if (header === 'VIDEO OUTPUT ROUTING:') {
      if (!items.length) return this.answer(conn, this.block(header, this.routing()))
      const ok = items.every((x) => x.i < this.t.outputs && /^\d+$/.test(x.rest) && Number(x.rest) < this.t.inputs && this.lockChar(x.i, conn) !== 'L')
      if (!ok) return nak()
      ack()
      return this.change(Object.fromEntries(items.map((x) => [`route.${x.i}`, Number(x.rest)])))
    }
    if (header === 'INPUT LABELS:' || header === 'OUTPUT LABELS:') {
      const prefix = header === 'INPUT LABELS:' ? 'in' : 'out'
      const n = prefix === 'in' ? this.t.inputs : this.t.outputs
      if (!items.length) return this.answer(conn, this.block(header, this.labels(prefix, n)))
      if (!items.every((x) => x.i < n)) return nak()
      ack()
      return this.change(Object.fromEntries(items.map((x) => [`${prefix}.${x.i}`, x.rest])))
    }
    if (header === 'VIDEO OUTPUT LOCKS:') {
      if (!items.length) return this.answer(conn, this.block(header, this.locks(conn)))
      if (!items.every((x) => x.i < this.t.outputs && /^[OUFL]$/.test(x.rest))) return nak()
      for (const x of items) {
        if (this.values[`lock.${x.i}`] === true) return nak()
        const owner = this.clientLocks.get(x.i)
        if ((x.rest === 'O' || x.rest === 'L') && (owner === undefined || owner === conn.id)) this.clientLocks.set(x.i, conn.id)
        else if (x.rest === 'U' && owner === conn.id) this.clientLocks.delete(x.i)
        else if (x.rest === 'F') this.clientLocks.delete(x.i)
        else return nak()
      }
      ack()
      for (const c of this.conns) c.sock.write(this.block(header, this.locks(c, items.map((x) => x.i))))
      return
    }
    if (header === 'VIDEOHUB DEVICE:' && !items.length) return this.answer(conn, this.deviceBlock())
    return nak()
  }

  /** Abfrage: ACK, dann der Stand. */
  private answer(conn: Conn, block: string): void {
    conn.sock.write(`ACK\n\n${block}`)
  }

  private change(changed: EmuValues): void {
    const keys = Object.keys(changed).filter((k) => this.values[k] !== changed[k])
    for (const k of keys) this.values[k] = changed[k]
    // Auch ein unveraenderter Kreuzpunkt wird gemeldet: das Pult wartet darauf.
    this.broadcastKeys(Object.keys(changed))
    const real = Object.fromEntries(keys.map((k) => [k, changed[k]]))
    if (keys.length) this.opts.onChange?.(real)
  }

  private broadcastKeys(keys: string[]): void {
    const idx = (p: string) => keys.filter((k) => k.startsWith(`${p}.`)).map((k) => Number(k.split('.')[1]))
    for (const c of this.conns) {
      let out = ''
      if (idx('route').length) out += this.block('VIDEO OUTPUT ROUTING:', this.routing(idx('route')))
      if (idx('in').length) out += this.block('INPUT LABELS:', this.labels('in', this.t.inputs, idx('in')))
      if (idx('out').length) out += this.block('OUTPUT LABELS:', this.labels('out', this.t.outputs, idx('out')))
      if (idx('lock').length) out += this.block('VIDEO OUTPUT LOCKS:', this.locks(c, idx('lock')))
      if (out) c.sock.write(out)
    }
  }
}
