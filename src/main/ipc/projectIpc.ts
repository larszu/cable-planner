import { app, dialog, ipcMain } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RECENT_PATH = path.join(app.getPath('userData'), 'recent-projects.json')

const readRecent = async (): Promise<string[]> => {
  try {
    const content = await readFile(RECENT_PATH, 'utf-8')
    return JSON.parse(content) as string[]
  } catch {
    return []
  }
}

const writeRecent = async (filePath: string) => {
  const existing = await readRecent()
  const dedupe = [filePath, ...existing.filter((item) => item !== filePath)].slice(0, 10)
  await mkdir(path.dirname(RECENT_PATH), { recursive: true })
  await writeFile(RECENT_PATH, JSON.stringify(dedupe, null, 2), 'utf-8')
}

export const registerProjectIpc = () => {
  ipcMain.handle('project:new', async () => null)

  ipcMain.handle('project:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Cable Planner Project',
      filters: [{ name: 'Cable Planner Project', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    const filePath = filePaths[0]
    const content = await readFile(filePath, 'utf-8')
    await writeRecent(filePath)

    return {
      filePath,
      data: JSON.parse(content),
    }
  })

  ipcMain.handle('project:save', async (_event, project: unknown, currentPath?: string) => {
    let targetPath = currentPath

    if (!targetPath) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Cable Planner Project',
        defaultPath: 'cable-project.json',
        filters: [{ name: 'Cable Planner Project', extensions: ['json'] }],
      })

      if (canceled || !filePath) {
        return null
      }

      targetPath = filePath
    }

    await writeFile(targetPath, JSON.stringify(project, null, 2), 'utf-8')
    await writeRecent(targetPath)
    return targetPath
  })

  ipcMain.handle('project:save-as', async (_event, project: unknown) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Cable Planner Project As',
      defaultPath: 'cable-project.json',
      filters: [{ name: 'Cable Planner Project', extensions: ['json'] }],
    })

    if (canceled || !filePath) {
      return null
    }

    await writeFile(filePath, JSON.stringify(project, null, 2), 'utf-8')
    await writeRecent(filePath)
    return filePath
  })

  ipcMain.handle('project:get-recent', () => readRecent())
}
