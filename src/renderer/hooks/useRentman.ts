import { useCallback } from 'react'

export const useRentman = () => {
  const loadProjects = useCallback(() => window.cablePlanner.rentman.getProjects(), [])
  const loadProjectEquipment = useCallback(
    (projectId: string) => window.cablePlanner.rentman.getProjectEquipment(projectId),
    [],
  )
  const loadFolders = useCallback(() => window.cablePlanner.rentman.getEquipmentFolders(), [])

  return {
    loadProjects,
    loadProjectEquipment,
    loadFolders,
  }
}
