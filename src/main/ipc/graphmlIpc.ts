// Main-process IPC for the yEd / GraphML importer. Renderers cannot
// open the native Open-file dialog or read paths directly under the
// Electron sandbox; this bridge exposes a single 'graphml:open-file'
// handler that opens the file picker, reads the chosen file, and
// returns its contents as a UTF-8 string. The renderer then runs the
// fast-xml-parser pipeline itself — keeps the heavy text in one
// process and avoids serialising the parsed tree across IPC.

import { dialog, ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const registerGraphmlIpc = () => {
  ipcMain.handle('graphml:open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'yEd / GraphML Datei importieren',
      filters: [
        { name: 'yEd GraphML', extensions: ['graphml'] },
        { name: 'Alle Dateien', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const xml = await readFile(filePath, 'utf-8')
    return {
      filePath,
      fileName: path.basename(filePath),
      xml,
    }
  })
}
