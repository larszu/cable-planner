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
      await client.getProjects()
      return { ok: true, message: 'Rentman token is valid.' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token test failed.'
      return { ok: false, message }
    }
  })
}
