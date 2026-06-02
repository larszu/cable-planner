// #413 — Stufe 4: Kollaborations-Orchestrator.
//
// Fasst die Bausteine zu einer Live-Session zusammen:
//   ProjectCrdt  +  bindStoreToCrdt (Store ⇄ Doc)  +  Transport/Provider.
//
// Zwei Modi:
//   • 'broadcast' — BroadcastChannel + SyncManager. Echtzeit zwischen
//     Fenstern/Tabs derselben Maschine. Keine Dependency, kein Server.
//   • 'webrtc'    — y-webrtc-Provider, direkt am Doc. Cross-Maschine im LAN/
//     WAN (Signaling-Server nötig). Lazy geladen.
//
// In beiden Fällen übernimmt die Store-Bindung den Weg Doc ⇄ Zustand-Store;
// nur der „Draht nach außen" unterscheidet sich.

import { ProjectCrdt } from './projectCrdt'
import { bindStoreToCrdt, type StoreBindingHandle } from './storeBinding'
import { SyncManager } from './syncManager'
import { BroadcastTransport } from './broadcastTransport'
import { attachWebrtcProvider, type WebrtcOptions, type WebrtcHandle } from './webrtcProvider'
import {
  startBroadcastPresence,
  startAwarenessPresence,
  type PresenceHandle,
  type PresencePeer,
  type SelfInfo,
} from './presence'

export type CollabMode = 'broadcast' | 'webrtc'

export interface CollabOptions {
  mode: CollabMode
  /** Raum-/Session-Name. Gleicher Name = gemeinsame Bearbeitung. */
  room: string
  /** Nur für mode='webrtc'. */
  webrtc?: WebrtcOptions
  /** Eigene Presence-Identität (Name/Farbe/Id). */
  self: SelfInfo
  /** Wird mit der aktuellen Teilnehmerliste aufgerufen (Presence). */
  onPeers?: (peers: PresencePeer[]) => void
}

export interface CollabSession {
  readonly mode: CollabMode
  readonly room: string
  /** Beendet die Session: Transport/Provider trennen, Bindung lösen, Doc
   *  freigeben. Der Store behält den zuletzt synchronisierten Stand. */
  stop: () => void
}

/**
 * Startet eine Kollaborations-Session, die an den globalen Projekt-Store
 * gebunden ist. Wirft bei mode='webrtc', wenn y-webrtc nicht ladbar ist.
 */
export const startCollaboration = async (opts: CollabOptions): Promise<CollabSession> => {
  const room = opts.room.trim()
  if (!room) throw new Error('Kollaboration: Raumname darf nicht leer sein')

  const crdt = new ProjectCrdt()
  // Store→Doc seeden: der lokale Stand ist die Ausgangsbasis; eingehende
  // Remote-Stände mergen idempotent dazu (CRDT-Union by id).
  const binding: StoreBindingHandle = bindStoreToCrdt(crdt, { seedDoc: true })

  let manager: SyncManager | null = null
  let transport: BroadcastTransport | null = null
  let webrtc: WebrtcHandle | null = null
  let presence: PresenceHandle | null = null
  const onPeers = opts.onPeers ?? (() => {})

  try {
    if (opts.mode === 'broadcast') {
      transport = new BroadcastTransport(room)
      manager = new SyncManager(crdt, transport)
      manager.start() // sendet Initial-State + verdrahtet Resync + connect()
      presence = startBroadcastPresence(room, opts.self, onPeers)
    } else {
      webrtc = await attachWebrtcProvider(crdt, room, opts.webrtc)
      presence = startAwarenessPresence(webrtc.awareness, opts.self, onPeers)
    }
  } catch (err) {
    // Aufräumen, damit kein halb-initialisierter Zustand zurückbleibt.
    presence?.stop()
    binding.stop()
    crdt.destroy()
    throw err
  }

  return {
    mode: opts.mode,
    room,
    stop: () => {
      presence?.stop()
      manager?.stop()
      transport?.dispose()
      webrtc?.disconnect()
      binding.stop()
      crdt.destroy()
    },
  }
}
