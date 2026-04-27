import { create } from 'zustand'

const SETTINGS_KEY = 'cable-planner:settings'

interface PersistedSettings {
  autosaveIntervalMs: number
}

const defaults: PersistedSettings = {
  autosaveIntervalMs: 400,
}

const load = (): PersistedSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      autosaveIntervalMs:
        typeof parsed.autosaveIntervalMs === 'number'
          ? Math.max(100, Math.min(30000, Math.round(parsed.autosaveIntervalMs)))
          : defaults.autosaveIntervalMs,
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
  setHasToken: (value: boolean) => void
  setTokenStatus: (value: string) => void
  setAutosaveIntervalMs: (value: number) => void
}

const initial = load()

export const useSettingsStore = create<SettingsState>((set) => ({
  tokenStatus: 'No token configured',
  hasToken: false,
  autosaveIntervalMs: initial.autosaveIntervalMs,
  setHasToken: (value) => set({ hasToken: value }),
  setTokenStatus: (value) => set({ tokenStatus: value }),
  setAutosaveIntervalMs: (value) =>
    set(() => {
      const next = Math.max(100, Math.min(30000, Math.round(value || defaults.autosaveIntervalMs)))
      persist({ autosaveIntervalMs: next })
      return { autosaveIntervalMs: next }
    }),
}))
