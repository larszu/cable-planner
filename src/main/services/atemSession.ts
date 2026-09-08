import { BrowserWindow } from 'electron'
import { Atem, AtemConnectionStatus } from 'atem-connection'

/**
 * Die EINE ATEM-Sitzung des Prozesses.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM SIE AUS `atemIpc.ts` HERAUSGEZOGEN IST (S-2, 2026-09-08)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Bis hierher lag der Singleton im Modul-Scope des IPC-Moduls. Das ging, so
 * lange genau ein Aufrufer ihn brauchte — der ATEM-Dialog. Mit dem
 * Steuerungs-Treiber (`services/switcherControl/atemDriver.ts`) gibt es einen
 * zweiten, und ein zweiter Aufrufer haette entweder eine zweite Verbindung
 * aufgemacht oder auf ein IPC-Modul zugegriffen, das ihm nicht gehoert.
 *
 * Zwei Verbindungen zum selben Mischer waeren nicht bloss Verschwendung: der
 * Connect-Lock unten (v7.9.93) verhindert, dass zwei parallele `connect()`
 * ihre Listener ueber Kreuz feuern lassen. Ein zweiter Singleton haette
 * genau diesen Schutz umgangen, und der Fehler waere ein sporadischer
 * gewesen — die schlechteste Sorte an einem Geraet, das auf Sendung ist.
 *
 * Das Verhalten ist unveraendert. Diese Datei ist ein Umzug, keine Umschrift:
 * Connect-Lock, Handshake-Rennen, Listener-Abbau vor `disconnect()` und der
 * Ereignis-Ringpuffer stehen hier so, wie sie in `atemIpc.ts` standen.
 */

let atem: Atem | null = null
let connectedIp: string | null = null
// v7.9.93 — Connect-Lock gegen Race wenn der User schnell zwei IPs
// hintereinander connect't. Ohne Lock konnten zwei parallele atem.connect()
// im selben Modul-Scope laufen — alte Listener feuerten auf neue atem-
// Instanz oder umgekehrt.
let connectInFlight: Promise<unknown> | null = null

const events: string[] = []

export const pushAtemEvent = (line: string): void => {
  events.push(`[${new Date().toISOString()}] ${line}`)
  if (events.length > 200) events.splice(0, events.length - 200)
  // Forward to all renderer windows for live status updates.
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('atem:event', line)
  }
}

export const atemEvents = (): string[] => events.slice(-100)

export const atemStatus = (): { connected: boolean; ip: string | null } => ({
  connected: !!atem && atem.status === AtemConnectionStatus.CONNECTED,
  ip: connectedIp,
})

/**
 * Die verbundene Instanz — oder `null`.
 *
 * Bewusst `null` und keine Ausnahme: der Aufrufer entscheidet, ob „nicht
 * verbunden" ein Fehler ist (der Dialog) oder eine Auskunft (der Treiber, der
 * daraus ein benanntes Hindernis macht, statt zu werfen).
 */
export const connectedAtem = (): Atem | null =>
  atem && atem.status === AtemConnectionStatus.CONNECTED ? atem : null

export const disconnectAtem = async (): Promise<void> => {
  if (atem) {
    const old = atem
    // v7.9.93 — Listener vor disconnect() abreißen damit late-firing
    // events nicht mehr in pushAtemEvent() landen + GC den alten Object
    // sauber abräumt.
    try { old.removeAllListeners() } catch { /* ignore */ }
    try {
      await old.disconnect()
    } catch {
      /* ignore */
    }
    atem = null
    connectedIp = null
  }
}

/**
 * Verbinden — serialisiert, mit Handshake-Wartezeit.
 *
 * Liefert die verbundene Instanz zurueck, damit der Aufrufer den Zustand
 * zusammenfassen kann, ohne ein zweites Mal nach ihr zu fragen (zwischen
 * zwei Aufrufen koennte sie schon eine andere sein).
 */
export const connectAtem = async (ip: string): Promise<Atem> => {
  if (!ip || typeof ip !== 'string') {
    throw new Error('ATEM IP address is required.')
  }
  // v7.9.93 — Serialisiere connect-Aufrufe damit zwei parallele
  // connect-IPC-Calls (User klickt schnell mit zwei IPs) nicht race-en.
  // Der zweite Call wartet bis der erste durch ist.
  if (connectInFlight) {
    try { await connectInFlight } catch { /* der erste darf scheitern */ }
  }
  const runConnect = async (): Promise<Atem> => {
    await disconnectAtem()
    const localAtem = new Atem()
    atem = localAtem
    connectedIp = ip

    // v7.9.93 — Event-Wait via Promise statt Polling-Loop. Wir wrappen
    // 'connected' / 'error' / Timeout in race().
    const handshake = new Promise<void>((resolve, reject) => {
      const onConnected = () => {
        cleanupOnce()
        resolve()
      }
      const onError = (msg: string) => {
        cleanupOnce()
        reject(new Error(msg))
      }
      const cleanupOnce = () => {
        localAtem.off('connected', onConnected)
        localAtem.off('error', onError)
      }
      localAtem.once('connected', onConnected)
      localAtem.once('error', onError)
      setTimeout(() => {
        cleanupOnce()
        reject(new Error('Handshake timeout (5s)'))
      }, 5000)
    })

    // Permanente Listener für UI-Events.
    localAtem.on('connected', () => pushAtemEvent(`Connected to ATEM at ${ip}`))
    localAtem.on('disconnected', () => pushAtemEvent(`Disconnected from ATEM at ${ip}`))
    localAtem.on('error', (msg: string) => pushAtemEvent(`ATEM error: ${msg}`))
    localAtem.on('info', (msg: string) => pushAtemEvent(`ATEM: ${msg}`))

    try {
      await localAtem.connect(ip)
      await handshake
    } catch (err) {
      // Wenn dieser Connect noch der "aktuelle" ist → aufräumen. Bei
      // concurrent-replace könnte atem schon auf ein anderes Objekt zeigen —
      // dann nichts kaputt machen.
      if (atem === localAtem) await disconnectAtem()
      throw new Error(
        `Could not connect to ATEM at ${ip}: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      )
    }

    if (atem !== localAtem || localAtem.status !== AtemConnectionStatus.CONNECTED) {
      if (atem === localAtem) await disconnectAtem()
      throw new Error(`ATEM at ${ip} did not finish handshake within 5s.`)
    }

    return localAtem
  }
  const promise = runConnect()
  connectInFlight = promise
  try {
    return await promise
  } finally {
    if (connectInFlight === promise) connectInFlight = null
  }
}
