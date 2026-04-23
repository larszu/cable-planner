import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export const registerLogIpc = () => {
  ipcMain.on('logs:renderer-error', (_event, payload: { message: string; stack?: string; source?: string }) => {
    try {
      const line = `[${new Date().toISOString()}] [renderer] ${payload.source ?? 'error'}: ${payload.message}\n${payload.stack ?? ''}\n`
      fs.appendFileSync(path.join(app.getPath('userData'), 'renderer-error.log'), line)
    } catch {
      /* ignore */
    }
  })
}
