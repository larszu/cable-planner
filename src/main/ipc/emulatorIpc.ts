import { app, BrowserWindow, ipcMain } from 'electron'
import {
  emulatorStatus,
  onEmulatorChange,
  startEmulator,
  stopAllEmulators,
  stopEmulator,
  updateEmulator,
} from '../services/emulator/emulatorService.js'
import type { EmuKind, EmuStartRequest, EmuValues } from '../services/emulator/emulatorTypes.js'

/**
 * `emulator:*` — die Simulation als Geraet im Netz anbieten (#1240, Stufe 5):
 * ATEM (UDP 9910) und Videohub (TCP 9990). Vorgabe nur 127.0.0.1.
 * Was ein Pult schaltet, kommt als `emulator:changed` zurueck.
 */
const kindOf = (v: unknown): EmuKind => {
  if (v === 'atem' || v === 'videohub') return v
  throw new Error('Unknown emulator kind')
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const valuesOf = (v: unknown): EmuValues => {
  if (!isObj(v)) return {}
  const out: EmuValues = {}
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'number' || typeof x === 'string' || typeof x === 'boolean') out[k] = x
  }
  return out
}

export const registerEmulatorIpc = () => {
  onEmulatorChange((c) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('emulator:changed', c)
  })
  ipcMain.handle('emulator:start', (_e, raw: unknown) => {
    if (!isObj(raw) || !isObj(raw.topology) || typeof raw.equipmentId !== 'string') throw new Error('Invalid emulator request')
    const req: EmuStartRequest = {
      kind: kindOf(raw.kind),
      equipmentId: raw.equipmentId,
      lan: raw.lan === true,
      topology: raw.topology as unknown as EmuStartRequest['topology'],
      values: valuesOf(raw.values),
    }
    return startEmulator(req)
  })
  ipcMain.handle('emulator:stop', (_e, kind: unknown) => stopEmulator(kindOf(kind)))
  ipcMain.handle('emulator:status', (_e, kind: unknown) => emulatorStatus(kindOf(kind)))
  ipcMain.handle('emulator:update', (_e, kind: unknown, equipmentId: unknown, values: unknown) =>
    updateEmulator(kindOf(kind), typeof equipmentId === 'string' ? equipmentId : '', valuesOf(values)),
  )
  app.on('will-quit', () => stopAllEmulators())
}
