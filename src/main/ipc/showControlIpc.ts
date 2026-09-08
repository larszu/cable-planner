/**
 * `showControl:*` — der eingehende OSC-Lauscher (E-23).
 *
 * Eigene Domaene nach der Repo-Konvention (ein Channel = eine Domaene). Der
 * Renderer schickt hier eine Konfiguration und bekommt einen ZUSTAND zurueck
 * — auch dann, wenn nichts gebunden werden konnte. Es gibt keinen Aufruf, der
 * still nichts zurueckgibt: aus einem `undefined` liest jemand „laeuft wohl",
 * und genau das ist die Entwarnung, die E-23 ausschliesst.
 *
 * WAS HIER NICHT PASSIERT: automatisches Starten. Der Lauscher geht nur an,
 * wenn der Renderer es fuer dieses Projekt verlangt (Auflagen 1 und 2 aus
 * E-23). Diese Datei registriert Handler; sie startet nichts.
 */
import { BrowserWindow, ipcMain } from 'electron'
import {
  clearOscMeldungen,
  oscMeldungen,
  oscZustand,
  setOscMelder,
  startOscListener,
  stopOscListener,
  type OscLauscherConfig,
} from '../services/oscListener.js'

const zahl = (v: unknown, vorgabe: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : vorgabe

const text = (v: unknown): string => (typeof v === 'string' ? v : '')

export const registerShowControlIpc = () => {
  // Der Weg nach oben: Zustand UND Mitschrift zusammen. Zwei Kanaele koennten
  // in verschiedener Reihenfolge ankommen, und dann stuende eine Meldung
  // neben einem Zustand, der sie noch nicht kennt.
  setOscMelder((z, m) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('showControl:update', { zustand: z, meldungen: m })
    }
  })

  ipcMain.handle('showControl:start', async (_e, config: unknown) => {
    const c = (config ?? {}) as Record<string, unknown>
    const cfg: OscLauscherConfig = {
      aktiv: c.aktiv === true,
      adresse: text(c.adresse).trim(),
      port: zahl(c.port, 0),
    }
    return startOscListener(cfg)
  })

  ipcMain.handle('showControl:stop', () => stopOscListener())

  ipcMain.handle('showControl:state', () => ({
    zustand: oscZustand(),
    meldungen: oscMeldungen(),
  }))

  ipcMain.handle('showControl:clear', () => {
    clearOscMeldungen()
    return { zustand: oscZustand(), meldungen: oscMeldungen() }
  })
}
