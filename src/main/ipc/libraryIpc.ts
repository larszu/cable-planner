// v7.9.33 — Zentraler Library-Ordner.
//
// Jedes Library-Item (Gerät / Gruppe / Rack) liegt als eigene Datei in
//   userData/library/devices/<safe-name>.cpdevice
//   userData/library/groups/<safe-name>.cpgroup
//
// Use-Cases die das ermöglicht:
//  - Geräte/Racks zentral pflegen statt nur in localStorage pro Browser-
//    Profil zu hängen (überlebt App-Reinstall, ist per OS-Tools
//    versionierbar mit Dropbox/OneDrive/Git, etc.)
//  - Neue Projekte greifen automatisch auf die zentrale Library zu —
//    Datei reinkopieren reicht
//  - Per-Item-Versionierung (fileVersion + modifiedAt) damit Projekte
//    erkennen können wann ein Gerät updated wurde
//
// File-Format (self-describing JSON, kompatibel zu lib/itemExport.ts):
//   {
//     "type": "cable-planner-device" | "cable-planner-group",
//     "version": 1,                  // Format-Version
//     "fileVersion": <int>,          // Item-Revision, monoton steigend
//     "modifiedAt": "<ISO>",
//     "exportedAt": "<ISO>",
//     "template" | "preset": ...
//   }

import { app, ipcMain, shell } from 'electron'
import { mkdir, readdir, readFile, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from '../util/atomicWrite.js'

export type LibraryItemKind = 'device' | 'group'

interface LibraryFileEnvelope {
  type: 'cable-planner-device' | 'cable-planner-group'
  version: 1
  fileVersion: number
  modifiedAt: string
  exportedAt: string
  template?: unknown
  preset?: unknown
}

interface LibraryScanEntry {
  kind: LibraryItemKind
  fileName: string
  fileVersion: number
  modifiedAt: string
  /** The original payload — template (device) or preset (group). */
  payload: unknown
}

const libraryRoot = (): string => path.join(app.getPath('userData'), 'library')
const subdir = (kind: LibraryItemKind): string =>
  path.join(libraryRoot(), kind === 'device' ? 'devices' : 'groups')

const sanitize = (raw: string): string => {
  const cleaned = (raw || '').trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').replace(/\.+$/, '')
  return cleaned || 'unnamed'
}

const extFor = (kind: LibraryItemKind): string =>
  kind === 'device' ? '.cpdevice' : '.cpgroup'

const ensureDirs = async (): Promise<void> => {
  await mkdir(subdir('device'), { recursive: true })
  await mkdir(subdir('group'), { recursive: true })
}

const parseEnvelope = (content: string): LibraryFileEnvelope | null => {
  try {
    const parsed = JSON.parse(content) as Partial<LibraryFileEnvelope>
    if (
      (parsed.type === 'cable-planner-device' || parsed.type === 'cable-planner-group') &&
      parsed.version === 1
    ) {
      return parsed as LibraryFileEnvelope
    }
  } catch {
    /* ignore */
  }
  return null
}

export const registerLibraryIpc = (): void => {
  ipcMain.handle('library:get-folder-path', () => libraryRoot())

  ipcMain.handle('library:reveal-folder', async () => {
    await ensureDirs()
    void shell.openPath(libraryRoot())
    return libraryRoot()
  })

  /** Scan both subdirs. Returns every readable item. Files with broken
   *  JSON or wrong type get silently skipped (the user can still see them
   *  via reveal-folder). */
  ipcMain.handle('library:scan', async (): Promise<LibraryScanEntry[]> => {
    await ensureDirs()
    const entries: LibraryScanEntry[] = []
    for (const kind of ['device', 'group'] as const) {
      const dir = subdir(kind)
      let files: string[]
      try {
        files = await readdir(dir)
      } catch {
        continue
      }
      const expectedExt = extFor(kind)
      for (const file of files) {
        if (!file.toLowerCase().endsWith(expectedExt)) continue
        const fullPath = path.join(dir, file)
        try {
          const stats = await stat(fullPath)
          if (!stats.isFile()) continue
          const content = await readFile(fullPath, 'utf-8')
          const envelope = parseEnvelope(content)
          if (!envelope) continue
          const payload = kind === 'device' ? envelope.template : envelope.preset
          if (!payload) continue
          entries.push({
            kind,
            fileName: file.slice(0, -expectedExt.length),
            fileVersion: typeof envelope.fileVersion === 'number' ? envelope.fileVersion : 1,
            modifiedAt: envelope.modifiedAt || stats.mtime.toISOString(),
            payload,
          })
        } catch {
          /* skip broken file */
        }
      }
    }
    return entries
  })

  /** Write a single item file. fileVersion is auto-incremented if a file
   *  with the same name already exists; modifiedAt is set to "now". */
  ipcMain.handle(
    'library:write',
    async (
      _event,
      params: { kind: LibraryItemKind; name: string; payload: unknown },
    ): Promise<{ fileName: string; fileVersion: number; modifiedAt: string }> => {
      await ensureDirs()
      const ext = extFor(params.kind)
      const fileName = sanitize(params.name)
      const fullPath = path.join(subdir(params.kind), `${fileName}${ext}`)
      let prevVersion = 0
      try {
        const existing = await readFile(fullPath, 'utf-8')
        const env = parseEnvelope(existing)
        if (env) prevVersion = env.fileVersion
      } catch {
        /* new file */
      }
      const fileVersion = prevVersion + 1
      const modifiedAt = new Date().toISOString()
      const envelope: LibraryFileEnvelope = {
        type: params.kind === 'device' ? 'cable-planner-device' : 'cable-planner-group',
        version: 1,
        fileVersion,
        modifiedAt,
        exportedAt: modifiedAt,
        ...(params.kind === 'device'
          ? { template: params.payload }
          : { preset: params.payload }),
      }
      // v7.9.92 — atomarer Write + .bak-Rotation, identisch zu project:save.
      // Schützt Library-Files vor Crash-mid-write und konkurrenten Writes.
      await atomicWriteFile(fullPath, JSON.stringify(envelope, null, 2))
      return { fileName, fileVersion, modifiedAt }
    },
  )

  ipcMain.handle(
    'library:delete',
    async (_event, params: { kind: LibraryItemKind; name: string }): Promise<boolean> => {
      const ext = extFor(params.kind)
      const fileName = sanitize(params.name)
      const fullPath = path.join(subdir(params.kind), `${fileName}${ext}`)
      try {
        await unlink(fullPath)
        return true
      } catch {
        return false
      }
    },
  )
}
