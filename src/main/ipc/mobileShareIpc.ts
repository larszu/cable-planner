import { app, ipcMain } from 'electron'
import path from 'node:path'
import { existsSync } from 'node:fs'
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
 *  (mobile.html + main bundle). Probes a few candidate paths and
 *  returns the first one that actually contains `mobile.html` —
 *  earlier versions hard-coded a single relative path that broke
 *  in packaged builds (mobileShareIpc.ts compiles to
 *  `dist/main/ipc/`, so `../renderer` resolves to `dist/main/renderer`
 *  which doesn't exist; the renderer is at `dist/renderer`). */
const resolveRendererDir = (): string => {
  const candidates = [
    // Packaged Electron app: app.getAppPath() is the asar root, the
    // renderer ships next to dist/main.
    path.join(app.getAppPath(), 'dist', 'renderer'),
    // Up two from dist/main/ipc/ → project_or_asar root, then into
    // dist/renderer. Works for non-asar dev launches.
    path.join(__dirname, '..', '..', 'renderer'),
    // One-up fallback (kept for backwards compatibility with very old
    // builds where the file lived a level higher).
    path.join(__dirname, '..', 'renderer'),
  ]
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'mobile.html'))) {
      return candidate
    }
  }
  // Nothing exists — return the first candidate so the 404s at least
  // come from a deterministic location the user can inspect.
  return candidates[0]
}

/** When running `npm run dev`, the renderer is served by Vite at
 *  localhost:5173 with HMR — no files exist on disk. We proxy the
 *  static-asset requests there so the mobile viewer also works in
 *  dev (the user can scan the QR while running the dev build). The
 *  env var is set by `scripts/dev:electron` in package.json. */
const resolveDevProxyUrl = (): string | undefined =>
  process.env.VITE_DEV_SERVER_URL || undefined

export const registerMobileShareIpc = () => {
  ipcMain.handle('mobileShare:start', async () => {
    return await startMobileShareServer(resolveRendererDir(), resolveDevProxyUrl())
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
