import { ipcMain } from 'electron'
import { netboxCredentialsService } from '../services/credentialsService.js'
import {
  createNetboxApiClient,
  normalizeNetboxBaseUrl,
  type NetboxRecord,
  type NetboxSnapshot,
} from '../services/netboxApiClient.js'

/**
 * IPC-Domäne `netbox:*` (#597).
 *
 * Der Main-Prozess ist zustandslos: die Instanz-URL kommt bei jedem Aufruf
 * aus den Renderer-Settings mit und wird hier validiert (nie im Renderer —
 * gleiche Regel wie bei Pfaden). Das Token liegt im OS-Schlüsselbund und
 * wird nie an den Renderer zurückgegeben.
 */

const getClient = async (baseUrl: string) => {
  const token = await netboxCredentialsService.getToken()
  if (!token) {
    throw new Error(
      'Kein NetBox-Token hinterlegt — Einstellungen → Integrationen → NetBox.',
    )
  }
  // Wirft bei ungültiger/nicht-http(s)-URL.
  return createNetboxApiClient(baseUrl, token)
}

const asId = (value: unknown, label: string): number => {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Ungültige ${label}: ${String(value)}`)
  }
  return n
}

export const registerNetboxIpc = () => {
  ipcMain.handle('netbox:save-token', async (_event, token: string) =>
    netboxCredentialsService.saveToken(typeof token === 'string' ? token : ''),
  )

  ipcMain.handle('netbox:has-token', async () => netboxCredentialsService.hasToken())

  ipcMain.handle('netbox:delete-token', async () => netboxCredentialsService.deleteToken())

  /** URL-Validierung ohne Netzwerk-Zugriff — für Live-Feedback im
   *  Settings-Feld, bevor der User „Verbindung testen" drückt. */
  ipcMain.handle('netbox:normalize-url', async (_event, url: string) => {
    try {
      return { ok: true as const, url: normalizeNetboxBaseUrl(url) }
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle(
    'netbox:test-connection',
    async (_event, baseUrl: string): Promise<{ ok: boolean; message: string; version?: string }> => {
      try {
        const client = await getClient(baseUrl)
        return await client.testConnection()
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) }
      }
    },
  )

  ipcMain.handle('netbox:get-sites', async (_event, baseUrl: string): Promise<NetboxRecord[]> => {
    const client = await getClient(baseUrl)
    return client.getSites()
  })

  ipcMain.handle(
    'netbox:get-racks',
    async (_event, baseUrl: string, siteId?: number): Promise<NetboxRecord[]> => {
      const client = await getClient(baseUrl)
      return client.getRacks(siteId == null ? undefined : asId(siteId, 'Site-ID'))
    },
  )

  ipcMain.handle(
    'netbox:fetch-snapshot',
    async (_event, baseUrl: string, scope: 'site' | 'rack', scopeId: number): Promise<NetboxSnapshot> => {
      if (scope !== 'site' && scope !== 'rack') {
        throw new Error(`Unbekannter NetBox-Scope: ${String(scope)}`)
      }
      const client = await getClient(baseUrl)
      return client.fetchSnapshot(scope, asId(scopeId, `${scope}-ID`))
    },
  )
}
