/**
 * syncIpc.ts
 *
 * IPC handlers for shared-drive (FTP-mapped / network drive) synchronisation.
 *
 * Supported channels:
 *   sync:read-file   (filePath: string) => string          — read UTF-8 text
 *   sync:write-file  (filePath: string, data: string) => void
 *   sync:exists      (filePath: string) => boolean
 *   sync:acquire-lock (dirPath: string, owner: string) => { ok: boolean; lockedBy?: string }
 *   sync:release-lock (dirPath: string, owner: string) => void
 *
 * Lock file format: .cable-planner-sync.lock
 *   { owner: string, timestamp: string (ISO), expires: string (ISO) }
 * Locks expire automatically after LOCK_TTL_MS (2 h); stale locks are
 * silently overwritten on acquire.
 */

import { ipcMain } from 'electron'
import { readFile, writeFile, mkdir, access, unlink } from 'node:fs/promises'
import path from 'node:path'

const LOCK_FILE = '.cable-planner-sync.lock'
const LOCK_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

interface LockEntry {
  owner: string
  timestamp: string
  expires: string
}

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function readLock(dirPath: string): Promise<LockEntry | null> {
  const lockPath = path.join(dirPath, LOCK_FILE)
  try {
    const raw = await readFile(lockPath, 'utf-8')
    const entry = JSON.parse(raw) as LockEntry
    return entry
  } catch {
    return null
  }
}

async function writeLock(dirPath: string, owner: string): Promise<void> {
  await ensureDir(dirPath)
  const now = new Date()
  const expires = new Date(now.getTime() + LOCK_TTL_MS)
  const entry: LockEntry = {
    owner,
    timestamp: now.toISOString(),
    expires: expires.toISOString(),
  }
  const lockPath = path.join(dirPath, LOCK_FILE)
  await writeFile(lockPath, JSON.stringify(entry, null, 2), 'utf-8')
}

async function deleteLock(dirPath: string): Promise<void> {
  const lockPath = path.join(dirPath, LOCK_FILE)
  try {
    await unlink(lockPath)
  } catch {
    // Already gone – fine.
  }
}

export function registerSyncIpc() {
  // ── sync:read-file ──────────────────────────────────────────────────────────
  ipcMain.handle('sync:read-file', async (_event, filePath: string): Promise<string> => {
    return await readFile(filePath, 'utf-8')
  })

  // ── sync:write-file ─────────────────────────────────────────────────────────
  ipcMain.handle('sync:write-file', async (_event, filePath: string, data: string): Promise<void> => {
    await ensureDir(path.dirname(filePath))
    await writeFile(filePath, data, 'utf-8')
  })

  // ── sync:exists ─────────────────────────────────────────────────────────────
  ipcMain.handle('sync:exists', async (_event, filePath: string): Promise<boolean> => {
    return fileExists(filePath)
  })

  // ── sync:acquire-lock ───────────────────────────────────────────────────────
  ipcMain.handle(
    'sync:acquire-lock',
    async (_event, dirPath: string, owner: string): Promise<{ ok: boolean; lockedBy?: string }> => {
      const existing = await readLock(dirPath)
      if (existing) {
        const expired = new Date(existing.expires).getTime() < Date.now()
        if (!expired && existing.owner !== owner) {
          return { ok: false, lockedBy: existing.owner }
        }
      }
      await writeLock(dirPath, owner)
      return { ok: true }
    },
  )

  // ── sync:release-lock ───────────────────────────────────────────────────────
  ipcMain.handle('sync:release-lock', async (_event, dirPath: string, owner: string): Promise<void> => {
    const existing = await readLock(dirPath)
    if (existing && existing.owner !== owner) return // don't delete someone else's lock
    await deleteLock(dirPath)
  })
}
