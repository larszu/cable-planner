/**
 * v7.9.92 — Atomarer File-Write mit .bak-Rotation und In-Flight-Lock.
 *
 * Shared zwischen project-save (project:save) und library:write damit
 * Crash-mid-write keine Datei korrumpiert und konkurrente Saves auf
 * denselben Pfad nicht race-en.
 *
 * Pattern: writeFile(.tmp) → rename target → .bak → rename .tmp → target.
 * POSIX-rename ist atomar; Windows ReplaceFile auch (näherungsweise).
 */
import { access, mkdir, rename, unlink, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import path from 'node:path'

const inFlightSaves = new Set<string>()

export const atomicWriteFile = async (
  targetPath: string,
  content: string,
  opts: { backup?: boolean } = { backup: true },
): Promise<void> => {
  if (inFlightSaves.has(targetPath)) {
    throw new Error(`A save is already in progress for ${path.basename(targetPath)}.`)
  }
  inFlightSaves.add(targetPath)
  const dir = path.dirname(targetPath)
  const tmpPath = `${targetPath}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(tmpPath, content, 'utf-8')
    if (opts.backup !== false) {
      const bakPath = `${targetPath}.bak`
      try {
        await access(targetPath)
        try { await unlink(bakPath) } catch { /* no prev backup */ }
        await rename(targetPath, bakPath)
      } catch {
        // target doesn't exist yet — no backup needed
      }
    } else {
      try { await unlink(targetPath) } catch { /* not exists */ }
    }
    await rename(tmpPath, targetPath)
  } catch (error) {
    try { await unlink(tmpPath) } catch { /* cleanup attempt only */ }
    throw error
  } finally {
    inFlightSaves.delete(targetPath)
  }
}
