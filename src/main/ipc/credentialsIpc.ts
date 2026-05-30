import axios from 'axios'
import { ipcMain } from 'electron'
import { credentialsService } from '../services/credentialsService.js'
import { createRentmanApiClient } from '../services/rentmanApiClient.js'

export const registerCredentialsIpc = () => {
  ipcMain.handle('credentials:get-token', () => credentialsService.getToken())

  ipcMain.handle('credentials:save-token', async (_event, token: string) => {
    if (!token?.trim()) {
      throw new Error('Token is required.')
    }

    return credentialsService.saveToken(token)
  })

  ipcMain.handle('credentials:delete-token', () => credentialsService.deleteToken())

  ipcMain.handle('credentials:test-token', async () => {
    const token = await credentialsService.getToken()
    if (!token) {
      return { ok: false, message: 'No token stored.' }
    }

    try {
      const client = createRentmanApiClient(token)
      // 1. Read-Test (war schon da)
      await client.getProjects()

      // 2. v7.9.121 — Write-Probe: minimaler POST mit absichtlich
      // ungueltigen IDs. Wenn Rentman 401/403 zurueckgibt, ist
      // schreibend nicht erlaubt (Plan/Token-Problem). Wenn 404/422,
      // ist schreibend erlaubt aber die Daten sind ungueltig — was wir
      // ja absichtlich provozieren. So unterscheidet der Test
      // definitiv 'Auth-Problem' von 'Plan-Permission-Problem'.
      try {
        // Wir greifen direkt auf den client-internen axios zu — der
        // hat den sauberen Auth-Header bereits gesetzt.
        await axios.post(
          'https://api.rentman.net/projectequipment',
          { project: -1, equipment: -1, quantity: 1 },
          {
            headers: { Authorization: `Bearer ${token.replace(/[^!-~]/g, '')}` },
            timeout: 10000,
            // Erfolg ist hier 4xx mit data-Validation-Error — das gilt
            // als 'auth ok'. Nur 2xx ist nicht erwartet (Rentman waere
            // sehr seltsam wenn IDs=-1 akzeptiert).
            validateStatus: () => true,
          },
        ).then((response) => {
          const status = response.status
          if (status === 401 || status === 403) {
            throw { __probe: 'auth-denied', status }
          }
        })
        return {
          ok: true,
          message:
            'Rentman-Token ist gueltig fuer LESEN und SCHREIBEN (Write-Probe ergab Daten-Fehler statt Auth-Fehler).',
        }
      } catch (probeErr: unknown) {
        const meta = probeErr as { __probe?: string; status?: number }
        if (meta?.__probe === 'auth-denied') {
          return {
            ok: false,
            message: `Rentman-Token ist gueltig zum LESEN, aber Schreibrechte fehlen (Write-Probe HTTP ${meta.status}). Rentman-Admin fragen ob das API-Token 'projectequipment.create' darf, oder ob dein Plan-Tier den Endpoint freischaltet.`,
          }
        }
        // Probe-Fehler aus anderem Grund (Netz, Timeout) — Read war ok.
        return {
          ok: true,
          message:
            'Rentman-Token liest erfolgreich. Write-Probe nicht durchfuehrbar — gleich beim naechsten Schreibversuch sehen wir mehr.',
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token test failed.'
      return { ok: false, message }
    }
  })
}
