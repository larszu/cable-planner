import { app, BrowserWindow, ipcMain } from 'electron'
import { appendDocumentLog } from '../services/documentLog.js'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  getMobileShareStatus,
  setMobileShareAllowBeyondLan,
  setMobileShareProject,
  setMobileShareCrewCalendar,
  setMobileShareWriteMode,
  mobileShareWriteMode,
  setMobileShareChecksHandler,
  setMobileShareCableAddedHandler,
  setMobileSharePendingChangeHandler,
  setMobileSharePincodeAccess,
  setMobileSharePincodeReadHandler,
  setMobileSharePincodes,
  mobileSharePincodeStatus,
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
  // v7.9.3 — Wenn das Mobile-View POST /checks schickt, broadcasten
  // wir den Update an alle Renderer-Fenster. Der Renderer hängt sich
  // im preload via `cablePlannerApi.onMobileChecksUpdate(cb)` rein
  // und schreibt das Update ins ProjectStore → Canvas zeigt Häkchen.
  setMobileShareChecksHandler((checks) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send('mobileShare:checksUpdate', checks)
    }
  })

  // v7.9.54 — Mobile-User hat ein Kabel via Dropdown-UI hinzugefügt.
  // Broadcast an alle Renderer; ProjectStore fügt es mit
  // addedFromMobile=true ein.
  setMobileShareCableAddedHandler((cable) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send('mobileShare:cableAdded', cable)
    }
  })

  // Feld-Rückkanal — Mobile-User hat eine Korrektur/ein Problem gemeldet.
  // Broadcast an alle Renderer; ProjectStore legt sie in die Review-Queue.
  setMobileSharePendingChangeHandler((change) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      win.webContents.send('mobileShare:pendingChange', change)
    }
  })

  ipcMain.handle('mobileShare:start', async () => {
    return await startMobileShareServer(resolveRendererDir(), resolveDevProxyUrl())
  })
  ipcMain.handle('mobileShare:stop', () => {
    stopMobileShareServer()
    return { ok: true }
  })
  ipcMain.handle('mobileShare:status', () => getMobileShareStatus())
  // BEDARF 133 — Adressen ueber das LAN hinaus freigeben. Eine ausdrueckliche
  // Entscheidung des Nutzers und keine, die sich aus der Netzwerkkarte ergibt.
  ipcMain.handle('mobileShare:setAllowBeyondLan', (_event, allow: unknown) =>
    setMobileShareAllowBeyondLan(allow === true))
  ipcMain.handle('mobileShare:setProject', (_event, project: unknown) => {
    setMobileShareProject(project)
    return { ok: true }
  })
  // BEDARF 39 — der Crew-Kalender kommt FERTIG aus dem Renderer. Main haelt
  // ihn nur; die Rechnung steht in `renderer/lib/crewCalendar.ts`.
  ipcMain.handle('mobileShare:setCrewCalendar', (_event, ics: unknown) => {
    setMobileShareCrewCalendar(typeof ics === 'string' ? ics : null)
    return { ok: true }
  })
  // BEDARF 109 — lesen viele, schreiben einer. Der Modus gilt sofort, auch
  // fuer eine laufende Freigabe; zurueck kommt der Wert, der WIRKLICH gilt,
  // damit der Dialog nicht seine eigene Annahme anzeigt.
  ipcMain.handle('mobileShare:setWriteMode', (_event, mode: unknown) => ({
    ok: true,
    writeMode: setMobileShareWriteMode(mode),
  }))
  ipcMain.handle('mobileShare:getWriteMode', () => ({ writeMode: mobileShareWriteMode() }))

  /**
   * E-3 — Zugriff auf die Anlagen-Zugangscodes.
   *
   * Der Token kommt hier EINMAL im Klartext zurueck, direkt beim Einschalten,
   * damit die Oberflaeche ihn anzeigen kann. Es gibt bewusst keinen
   * „gib mir den aktuellen Token"-Aufruf: ein Geheimnis, das man jederzeit
   * nachschlagen kann, wandert in jeden Screenshot des Dialogs. Wer ihn
   * verliert, schaltet aus und wieder ein — und macht damit zugleich den
   * alten ungueltig, was richtig ist.
   */
  ipcMain.handle('mobileShare:setPincodeAccess', (_event, on: unknown) => ({
    ok: true,
    token: setMobileSharePincodeAccess(on === true),
  }))

  ipcMain.handle('mobileShare:setPincodes', (_event, codes: unknown) => {
    // Formpruefung in main, nicht im Renderer: was hier ankommt, geht ueber
    // eine Netzroute wieder hinaus.
    const clean = Array.isArray(codes)
      ? codes
          .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : null))
          .filter((c): c is Record<string, unknown> => c !== null)
          .filter((c) => typeof c.label === 'string' && typeof c.value === 'string')
          .map((c) => ({ label: String(c.label), value: String(c.value) }))
      : null
    setMobileSharePincodes(clean && clean.length ? clean : null)
    return { ok: true, ...mobileSharePincodeStatus() }
  })

  ipcMain.handle('mobileShare:pincodeStatus', () => mobileSharePincodeStatus())

  /**
   * Jeder Abruf ins Dokument-Register. Der Eintrag traegt den Zeitpunkt und
   * die ersten sechs Zeichen des Tokens als `stand` — genug, um zwei
   * Ausgaben auseinanderzuhalten, und zu wenig, um damit etwas zu oeffnen.
   *
   * Der Fehlerfall wird verschluckt: ein Register, das nicht schreiben kann,
   * darf den Abruf nicht auch noch zum Absturz bringen. Der Abruf ist
   * bereits beantwortet, wenn dieser Rueckruf laeuft.
   */
  setMobileSharePincodeReadHandler((info) => {
    void appendDocumentLog({
      docId: 'mobile-pincode',
      label: `Zugangscodes abgerufen (${info.count})`,
      stand: info.tokenPrefix,
      emittedAt: info.at,
      project: '',
    }).catch(() => {})
  })
}
