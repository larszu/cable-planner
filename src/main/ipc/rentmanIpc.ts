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

  ipcMain.handle(
    'rentman:add-project-equipment',
    async (_event, projectId: string, equipmentId: string, quantity?: number) => {
      const client = await getClient()
      return client.addProjectEquipment(projectId, equipmentId, quantity ?? 1)
    },
  )

  // v7.9.110 — High-level Export: legt im Rentman-Projekt eine
  // EquipmentGroup namens 'CablePlanner' an (falls noch nicht vorhanden)
  // und fuegt alle items dort ein. Idempotent: mehrfaches Ausfuehren
  // fuegt in dieselbe Gruppe. Failure pro item bricht den Batch NICHT
  // ab — der Renderer sieht im Ergebnis was geklappt hat + was nicht.
  ipcMain.handle(
    'rentman:export-to-cableplanner-group',
    async (
      _event,
      projectId: string,
      items: Array<{ equipmentId: string; quantity: number }>,
    ) => {
      const client = await getClient()
      return client.exportEquipmentToCablePlannerGroup(projectId, items)
    },
  )

  ipcMain.handle(
    'rentman:add-project-file',
    async (
      _event,
      projectId: string,
      fileName: string,
      fileBytes: Uint8Array,
      mimeType?: string,
    ) => {
      const client = await getClient()
      // The renderer sends a Uint8Array via structured-clone; Electron may
      // surface it as a Buffer. Normalise to a fresh Uint8Array to be safe.
      const bytes = fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes)
      return client.addProjectFile(projectId, fileName, bytes, mimeType)
    },
  )
}
