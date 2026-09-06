import axios from 'axios'
import { ipcMain } from 'electron'
import { credentialsService, streamKeyService } from '../services/credentialsService.js'
import { createRentmanApiClient } from '../services/rentmanApiClient.js'

export const registerCredentialsIpc = () => {
  ipcMain.handle('credentials:get-token', () => credentialsService.getToken())

  // Nach dem Vorbild von `netbox:has-token`: wer nur wissen will, OB ein
  // Token hinterlegt ist, bekommt einen Boolean statt des Klartexts.
  //
  // `App.tsx` holte beim Start das echte Token nur, um `Boolean(token)` zu
  // bilden -- das Geheimnis lag danach fuer die ganze Sitzung im Renderer,
  // ohne dass es dort jemand brauchte. Der Klartext-Weg bleibt fuer den
  // Einstellungs-Dialog, der das Token wirklich anzeigt.
  ipcMain.handle('credentials:has-token', async () => Boolean(await credentialsService.getToken()))

  ipcMain.handle('credentials:save-token', async (_event, token: string) => {
    if (!token?.trim()) {
      throw new Error('Token is required.')
    }

    return credentialsService.saveToken(token)
  })

  ipcMain.handle('credentials:delete-token', () => credentialsService.deleteToken())

  // Initiative 9 — Stream-Keys der Ausspielziele. Eigene Kanaele auf derselben
  // Domaene: es ist dieselbe Sache (ein Geheimnis im OS-Schluesselbund), nur
  // je Ziel statt je Integration.
  //
  // `has` steht neben `get`, weil die Liste nur wissen muss, OB ein Key da
  // ist. Ohne diesen Weg holte sie fuer eine Haekchen-Spalte alle Keys im
  // Klartext in den Renderer -- genau der Fehler, den `credentials:has-token`
  // an anderer Stelle schon einmal behoben hat.
  ipcMain.handle('streamKey:get', (_event, id: string) => streamKeyService.get(id))
  ipcMain.handle('streamKey:has', (_event, id: string) => streamKeyService.has(id))
  ipcMain.handle('streamKey:save', (_event, id: string, key: string) => streamKeyService.save(id, key))
  ipcMain.handle('streamKey:delete', (_event, id: string) => streamKeyService.delete(id))

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
