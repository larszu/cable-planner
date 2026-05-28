import type { StateCreator } from 'zustand'
import { defaultProject, isProjectLocked, touchProject } from '../projectStoreHelpers'
import { clearProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Selection-Lifecycle-Slice. Zwei Quer-Funktionale Actions
 * die nicht in eine einzelne Domain-Slice passen:
 *
 *  - deleteSelected: schaut nach welcher Slot gerade aktiv ist
 *    (Cable > Location > Equipment, Prioritaet absteigend) und
 *    loescht den. Equipment-Delete cascadet auf Cables die das
 *    Geraet anfassen.
 *
 *  - clear: setzt das Projekt auf einen frischen defaultProject()-
 *    Stand zurueck + droppt den persisted autosave-snapshot
 *    (damit beim naechsten App-Start kein altes Projekt
 *    automatisch geladen wird).
 */
export type SelectionLifecycleSlice = Pick<ProjectState, 'deleteSelected' | 'clear'>

export const createSelectionLifecycleSlice: StateCreator<
  ProjectState,
  [],
  [],
  SelectionLifecycleSlice
> = (set) => ({
  deleteSelected: () =>
    set((state) => {
      if (isProjectLocked(state)) return state
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
  clear: () => {
    // Also drop the persisted autosave copy — otherwise the old project
    // would come back on the next app launch, which is surprising when the
    // user explicitly started a fresh project.
    clearProjectAutosave()
    set((state) => ({
      project: defaultProject(),
      filePath: undefined,
      projectVersion: state.projectVersion + 1,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
    }))
  },
})
