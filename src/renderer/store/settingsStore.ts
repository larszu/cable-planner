import { create } from 'zustand'

interface SettingsState {
  token: string
  tokenStatus: string
  hasToken: boolean
  setToken: (value: string) => void
  setHasToken: (value: boolean) => void
  setTokenStatus: (value: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  token: '',
  tokenStatus: 'No token configured',
  hasToken: false,
  setToken: (value) => set({ token: value }),
  setHasToken: (value) => set({ hasToken: value }),
  setTokenStatus: (value) => set({ tokenStatus: value }),
}))
