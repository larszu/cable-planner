import { useCallback } from 'react'
import { cablePlannerApi } from '../lib/bridge'
import { useProjectStore } from '../store/projectStore'
import type { CablePlannerProject } from '../types/project'

interface OpenProjectResponse {
  filePath: string
  data: CablePlannerProject
}

export const useProject = () => {
  const loadProject = useProjectStore((state) => state.loadProject)
  const setRecentProjects = useProjectStore((state) => state.setRecentProjects)
  const clear = useProjectStore((state) => state.clear)
  const project = useProjectStore((state) => state.project)
  const filePath = useProjectStore((state) => state.filePath)

  const refreshRecent = useCallback(async () => {
    const recents = await cablePlannerApi.project.getRecentProjects()
    setRecentProjects(recents)
  }, [setRecentProjects])

  const newProject = useCallback(async () => {
    await cablePlannerApi.project.newProject()
    clear()
    await refreshRecent()
  }, [clear, refreshRecent])

  const openProject = useCallback(async () => {
    const result = (await cablePlannerApi.project.openProject()) as OpenProjectResponse | null
    if (result) {
      loadProject(result.data, result.filePath)
      await refreshRecent()
    }
  }, [loadProject, refreshRecent])

  const saveProject = useCallback(async () => {
    const path = await cablePlannerApi.project.saveProject(project, filePath)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      await refreshRecent()
    }
  }, [filePath, project, refreshRecent])

  const saveProjectAs = useCallback(async () => {
    const path = await cablePlannerApi.project.saveProjectAs(project)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      await refreshRecent()
    }
  }, [project, refreshRecent])

  return {
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    refreshRecent,
  }
}
