import net from 'node:net'
import type { ControlAction, ControlResult, SwitcherDriver } from './types.js'

/**
 * Das ERKLAERTE Text-Protokoll — zeilenorientierter Text ueber TCP (S-3).
 *
 * Dieser Treiber kennt kein Protokoll. Er kennt eine Zeichenkette, die der
 * Renderer aus einer Vorlage gebaut hat, die der NUTZER aus dem Handbuch
 * seines Geraets eingetragen hat. Das ist der ganze Sinn: was die App ueber
 * ein fremdes Protokoll nicht weiss, erfindet sie auch nicht — und damit ist
 * jedes textgesteuerte Geraet bedienbar, auch eines, das es noch nicht gibt.
 *
 * WARUM ER NICHT AUF EINE ANTWORT WARTET, WENN KEINE ERWARTET WIRD: viele
 * dieser Geraete antworten auf einen Schaltbefehl gar nicht. Wer trotzdem auf
 * eine Antwort wartet, meldet nach fuenf Sekunden einen Fehler fuer einen
 * Befehl, der angekommen ist — und der Nutzer schaltet ein zweites Mal.
 *
 * Das Ergebnis sagt deshalb GENAU, was bekannt ist: „bestaetigt", wenn eine
 * Quittung erwartet UND gekommen ist, sonst „gesendet". Der Unterschied steht
 * so auf dem Beleg, und niemand liest ein „gesendet" als Bestaetigung.
 */
export const textDriver: SwitcherDriver = {
  protocol: 'text',
  send: (action: ControlAction): Promise<ControlResult> =>
    new Promise<ControlResult>((resolve) => {
      if (action.protocol !== 'text') {
        resolve({ ok: false, message: 'Falscher Treiber für dieses Protokoll.' })
        return
      }
      const { host, port, rohtext, quittung } = action
      if (!host || !/^[\w.\-:]+$/.test(host)) {
        resolve({ ok: false, message: 'Ungültige IP-Adresse' })
        return
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        resolve({ ok: false, message: 'Ungültiger Port' })
        return
      }
      if (!rohtext) {
        resolve({ ok: false, message: 'Kein Befehl zu senden.' })
        return
      }

      const socket = new net.Socket()
      let buffer = ''
      let settled = false

      const done = (ok: boolean, message: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.destroy()
        resolve({ ok, message })
      }

      // Wird eine Quittung erwartet, ist die Zeitueberschreitung ein Fehler.
      // Wird keine erwartet, ist sie der NORMALFALL: dann gilt der Befehl als
      // gesendet, sobald er auf der Leitung war.
      const timer = setTimeout(() => {
        if (quittung) {
          done(false, `Zeitüberschreitung — die erwartete Bestätigung „${quittung}" kam nicht.`)
        } else {
          done(true, 'Gesendet (das Gerät bestätigt nicht — keine Quittung eingetragen).')
        }
      }, quittung ? 5000 : 800)

      socket.on('error', (err) => done(false, err.message))
      socket.on('close', () => {
        if (settled) return
        // Ohne erwartete Quittung ist ein Schliessen nach dem Schreiben kein
        // Fehler: manche Geraete trennen sofort.
        if (quittung) done(false, 'Verbindung wurde geschlossen, bevor die Bestätigung kam')
        else done(true, 'Gesendet (Verbindung vom Gerät geschlossen).')
      })
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        if (quittung && buffer.includes(quittung)) {
          done(true, `Vom Gerät bestätigt („${quittung}").`)
        }
      })
      socket.connect(port, host, () => {
        socket.write(rohtext)
      })
    }),
}
