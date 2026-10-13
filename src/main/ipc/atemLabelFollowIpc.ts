import { BrowserWindow, ipcMain } from 'electron'
import net from 'node:net'
import { atemStatus, connectAtem, connectedAtem, pushAtemEvent } from '../services/atemSession.js'
import { createFollower, type FollowStatus } from '../services/atemLabelFollow/follower.js'
import { normaliseLinks } from '../services/atemLabelFollow/core.js'

/**
 * ATEM-Eingangslabel folgt der Videohub-Route.
 *
 * Der Renderer leitet die Verbindungen aus dem Plan ab und schickt sie her;
 * gesprochen wird hier. Gestartet wird nur auf ausdrücklichen Klick — ein
 * Projekt, das geöffnet wird, verbindet sich nicht von selbst mit einer
 * Anlage.
 *
 * DER ATEM geht über die EINE Sitzung des Prozesses (`atemSession.ts`), aus
 * demselben Grund wie beim Schalt-Treiber: eine zweite Verbindung zum selben
 * Mischer umginge den Connect-Lock.
 */

const VERBINDEN_MS = 5000

const follower = createFollower({
  connect: (host, port, on) => {
    const socket = new net.Socket()
    // Ohne eigene Frist hängt ein Verbindungsversuch an ein ausgeschaltetes
    // Gerät so lange, wie das Betriebssystem will (macOS: über eine Minute).
    socket.setTimeout(VERBINDEN_MS, () => socket.destroy(new Error('Zeitüberschreitung')))
    socket.on('connect', () => socket.setTimeout(0))
    socket.on('data', (chunk) => on.data(chunk.toString('utf8')))
    socket.on('error', (err) => on.error(err))
    socket.on('close', () => on.close())
    socket.connect(port, host)
    return { destroy: () => socket.destroy() }
  },
  setLabel: async (atemHost, atemInput, label) => {
    let atem = connectedAtem()
    if (!atem || atemStatus().ip !== atemHost) atem = await connectAtem(atemHost)
    await atem.setInputSettings({ longName: label.long, shortName: label.short }, atemInput)
    pushAtemEvent(`Label aus Videohub-Route: Eingang ${atemInput} = ${label.long}`)
  },
  onStatus: (status: FollowStatus) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('atemLabelFollow:status', status)
    }
  },
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
})

export const registerAtemLabelFollowIpc = () => {
  ipcMain.handle('atemLabelFollow:start', (_e, links: unknown) => {
    follower.start(normaliseLinks(links))
    return follower.status()
  })
  ipcMain.handle('atemLabelFollow:update', (_e, links: unknown) => {
    follower.update(normaliseLinks(links))
    return follower.status()
  })
  ipcMain.handle('atemLabelFollow:stop', () => {
    follower.stop()
    return follower.status()
  })
  ipcMain.handle('atemLabelFollow:status', () => follower.status())
}
