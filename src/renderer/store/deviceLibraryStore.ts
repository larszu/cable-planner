import { create } from 'zustand'
import { cablePlannerApi } from '../lib/bridge'
import { effectiveServer, loadCache, runSync } from '../lib/deviceLibrary'
import { useSettingsStore } from './settingsStore'
import {
  loadUploadStand,
  runUpload,
  saveUploadStand,
  type UploadBilanz,
  type UploadStand,
} from '../lib/deviceLibraryUpload'
import type { Namen } from '../lib/deviceLibraryItem'
import type { EquipmentTemplate } from '../types/equipment'
import type { LibraryUser } from '../lib/deviceLibraryClient'
import type {
  DeviceLibraryCache,
  DeviceLibraryErrorCode,
  DeviceLibrarySyncStats,
} from '../types/deviceLibrary'

/**
 * Geraetebibliothek — Sitzung und abgeglichener Stand.
 *
 * Kein Projekt-Zustand (der Stand gilt fuer die Installation, nicht fuer die
 * Datei) und kein Teil von `settingsStore` (dort steht nur die URL). Die
 * Server-URL wird jeder Aktion mitgegeben; der Store merkt sich, fuer welchen
 * Server `cache` gilt.
 */

export type DeviceLibrarySession = 'unknown' | 'signed-out' | 'signed-in' | 'unverified'

export interface DeviceLibraryFailure {
  code: DeviceLibraryErrorCode
  status?: number
  message?: string
}

interface DeviceLibraryState {
  session: DeviceLibrarySession
  user: LibraryUser | null
  cache: DeviceLibraryCache
  syncing: boolean
  lastSync: (DeviceLibrarySyncStats & { persisted: boolean }) | null
  lastError: DeviceLibraryFailure | null
  /** Den gespeicherten Stand fuer `server` laden (beim Start, nach URL-Wechsel). */
  loadFor: (server: string) => void
  /** Fragt den Server, ob das gespeicherte Token noch gilt. */
  refreshSession: (server: string) => Promise<void>
  setSignedIn: (user: LibraryUser) => void
  signOut: (server: string) => Promise<void>
  sync: (server: string) => Promise<void>
  /** Was von den eigenen Vorlagen hochgeladen ist — je Vorlage, persistent. */
  uploads: UploadStand
  uploading: boolean
  lastUpload: UploadBilanz | null
  uploadError: DeviceLibraryFailure | null
  /** Hersteller/Modell einer Vorlage festlegen (gilt fuer jedes weitere Hochladen). */
  setNames: (server: string, templateName: string, names: Namen) => void
  /** Erst hoch (was sich geaendert hat), dann runter (`sync`). */
  syncNow: (server: string, bibliothek: readonly EquipmentTemplate[]) => Promise<void>
}

export const useDeviceLibraryStore = create<DeviceLibraryState>((set, get) => ({
  session: 'unknown',
  user: null,
  // Beim Start schon der gespeicherte Stand: die Geraete sind offline da,
  // bevor jemand die Einstellungen oeffnet.
  cache: loadCache(effectiveServer(useSettingsStore.getState().deviceLibraryUrl)),
  syncing: false,
  lastSync: null,
  lastError: null,
  uploads: loadUploadStand(effectiveServer(useSettingsStore.getState().deviceLibraryUrl)),
  uploading: false,
  lastUpload: null,
  uploadError: null,

  loadFor: (server) => {
    if (get().cache.server === server) return
    set({
      cache: loadCache(server),
      uploads: loadUploadStand(server),
      lastSync: null,
      lastError: null,
      lastUpload: null,
      uploadError: null,
    })
  },

  setNames: (server, templateName, names) => {
    get().loadFor(server)
    const uploads = { ...get().uploads, namen: { ...get().uploads.namen, [templateName]: names } }
    saveUploadStand(uploads)
    set({ uploads })
  },

  syncNow: async (server, bibliothek) => {
    if (get().uploading || get().syncing) return
    get().loadFor(server)
    set({ uploading: true, uploadError: null })
    try {
      const r = await runUpload(cablePlannerApi.deviceLibrary, server, bibliothek)
      if (r.ok) set({ uploads: r.stand, lastUpload: r.bilanz })
      else {
        set({
          uploadError: { code: r.code, status: r.status, message: r.message },
          ...(r.code === 'not-signed-in' ? { session: 'signed-out' as const, user: null } : {}),
        })
        // Offline oder abgemeldet: runter geht dann auch nicht.
        if (r.code === 'offline' || r.code === 'not-signed-in') return
      }
    } finally {
      set({ uploading: false })
    }
    await get().sync(server)
  },

  refreshSession: async (server) => {
    if (!(await cablePlannerApi.deviceLibrary.hasToken())) {
      set({ session: 'signed-out', user: null })
      return
    }
    const r = await cablePlannerApi.deviceLibrary.currentUser(server)
    if (r.ok) {
      set(r.value ? { session: 'signed-in', user: r.value } : { session: 'signed-out', user: null })
      return
    }
    // Offline oder Serverfehler: das Token ist da, nur nicht bestaetigt. Der
    // gespeicherte Stand bleibt nutzbar; abgemeldet wird deshalb nicht.
    set({ session: r.code === 'not-signed-in' ? 'signed-out' : 'unverified', user: null })
  },

  setSignedIn: (user) => set({ session: 'signed-in', user, lastError: null }),

  signOut: async (server) => {
    await cablePlannerApi.deviceLibrary.signOut(server)
    set({ session: 'signed-out', user: null })
  },

  sync: async (server) => {
    if (get().syncing) return
    get().loadFor(server)
    set({ syncing: true, lastError: null })
    try {
      const r = await runSync(cablePlannerApi.deviceLibrary, server)
      if (!r.ok) {
        set({
          lastError: { code: r.code, status: r.status, message: r.message },
          ...(r.code === 'not-signed-in' ? { session: 'signed-out' as const, user: null } : {}),
        })
        return
      }
      set({ cache: r.cache, lastSync: { ...r.stats, persisted: r.persisted } })
    } finally {
      set({ syncing: false })
    }
  },
}))
