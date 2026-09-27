import { ipcMain } from 'electron'
import { cloudService } from '../services/cloudService.js'

/**
 * IPC-Domaene `cloud:*` — Cloud-Projekte und Lese-Links (#871, #870).
 * Zustandslos wie `deviceLibrary:*`; das Token geht nie an den Renderer.
 */
export const registerCloudIpc = () => {
  ipcMain.handle('cloud:call', (_e, server: unknown, op: unknown, args: unknown) => cloudService.call(server, op, args))
}
