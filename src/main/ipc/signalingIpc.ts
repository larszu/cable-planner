// #413 — IPC für den lokalen LAN-Signaling-Server (siehe signalingServer.ts).
//
// Der Renderer (collabStore) startet den Server, wenn ein WebRTC-Host ohne
// eigenen Signaling-Server eine Session beginnt, und bekommt die LAN-Adresse
// zurück, die er via mDNS bewirbt. Beitretende übernehmen sie automatisch.

import { ipcMain } from 'electron'
import { startSignalingServer, stopSignalingServer } from '../signalingServer.js'

export const registerSignalingIpc = (): void => {
  ipcMain.handle('signaling:start', async (): Promise<{ url: string; port: number }> => {
    return startSignalingServer()
  })

  ipcMain.handle('signaling:stop', async (): Promise<{ ok: boolean }> => {
    stopSignalingServer()
    return { ok: true }
  })
}
