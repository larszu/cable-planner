import { app, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getMobileShareStatus,
  setMobileShareProject,
  startMobileShareServer,
  stopMobileShareServer,
} from '../services/mobileShareServer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** Resolve the directory containing the bundled renderer assets
 *  (mobile.html + main bundle). Same path that BrowserWindow.loadFile
 *  uses, just relative to `dist/main/`. */
const resolveRendererDir = (): string => {
  // Packaged Electron: app.getAppPath() ends in `app.asar`. Inside the
  // asar the renderer sits at `dist/renderer/`.
  const candidates = [
    path.join(__dirname, '..', 'renderer'),
    path.join(app.getAppPath(), 'dist', 'renderer'),
  ]
  return candidates[0]
}

export const registerMobileShareIpc = () => {
  ipcMain.handle('mobileShare:start', async () => {
    return await startMobileShareServer(resolveRendererDir())
  })
  ipcMain.handle('mobileShare:stop', () => {
    stopMobileShareServer()
    return { ok: true }
  })
  ipcMain.handle('mobileShare:status', () => getMobileShareStatus())
  ipcMain.handle('mobileShare:setProject', (_event, project: unknown) => {
    setMobileShareProject(project)
    return { ok: true }
  })
}
