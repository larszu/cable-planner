import { create } from 'zustand'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { LIMITS } from '../lib/layoutConstants'

const SETTINGS_KEY = STORAGE_KEYS.settings

interface PersistedSettings {
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  /** Festinstallation — Name des aktuellen Bearbeiters. Wird Änderungs-
   *  protokoll- und Service-Einträgen als Autor zugeordnet. App-weit
   *  (pro Maschine) persistiert, nicht pro Projekt. */
  editorName: string
}

const defaults: PersistedSettings = {
  autosaveIntervalMs: 400,
  sharedSyncPath: '',
  sharedSyncUser: '',
  editorName: '',
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

interface SettingsState {
  // NOTE: the actual token string is intentionally NOT stored here to avoid
  // leaking it into global React state. Use the IPC credentials API directly.
  tokenStatus: string
  hasToken: boolean
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  editorName: string
  setHasToken: (value: boolean) => void
  setTokenStatus: (value: string) => void
  setAutosaveIntervalMs: (value: number) => void
  setSyncPath: (value: string) => void
  setSyncUser: (value: string) => void
  setEditorName: (value: string) => void
}

const initial = load()

export const useSettingsStore = create<SettingsState>((set) => ({
  tokenStatus: 'No token configured',
  hasToken: false,
  autosaveIntervalMs: initial.autosaveIntervalMs,
  sharedSyncPath: initial.sharedSyncPath,
  sharedSyncUser: initial.sharedSyncUser,
  editorName: initial.editorName,
  setHasToken: (value) => set({ hasToken: value }),
  setTokenStatus: (value) => set({ tokenStatus: value }),
  setAutosaveIntervalMs: (value) =>
    set((state) => {
      const next = Math.max(LIMITS.AUTOSAVE_INTERVAL.MIN_MS, Math.min(LIMITS.AUTOSAVE_INTERVAL.MAX_MS, Math.round(value || defaults.autosaveIntervalMs)))
      persist({ autosaveIntervalMs: next, sharedSyncPath: state.sharedSyncPath, sharedSyncUser: state.sharedSyncUser, editorName: state.editorName })
      return { autosaveIntervalMs: next }
    }),
  setSyncPath: (value) =>
    set((state) => {
      persist({ autosaveIntervalMs: state.autosaveIntervalMs, sharedSyncPath: value, sharedSyncUser: state.sharedSyncUser, editorName: state.editorName })
      return { sharedSyncPath: value }
    }),
  setSyncUser: (value) =>
    set((state) => {
      persist({ autosaveIntervalMs: state.autosaveIntervalMs, sharedSyncPath: state.sharedSyncPath, sharedSyncUser: value, editorName: state.editorName })
      return { sharedSyncUser: value }
    }),
  setEditorName: (value) =>
    set((state) => {
      persist({ autosaveIntervalMs: state.autosaveIntervalMs, sharedSyncPath: state.sharedSyncPath, sharedSyncUser: state.sharedSyncUser, editorName: value })
      return { editorName: value }
    }),
}))
