import { ipcMain } from 'electron'
import net from 'net'

export function registerVideohubIpc() {
  /**
   * Send a Videohub protocol command block to a real Blackmagic Videohub via TCP.
   * Connects, waits for the PROTOCOL PREAMBLE from the hub, then sends the command
   * block (e.g. "VIDEO OUTPUT ROUTING:\n0 3\n1 5\n\n") and waits for ACK.
   *
   * @param host  IP address of the Videohub
   * @param port  TCP port (default 9990)
   * @param block Raw protocol block to send (must end with \n\n)
   */
  ipcMain.handle(
    'videohub:send',
    (_, { host, port, block }: { host: string; port: number; block: string }) => {
      return new Promise<{ ok: boolean; message: string }>((resolve) => {
        // Basic input validation
        if (!host || !/^[\w.\-:]+$/.test(host)) {
          resolve({ ok: false, message: 'Ungültige IP-Adresse' })
          return
        }
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          resolve({ ok: false, message: 'Ungültiger Port' })
          return
        }

        const socket = new net.Socket()
        let buffer = ''
        let preambleSeen = false
        let settled = false

        const done = (ok: boolean, message: string) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          socket.destroy()
          resolve({ ok, message })
        }

        const timer = setTimeout(() => {
          done(false, 'Timeout: keine Antwort vom Videohub (5 s)')
        }, 5000)

        socket.connect(port, host)

        socket.on('error', (err) => {
          done(false, `Verbindungsfehler: ${err.message}`)
        })

        socket.on('data', (data) => {
          buffer += data.toString()

          if (!preambleSeen && buffer.includes('PROTOCOL PREAMBLE:')) {
            preambleSeen = true
            // Ensure block ends with double newline
            const cmd = block.endsWith('\n\n') ? block : block.trimEnd() + '\n\n'
            socket.write(cmd)
          }

          if (preambleSeen && buffer.includes('ACK')) {
            done(true, 'Routing erfolgreich übertragen')
          }

          // NAK means the hub rejected the command (e.g. locked outputs)
          if (preambleSeen && buffer.includes('NAK')) {
            done(false, 'Videohub hat den Befehl abgelehnt (NAK) — Output gesperrt?')
          }
        })
      })
    },
  )
}
