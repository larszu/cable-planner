import { ipcMain } from 'electron'
import { pdfToText, searchWeb } from '../services/webSearchService.js'

export const registerWebSearchIpc = (): void => {
  ipcMain.handle('webSearch:search', (_event, query: unknown) =>
    searchWeb(typeof query === 'string' ? query.slice(0, 200) : ''),
  )
  // Datenblatt-Upload: der Renderer schickt die Bytes, nicht den Pfad —
  // es gibt keinen Dateizugriff, der hier zu pruefen waere.
  ipcMain.handle('webSearch:pdf-text', async (_event, bytes: unknown) => {
    if (!(bytes instanceof Uint8Array)) return ''
    try {
      return await pdfToText(bytes)
    } catch {
      return ''
    }
  })
}
