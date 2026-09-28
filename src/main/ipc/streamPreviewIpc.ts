import { ipcMain } from 'electron'
import { fetchSnapshot } from '../services/streamSnapshot.js'

/**
 * IPC-Domaene `streamPreview:*` — Standbilder fuer die Stream-Vorschau am
 * Canvas (#946). Zustandslos; die Adresse kommt je Aufruf aus dem Geraet und
 * wird im Service geprueft.
 */
export const registerStreamPreviewIpc = () => {
  ipcMain.handle('streamPreview:snapshot', (_e, url: unknown) => fetchSnapshot(url))
}
