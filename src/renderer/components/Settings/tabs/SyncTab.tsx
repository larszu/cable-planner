import { useState } from 'react'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { useSettingsStore } from '../../../store/settingsStore'
import { useTranslation, format } from '../../../lib/i18n'
import { CollabPanel } from '../../Sync/CollabPanel'
import { hasDesktopBridge } from '../../../lib/bridge'
import { SettingsCard } from '../SettingsCard'
import { syncSharedLibrary, type LibrarySyncResult } from '../../../lib/sharedLibrarySync'
import { countCredentialBearers } from '../../../lib/credentialKeys'
import { credentialChoiceDialog, type CredentialChoice } from '../../../lib/credentialChoiceDialog'
import { useProjectStore } from '../../../store/projectStore'
import { PanelHint } from '../../shared/PanelHint'

/**
 * #434 — Workgroup-/Shared-Library: ein „Bibliothek jetzt synchronisieren"-
 * Button, der die lokale Library merge-by-name mit der geteilten Datei im
 * Sync-Ordner abgleicht (Pull fehlende Items, Push Vereinigung zurück).
 */
const SharedLibrarySyncSection = ({ syncPath }: { syncPath: string }) => {
  const t = useTranslation()
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<LibrarySyncResult | null>(null)
  const disabled = busy || !hasDesktopBridge || !syncPath.trim()

  const run = async () => {
    // Design-Frage 5 — gefragt wird nur, wenn es etwas zu entscheiden gibt.
    // Der Erklaertext dieses Tabs nennt „Geraete-Vorlagen, Gruppen und
    // Kategorien"; von Zugangsdaten stand dort nie etwas, und sie gingen
    // trotzdem in den geteilten Ordner.
    const withCredentials = countCredentialBearers(useProjectStore.getState().customLibrary)
    let choice: CredentialChoice = 'strip'
    if (withCredentials > 0) {
      const answer = await credentialChoiceDialog(
        withCredentials,
        t(
          'cred.dest.sharedLib',
          'They would be written to the shared folder and readable by the whole team.',
        ),
      )
      if (answer === null) return // abgebrochen: gar nicht synchronisieren
      choice = answer
    }
    setBusy(true)
    setRes(null)
    try {
      setRes(await syncSharedLibrary(choice))
    } finally {
      setBusy(false)
    }
  }

  const errorText = (r: LibrarySyncResult): string => {
    if (r.error === 'no-path') return t('settings.sharedLib.errNoPath', 'No sync directory set.')
    if (r.error === 'desktop-only') return t('settings.sync.desktopOnly', 'Network sync is only available in the desktop app.')
    if (r.error === 'locked')
      return format(t('settings.sharedLib.errLocked', 'Locked by {who} — try again later.'), { who: r.lockedBy ?? '?' })
    return `${t('collab.error.prefix', 'Error:')} ${r.error}`
  }

  return (
    <SettingsCard
      title={t('settings.sharedLib.title', 'Shared library (workgroup)')}
      description={t(
        'settings.sharedLib.desc',
        'Syncs device templates, groups and categories with cable-planner.library.json in the sync directory. Merge by name — local templates are never overwritten.',
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-cp-xs text-cp-text-secondary">
        <button
          type="button"
          onClick={run}
          disabled={disabled}
          className="rounded bg-sky-700 px-3 py-1.5 hover:bg-sky-600 disabled:opacity-50"
        >
          {busy
            ? t('settings.sharedLib.syncing', 'Syncing…')
            : t('settings.sharedLib.syncNow', 'Sync library now')}
        </button>
        {!syncPath.trim() && (
          <span className="text-cp-xs text-cp-text-muted">
            {t('settings.sharedLib.needPath', 'Set a sync directory above first.')}
          </span>
        )}
      </div>
      {res && (
        <div className="mt-2 text-cp-xs">
          {res.ok ? (
            <div className="space-y-0.5">
              <p className="text-emerald-400">
                {format(
                  t('settings.sharedLib.okPull', 'Pulled: {d} devices, {g} groups, {c} categories.'),
                  { d: res.pulledDevices, g: res.pulledGroups, c: res.pulledCategories },
                )}
              </p>
              <p className="text-emerald-400">
                {format(t('settings.sharedLib.okPush', 'Shared: {d} devices, {g} groups.'), {
                  d: res.pushedDevices,
                  g: res.pushedGroups,
                })}
              </p>
              {res.conflicts.length > 0 && (
                <p className="text-amber-300">
                  {format(
                    t('settings.sharedLib.conflicts', '{n} name conflict(s) — kept local version: {names}'),
                    { n: res.conflicts.length, names: res.conflicts.slice(0, 6).join(', ') },
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-red-300">{errorText(res)}</p>
          )}
        </div>
      )}
    </SettingsCard>
  )
}

/**
 * #307 — Sync-Tab aus SettingsDialog ausgelagert.
 */
export const SyncTab = () => {
  const sharedSyncPath = useSettingsStore((s) => s.sharedSyncPath)
  const sharedSyncUser = useSettingsStore((s) => s.sharedSyncUser)
  const setSyncPath = useSettingsStore((s) => s.setSyncPath)
  const setSyncUser = useSettingsStore((s) => s.setSyncUser)
  const [draftSyncPath, setDraftSyncPath] = useSyncedState(sharedSyncPath)
  const [draftSyncUser, setDraftSyncUser] = useSyncedState(sharedSyncUser)
  const t = useTranslation()

  return (
    <div className="space-y-3 text-cp-base">
      <CollabPanel />
      {!hasDesktopBridge && (
        <div className="rounded border border-amber-700/50 bg-amber-900/20 p-2 text-cp-xs text-amber-300">
          {t(
            'settings.sync.desktopOnly',
            'Network sync is only available in the desktop app.',
          )}
        </div>
      )}
      <PanelHint
        className="text-cp-xs text-cp-text-muted"
        text={t(
          'settings.sync.intro',
          'Shared directory (mapped FTP drive, network path or local folder) where project, library and presets are exchanged as JSON files.',
        )}
      />
      <label className="block text-cp-base text-cp-text-secondary">
        {t('settings.sync.path', 'Sync directory')}
        <input
          type="text"
          value={draftSyncPath}
          onChange={(e) => setDraftSyncPath(e.target.value)}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-xs"
          placeholder={t('settings.sync.pathPlaceholder', 'Z:\\Projekte\\CablePlanner or \\\\server\\share\\cable-planner')}
        />
      </label>
      <label className="block text-cp-base text-cp-text-secondary">
        {t('settings.sync.user', 'User name (for lock display)')}
        <input
          type="text"
          value={draftSyncUser}
          onChange={(e) => setDraftSyncUser(e.target.value)}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t('settings.sync.userPlaceholder', 'e.g. Max Mustermann')}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setDraftSyncPath(sharedSyncPath)
            setDraftSyncUser(sharedSyncUser)
          }}
          className="rounded bg-cp-surface-4 px-3 py-1 text-cp-base hover:bg-cp-surface-5"
        >
          {t('common.reset', 'Reset')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncPath(draftSyncPath)
            setSyncUser(draftSyncUser)
          }}
          className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500"
        >
          {t('common.save', 'Save')}
        </button>
      </div>
      <SharedLibrarySyncSection syncPath={sharedSyncPath} />

      <SettingsCard title={t('settings.sync.notes', 'Notes')}>
        <ul className="list-inside list-disc space-y-1 text-cp-xs text-cp-text-muted">
          <li>
            {t(
              'settings.sync.notes.push',
              'Push writes: cable-planner.project.json, .library.json, .presets.json',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.pull',
              'Pull loads these files from the directory into the current state.',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.lock',
              'A lock file (.cable-planner-sync.lock) prevents simultaneous overwrites (2 h TTL).',
            )}
          </li>
        </ul>
      </SettingsCard>
    </div>
  )
}
