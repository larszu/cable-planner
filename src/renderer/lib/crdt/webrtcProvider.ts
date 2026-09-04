// #413 — Stufe 4: y-webrtc-Provider (echte Cross-Maschine-P2P im LAN/WAN).
//
// Anders als der BroadcastChannel-/Loopback-Transport ist y-webrtc ein
// *Provider*: er bindet direkt an das `Y.Doc` und übernimmt Peer-Finding
// (über einen Signaling-Server), Verbindungsaufbau (WebRTC) und den
// Update-Austausch selbst. Es braucht hier KEINEN SyncManager — der Provider
// wendet Remote-Updates direkt aufs Doc an (mit eigenem, NICHT-`LOCAL_ORIGIN`
// Origin), sodass die Store-Bindung (storeBinding.ts) sie automatisch in den
// Store zieht.
//
// y-webrtc (+ simple-peer) wird LAZY per dynamischem Import geladen. Vite
// code-splittet das in einen eigenen Chunk: der Haupt-Bundle bleibt frei von
// den WebRTC-Abhängigkeiten und ein Ladefehler crasht die App nicht beim
// Start — Kollaboration ist ein opt-in-Feature.
//
// Hinweis: WebRTC braucht einen Signaling-Server zum Peer-Finding. Default
// sind die öffentlichen y-webrtc-Server; für eine reine LAN-Lösung kann ein
// eigener Signaling-Server (y-webrtc/bin/server.js) gesetzt werden.

import type { ProjectCrdt } from './projectCrdt'
import type { AwarenessLike } from './presence'
import type { IceServerConfig } from './iceServers'

export interface WebrtcOptions {
  /** Signaling-Server. Default: öffentliche y-webrtc-Server. Für LAN-only
   *  einen eigenen Server angeben (z. B. ['ws://192.168.1.10:4444']). */
  signaling?: string[]
  /** Optionales Raum-Passwort (E2E-Verschlüsselung der Updates). */
  password?: string
  /** Eigene STUN-/TURN-Server (B-37). Ohne Angabe gelten die Default-STUN-
   *  Server von y-webrtc — die genügen im LAN und scheitern zwischen zwei
   *  Netzen hinter symmetrischem NAT. */
  iceServers?: IceServerConfig[]
}

/**
 * Das Optionen-Objekt, das an `new WebrtcProvider` geht — als eigene, reine
 * Funktion, damit die Weitergabe messbar ist und nicht nur behauptet.
 *
 * Das war der eigentliche Befund hinter B-37: `iceServers` ins Interface zu
 * schreiben kostet eine Zeile, und ob der Wert unten auch ankommt, sieht man
 * einer Typdefinition nicht an. `tests/iceServerErreichenDenProvider.test.ts`
 * prüft deshalb dieses Objekt, nicht den Typ.
 */
export const webrtcProviderOptions = (opts: WebrtcOptions) => ({
  signaling: opts.signaling,
  password: opts.password,
  // y-webrtc reicht `peerOpts` unverändert an simple-peer weiter, das daraus
  // die RTCPeerConnection baut. Nur gesetzt, wenn wirklich Server konfiguriert
  // sind: ein leeres `iceServers: []` würde die Defaults ABSCHALTEN statt sie
  // zu ergänzen — dann fände sich im LAN gar nichts mehr.
  ...(opts.iceServers && opts.iceServers.length > 0
    ? { peerOpts: { config: { iceServers: opts.iceServers } } }
    : {}),
})

export interface WebrtcHandle {
  /** Trennt die Verbindung und gibt den Provider frei. Das Doc bleibt. */
  disconnect: () => void
  /** Awareness des Providers (Presence). */
  awareness: AwarenessLike
}

/**
 * Hängt einen y-webrtc-Provider an das Doc des `crdt`. Peers im selben `room`
 * (und mit gleichem `password`) synchronisieren sich automatisch.
 *
 * Wirft, wenn y-webrtc nicht geladen werden kann — Aufrufer sollte das
 * abfangen und dem User eine verständliche Meldung zeigen.
 */
export const attachWebrtcProvider = async (
  crdt: ProjectCrdt,
  room: string,
  opts: WebrtcOptions = {},
): Promise<WebrtcHandle> => {
  const { WebrtcProvider } = await import('y-webrtc')
  const provider = new WebrtcProvider(room, crdt.doc, webrtcProviderOptions(opts))
  return {
    awareness: provider.awareness as unknown as AwarenessLike,
    disconnect: () => {
      provider.disconnect()
      provider.destroy()
    },
  }
}
