import { create } from 'zustand'

export type EdgeRouting = 'orthogonal' | 'straight' | 'curved'

const KEY = 'cable-planner:ui'

interface PersistedUiState {
  propertiesCollapsed: boolean
  libraryCollapsed: boolean
  snapToGrid: boolean
  gridSize: number
  defaultRouting: EdgeRouting
  defaultArrow: boolean
}

const defaults: PersistedUiState = {
  propertiesCollapsed: false,
  libraryCollapsed: false,
  snapToGrid: true,
  gridSize: 10,
  defaultRouting: 'orthogonal',
  defaultArrow: true,
}

const load = (): PersistedUiState => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults
    return { ...defaults, ...(JSON.parse(raw) as Partial<PersistedUiState>) }
  } catch {
    return defaults
  }
}

const persist = (state: PersistedUiState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

interface UiState extends PersistedUiState {
  togglePropertiesCollapsed: () => void
  toggleLibraryCollapsed: () => void
  setSnapToGrid: (value: boolean) => void
  setGridSize: (value: number) => void
  setDefaultRouting: (value: EdgeRouting) => void
  setDefaultArrow: (value: boolean) => void
}

const applyPatch =
  (patch: Partial<PersistedUiState>) =>
  (state: UiState): Partial<UiState> => {
    const next: PersistedUiState = {
      propertiesCollapsed: state.propertiesCollapsed,
      libraryCollapsed: state.libraryCollapsed,
      snapToGrid: state.snapToGrid,
      gridSize: state.gridSize,
      defaultRouting: state.defaultRouting,
      defaultArrow: state.defaultArrow,
      ...patch,
    }
    persist(next)
    return next
  }

export const useUiStore = create<UiState>((set) => ({
  ...load(),
  togglePropertiesCollapsed: () =>
    set((state) => applyPatch({ propertiesCollapsed: !state.propertiesCollapsed })(state)),
  toggleLibraryCollapsed: () =>
    set((state) => applyPatch({ libraryCollapsed: !state.libraryCollapsed })(state)),
  setSnapToGrid: (value) => set(applyPatch({ snapToGrid: value })),
  setGridSize: (value) => set(applyPatch({ gridSize: Math.max(2, Math.min(100, value)) })),
  setDefaultRouting: (value) => set(applyPatch({ defaultRouting: value })),
  setDefaultArrow: (value) => set(applyPatch({ defaultArrow: value })),
}))
