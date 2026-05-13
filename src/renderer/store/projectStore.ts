import { v4 as uuidv4 } from 'uuid'
import { create } from 'zustand'
import type { Connection } from 'reactflow'
import type { Cable } from '../types/cable'
import type { EquipmentItem, EquipmentTemplate, GroupPreset, Port } from '../types/equipment'
import type { LocationFrame } from '../types/location'
import type { CablePlannerProject } from '../types/project'
import { useUiStore } from './uiStore'
import { blackmagicTemplates } from '../lib/blackmagicCatalog'
import { ubiquitiTemplates } from '../lib/ubiquitiCatalog'
import { monitorTemplates } from '../lib/monitorCatalog'
import { cameraTemplates } from '../lib/cameraCatalog'
import { miscTemplates } from '../lib/miscCatalog'
import { greengoTemplates } from '../lib/greengoCatalog'
import {
  upsertCachedRentmanTemplate,
  upsertCachedRentmanTemplateFromEquipment,
} from '../lib/rentmanTemplateCache'
import type { GreenGoConfig } from '../types/greengo'
import { useSettingsStore } from './settingsStore'

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
  Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

const CUSTOM_LIB_KEY = 'cable-planner:customLibrary'
const PROJECT_AUTOSAVE_KEY = 'cable-planner:projectAutosave'
const KNOWN_CATEGORIES_KEY = 'cable-planner:knownCategories'
const GROUP_PRESETS_KEY = 'cable-planner:groupPresets'
const LIB_MIGRATION_KEY = 'cable-planner:libMigration'
const LIB_MIGRATION_VERSION = '2026-04-greengo-catalog-v2'

const DEFAULT_CATEGORIES = [
  'Kameras',
  'Objektive',
  'Stative',
  'Licht',
  'Audio',
  'Video',
  'Monitore',
  'PC',
  'Netzwerk',
  'Kabel',
  'Strom',
  'Rigging',
  'Sonstiges',
]

const runLibraryMigration = () => {
  try {
    const current = localStorage.getItem(LIB_MIGRATION_KEY)
    // Step 1 (earlier migration): the previous build auto-generated bogus
    // 1-in/1-out templates for every Rentman device. Ensure those are cleared
    // ONCE, but don't wipe libraries created by any later good migration.
    const preservedVersions = new Set(['2026-04-reset', '2026-04-blackmagic-seed', '2026-04-monitor-camera-seed', '2026-04-misc-catalog-seed', '2026-04-greengo-catalog-seed', LIB_MIGRATION_VERSION])
    if (current && !preservedVersions.has(current)) {
      localStorage.removeItem(CUSTOM_LIB_KEY)
    }
    // Step 2: always seed built-in templates (Blackmagic + Ubiquiti) so they
    // appear in the library, even for users who already passed an earlier
    // migration gate. Entries the user saved under the same name are kept.
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    const existing: EquipmentTemplate[] = raw ? JSON.parse(raw) : []
    const byName = new Map(existing.map((t) => [t.name, t]))
    let added = false
    for (const t of [...blackmagicTemplates, ...ubiquitiTemplates, ...monitorTemplates, ...cameraTemplates, ...miscTemplates, ...greengoTemplates]) {
      if (!byName.has(t.name)) {
        byName.set(t.name, t)
        added = true
      }
    }
    if (added || !raw) {
      localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(Array.from(byName.values())))
    }
    localStorage.setItem(LIB_MIGRATION_KEY, LIB_MIGRATION_VERSION)
  } catch {
    /* ignore */
  }
}
runLibraryMigration()

const loadCustomLibrary = (): EquipmentTemplate[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_LIB_KEY)
    return raw ? (JSON.parse(raw) as EquipmentTemplate[]) : []
  } catch {
    return []
  }
}

const persistCustomLibrary = (items: EquipmentTemplate[]) => {
  try {
    localStorage.setItem(CUSTOM_LIB_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

const loadKnownCategories = (): string[] => {
  try {
    const raw = localStorage.getItem(KNOWN_CATEGORIES_KEY)
    const stored = raw ? (JSON.parse(raw) as string[]) : []
    // Merge in defaults so dropdowns always have sensible options.
    const set_ = new Set<string>([...DEFAULT_CATEGORIES, ...stored])
    return Array.from(set_).sort((a, b) => a.localeCompare(b))
  } catch {
    return [...DEFAULT_CATEGORIES]
  }
}

const persistKnownCategories = (items: string[]) => {
  try {
    localStorage.setItem(KNOWN_CATEGORIES_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

const loadAutosavedProject = (): CablePlannerProject | null => {
  try {
    const raw = localStorage.getItem(PROJECT_AUTOSAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CablePlannerProject
    if (!parsed || !Array.isArray(parsed.equipment) || !Array.isArray(parsed.cables)) return null
    // Repair equipment that was seeded with empty port ids (old library
    // templates used `id: ''` and relied on the store to fill them in — see
    // sanitizePort). Without this, every handle on the node would share an
    // empty string id and ReactFlow would always snap new cables to port 1.
    let mutated = false
    parsed.equipment = parsed.equipment.map((item) => {
      const fixInputs = item.inputs?.some((p) => !p.id) ?? false
      const fixOutputs = item.outputs?.some((p) => !p.id) ?? false
      if (!fixInputs && !fixOutputs) return item
      mutated = true
      return {
        ...item,
        inputs: (item.inputs ?? []).map((p) => (p.id ? p : { ...p, id: uuidv4() })),
        outputs: (item.outputs ?? []).map((p) => (p.id ? p : { ...p, id: uuidv4() })),
      }
    })
    if (mutated) {
      try {
        localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(parsed))
      } catch {
        /* ignore quota */
      }
    }
    return parsed
  } catch {
    return null
  }
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  const delay = useSettingsStore.getState().autosaveIntervalMs || 400
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(project))
    } catch {
      /* quota errors are non-fatal */
    }
  }, delay)
}

const loadGroupPresets = (): GroupPreset[] => {
  try {
    const raw = localStorage.getItem(GROUP_PRESETS_KEY)
    return raw ? (JSON.parse(raw) as GroupPreset[]) : []
  } catch {
    return []
  }
}

const persistGroupPresets = (presets: GroupPreset[]) => {
  try {
    localStorage.setItem(GROUP_PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}

interface ProjectState {
  project: CablePlannerProject
  filePath?: string
  /** Incremented each time loadProject or clear() is called. Canvas uses this
   *  to detect a project-load event and restore the saved viewport. */
  projectVersion: number
  selectedEquipmentId?: string
  selectedCableId?: string
  selectedLocationId?: string
  selectedTemplateName?: string
  pendingConnection?: Connection
  pendingWaypoints?: { x: number; y: number }[]
  showCableDialog: boolean
  recentProjects: string[]
  customLibrary: EquipmentTemplate[]
  setRecentProjects: (items: string[]) => void
  setFilePath: (path?: string) => void
  loadProject: (project: CablePlannerProject, filePath?: string) => void
  setProjectMeta: (name: string, description: string) => void
  updateProjectMetadata: (
    patch: Partial<import('../types/project').ProjectMetadata>,
  ) => void
  setDefaultVideoFormat: (id: string) => void
  setCanvasState: (x: number, y: number, zoom: number) => void
  addEquipment: (equipment: Omit<EquipmentItem, 'id'>) => void
  importEquipment: (equipment: EquipmentItem[]) => void
  /**
   * Insert devices and cables coming from a yEd / GraphML import. Each
   * device carries an optional `graphmlId` so a re-import (`mode:
   * 'replace'`) can correlate the previous snapshot with the new one
   * and update positions/ports in place rather than producing
   * duplicates. Cables use the port-import-key map built by the dialog
   * to look up the freshly-assigned cable-planner uuids.
   *
   * Returns the list of newly inserted equipment ids in import order
   * so the caller can select them on the canvas to draw the user's
   * attention to what changed.
   */
  importGraphml: (payload: {
    devices: Array<Omit<EquipmentItem, 'id'> & { graphmlId: string; importKey: string }>
    /** Map from ResolvedPort.importKey to the *position index within the
     *  device's inputs/outputs array*, so the store can resolve cable
     *  endpoints once it has assigned real uuids. */
    portIndex: Record<string, { deviceImportKey: string; side: 'in' | 'out'; index: number }>
    cables: Array<{
      importKey: string
      graphmlEdgeId: string
      sourceDeviceImportKey: string
      sourcePortImportKey: string
      targetDeviceImportKey: string
      targetPortImportKey: string
      type: Cable['type']
      length: number
      color: string
      name: string
      standard?: Cable['standard']
      cableSpecId?: string
      notes?: string
    }>
    mode: 'append' | 'replace'
  }) => string[]
  /**
   * Paste a snapshot of equipment items + connecting cables (Ctrl+V / duplicate).
   * All ids (equipment, ports, cable) are remapped to fresh uuids; cable refs
   * to ports/equipment outside the snapshot are dropped. The new equipment is
   * placed at `(item.x + offset.dx, item.y + offset.dy)`. Returns the list of
   * new equipment ids so the caller can select them on the canvas.
   */
  pasteEquipment: (
    items: EquipmentItem[],
    cables: Cable[],
    offset: { dx: number; dy: number },
  ) => string[]
  updateEquipment: (id: string, patch: Partial<EquipmentItem>) => void
  setSelection: (equipmentId?: string, cableId?: string, locationId?: string) => void
  setSelectedTemplateName: (name?: string) => void
  addLocation: (partial?: Partial<LocationFrame>) => void
  addLocationAroundEquipment: (equipmentIds: string[], partial?: Partial<LocationFrame>) => void
  updateLocation: (id: string, patch: Partial<LocationFrame>) => void
  deleteLocation: (id: string) => void
  deleteLocationWithContents: (id: string) => void
  moveLocationWithContents: (id: string, dx: number, dy: number, containedEquipmentIds: string[]) => void
  queueConnection: (connection: Connection, waypoints?: { x: number; y: number }[]) => void
  closeCableDialog: () => void
  createCableFromPending: (draft: CableDraft) => void
  updateCable: (id: string, patch: Partial<Cable>) => void
  deleteEquipment: (id: string) => void
  deleteCable: (id: string) => void
  deleteSelected: () => void
  reconnectCable: (
    cableId: string,
    endpoint: 'source' | 'target',
    equipmentId: string,
    portId: string,
  ) => void
  addOpenEndStub: (
    at: { x: number; y: number },
    connectorType: Port['connectorType'],
    side: 'input' | 'output',
  ) => string
  clear: () => void
  addCustomTemplate: (template: EquipmentTemplate) => void
  addCustomTemplates: (templates: EquipmentTemplate[]) => void
  removeCustomTemplate: (name: string) => void
  setCustomTemplateCategory: (name: string, category: string) => void
  renameCustomCategory: (oldCategory: string, newCategory: string) => void
  /** Update name and/or category of an existing library template. */
  updateCustomTemplate: (currentName: string, patch: { name?: string; category?: string }) => void
  /** Overwrite a template with the current equipment item's layout. */
  saveEquipmentAsTemplate: (equipmentId: string) => void
  /** Save the current equipment item as a new library template under the given name. */
  saveEquipmentAsNewTemplate: (equipmentId: string, newName: string, category?: string) => void
  /** Toggle favorite flag on a library template. */
  toggleTemplateFavorite: (name: string) => void
  /** Toggle hidden flag on a library template. */
  toggleTemplateHidden: (name: string) => void
  /** Replace the entire custom library (e.g. after a Sync Pull). */
  setCustomLibrary: (templates: EquipmentTemplate[]) => void
  knownCategories: string[]
  addKnownCategories: (categories: string[]) => void
  groupPresets: GroupPreset[]
  addGroupPreset: (preset: GroupPreset) => void
  saveGroupPreset: (name: string, equipmentIds: string[]) => void
  deleteGroupPreset: (id: string) => void
  placeGroupPreset: (presetId: string, x: number, y: number) => void
  /** Replace all group presets (e.g. after a Sync Pull). */
  setGroupPresets: (presets: GroupPreset[]) => void
  /** Save or replace the GreenGo intercom planning config in the project. */
  updateGreenGoConfig: (config: GreenGoConfig) => void
}

const now = () => new Date().toISOString()

/** Cable types that physically carry signal in both directions. Newly
 *  created cables of these types get cable.bidirectional = true by
 *  default so CableEdge draws arrow markers on both ends (issue #67). */
const BIDIRECTIONAL_CABLE_TYPES = new Set<Cable['type']>([
  'Ethernet/RJ45',
  'Fiber',
  'SFP',
  'SFP+',
  'USB-C',
])

const defaultProject = (): CablePlannerProject => ({
  metadata: {
    name: 'Untitled Project',
    description: '',
    createdAt: now(),
    updatedAt: now(),
    defaultVideoFormat: '1080p50',
  },
  equipment: [],
  cables: [],
  locations: [],
  canvasState: { x: 0, y: 0, zoom: 1 },
})

const touchProject = (project: CablePlannerProject): CablePlannerProject => ({
  ...project,
  metadata: {
    ...project.metadata,
    updatedAt: now(),
  },
})

const sanitizePort = (port: Partial<Port>, fallbackName: string): Port => ({
  // Spread first so optional fields like `direction`, `sfpType`, `sfpStandard`,
  // `sfpWavelength`, `sfpVendor` survive the trip through addEquipment /
  // importEquipment. Without this they were silently dropped, which broke
  // bidirectional handles and SFP module metadata for catalog/NetBox imports.
  ...port,
  id: port.id && port.id.length > 0 ? port.id : uuidv4(),
  name: port.name ?? fallbackName,
  type: port.type ?? 'Custom',
  connectorType: port.connectorType ?? 'Custom',
})

/**
 * Heal a project loaded from disk: round every equipment / location position
 * (and width/height where applicable) to an integer. Older project files
 * saved before the snap-on-add fix can contain sub-pixel floats from
 * `screenToFlowPosition` at non-integer zoom (e.g. `-135.333`). Without this
 * pass, opening such a file shows devices visibly shifted by individual
 * sub-pixel deltas — exactly the "verschoben beim Öffnen" symptom.
 *
 * We don't try to snap to the user's current grid here because the user's
 * grid may differ from the one used when the file was created. Plain integer
 * rounding is enough to remove the visible drift and is reversible (the
 * shift is in the order of fractions of a pixel, never more).
 */
const healProjectPositions = (project: CablePlannerProject): CablePlannerProject => {
  const r = (v: unknown): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0
  return {
    ...project,
    equipment: project.equipment.map((item) => ({
      ...item,
      x: r(item.x),
      y: r(item.y),
      width: typeof item.width === 'number' ? Math.round(item.width) : item.width,
      height: typeof item.height === 'number' ? Math.round(item.height) : item.height,
    })),
    locations: (project.locations ?? []).map((loc) => ({
      ...loc,
      x: r(loc.x),
      y: r(loc.y),
      width: Math.round(loc.width),
      height: Math.round(loc.height),
    })),
    cables: project.cables.map((c) =>
      c.waypoints && c.waypoints.length > 0
        ? { ...c, waypoints: c.waypoints.map((w) => ({ x: r(w.x), y: r(w.y) })) }
        : c,
    ),
  }
}

const shouldSyncRentmanTemplateCache = (patch: Partial<EquipmentItem>): boolean => {
  const keys = Object.keys(patch) as Array<keyof EquipmentItem>
  // Ignore pure position updates to avoid excessive localStorage writes while dragging.
  return keys.some((key) => key !== 'x' && key !== 'y')
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: (() => {
    const auto = loadAutosavedProject()
    return auto ? healProjectPositions(auto) : defaultProject()
  })(),
  projectVersion: 0,
  showCableDialog: false,
  recentProjects: [],
  customLibrary: loadCustomLibrary(),
  knownCategories: loadKnownCategories(),
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
  loadProject: (project, filePath) =>
    set((state) => ({
      project: healProjectPositions(project),
      filePath,
      projectVersion: state.projectVersion + 1,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      pendingConnection: undefined,
      showCableDialog: false,
    })),
  setProjectMeta: (name, description) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          description,
        },
      }),
    })),
  updateProjectMetadata: (patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          ...patch,
        },
      }),
    })),
  setDefaultVideoFormat: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          defaultVideoFormat: id as CablePlannerProject['metadata']['defaultVideoFormat'],
        },
      }),
    })),
  setCanvasState: (x, y, zoom) =>
    set((state) => ({
      project: {
        ...state.project,
        canvasState: { x, y, zoom },
      },
    })),
  addEquipment: (equipment) =>
    set((state) => ({
      // Adding from the Library (click / drag-drop) must NOT keep any prior
      // selection live, because React Flow's internal multi-select would
      // otherwise cause the next pointer-down on the canvas to start a
      // group-drag that visibly moves the previously selected device(s).
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
      project: touchProject({
        ...state.project,
        equipment: [
          ...state.project.equipment,
          {
            ...equipment,
            id: uuidv4(),
            // CRITICAL: Ensure x/y are valid numbers. If somehow they're undefined/NaN,
            // default to (0, 0) so equipment doesn't disappear.
            x: equipment.x !== undefined && !Number.isNaN(equipment.x) ? equipment.x : 0,
            y: equipment.y !== undefined && !Number.isNaN(equipment.y) ? equipment.y : 0,
            // Ensure every port gets a unique id. Some library helpers seed
            // templates with `id: ''` and rely on the store to assign ids on
            // placement — without this, all handles on the node would share
            // the empty string and ReactFlow would always snap new cables to
            // the first handle.
            inputs: equipment.inputs.map((p) =>
              sanitizePort(p, p.name ?? 'Input'),
            ),
            outputs: equipment.outputs.map((p) =>
              sanitizePort(p, p.name ?? 'Output'),
            ),
          },
        ],
      }),
    })),
  importEquipment: (equipment) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [
          ...state.project.equipment,
          ...equipment.map((item) => ({
            ...item,
            id: item.id || uuidv4(),
            // CRITICAL: Ensure x/y are valid numbers. Equipment being imported
            // should have positions, but if somehow they don't, default to (0, 0)
            // to prevent disappearing equipment.
            x: item.x !== undefined && !Number.isNaN(item.x) ? item.x : 0,
            y: item.y !== undefined && !Number.isNaN(item.y) ? item.y : 0,
            inputs: item.inputs.map((p, index) => sanitizePort(p, `In ${index + 1}`)),
            outputs: item.outputs.map((p, index) => sanitizePort(p, `Out ${index + 1}`)),
          })),
        ],
      }),
    })),
  importGraphml: (payload) => {
    const newIds: string[] = []
    set((state) => {
      // In 'replace' mode we throw out the existing GraphML-imported
      // equipment + cables before inserting the new snapshot, so the
      // caller never has to pre-clean. Manually-added items are kept.
      const baseEquipment = payload.mode === 'replace'
        ? state.project.equipment.filter((e) => e.importSource !== 'graphml')
        : state.project.equipment
      const baseCables = payload.mode === 'replace'
        ? state.project.cables.filter((c) => !c.graphmlEdgeId)
        : state.project.cables

      // Build the new equipment items with fresh uuids and sanitized
      // ports. We retain a deviceImportKey → fresh-id map for the
      // cable resolution pass below.
      const deviceImportKeyToId = new Map<string, string>()
      const portImportKeyToId = new Map<string, string>()
      const insertedEquipment = payload.devices.map((draft) => {
        const id = uuidv4()
        deviceImportKeyToId.set(draft.importKey, id)
        newIds.push(id)
        const inputs = draft.inputs.map((p, idx) => {
          const port = sanitizePort(p, `In ${idx + 1}`)
          const key = payload.portIndex
          // Reverse-lookup: find the importKey for (deviceImportKey, 'in', idx)
          for (const [importKey, ref] of Object.entries(key)) {
            if (ref.deviceImportKey === draft.importKey && ref.side === 'in' && ref.index === idx) {
              portImportKeyToId.set(importKey, port.id)
              break
            }
          }
          return port
        })
        const outputs = draft.outputs.map((p, idx) => {
          const port = sanitizePort(p, `Out ${idx + 1}`)
          const key = payload.portIndex
          for (const [importKey, ref] of Object.entries(key)) {
            if (ref.deviceImportKey === draft.importKey && ref.side === 'out' && ref.index === idx) {
              portImportKeyToId.set(importKey, port.id)
              break
            }
          }
          return port
        })
        return {
          ...draft,
          id,
          importSource: 'graphml' as const,
          x: Number.isFinite(draft.x) ? draft.x : 0,
          y: Number.isFinite(draft.y) ? draft.y : 0,
          inputs,
          outputs,
        }
      })

      const ui = useUiStore.getState()
      const insertedCables: Cable[] = []
      for (const draft of payload.cables) {
        const fromEquipmentId = deviceImportKeyToId.get(draft.sourceDeviceImportKey)
        const toEquipmentId = deviceImportKeyToId.get(draft.targetDeviceImportKey)
        const fromPortId = portImportKeyToId.get(draft.sourcePortImportKey)
        const toPortId = portImportKeyToId.get(draft.targetPortImportKey)
        // Cables whose endpoints didn't make it through the device/port
        // mapping are dropped silently — the dialog already surfaced
        // them as unresolved before the user clicked Import.
        if (!fromEquipmentId || !toEquipmentId || !fromPortId || !toPortId) continue
        insertedCables.push({
          id: uuidv4(),
          name: draft.name,
          type: draft.type,
          length: draft.length,
          color: draft.color,
          fromEquipmentId,
          fromPortId,
          toEquipmentId,
          toPortId,
          notes: draft.notes ?? '',
          standard: draft.standard,
          cableSpecId: draft.cableSpecId,
          routing: ui.defaultRouting,
          arrowEnd: ui.defaultArrow,
          strokeWidth: 2.5,
          graphmlEdgeId: draft.graphmlEdgeId,
        })
      }

      return {
        project: touchProject({
          ...state.project,
          equipment: [...baseEquipment, ...insertedEquipment],
          cables: [...baseCables, ...insertedCables],
        }),
      }
    })
    return newIds
  },
  pasteEquipment: (items, cables, offset) => {
    if (items.length === 0) return []
    // Build remap tables so port refs in copied cables stay valid.
    const equipmentIdMap = new Map<string, string>()
    const portIdMap = new Map<string, string>()
    const newItems: EquipmentItem[] = items.map((item) => {
      const newId = uuidv4()
      equipmentIdMap.set(item.id, newId)
      const remapPorts = (ports: Port[], fallback: string): Port[] =>
        ports.map((p, index) => {
          const newPortId = uuidv4()
          if (p.id) portIdMap.set(p.id, newPortId)
          return {
            ...sanitizePort(p, p.name ?? `${fallback} ${index + 1}`),
            id: newPortId,
          }
        })
      return {
        ...item,
        id: newId,
        // CRITICAL: Ensure x/y remain valid after offset application.
        // Prevent equipment from disappearing if somehow x/y become NaN.
        x: !Number.isNaN(item.x + offset.dx) ? item.x + offset.dx : item.x,
        y: !Number.isNaN(item.y + offset.dy) ? item.y + offset.dy : item.y,
        inputs: remapPorts(item.inputs, 'In'),
        outputs: remapPorts(item.outputs, 'Out'),
        // Drop port-keyed VLAN map; ids are different now.
        portVlans: undefined,
        favorite: undefined,
        hidden: undefined,
      }
    })
    const newCables: Cable[] = []
    for (const cable of cables) {
      const fromEq = equipmentIdMap.get(cable.fromEquipmentId)
      const toEq = equipmentIdMap.get(cable.toEquipmentId)
      // Only clone cables whose both endpoints are in the pasted snapshot.
      if (!fromEq || !toEq) continue
      const fromPort = portIdMap.get(cable.fromPortId)
      const toPort = portIdMap.get(cable.toPortId)
      if (!fromPort || !toPort) continue
      newCables.push({
        ...cable,
        id: uuidv4(),
        fromEquipmentId: fromEq,
        toEquipmentId: toEq,
        fromPortId: fromPort,
        toPortId: toPort,
        waypoints: cable.waypoints?.map((wp) => ({
          x: wp.x + offset.dx,
          y: wp.y + offset.dy,
        })),
      })
    }
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, ...newItems],
        cables: [...state.project.cables, ...newCables],
      }),
    }))
    return newItems.map((item) => item.id)
  },
  updateEquipment: (id, patch) =>
    set((state) => {
      const prev = state.project.equipment.find((e) => e.id === id)
      let updatedItem: EquipmentItem | undefined
      const nextEquipment = state.project.equipment.map((item) =>
        item.id === id
          ? ((updatedItem = { 
              ...item, 
              ...patch,
              // CRITICAL: Never allow position to become undefined or NaN. 
              // If patch accidentally omits x/y or sets them to undefined,
              // preserve the previous values to prevent equipment from disappearing.
              x: patch.x !== undefined && !Number.isNaN(patch.x) ? patch.x : item.x,
              y: patch.y !== undefined && !Number.isNaN(patch.y) ? patch.y : item.y,
            }), updatedItem)
          : item,
      )
      // If the equipment moved, also shift waypoints of cables attached to it
      // so the cable visually travels with the device (draw.io-style). When
      // only ONE endpoint moves, shifting *all* waypoints by the full delta
      // would break the path on the *other* (still-anchored) side and produce
      // an erratic, "spinning" orthogonal route. So we only shift the single
      // waypoint adjacent to the moving port (first for source, last for
      // target). When both endpoints sit on the same device we translate the
      // whole path.
      let nextCables = state.project.cables
      if (
        prev &&
        patch.x !== undefined &&
        patch.y !== undefined &&
        (patch.x !== prev.x || patch.y !== prev.y)
      ) {
        const dx = patch.x - prev.x
        const dy = patch.y - prev.y
        nextCables = state.project.cables.map((c) => {
          if (!c.waypoints || c.waypoints.length === 0) return c
          const touchesSource = c.fromEquipmentId === id
          const touchesTarget = c.toEquipmentId === id
          if (!touchesSource && !touchesTarget) return c
          if (touchesSource && touchesTarget) {
            return {
              ...c,
              waypoints: c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
            }
          }
          const next = c.waypoints.slice()
          if (touchesSource) {
            const w = next[0]
            next[0] = { x: w.x + dx, y: w.y + dy }
          } else {
            const lastIdx = next.length - 1
            const w = next[lastIdx]
            next[lastIdx] = { x: w.x + dx, y: w.y + dy }
          }
          return { ...c, waypoints: next }
        })
      }
      if (updatedItem?.rentmanId && shouldSyncRentmanTemplateCache(patch)) {
        upsertCachedRentmanTemplateFromEquipment(updatedItem)
      }

      return {
        project: touchProject({
          ...state.project,
          equipment: nextEquipment,
          cables: nextCables,
        }),
      }
    }),
  setSelection: (equipmentId, cableId, locationId) =>
    set({
      selectedEquipmentId: equipmentId,
      selectedCableId: cableId,
      selectedLocationId: locationId,
      selectedTemplateName: undefined,
    }),
  setSelectedTemplateName: (name) =>
    set({
      selectedTemplateName: name,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
    }),
  addLocation: (partial) =>
    set((state) => {
      const loc: LocationFrame = {
        id: uuidv4(),
        name: partial?.name ?? 'Location',
        x: partial?.x ?? 100,
        y: partial?.y ?? 100,
        width: partial?.width ?? 360,
        height: partial?.height ?? 240,
        color: partial?.color ?? '#38bdf8',
      }
      return {
        project: touchProject({
          ...state.project,
          locations: [...(state.project.locations ?? []), loc],
        }),
        selectedLocationId: loc.id,
      }
    }),
  addLocationAroundEquipment: (equipmentIds, partial) =>
    set((state) => {
      const ids = new Set(equipmentIds)
      const items = state.project.equipment.filter((e) => ids.has(e.id))
      if (items.length === 0) return {}
      const PAD = 40
      const TITLE_PAD = 24
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const e of items) {
        const w = e.width ?? 220
        const h = e.height ?? 140
        if (e.x < minX) minX = e.x
        if (e.y < minY) minY = e.y
        if (e.x + w > maxX) maxX = e.x + w
        if (e.y + h > maxY) maxY = e.y + h
      }
      const loc: LocationFrame = {
        id: uuidv4(),
        name: partial?.name ?? 'Neue Location',
        x: minX - PAD,
        y: minY - TITLE_PAD - PAD,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + TITLE_PAD + PAD * 2,
        color: partial?.color ?? '#38bdf8',
        ...(partial?.width ? { width: partial.width } : {}),
        ...(partial?.height ? { height: partial.height } : {}),
      }
      return {
        project: touchProject({
          ...state.project,
          locations: [...(state.project.locations ?? []), loc],
        }),
        selectedLocationId: loc.id,
      }
    }),
  updateLocation: (id, patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        locations: (state.project.locations ?? []).map((l) =>
          l.id === id ? { ...l, ...patch } : l,
        ),
      }),
    })),
  deleteLocation: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        locations: (state.project.locations ?? []).filter((l) => l.id !== id),
      }),
      selectedLocationId:
        state.selectedLocationId === id ? undefined : state.selectedLocationId,
    })),
  deleteLocationWithContents: (id) =>
    set((state) => {
      const loc = (state.project.locations ?? []).find((l) => l.id === id)
      if (!loc) return {}
      const containedIds = new Set(
        state.project.equipment
          .filter((e) => {
            const cx = e.x + (e.width ?? 0) / 2
            const cy = e.y + (e.height ?? 0) / 2
            return (
              cx >= loc.x &&
              cx <= loc.x + loc.width &&
              cy >= loc.y &&
              cy <= loc.y + loc.height
            )
          })
          .map((e) => e.id),
      )
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).filter((l) => l.id !== id),
          equipment: state.project.equipment.filter((e) => !containedIds.has(e.id)),
          cables: state.project.cables.filter(
            (c) =>
              !containedIds.has(c.fromEquipmentId) && !containedIds.has(c.toEquipmentId),
          ),
        }),
        selectedLocationId:
          state.selectedLocationId === id ? undefined : state.selectedLocationId,
      }
    }),
  moveLocationWithContents: (id, dx, dy, containedEquipmentIds) =>
    set((state) => {
      if (!dx && !dy) return {}
      const containedSet = new Set(containedEquipmentIds)
      // Shift waypoints of any cable where at least one endpoint is a contained
      // equipment item - keeps the cable aligned with the moved device.
      const nextCables = state.project.cables.map((c) => {
        if (!c.waypoints || c.waypoints.length === 0) return c
        if (!containedSet.has(c.fromEquipmentId) && !containedSet.has(c.toEquipmentId)) {
          return c
        }
        return {
          ...c,
          waypoints: c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
        }
      })
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).map((l) =>
            l.id === id ? { ...l, x: l.x + dx, y: l.y + dy } : l,
          ),
          equipment: state.project.equipment.map((e) =>
            containedSet.has(e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e,
          ),
          cables: nextCables,
        }),
      }
    }),
  queueConnection: (connection, waypoints) =>
    set({
      pendingConnection: connection,
      pendingWaypoints: waypoints && waypoints.length > 0 ? waypoints : undefined,
      showCableDialog: true,
    }),
  closeCableDialog: () =>
    set({ pendingConnection: undefined, pendingWaypoints: undefined, showCableDialog: false }),
  createCableFromPending: (draft) =>
    set((state) => {
      if (!state.pendingConnection || !state.pendingConnection.source || !state.pendingConnection.target) {
        return { pendingConnection: undefined, pendingWaypoints: undefined, showCableDialog: false }
      }

      const ui = useUiStore.getState()
      const cable: Cable = {
        id: uuidv4(),
        name: draft.name,
        type: draft.type,
        length: draft.length,
        color: draft.color,
        fromEquipmentId: state.pendingConnection.source,
        fromPortId: state.pendingConnection.sourceHandle ?? '',
        toEquipmentId: state.pendingConnection.target,
        toPortId: state.pendingConnection.targetHandle ?? '',
        notes: draft.notes,
        cableSpecId: draft.cableSpecId,
        standard: draft.standard,
        needsConverter: draft.needsConverter,
        routing: ui.defaultRouting,
        arrowEnd: ui.defaultArrow,
        // Inherently two-way cable types get the bidirectional flag set
        // by default (issue #67). The user can still untick it in
        // CableProperties if they want to show a one-way arrow anyway.
        bidirectional: BIDIRECTIONAL_CABLE_TYPES.has(draft.type),
        strokeWidth: 2.5,
        waypoints: state.pendingWaypoints,
      }

      return {
        project: touchProject({
          ...state.project,
          cables: [...state.project.cables, cable],
        }),
        pendingConnection: undefined,
        pendingWaypoints: undefined,
        showCableDialog: false,
        selectedCableId: cable.id,
      }
    }),
  updateCable: (id, patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        cables: state.project.cables.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }),
    })),
  deleteEquipment: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: state.project.equipment.filter((item) => item.id !== id),
        cables: state.project.cables.filter(
          (cable) => cable.fromEquipmentId !== id && cable.toEquipmentId !== id,
        ),
      }),
      selectedEquipmentId:
        state.selectedEquipmentId === id ? undefined : state.selectedEquipmentId,
    })),
  deleteCable: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        cables: state.project.cables.filter((item) => item.id !== id),
      }),
      selectedCableId: state.selectedCableId === id ? undefined : state.selectedCableId,
    })),
  deleteSelected: () =>
    set((state) => {
      if (state.selectedCableId) {
        return {
          project: touchProject({
            ...state.project,
            cables: state.project.cables.filter((item) => item.id !== state.selectedCableId),
          }),
          selectedCableId: undefined,
        }
      }
      if (state.selectedLocationId) {
        return {
          project: touchProject({
            ...state.project,
            locations: (state.project.locations ?? []).filter(
              (l) => l.id !== state.selectedLocationId,
            ),
          }),
          selectedLocationId: undefined,
        }
      }
      if (state.selectedEquipmentId) {
        return {
          project: touchProject({
            ...state.project,
            equipment: state.project.equipment.filter(
              (item) => item.id !== state.selectedEquipmentId,
            ),
            cables: state.project.cables.filter(
              (cable) =>
                cable.fromEquipmentId !== state.selectedEquipmentId &&
                cable.toEquipmentId !== state.selectedEquipmentId,
            ),
          }),
          selectedEquipmentId: undefined,
        }
      }
      return {}
    }),
  reconnectCable: (cableId, endpoint, equipmentId, portId) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        cables: state.project.cables.map((cable) => {
          if (cable.id !== cableId) return cable
          if (endpoint === 'source') {
            return { ...cable, fromEquipmentId: equipmentId, fromPortId: portId }
          }
          return { ...cable, toEquipmentId: equipmentId, toPortId: portId }
        }),
      }),
    })),
  addOpenEndStub: (at, connectorType, side) => {
    const id = uuidv4()
    const portId = uuidv4()
    const stubPort: Port = {
      id: portId,
      name: 'Open End',
      type: connectorType,
      connectorType,
    }
    const stub: EquipmentItem = {
      id,
      name: `Open ${connectorType}`,
      category: 'Open End',
      inputs: side === 'input' ? [stubPort] : [],
      outputs: side === 'output' ? [stubPort] : [],
      x: at.x,
      y: at.y,
      width: 140,
      height: 60,
    }
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, stub],
      }),
    }))
    // expose port id via returned stub id lookup — caller knows portId is first port
    // Actually caller needs the portId — we encode as `${id}|${portId}` for simplicity.
    return `${id}|${portId}`
  },
  clear: () => {
    // Also drop the persisted autosave copy — otherwise the old project
    // would come back on the next app launch, which is surprising when the
    // user explicitly started a fresh project.
    try {
      localStorage.removeItem(PROJECT_AUTOSAVE_KEY)
    } catch {
      /* ignore */
    }
    set((state) => ({
      project: defaultProject(),
      filePath: undefined,
      projectVersion: state.projectVersion + 1,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
    }))
  },
  addCustomTemplate: (template) =>
    set((state) => {
      const next = [...state.customLibrary.filter((t) => t.name !== template.name), template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  addCustomTemplates: (templates) =>
    set((state) => {
      const byName = new Map(state.customLibrary.map((t) => [t.name, t]))
      // Only add templates that don't already exist (don't overwrite user edits).
      templates.forEach((t) => {
        if (!byName.has(t.name)) byName.set(t.name, t)
      })
      const next = Array.from(byName.values())
      persistCustomLibrary(next)
      templates.forEach((template) => {
        if (template.rentmanId) upsertCachedRentmanTemplate(template)
      })
      return { customLibrary: next }
    }),
  removeCustomTemplate: (name) =>
    set((state) => {
      const next = state.customLibrary.filter((t) => t.name !== name)
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomTemplateCategory: (name, category) =>
    set((state) => {
      const cat = category.trim() || 'Sonstiges'
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, category: cat } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  updateCustomTemplate: (currentName, patch) =>
    set((state) => {
      const newName = patch.name?.trim() || currentName
      const newCat = patch.category?.trim() || undefined
      const next = state.customLibrary.map((t) => {
        if (t.name !== currentName) return t
        return {
          ...t,
          name: newName,
          ...(newCat ? { category: newCat } : {}),
        }
      })
      persistCustomLibrary(next)
      const cats = new Set(state.knownCategories)
      if (newCat) cats.add(newCat)
      const catsSorted = Array.from(cats).sort((a, b) => a.localeCompare(b))
      persistKnownCategories(catsSorted)
      return { customLibrary: next, knownCategories: catsSorted }
    }),
  renameCustomCategory: (oldCategory, newCategory) =>
    set((state) => {
      const from = oldCategory.trim()
      const to = newCategory.trim()
      if (!from || !to || from === to) return {}
      const next = state.customLibrary.map((t) =>
        t.category === from ? { ...t, category: to } : t,
      )
      persistCustomLibrary(next)
      const cats = new Set(state.knownCategories)
      cats.add(to)
      const catsSorted = Array.from(cats).sort((a, b) => a.localeCompare(b))
      persistKnownCategories(catsSorted)
      return { customLibrary: next, knownCategories: catsSorted }
    }),
  addKnownCategories: (categories) =>
    set((state) => {
      const set_ = new Set(state.knownCategories)
      categories.forEach((c) => {
        const trimmed = c.trim()
        if (trimmed) set_.add(trimmed)
      })
      const next = Array.from(set_).sort((a, b) => a.localeCompare(b))
      persistKnownCategories(next)
      return { knownCategories: next }
    }),
  saveEquipmentAsTemplate: (equipmentId) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      // Build a template from the live equipment item (strip placement fields).
      const template: EquipmentTemplate = {
        name: item.name,
        category: item.category || 'Sonstiges',
        inputs: item.inputs,
        outputs: item.outputs,
        width: item.width,
        height: item.height,
        rentmanId: item.rentmanId,
        ipAddress: item.ipAddress,
        subnetMask: item.subnetMask,
        macAddress: item.macAddress,
        username: item.username,
        password: item.password,
        notes: item.notes,
        vlans: item.vlans,
        managementVlanId: item.managementVlanId,
        gateway: item.gateway,
        dnsServers: item.dnsServers,
        mgmtUrl: item.mgmtUrl,
        firmware: item.firmware,
        portVlans: item.portVlans,
        sdiCaps: item.sdiCaps,
        atemMvConfig: item.atemMvConfig,
        favorite: state.customLibrary.find((t) => t.name === item.name)?.favorite,
        hidden: state.customLibrary.find((t) => t.name === item.name)?.hidden,
      }
      const next = [
        ...state.customLibrary.filter((t) => t.name !== template.name),
        template,
      ]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  saveEquipmentAsNewTemplate: (equipmentId, newName, category) =>
    set((state) => {
      const item = state.project.equipment.find((e) => e.id === equipmentId)
      if (!item) return {}
      const trimmed = newName.trim()
      if (!trimmed) return {}
      // If the target name already exists we treat the whole operation as a
      // no-op so we never accidentally overwrite a different template.
      if (state.customLibrary.some((t) => t.name === trimmed)) return {}
      const template: EquipmentTemplate = {
        name: trimmed,
        category: (category || item.category || 'Sonstiges').trim() || 'Sonstiges',
        inputs: item.inputs,
        outputs: item.outputs,
        width: item.width,
        height: item.height,
        rentmanId: item.rentmanId,
        ipAddress: item.ipAddress,
        subnetMask: item.subnetMask,
        macAddress: item.macAddress,
        username: item.username,
        password: item.password,
        notes: item.notes,
        vlans: item.vlans,
        managementVlanId: item.managementVlanId,
        gateway: item.gateway,
        dnsServers: item.dnsServers,
        mgmtUrl: item.mgmtUrl,
        firmware: item.firmware,
        portVlans: item.portVlans,
        sdiCaps: item.sdiCaps,
        atemMvConfig: item.atemMvConfig,
      }
      const next = [...state.customLibrary, template]
      persistCustomLibrary(next)
      if (template.rentmanId) upsertCachedRentmanTemplate(template)
      return { customLibrary: next }
    }),
  toggleTemplateFavorite: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, favorite: !t.favorite } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  toggleTemplateHidden: (name) =>
    set((state) => {
      const next = state.customLibrary.map((t) =>
        t.name === name ? { ...t, hidden: !t.hidden } : t,
      )
      persistCustomLibrary(next)
      return { customLibrary: next }
    }),
  setCustomLibrary: (templates) =>
    set(() => {
      persistCustomLibrary(templates)
      return { customLibrary: templates }
    }),
  groupPresets: loadGroupPresets(),
  addGroupPreset: (preset) =>
    set((state) => {
      const next = [...state.groupPresets.filter((p) => p.id !== preset.id), preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  saveGroupPreset: (name, equipmentIds) =>
    set((state) => {
      const items = state.project.equipment.filter((e) => equipmentIds.includes(e.id))
      if (items.length < 2) return {}
      const minX = Math.min(...items.map((e) => e.x))
      const minY = Math.min(...items.map((e) => e.y))
      const idToIndex = new Map(items.map((e, i) => [e.id, i]))
      const idSet = new Set(equipmentIds)
      const internalCables = state.project.cables.filter(
        (c) => idSet.has(c.fromEquipmentId) && idSet.has(c.toEquipmentId),
      )
      const cableStubs = internalCables.map((c) => {
        const fromIdx = idToIndex.get(c.fromEquipmentId)!
        const toIdx = idToIndex.get(c.toEquipmentId)!
        const fromItem = items[fromIdx]
        const toItem = items[toIdx]
        const fromPort = [...fromItem.outputs, ...fromItem.inputs].find((p) => p.id === c.fromPortId)
        const toPort = [...toItem.inputs, ...toItem.outputs].find((p) => p.id === c.toPortId)
        return {
          fromItemIndex: fromIdx,
          fromPortName: fromPort?.name ?? '',
          toItemIndex: toIdx,
          toPortName: toPort?.name ?? '',
          name: c.name,
          type: c.type,
          length: c.length,
          color: c.color,
          standard: c.standard,
        }
      })
      const preset: GroupPreset = {
        id: uuidv4(),
        name,
        items: items.map((e) => ({
          name: e.name,
          category: e.category,
          inputs: e.inputs,
          outputs: e.outputs,
          width: e.width,
          height: e.height,
          notes: e.notes,
          ipAddress: e.ipAddress,
          resolution: e.resolution,
          displaySizeInch: e.displaySizeInch,
          offsetX: e.x - minX,
          offsetY: e.y - minY,
        })),
        cables: cableStubs,
      }
      const next = [...state.groupPresets, preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  deleteGroupPreset: (id) =>
    set((state) => {
      const next = state.groupPresets.filter((p) => p.id !== id)
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  setGroupPresets: (presets) =>
    set(() => {
      persistGroupPresets(presets)
      return { groupPresets: presets }
    }),
  placeGroupPreset: (presetId, x, y) =>
    set((state) => {
      const preset = state.groupPresets.find((p) => p.id === presetId)
      if (!preset) return {}
      // Create new equipment items with fresh IDs and port IDs.
      const newEquipment: EquipmentItem[] = preset.items.map((item) => ({
        ...item,
        id: uuidv4(),
        x: x + item.offsetX,
        y: y + item.offsetY,
        inputs: item.inputs.map((p) => ({ ...p, id: uuidv4() })),
        outputs: item.outputs.map((p) => ({ ...p, id: uuidv4() })),
      }))
      // Build (itemIndex:portName) → new port ID lookup
      const portIdMap = new Map<string, string>()
      newEquipment.forEach((eq, idx) => {
        for (const p of [...eq.inputs, ...eq.outputs]) {
          portIdMap.set(`${idx}:${p.name}`, p.id)
        }
      })
      // Recreate cables between the newly placed items.
      const newCables = preset.cables
        .map((stub): Cable | null => {
          const fromEqId = newEquipment[stub.fromItemIndex]?.id
          const toEqId = newEquipment[stub.toItemIndex]?.id
          const fromPortId = portIdMap.get(`${stub.fromItemIndex}:${stub.fromPortName}`)
          const toPortId = portIdMap.get(`${stub.toItemIndex}:${stub.toPortName}`)
          if (!fromEqId || !toEqId || !fromPortId || !toPortId) return null
          return {
            id: uuidv4(),
            name: stub.name,
            type: stub.type as Cable['type'],
            length: stub.length,
            color: stub.color ?? '#64748b',
            fromEquipmentId: fromEqId,
            fromPortId,
            toEquipmentId: toEqId,
            toPortId,
            notes: '',
            standard: stub.standard as Cable['standard'],
          }
        })
        .filter((c): c is Cable => c !== null)
      const updated = touchProject({
        ...state.project,
        equipment: [...state.project.equipment, ...newEquipment],
        cables: [...state.project.cables, ...newCables],
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  updateGreenGoConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, greengoConfig: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
}))

// Autosave the working project to localStorage whenever it changes.
useProjectStore.subscribe((state, prev) => {
  if (state.project !== prev.project) {
    scheduleProjectAutosave(state.project)
  }
})

export const getProjectPayload = () => useProjectStore.getState().project
