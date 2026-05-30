// #413 — Stufe 4: BroadcastChannel-Transport (echte Mehr-Fenster-Sync).
//
// Implementiert `SyncTransport` über die Web-`BroadcastChannel`-API. Damit
// synchronisieren sich mehrere Fenster/Tabs DERSELBEN Maschine in Echtzeit —
// ohne Server, ohne Netzwerk, ohne zusätzliche Dependency. Ideal als
// „immer verfügbarer" Kollaborations-Kanal (z. B. zweites Plan-Fenster) und
// als real testbarer Transport (Node stellt `BroadcastChannel` global bereit).
//
// Cross-Maschine-P2P über LAN liefert stattdessen der y-webrtc-Provider
// (webrtcProvider.ts) — der bindet direkt ans Y.Doc.
//
// Join-Handshake: BroadcastChannel hat keinen „Verbindungsaufbau". Ein spät
// geöffnetes Fenster würde den bisherigen Stand verpassen. Deshalb sendet
// `connect()` ein `hello`; bestehende Peers antworten über `onResyncRequest`
// (vom SyncManager mit `encodeState()` verdrahtet) mit ihrem vollen Stand.
// CRDT-Merge ist idempotent — mehrere Antworten schaden nicht.

import type { SyncTransport } from './syncTransport'

type Envelope =
  | { kind: 'update'; data: Uint8Array }
  | { kind: 'hello' }

/** Factory-Typ, damit Tests einen eigenen Channel injizieren können. */
export interface BroadcastLike {
  postMessage(msg: unknown): void
  close(): void
  onmessage: ((ev: { data: unknown }) => void) | null
}

export class BroadcastTransport implements SyncTransport {
  private channel: BroadcastLike
  private receivers = new Set<(u: Uint8Array) => void>()
  private resyncers = new Set<() => void>()

  /** @param room  Kanal-/Raumname (gleicher Name = gleiche Session).
   *  @param factory  optionaler Channel-Erzeuger (Default: BroadcastChannel). */
  constructor(room: string, factory?: (room: string) => BroadcastLike) {
    this.channel = factory
      ? factory(room)
      : (new BroadcastChannel(room) as unknown as BroadcastLike)
    this.channel.onmessage = (ev) => this.handle(ev.data as Envelope)
  }

  private handle(msg: Envelope): void {
    if (!msg || typeof msg !== 'object') return
    if (msg.kind === 'update') {
      const data = msg.data
      for (const r of this.receivers) r(data)
    } else if (msg.kind === 'hello') {
      for (const r of this.resyncers) r()
    }
  }

  send(update: Uint8Array): void {
    this.channel.postMessage({ kind: 'update', data: update } satisfies Envelope)
  }

  onReceive(cb: (update: Uint8Array) => void): () => void {
    this.receivers.add(cb)
    return () => this.receivers.delete(cb)
  }

  onResyncRequest(cb: () => void): () => void {
    this.resyncers.add(cb)
    return () => this.resyncers.delete(cb)
  }

  /** Bestehende Peers nach ihrem Stand fragen (Join-Handshake). */
  connect(): void {
    this.channel.postMessage({ kind: 'hello' } satisfies Envelope)
  }

  dispose(): void {
    this.receivers.clear()
    this.resyncers.clear()
    this.channel.onmessage = null
    this.channel.close()
  }
}
