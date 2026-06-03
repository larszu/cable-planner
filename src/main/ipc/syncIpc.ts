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

// The renderer can pass arbitrary strings here, so these handlers are a
// raw FS read/write primitive into the main process. Constrain them: the
// sync feature only ever touches absolute `.json` files (project/library/
// presets) on a user-chosen drive. Reject anything else so a compromised
// renderer can't read ~/.ssh/id_rsa or plant files elsewhere.
const ALLOWED_EXTENSIONS = new Set(['.json'])
const assertSafeFilePath = (filePath: unknown): string => {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('sync: invalid file path')
  }
  if (filePath.includes('\0')) {
    throw new Error('sync: path contains NUL byte')
  }
  const normalized = path.normalize(filePath)
  if (!path.isAbsolute(normalized)) {
    throw new Error('sync: path must be absolute')
  }
  if (!ALLOWED_EXTENSIONS.has(path.extname(normalized).toLowerCase())) {
    throw new Error('sync: only .json files may be synced')
  }
  return normalized
}
const assertSafeDirPath = (dirPath: unknown): string => {
  if (typeof dirPath !== 'string' || dirPath.length === 0 || dirPath.includes('\0')) {
    throw new Error('sync: invalid directory path')
  }
  const normalized = path.normalize(dirPath)
  if (!path.isAbsolute(normalized)) {
    throw new Error('sync: directory path must be absolute')
  }
  return normalized
}

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

function buildLockEntry(owner: string): LockEntry {
  const now = new Date()
  return {
    owner,
    timestamp: now.toISOString(),
    expires: new Date(now.getTime() + LOCK_TTL_MS).toISOString(),
  }
}

async function writeLock(dirPath: string, owner: string): Promise<void> {
  await ensureDir(dirPath)
  const lockPath = path.join(dirPath, LOCK_FILE)
  await writeFile(lockPath, JSON.stringify(buildLockEntry(owner), null, 2), 'utf-8')
}

/** Atomically create the lock with an exclusive `wx` open. Returns false
 *  (instead of throwing) when the file already exists, closing the
 *  read-then-write race two same-host clients could otherwise lose. */
async function tryCreateLock(dirPath: string, owner: string): Promise<boolean> {
  await ensureDir(dirPath)
  const lockPath = path.join(dirPath, LOCK_FILE)
  try {
    await writeFile(lockPath, JSON.stringify(buildLockEntry(owner), null, 2), {
      encoding: 'utf-8',
      flag: 'wx',
    })
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw err
  }
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
    return await readFile(assertSafeFilePath(filePath), 'utf-8')
  })

  // ── sync:write-file ─────────────────────────────────────────────────────────
  ipcMain.handle('sync:write-file', async (_event, filePath: string, data: string): Promise<void> => {
    const safe = assertSafeFilePath(filePath)
    await ensureDir(path.dirname(safe))
    await writeFile(safe, String(data ?? ''), 'utf-8')
  })

  // ── sync:exists ─────────────────────────────────────────────────────────────
  ipcMain.handle('sync:exists', async (_event, filePath: string): Promise<boolean> => {
    return fileExists(assertSafeFilePath(filePath))
  })

  // ── sync:acquire-lock ───────────────────────────────────────────────────────
  ipcMain.handle(
    'sync:acquire-lock',
    async (_event, dirPath: string, owner: string): Promise<{ ok: boolean; lockedBy?: string }> => {
      const dir = assertSafeDirPath(dirPath)
      // Fast path: nobody holds the lock → atomic exclusive create wins it.
      if (await tryCreateLock(dir, owner)) return { ok: true }
      // Lock exists — inspect it.
      const existing = await readLock(dir)
      if (existing) {
        const expired = new Date(existing.expires).getTime() < Date.now()
        if (!expired && existing.owner !== owner) {
          return { ok: false, lockedBy: existing.owner }
        }
        // Stale or already ours → take it over.
        await writeLock(dir, owner)
        return { ok: true }
      }
      // Lock vanished between the create attempt and the read → retry once.
      if (await tryCreateLock(dir, owner)) return { ok: true }
      return { ok: false }
    },
  )

  // ── sync:release-lock ───────────────────────────────────────────────────────
  ipcMain.handle('sync:release-lock', async (_event, dirPath: string, owner: string): Promise<void> => {
    const dir = assertSafeDirPath(dirPath)
    const existing = await readLock(dir)
    if (existing && existing.owner !== owner) return // don't delete someone else's lock
    await deleteLock(dir)
  })
}
