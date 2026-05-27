import { ipcMain } from 'electron'
import net from 'net'
import { Bonjour, type Service } from 'bonjour-service'

/**
 * v7.9.128 — Parser fuer Videohub-Protokoll-State-Dumps.
 *
 * Bei Connect schickt jeder Blackmagic Videohub einen vollstaendigen
 * State-Dump in mehreren Bloecken, getrennt durch Leerzeilen:
 *
 *   PROTOCOL PREAMBLE:
 *   Version: 2.8
 *
 *   VIDEOHUB DEVICE:
 *   Device present: true
 *   Model name: Blackmagic Smart Videohub 12G 40 x 40
 *   Video inputs: 40
 *   Video outputs: 40
 *
 *   INPUT LABELS:
 *   0 SDI In 1
 *   1 Cam Stage
 *   ...
 *
 *   OUTPUT LABELS:
 *   0 PGM
 *   1 PVW
 *   ...
 *
 *   VIDEO OUTPUT LOCKS:
 *   0 U         ← U=unlocked, L=locked-by-other, O=locked-by-self
 *   1 L
 *   ...
 *
 *   VIDEO OUTPUT ROUTING:
 *   0 5         ← Output 0 wird gespeist von Input 5
 *   1 0
 *   ...
 *
 *   CONFIGURATION:
 *   Take Mode: false
 *
 * Diese Funktion parsed den kompletten Dump in ein strukturiertes Objekt.
 * Unbekannte Blocks werden ignoriert.
 */
export interface VideohubState {
  protocolVersion?: string
  modelName?: string
  friendlyName?: string
  uniqueId?: string
  videoInputs?: number
  videoOutputs?: number
  inputLabels: Record<number, string>
  outputLabels: Record<number, string>
  outputLocks: Record<number, 'unlocked' | 'locked-other' | 'locked-self'>
  routing: Record<number, number>
  takeMode?: boolean
}

const emptyState = (): VideohubState => ({
  inputLabels: {},
  outputLabels: {},
  outputLocks: {},
  routing: {},
})

const parseVideohubDump = (buffer: string): VideohubState => {
  const state = emptyState()
  // Bloecke sind durch Leerzeilen getrennt. Jede Block beginnt mit
  // einer "HEADER:" Zeile gefolgt von 1..N Datenzeilen.
  const blocks = buffer.split(/\r?\n\r?\n/)
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.length > 0)
    if (lines.length === 0) continue
    const header = lines[0].replace(/:\s*$/, '').toUpperCase()
    const data = lines.slice(1)
    switch (header) {
      case 'PROTOCOL PREAMBLE': {
        for (const line of data) {
          const m = line.match(/^Version:\s*(.+)$/i)
          if (m) state.protocolVersion = m[1].trim()
        }
        break
      }
      case 'VIDEOHUB DEVICE': {
        for (const line of data) {
          const [key, ...rest] = line.split(':')
          const value = rest.join(':').trim()
          switch (key.trim().toLowerCase()) {
            case 'model name':
              state.modelName = value
              break
            case 'friendly name':
              state.friendlyName = value
              break
            case 'unique id':
              state.uniqueId = value
              break
            case 'video inputs':
              state.videoInputs = parseInt(value, 10) || undefined
              break
            case 'video outputs':
              state.videoOutputs = parseInt(value, 10) || undefined
              break
          }
        }
        break
      }
      case 'INPUT LABELS': {
        for (const line of data) {
          const m = line.match(/^(\d+)\s+(.*)$/)
          if (m) state.inputLabels[parseInt(m[1], 10)] = m[2]
        }
        break
      }
      case 'OUTPUT LABELS': {
        for (const line of data) {
          const m = line.match(/^(\d+)\s+(.*)$/)
          if (m) state.outputLabels[parseInt(m[1], 10)] = m[2]
        }
        break
      }
      case 'VIDEO OUTPUT LOCKS': {
        for (const line of data) {
          const m = line.match(/^(\d+)\s+([ULO])\s*$/i)
          if (m) {
            const idx = parseInt(m[1], 10)
            const code = m[2].toUpperCase()
            state.outputLocks[idx] =
              code === 'L' ? 'locked-other' : code === 'O' ? 'locked-self' : 'unlocked'
          }
        }
        break
      }
      case 'VIDEO OUTPUT ROUTING': {
        for (const line of data) {
          const m = line.match(/^(\d+)\s+(\d+)\s*$/)
          if (m) state.routing[parseInt(m[1], 10)] = parseInt(m[2], 10)
        }
        break
      }
      case 'CONFIGURATION': {
        for (const line of data) {
          const m = line.match(/^Take Mode:\s*(true|false)$/i)
          if (m) state.takeMode = m[1].toLowerCase() === 'true'
        }
        break
      }
      // Unknown blocks (e.g. VIDEO MONITORING OUTPUT LABELS, SERIAL PORT DIRECTIONS) — ignored.
    }
  }
  return state
}

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

        // Issue #287 — "Labels + Routing senden" hat nur Labels gesendet:
        // wir haben beim ERSTEN ACK den Socket geschlossen. Bei einem
        // Multi-Block-Push (INPUT LABELS + OUTPUT LABELS + VIDEO OUTPUT
        // ROUTING) schickt der Hub aber pro Block ein ACK\n\n zurueck.
        // Loesung: pro Block-Header (uppercase Zeile mit ":") einmal ACK
        // erwarten; erst wenn alle eingetroffen sind, done(true).
        const blockHeaderCount = (block.match(/^[A-Z][A-Z 0-9]*:\s*$/gm) ?? []).length
        const expectedAcks = Math.max(1, blockHeaderCount)

        const socket = new net.Socket()
        let buffer = ''
        let preambleSeen = false
        let settled = false
        let receivedAcks = 0
        // Wir tracken die laenge des Buffers bis zum letzten gezaehlten
        // ACK damit wir bei wachsendem Buffer nur das neue Stueck nach
        // weiteren ACKs durchsuchen — und nicht den gleichen ACK mehrfach
        // zaehlen.
        let scannedTo = 0

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
            receivedAcks > 0
              ? `Timeout nach ${receivedAcks}/${expectedAcks} ACKs — Hub hat nicht alle Blocks bestaetigt`
              : 'Timeout: keine Antwort vom Videohub (5 s)',
          )
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
            // Nachdem wir geschrieben haben, ist alles bis hier "Hub-Hello".
            // Erst die Bytes DANACH gehoeren zur Antwort auf unseren Push —
            // also setzen wir scannedTo auf das aktuelle Buffer-Ende, damit
            // ein potenzielles "ACK" das schon in der Preamble vorkommt
            // (z.B. in einem Modellnamen wie "...Smart-ACK 40x40 12G")
            // nicht faelschlich gezaehlt wird.
            scannedTo = buffer.length
          }

          if (preambleSeen && buffer.length > scannedTo) {
            const fresh = buffer.slice(scannedTo)
            scannedTo = buffer.length

            // NAK means the hub rejected the command (e.g. locked outputs)
            if (/\bNAK\b/.test(fresh)) {
              done(false, 'Videohub hat den Befehl abgelehnt (NAK) — Output gesperrt?')
              return
            }

            // ACK pro Block — exakt match auf ACK gefolgt von Whitespace
            // damit wir nicht "ACKnowledge" o.ae. in einem Label-Text mit-
            // zaehlen.
            const acksInFresh = (fresh.match(/\bACK\b/g) ?? []).length
            receivedAcks += acksInFresh

            if (receivedAcks >= expectedAcks) {
              done(
                true,
                expectedAcks === 1
                  ? 'Erfolgreich übertragen'
                  : `Erfolgreich übertragen (${receivedAcks} Blocks bestaetigt)`,
              )
            }
          }
        })
      })
    },
  )

  /**
   * v7.9.128 — Read full state dump from a Videohub.
   *
   * Strategie: Verbinden, alle Bloecke (PROTOCOL PREAMBLE,
   * VIDEOHUB DEVICE, INPUT LABELS, OUTPUT LABELS, VIDEO OUTPUT LOCKS,
   * VIDEO OUTPUT ROUTING, CONFIGURATION) sammeln bis 600ms keine
   * Daten mehr kommen (= initialer Dump abgeschlossen), dann
   * disconnect + parsen + zurueckgeben.
   *
   * Verwendung im Renderer: User klickt "Status laden" -> bekommt
   * echte Labels + aktuelles Routing + Lock-State vom Hub statt
   * Defaults aus dem Canvas. Auch fuer den UI-Stand "was steht
   * gerade im Hub vs. was hat der User in der Matrix konfiguriert"
   * wichtig.
   */
  ipcMain.handle(
    'videohub:read-state',
    (_, { host, port }: { host: string; port: number }) => {
      return new Promise<{ ok: boolean; message: string; state: VideohubState | null }>(
        (resolve) => {
          if (!host || !/^[\w.\-:]+$/.test(host)) {
            resolve({ ok: false, message: 'Ungueltige IP-Adresse', state: null })
            return
          }
          if (!Number.isInteger(port) || port < 1 || port > 65535) {
            resolve({ ok: false, message: 'Ungueltiger Port', state: null })
            return
          }

          const socket = new net.Socket()
          let buffer = ''
          let settled = false
          // Silence-Detector: nach 600ms ohne neue Daten ist der
          // initiale State-Dump fertig. Wert ist konservativ — selbst
          // 288x288 Hubs schicken alles in < 200ms ueber LAN.
          let silenceTimer: NodeJS.Timeout | null = null

          const done = (ok: boolean, message: string, state: VideohubState | null) => {
            if (settled) return
            settled = true
            clearTimeout(connectTimer)
            if (silenceTimer) clearTimeout(silenceTimer)
            socket.destroy()
            resolve({ ok, message, state })
          }

          const connectTimer = setTimeout(() => {
            done(false, 'Timeout: keine Verbindung zum Videohub (5 s)', null)
          }, 5000)

          const scheduleParse = () => {
            if (silenceTimer) clearTimeout(silenceTimer)
            silenceTimer = setTimeout(() => {
              const state = parseVideohubDump(buffer)
              done(true, 'Status erfolgreich gelesen', state)
            }, 600)
          }

          socket.connect(port, host)

          socket.on('error', (err) => {
            done(false, `Verbindungsfehler: ${err.message}`, null)
          })

          socket.on('data', (data) => {
            buffer += data.toString()
            scheduleParse()
          })

          socket.on('close', () => {
            // Verbindung selbst-aktiv beendet vom Hub? Wenn wir
            // schon Daten haben, ausparsen, sonst Fehler.
            if (buffer.length > 0) {
              const state = parseVideohubDump(buffer)
              done(true, 'Status erfolgreich gelesen (Verbindung getrennt)', state)
            } else if (!settled) {
              done(false, 'Verbindung vom Hub getrennt ohne Daten', null)
            }
          })
        },
      )
    },
  )

  // Issue #248 — mDNS-Auto-Discovery fuer Videohubs.
  //
  // Blackmagic Videohubs broadcasten sich als "_blackmagic._tcp.local"
  // mit TXT-Record class=videohub o.ae. Wir nutzen denselben Bonjour-
  // Service-Type wie ATEM-Discovery (#248: "bei Atem live Integration
  // findet er den Videohub in der Suche") und filtern client-seitig
  // auf videohub-typische Modellnamen/TXT-Records aus.
  ipcMain.handle(
    'videohub:discover',
    async (
      _event,
      params?: { timeoutMs?: number },
    ): Promise<Array<{ name: string; ip: string; port: number; model?: string }>> => {
      const timeoutMs = Math.max(500, Math.min(15000, params?.timeoutMs ?? 3000))
      const bonjour = new Bonjour()
      const found = new Map<string, { name: string; ip: string; port: number; model?: string }>()
      const browser = bonjour.find({ type: 'blackmagic' })
      const looksLikeVideohub = (svc: Service): boolean => {
        const haystack = [
          svc.name,
          svc.fqdn,
          // TXT-Records koennen "class=videohub" oder "model=..." tragen.
          ...(svc.txt && typeof svc.txt === 'object'
            ? Object.values(svc.txt as Record<string, unknown>).map((v) => String(v))
            : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return /videohub|video hub|smart.?videohub/.test(haystack)
      }
      const onUp = (svc: Service) => {
        const ip = svc.referer?.address ?? svc.addresses?.[0]
        if (!ip) return
        if (!looksLikeVideohub(svc)) return
        const key = svc.fqdn || svc.name || ip
        if (found.has(key)) return
        const model =
          svc.txt && typeof svc.txt === 'object' && 'model' in (svc.txt as Record<string, unknown>)
            ? String((svc.txt as Record<string, unknown>).model)
            : undefined
        found.set(key, {
          name: svc.name || svc.fqdn || ip,
          ip,
          // Videohub-Protokoll ist immer Port 9990.
          port: 9990,
          model,
        })
      }
      browser.on('up', onUp)
      await new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
      browser.stop()
      bonjour.destroy()
      return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
    },
  )
}
