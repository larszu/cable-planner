import type { StateCreator } from 'zustand'
import type { CablePlannerProject } from '../../types/project'
import { touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — MetaSlice. Kleine Setter ohne komplexes Cross-Domain-State:
 *  - File-State: setRecentProjects, setFilePath
 *  - Metadata: setProjectMeta (name+description), updateProjectMetadata
 *    (partieller Patch), setDefaultVideoFormat
 *  - Canvas-Viewport: setCanvasState (x/y/zoom — persistiert mit dem
 *    Projekt damit Reopen den Viewport restored)
 *  - Selection-State: setSelection, setSelectedTemplateName
 *  - Sonstiges: updateGreenGoConfig (eine eigene Slice waere overkill)
 *
 * Lock-Check fehlt absichtlich — Metadata-Felder duerfen auch im
 * Viewer-Modus angepasst werden (Project-Author bei Plan-Annahme,
 * RecentProjects-Liste sowieso).
 */
export type MetaSlice = Pick<
  ProjectState,
  | 'setRecentProjects'
  | 'setFilePath'
  | 'setProjectMeta'
  | 'updateProjectMetadata'
  | 'setDefaultVideoFormat'
  | 'setCanvasState'
  | 'setSelection'
  | 'setSelectedTemplateName'
  | 'updateGreenGoConfig'
  | 'setDrumKit'
  | 'setWirelessRig'
>

export const createMetaSlice: StateCreator<ProjectState, [], [], MetaSlice> = (set) => ({
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
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
  updateGreenGoConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, greengoConfig: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setDrumKit: (plan) =>
    set((state) => {
      const updated = { ...state.project, drumKit: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setWirelessRig: (plan) =>
    set((state) => {
      const updated = { ...state.project, wirelessRig: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
