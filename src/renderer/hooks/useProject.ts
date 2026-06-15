import { useCallback } from 'react'
import { cablePlannerApi } from '../lib/bridge'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import { projectHistory } from '../store/projectHistory'
import type { CablePlannerProject } from '../types/project'
import { promptDialog } from '../lib/promptDialog'
import { infoDialog } from '../lib/infoDialog'
import { translate } from '../lib/i18n'

interface OpenProjectResponse {
  filePath: string
  data: CablePlannerProject
}

/** Derive a human-readable project name from a file path (drops extension). */
const nameFromPath = (filePath: string): string => {
  const base = filePath.split(/[\\/]/).pop() ?? filePath
  // #pre-sale — .cableplan ist die neue Projekt-Endung; .json/.cpviewer
  // bleiben abwärtskompatibel.
  return base.replace(/\.(cableplan|json|cpviewer)$/i, '')
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

  // Gemeinsamer Loader für alle Öffnen-Pfade (Dialog, OS-Doppelklick beim
  // Kaltstart, Doppelklick bei laufender App). Synct den Namen, fragt bei
  // Viewer-Dateien den Reviewer-Namen ab und lädt das Projekt in den Store.
  const applyOpenedProject = useCallback(
    async (result: OpenProjectResponse) => {
      console.log('[openProject] load', {
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
      // v7.9.3 — Beim Öffnen einer .cpviewer-Datei (oder eines Projekts
      // mit mode='viewer') den Reviewer-Namen abfragen und in
      // viewerSession ablegen. Wenn schon eine Session existiert
      // (z.B. der gleiche Reviewer öffnet die Datei ein zweites Mal),
      // re-prompten wir mit dem alten Namen vorbelegt.
      const isViewer =
        result.filePath.toLowerCase().endsWith('.cpviewer') ||
        (incoming as { mode?: string })?.mode === 'viewer'
      if (isViewer) {
        const lang = useUiStore.getState().language
        const oldAuthor =
          (incoming as { viewerSession?: { author?: string } })?.viewerSession?.author ?? ''
        const author = (await promptDialog(
          translate(
            lang,
            'project.viewerName.prompt',
            'Viewer-Datei — Name eingeben\n\n' +
              'Du öffnest eine Viewer-Datei zum Begutachten. Bitte gib deinen Namen ' +
              'ein — er wird allen Anmerkungen angeheftet, die du in dieser Session erstellst.',
          ),
          oldAuthor,
        ))?.trim()
        if (author) {
          ;(incoming as unknown as Record<string, unknown>).viewerSession = {
            author,
            startedAt: new Date().toISOString(),
          }
          ;(incoming as unknown as Record<string, unknown>).mode = 'viewer'
        } else {
          await infoDialog(translate(lang, 'project.viewerName.missingTitle', 'Name fehlt'), {
            body: translate(
              lang,
              'project.viewerName.missingBody',
              'Ohne Namen können keine Anmerkungen gemacht werden. Die Datei wird nicht geladen.',
            ),
            tone: 'warning',
          })
          return
        }
      }
      loadProject(incoming, result.filePath)
      projectHistory.reset()
      await refreshRecent()
    },
    [loadProject, refreshRecent],
  )

  const openProject = useCallback(async () => {
    const result = (await cablePlannerApi.project.openProject()) as OpenProjectResponse | null
    if (result) await applyOpenedProject(result)
  }, [applyOpenedProject])

  // #pre-sale — beim Kaltstart per OS-Doppelklick übergebene Datei laden.
  const openLaunchFile = useCallback(async () => {
    const result = await cablePlannerApi.project.getLaunchFile()
    if (result) await applyOpenedProject(result as OpenProjectResponse)
  }, [applyOpenedProject])

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
    openLaunchFile,
    applyOpenedProject,
    saveProject,
    saveProjectAs,
    refreshRecent,
  }
}
