import { create } from 'zustand'

export type EdgeRouting = 'orthogonal' | 'straight' | 'curved'
export type Language = 'de' | 'en'

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
  /** Canvas background theme. */
  canvasTheme: 'dark' | 'light'
  /** When true, port handle dots on equipment nodes are rendered in the
   * color associated with their connector type (SDI = amber, HDMI = purple,
   * Ethernet = green, …). When false, the input/output dichotomy palette
   * is used (cyan for inputs, green for outputs, purple for bidirectional). */
  colorPortsByType: boolean
  /** UI language. Coverage is partial today — see lib/i18n.ts. Defaults to
   *  German because that's the historical UI language of the codebase. */
  language: Language
  /** Issue #70: When true the cable dialog will not block creation on
   *  connector-type incompatibilities — the user can connect any input
   *  to any output without the "needs converter" confirmation prompt.
   *  The cable is still flagged needsConverter for downstream warnings,
   *  it just doesn't interrupt the user mid-flow. */
  overrideConnectionWarnings: boolean
  /** Issue #62: per-connector-type colour overrides. When a connector
   *  type is missing or its value is an empty string the built-in
   *  default from DEFAULT_CONNECTOR_TYPE_COLORS applies. Stored sparsely
   *  so we don't bloat localStorage with the full default palette. */
  connectorTypeColors: Record<string, string>
  /** Issue #71: canvas background pattern variant. 'dots' draws the
   *  ReactFlow dot grid (default), 'lines' draws orthogonal lines,
   *  'cross' draws a + at each grid intersection, 'none' disables. */
  bgVariant: 'dots' | 'lines' | 'cross' | 'none'
  /** Background grid opacity 0..1. Lower values make the dots/lines
   *  fainter — useful when zooming way out on large diagrams. */
  bgOpacity: number
  /** Issue #64: user-defined cable specs persisted across sessions.
   *  Each entry has the same shape as a built-in CableSpec but its
   *  `id` is prefixed with 'custom-cable:' so the cable dialog can
   *  visually distinguish them. They show up in the dropdown next
   *  to the built-in catalog and can be re-edited / deleted from
   *  Settings. */
  customCableSpecs: import('../types/cableSpec').CableSpec[]
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
  canvasTheme: 'dark',
  colorPortsByType: false,
  language: 'de',
  overrideConnectionWarnings: false,
  connectorTypeColors: {},
  bgVariant: 'dots',
  bgOpacity: 0.5,
  customCableSpecs: [],
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
  setCanvasTheme: (value: 'dark' | 'light') => void
  setColorPortsByType: (value: boolean) => void
  setLanguage: (value: Language) => void
  setOverrideConnectionWarnings: (value: boolean) => void
  setConnectorTypeColor: (connectorType: string, color: string | null) => void
  resetConnectorTypeColors: () => void
  setBgVariant: (value: 'dots' | 'lines' | 'cross' | 'none') => void
  setBgOpacity: (value: number) => void
  /** Add a new custom cable spec. The store assigns a `custom-cable:`
   *  id automatically; if a spec with the same name already exists
   *  it's replaced (so re-saving keeps the library clean). */
  addCustomCableSpec: (spec: Omit<import('../types/cableSpec').CableSpec, 'id'>) => import('../types/cableSpec').CableSpec
  /** Patch an existing custom spec in place. No-op if `id` doesn't
   *  start with 'custom-cable:' — built-ins are read-only. */
  updateCustomCableSpec: (
    id: string,
    patch: Partial<Omit<import('../types/cableSpec').CableSpec, 'id'>>,
  ) => void
  removeCustomCableSpec: (id: string) => void
  pdfExportThemeOverride: 'dark' | 'light' | null
  setPdfExportThemeOverride: (value: 'dark' | 'light' | null) => void
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
  /** Issue #45 — ATEM Fairlight audio router dialog. */
  atemAudioConfig: { open: boolean; deviceId?: string }
  openAtemAudioConfig: (deviceId?: string) => void
  closeAtemAudioConfig: () => void
  /** Issue #39 — frame-scoped BOM export dialog. */
  locationBom: { open: boolean; locationId?: string }
  openLocationBom: (locationId: string) => void
  closeLocationBom: () => void
  /** Rentman equipment import dialog (cross-component trigger). */
  rentmanImport: { open: boolean }
  openRentmanImport: () => void
  closeRentmanImport: () => void
  /** Rentman cable export dialog (push canvas cable BOM to Rentman). */
  rentmanCableExport: { open: boolean }
  openRentmanCableExport: () => void
  closeRentmanCableExport: () => void
  /** Issue #68: id of the cable currently under the mouse cursor (on
   *  the canvas OR in the cables legend). CableEdge highlights itself
   *  when its id matches; EquipmentNode highlights any handle whose
   *  port id matches the hovered cable's endpoints. Cleared on mouse
   *  leave. */
  hoveredCableId: string | null
  setHoveredCableId: (id: string | null) => void
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
      canvasTheme: state.canvasTheme,
      colorPortsByType: state.colorPortsByType,
      // The two fields below were missing from the explicit list — any
      // call through applyPatch was silently dropping them when writing
      // to localStorage. Result: the next time the user toggled a
      // different setting their language / override choice got reset to
      // the default. (Fixed as part of issue #70 which added the
      // override toggle.)
      language: state.language,
      overrideConnectionWarnings: state.overrideConnectionWarnings,
      connectorTypeColors: state.connectorTypeColors,
      bgVariant: state.bgVariant,
      bgOpacity: state.bgOpacity,
      customCableSpecs: state.customCableSpecs,
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
  setCanvasTheme: (value) => set(applyPatch({ canvasTheme: value })),
  setColorPortsByType: (value) => set(applyPatch({ colorPortsByType: value })),
  setLanguage: (value) => set(applyPatch({ language: value })),
  setOverrideConnectionWarnings: (value) => set(applyPatch({ overrideConnectionWarnings: value })),
  setConnectorTypeColor: (connectorType, color) =>
    set((state) => {
      const next = { ...state.connectorTypeColors }
      if (!color) delete next[connectorType]
      else next[connectorType] = color
      return applyPatch({ connectorTypeColors: next })(state)
    }),
  resetConnectorTypeColors: () => set(applyPatch({ connectorTypeColors: {} })),
  setBgVariant: (value) => set(applyPatch({ bgVariant: value })),
  setBgOpacity: (value) => set(applyPatch({ bgOpacity: Math.max(0, Math.min(1, value)) })),
  addCustomCableSpec: (spec) => {
    const id = `custom-cable:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const entry = { ...spec, id }
    set((state) => {
      // Drop any existing spec with the same name so the user can re-save
      // an edited definition without duplicating it in the dropdown.
      const filtered = state.customCableSpecs.filter((s) => s.name !== spec.name)
      return applyPatch({ customCableSpecs: [...filtered, entry] })(state)
    })
    return entry
  },
  updateCustomCableSpec: (id, patch) =>
    set((state) => {
      if (!id.startsWith('custom-cable:')) return state
      const next = state.customCableSpecs.map((s) =>
        s.id === id ? { ...s, ...patch, id: s.id } : s,
      )
      return applyPatch({ customCableSpecs: next })(state)
    }),
  removeCustomCableSpec: (id) =>
    set((state) =>
      applyPatch({ customCableSpecs: state.customCableSpecs.filter((s) => s.id !== id) })(state),
    ),
  pdfExportThemeOverride: null,
  setPdfExportThemeOverride: (value) => set({ pdfExportThemeOverride: value }),
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
  atemAudioConfig: { open: false },
  openAtemAudioConfig: (deviceId) => set({ atemAudioConfig: { open: true, deviceId } }),
  closeAtemAudioConfig: () => set({ atemAudioConfig: { open: false } }),
  locationBom: { open: false },
  openLocationBom: (locationId) => set({ locationBom: { open: true, locationId } }),
  closeLocationBom: () => set({ locationBom: { open: false } }),
  rentmanImport: { open: false },
  openRentmanImport: () => set({ rentmanImport: { open: true } }),
  closeRentmanImport: () => set({ rentmanImport: { open: false } }),
  rentmanCableExport: { open: false },
  openRentmanCableExport: () => set({ rentmanCableExport: { open: true } }),
  closeRentmanCableExport: () => set({ rentmanCableExport: { open: false } }),
  hoveredCableId: null,
  setHoveredCableId: (id) => set({ hoveredCableId: id }),
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
