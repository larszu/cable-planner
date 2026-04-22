import { ipcMain } from 'electron'
import { credentialsService } from '../services/credentialsService.js'
import { createRentmanApiClient } from '../services/rentmanApiClient.js'

const getClient = async () => {
  const token = await credentialsService.getToken()

  if (!token) {
    throw new Error('No Rentman token configured. Open Settings and add one.')
  }

  return createRentmanApiClient(token)
}

export const registerRentmanIpc = () => {
  ipcMain.handle('rentman:get-projects', async () => {
    const client = await getClient()
    return client.getProjects()
  })

  ipcMain.handle('rentman:get-project-equipment', async (_event, projectId: string) => {
    const client = await getClient()
    return client.getProjectEquipment(projectId)
  })

  ipcMain.handle('rentman:get-equipment', async () => {
    const client = await getClient()
    return client.getEquipment()
  })

  ipcMain.handle('rentman:get-equipment-folders', async () => {
    const client = await getClient()
    return client.getEquipmentFolders()
  })
}
