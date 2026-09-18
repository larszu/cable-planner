// ───────────────────────────────────────────────────────────────────────────
// Die Bruecke zum Plan (#872).
//
// ─── WARUM DIE FRAGE IN DEN RENDERER GEHT ──────────────────────────────────
//
// Weil dort der Plan liegt — und zwar der von JETZT, nicht der vom letzten
// Speichern. Die Rechnungen (Signalkette, Plan-Check) liegen ebenfalls dort;
// sie hier nachzubauen hiesse, dass ein Assistent eine andere Auskunft gibt
// als der Bildschirm daneben.
//
// Die Bauform ist Frage/Antwort mit einer Kennung: `mcp:frage` hinaus,
// `mcp:antwort` zurueck. `ipcMain.handle` taugt dafuer nicht — das ist die
// Gegenrichtung (Renderer fragt Main).
//
// ─── WAS PASSIERT, WENN NIEMAND ANTWORTET ──────────────────────────────────
//
// Nach fuenf Sekunden gibt es einen Fehler und keine leere Liste. Ein Modell
// liest eine leere Liste als „es gibt nichts" und sagt das dem Menschen
// weiter; ein Fehler ist unangenehm und ehrlich.
// ───────────────────────────────────────────────────────────────────────────
import { BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  getMcpStatus,
  resetMcpToken,
  setMcpPlanFrager,
  startMcpServer,
  stopMcpServer,
} from '../mcp/mcpServer.js'
import { mcpTokenService } from '../services/credentialsService.js'

const ANTWORT_FRIST_MS = 5000

interface Offen {
  fertig: (wert: { daten: Record<string, unknown>; text: string }) => void
  fehler: (grund: Error) => void
  uhr: NodeJS.Timeout
}

const offene = new Map<string, Offen>()

export const registerMcpIpc = (): void => {
  setMcpPlanFrager(
    (werkzeug, args) =>
      new Promise((fertig, fehler) => {
        const fenster = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
        if (!fenster) {
          fehler(new Error('No planner window is open.'))
          return
        }
        const id = randomUUID()
        const uhr = setTimeout(() => {
          offene.delete(id)
          fehler(new Error('The planner window did not answer in time.'))
        }, ANTWORT_FRIST_MS)
        offene.set(id, { fertig, fehler, uhr })
        fenster.webContents.send('mcp:frage', { id, werkzeug, args })
      }),
  )

  ipcMain.on('mcp:antwort', (_event, roh: unknown) => {
    const o = roh as { id?: string; daten?: Record<string, unknown>; text?: string; fehler?: string }
    if (!o?.id) return
    const warten = offene.get(o.id)
    if (!warten) return
    offene.delete(o.id)
    clearTimeout(warten.uhr)
    if (o.fehler) warten.fehler(new Error(o.fehler))
    else warten.fertig({ daten: o.daten ?? {}, text: o.text ?? '' })
  })

  ipcMain.handle('mcp:start', async () => startMcpServer())
  ipcMain.handle('mcp:stop', () => {
    stopMcpServer()
    return { ok: true }
  })
  ipcMain.handle('mcp:status', () => getMcpStatus())
  // Das Token geht ueber einen EIGENEN Weg und nicht im Status: der Status
  // wird alle paar Sekunden abgefragt und landet in jedem Zustand, der ihn
  // anfasst. Das Token soll dorthin, wo jemand es sehen WILL.
  ipcMain.handle('mcp:token', async () => ({ token: (await mcpTokenService.get()) ?? '' }))
  ipcMain.handle('mcp:resetToken', async () => ({ token: await resetMcpToken() }))
}
