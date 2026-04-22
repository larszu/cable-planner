import { v4 as uuidv4 } from 'uuid'
import { create } from 'zustand'
import type { Connection } from 'reactflow'
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import type { CablePlannerProject } from '../types/project'

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'>

interface ProjectState {
  project: CablePlannerProject
  filePath?: string
  selectedEquipmentId?: string
  selectedCableId?: string
  pendingConnection?: Connection
  showCableDialog: boolean
  recentProjects: string[]
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
  clear: () => void
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
})

export const useProjectStore = create<ProjectState>((set) => ({
  project: defaultProject(),
  showCableDialog: false,
  recentProjects: [],
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
      if (!state.pendingConnection.source || !state.pendingConnection.target) {
        return { pendingConnection: undefined, showCableDialog: false }
      }

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
  clear: () => set({ project: defaultProject(), filePath: undefined, selectedEquipmentId: undefined, selectedCableId: undefined }),
}))

export const getProjectPayload = () => useProjectStore.getState().project
