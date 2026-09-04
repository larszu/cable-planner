import { ipcMain } from 'electron'
import { appendLogCapped } from '../util/appendLogCapped.js'

export const registerLogIpc = () => {
  ipcMain.on('logs:renderer-error', (_event, payload: { message: string; stack?: string; source?: string }) => {
    const line = `[${new Date().toISOString()}] [renderer] ${payload.source ?? 'error'}: ${payload.message}\n${payload.stack ?? ''}\n`
    // Dieser Kanal ist der Weg, ueber den eine Absturzschleife im Renderer
    // ihre Fehler meldet -- also genau der, fuer den die 2-MB-Kappung
    // geschrieben wurde. Er schrieb bis hierher mit blankem
    // `fs.appendFileSync` in dieselbe Datei, die `index.ts` gekappt fuellt.
    appendLogCapped('renderer-error.log', line)
  })
}
