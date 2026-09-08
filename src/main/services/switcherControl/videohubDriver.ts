import net from 'node:net'
import type { ControlAction, ControlResult, SwitcherDriver } from './types.js'

/**
 * Blackmagic Videohub — Text-Protokoll ueber TCP (Vorgabe-Port 9990).
 *
 * Der Block kommt FERTIG aus dem Renderer (`buildCrosspointCommand`), und
 * dieser Treiber baut ihn ausdruecklich nicht neu: die Zusicherung, dass nur
 * die genannten Ausgaenge im Block stehen, ist dort geprueft, und ein zweiter
 * Bauer waere die Defektform `zwei-rechnungen` — mit einer laufenden Anlage
 * als Schauplatz.
 *
 * Der ACK-Zaehler ist derselbe wie in `videohubIpc` (Issue #287): der Hub
 * antwortet je Block-Kopfzeile mit einem ACK, und wer beim ersten schliesst,
 * verliert die uebrigen Bloecke. Hier ist es immer genau EIN Block; der
 * Zaehler bleibt trotzdem allgemein, damit er nicht falsch wird, wenn einmal
 * zwei zusammen gesendet werden.
 */
const ACK = /^ACK\s*$/m

export const videohubDriver: SwitcherDriver = {
  protocol: 'videohub',
  send: (action: ControlAction): Promise<ControlResult> =>
    new Promise<ControlResult>((resolve) => {
      if (action.protocol !== 'videohub') {
        resolve({ ok: false, message: 'Falscher Treiber für dieses Protokoll.' })
        return
      }
      const { host, port, vorschau } = action
      if (!host || !/^[\w.\-:]+$/.test(host)) {
        resolve({ ok: false, message: 'Ungültige IP-Adresse' })
        return
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        resolve({ ok: false, message: 'Ungültiger Port' })
        return
      }
      if (!vorschau.trim()) {
        // Ein leerer Block waere ein Befehl, der wie einer aussieht und keiner
        // ist. Er wird nicht gesendet, und das ist kein Fehler des Netzes.
        resolve({ ok: false, message: 'Kein Befehl zu senden.' })
        return
      }

      const erwarteteAcks = Math.max(1, (vorschau.match(/^[A-Z][A-Z 0-9]*:\s*$/gm) ?? []).length)
      const socket = new net.Socket()
      let buffer = ''
      let scannedTo = 0
      let acks = 0
      let settled = false

      const done = (ok: boolean, message: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        socket.destroy()
        resolve({ ok, message })
      }

      const timer = setTimeout(() => {
        done(
          false,
          acks > 0
            ? `Zeitüberschreitung nach ${acks}/${erwarteteAcks} Bestätigungen`
            : 'Zeitüberschreitung — keine Antwort vom Gerät',
        )
      }, 5000)

      socket.on('error', (err) => done(false, err.message))
      socket.on('close', () => {
        if (!settled) done(false, 'Verbindung wurde geschlossen, bevor der Befehl bestätigt war')
      })
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8')
        const neu = buffer.slice(scannedTo)
        for (const teil of neu.split(/\n\s*\n/)) {
          if (ACK.test(teil)) acks += 1
        }
        scannedTo = buffer.length
        if (acks >= erwarteteAcks) done(true, `Vom Gerät bestätigt (${acks}×ACK)`)
      })
      socket.connect(port, host, () => {
        socket.write(vorschau)
      })
    }),
}
