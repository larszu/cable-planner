import { app, BrowserWindow, Menu, session, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { registerCredentialsIpc } from './ipc/credentialsIpc.js'
import { registerRentmanIpc } from './ipc/rentmanIpc.js'
import { openExternalProject, registerProjectIpc } from './ipc/projectIpc.js'
import { findProjectPathInArgv, setPendingLaunchPath } from './services/fileOpenService.js'
import { registerAtemIpc } from './ipc/atemIpc.js'
import { registerVideohubIpc } from './ipc/videohubIpc.js'
import { registerLogIpc } from './ipc/logIpc.js'
import { registerSyncIpc } from './ipc/syncIpc.js'
import { registerGraphmlIpc } from './ipc/graphmlIpc.js'
import { registerMobileShareIpc } from './ipc/mobileShareIpc.js'
import { registerCollabDiscoveryIpc } from './ipc/collabDiscoveryIpc.js'
import { registerPrintIpc } from './ipc/printIpc.js'
import { registerLibraryIpc } from './ipc/libraryIpc.js'
import { registerSignalingIpc } from './ipc/signalingIpc.js'
import { stopSignalingServer } from './signalingServer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
const shouldOpenDevTools = process.env.ELECTRON_OPEN_DEVTOOLS === '1'

const firstReadyWindow = (): BrowserWindow | null =>
  BrowserWindow.getAllWindows().find((w) => !w.isDestroyed()) ?? null

// #pre-sale — Single-Instance-Lock: ein Doppelklick auf eine .cableplan-Datei
// während die App schon läuft soll keine zweite Instanz starten, sondern den
// Pfad an die laufende reichen (second-instance). Ohne Lock öffnet jede Datei
// ein eigenes App-Fenster mit leerem zweiten Prozess.
const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
} else {
  // macOS reicht das Öffnen über open-file rein — das kann VOR app.whenReady
  // feuern (OS startet die App mit der Datei). Existiert noch kein Fenster,
  // puffern wir den Pfad; der Renderer holt ihn beim Mounten ab.
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    const win = firstReadyWindow()
    if (win) void openExternalProject(win, filePath)
    else setPendingLaunchPath(filePath)
  })

  // Windows/Linux: die zweite Instanz (Doppelklick bei laufender App) bekommt
  // den Pfad in ihrem argv; an das vorhandene Fenster weiterreichen + fokussieren.
  app.on('second-instance', (_event, argv) => {
    const win = firstReadyWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
    const filePath = findProjectPathInArgv(argv)
    if (filePath) void openExternalProject(win, filePath)
  })
}

// Append to a log file with a hard size cap so a crash-loop can't fill
// the user's disk. When the file passes the cap it is rotated to `.1`.
const LOG_MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const appendLogCapped = (fileName: string, msg: string): void => {
  try {
    const file = path.join(app.getPath('userData'), fileName)
    try {
      if (fs.statSync(file).size > LOG_MAX_BYTES) {
        fs.renameSync(file, `${file}.1`)
      }
    } catch {
      /* no existing file → fine */
    }
    fs.appendFileSync(file, msg)
  } catch {
    /* ignore */
  }
}

// Prevents black-screen rendering issues seen on some Windows GPU drivers.
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// v7.9.23 — Window-Geometry-Defaults + Persistenz.
// Vorher waren width/height hardcoded — beim Start landete jedes Mal
// das gleiche 1500x900-Fenster, egal wo der User es zuletzt hatte.
// Jetzt: lokale Datei `window-geometry.json` in userData speichert
// die letzte Position/Größe und stellt sie beim nächsten Start wieder
// her. Min-Größen + Default-Größe sind weiterhin Konstanten weil sie
// nicht user-konfigurierbar sind.
const WINDOW_DEFAULTS = {
  width: 1500,
  height: 900,
  minWidth: 1100,
  minHeight: 700,
}
const GEOMETRY_FILE = 'window-geometry.json'
type Geometry = { x?: number; y?: number; width: number; height: number; maximized?: boolean }
const loadGeometry = (): Geometry => {
  try {
    const file = path.join(app.getPath('userData'), GEOMETRY_FILE)
    if (!fs.existsSync(file)) {
      return { width: WINDOW_DEFAULTS.width, height: WINDOW_DEFAULTS.height }
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<Geometry>
    return {
      x: typeof raw.x === 'number' ? raw.x : undefined,
      y: typeof raw.y === 'number' ? raw.y : undefined,
      width: Math.max(
        WINDOW_DEFAULTS.minWidth,
        typeof raw.width === 'number' ? raw.width : WINDOW_DEFAULTS.width,
      ),
      height: Math.max(
        WINDOW_DEFAULTS.minHeight,
        typeof raw.height === 'number' ? raw.height : WINDOW_DEFAULTS.height,
      ),
      maximized: !!raw.maximized,
    }
  } catch {
    return { width: WINDOW_DEFAULTS.width, height: WINDOW_DEFAULTS.height }
  }
}
const saveGeometry = (win: BrowserWindow) => {
  try {
    const bounds = win.getBounds()
    const data: Geometry = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized(),
    }
    fs.writeFileSync(
      path.join(app.getPath('userData'), GEOMETRY_FILE),
      JSON.stringify(data, null, 2),
    )
  } catch {
    /* ignore */
  }
}

const createWindow = async () => {
  const geometry = loadGeometry()
  const mainWindow = new BrowserWindow({
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    show: false,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  // Harden the renderer trust boundary:
  //  - deny in-app navigation to foreign origins (a malicious link/redirect
  //    must not be able to load attacker content into the privileged frame),
  //  - route window.open / target=_blank to the OS browser instead of a new
  //    Electron window that would inherit the preload bridge.
  const appOrigin = isDev && process.env.VITE_DEV_SERVER_URL
    ? new URL(process.env.VITE_DEV_SERVER_URL).origin
    : 'file://'
  mainWindow.webContents.on('will-navigate', (event, navUrl) => {
    const ok = isDev ? navUrl.startsWith(appOrigin) : navUrl.startsWith('file://')
    if (!ok) {
      event.preventDefault()
      if (/^https?:/.test(navUrl)) void shell.openExternal(navUrl)
    }
  })
  // Popout-/Link-Verhalten wird weiter unten in EINEM setWindowOpenHandler
  // geregelt (Popout-Fenster zulassen + Preload, externe Links in den Browser).
  if (geometry.maximized) mainWindow.maximize()
  // Persist on user-initiated resize/move/maximize so even crashes
  // don't lose the user's window placement.
  let saveTimer: NodeJS.Timeout | null = null
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveGeometry(mainWindow), 400)
  }
  mainWindow.on('resize', scheduleSave)
  mainWindow.on('move', scheduleSave)
  mainWindow.on('maximize', scheduleSave)
  mainWindow.on('unmaximize', scheduleSave)
  mainWindow.on('close', () => saveGeometry(mainWindow))

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    const msg = `[did-fail-load] code=${code} desc=${description} url=${url}\n`
    console.error(msg)
    appendLogCapped('renderer-error.log', msg)
  })

  // v7.9.4 — `show: false` + ready-to-show MUSS vor loadURL registriert
  // werden, sonst feuert das Event evtl. bevor wir zuhören → das Fenster
  // bleibt unsichtbar und der User denkt Electron sei nicht gestartet.
  // Plus 5s-Fallback: falls ready-to-show aus irgendeinem Grund nicht
  // feuert (Renderer-Crash, blockierte JS-Init, …) zeigen wir das
  // Fenster trotzdem damit der User sieht was los ist.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
  const showFallbackTimer = setTimeout(() => {
    if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.warn('[main] ready-to-show 5s timeout — showing window anyway')
      mainWindow.show()
    }
  }, 5000)
  mainWindow.once('show', () => clearTimeout(showFallbackTimer))
  mainWindow.once('closed', () => clearTimeout(showFallbackTimer))

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
    appendLogCapped('renderer-error.log', msg)
  })

  // #427 — Panel-Popouts (`window.open(... ?popout=<panel>)`) sind eigene
  // OS-Fenster. Electron gibt per `window.open` erzeugten Child-Windows NICHT
  // automatisch das preload-Script mit — ohne preload ist `window.cablePlanner`
  // im Popout `undefined`, die Renderer-Bridge fällt auf den Web-Fallback
  // zurück und IPC-gestützte Panels brechen (leere Library, Settings/ATEM/
  // Videohub als No-op). Darum hier dasselbe preload + dieselben sicheren
  // webPreferences wie im Hauptfenster injizieren. Alle anderen window.open-
  // bzw. target="_blank"-Links (PayPal, GitHub, Docs) öffnen wir im echten
  // Standard-Browser statt in einem Electron-Fenster.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    let isPopout = false
    try {
      isPopout = new URL(url).searchParams.has('popout')
    } catch {
      /* about:blank o. Ä. — kein Popout */
    }
    if (isPopout) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          backgroundColor: '#0f172a',
          autoHideMenuBar: true,
          minWidth: 360,
          minHeight: 480,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.cjs'),
          },
        },
      }
    }
    if (/^(https?:|mailto:)/i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
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

  // F12 toggles DevTools — only in dev / when explicitly opted in. Shipping
  // a Node-backed console into production hands an attacker (or a curious
  // user with a malicious project file) the full IPC surface.
  if (isDev || shouldOpenDevTools) {
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
  return mainWindow
}

app.whenReady().then(async () => {
  // Zweite Instanz hat den Lock nicht bekommen → wir haben oben bereits
  // app.quit() gerufen; hier nichts mehr aufbauen (kein zweites Fenster).
  if (!gotInstanceLock) return

  Menu.setApplicationMenu(null)

  // Content-Security-Policy for the packaged renderer. Skipped in dev
  // because Vite's HMR needs inline/eval scripts and a ws: connection;
  // the threat model is the shipped app, not the local dev server.
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              // ws:/wss: für die Live-Kollaboration (y-webrtc-Signaling: lokaler
              // LAN-Server + öffentlicher Fallback) — sonst blockt die CSP den
              // Signaling-WebSocket und keine Session verbindet sich.
              "connect-src 'self' https://api.rentman.net https://generativelanguage.googleapis.com ws: wss:; " +
              "object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
          ],
          'X-Content-Type-Options': ['nosniff'],
        },
      })
    })
  }

  registerCredentialsIpc()
  registerRentmanIpc()
  registerProjectIpc()
  registerAtemIpc()
  registerVideohubIpc()
  registerLogIpc()
  registerSyncIpc()
  registerGraphmlIpc()
  registerMobileShareIpc()
  registerCollabDiscoveryIpc()
  registerPrintIpc()
  registerLibraryIpc()
  registerSignalingIpc()

  const mainWindow = await createWindow()

  // #pre-sale — Kaltstart per Doppelklick (Windows/Linux): der Datei-Pfad
  // steht in process.argv. Puffern, damit der Renderer ihn beim Mounten über
  // project:get-launch-file abholt. macOS liefert ihn stattdessen via open-file
  // (oben), das null hier nicht überschreibt.
  setPendingLaunchPath(findProjectPathInArgv(process.argv))

  // #pre-sale — Update-IPC IMMER registrieren, damit der Menüpunkt "Auf
  // Updates prüfen…" auch in Dev funktioniert (liefert dort sauber ok:false).
  try {
    const { registerUpdaterIpc, initAutoUpdater } = await import('./services/updaterService.js')
    registerUpdaterIpc(firstReadyWindow)
    // Auto-Check beim Start nur im paketierten Build (in Dev gibt es keine
    // app-update.yml → checkForUpdates würde werfen).
    if (!isDev) initAutoUpdater(mainWindow)
  } catch (err) {
    console.error('[updater] init failed:', (err as Error)?.message ?? err)
  }

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

// #413 — Lokalen Signaling-Server (falls ein WebRTC-Host einen gestartet hat)
// beim Beenden sauber schließen.
app.on('will-quit', () => {
  stopSignalingServer()
})
