import { app, ipcMain } from 'electron'
import { greengoSend, greengoStart, greengoStatus, greengoStop } from '../services/greengoOsc.js'

/** `greengo:*` — ein Green-GO-Geraet live, ueber OSC und das Geraeteskript osc-remote.gg5t. */
export const registerGreengoIpc = () => {
  ipcMain.handle('greengo:connect', (_e, a: unknown) => {
    const x = a as { host?: unknown; port?: unknown } | null
    return greengoStart(typeof x?.host === 'string' ? x.host : '', Number(x?.port ?? 8000))
  })
  ipcMain.handle('greengo:disconnect', () => {
    greengoStop()
    return { ok: true, message: '' }
  })
  ipcMain.handle('greengo:send', (_e, path: unknown, args: unknown) =>
    greengoSend(typeof path === 'string' ? path : '', Array.isArray(args) ? args.map(Number) : []),
  )
  ipcMain.handle('greengo:status', () => greengoStatus())
  app.on('will-quit', () => greengoStop())
}
