// #413 — SyncManager: koppelt einen ProjectCrdt an einen Transport.
//
// Verantwortlich für die Live-Schleife:
//   • lokale Doc-Updates → Transport.send (nur lokale, kein Echo)
//   • eingehende Updates  → doc.applyRemoteUpdate (markiert als remote)
//   • Initial-Sync beim Verbinden: eigenen Voll-State einmal senden, damit
//     ein spät hinzukommender Peer den aktuellen Stand bekommt.
//
// Echo-Schutz: angewandte Remote-Updates lösen via applyRemoteUpdate ein
// Doc-Event mit origin='remote' aus; onUpdate liefert isLocal=false → wir
// senden sie NICHT zurück. So entsteht keine Endlosschleife zwischen zwei
// Peers.
//
// CRDT-Konvergenz (kommutativ, idempotent) garantiert, dass beide Seiten
// trotz Offline-Phasen und out-of-order Zustellung denselben Stand erreichen.

import type { ProjectCrdt } from './projectCrdt'
import type { SyncTransport } from './syncTransport'

export interface SyncManagerOptions {
  /** Beim Start den eigenen Voll-State senden (Default true). Für den
   *  zweiten Peer nützlich, der einem laufenden „Raum" beitritt. */
  sendInitialState?: boolean
}

export class SyncManager {
  private readonly crdt: ProjectCrdt
  private readonly transport: SyncTransport
  private unsubDoc: (() => void) | null = null
  private unsubTransport: (() => void) | null = null
  private unsubResync: (() => void) | null = null
  private started = false

  constructor(crdt: ProjectCrdt, transport: SyncTransport) {
    this.crdt = crdt
    this.transport = transport
  }

  /** Verbindet Doc ⇄ Transport und startet die Live-Schleife. */
  start(opts: SyncManagerOptions = {}): void {
    if (this.started) return
    this.started = true

    // Lokale Updates rausschicken (Remote-Updates NICHT — sonst Echo).
    this.unsubDoc = this.crdt.onUpdate((update, isLocal) => {
      if (isLocal) this.transport.send(update)
    })

    // Eingehende Updates als remote anwenden.
    this.unsubTransport = this.transport.onReceive((update) => {
      this.crdt.applyRemoteUpdate(update)
    })

    // Resync-Anfragen beantworten (Transports ohne Join-Handshake): vollen
    // Stand senden, damit der anfragende Peer aufholt. Idempotent.
    if (this.transport.onResyncRequest) {
      this.unsubResync = this.transport.onResyncRequest(() => {
        this.transport.send(this.crdt.encodeState())
      })
    }

    // Initial-State anbieten, damit ein beitretender Peer aufholt.
    if (opts.sendInitialState !== false) {
      this.transport.send(this.crdt.encodeState())
    }

    // Verbindung aktiv anstoßen (z. B. „hello" broadcasten) — NACH allen
    // Listenern, damit keine Antwort verloren geht.
    this.transport.connect?.()
  }

  /** Trennt die Schleife (Listener ab); Doc + Transport bleiben bestehen. */
  stop(): void {
    this.unsubDoc?.()
    this.unsubTransport?.()
    this.unsubResync?.()
    this.unsubDoc = null
    this.unsubTransport = null
    this.unsubResync = null
    this.started = false
  }
}
