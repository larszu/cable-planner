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
  libraryWidth: number
  propertiesWidth: number
  /** Whether cable color on the canvas is derived from the manually set color
   * or from the standard length-color coding. */
  cableColorMode: 'manual' | 'byLength'
}

const defaults: PersistedUiState = {
  propertiesCollapsed: false,
  libraryCollapsed: false,
  snapToGrid: true,
  gridSize: 10,
  defaultRouting: 'orthogonal',
  defaultArrow: true,
  libraryWidth: 260,
  propertiesWidth: 280,
  cableColorMode: 'manual',
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
  setLibraryWidth: (value: number) => void
  setPropertiesWidth: (value: number) => void
  setCableColorMode: (value: 'manual' | 'byLength') => void
  cableEdit: { open: boolean; cableId?: string }
  openCableEdit: (cableId: string) => void
  closeCableEdit: () => void
  videohubExport: { open: boolean; deviceId?: string; initialShowMatrix?: boolean }
  openVideohubExport: (deviceId?: string, initialShowMatrix?: boolean) => void
  closeVideohubExport: () => void
  greengoExport: { open: boolean }
  openGreenGoExport: () => void
  closeGreenGoExport: () => void
  atemDialog: { open: boolean; deviceId?: string }
  openAtemDialog: (deviceId?: string) => void
  closeAtemDialog: () => void
  atemMvLayout: { open: boolean }
  openAtemMvLayout: () => void
  closeAtemMvLayout: () => void
  atemMvConfig: { open: boolean; deviceId?: string }
  openAtemMvConfig: (deviceId?: string) => void
  closeAtemMvConfig: () => void
  /** Rentman equipment import dialog (cross-component trigger). */
  rentmanImport: { open: boolean }
  openRentmanImport: () => void
  closeRentmanImport: () => void
  /** Rentman cable export dialog (push canvas cable BOM to Rentman). */
  rentmanCableExport: { open: boolean }
  openRentmanCableExport: () => void
  closeRentmanCableExport: () => void
  /**
   * When the user is drawing a cable by clicking (draw.io-style), this holds
   * the start handle and the list of waypoints the user has placed on the
   * pane so far. `null` while no cable is being drawn.
   */
  pendingCable: {
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
    waypoints: { x: number; y: number }[]
  } | null
  startPendingCable: (start: { nodeId: string; handleId: string; handleType: 'source' | 'target' }) => void
  addPendingWaypoint: (pt: { x: number; y: number }) => void
  clearPendingCable: () => void
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
      libraryWidth: state.libraryWidth,
      propertiesWidth: state.propertiesWidth,
      cableColorMode: state.cableColorMode,
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
  setLibraryWidth: (value) =>
    set(applyPatch({ libraryWidth: Math.max(180, Math.min(600, Math.round(value))) })),
  setPropertiesWidth: (value) =>
    set(applyPatch({ propertiesWidth: Math.max(220, Math.min(600, Math.round(value))) })),
  setCableColorMode: (value) => set(applyPatch({ cableColorMode: value })),
  cableEdit: { open: false },
  openCableEdit: (cableId) => set({ cableEdit: { open: true, cableId } }),
  closeCableEdit: () => set({ cableEdit: { open: false } }),
  videohubExport: { open: false },
  openVideohubExport: (deviceId, initialShowMatrix) => set({ videohubExport: { open: true, deviceId, initialShowMatrix } }),
  closeVideohubExport: () => set({ videohubExport: { open: false } }),
  greengoExport: { open: false },
  openGreenGoExport: () => set({ greengoExport: { open: true } }),
  closeGreenGoExport: () => set({ greengoExport: { open: false } }),
  atemDialog: { open: false },
  openAtemDialog: (deviceId) => set({ atemDialog: { open: true, deviceId } }),
  closeAtemDialog: () => set({ atemDialog: { open: false } }),
  atemMvLayout: { open: false },
  openAtemMvLayout: () => set({ atemMvLayout: { open: true } }),
  closeAtemMvLayout: () => set({ atemMvLayout: { open: false } }),
  atemMvConfig: { open: false },
  openAtemMvConfig: (deviceId) => set({ atemMvConfig: { open: true, deviceId } }),
  closeAtemMvConfig: () => set({ atemMvConfig: { open: false } }),
  rentmanImport: { open: false },
  openRentmanImport: () => set({ rentmanImport: { open: true } }),
  closeRentmanImport: () => set({ rentmanImport: { open: false } }),
  rentmanCableExport: { open: false },
  openRentmanCableExport: () => set({ rentmanCableExport: { open: true } }),
  closeRentmanCableExport: () => set({ rentmanCableExport: { open: false } }),
  pendingCable: null,
  startPendingCable: (start) =>
    set({ pendingCable: { ...start, waypoints: [] } }),
  addPendingWaypoint: (pt) =>
    set((state) =>
      state.pendingCable
        ? { pendingCable: { ...state.pendingCable, waypoints: [...state.pendingCable.waypoints, pt] } }
        : state,
    ),
  clearPendingCable: () => set({ pendingCable: null }),
}))
