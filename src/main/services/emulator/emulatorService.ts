// ───────────────────────────────────────────────────────────────────────────
// Emulator-Server verwalten (#1240, Stufe 5): hoechstens einer je Art, weil
// der Port des Geraets (ATEM 9910, Videohub 9990) feststeht.
//
// SICHERHEIT: Vorgabe ist 127.0.0.1. Erst die ausdrueckliche Freigabe in der
// Innenansicht bindet an alle Schnittstellen, und auch dann nennt sich der
// Emulator in jedem Pult „Emulator …“ — eine Verwechslung mit der echten
// Anlage soll nicht moeglich sein.
// ───────────────────────────────────────────────────────────────────────────
import os from 'node:os'
import { AtemEmulator } from './atemEmulator.js'
import { VideohubEmulator } from './videohubEmulator.js'
import type {
  AtemEmuTopology,
  EmuChange,
  EmuKind,
  EmuStartRequest,
  EmuStatus,
  EmuValues,
  VideohubEmuTopology,
} from './emulatorTypes.js'

export const EMU_DEFAULT_PORT: Record<EmuKind, number> = { atem: 9910, videohub: 9990 }
const PREFIX = 'Emulator'

interface Running {
  kind: EmuKind
  equipmentId: string
  lan: boolean
  address: string
  server: AtemEmulator | VideohubEmulator
}

const running = new Map<EmuKind, Running>()
let listener: ((c: EmuChange) => void) | null = null

/** Wer die Aenderungen der Pulte bekommt (main: alle Fenster). */
export const onEmulatorChange = (cb: (c: EmuChange) => void): void => {
  listener = cb
}

const lanAddress = (): string | null => {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return null
}

const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0)
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)

/** Topologie aus dem Renderer auf sinnvolle Grenzen bringen. */
const cleanAtem = (t: AtemEmuTopology): AtemEmuTopology => ({
  productName: str(t.productName, 'ATEM'),
  mixEffects: n(t.mixEffects, 8),
  keyersPerMe: n(t.keyersPerMe, 16),
  downstreamKeyers: n(t.downstreamKeyers, 8),
  aux: n(t.aux, 64),
  mediaPlayers: n(t.mediaPlayers, 16),
  superSources: n(t.superSources, 8),
  superSourceBoxes: n(t.superSourceBoxes, 16),
  stills: n(t.stills, 255),
  macros: n(t.macros, 255),
  sources: (Array.isArray(t.sources) ? t.sources : []).slice(0, 255).map((s) => ({
    id: n(s?.id, 0xffff),
    longName: str(s?.longName, ''),
    shortName: str(s?.shortName, ''),
    internalPortType: n(s?.internalPortType, 255),
  })),
})
const cleanVideohub = (t: VideohubEmuTopology): VideohubEmuTopology => ({
  friendlyName: str(t.friendlyName, 'Videohub'),
  inputs: n(t.inputs, 288),
  outputs: n(t.outputs, 288),
})

/** Name immer mit „Emulator“ vorn, damit niemand ihn fuer das Geraet haelt. */
const markiert = (name: string) => (name.startsWith(PREFIX) ? name : `${PREFIX} ${name}`).slice(0, 39)

export const emulatorStatus = (kind: EmuKind): EmuStatus => {
  const r = running.get(kind)
  return r
    ? { kind, equipmentId: r.equipmentId, running: true, address: r.address, lan: r.lan, clients: r.server.clientCount }
    : { kind, equipmentId: '', running: false, address: null, lan: false, clients: 0 }
}

export const stopEmulator = (kind: EmuKind): EmuStatus => {
  running.get(kind)?.server.stop()
  running.delete(kind)
  return emulatorStatus(kind)
}

export const stopAllEmulators = (): void => {
  for (const k of [...running.keys()]) stopEmulator(k)
}

export const startEmulator = async (req: EmuStartRequest): Promise<EmuStatus> => {
  if (req.kind !== 'atem' && req.kind !== 'videohub') throw new Error('Unknown emulator kind')
  stopEmulator(req.kind)
  const host = req.lan ? '0.0.0.0' : '127.0.0.1'
  const port = Number.isInteger(req.port) && (req.port as number) >= 0 && (req.port as number) < 65536 ? (req.port as number) : EMU_DEFAULT_PORT[req.kind]
  const onChange = (values: EmuValues) => listener?.({ kind: req.kind, equipmentId: req.equipmentId, values })
  const server =
    req.kind === 'atem'
      ? new AtemEmulator({
          host,
          port,
          topology: (({ productName, ...t }) => ({ ...t, productName: markiert(productName) }))(cleanAtem(req.topology as AtemEmuTopology)),
          values: req.values,
          onChange,
        })
      : new VideohubEmulator({
          host,
          port,
          topology: (({ friendlyName, ...t }) => ({ ...t, friendlyName: markiert(friendlyName) }))(cleanVideohub(req.topology as VideohubEmuTopology)),
          values: req.values,
          onChange,
        })
  try {
    const a = await server.start()
    const shown = req.lan ? `${lanAddress() ?? '0.0.0.0'}:${a.port}` : `127.0.0.1:${a.port}`
    running.set(req.kind, { kind: req.kind, equipmentId: req.equipmentId, lan: req.lan, address: shown, server })
    return emulatorStatus(req.kind)
  } catch (e) {
    server.stop()
    return { ...emulatorStatus(req.kind), error: e instanceof Error ? e.message : String(e) }
  }
}

/** Aenderungen aus dem Plan an den laufenden Emulator. */
export const updateEmulator = (kind: EmuKind, equipmentId: string, values: EmuValues): EmuStatus => {
  const r = running.get(kind)
  if (r && r.equipmentId === equipmentId) r.server.update(values)
  return emulatorStatus(kind)
}
