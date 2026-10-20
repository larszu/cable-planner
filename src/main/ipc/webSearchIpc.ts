import { ipcMain } from 'electron'
import { searchWeb } from '../services/webSearchService.js'

export const registerWebSearchIpc = (): void => {
  ipcMain.handle('webSearch:search', (_event, query: unknown) =>
    searchWeb(typeof query === 'string' ? query.slice(0, 200) : ''),
  )
}
