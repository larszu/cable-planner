import { ipcMain } from 'electron'
import { sendControlAction, type ControlAction } from '../services/switcherControl/index.js'

/**
 * Die IPC-Domaene fuer das SCHALTEN von Mischern und Kreuzschienen (S-2).
 *
 * Eine eigene Domaene und nicht ein weiterer Handler in `videohub:*` oder
 * `atem:*`: „einen Kreuzpunkt setzen" ist eine Aufgabe, die es fuer viele
 * Geraete gibt, und sie an das Protokoll EINES Herstellers zu haengen
 * hiesse, den naechsten Hersteller dort hineinzuschreiben, wo er nicht
 * hingehoert. Ein Channel = eine Domaene.
 *
 * WAS DIESER HANDLER NICHT TUT: entscheiden, WAS geschaltet wird. Das steht
 * im Befehl, den der Renderer gebaut hat — dort ist der Plan, dort sind die
 * Anschluesse, dort ist geprueft, dass nur die genannten Ausgaenge im Befehl
 * stehen. Hier wird gesprochen, nicht entschieden.
 */
export const registerSwitcherIpc = () => {
  ipcMain.handle('switcher:send', async (_event, action: ControlAction) => {
    // Der Befehl kommt aus dem Renderer, also wird er hier geprueft und nicht
    // geglaubt — dieselbe Regel wie bei der Pfad-Validierung. Ein Befehl ohne
    // Protokoll oder mit einem unbekannten wird abgelehnt statt geraten.
    if (!action || typeof action !== 'object') {
      return { ok: false, message: 'Kein Befehl übergeben.' }
    }
    if (action.protocol !== 'videohub' && action.protocol !== 'atem') {
      return { ok: false, message: `Unbekanntes Protokoll „${String((action as { protocol?: unknown }).protocol)}".` }
    }
    return sendControlAction(action)
  })
}
