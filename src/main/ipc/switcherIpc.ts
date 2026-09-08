import { ipcMain } from 'electron'
import {
  companionConnections,
  sendControlAction,
  type ControlAction,
} from '../services/switcherControl/index.js'

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
    if (
      action.protocol !== 'videohub' &&
      action.protocol !== 'atem' &&
      action.protocol !== 'text' &&
      action.protocol !== 'companion'
    ) {
      return { ok: false, message: `Unbekanntes Protokoll „${String((action as { protocol?: unknown }).protocol)}".` }
    }
    return sendControlAction(action)
  })

  /**
   * S-4 — die eingerichteten Verbindungen einer Companion-Instanz abfragen.
   *
   * Reine Bequemlichkeit beim EINRICHTEN: der Nutzer sieht, welche Geraete in
   * seiner eigenen Companion schon stehen. Das ist ein LESEN und kein
   * Eingriff — es steht deshalb nicht hinter der Bestaetigung, die das
   * Schalten verlangt.
   */
  ipcMain.handle(
    'switcher:companionConnections',
    async (_event, params: { host?: unknown; port?: unknown }) => {
      const host = typeof params?.host === 'string' ? params.host.trim() : ''
      const port = typeof params?.port === 'number' ? params.port : 8000
      return companionConnections(host, port)
    },
  )
}
