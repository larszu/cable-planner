/**
 * `tally:*` — der Direktweg zum Tally-Pi (B-6, E-7).
 *
 * Eigene Domaene nach der Repo-Konvention (ein Channel = eine Domaene). Zwei
 * Aufrufe, und sie sind absichtlich getrennt:
 *
 *   `tally:read`  — was steht gerade auf dem Pi?
 *   `tally:write` — die Rollenliste aus dem Plan hinschreiben.
 *
 * Ein einziger „senden"-Aufruf, der still vorher liest, waere bequemer und
 * genau deshalb falsch: der Schreibvorgang LOESCHT Rollen, die der Plan nicht
 * nennt (`merge_tally_config` behaelt Felder, nicht Geraete). Wer das
 * ausloest, soll vorher gesehen haben, was verschwindet.
 *
 * Es gibt keinen Aufruf, der still `undefined` zurueckgibt: aus einem
 * fehlenden Ergebnis liest jemand „hat wohl geklappt", und das ist die
 * Entwarnung, die dieser Weg nicht geben darf.
 */
import { ipcMain } from 'electron'
import { lesen, schreiben } from '../services/tallyPushService.js'

export const registerTallyIpc = () => {
  ipcMain.handle('tally:read', (_e, adresse: unknown) =>
    lesen(typeof adresse === 'string' ? adresse : ''),
  )

  ipcMain.handle('tally:write', (_e, adresse: unknown, devices: unknown) =>
    schreiben(typeof adresse === 'string' ? adresse : '', Array.isArray(devices) ? devices : []),
  )
}
