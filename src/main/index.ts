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

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) { // warning/error only
      const msg = `[renderer][${level}] ${message} (${sourceId}:${line})\n`
      try {
        fs.appendFileSync(path.join(app.getPath('userData'), 'renderer-error.log'), msg)
      } catch { /* ignore */ }
    }
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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
