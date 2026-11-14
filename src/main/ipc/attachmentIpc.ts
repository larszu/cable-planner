/**
 * `attachment:*` — Anhänge neben dem Projekt (Messprotokolle,
 * Herstellerunterlagen, Konfigurations-Sicherungen).
 *
 * Wie `receipt:*`: der Renderer schickt nur Zeichenketten (Projektpfad,
 * gespeicherter relativer Pfad), der Dateidialog läuft in main, und jede
 * Pfadentscheidung fällt in `attachmentStore.ts` bzw. `util/projektAblage.ts`.
 * Es gibt bewusst keinen Kanal, der eine Datei öffnet; Inhalt kommt nur fuer
 * die Vorschau von Bild und PDF zurueck — siehe `attachmentStore.ts`.
 */
import { dialog, ipcMain, shell } from 'electron'
import { attachFile, attachmentPreview, attachmentsPresent } from '../services/attachmentStore.js'
import { imProjektordner } from '../util/projektAblage.js'

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined

export const registerAttachmentIpc = () => {
  ipcMain.handle('attachment:pick', async (_event, projectPath: unknown) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Anhang auswählen',
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || filePaths.length === 0) return { canceled: true, results: [] }
    const now = new Date().toISOString()
    const results = []
    for (const p of filePaths) results.push(await attachFile(str(projectPath), p, now))
    return { canceled: false, results }
  })

  ipcMain.handle('attachment:present', async (_event, projectPath: unknown, storedAs: unknown) => {
    const liste = Array.isArray(storedAs) ? storedAs.filter((x): x is string => typeof x === 'string') : []
    return attachmentsPresent(str(projectPath), liste)
  })

  /** #1186 — Bytes fuer die Vorschau, nur Bild und PDF (siehe `attachmentPreview`). */
  ipcMain.handle('attachment:preview', async (_event, projectPath: unknown, storedAs: unknown) => {
    const rel = str(storedAs)
    return rel ? attachmentPreview(str(projectPath), rel) : null
  })

  /** Den Anhang im Dateimanager zeigen — nie öffnen (siehe `attachmentStore.ts`). */
  ipcMain.handle('attachment:reveal', async (_event, projectPath: unknown, storedAs: unknown) => {
    const projekt = str(projectPath)
    const rel = str(storedAs)
    if (!projekt || !rel) return false
    const abs = imProjektordner(projekt, rel)
    if (!abs) return false
    shell.showItemInFolder(abs)
    return true
  })
}
