// #413 — Stufe 4: Lifecycle-Store für die Live-Kollaboration.
//
// Hält den Status der aktuellen Session, die User-Einstellungen (Modus +
// Raumname + Anzeigename + LAN-Signaling) und die Teilnehmerliste (Presence).
// Die UI (CollabPanel) liest hier den Status und löst start/stop aus. Genau
// EINE Session ist gleichzeitig aktiv.

import { create } from 'zustand'
import { startCollaboration, type CollabMode, type CollabSession } from '../lib/crdt/collab'
import { colorForId, type PresencePeer } from '../lib/crdt/presence'
import { cablePlannerApi, type DiscoveredCollabSession } from '../lib/bridge'
import { useUiStore } from './uiStore'
import { useProjectStore } from './projectStore'

export type { CollabMode } from '../lib/crdt/collab'
export type { PresencePeer } from '../lib/crdt/presence'
export type { DiscoveredCollabSession } from '../lib/bridge'
export type CollabStatus = 'off' | 'connecting' | 'on' | 'error'

interface PersistedCollab {
  mode: CollabMode
  room: string
  name: string
  signaling: string
  /** Optionales Raum-Passwort. Leitet in y-webrtc die E2E-Verschlüsselung
   *  der Sync-/Awareness-Updates ab: nur Peers mit demselben Passwort können
   *  das Projekt lesen. Ohne Passwort kann jeder, der Raumname+Signaling
   *  kennt, das gesamte Projekt mitlesen. */
  password: string
}

const COLLAB_KEY = 'cable-planner.collab'

const defaults: PersistedCollab = { mode: 'broadcast', room: 'cable-planner', name: '', signaling: '', password: '' }

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
      password: typeof p.password === 'string' ? p.password : defaults.password,
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

/** Bewirbt die laufende WebRTC-Session per mDNS, damit andere Instanzen im
 *  LAN sie über „Im Netzwerk suchen" finden. Fire-and-forget; im Web-Build
 *  (kein Desktop-Bridge) ein No-op. */
const advertiseSession = (room: string, name: string, signaling: string): void => {
  const project = useProjectStore.getState().project.metadata.name?.trim() || ''
  void cablePlannerApi.collabDiscovery
    .advertise({ room: room.trim(), project, host: effectiveName(name), signaling: signaling.trim() })
    .catch(() => {})
}

const unadvertiseSession = (): void => {
  void cablePlannerApi.collabDiscovery.unadvertise().catch(() => {})
}

interface CollabState {
  status: CollabStatus
  mode: CollabMode
  room: string
  name: string
  signaling: string
  password: string
  error?: string
  peers: PresencePeer[]
  selfId: string
  session: CollabSession | null
  /** Im LAN gefundene offene Sessions (nach `discover()`). */
  discovered: DiscoveredCollabSession[]
  /** Läuft gerade eine Netzwerk-Suche? */
  discovering: boolean
  setMode: (mode: CollabMode) => void
  setRoom: (room: string) => void
  setName: (name: string) => void
  setSignaling: (signaling: string) => void
  setPassword: (password: string) => void
  start: () => Promise<void>
  stop: () => void
  /** Durchsucht das LAN nach offenen Sessions und füllt `discovered`. */
  discover: () => Promise<void>
  /** Tritt einer gefundenen Session bei (Modus/Raum/Signaling übernehmen). */
  joinDiscovered: (s: DiscoveredCollabSession) => Promise<void>
}

const initial = load()

export const useCollabStore = create<CollabState>((set, get) => ({
  status: 'off',
  mode: initial.mode,
  room: initial.room,
  name: initial.name,
  signaling: initial.signaling,
  password: initial.password,
  error: undefined,
  peers: [],
  selfId,
  session: null,
  discovered: [],
  discovering: false,

  setMode: (mode) => {
    persist({ mode, room: get().room, name: get().name, signaling: get().signaling, password: get().password })
    set({ mode })
  },
  setRoom: (room) => {
    persist({ mode: get().mode, room, name: get().name, signaling: get().signaling, password: get().password })
    set({ room })
  },
  setName: (name) => {
    persist({ mode: get().mode, room: get().room, name, signaling: get().signaling, password: get().password })
    set({ name })
  },
  setSignaling: (signaling) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling, password: get().password })
    set({ signaling })
  },
  setPassword: (password) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling: get().signaling, password })
    set({ password })
  },

  start: async () => {
    const { status, mode, room, name, signaling, password, session } = get()
    if (status === 'connecting' || status === 'on') return
    if (session) session.stop()
    set({ status: 'connecting', error: undefined, session: null, peers: [] })
    const self = { id: selfId, name: effectiveName(name), color: colorForId(selfId) }
    const signalingList = signaling
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    const pw = password.trim()
    // Nur ein WebRTC-Options-Objekt bauen, wenn es etwas zu setzen gibt
    // (Signaling und/oder Passwort). Das Passwort verschlüsselt den Raum
    // E2E — nur Peers mit demselben Passwort können das Projekt lesen.
    const webrtcOpts =
      signalingList.length > 0 || pw
        ? { ...(signalingList.length > 0 ? { signaling: signalingList } : {}), ...(pw ? { password: pw } : {}) }
        : undefined
    try {
      const s = await startCollaboration({
        mode,
        room,
        self,
        onPeers: (peers) => set({ peers }),
        webrtc: webrtcOpts,
      })
      // Falls der User zwischenzeitlich gestoppt/gewechselt hat: verwerfen.
      if (get().status !== 'connecting') {
        s.stop()
        return
      }
      set({ session: s, status: 'on' })
      // Nur Netzwerk-Sessions im LAN bewerben (broadcast = nur dieses Gerät).
      if (mode === 'webrtc') advertiseSession(room, name, signaling)
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
    unadvertiseSession()
    set({ session: null, status: 'off', error: undefined, peers: [] })
  },

  discover: async () => {
    if (get().discovering) return
    set({ discovering: true })
    try {
      const found = await cablePlannerApi.collabDiscovery.browse({ timeoutMs: 3000 })
      // Eigene, gerade beworbene Session aus der Liste filtern (gleicher Raum
      // + WebRTC läuft schon) — man tritt sich nicht selbst bei.
      const self = get()
      const list =
        self.status === 'on' && self.mode === 'webrtc'
          ? found.filter((f) => f.room !== self.room)
          : found
      set({ discovered: list })
    } catch {
      set({ discovered: [] })
    } finally {
      set({ discovering: false })
    }
  },

  joinDiscovered: async (s) => {
    if (get().status === 'on' || get().status === 'connecting') get().stop()
    get().setMode('webrtc')
    get().setRoom(s.room)
    get().setSignaling(s.signaling)
    set({ discovered: [] })
    await get().start()
  },
}))
