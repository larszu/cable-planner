import { ipcMain } from 'electron'
import { takeSnapshot, type SnapshotRequest } from '../services/streamPreviewService.js'

/**
 * IPC-Domaene `streamPreview:*` — Standbilder fuer die Stream-Vorschau am
 * Canvas (#946). Zustandslos; nur auf Anforderung aus der Oberflaeche. Die
 * Pruefungen (lokales Netz, Protokoll, Zugangsdaten) stehen im Service.
 */
export const registerStreamPreviewIpc = () => {
  ipcMain.handle('streamPreview:snapshot', (_e, req: SnapshotRequest) => takeSnapshot(req))
}
