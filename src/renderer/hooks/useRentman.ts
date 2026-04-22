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

  return {
    loadProjects,
    loadProjectEquipment,
    loadFolders,
    loadEquipment,
  }
}
