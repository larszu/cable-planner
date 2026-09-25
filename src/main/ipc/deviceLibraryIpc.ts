import { ipcMain } from 'electron'
import { deviceLibraryService } from '../services/deviceLibraryService.js'
import type { ProposalCore } from '../services/deviceLibraryClient.js'

/**
 * IPC-Domaene `deviceLibrary:*` — die Geraetebibliothek.
 *
 * Zustandslos wie `netbox:*`: die Server-URL kommt bei jedem Aufruf aus den
 * Renderer-Einstellungen und wird im Service geprueft. Das Token geht nie
 * an den Renderer zurueck.
 */
export const registerDeviceLibraryIpc = () => {
  ipcMain.handle('deviceLibrary:has-token', () => deviceLibraryService.hasToken())
  ipcMain.handle('deviceLibrary:sign-in', (_e, server: unknown, login: unknown, password: unknown) =>
    deviceLibraryService.signIn(server, login, password),
  )
  ipcMain.handle('deviceLibrary:verify-second-factor', (_e, server: unknown, challenge: unknown, code: unknown) =>
    deviceLibraryService.verifySecondFactor(server, challenge, code),
  )
  ipcMain.handle('deviceLibrary:current-user', (_e, server: unknown) => deviceLibraryService.currentUser(server))
  ipcMain.handle('deviceLibrary:sign-out', (_e, server: unknown) => deviceLibraryService.signOut(server))
  ipcMain.handle('deviceLibrary:sync', (_e, server: unknown, after: unknown) => deviceLibraryService.sync(server, after))
  ipcMain.handle('deviceLibrary:propose', (_e, server: unknown, core: ProposalCore, facet: Record<string, unknown>) =>
    deviceLibraryService.propose(server, core, facet),
  )
}
