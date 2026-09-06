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
  | 'setMulticastConfig'
  | 'setFallbackPlan'
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
  // BEDARF 72 — Pool, Port und die vergebenen Gruppen.
  //
  // Ein Setter fuer das ganze Objekt und keiner je Vergabe: der Aufrufer ist
  // `allocateMulticast`, das die vollstaendige Liste zurueckgibt. Ein
  // Einzel-Setter verfuehrte dazu, in einer Schleife zu vergeben — und jede
  // Zwischenstufe waere ein Zustand, in dem die Alias-Pruefung die eigenen
  // frisch vergebenen Adressen noch nicht kennt.
  setMulticastConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, multicast: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 89 — das Sicherheitsnetz. Wieder ein Setter fuer das ganze Objekt:
  // Szenenliste, Waechter und Regeln haengen aneinander, und ein Einzel-Setter
  // je Regel liesse einen Zustand zu, in dem eine Regel auf eine Szene zeigt,
  // die die Liste noch nicht kennt — genau der Zustand, den die Pruefung
  // meldet, nur diesmal von der Oberflaeche selbst erzeugt.
  setFallbackPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, fallback: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
