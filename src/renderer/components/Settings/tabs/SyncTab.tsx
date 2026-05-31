import { useSyncedState } from '../../../hooks/useSyncedState'
import { useSettingsStore } from '../../../store/settingsStore'
import { useTranslation } from '../../../lib/i18n'
import { hasDesktopBridge } from '../../../lib/bridge'
import { SettingsCard } from '../SettingsCard'

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
    <div className="space-y-3 text-sm">
      {!hasDesktopBridge && (
        <div className="rounded border border-amber-700/50 bg-amber-900/20 p-2 text-xs text-amber-300">
          {t(
            'settings.sync.desktopOnly',
            'Netzwerk-Sync ist nur in der Desktop-App verfügbar.',
          )}
        </div>
      )}
      <p className="text-xs text-slate-400">
        {t(
          'settings.sync.intro',
          'Gemeinsames Verzeichnis (FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner), in dem Projekt, Bibliothek und Presets als JSON-Dateien geteilt werden.',
        )}
      </p>
      <label className="block text-sm text-slate-300">
        {t('settings.sync.path', 'Sync-Verzeichnis')}
        <input
          type="text"
          value={draftSyncPath}
          onChange={(e) => setDraftSyncPath(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
          placeholder={t('settings.sync.pathPlaceholder', 'Z:\\Projekte\\CablePlanner oder \\\\server\\share\\cable-planner')}
        />
      </label>
      <label className="block text-sm text-slate-300">
        {t('settings.sync.user', 'Benutzername (für Lock-Anzeige)')}
        <input
          type="text"
          value={draftSyncUser}
          onChange={(e) => setDraftSyncUser(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
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
          className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
        >
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncPath(draftSyncPath)
            setSyncUser(draftSyncUser)
          }}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
      <SettingsCard title={t('settings.sync.notes', 'Hinweise')}>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
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
