// #413 — Stufe 4: Lifecycle-Store für die Live-Kollaboration.
//
// Hält den Status der aktuellen Session, die User-Einstellungen (Modus +
// Raumname + Anzeigename + LAN-Signaling) und die Teilnehmerliste (Presence).
// Die UI (CollabPanel) liest hier den Status und löst start/stop aus. Genau
// EINE Session ist gleichzeitig aktiv.

import { create } from 'zustand'
import { startCollaboration, type CollabMode, type CollabSession } from '../lib/crdt/collab'
import { colorForId, type PresencePeer } from '../lib/crdt/presence'
import { cablePlannerApi, hasDesktopBridge, type DiscoveredCollabSession } from '../lib/bridge'
import { useUiStore } from './uiStore'
import { useProjectStore } from './projectStore'
import { setUndoDelegate } from './projectHistory'

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
  /** „Nur lokal": ignoriert jeden Remote-/öffentlichen Relay und nutzt
   *  ausschließlich das lokale Netz (LAN-Signaling). Für sensible Umgebungen —
   *  nichts verlässt das eigene Netzwerk. */
  localOnly: boolean
}

const COLLAB_KEY = 'cable-planner.collab'

/** Öffentlicher y-webrtc-Default-Server. Wir nutzen ihn nur noch als FALLBACK
 *  hinter dem lokalen LAN-Server (y-webrtc verbindet sich mit allen Servern der
 *  Liste) — so funktioniert auch der manuelle „gleicher Raumname"-Workflow ohne
 *  Discovery weiter, während im LAN der lokale Server gewinnt. */
const PUBLIC_SIGNALING_FALLBACK = 'wss://y-webrtc-eu.fly.dev'

const defaults: PersistedCollab = { mode: 'broadcast', room: 'cable-planner', name: '', signaling: '', password: '', localOnly: false }

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
      localOnly: typeof p.localOnly === 'boolean' ? p.localOnly : defaults.localOnly,
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
  /** true, wenn DIESE Instanz den lokalen LAN-Signaling-Server gestartet hat
   *  (Host ohne eigenen Server) — dann muss `stop()` ihn wieder schließen. */
  localSignaling: boolean
  /** Im LAN gefundene offene Sessions (nach `discover()`). */
  discovered: DiscoveredCollabSession[]
  /** Läuft gerade eine Netzwerk-Suche? */
  discovering: boolean
  setMode: (mode: CollabMode) => void
  setRoom: (room: string) => void
  setName: (name: string) => void
  setSignaling: (signaling: string) => void
  setPassword: (password: string) => void
  localOnly: boolean
  setLocalOnly: (localOnly: boolean) => void
  /** Startet eine Session. `adopt` (Beitreten): eigenen Plan NICHT seeden, den
   *  Plan des Hosts übernehmen, und keinen eigenen Signaling-Server starten. */
  start: (opts?: { adopt?: boolean }) => Promise<void>
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
  localOnly: initial.localOnly,
  error: undefined,
  peers: [],
  selfId,
  session: null,
  localSignaling: false,
  discovered: [],
  discovering: false,

  setMode: (mode) => {
    persist({ mode, room: get().room, name: get().name, signaling: get().signaling, password: get().password, localOnly: get().localOnly })
    set({ mode })
  },
  setRoom: (room) => {
    persist({ mode: get().mode, room, name: get().name, signaling: get().signaling, password: get().password, localOnly: get().localOnly })
    set({ room })
  },
  setName: (name) => {
    persist({ mode: get().mode, room: get().room, name, signaling: get().signaling, password: get().password, localOnly: get().localOnly })
    set({ name })
  },
  setSignaling: (signaling) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling, password: get().password, localOnly: get().localOnly })
    set({ signaling })
  },
  setPassword: (password) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling: get().signaling, password, localOnly: get().localOnly })
    set({ password })
  },
  setLocalOnly: (localOnly) => {
    persist({ mode: get().mode, room: get().room, name: get().name, signaling: get().signaling, password: get().password, localOnly })
    set({ localOnly })
  },

  start: async (opts) => {
    const adopt = opts?.adopt === true
    const { status, mode, room, name, signaling, password, session, localOnly } = get()
    if (status === 'connecting' || status === 'on') return
    if (session) session.stop()
    set({ status: 'connecting', error: undefined, session: null, peers: [] })
    const self = { id: selfId, name: effectiveName(name), color: colorForId(selfId) }
    // „Nur lokal": jeden manuell gesetzten Remote-Relay ignorieren — es zählt
    // ausschließlich der lokale LAN-Server (unten gestartet).
    let signalingList = localOnly
      ? []
      : signaling
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
    // #413 — Host ohne eigenen Signaling-Server: lokalen LAN-Server starten und
    // dessen Adresse bewerben, damit Beitretende sich OHNE den (oft toten)
    // öffentlichen y-webrtc-Default-Server finden. Beim Beitreten (adopt)
    // NICHT — dort kommt die Signaling-Adresse des Hosts aus der mDNS-Discovery.
    let localSignaling = false
    if (mode === 'webrtc' && !adopt && signalingList.length === 0 && hasDesktopBridge) {
      try {
        const { url } = await cablePlannerApi.signaling.start()
        // Lokaler Server zuerst (LAN); öffentlicher Default nur als Reserve,
        // wenn NICHT „nur lokal" gewählt ist.
        signalingList = localOnly ? [url] : [url, PUBLIC_SIGNALING_FALLBACK]
        localSignaling = true
      } catch {
        /* Kein lokaler Server möglich → öffentlicher y-webrtc-Default greift. */
      }
    }

    const pw = password.trim()
    // Nur ein WebRTC-Options-Objekt bauen, wenn es etwas zu setzen gibt
    // (Signaling und/oder Passwort). Das Passwort verschlüsselt den Raum E2E —
    // nur Peers mit demselben Passwort können das Projekt lesen.
    const webrtcOpts =
      signalingList.length > 0 || pw
        ? { ...(signalingList.length > 0 ? { signaling: signalingList } : {}), ...(pw ? { password: pw } : {}) }
        : undefined
    try {
      const s = await startCollaboration({
        mode,
        room,
        self,
        // Beitreten: eigenen Plan nicht ins Doc seeden → Host-Plan wird übernommen.
        seedDoc: !adopt,
        onPeers: (peers) => set({ peers }),
        webrtc: webrtcOpts,
      })
      // Falls der User zwischenzeitlich gestoppt/gewechselt hat: verwerfen.
      if (get().status !== 'connecting') {
        s.stop()
        if (localSignaling) void cablePlannerApi.signaling.stop().catch(() => {})
        return
      }
      set({ session: s, status: 'on', localSignaling })
      // #413 — Undo/Redo im Collab-Modus an den Session-UndoManager delegieren
      // (nimmt nur die eigenen Edits zurück). Wird in stop() wieder gelöst.
      setUndoDelegate({
        undo: s.undo,
        redo: s.redo,
        canUndo: s.canUndo,
        canRedo: s.canRedo,
      })
      // Nur der Host bewirbt die Session — mit der effektiven Signaling-Adresse
      // (lokaler Server-URL falls gestartet, sonst die manuelle Eingabe).
      if (mode === 'webrtc' && !adopt) {
        advertiseSession(room, name, localSignaling ? signalingList.join(',') : signaling)
      }
    } catch (err) {
      if (localSignaling) void cablePlannerApi.signaling.stop().catch(() => {})
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        session: null,
        peers: [],
        localSignaling: false,
      })
    }
  },

  stop: () => {
    const { session, localSignaling } = get()
    setUndoDelegate(null) // #413 — zurück auf lokale History
    session?.stop()
    unadvertiseSession()
    if (localSignaling) void cablePlannerApi.signaling.stop().catch(() => {})
    set({ session: null, status: 'off', error: undefined, peers: [], localSignaling: false })
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
    // Beitreten = Plan des Hosts übernehmen (eigenen Plan nicht ins Doc seeden;
    // der eingehende Host-Stand ersetzt den lokalen Plan).
    await get().start({ adopt: true })
  },
}))
