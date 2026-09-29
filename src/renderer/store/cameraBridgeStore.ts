/**
 * Was die LZ Camera Bridge dieses Raums gerade meldet — Beobachtungen, keine
 * Planangaben (Invariante 14): nichts davon geht in den projectStore, nichts
 * wird gespeichert. Eine Bruecke je Sitzung; der Store haengt sich EINMAL an
 * die Ereignisse der API und spiegelt die Nachrichten, die die Bruecke von
 * sich aus schickt (`cameras`, `switchers`, `cameraTally`, `pose`,
 * `plannedProgress`, `error`).
 */
import { create } from 'zustand'
import { cablePlannerApi } from '../lib/bridge'

export interface BridgeCameraSlot {
  cameraNumber: number
  connected: boolean
  config: Record<string, unknown> & { label?: string; streamUrl?: string; switcherInput?: number; poseOffset?: { pan: number; tilt: number } }
  plan?: { label: string; presets?: { number: number; name: string; pan: number; tilt: number; focalMm?: number }[] }
}

export interface BridgePose { pan: number; tilt: number; zoom?: number }

export interface PlannedProgress {
  presetNumber: number
  step: 'driving' | 'stored' | 'failed' | 'done'
  message?: string
  fit?: string
  at: number
}

interface CameraBridgeState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected'
  address: { host: string; port: number } | null
  cameras: Record<number, BridgeCameraSlot>
  switchersConnected: number
  cameraTally: Record<number, 'program' | 'preview' | 'off'>
  poses: Record<number, BridgePose>
  progress: Record<number, PlannedProgress>
  lastError: string | null
  attached: boolean
  attach: () => void
  connect: (address: { host: string; port: number }) => Promise<{ ok: boolean; message: string }>
  disconnect: () => Promise<void>
  send: (msg: { type: string } & Record<string, unknown>) => Promise<{ ok: boolean; message: string }>
  clearError: () => void
}

export const useCameraBridgeStore = create<CameraBridgeState>((set, get) => ({
  status: 'idle',
  address: null,
  cameras: {},
  switchersConnected: 0,
  cameraTally: {},
  poses: {},
  progress: {},
  lastError: null,
  attached: false,
  attach: () => {
    if (get().attached) return
    set({ attached: true })
    cablePlannerApi.camera.onEvent((msg) => {
      switch (msg.type) {
        case 'bridge':
          set({
            status: msg.status === 'connected' ? 'connected' : 'disconnected',
            address: msg.status === 'connected' ? (msg.address as { host: string; port: number }) : get().address,
            ...(msg.status === 'connected' ? {} : { cameras: {}, cameraTally: {}, poses: {}, switchersConnected: 0 }),
          })
          break
        case 'cameras': {
          const rec: Record<number, BridgeCameraSlot> = {}
          for (const c of msg.cameras as BridgeCameraSlot[]) rec[c.cameraNumber] = c
          set({ cameras: rec })
          break
        }
        case 'switchers':
          set({ switchersConnected: (msg.switchers as { connected: boolean }[]).filter((s) => s.connected).length })
          break
        case 'cameraTally':
          set({ cameraTally: msg.tally as Record<number, 'program' | 'preview' | 'off'> })
          break
        case 'pose':
          set((s) => ({ poses: { ...s.poses, [msg.cameraNumber as number]: msg.pose as BridgePose } }))
          break
        case 'plannedProgress':
          set((s) => ({
            progress: {
              ...s.progress,
              [msg.cameraNumber as number]: {
                presetNumber: msg.presetNumber as number,
                step: msg.step as PlannedProgress['step'],
                message: msg.message as string | undefined,
                fit: msg.fit as string | undefined,
                at: Date.now(),
              },
            },
          }))
          break
        case 'error':
          set({ lastError: String(msg.message ?? 'error') })
          break
        default:
          break
      }
    })
    void cablePlannerApi.camera.status().then((st) => {
      if (st.connected) set({ status: 'connected', address: st.address })
    })
  },
  connect: async (address) => {
    get().attach()
    set({ status: 'connecting', lastError: null })
    const r = await cablePlannerApi.camera.connect(address)
    if (!r.ok) set({ status: 'disconnected', lastError: r.message })
    else set({ status: 'connected', address })
    return r
  },
  disconnect: async () => {
    await cablePlannerApi.camera.disconnect()
    set({ status: 'disconnected', cameras: {}, cameraTally: {}, poses: {} })
  },
  send: (msg) => cablePlannerApi.camera.send(msg),
  clearError: () => set({ lastError: null }),
}))
