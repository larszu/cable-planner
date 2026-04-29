import { useCallback } from 'react'
import { cablePlannerApi } from '../lib/bridge'
import { useProjectStore } from '../store/projectStore'
import { projectHistory } from '../store/projectHistory'
import type { CablePlannerProject } from '../types/project'

interface OpenProjectResponse {
  filePath: string
  data: CablePlannerProject
}

/** Derive a human-readable project name from a file path (drops extension). */
const nameFromPath = (filePath: string): string => {
  const base = filePath.split(/[\\/]/).pop() ?? filePath
  return base.replace(/\.json$/i, '')
}

export const useProject = () => {
  const loadProject = useProjectStore((state) => state.loadProject)
  const setRecentProjects = useProjectStore((state) => state.setRecentProjects)
  const setProjectMeta = useProjectStore((state) => state.setProjectMeta)
  const clear = useProjectStore((state) => state.clear)

  const refreshRecent = useCallback(async () => {
    const recents = await cablePlannerApi.project.getRecentProjects()
    setRecentProjects(recents)
  }, [setRecentProjects])

  const newProject = useCallback(async () => {
    await cablePlannerApi.project.newProject()
    clear()
    projectHistory.reset()
    await refreshRecent()
  }, [clear, refreshRecent])

  const openProject = useCallback(async () => {
    const result = (await cablePlannerApi.project.openProject()) as OpenProjectResponse | null
    if (result) {
      console.log('[openProject] from disk', {
        filePath: result.filePath,
        equipmentCount: result.data?.equipment?.length,
        firstThreePositions: result.data?.equipment?.slice(0, 3).map((e) => ({
          name: e.name,
          x: e.x,
          y: e.y,
        })),
      })
      // Sync metadata.name with filename if project still has the default name.
      const incoming = result.data
      if (
        incoming?.metadata?.name === 'Untitled Project' ||
        !incoming?.metadata?.name
      ) {
        incoming.metadata = {
          ...incoming.metadata,
          name: nameFromPath(result.filePath),
        }
      }
      loadProject(incoming, result.filePath)
      projectHistory.reset()
      await refreshRecent()
    }
  }, [loadProject, refreshRecent])

  const saveProject = useCallback(async () => {
    const { project, filePath } = useProjectStore.getState()
    console.log('[saveProject] from store', {
      equipmentCount: project.equipment.length,
      firstThreePositions: project.equipment.slice(0, 3).map((e) => ({
        name: e.name,
        x: e.x,
        y: e.y,
      })),
    })
    const path = await cablePlannerApi.project.saveProject(project, filePath)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      // If the project still has the default name, adopt the chosen filename.
      if (!filePath && project.metadata.name === 'Untitled Project') {
        setProjectMeta(nameFromPath(path), project.metadata.description ?? '')
      }
      await refreshRecent()
    }
  }, [refreshRecent, setProjectMeta])

  const saveProjectAs = useCallback(async () => {
    const { project } = useProjectStore.getState()
    const path = await cablePlannerApi.project.saveProjectAs(project)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      if (project.metadata.name === 'Untitled Project') {
        setProjectMeta(nameFromPath(path), project.metadata.description ?? '')
      }
      await refreshRecent()
    }
  }, [refreshRecent, setProjectMeta])

  return {
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    refreshRecent,
  }
}
