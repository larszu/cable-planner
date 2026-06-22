/**
 * SharedSyncPanel — Push / Pull shared network-drive sync UI
 *
 * Designed to live in the toolbar or sidebar of the main view.
 * Reads sync settings from settingsStore (path + user) and uses
 * cablePlannerApi.sync.* for all file I/O.
 *
 * Shared file layout in the sync directory:
 *   cable-planner.project.json   — full CablePlannerProject
 *   cable-planner.library.json   — EquipmentTemplate[]
 *   cable-planner.presets.json   — GroupPreset[]
 *   .cable-planner-sync.lock     — lock metadata (owner, expires)
 */

import { useState } from 'react'
import { Check, X, Lock, Upload, Download } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import type { CablePlannerProject } from '../../types/project'
import { format, useTranslation } from '../../lib/i18n'

const PROJECT_FILE = 'cable-planner.project.json'
const LIBRARY_FILE = 'cable-planner.library.json'
const PRESETS_FILE = 'cable-planner.presets.json'

interface SyncStatus {
  kind: 'idle' | 'ok' | 'error' | 'locked'
  message: string
  lockedBy?: string
  lastAction?: string
  lastAt?: string
}

function joinPath(dir: string, file: string): string {
  // Normalise directory separator and join. Works for both Windows paths
  // (using \) and POSIX paths — the IPC side on main uses path.join anyway.
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.replace(/[/\\]+$/, '') + sep + file
}

export function SharedSyncPanel() {
  const t = useTranslation()
  const syncPath = useSettingsStore((s) => s.sharedSyncPath)
  const syncUser = useSettingsStore((s) => s.sharedSyncUser)
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle', message: '' })
  const [busy, setBusy] = useState(false)

  const project = useProjectStore((s) => s.project)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const loadProject = useProjectStore((s) => s.loadProject)
  const setCustomLibrary = useProjectStore((s) => s.setCustomLibrary)
  const setGroupPresets = useProjectStore((s) => s.setGroupPresets)

  if (!hasDesktopBridge) return null
  if (!syncPath) return null

  const user = syncUser || t('sync.unknownUser', 'Unbekannt')

  const withLock = async (action: () => Promise<void>) => {
    const lockResult = await cablePlannerApi.sync.acquireLock(syncPath, user)
    if (!lockResult.ok) {
      setStatus({
        kind: 'locked',
        message: format(t('sync.lockedBy', 'Verzeichnis ist gesperrt von: {who}'), { who: lockResult.lockedBy ?? t('sync.unknownUser', 'Unbekannt') }),
        lockedBy: lockResult.lockedBy,
      })
      return
    }
    try {
      await action()
    } finally {
      await cablePlannerApi.sync.releaseLock(syncPath, user)
    }
  }

  const handlePush = async () => {
    if (!syncPath) return
    setBusy(true)
    try {
      await withLock(async () => {
        await cablePlannerApi.sync.writeFile(
          joinPath(syncPath, PROJECT_FILE),
          JSON.stringify(project, null, 2),
        )
        await cablePlannerApi.sync.writeFile(
          joinPath(syncPath, LIBRARY_FILE),
          JSON.stringify(customLibrary, null, 2),
        )
        await cablePlannerApi.sync.writeFile(
          joinPath(syncPath, PRESETS_FILE),
          JSON.stringify(groupPresets, null, 2),
        )
        setStatus({
          kind: 'ok',
          message: format(t('sync.pushOk', 'Push erfolgreich ({user})'), { user }),
          lastAction: 'Push',
          lastAt: new Date().toLocaleTimeString(),
        })
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : t('sync.pushFailed', 'Push fehlgeschlagen'),
      })
    } finally {
      setBusy(false)
    }
  }

  const handlePull = async () => {
    if (!syncPath) return
    setBusy(true)
    try {
      const [projectRaw, libraryRaw, presetsRaw] = await Promise.all([
        cablePlannerApi.sync.exists(joinPath(syncPath, PROJECT_FILE)).then((ok) =>
          ok ? cablePlannerApi.sync.readFile(joinPath(syncPath, PROJECT_FILE)) : null,
        ),
        cablePlannerApi.sync.exists(joinPath(syncPath, LIBRARY_FILE)).then((ok) =>
          ok ? cablePlannerApi.sync.readFile(joinPath(syncPath, LIBRARY_FILE)) : null,
        ),
        cablePlannerApi.sync.exists(joinPath(syncPath, PRESETS_FILE)).then((ok) =>
          ok ? cablePlannerApi.sync.readFile(joinPath(syncPath, PRESETS_FILE)) : null,
        ),
      ])

      if (!projectRaw && !libraryRaw && !presetsRaw) {
        setStatus({ kind: 'error', message: t('sync.noFiles', 'Keine Sync-Dateien im Verzeichnis gefunden.') })
        return
      }

      if (projectRaw) {
        const data = JSON.parse(projectRaw) as CablePlannerProject
        loadProject(data)
      }
      if (libraryRaw) {
        const data = JSON.parse(libraryRaw) as EquipmentTemplate[]
        setCustomLibrary(data)
      }
      if (presetsRaw) {
        const data = JSON.parse(presetsRaw) as GroupPreset[]
        setGroupPresets(data)
      }

      const loaded = [
        projectRaw && t('sync.part.project', 'Projekt'),
        libraryRaw && t('sync.part.library', 'Library'),
        presetsRaw && t('sync.part.presets', 'Presets'),
      ]
        .filter(Boolean)
        .join(', ')
      setStatus({
        kind: 'ok',
        message: format(t('sync.pullOk', 'Pull erfolgreich: {loaded}'), { loaded }),
        lastAction: 'Pull',
        lastAt: new Date().toLocaleTimeString(),
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : t('sync.pullFailed', 'Pull fehlgeschlagen'),
      })
    } finally {
      setBusy(false)
    }
  }

  const statusColor =
    status.kind === 'ok'
      ? 'text-emerald-400'
      : status.kind === 'error' || status.kind === 'locked'
        ? 'text-red-400'
        : 'text-cp-text-faint'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        title={format(t('sync.pushTitle', 'Push auf: {path}'), { path: syncPath })}
        disabled={busy}
        onClick={() => { void handlePush() }}
        className="flex items-center gap-1 rounded bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600 disabled:opacity-50"
      >
        <Icon icon={Upload} size="xs" />
        <span>{t('sync.push', 'Push')}</span>
      </button>
      <button
        type="button"
        title={format(t('sync.pullTitle', 'Pull von: {path}'), { path: syncPath })}
        disabled={busy}
        onClick={() => { void handlePull() }}
        className="flex items-center gap-1 rounded bg-cp-surface-4 px-2 py-1 text-cp-xs text-white hover:bg-cp-surface-5 disabled:opacity-50"
      >
        <Icon icon={Download} size="xs" />
        <span>{t('sync.pull', 'Pull')}</span>
      </button>
      {status.message ? (
        <span className={`inline-flex items-center gap-1 text-cp-xs ${statusColor}`} title={status.message}>
          {status.kind === 'ok' && <Icon icon={Check} size="xs" />}
          {status.kind === 'error' && <Icon icon={X} size="xs" />}
          {status.kind === 'locked' && <Icon icon={Lock} size="xs" />}
          {status.message.length > 40 ? status.message.slice(0, 40) + '…' : status.message}
        </span>
      ) : null}
    </div>
  )
}
