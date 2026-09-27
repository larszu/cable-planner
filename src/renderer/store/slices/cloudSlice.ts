import type { StateCreator } from 'zustand'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/** #871 — die Verbindung des offenen Projekts zu seinem Cloud-Projekt. */
export type CloudSlice = Pick<ProjectState, 'setCloudBinding' | 'applyCloudProject'>

export const createCloudSlice: StateCreator<ProjectState, [], [], CloudSlice> = (set, get) => ({
  setCloudBinding: (binding) =>
    set((state) => {
      const { cloud: _alt, ...rest } = state.project
      void _alt
      const updated = binding ? { ...rest, cloud: binding } : rest
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // Ueber `loadProject`, damit die Cloud-Fassung dieselbe Heilung
  // (`healProjectPositions`) durchlaeuft wie jede geoeffnete Datei — sie kann
  // von einer aelteren App-Version stammen. Die Datei bleibt dieselbe.
  applyCloudProject: (project) => {
    get().loadProject(project, get().filePath)
    scheduleProjectAutosave(get().project)
  },
})
