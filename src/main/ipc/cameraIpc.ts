import { app, ipcMain } from 'electron'
import { bridgeStatus, connectBridge, disconnectBridge, sendToBridge } from '../services/cameraBridgeClient.js'

/** `camera:*` — die LZ Camera Bridge des Raums (PTZ, Presets, Livebild, Mischer-Tally). */
export const registerCameraIpc = () => {
  ipcMain.handle('camera:connect', (_e, address: unknown) => {
    const a = address as { host?: unknown; port?: unknown } | null
    return connectBridge({ host: typeof a?.host === 'string' ? a.host : '', port: Number(a?.port ?? 9700) })
  })
  ipcMain.handle('camera:disconnect', () => {
    disconnectBridge()
    return { ok: true, message: 'getrennt' }
  })
  ipcMain.handle('camera:send', (_e, msg: unknown) => sendToBridge(msg))
  ipcMain.handle('camera:status', () => bridgeStatus())
  app.on('will-quit', () => disconnectBridge())
}
