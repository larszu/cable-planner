import { v4 as uuidv4 } from 'uuid'
import { create } from 'zustand'
import type { Connection } from 'reactflow'
import type { Cable } from '../types/cable'
import type { EquipmentItem, EquipmentTemplate, Port } from '../types/equipment'
import type { CablePlannerProject } from '../types/project'
import { useUiStore } from './uiStore'

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
  Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

const CUSTOM_LIB_KEY = 'cable-planner:customLibrary'
const PROJECT_AUTOSAVE_KEY = 'cable-planner:projectAutosave'
const KNOWN_CATEGORIES_KEY = 'cable-planner:knownCategories'
const LIB_MIGRATION_KEY = 'cable-planner:libMigration'
const LIB_MIGRATION_VERSION = '2026-04-reset'

const DEFAULT_CATEGORIES = [
  'Kameras',
  'Objektive',
  'Stative',
  'Licht',
  'Audio',
  'Video',
  'Monitore',
  'Netzwerk',
  'Kabel',
  'Strom',
  'Rigging',
  'Sonstiges',
]

const runLibraryMigration = () => {
  try {
    const current = localStorage.getItem(LIB_MIGRATION_KEY)
    if (current === LIB_MIGRATION_VERSION) return
    // One-time wipe: the previous build auto-generated bogus 1-in/1-out
    // templates for every Rentman device. Clear them so the user starts fresh.
    localStorage.removeItem(CUSTOM_LIB_KEY)
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
    return parsed
  } catch {
    return null
  }
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(project))
    } catch {
      /* quota errors are non-fatal */
    }
  }, 400)
}

interface ProjectState {
  project: CablePlannerProject
  filePath?: string
  selectedEquipmentId?: string
  selectedCableId?: string
  pendingConnection?: Connection
  showCableDialog: boolean
  recentProjects: string[]
  customLibrary: EquipmentTemplate[]
  setRecentProjects: (items: string[]) => void
  setFilePath: (path?: string) => void
  loadProject: (project: CablePlannerProject, filePath?: string) => void
  setProjectMeta: (name: string, description: string) => void
  setCanvasState: (x: number, y: number, zoom: number) => void
  addEquipment: (equipment: Omit<EquipmentItem, 'id'>) => void
  importEquipment: (equipment: EquipmentItem[]) => void
  updateEquipment: (id: string, patch: Partial<EquipmentItem>) => void
  setSelection: (equipmentId?: string, cableId?: string) => void
  queueConnection: (connection: Connection) => void
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
  knownCategories: string[]
  addKnownCategories: (categories: string[]) => void
}

const now = () => new Date().toISOString()

const defaultProject = (): CablePlannerProject => ({
  metadata: {
    name: 'Untitled Project',
    description: '',
    createdAt: now(),
    updatedAt: now(),
  },
  equipment: [],
  cables: [],
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
  id: port.id ?? uuidv4(),
  name: port.name ?? fallbackName,
  type: port.type ?? 'Custom',
  connectorType: port.connectorType ?? 'Custom',
  standard: port.standard,
})

export const useProjectStore = create<ProjectState>((set) => ({
  project: loadAutosavedProject() ?? defaultProject(),
  showCableDialog: false,
  recentProjects: [],
  customLibrary: loadCustomLibrary(),
  knownCategories: loadKnownCategories(),
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
  loadProject: (project, filePath) =>
    set({
      project,
      filePath,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      pendingConnection: undefined,
      showCableDialog: false,
    }),
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
  setCanvasState: (x, y, zoom) =>
    set((state) => ({
      project: {
        ...state.project,
        canvasState: { x, y, zoom },
      },
    })),
  addEquipment: (equipment) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, { ...equipment, id: uuidv4() }],
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
            inputs: item.inputs.map((p, index) => sanitizePort(p, `In ${index + 1}`)),
            outputs: item.outputs.map((p, index) => sanitizePort(p, `Out ${index + 1}`)),
          })),
        ],
      }),
    })),
  updateEquipment: (id, patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: state.project.equipment.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      }),
    })),
  setSelection: (equipmentId, cableId) => set({ selectedEquipmentId: equipmentId, selectedCableId: cableId }),
  queueConnection: (connection) => set({ pendingConnection: connection, showCableDialog: true }),
  closeCableDialog: () => set({ pendingConnection: undefined, showCableDialog: false }),
  createCableFromPending: (draft) =>
    set((state) => {
      if (!state.pendingConnection || !state.pendingConnection.source || !state.pendingConnection.target) {
        return { pendingConnection: undefined, showCableDialog: false }
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
        strokeWidth: 2.5,
      }

      return {
        project: touchProject({
          ...state.project,
          cables: [...state.project.cables, cable],
        }),
        pendingConnection: undefined,
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
  clear: () =>
    set({
      project: defaultProject(),
      filePath: undefined,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
    }),
  addCustomTemplate: (template) =>
    set((state) => {
      const next = [...state.customLibrary.filter((t) => t.name !== template.name), template]
      persistCustomLibrary(next)
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
}))

// Autosave the working project to localStorage whenever it changes.
useProjectStore.subscribe((state, prev) => {
  if (state.project !== prev.project) {
    scheduleProjectAutosave(state.project)
  }
})

export const getProjectPayload = () => useProjectStore.getState().project
