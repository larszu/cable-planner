/**
 * `receipt:*` — Belegdateien an Auslagenzeilen (Bedarf 97).
 *
 * Eigene Domaene nach der Repo-Konvention (ein Channel = eine Domaene). Der
 * Renderer schickt hier NUR Zeichenketten: den Pfad des Projekts und, beim
 * Zurueckholen, den relativ gespeicherten Pfad des Belegs. Jede Entscheidung
 * darueber, ob ein Pfad zulaessig ist, faellt in `receiptStore.ts` und damit
 * in main — die Repo-Regel dazu ist nicht verhandelbar, und sie ist hier
 * besonders ernst gemeint: der Quellpfad kommt aus einem Dateidialog, der
 * Zielname aus einem Dateinamen des Nutzers.
 */
import { dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { attachReceipt, readReceiptFile } from '../services/receiptStore.js'

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

export const registerReceiptIpc = () => {
  /**
   * Beleg auswaehlen und uebernehmen — ein Aufruf, nicht zwei.
   *
   * Der Dateidialog laeuft in main, und der gewaehlte Pfad geht gar nicht
   * erst durch den Renderer. Ein Weg „Dialog hier, Uebernehmen dort" gaebe
   * dem Renderer einen absoluten Pfad in die Hand, den er nicht braucht.
   */
  ipcMain.handle('receipt:pick', async (_event, projectPath: unknown) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Beleg auswählen',
      filters: [
        { name: 'Belege', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'pdf', 'txt'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || filePaths.length === 0) return { canceled: true, results: [] }
    const now = new Date().toISOString()
    const results = []
    for (const p of filePaths) results.push(await attachReceipt(str(projectPath), p, now))
    return { canceled: false, results }
  })

  ipcMain.handle('receipt:attach', async (_event, projectPath: unknown, sourcePath: unknown) => {
    const quelle = str(sourcePath)
    if (!quelle) return { ok: false, reason: 'unreadable' }
    return attachReceipt(str(projectPath), quelle, new Date().toISOString())
  })

  ipcMain.handle('receipt:read', async (_event, projectPath: unknown, storedAs: unknown) => {
    const rel = str(storedAs)
    if (!rel) return { ok: false, reason: 'missing' }
    return readReceiptFile(str(projectPath), rel)
  })

  /**
   * Den Beleg im Dateimanager zeigen.
   *
   * `showItemInFolder` und NICHT `openPath`: die Datei stammt von aussen, und
   * sie mit dem voreingestellten Programm zu oeffnen hiesse, einen fremden
   * Inhalt auszufuehren, sobald jemand einmal etwas anderes als ein Bild
   * hereinreicht. Den Ordner zu zeigen tut, was gebraucht wird, ohne das.
   */
  ipcMain.handle('receipt:reveal', async (_event, projectPath: unknown, storedAs: unknown) => {
    const projekt = str(projectPath)
    const rel = str(storedAs)
    if (!projekt || !rel) return false
    const projektDir = path.dirname(path.resolve(projekt))
    const abs = path.resolve(projektDir, rel)
    // Dieselbe Grenze wie beim Lesen — auch das Zeigen bleibt im Projekt.
    if (!abs.startsWith(projektDir + path.sep)) return false
    shell.showItemInFolder(abs)
    return true
  })
}
