// #413 — Stufe 4: Lifecycle-Store für die Live-Kollaboration.
//
// Hält den Status der aktuellen Session und die User-Einstellungen (Modus +
// Raumname) und kapselt start/stop. Die UI (SyncTab) liest hier den Status
// und löst start/stop aus. Genau EINE Session ist gleichzeitig aktiv.

import { create } from 'zustand'
import { startCollaboration, type CollabMode, type CollabSession } from '../lib/crdt/collab'

export type CollabStatus = 'off' | 'connecting' | 'on' | 'error'

interface PersistedCollab {
  mode: CollabMode
  room: string
}

const COLLAB_KEY = 'cable-planner.collab'

const defaults: PersistedCollab = { mode: 'broadcast', room: 'cable-planner' }

const load = (): PersistedCollab => {
  try {
    const raw = localStorage.getItem(COLLAB_KEY)
    if (!raw) return defaults
    const p = JSON.parse(raw) as Partial<PersistedCollab>
    return {
      mode: p.mode === 'webrtc' || p.mode === 'broadcast' ? p.mode : defaults.mode,
      room: typeof p.room === 'string' && p.room.trim() ? p.room : defaults.room,
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

interface CollabState {
  status: CollabStatus
  mode: CollabMode
  room: string
  error?: string
  /** Aktive Session (nicht-reaktiv genutzt; Status spiegelt den Zustand). */
  session: CollabSession | null
  setMode: (mode: CollabMode) => void
  setRoom: (room: string) => void
  start: () => Promise<void>
  stop: () => void
}

const initial = load()

export const useCollabStore = create<CollabState>((set, get) => ({
  status: 'off',
  mode: initial.mode,
  room: initial.room,
  error: undefined,
  session: null,

  setMode: (mode) => {
    persist({ mode, room: get().room })
    set({ mode })
  },
  setRoom: (room) => {
    persist({ mode: get().mode, room })
    set({ room })
  },

  start: async () => {
    const { status, mode, room, session } = get()
    if (status === 'connecting' || status === 'on') return
    if (session) session.stop()
    set({ status: 'connecting', error: undefined, session: null })
    try {
      const s = await startCollaboration({ mode, room })
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
      })
    }
  },

  stop: () => {
    const { session } = get()
    session?.stop()
    set({ session: null, status: 'off', error: undefined })
  },
}))
