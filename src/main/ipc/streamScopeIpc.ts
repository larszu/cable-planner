import { ipcMain } from 'electron'
import { startScope, stopScope } from '../services/streamScopeService.js'

/**
 * IPC-Domaene `streamScope:*` — Live-Scopes am Geraet (larszu/lz-scopes#15).
 * `start` prueft und antwortet mit einem Code; die Bilder kommen danach ueber
 * einen MessagePort (`streamScope:port`), nicht ueber diesen Kanal. Riegel und
 * Begruendung in `services/streamScopeService.ts`.
 */
export const registerStreamScopeIpc = () => {
  ipcMain.handle('streamScope:start', (e, req: unknown) => startScope(e.sender, req))
  ipcMain.handle('streamScope:stop', (_e, id: unknown) => {
    if (typeof id === 'string') stopScope(id)
  })
}
