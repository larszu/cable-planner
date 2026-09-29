/**
 * Green-GO live: was das Geraet gerade meldet. Beobachtung, nie Projekt
 * (Invariante 14). Eine Verbindung je Sitzung.
 */
import { create } from 'zustand'
import { cablePlannerApi } from '../lib/bridge'
import { applyGreengoState, emptyGreengoState, type GreengoState } from '../lib/greengoLive'

interface GreengoLive {
  connected: boolean
  host: string | null
  state: GreengoState
  lastError: string | null
  attached: boolean
  attach: () => void
  connect: (host: string, port: number) => Promise<void>
  disconnect: () => Promise<void>
  send: (path: string, args: number[]) => Promise<void>
}

export const useGreengoLiveStore = create<GreengoLive>((set, get) => ({
  connected: false,
  host: null,
  state: emptyGreengoState(),
  lastError: null,
  attached: false,
  attach: () => {
    if (get().attached) return
    set({ attached: true })
    cablePlannerApi.greengo.onEvent((msg) => {
      if (msg.type === 'status') set({ connected: Boolean(msg.connected), host: (msg.host as string) ?? null, ...(msg.connected ? {} : { state: emptyGreengoState() }) })
      else if (msg.type === 'osc') set((s) => ({ state: applyGreengoState(s.state, String(msg.address), msg.args as number[], Number(msg.at)) }))
      else if (msg.type === 'error') set({ lastError: String(msg.message) })
    })
  },
  connect: async (host, port) => {
    get().attach()
    set({ lastError: null })
    const r = await cablePlannerApi.greengo.connect({ host, port })
    if (!r.ok) set({ lastError: r.message })
  },
  disconnect: async () => {
    await cablePlannerApi.greengo.disconnect()
  },
  send: async (path, args) => {
    const r = await cablePlannerApi.greengo.send(path, args)
    if (!r.ok) set({ lastError: r.message })
  },
}))
