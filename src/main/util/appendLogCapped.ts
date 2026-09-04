import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * An eine Logdatei anhaengen, mit harter Groessengrenze.
 *
 * Der Grund steht seit jeher im Kommentar der urspruenglichen Fassung in
 * `main/index.ts`: **"so a crash-loop can't fill the user's disk"**. Eine
 * Absturzschleife schreibt dieselbe Zeile tausendfach; ohne Grenze laeuft
 * davon die Platte voll, und zwar auf einem Rechner, der ohnehin gerade nicht
 * mehr laeuft.
 *
 * WARUM DIE FUNKTION HIER LIEGT UND NICHT MEHR IN `index.ts`. Sie schuetzte
 * zwei von drei Schreibern derselben Datei. `renderer-error.log` bekommt
 * Eintraege aus `index.ts` (zweimal, ueber diese Funktion) und aus
 * `ipc/logIpc.ts` -- und der dritte schrieb mit blankem `fs.appendFileSync`,
 * ohne Kappung.
 *
 * Ausgerechnet der ungeschuetzte war der Weg, fuer den die Kappung gedacht
 * ist: `logs:renderer-error` ist der Kanal, ueber den eine Absturzschleife im
 * Renderer ihre Fehler meldet. Als gemeinsame Datei in `util/` kann kein
 * Aufrufer sie mehr uebersehen.
 */
const LOG_MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export const appendLogCapped = (fileName: string, msg: string): void => {
  try {
    const file = path.join(app.getPath('userData'), fileName)
    try {
      if (fs.statSync(file).size > LOG_MAX_BYTES) {
        fs.renameSync(file, `${file}.1`)
      }
    } catch {
      /* no existing file → fine */
    }
    fs.appendFileSync(file, msg)
  } catch {
    /* ignore */
  }
}
