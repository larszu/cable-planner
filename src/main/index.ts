import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { registerCredentialsIpc } from './ipc/credentialsIpc.js'
import { registerRentmanIpc } from './ipc/rentmanIpc.js'
import { registerProjectIpc } from './ipc/projectIpc.js'
import { registerAtemIpc } from './ipc/atemIpc.js'
import { registerVideohubIpc } from './ipc/videohubIpc.js'
import { registerLogIpc } from './ipc/logIpc.js'
import { registerSyncIpc } from './ipc/syncIpc.js'
import { registerGraphmlIpc } from './ipc/graphmlIpc.js'
import { registerMobileShareIpc } from './ipc/mobileShareIpc.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === '1'

// Prevents black-screen rendering issues seen on some Windows GPU drivers.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    const msg = `[did-fail-load] code=${code} desc=${description} url=${url}\n`
    console.error(msg)
    try {
      fs.appendFileSync(path.join(app.getPath('userData'), 'renderer-error.log'), msg)
    } catch { /* ignore */ }
  })

  // v7.9.4 — Electron 42+ liefert ein einziges Event-Object statt
  // (event, level, message, line, sourceId) (alte Signatur deprecated).
  // Neue Felder: event.level ist ein String ('warning'/'error'/...),
  // event.message, event.lineNumber, event.sourceId.
  mainWindow.webContents.on('console-message', (event) => {
    const e = event as unknown as {
      level?: string | number
      message?: string
      lineNumber?: number
      sourceId?: string
    }
    const isSerious =
      e.level === 'warning' ||
      e.level === 'error' ||
      (typeof e.level === 'number' && e.level >= 2)
    if (!isSerious) return
    const msg = `[renderer][${e.level}] ${e.message ?? ''} (${e.sourceId ?? '?'}:${e.lineNumber ?? '?'})\n`
    try {
      fs.appendFileSync(path.join(app.getPath('userData'), 'renderer-error.log'), msg)
    } catch { /* ignore */ }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // v7.9.4 — Wenn Vite kurz nach `wait-on` noch nicht antwortet
    // (z.B. HMR-Bundling läuft, Dependency-Optimizer kalt), bleibt
    // Electron auf chrome-error://chromewebdata/ hängen und JEDE
    // spätere Navigation wird cross-origin geblockt
    // ("Unsafe attempt to load URL ... from frame with URL
    // chrome-error://..."). Retry mit exponentiellem Backoff
    // bis Vite tatsächlich liefert.
    const url = process.env.VITE_DEV_SERVER_URL
    let attempt = 0
    while (attempt < 8) {
      try {
        await mainWindow.loadURL(url)
        break
      } catch (err) {
        attempt += 1
        const delay = Math.min(2000, 200 * 2 ** attempt)
        console.warn(`[main] loadURL ${url} failed (attempt ${attempt}): ${(err as Error).message}. Retry in ${delay}ms`)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
    if (shouldOpenDevTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // F12 opens DevTools for debugging in production
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools()
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }
    }
  })
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  registerCredentialsIpc()
  registerRentmanIpc()
  registerProjectIpc()
  registerAtemIpc()
  registerVideohubIpc()
  registerLogIpc()
  registerSyncIpc()
  registerGraphmlIpc()
  registerMobileShareIpc()

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
