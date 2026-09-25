// ───────────────────────────────────────────────────────────────────────────
// Bibliothek → Geraetebibliothek: die abgeglichenen Geraete, schreibgeschuetzt.
//
// Kein Bearbeiten, kein Loeschen, kein Favorit: der Stand gehoert dem Server.
// Wer ein Geraet anpassen will, setzt es auf den Canvas und speichert es dort
// als eigene Vorlage — dann ist es seine, und das sieht man auch.
//
// Zu sehen ist, was die Bibliothek ueber ein Geraet weiss: Status und Zahl
// der Bestaetigungen. WER bestaetigt hat, liefert der Abgleich nicht — und
// deshalb steht hier auch kein Name.
// ───────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { format, useTranslation } from '../../../lib/i18n'
import { deviceUrl } from '../../../lib/deviceLibraryClient'
import { effectiveServer } from '../../../lib/deviceLibrary'
import { MIME_EQUIPMENT } from '../../../lib/dragDropMimes'
import { nextPlacementPosition } from '../../../lib/library'
import { clearCanvasSelection } from '../../../lib/canvasViewport'
import { categoryDisplay } from '../../../lib/categoryTranslations'
import { useProjectStore } from '../../../store/projectStore'
import { useSettingsStore } from '../../../store/settingsStore'
import { useUiStore } from '../../../store/uiStore'
import { useDeviceLibraryStore } from '../../../store/deviceLibraryStore'
import { DeviceLibrarySyncReport } from '../../Settings/tabs/DeviceLibraryTab'
import type { DeviceLibraryEntry } from '../../../types/deviceLibrary'

const STATUS_CLASS: Record<DeviceLibraryEntry['status'], string> = {
  verified: 'bg-cp-accent text-white',
  confirmed: 'border border-cp-accent text-cp-accent',
  unconfirmed: 'border border-cp-border text-cp-text-muted',
  disputed: 'border border-cp-warn text-cp-warn',
}

export const DeviceLibrarySourceTab = () => {
  const t = useTranslation()
  const server = effectiveServer(useSettingsStore((s) => s.deviceLibraryUrl))
  const cache = useDeviceLibraryStore((s) => s.cache)
  const session = useDeviceLibraryStore((s) => s.session)
  const syncing = useDeviceLibraryStore((s) => s.syncing)
  const lastSync = useDeviceLibraryStore((s) => s.lastSync)
  const lastError = useDeviceLibraryStore((s) => s.lastError)
  const loadFor = useDeviceLibraryStore((s) => s.loadFor)
  const refreshSession = useDeviceLibraryStore((s) => s.refreshSession)
  const sync = useDeviceLibraryStore((s) => s.sync)
  const addEquipment = useProjectStore((s) => s.addEquipment)
  const equipmentItems = useProjectStore((s) => s.project.equipment)
  const categoryTranslations = useProjectStore((s) => s.categoryTranslations)
  const lang = useUiStore((s) => s.language)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadFor(server)
    void refreshSession(server)
  }, [server, loadFor, refreshSession])

  const statusLabel: Record<DeviceLibraryEntry['status'], string> = {
    verified: t('deviceLibrary.status.verified', 'verified'),
    confirmed: t('deviceLibrary.status.confirmed', 'confirmed'),
    unconfirmed: t('deviceLibrary.status.unconfirmed', 'unconfirmed'),
    disputed: t('deviceLibrary.status.disputed', 'disputed'),
  }

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out = new Map<string, DeviceLibraryEntry[]>()
    for (const e of cache.entries) {
      if (q && !`${e.template.name} ${e.manufacturer} ${e.model} ${e.template.category}`.toLowerCase().includes(q)) continue
      const list = out.get(e.template.category) ?? []
      list.push(e)
      out.set(e.template.category, list)
    }
    return [...out.entries()]
  }, [cache.entries, search])

  const place = (e: DeviceLibraryEntry) => {
    clearCanvasSelection()
    addEquipment({ ...e.template, ...nextPlacementPosition(equipmentItems.length, equipmentItems) })
  }

  const signedIn = session === 'signed-in' || session === 'unverified'

  return (
    <div className="space-y-2 text-cp-xs">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearch('')
          }}
          placeholder={t('library.search.placeholder', 'Search…')}
          aria-label={t('library.search.placeholder', 'Search…')}
          className="min-w-0 flex-1 border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text"
        />
        <button
          type="button"
          onClick={() => void sync(server)}
          disabled={syncing || !signedIn}
          title={t('deviceLibrary.update', 'Update from device library')}
          className="inline-flex h-7 shrink-0 items-center gap-1 border border-cp-border bg-cp-surface-1 px-2 text-cp-xs hover:bg-cp-surface-2 disabled:opacity-40"
        >
          <Icon icon={RefreshCw} size="xs" />
          {syncing ? t('deviceLibrary.syncing', 'Updating…') : t('deviceLibrary.updateShort', 'Update')}
        </button>
      </div>

      {!signedIn && session !== 'unknown' && (
        <div className="border border-cp-border-muted bg-cp-surface-2 p-2 text-cp-text-muted">
          <p>
            {t(
              'deviceLibrary.signInHint',
              'Sign in to the device library to fetch or update its devices. Devices already fetched stay usable.',
            )}
          </p>
          <button
            type="button"
            onClick={() => useUiStore.getState().openSettings('deviceLibrary')}
            className="mt-1 text-cp-accent hover:underline"
          >
            {t('deviceLibrary.openSettings', 'Sign in…')}
          </button>
        </div>
      )}

      <DeviceLibrarySyncReport lastSync={lastSync} lastError={lastError} />

      {cache.entries.length === 0 ? (
        <div className="text-cp-text-muted">
          {t('deviceLibrary.empty', 'No devices from the device library yet. Use “Update” to fetch them.')}
        </div>
      ) : (
        <div className="text-cp-text-faint">
          {format(t('deviceLibrary.cacheState', '{n} devices stored locally'), { n: cache.entries.length })}
        </div>
      )}

      {groups.map(([category, entries]) => (
        <section key={category}>
          <h4 className="mb-1 text-cp-xs font-semibold uppercase tracking-wider text-cp-text-muted">
            {categoryDisplay(category, lang, categoryTranslations)}
          </h4>
          <ul className="space-y-1">
            {entries.map((e) => (
              <li key={e.slug}>
                <div
                  draggable
                  onDragStart={(ev) => {
                    clearCanvasSelection()
                    ev.dataTransfer.setData(MIME_EQUIPMENT, JSON.stringify(e.template))
                    ev.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => place(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault()
                      place(e)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={t('deviceLibrary.itemTitle', 'From the device library (read-only) — click or drag onto the canvas')}
                  className="flex cursor-grab items-start justify-between gap-2 border border-cp-border border-l-2 border-l-cp-accent bg-cp-surface-1 px-2 py-1.5 hover:bg-cp-surface-2 active:cursor-grabbing"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-cp-base font-medium text-cp-text">{e.template.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-cp-text-muted">
                      <span className={`px-1 ${STATUS_CLASS[e.status]}`}>{statusLabel[e.status]}</span>
                      <span>
                        {format(t('deviceLibrary.confirmations', '{n} confirmations'), { n: e.confirmations })}
                      </span>
                    </div>
                  </div>
                  <a
                    href={deviceUrl(server, e.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 text-cp-accent hover:underline"
                    title={t('deviceLibrary.openDevicePage', 'Open the device page in the browser')}
                  >
                    <Icon icon={ExternalLink} size="xs" />
                    {t('deviceLibrary.devicePage', 'Page')}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
