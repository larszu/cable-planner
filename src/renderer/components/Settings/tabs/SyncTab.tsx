import { useState } from 'react'
import { useSyncedState } from '../../../hooks/useSyncedState'
import { useSettingsStore } from '../../../store/settingsStore'
import { useTranslation, format } from '../../../lib/i18n'
import { CollabPanel } from '../../Sync/CollabPanel'
import { hasDesktopBridge } from '../../../lib/bridge'
import { SettingsCard } from '../SettingsCard'
import { syncSharedLibrary, type LibrarySyncResult } from '../../../lib/sharedLibrarySync'

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
    setBusy(true)
    setRes(null)
    try {
      setRes(await syncSharedLibrary())
    } finally {
      setBusy(false)
    }
  }

  const errorText = (r: LibrarySyncResult): string => {
    if (r.error === 'no-path') return t('settings.sharedLib.errNoPath', 'Kein Sync-Verzeichnis gesetzt.')
    if (r.error === 'desktop-only') return t('settings.sync.desktopOnly', 'Netzwerk-Sync ist nur in der Desktop-App verfügbar.')
    if (r.error === 'locked')
      return format(t('settings.sharedLib.errLocked', 'Gesperrt von {who} — später erneut versuchen.'), { who: r.lockedBy ?? '?' })
    return `${t('collab.error.prefix', 'Fehler:')} ${r.error}`
  }

  return (
    <SettingsCard
      title={t('settings.sharedLib.title', 'Gemeinsame Bibliothek (Workgroup)')}
      description={t(
        'settings.sharedLib.desc',
        'Gleicht Geräte-Templates, Gruppen und Kategorien mit der Datei cable-planner.library.json im Sync-Verzeichnis ab. Merge nach Name — lokale Templates werden nie überschrieben.',
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
            ? t('settings.sharedLib.syncing', 'Synchronisiere…')
            : t('settings.sharedLib.syncNow', 'Bibliothek jetzt synchronisieren')}
        </button>
        {!syncPath.trim() && (
          <span className="text-[11px] text-cp-text-muted">
            {t('settings.sharedLib.needPath', 'Erst oben ein Sync-Verzeichnis setzen.')}
          </span>
        )}
      </div>
      {res && (
        <div className="mt-2 text-[11px]">
          {res.ok ? (
            <div className="space-y-0.5">
              <p className="text-emerald-400">
                {format(
                  t('settings.sharedLib.okPull', 'Geladen: {d} Geräte, {g} Gruppen, {c} Kategorien.'),
                  { d: res.pulledDevices, g: res.pulledGroups, c: res.pulledCategories },
                )}
              </p>
              <p className="text-emerald-400">
                {format(t('settings.sharedLib.okPush', 'Geteilt: {d} Geräte, {g} Gruppen.'), {
                  d: res.pushedDevices,
                  g: res.pushedGroups,
                })}
              </p>
              {res.conflicts.length > 0 && (
                <p className="text-amber-300">
                  {format(
                    t('settings.sharedLib.conflicts', '{n} Namens-Konflikt(e) — lokale Version behalten: {names}'),
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
            'Netzwerk-Sync ist nur in der Desktop-App verfügbar.',
          )}
        </div>
      )}
      <p className="text-cp-xs text-cp-text-muted">
        {t(
          'settings.sync.intro',
          'Gemeinsames Verzeichnis (FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner), in dem Projekt, Bibliothek und Presets als JSON-Dateien geteilt werden.',
        )}
      </p>
      <label className="block text-cp-base text-cp-text-secondary">
        {t('settings.sync.path', 'Sync-Verzeichnis')}
        <input
          type="text"
          value={draftSyncPath}
          onChange={(e) => setDraftSyncPath(e.target.value)}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-xs"
          placeholder={t('settings.sync.pathPlaceholder', 'Z:\\Projekte\\CablePlanner oder \\\\server\\share\\cable-planner')}
        />
      </label>
      <label className="block text-cp-base text-cp-text-secondary">
        {t('settings.sync.user', 'Benutzername (für Lock-Anzeige)')}
        <input
          type="text"
          value={draftSyncUser}
          onChange={(e) => setDraftSyncUser(e.target.value)}
          className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-base"
          placeholder={t('settings.sync.userPlaceholder', 'z. B. Max Mustermann')}
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
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncPath(draftSyncPath)
            setSyncUser(draftSyncUser)
          }}
          className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
      <SharedLibrarySyncSection syncPath={sharedSyncPath} />

      <SettingsCard title={t('settings.sync.notes', 'Hinweise')}>
        <ul className="list-inside list-disc space-y-1 text-cp-xs text-cp-text-muted">
          <li>
            {t(
              'settings.sync.notes.push',
              'Push schreibt: cable-planner.project.json, .library.json, .presets.json',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.pull',
              'Pull lädt diese Dateien aus dem Verzeichnis in den aktuellen Stand.',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.lock',
              'Ein Lock-File (.cable-planner-sync.lock) verhindert gleichzeitiges Überschreiben (2 h TTL).',
            )}
          </li>
        </ul>
      </SettingsCard>
    </div>
  )
}
