// #413 — Stufe 4: Lifecycle-Store für die Live-Kollaboration.
//
// Hält den Status der aktuellen Session, die User-Einstellungen (Modus +
// Raumname + Anzeigename + LAN-Signaling) und die Teilnehmerliste (Presence).
// Die UI (CollabPanel) liest hier den Status und löst start/stop aus. Genau
// EINE Session ist gleichzeitig aktiv.

import { create } from 'zustand'
import { startCollaboration, type CollabMode, type CollabSession } from '../lib/crdt/collab'
import { colorForId, type PresencePeer } from '../lib/crdt/presence'
import { useUiStore } from './uiStore'

export type { CollabMode } from '../lib/crdt/collab'
export type { PresencePeer } from '../lib/crdt/presence'
export type CollabStatus = 'off' | 'connecting' | 'on' | 'error'

interface PersistedCollab {
  mode: CollabMode
  room: string
  name: string
  signaling: string
}

const COLLAB_KEY = 'cable-planner.collab'

const defaults: PersistedCollab = { mode: 'broadcast', room: 'cable-planner', name: '', signaling: '' }

/** Stabile Peer-Id pro Fenster/Tab. Bewusst sessionStorage (NICHT
 *  localStorage): mehrere Fenster derselben Maschine teilen sich
 *  localStorage und bekämen sonst dieselbe Id — Presence würde sie als
 *  einen Peer sehen. sessionStorage ist pro Tab und übersteht Reloads. */
const selfId = ((): string => {
  const mk = () => (crypto.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`)
  try {
    const k = 'cable-planner.collab.selfId'
    let v = sessionStorage.getItem(k)
    if (!v) {
      v = mk()
      sessionStorage.setItem(k, v)
    }
    return v
  } catch {
    return mk()
  }
})()

const load = (): PersistedCollab => {
  try {
    const raw = localStorage.getItem(COLLAB_KEY)
    if (!raw) return defaults
    const p = JSON.parse(raw) as Partial<PersistedCollab>
    return {
      mode: p.mode === 'webrtc' || p.mode === 'broadcast' ? p.mode : defaults.mode,
      room: typeof p.room === 'string' && p.room.trim() ? p.room : defaults.room,
      name: typeof p.name === 'string' ? p.name : defaults.name,
      signaling: typeof p.signaling === 'string' ? p.signaling : defaults.signaling,
    }
  } catch {
    return defaults
  }
}

const persist = (s: PersistedCollab) => {
  try {
    localStorage.setItem(COLLAB_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** Effektiver Anzeigename: explizit gesetzt → Annotation-Autor → "Planner". */
const effectiveName = (name: string): string => {
  const n = name.trim()
  if (n) return n
  const author = useUiStore.getState().annotationAuthor?.trim()
  return author || 'Planner'
}

interface CollabState {
  status: CollabStatus
  mode: CollabMode
  room: string
  name: string
  signaling: string
  error?: string
  peers: PresencePeer[]
  selfId: string
  session: CollabSession | null
  setMode: (mode: CollabMode) => void
  setRoom: (room: string) => void
  setName: (name: string) => void
  setSignaling: (signaling: string) => void
  start: () => Promise<void>
  stop: () => void
}

const initial = load()

export const useCollabStore = create<CollabState>((set, get) => ({
  status: 'off',
  mode: initial.mode,
  room: initial.room,
  name: initial.name,
  signaling: initial.signaling,
  error: undefined,
  peers: [],
  selfId,
  session: null,

  setMode: (mode) => {
    persist({ mode, room: get().room, name: get().name, signaling: get().signaling })
    set({ mode })
  },
  setRoom: (room) => {
    persist({ mode: get().mode, room, name: get().name, signaling: get().signaling })
    set({ room })
  },
  setName: (name) => {
    persist({ mode: get().mode, room: get().room, name, signaling: get().signaling })
    set({ name })
  },
  setSignaling: (signaling) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling })
    set({ signaling })
  },

  start: async () => {
    const { status, mode, room, name, signaling, session } = get()
    if (status === 'connecting' || status === 'on') return
    if (session) session.stop()
    set({ status: 'connecting', error: undefined, session: null, peers: [] })
    const self = { id: selfId, name: effectiveName(name), color: colorForId(selfId) }
    const signalingList = signaling
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      const s = await startCollaboration({
        mode,
        room,
        self,
        onPeers: (peers) => set({ peers }),
        webrtc: signalingList.length > 0 ? { signaling: signalingList } : undefined,
      })
      // Falls der User zwischenzeitlich gestoppt/gewechselt hat: verwerfen.
      if (get().status !== 'connecting') {
        s.stop()
        return
      }
      set({ session: s, status: 'on' })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        session: null,
        peers: [],
      })
    }
  },

  stop: () => {
    const { session } = get()
    session?.stop()
    set({ session: null, status: 'off', error: undefined, peers: [] })
  },
}))
