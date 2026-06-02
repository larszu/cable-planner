// #413/#471 — Presence/Awareness: WER ist im Raum?
//
// Die CRDT-Schicht (projectCrdt) synchronisiert die Plan-DATEN; Presence
// beantwortet die orthogonale Frage „wer bearbeitet gerade mit?". Das macht
// Kollaboration sichtbar (Avatare/Anzahl) und Beitreten nachvollziehbar (#471).
//
// Zwei Implementierungen, je Transport:
//   • Broadcast-Mode: eigene BroadcastChannel `…:presence:<room>` mit
//     Heartbeat — funktioniert Server-frei zwischen Fenstern derselben
//     Maschine und ist headless testbar.
//   • WebRTC-Mode: die `awareness` des y-webrtc-Providers (Cross-Maschine).
//
// Beide liefern dasselbe `PresencePeer[]` an den Aufrufer (collabStore).

export interface PresencePeer {
  /** Stabile Peer-Id (pro Tab/Instanz). */
  id: string
  name: string
  color: string
  /** true für den lokalen Nutzer. */
  self?: boolean
}

export interface PresenceHandle {
  stop: () => void
}

export interface SelfInfo {
  id: string
  name: string
  color: string
}

const HEARTBEAT_MS = 2500
const STALE_MS = 7000

const COLORS = [
  '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
]

/** Deterministische Farbe aus einer Id — gleiche Id ⇒ gleiche Farbe. */
export const colorForId = (id: string): string => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

interface PresenceMsg {
  type: 'hello' | 'heartbeat' | 'bye'
  id: string
  name: string
  color: string
}

/** Broadcast-Mode-Presence über eine dedizierte BroadcastChannel. */
export const startBroadcastPresence = (
  room: string,
  self: SelfInfo,
  onPeers: (peers: PresencePeer[]) => void,
): PresenceHandle => {
  const channel = new BroadcastChannel(`cable-planner:presence:${room}`)
  const peers = new Map<string, { name: string; color: string; ts: number }>()

  const emit = (): void => {
    const now = Date.now()
    const list: PresencePeer[] = [{ ...self, self: true }]
    for (const [id, p] of peers) {
      if (now - p.ts < STALE_MS) list.push({ id, name: p.name, color: p.color })
    }
    onPeers(list)
  }

  const send = (type: PresenceMsg['type']): void => {
    channel.postMessage({ type, id: self.id, name: self.name, color: self.color } satisfies PresenceMsg)
  }

  channel.onmessage = (ev: MessageEvent) => {
    const m = ev.data as PresenceMsg
    if (!m || typeof m !== 'object' || m.id === self.id) return
    if (m.type === 'bye') {
      peers.delete(m.id)
      emit()
      return
    }
    const isNew = !peers.has(m.id)
    peers.set(m.id, { name: m.name, color: m.color, ts: Date.now() })
    // Neuem Peer (oder auf 'hello') sofort die eigene Existenz zurückmelden,
    // damit beide Seiten sich ohne Heartbeat-Verzögerung sehen.
    if (m.type === 'hello' || isNew) send('heartbeat')
    emit()
  }

  send('hello')
  emit()

  const hb = window.setInterval(() => {
    const now = Date.now()
    let changed = false
    for (const [id, p] of peers) {
      if (now - p.ts >= STALE_MS) {
        peers.delete(id)
        changed = true
      }
    }
    send('heartbeat')
    if (changed) emit()
  }, HEARTBEAT_MS)

  return {
    stop: () => {
      window.clearInterval(hb)
      try {
        send('bye')
      } catch {
        /* channel kann bereits zu sein */
      }
      channel.onmessage = null
      channel.close()
    },
  }
}

/** Minimaler Ausschnitt der y-protocols `Awareness`-API, den wir nutzen. */
export interface AwarenessLike {
  clientID: number
  setLocalStateField: (field: string, value: unknown) => void
  getStates: () => Map<number, Record<string, unknown>>
  on: (event: 'change', cb: () => void) => void
  off: (event: 'change', cb: () => void) => void
}

/** WebRTC-Mode-Presence über die Provider-`awareness`. */
export const startAwarenessPresence = (
  awareness: AwarenessLike,
  self: SelfInfo,
  onPeers: (peers: PresencePeer[]) => void,
): PresenceHandle => {
  awareness.setLocalStateField('user', { id: self.id, name: self.name, color: self.color })
  const update = (): void => {
    const list: PresencePeer[] = []
    for (const [clientId, st] of awareness.getStates()) {
      const u = st.user as { id?: string; name?: string; color?: string } | undefined
      if (!u) continue
      const id = u.id ?? String(clientId)
      list.push({
        id,
        name: u.name ?? 'Peer',
        color: u.color ?? colorForId(id),
        self: clientId === awareness.clientID,
      })
    }
    onPeers(list)
  }
  awareness.on('change', update)
  update()
  return { stop: () => awareness.off('change', update) }
}
