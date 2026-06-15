import { app, dialog, ipcMain, type BrowserWindow } from 'electron'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from '../util/atomicWrite.js'
import { takePendingLaunchPath } from '../services/fileOpenService.js'

const RECENT_PATH = path.join(app.getPath('userData'), 'recent-projects.json')

const readRecent = async (): Promise<string[]> => {
  try {
    const content = await readFile(RECENT_PATH, 'utf-8')
    const list = JSON.parse(content) as unknown
    if (!Array.isArray(list)) return []
    return list.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

// v7.9.91 — Recent-Pfade gegen Filesystem prüfen damit der User in
// der "Recent"-Liste keine längst gelöschten/verschobenen Files sieht.
// Stale Einträge werden silently aus der Persistenz entfernt.
const readRecentValid = async (): Promise<string[]> => {
  const stored = await readRecent()
  const valid: string[] = []
  for (const p of stored) {
    try {
      await access(p)
      valid.push(p)
    } catch {
      /* file gone — drop from list */
    }
  }
  if (valid.length !== stored.length) {
    // Persist die bereinigte Liste async im Hintergrund.
    void writeFile(RECENT_PATH, JSON.stringify(valid, null, 2), 'utf-8').catch(() => {})
  }
  return valid
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
  // #pre-sale — Eigene Projekt-Endung .cableplan (statt generischem .json),
  // damit Datei-Verknüpfung + eigenes Icon möglich sind. Inhalt bleibt JSON.
  return `${sanitizeFileName(name || 'cable-project')}.cableplan`
}

const defaultViewerPath = (project: unknown): string => {
  const name =
    project && typeof project === 'object' && 'metadata' in project
      ? String(((project as { metadata?: { name?: unknown } }).metadata?.name ?? '')).trim()
      : ''
  return `${sanitizeFileName(name || 'cable-project')}.cpviewer`
}

// #pre-sale — neue Projekte bekommen .cableplan; bereits als .json/.cpviewer
// gespeicherte Dateien behalten ihre Endung (Abwärtskompatibilität beim
// Re-Save eines alten Projekts).
const ensureProjectExtension = (filePath: string): string => {
  const lower = filePath.toLowerCase()
  return lower.endsWith('.cableplan') || lower.endsWith('.json') || lower.endsWith('.cpviewer')
    ? filePath
    : `${filePath}.cableplan`
}

const ensureViewerExtension = (filePath: string): string =>
  filePath.toLowerCase().endsWith('.cpviewer') ? filePath : `${filePath}.cpviewer`

// #pre-sale — Liest eine extern (Doppelklick/Argv) geöffnete Projektdatei und
// liefert das gleiche { filePath, data }-Format wie project:open zurück, damit
// der Renderer-Loader (useProject) wiederverwendet werden kann. Aktualisiert
// die Recent-Liste. Bei Lese-/Parse-Fehler: null (kein Crash).
const loadExternalPayload = async (
  filePath: string,
): Promise<{ filePath: string; data: unknown } | null> => {
  try {
    const content = await readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    await writeRecent(filePath)
    return { filePath, data }
  } catch (err) {
    console.error('[project] open-external failed:', (err as Error)?.message ?? err)
    return null
  }
}

// #pre-sale — Schiebt eine extern geöffnete Datei in einen bereits laufenden
// Renderer (zweite Instanz auf Win/Linux, open-file auf macOS). Cold-Start
// läuft stattdessen über project:get-launch-file (Renderer holt ab).
export const openExternalProject = async (
  win: BrowserWindow | null,
  filePath: string,
): Promise<void> => {
  if (!win || win.isDestroyed()) return
  const payload = await loadExternalPayload(filePath)
  if (payload) win.webContents.send('project:open-external', payload)
}

export const registerProjectIpc = () => {
  ipcMain.handle('project:new', async () => null)

  ipcMain.handle('project:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Open Cable Planner Project',
      filters: [
        // v7.9.3 — .cpviewer ist eine Read-only Variante der normalen
        // JSON-Datei (gleicher Inhalt + project.mode='viewer').
        { name: 'Cable Planner Project / Viewer', extensions: ['cableplan', 'json', 'cpviewer'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Viewer (read-only)', extensions: ['cpviewer'] },
      ],
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

  // v7.9.3 — Viewer-File-Export: gleiche JSON-Struktur wie save, aber
  // mit erzwungenem mode='viewer' und .cpviewer-Extension. Reviewer
  // beim Öffnen werden nach Namen gefragt (App.tsx Loader).
  ipcMain.handle('project:export-viewer', async (_event, project: unknown) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Als Viewer-Datei exportieren',
      defaultPath: defaultViewerPath(project),
      filters: [{ name: 'Cable Planner Viewer', extensions: ['cpviewer'] }],
    })
    if (canceled || !filePath) return null
    const target = ensureViewerExtension(filePath)
    // mode='viewer' erzwingen; bestehende Annotations aber NICHT
    // wegwerfen (der Plan-Eigentümer kann auch Pre-Annotations setzen,
    // z.B. "TODO: Cable XY checken" für die Freelancer).
    const safe = JSON.parse(JSON.stringify(project)) as Record<string, unknown>
    safe.mode = 'viewer'
    // viewerSession beim Export leeren — der Reviewer setzt seinen
    // eigenen Namen beim ersten Öffnen.
    delete safe.viewerSession
    await atomicWriteFile(target, JSON.stringify(safe, null, 2))
    return target
  })

  // v7.9.3 — Annotations-Re-Import: liest eine .cpviewer-Datei und
  // gibt NUR die annotations[] zurück. Plan-Eigentümer mergen das
  // dann ins Original (im Renderer, siehe importAnnotations Action).
  ipcMain.handle('project:import-annotations', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Anmerkungen aus Viewer-Datei importieren',
      filters: [
        { name: 'Cable Planner Viewer / JSON', extensions: ['cpviewer', 'json'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    const content = await readFile(filePaths[0], 'utf-8')
    try {
      const parsed = JSON.parse(content) as { annotations?: unknown[] }
      const annotations = Array.isArray(parsed.annotations) ? parsed.annotations : []
      return { filePath: filePaths[0], annotations }
    } catch {
      return { filePath: filePaths[0], annotations: [] }
    }
  })

  ipcMain.handle('project:save', async (_event, project: unknown, currentPath?: string) => {
    let targetPath = currentPath

    if (!targetPath) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Cable Planner Project',
        defaultPath: defaultSavePath(project),
        filters: [{ name: 'Cable Planner Project', extensions: ['cableplan', 'json'] }],
      })

      if (canceled || !filePath) {
        return null
      }

      targetPath = ensureProjectExtension(filePath)
    } else {
      targetPath = ensureProjectExtension(targetPath)
    }

    await atomicWriteFile(targetPath, JSON.stringify(project, null, 2))
    await writeRecent(targetPath)
    return targetPath
  })

  ipcMain.handle('project:save-as', async (_event, project: unknown) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Cable Planner Project As',
      defaultPath: defaultSavePath(project),
      filters: [{ name: 'Cable Planner Project', extensions: ['cableplan', 'json'] }],
    })

    if (canceled || !filePath) {
      return null
    }

    const target = ensureProjectExtension(filePath)
    await atomicWriteFile(target, JSON.stringify(project, null, 2))
    await writeRecent(target)
    return target
  })

  ipcMain.handle('project:get-recent', () => readRecentValid())

  // #pre-sale — Kaltstart-Öffnen: der Renderer holt beim Mounten die per
  // OS-Doppelklick übergebene Datei ab (über process.argv / open-file vor
  // whenReady gepuffert). takePendingLaunchPath leert den Puffer → genau
  // einmal laden. Null wenn ohne Datei gestartet wurde.
  ipcMain.handle('project:get-launch-file', async () => {
    const pending = takePendingLaunchPath()
    return pending ? loadExternalPayload(pending) : null
  })
}
