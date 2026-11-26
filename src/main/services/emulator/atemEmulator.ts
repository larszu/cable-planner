// ───────────────────────────────────────────────────────────────────────────
// ATEM-Emulator, UDP 9910 (#1240, Stufe 5).
//
// Der Mischer-Teil des ATEM-Protokolls, so weit das Modell ihn kennt:
// Programm, Vorschau, Cut, Auto, Aux, Keyer an/aus, DSK, SuperSource-Boxen,
// Eingangsnamen und Tally. Grundlage ist das offene `atem-connection`: die
// Befehle hier sind das Spiegelbild seiner Befehlsklassen (was dort ein
// Pult serialisiert, wird hier gelesen, und umgekehrt), und der
// Integrationstest verbindet genau diese Bibliothek — dieselbe, die
// Companion benutzt. Der Paketrahmen (Kopf mit Flags, Sitzung, Quittung,
// Paketnummer; Begruessung mit neuer Sitzungsnummer) folgt der Struktur von
// pyAtemSim und Swift-Atem.
//
// Was er NICHT ist: ein Mischer. Hinter keinem Bus liegt ein Bild. Der
// Produktname beginnt deshalb immer mit „Emulator“, und ohne ausdrueckliche
// Freigabe lauscht er nur auf 127.0.0.1.
// ───────────────────────────────────────────────────────────────────────────
import dgram from 'node:dgram'
import type { AtemEmuTopology, EmuValues } from './emulatorTypes.js'

/** atem-connection `ProtocolVersion.V8_1_1`. */
export const EMU_PROTOCOL_VERSION = 0x0002001e

const FLAG_ACK_REQUEST = 0x01
const FLAG_NEW_SESSION = 0x02
const FLAG_RETRANSMIT = 0x04
const FLAG_ACK_REPLY = 0x10
const HEADER = 12
const MAX_PACKET = 1300
const RESEND_MS = 500
const KEEPALIVE_MS = 500
const DROP_MS = 5000

interface Client {
  key: string
  address: string
  port: number
  helloSession: number
  session: number
  established: boolean
  nextPacketId: number
  lastSeen: number
  inFlight: { id: number; buf: Buffer; sentAt: number }[]
}

// ─── Befehle bauen ─────────────────────────────────────────────────────

const cmd = (name: string, payload: Buffer): Buffer => {
  const head = Buffer.alloc(8)
  head.writeUInt16BE(payload.length + 8, 0)
  head.write(name, 4, 'ascii')
  return Buffer.concat([head, payload])
}
const u8s = (...v: number[]) => Buffer.from(v)
const strBuf = (s: string, len: number) => {
  const b = Buffer.alloc(len)
  b.write(s.slice(0, len - 1), 0, 'utf8')
  return b
}

const num = (v: EmuValues, k: string, d = 0) => (typeof v[k] === 'number' ? (v[k] as number) : d)
const flag = (v: EmuValues, k: string) => v[k] === true

/** Quellen, die auf PGM bzw. PVW liegen, durch SuperSource und M/E hindurch. */
export const tallyOf = (topo: AtemEmuTopology, v: EmuValues): Map<number, number> => {
  const out = new Map<number, number>()
  const mark = (id: number, bit: number, seen: Set<number>) => {
    if (seen.has(id)) return
    seen.add(id)
    out.set(id, (out.get(id) ?? 0) | bit)
    if (id >= 6000 && id < 6000 + topo.superSources) {
      const s = id - 6000
      for (let b = 0; b < topo.superSourceBoxes; b++) {
        if (flag(v, `ss.${s}.box.${b}.on`)) mark(num(v, `ss.${s}.box.${b}.src`), bit, seen)
      }
    }
    if (id >= 10010 && id % 10 === 0) {
      const m = id / 10 - 1001
      if (m >= 0 && m < topo.mixEffects) onAirOf(m, bit, seen)
    }
  }
  const onAirOf = (m: number, bit: number, seen: Set<number>) => {
    mark(num(v, `me.${m}.pgm`), bit, seen)
    for (let k = 0; k < topo.keyersPerMe; k++) {
      if (flag(v, `me.${m}.key.${k}.on`)) {
        mark(num(v, `me.${m}.key.${k}.fill`), bit, seen)
        mark(num(v, `me.${m}.key.${k}.key`), bit, seen)
      }
    }
  }
  if (topo.mixEffects > 0) {
    onAirOf(0, 1, new Set())
    for (let d = 0; d < topo.downstreamKeyers; d++) {
      if (flag(v, `dsk.${d}.on`)) {
        mark(num(v, `dsk.${d}.fill`), 1, new Set())
        mark(num(v, `dsk.${d}.key`), 1, new Set())
      }
    }
    mark(num(v, 'me.0.pvw'), 2, new Set())
  }
  return out
}

const tallyCmd = (topo: AtemEmuTopology, v: EmuValues): Buffer => {
  const t = tallyOf(topo, v)
  const ids = topo.sources.map((s) => s.id)
  const b = Buffer.alloc(2 + ids.length * 3)
  b.writeUInt16BE(ids.length, 0)
  ids.forEach((id, i) => {
    b.writeUInt16BE(id, 2 + i * 3)
    b.writeUInt8(t.get(id) ?? 0, 4 + i * 3)
  })
  return cmd('TlSr', b)
}

const inPr = (topo: AtemEmuTopology, v: EmuValues, id: number): Buffer | null => {
  const s = topo.sources.find((x) => x.id === id)
  if (!s) return null
  const b = Buffer.alloc(36)
  b.writeUInt16BE(id, 0)
  strBuf(String(v[`in.${id}.long`] ?? s.longName), 21).copy(b, 2, 0, 20)
  strBuf(String(v[`in.${id}.short`] ?? s.shortName), 5).copy(b, 22, 0, 4)
  b.writeUInt8(0, 26)
  b.writeUInt16BE(s.internalPortType === 0 ? 1 : 0, 28)
  b.writeUInt16BE(s.internalPortType === 0 ? 1 : 0, 30)
  b.writeUInt8(s.internalPortType, 32)
  // Verfuegbarkeit: Aux, Multiviewer, SuperSource-Art und -Box, Keyer.
  const outputOnly = s.internalPortType === 129
  b.writeUInt8(outputOnly ? 0x02 : 0x1f, 34)
  b.writeUInt8(outputOnly ? 0 : 0xff, 35)
  return cmd('InPr', b)
}

/** Die Befehle, die einen Schluessel abbilden (fuer Rundmeldungen). */
const commandsFor = (topo: AtemEmuTopology, v: EmuValues, key: string): Buffer[] => {
  const p = key.split('.')
  if (p[0] === 'me' && (p[2] === 'pgm' || p[2] === 'pvw')) {
    const b = Buffer.alloc(4)
    b.writeUInt8(Number(p[1]), 0)
    b.writeUInt16BE(num(v, key), 2)
    return [cmd(p[2] === 'pgm' ? 'PrgI' : 'PrvI', b)]
  }
  if (p[0] === 'me' && p[2] === 'key' && p[4] === 'on') {
    return [cmd('KeOn', u8s(Number(p[1]), Number(p[3]), flag(v, key) ? 1 : 0, 0))]
  }
  if (p[0] === 'dsk') {
    const d = Number(p[1])
    if (p[2] === 'on') return [cmd('DskS', u8s(d, flag(v, key) ? 1 : 0, 0, 0, flag(v, key) ? 1 : 0, 0, 0, 0))]
    const b = Buffer.alloc(6)
    b.writeUInt8(d, 0)
    b.writeUInt16BE(num(v, `dsk.${d}.fill`), 2)
    b.writeUInt16BE(num(v, `dsk.${d}.key`), 4)
    return [cmd('DskB', b)]
  }
  if (p[0] === 'aux') {
    const b = Buffer.alloc(4)
    b.writeUInt8(Number(p[1]), 0)
    b.writeUInt16BE(num(v, key), 2)
    return [cmd('AuxS', b)]
  }
  if (p[0] === 'ss' && p[2] === 'box') {
    const s = Number(p[1])
    const bx = Number(p[3])
    const b = Buffer.alloc(22)
    b.writeUInt8(s, 0)
    b.writeUInt8(bx, 1)
    b.writeUInt8(flag(v, `ss.${s}.box.${bx}.on`) ? 1 : 0, 2)
    b.writeUInt16BE(num(v, `ss.${s}.box.${bx}.src`), 4)
    b.writeUInt16BE(500, 10)
    return [cmd('SSBP', b)]
  }
  if (p[0] === 'in') {
    const c = inPr(topo, v, Number(p[1]))
    return c ? [c] : []
  }
  return []
}

/** Der Anfangszustand, den ein Pult nach der Begruessung bekommt. */
const initialCommands = (topo: AtemEmuTopology, v: EmuValues): Buffer[] => {
  const out: Buffer[] = []
  const ver = Buffer.alloc(4)
  ver.writeUInt32BE(EMU_PROTOCOL_VERSION, 0)
  out.push(cmd('_ver', ver))
  const pin = Buffer.alloc(44)
  strBuf(topo.productName, 41).copy(pin, 0, 0, 40)
  out.push(cmd('_pin', pin))
  const top = Buffer.alloc(24)
  ;[topo.mixEffects, topo.sources.length, topo.downstreamKeyers, topo.aux, 0, topo.mediaPlayers, 0, 0, 0, 1, 0, topo.superSources].forEach(
    (n, i) => top.writeUInt8(Math.min(255, n), i),
  )
  out.push(cmd('_top', top))
  for (let m = 0; m < topo.mixEffects; m++) out.push(cmd('_MeC', u8s(m, topo.keyersPerMe, 0, 0)))
  out.push(cmd('_mpl', u8s(topo.stills, 0, 0, 0)))
  out.push(cmd('_MAC', u8s(topo.macros, 0, 0, 0)))
  for (let s = 0; s < topo.superSources; s++) out.push(cmd('_SSC', u8s(s, 0, topo.superSourceBoxes, 0)))
  for (const s of topo.sources) {
    const c = inPr(topo, v, s.id)
    if (c) out.push(c)
  }
  for (let m = 0; m < topo.mixEffects; m++) {
    out.push(...commandsFor(topo, v, `me.${m}.pgm`), ...commandsFor(topo, v, `me.${m}.pvw`))
    for (let k = 0; k < topo.keyersPerMe; k++) out.push(...commandsFor(topo, v, `me.${m}.key.${k}.on`))
  }
  for (let d = 0; d < topo.downstreamKeyers; d++) {
    out.push(...commandsFor(topo, v, `dsk.${d}.fill`), ...commandsFor(topo, v, `dsk.${d}.on`))
  }
  for (let a = 0; a < topo.aux; a++) out.push(...commandsFor(topo, v, `aux.${a}`))
  for (let s = 0; s < topo.superSources; s++) {
    for (let b = 0; b < topo.superSourceBoxes; b++) out.push(...commandsFor(topo, v, `ss.${s}.box.${b}.src`))
  }
  out.push(tallyCmd(topo, v))
  out.push(cmd('InCm', u8s(1, 0, 0, 0)))
  return out
}

// ─── Befehle eines Pults lesen ─────────────────────────────────────────

/**
 * Einen Befehl eines Pults anwenden. Liefert die geaenderten Schluessel.
 * Unbekannte Befehle werden quittiert und sonst ignoriert.
 */
export const applyClientCommand = (topo: AtemEmuTopology, v: EmuValues, name: string, d: Buffer): EmuValues => {
  const ch: EmuValues = {}
  const set = (k: string, val: number | boolean | string) => {
    if (v[k] !== val) ch[k] = val
  }
  const me = d.length > 0 ? d.readUInt8(0) : 0
  const meOk = me < topo.mixEffects
  switch (name) {
    case 'CPgI':
      if (meOk) set(`me.${me}.pgm`, d.readUInt16BE(2))
      break
    case 'CPvI':
      if (meOk) set(`me.${me}.pvw`, d.readUInt16BE(2))
      break
    case 'DCut':
    case 'DAut':
      if (meOk) {
        set(`me.${me}.pgm`, num(v, `me.${me}.pvw`))
        set(`me.${me}.pvw`, num(v, `me.${me}.pgm`))
      }
      break
    case 'CAuS':
      if (d.readUInt8(1) < topo.aux) set(`aux.${d.readUInt8(1)}`, d.readUInt16BE(2))
      break
    case 'CKOn':
      if (meOk && d.readUInt8(1) < topo.keyersPerMe) set(`me.${me}.key.${d.readUInt8(1)}.on`, d.readUInt8(2) === 1)
      break
    case 'CDsL':
      if (me < topo.downstreamKeyers) set(`dsk.${me}.on`, d.readUInt8(1) === 1)
      break
    case 'DDsA': {
      // Ab Protokoll 8.0.1: Maske, DSK, Richtung; davor nur der DSK.
      const dsk = d.readUInt8(1)
      if (dsk < topo.downstreamKeyers) set(`dsk.${dsk}.on`, !flag(v, `dsk.${dsk}.on`))
      break
    }
    case 'CDsF':
      if (me < topo.downstreamKeyers) set(`dsk.${me}.fill`, d.readUInt16BE(2))
      break
    case 'CDsC':
      if (me < topo.downstreamKeyers) set(`dsk.${me}.key`, d.readUInt16BE(2))
      break
    case 'CSBP': {
      const mask = d.readUInt16BE(0)
      const s = d.readUInt8(2)
      const b = d.readUInt8(3)
      if (s < topo.superSources && b < topo.superSourceBoxes) {
        if (mask & 1) set(`ss.${s}.box.${b}.on`, d.readUInt8(4) === 1)
        if (mask & 2) set(`ss.${s}.box.${b}.src`, d.readUInt16BE(6))
      }
      break
    }
    case 'CInL': {
      const mask = d.readUInt8(0)
      const id = d.readUInt16BE(2)
      if (!topo.sources.some((x) => x.id === id)) break
      const text = (from: number, len: number) => d.toString('utf8', from, from + len).replace(/\0.*$/s, '')
      if (mask & 1) set(`in.${id}.long`, text(4, 20))
      if (mask & 2) set(`in.${id}.short`, text(24, 4))
      break
    }
  }
  return ch
}

// ─── Server ────────────────────────────────────────────────────────────

export interface AtemEmulatorOptions {
  host: string
  port: number
  topology: AtemEmuTopology
  values: EmuValues
  /** Ein Pult hat geschaltet: die geaenderten Schluessel. */
  onChange?: (changed: EmuValues) => void
}

export class AtemEmulator {
  private sock: dgram.Socket | null = null
  private clients = new Map<string, Client>()
  private timer: NodeJS.Timeout | null = null
  private nextClientId = 1
  private values: EmuValues
  private topo: AtemEmuTopology

  constructor(private readonly opts: AtemEmulatorOptions) {
    this.values = { ...opts.values }
    this.topo = opts.topology
  }

  get clientCount(): number {
    return [...this.clients.values()].filter((c) => c.established).length
  }

  snapshot(): EmuValues {
    return { ...this.values }
  }

  start(): Promise<{ address: string; port: number }> {
    return new Promise((resolve, reject) => {
      const sock = dgram.createSocket('udp4')
      this.sock = sock
      sock.once('error', reject)
      sock.on('message', (msg, rinfo) => this.receive(msg, rinfo.address, rinfo.port))
      sock.bind(this.opts.port, this.opts.host, () => {
        sock.off('error', reject)
        sock.on('error', () => undefined)
        this.timer = setInterval(() => this.tick(), 100)
        const a = sock.address()
        resolve({ address: a.address, port: a.port })
      })
    })
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.clients.clear()
    try {
      this.sock?.close()
    } catch {
      /* schon zu */
    }
    this.sock = null
  }

  /** Aenderungen aus dem Plan uebernehmen und an alle Pulte melden. */
  update(changed: EmuValues): void {
    const real: string[] = []
    for (const [k, val] of Object.entries(changed)) {
      if (this.values[k] !== val) {
        this.values[k] = val
        real.push(k)
      }
    }
    if (real.length) this.broadcast(real)
  }

  private broadcast(keys: string[]): void {
    const seen = new Set<string>()
    const cmds: Buffer[] = []
    for (const k of keys) {
      // DSK-Quellen gehen als ein Befehl fuer Fill und Key.
      const norm = k.replace(/^(dsk\.\d+)\.(fill|key)$/, '$1.fill').replace(/^(ss\.\d+\.box\.\d+)\.(on|src)$/, '$1.src')
      if (seen.has(norm)) continue
      seen.add(norm)
      cmds.push(...commandsFor(this.topo, this.values, norm))
    }
    cmds.push(tallyCmd(this.topo, this.values))
    for (const c of this.clients.values()) if (c.established) this.sendCommands(c, cmds)
  }

  private header(flags: number, len: number, session: number, ack: number, id: number): Buffer {
    const b = Buffer.alloc(HEADER)
    b.writeUInt16BE(((flags & 0x1f) << 11) | (len & 0x07ff), 0)
    b.writeUInt16BE(session, 2)
    b.writeUInt16BE(ack, 4)
    b.writeUInt16BE(id, 10)
    return b
  }

  private send(c: Client, buf: Buffer): void {
    this.sock?.send(buf, c.port, c.address)
  }

  private sendCommands(c: Client, cmds: Buffer[]): void {
    let batch: Buffer[] = []
    let size = HEADER
    const flush = () => {
      if (!batch.length) return
      const body = Buffer.concat(batch)
      const id = c.nextPacketId
      c.nextPacketId = (c.nextPacketId + 1) & 0x7fff
      const buf = Buffer.concat([this.header(FLAG_ACK_REQUEST, HEADER + body.length, c.session, 0, id), body])
      c.inFlight.push({ id, buf, sentAt: Date.now() })
      this.send(c, buf)
      batch = []
      size = HEADER
    }
    for (const x of cmds) {
      if (size + x.length > MAX_PACKET) flush()
      batch.push(x)
      size += x.length
    }
    flush()
  }

  private receive(msg: Buffer, address: string, port: number): void {
    if (msg.length < HEADER) return
    const flags = msg.readUInt8(0) >> 3
    const len = msg.readUInt16BE(0) & 0x07ff
    if (len !== msg.length) return
    const session = msg.readUInt16BE(2)
    const ackId = msg.readUInt16BE(4)
    const remoteId = msg.readUInt16BE(10)
    const key = `${address}:${port}`
    let c = this.clients.get(key)

    if (flags & FLAG_NEW_SESSION) {
      const clientId = this.nextClientId++ & 0x7fff
      c = {
        key,
        address,
        port,
        helloSession: session,
        session: 0x8000 | clientId,
        established: false,
        nextPacketId: 1,
        lastSeen: Date.now(),
        inFlight: [],
      }
      this.clients.set(key, c)
      const payload = Buffer.alloc(8)
      payload.writeUInt16BE(0x0200, 0)
      payload.writeUInt16BE(clientId, 2)
      this.send(c, Buffer.concat([this.header(FLAG_NEW_SESSION, HEADER + 8, session, 0, 0), payload]))
      return
    }
    if (!c) return
    c.lastSeen = Date.now()

    if (flags & FLAG_ACK_REPLY) {
      if (!c.established) {
        c.established = true
        this.sendCommands(c, initialCommands(this.topo, this.values))
      } else {
        const covered = (id: number) => ((ackId - id) & 0x7fff) < 0x4000
        c.inFlight = c.inFlight.filter((p) => !covered(p.id))
      }
    }
    if (flags & FLAG_ACK_REQUEST && c.established) {
      this.send(c, this.header(FLAG_ACK_REPLY, HEADER, c.session, remoteId, 0))
      let off = HEADER
      const changed: EmuValues = {}
      while (off + 8 <= msg.length) {
        const clen = msg.readUInt16BE(off)
        if (clen < 8 || off + clen > msg.length) break
        const name = msg.toString('ascii', off + 4, off + 8)
        Object.assign(changed, applyClientCommand(this.topo, { ...this.values, ...changed }, name, msg.subarray(off + 8, off + clen)))
        off += clen
      }
      const keys = Object.keys(changed)
      if (keys.length) {
        Object.assign(this.values, changed)
        this.broadcast(keys)
        this.opts.onChange?.(changed)
      }
    }
  }

  private tick(): void {
    const now = Date.now()
    for (const c of [...this.clients.values()]) {
      if (now - c.lastSeen > DROP_MS) {
        this.clients.delete(c.key)
        continue
      }
      if (!c.established) continue
      for (const p of c.inFlight) {
        if (now - p.sentAt > RESEND_MS) {
          p.buf.writeUInt8(p.buf.readUInt8(0) | (FLAG_RETRANSMIT << 3), 0)
          p.sentAt = now
          this.send(c, p.buf)
        }
      }
      if (c.inFlight.length === 0 && now - c.lastSeen > KEEPALIVE_MS) {
        const id = c.nextPacketId
        c.nextPacketId = (c.nextPacketId + 1) & 0x7fff
        const buf = this.header(FLAG_ACK_REQUEST, HEADER, c.session, 0, id)
        c.inFlight.push({ id, buf, sentAt: now })
        this.send(c, buf)
      }
    }
  }
}
