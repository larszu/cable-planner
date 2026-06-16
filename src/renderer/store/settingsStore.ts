import { create } from 'zustand'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { LIMITS } from '../lib/layoutConstants'
import {
  type ModuleId,
  DEFAULT_ENABLED,
  healEnabledModules,
  enabledFromPresets,
  type PresetId,
} from '../lib/modules'

const SETTINGS_KEY = STORAGE_KEYS.settings

/**
 * Einmalige Rentman-Migration: `rentmanEnabled` lebte früher im uiStore
 * (`cable-planner:ui`). Beim Übergang aufs Modul-System lesen wir den Alt-Wert
 * einmal aus, damit bestehende Nutzer ihre Rentman-Einstellung behalten.
 * Liefert null, wenn kein Alt-Wert existiert.
 */
const readLegacyRentmanEnabled = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ui)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { rentmanEnabled?: unknown }
    return typeof parsed.rentmanEnabled === 'boolean' ? parsed.rentmanEnabled : null
  } catch {
    return null
  }
}

interface PersistedSettings {
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  /** Festinstallation — Name des aktuellen Bearbeiters. Wird Änderungs-
   *  protokoll- und Service-Einträgen als Autor zugeordnet. App-weit
   *  (pro Maschine) persistiert, nicht pro Projekt. */
  editorName: string
  /** Modulares UI — welche Funktionsmodule sichtbar sind (pro Installation). */
  enabledModules: Record<ModuleId, boolean>
  /** Modulares UI — true, sobald der Erststart-Modul-Dialog beantwortet/
   *  übersprungen wurde (steuert, ob er nochmal erscheint). */
  onboardingDone: boolean
}

const defaults: PersistedSettings = {
  autosaveIntervalMs: 400,
  sharedSyncPath: '',
  sharedSyncUser: '',
  editorName: '',
  enabledModules: { ...DEFAULT_ENABLED },
  onboardingDone: false,
}

const load = (): PersistedSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      autosaveIntervalMs:
        typeof parsed.autosaveIntervalMs === 'number'
          ? Math.max(LIMITS.AUTOSAVE_INTERVAL.MIN_MS, Math.min(LIMITS.AUTOSAVE_INTERVAL.MAX_MS, Math.round(parsed.autosaveIntervalMs)))
          : defaults.autosaveIntervalMs,
      sharedSyncPath: typeof parsed.sharedSyncPath === 'string' ? parsed.sharedSyncPath : defaults.sharedSyncPath,
      sharedSyncUser: typeof parsed.sharedSyncUser === 'string' ? parsed.sharedSyncUser : defaults.sharedSyncUser,
      editorName: typeof parsed.editorName === 'string' ? parsed.editorName : defaults.editorName,
      enabledModules: (() => {
        const e = healEnabledModules(parsed.enabledModules)
        // Rentman noch nicht im Modul-System gespeichert → Alt-Wert übernehmen.
        if (parsed.enabledModules?.rentman === undefined) {
          const legacy = readLegacyRentmanEnabled()
          if (legacy !== null) e.rentman = legacy
        }
        return e
      })(),
      // Bestehende Installationen (Settings vorhanden, aber noch ohne dieses
      // Feld) gelten als „onboarded" → kein nachträglicher Dialog für sie.
      onboardingDone:
        typeof parsed.onboardingDone === 'boolean' ? parsed.onboardingDone : true,
    }
  } catch {
    return defaults
  }
}

const persist = (state: PersistedSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/** Pickt die persistierten Felder aus dem Store-State (gegen Persist-Drift,
 *  wenn neue Felder dazukommen). */
const snapshot = (s: PersistedSettings): PersistedSettings => ({
  autosaveIntervalMs: s.autosaveIntervalMs,
  sharedSyncPath: s.sharedSyncPath,
  sharedSyncUser: s.sharedSyncUser,
  editorName: s.editorName,
  enabledModules: s.enabledModules,
  onboardingDone: s.onboardingDone,
})

interface SettingsState {
  // NOTE: the actual token string is intentionally NOT stored here to avoid
  // leaking it into global React state. Use the IPC credentials API directly.
  tokenStatus: string
  hasToken: boolean
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  editorName: string
  enabledModules: Record<ModuleId, boolean>
  onboardingDone: boolean
  setHasToken: (value: boolean) => void
  setTokenStatus: (value: string) => void
  setAutosaveIntervalMs: (value: number) => void
  setSyncPath: (value: string) => void
  setSyncUser: (value: string) => void
  setEditorName: (value: string) => void
  /** Ein einzelnes Modul ein-/ausschalten. */
  setModuleEnabled: (id: ModuleId, value: boolean) => void
  /** Module aus einer Preset-Auswahl setzen (Erststart-Onboarding). */
  applyModulePreset: (presetIds: PresetId[]) => void
  /** Erststart-Modul-Dialog als erledigt markieren. */
  setOnboardingDone: (value: boolean) => void
}

const initial = load()

export const useSettingsStore = create<SettingsState>((set) => ({
  tokenStatus: 'No token configured',
  hasToken: false,
  autosaveIntervalMs: initial.autosaveIntervalMs,
  sharedSyncPath: initial.sharedSyncPath,
  sharedSyncUser: initial.sharedSyncUser,
  editorName: initial.editorName,
  enabledModules: initial.enabledModules,
  onboardingDone: initial.onboardingDone,
  setHasToken: (value) => set({ hasToken: value }),
  setTokenStatus: (value) => set({ tokenStatus: value }),
  setAutosaveIntervalMs: (value) =>
    set((state) => {
      const next = Math.max(LIMITS.AUTOSAVE_INTERVAL.MIN_MS, Math.min(LIMITS.AUTOSAVE_INTERVAL.MAX_MS, Math.round(value || defaults.autosaveIntervalMs)))
      persist(snapshot({ ...state, autosaveIntervalMs: next }))
      return { autosaveIntervalMs: next }
    }),
  setSyncPath: (value) =>
    set((state) => {
      persist(snapshot({ ...state, sharedSyncPath: value }))
      return { sharedSyncPath: value }
    }),
  setSyncUser: (value) =>
    set((state) => {
      persist(snapshot({ ...state, sharedSyncUser: value }))
      return { sharedSyncUser: value }
    }),
  setEditorName: (value) =>
    set((state) => {
      persist(snapshot({ ...state, editorName: value }))
      return { editorName: value }
    }),
  setModuleEnabled: (id, value) =>
    set((state) => {
      const enabledModules = { ...state.enabledModules, [id]: value }
      persist(snapshot({ ...state, enabledModules }))
      return { enabledModules }
    }),
  applyModulePreset: (presetIds) =>
    set((state) => {
      const enabledModules = enabledFromPresets(presetIds)
      persist(snapshot({ ...state, enabledModules }))
      return { enabledModules }
    }),
  setOnboardingDone: (value) =>
    set((state) => {
      persist(snapshot({ ...state, onboardingDone: value }))
      return { onboardingDone: value }
    }),
}))

/** Hook für konditionales Rendern: ist dieses Modul aktiv? */
export const useModule = (id: ModuleId): boolean =>
  useSettingsStore((s) => s.enabledModules[id])
