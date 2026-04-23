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

/** Strip characters Windows / POSIX forbid in file names. */
const sanitizeFileName = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) return 'cable-project'
  // Windows: < > : " / \ | ? *  +  control chars
  // eslint-disable-next-line no-control-regex
  const cleaned = trimmed.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.+$/, '')
  return cleaned || 'cable-project'
}

const defaultSavePath = (project: unknown): string => {
  const name =
    project && typeof project === 'object' && 'metadata' in project
      ? String(((project as { metadata?: { name?: unknown } }).metadata?.name ?? '')).trim()
      : ''
  return `${sanitizeFileName(name || 'cable-project')}.json`
}

const ensureJsonExtension = (filePath: string): string =>
  filePath.toLowerCase().endsWith('.json') ? filePath : `${filePath}.json`

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
        defaultPath: defaultSavePath(project),
        filters: [{ name: 'Cable Planner Project', extensions: ['json'] }],
      })

      if (canceled || !filePath) {
        return null
      }

      targetPath = ensureJsonExtension(filePath)
    } else {
      targetPath = ensureJsonExtension(targetPath)
    }

    await writeFile(targetPath, JSON.stringify(project, null, 2), 'utf-8')
    await writeRecent(targetPath)
    return targetPath
  })

  ipcMain.handle('project:save-as', async (_event, project: unknown) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Cable Planner Project As',
      defaultPath: defaultSavePath(project),
      filters: [{ name: 'Cable Planner Project', extensions: ['json'] }],
    })

    if (canceled || !filePath) {
      return null
    }

    const target = ensureJsonExtension(filePath)
    await writeFile(target, JSON.stringify(project, null, 2), 'utf-8')
    await writeRecent(target)
    return target
  })

  ipcMain.handle('project:get-recent', () => readRecent())
}
