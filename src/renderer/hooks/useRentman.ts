import { useCallback } from 'react'
import { cablePlannerApi } from '../lib/bridge'

export const useRentman = () => {
  const loadProjects = useCallback(() => cablePlannerApi.rentman.getProjects(), [])
  const loadProjectEquipment = useCallback(
    (projectId: string) => cablePlannerApi.rentman.getProjectEquipment(projectId),
    [],
  )
  const loadFolders = useCallback(() => cablePlannerApi.rentman.getEquipmentFolders(), [])
  const loadEquipment = useCallback(() => cablePlannerApi.rentman.getEquipment(), [])
  const addProjectEquipment = useCallback(
    (projectId: string, equipmentId: string, quantity: number = 1) =>
      cablePlannerApi.rentman.addProjectEquipment(projectId, equipmentId, quantity),
    [],
  )
  /**
   * v7.9.110 — Batch-Export in eine 'CablePlanner'-EquipmentGroup im
   * Rentman-Projekt. Gruppe wird angelegt falls noch nicht vorhanden,
   * sonst wiederverwendet. Bevorzugt gegenueber addProjectEquipment fuer
   * alles was Cable-Planner nach Rentman schiebt — landet sortiert in
   * einer dedizierten Gruppe statt verstreut im Projekt.
   */
  const exportToCablePlannerGroup = useCallback(
    (
      projectId: string,
      items: Array<{ equipmentId: string; quantity: number }>,
    ) => cablePlannerApi.rentman.exportToCablePlannerGroup(projectId, items),
    [],
  )
  const addProjectFile = useCallback(
    (projectId: string, fileName: string, fileBytes: Uint8Array, mimeType?: string) =>
      cablePlannerApi.rentman.addProjectFile(projectId, fileName, fileBytes, mimeType),
    [],
  )

  return {
    loadProjects,
    loadProjectEquipment,
    loadFolders,
    loadEquipment,
    addProjectEquipment,
    exportToCablePlannerGroup,
    addProjectFile,
  }
}
