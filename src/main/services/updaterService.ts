import electronUpdater from 'electron-updater'
import type { BrowserWindow } from 'electron'

const { autoUpdater } = electronUpdater

/**
 * #pre-sale — In-App-Auto-Update via electron-updater.
 *
 * Liest die beim Build eingebettete `app-update.yml` (entsteht aus dem
 * `publish: { provider: 'github' }`-Eintrag in electron-builder.js) und prüft
 * die GitHub-Releases des Repos auf eine neuere Version. Lädt sie automatisch
 * herunter und installiert sie beim nächsten App-Quit. Die CI erzeugt bereits
 * die nötigen `latest*.yml`-Metadaten + Blockmaps und hängt sie ans Release.
 *
 * Nur im paketierten Build sinnvoll (in Dev/ohne app-update.yml schlägt der
 * Check fehl) — der Aufrufer ruft dies daher nur bei `!isDev` auf. Jeglicher
 * Fehler (offline, kein Release, unsigniert) wird geloggt und verschluckt,
 * damit ein fehlgeschlagenes Update den App-Start NIE blockiert.
 */
export function initAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const notify = (state: 'available' | 'downloaded', version: string) => {
    if (!win.isDestroyed()) win.webContents.send('updater:status', { state, version })
  }

  autoUpdater.on('error', (err: Error) => {
    console.error('[updater] error:', err?.message ?? err)
  })
  autoUpdater.on('update-available', (info: { version: string }) => {
    console.log('[updater] update available:', info.version)
    notify('available', info.version)
  })
  autoUpdater.on('update-downloaded', (info: { version: string }) => {
    console.log('[updater] downloaded, wird beim Quit installiert:', info.version)
    notify('downloaded', info.version)
  })

  autoUpdater.checkForUpdatesAndNotify().catch((err: Error) => {
    console.error('[updater] check failed:', err?.message ?? err)
  })
}
