// #413 — Transport-Abstraktion für die CRDT-Synchronisation.
//
// Der SyncManager (syncManager.ts) kennt nur dieses Interface — der konkrete
// Transport ist austauschbar:
//   • LoopbackTransport: in-process, für Tests/Konvergenz-Beweis.
//   • (später) y-webrtc / y-websocket: echtes LAN/Cloud.
//
// Binäre Yjs-Updates gehen rein/raus; der Transport interessiert sich nicht
// für deren Inhalt.

export interface SyncTransport {
  /** Sendet ein binäres Update an den/die Peer(s). */
  send(update: Uint8Array): void
  /** Registriert einen Empfangs-Handler. Rückgabe: Unsubscribe. */
  onReceive(cb: (update: Uint8Array) => void): () => void
  /** Räumt Ressourcen/Listener auf. */
  dispose(): void
}

/**
 * In-Process-Transport zum Testen: zwei Endpunkte, die sich gegenseitig
 * beliefern (was A sendet, empfängt B). Unterstützt `pause()`/`resume()`,
 * um eine Offline-Phase (Divergenz) und das Wiederverbinden zu simulieren —
 * genau der Fall, den ein CRDT lösen muss.
 */
class LoopbackEndpoint implements SyncTransport {
  /** Gegenstelle — wird von createLoopbackPair gesetzt. */
  peer!: LoopbackEndpoint
  private receivers = new Set<(u: Uint8Array) => void>()
  private outbox: Uint8Array[] = []
  private paused = false

  send(update: Uint8Array): void {
    if (this.paused) {
      this.outbox.push(update)
      return
    }
    this.peer.deliver(update)
  }

  onReceive(cb: (update: Uint8Array) => void): () => void {
    this.receivers.add(cb)
    return () => this.receivers.delete(cb)
  }

  dispose(): void {
    this.receivers.clear()
    this.outbox = []
  }

  /** Intern: ein vom Peer gesendetes Update an die eigenen Empfänger geben. */
  deliver(update: Uint8Array): void {
    for (const r of this.receivers) r(update)
  }

  /** Ab jetzt ausgehende Sends puffern (Endpunkt „offline"). */
  pause(): void {
    this.paused = true
  }

  /** Online gehen und alle gepufferten Sends nachliefern. */
  resume(): void {
    this.paused = false
    const queued = this.outbox
    this.outbox = []
    for (const u of queued) this.peer.deliver(u)
  }
}

export type LoopbackTransport = LoopbackEndpoint

/** Erzeugt ein verbundenes Transport-Paar. */
export const createLoopbackPair = (): [LoopbackTransport, LoopbackTransport] => {
  const a = new LoopbackEndpoint()
  const b = new LoopbackEndpoint()
  a.peer = b
  b.peer = a
  return [a, b]
}
