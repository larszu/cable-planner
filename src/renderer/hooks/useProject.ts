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
  const project = useProjectStore((state) => state.project)
  const filePath = useProjectStore((state) => state.filePath)

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
    const path = await cablePlannerApi.project.saveProject(project, filePath)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      // If the project still has the default name, adopt the chosen filename.
      if (!filePath && project.metadata.name === 'Untitled Project') {
        setProjectMeta(nameFromPath(path), project.metadata.description ?? '')
      }
      await refreshRecent()
    }
  }, [filePath, project, refreshRecent, setProjectMeta])

  const saveProjectAs = useCallback(async () => {
    const path = await cablePlannerApi.project.saveProjectAs(project)
    if (path) {
      useProjectStore.getState().setFilePath(path)
      if (project.metadata.name === 'Untitled Project') {
        setProjectMeta(nameFromPath(path), project.metadata.description ?? '')
      }
      await refreshRecent()
    }
  }, [project, refreshRecent, setProjectMeta])

  return {
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    refreshRecent,
  }
}
