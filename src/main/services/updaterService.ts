import electronUpdater from 'electron-updater'
import { app, ipcMain, type BrowserWindow } from 'electron'
import { isNewerVersion } from '../util/versionCompare.js'

const { autoUpdater } = electronUpdater

/**
 * #pre-sale — In-App-Auto-Update via electron-updater.
 *
 * Liest die beim Build eingebettete `app-update.yml` (publish: github in
 * electron-builder.js) und prüft die GitHub-Releases auf neue Versionen.
 * Lädt automatisch herunter, installiert beim Quit (autoInstallOnAppQuit)
 * — oder sofort per "Jetzt neu starten" (updater:quit-and-install).
 *
 * Zwei Einstiege:
 *  - initAutoUpdater(win): einmaliger Auto-Check beim Start (nur !isDev).
 *  - registerUpdaterIpc(getWin): IPC für den manuellen "Auf Updates prüfen…"-
 *    Menüpunkt + "Jetzt neu starten". Immer registriert; in Dev/ohne
 *    app-update.yml liefert der Check sauber { ok:false } statt zu crashen.
 *
 * Alle Events werden als 'updater:status' an den Renderer gespiegelt
 * (checking · available · not-available · downloading · downloaded · error),
 * damit das UI Fortschritt/Resultat anzeigen kann.
 */
let eventsWired = false
let activeWin: BrowserWindow | null = null

const wireEvents = (win: BrowserWindow): void => {
  activeWin = win
  if (eventsWired) return
  eventsWired = true
  const send = (state: string, version?: string, extra?: Record<string, unknown>) => {
    if (activeWin && !activeWin.isDestroyed()) {
      activeWin.webContents.send('updater:status', { state, version, ...extra })
    }
  }
  autoUpdater.on('checking-for-update', () => send('checking'))
  autoUpdater.on('update-available', (info: { version: string }) => send('available', info.version))
  autoUpdater.on('update-not-available', (info: { version: string }) => send('not-available', info.version))
  autoUpdater.on('download-progress', (p: { percent: number }) => send('downloading', undefined, { percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (info: { version: string }) => send('downloaded', info.version))
  autoUpdater.on('error', (err: Error) => send('error', undefined, { message: err?.message ?? String(err) }))
}

export function initAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  wireEvents(win)
  autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
    console.error('[updater] auto-check failed:', err?.message ?? err)
  })
}

export function registerUpdaterIpc(getWin: () => BrowserWindow | null): void {
  ipcMain.handle('updater:check', async () => {
    const current = app.getVersion()
    try {
      const win = getWin()
      if (win) wireEvents(win)
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      const result = await autoUpdater.checkForUpdates()
      const latest = result?.updateInfo?.version
      // electron-updater meldet nur die neueste Release-Version. Update nur, wenn
      // sie ECHT neuer ist (SemVer) — nicht bei bloßer Abweichung (kein Downgrade,
      // korrekt bei 8.10 > 8.9). Siehe util/versionCompare.
      const available = !!latest && isNewerVersion(latest, current)
      return { ok: true, current, latest: latest ?? current, available }
    } catch (err) {
      // Dev/unpackaged (keine app-update.yml), offline, kein Release → sauber melden.
      return { ok: false, current, message: (err as Error)?.message ?? String(err) }
    }
  })

  ipcMain.handle('updater:quit-and-install', () => {
    // Nach dem Renderer-Return ausführen, damit das IPC sauber zurückkehrt.
    setImmediate(() => {
      try {
        autoUpdater.quitAndInstall()
      } catch (err) {
        console.error('[updater] quitAndInstall failed:', (err as Error)?.message ?? err)
      }
    })
    return true
  })
}
