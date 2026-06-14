import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import { Spinner } from '../shared/Spinner'
import { useProjectStore } from '../../store/projectStore'
import { useRentman } from '../../hooks/useRentman'
import { format, useTranslation } from '../../lib/i18n'
import type { Cable } from '../../types/cable'

interface RentmanCableExportDialogProps {
  open: boolean
  onClose: () => void
}

interface CableBucket {
  key: string
  type: string
  length: number
  built: number
  planned: number
  /** Rentman equipment id this bucket is mapped to (if any). */
  mappedId?: string
  mappedName?: string
  /** Quantity that has already been pushed to Rentman (lastSyncedQty). */
  syncedQty: number
  delta: number
  /** Sample cable name for display. */
  sample?: Cable
}

interface CatalogItem {
  id: string
  name: string
  category: string
}

const keyOf = (c: Pick<Cable, 'type' | 'length'>): string => `${c.type}|${c.length}`

/**
 * Push canvas cable quantities to the linked Rentman project.
 *
 * For every (cable-type, length) bucket the user maps the bucket to a Rentman
 * master-catalogue equipment id once. The dialog then computes the delta
 * between the current built quantity and the last synced quantity, and POSTs
 * `addProjectEquipment(projectId, equipmentId, delta)` to extend the Rentman
 * project plan. Negative deltas are surfaced as warnings rather than silently
 * removing equipment, because the Rentman REST API has no project-equipment
 * delete endpoint exposed via our IPC bridge.
 */
export const RentmanCableExportDialog = ({ open, onClose }: RentmanCableExportDialogProps) => {
  const t = useTranslation()
  const project = useProjectStore((state) => state.project)
  const updateMeta = useProjectStore((state) => state.updateProjectMetadata)
  const { loadEquipment, loadFolders, exportToCablePlannerGroup } = useRentman()

  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [statusByKey, setStatusByKey] = useState<Record<string, string>>({})
  const [pickerKey, setPickerKey] = useState<string | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')

  const linkedProjectId = project.metadata.rentmanProjectId
  const linkedProjectName = project.metadata.rentmanProjectName

  const fetchCatalog = async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const [equipmentData, folderData] = await Promise.all([loadEquipment(), loadFolders()])
      const folders = (folderData as Record<string, unknown>[]).reduce<Record<string, string>>(
        (acc, folder) => {
          const key = String(folder.id ?? folder._id ?? '')
          if (key) acc[key] = String(folder.name ?? folder.displayname ?? key)
          return acc
        },
        {},
      )
      const items = (equipmentData as Record<string, unknown>[])
        .map((rec) => {
          const id = String(rec.id ?? rec._id ?? '')
          if (!id) return null
          const name = String(rec.name ?? rec.displayname ?? `Equipment ${id}`)
          const folderKey = String(rec.equipmentfolder ?? rec.folder ?? rec.category ?? '')
          const category = folderKey ? folders[folderKey] ?? folderKey : 'Uncategorized'
          return { id, name, category }
        })
        .filter((row): row is CatalogItem => row !== null)
      items.sort((a, b) => a.name.localeCompare(b.name))
      setCatalog(items)
      setCatalogLoaded(true)
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : t('rentman.cableExport.catalogError', 'Konnte Rentman-Katalog nicht laden'))
    } finally {
      setCatalogLoading(false)
    }
  }

  // Nach fetchCatalog deklariert, damit der React-Compiler die Funktion vor
  // dem Zugriff sieht (react-hooks/immutability).
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- State beim Schließen zurücksetzen / Katalog beim Öffnen laden
      setStatusByKey({})
      setPickerKey(null)
      setPickerQuery('')
      return
    }
    // Auto-load the Rentman catalogue the first time the dialog opens so the
    // user can immediately see equipment names instead of bare IDs and the
    // "Send all" button works without an extra click.
    if (!catalogLoaded && !catalogLoading) void fetchCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const buckets: CableBucket[] = useMemo(() => {
    if (!open) return []
    const built = new Map<string, { count: number; sample: Cable }>()
    for (const cable of project.cables) {
      const key = keyOf(cable)
      const entry = built.get(key)
      if (entry) entry.count += 1
      else built.set(key, { count: 1, sample: cable })
    }
    const planned = project.metadata.rentmanCablePlan ?? {}
    const mapping = project.metadata.rentmanCableMap ?? {}
    const keys = new Set<string>([
      ...built.keys(),
      ...Object.keys(planned),
      ...Object.keys(mapping),
    ])
    const list: CableBucket[] = []
    for (const key of keys) {
      const [type, lenStr] = key.split('|')
      const length = Number(lenStr) || 0
      const builtCount = built.get(key)?.count ?? 0
      const plannedCount = planned[key] ?? 0
      const map = mapping[key]
      const mappedId = map?.rentmanEquipmentId
      const mappedName = mappedId
        ? catalog.find((item) => item.id === mappedId)?.name
        : undefined
      const synced = map?.lastSyncedQty ?? 0
      list.push({
        key,
        type,
        length,
        built: builtCount,
        planned: plannedCount,
        mappedId,
        mappedName,
        syncedQty: synced,
        delta: builtCount - synced,
        sample: built.get(key)?.sample,
      })
    }
    list.sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
    return list
  }, [open, project.cables, project.metadata.rentmanCablePlan, project.metadata.rentmanCableMap, catalog])

  const setMapping = (
    key: string,
    rentmanEquipmentId: string,
    options: { resetSync?: boolean } = {},
  ) => {
    const current = project.metadata.rentmanCableMap ?? {}
    const next = {
      ...current,
      [key]: {
        rentmanEquipmentId,
        lastSyncedQty: options.resetSync
          ? 0
          : current[key]?.lastSyncedQty ?? 0,
      },
    }
    updateMeta({ rentmanCableMap: next })
  }

  const clearMapping = (key: string) => {
    const current = project.metadata.rentmanCableMap ?? {}
    if (!current[key]) return
    const next = { ...current }
    delete next[key]
    updateMeta({ rentmanCableMap: next })
  }

  const sendBucket = async (bucket: CableBucket) => {
    if (!linkedProjectId) return
    if (!bucket.mappedId) return
    if (bucket.delta <= 0) return
    setBusyKey(bucket.key)
    setStatusByKey((prev) => ({ ...prev, [bucket.key]: t('rentman.cableExport.sending', 'Sende an Rentman…') }))
    try {
      // v7.9.110 — Nutzt die neue Batch-Export-Action. Landet in der
      // 'CablePlanner'-EquipmentGroup im Subproject (wird angelegt
      // falls nicht vorhanden). Vorher ging das via addProjectEquipment,
      // das subproject/equipmentgroup nicht setzte — Rentman wies das
      // mit 422 ab.
      const result = await exportToCablePlannerGroup(linkedProjectId, [
        { equipmentId: bucket.mappedId, quantity: bucket.delta },
      ])
      if (result.failed.length > 0) {
        const msg = result.failed[0]?.error ?? t('rentman.cableExport.unknownError', 'Unbekannter Fehler')
        setStatusByKey((prev) => ({ ...prev, [bucket.key]: format(t('rentman.cableExport.errorFormat', 'Fehler: {msg}'), { msg }) }))
        return
      }
      const current = project.metadata.rentmanCableMap ?? {}
      updateMeta({
        rentmanCableMap: {
          ...current,
          [bucket.key]: {
            rentmanEquipmentId: bucket.mappedId,
            lastSyncedQty: bucket.built,
          },
        },
      })
      // v7.9.117 — Drei Faelle (siehe rentmanApiClient).
      const groupNote = result.groupCreated
        ? t('rentman.cableExport.groupCreated', ' (Gruppe angelegt)')
        : result.groupId
          ? ''
          : t('rentman.cableExport.groupRestricted', ' (ohne Gruppe — Plan-Restriction)')
      setStatusByKey((prev) => ({
        ...prev,
        [bucket.key]: format(t('rentman.cableExport.sentSuccess', '✓ {count} an Rentman gesendet{note}.'), { count: bucket.delta, note: groupNote }),
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatusByKey((prev) => ({ ...prev, [bucket.key]: format(t('rentman.cableExport.errorFormat', 'Fehler: {msg}'), { msg }) }))
    } finally {
      setBusyKey(null)
    }
  }

  /**
   * Push every mapped bucket whose delta is positive in one go. Buckets that
   * still need a Rentman mapping are skipped (and reported in their row).
   * Used by the "Alle senden" header button so the user doesn't have to
   * click `Senden` on each row individually.
   */
  const sendAll = async () => {
    if (!linkedProjectId) return
    const sendable = buckets.filter((b) => b.mappedId && b.delta > 0)
    if (sendable.length === 0) return
    for (const bucket of sendable) {
      // sendBucket guards on busyKey === bucket.key inside its own state,
      // and updates project metadata after each push so the next iteration
      // sees the fresh syncedQty value.
      await sendBucket(bucket)
    }
  }

  if (!open) return null

  const filteredCatalog = catalog
    .filter((item) => {
      const q = pickerQuery.trim().toLowerCase()
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      )
    })
    .slice(0, 200)

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('rentman.cableExport.title', 'Kabel an Rentman senden')}
      maxWidth="4xl"
      scrollBody={false}
    >
      <div className="flex h-full min-h-0 flex-col -mx-4 -my-3">
        <div className="border-b border-cp-border-muted px-4 py-1.5 text-[10px] text-cp-text-muted">
          {linkedProjectName
            ? format(t('rentman.cableExport.target', 'Ziel: {name}'), { name: linkedProjectName })
            : t('rentman.cableExport.noLink', 'Kein Rentman-Projekt verknüpft.')}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-cp-border-muted px-4 py-2 text-[11px] text-cp-text-muted">
          {(() => {
            const totalBuilt = buckets.reduce((sum, b) => sum + b.built, 0)
            const totalSynced = buckets.reduce((sum, b) => sum + b.syncedQty, 0)
            const positiveDeltas = buckets.filter((b) => b.delta > 0)
            const sendableCount = positiveDeltas
              .filter((b) => b.mappedId)
              .reduce((sum, b) => sum + b.delta, 0)
            const unmappedWithDelta = positiveDeltas.filter((b) => !b.mappedId).length
            return (
              <>
                <span>
                  <span className="font-mono text-cp-text-bright">{totalBuilt}</span> {t('rentman.cableExport.cablesBuilt', 'Kabel verbaut')} ·{' '}
                  <span className="font-mono text-cp-text-bright">{totalSynced}</span> {t('rentman.cableExport.alreadySent', 'bereits gesendet')}
                </span>
                {sendableCount > 0 && (
                  <span className="text-amber-300">
                    · <span className="font-mono">+{sendableCount}</span> {t('rentman.cableExport.ready', 'bereit')}
                  </span>
                )}
                {unmappedWithDelta > 0 && (
                  <span className="text-red-400">
                    · {format(t('rentman.cableExport.withoutMapping', '{count} ohne Zuordnung'), { count: unmappedWithDelta })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void sendAll()}
                  disabled={!linkedProjectId || sendableCount === 0 || busyKey !== null}
                  className="ml-auto rounded bg-emerald-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    !linkedProjectId
                      ? t('rentman.cableExport.noLink', 'Kein Rentman-Projekt verknüpft.')
                      : sendableCount === 0
                        ? t('rentman.cableExport.nothingToSend', 'Nichts zu senden — alle Deltas null oder ohne Zuordnung.')
                        : format(t('rentman.cableExport.sendNCablesTitle', '{count} Kabel an Rentman senden'), { count: sendableCount })
                  }
                >
                  {busyKey ? t('rentman.cableExport.sendingShort', 'Sende…') : format(t('rentman.cableExport.sendAll', 'Alle senden (+{count})'), { count: sendableCount })}
                </button>
                <button
                  type="button"
                  onClick={() => void fetchCatalog()}
                  disabled={catalogLoading}
                  className="rounded bg-orange-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {catalogLoading
                    ? t('rentman.cableExport.loading', 'Lädt…')
                    : catalogLoaded
                      ? t('rentman.cableExport.refreshCatalog', 'Katalog aktualisieren')
                      : t('rentman.cableExport.loadCatalog', 'Rentman-Katalog laden')}
                </button>
              </>
            )
          })()}
        </div>

        {catalogError && (
          <div className="border-b border-red-700/60 bg-red-900/30 px-4 py-1.5 text-[11px] text-red-200">
            {catalogError}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-4">
          <table className="w-full text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">{t('rentman.cableExport.col.typeLength', 'Typ / Länge')}</th>
                <th className="px-3 py-2 text-right">{t('rentman.cableExport.col.built', 'Verbaut')}</th>
                <th className="px-3 py-2 text-right">{t('rentman.cableExport.col.planned', 'Geplant')}</th>
                <th className="px-3 py-2 text-right">{t('rentman.cableExport.col.synced', 'Bereits gesendet')}</th>
                <th className="px-3 py-2 text-right">Δ</th>
                <th className="px-3 py-2 text-left">{t('rentman.cableExport.col.mapping', 'Rentman-Zuordnung')}</th>
                <th className="px-3 py-2 text-right">{t('rentman.cableExport.col.action', 'Aktion')}</th>
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-cp-text-faint" colSpan={7}>
                    {t('rentman.cableExport.noCables', 'Keine Kabel im Projekt.')}
                  </td>
                </tr>
              )}
              {buckets.map((bucket) => {
                const status = statusByKey[bucket.key]
                const canSend =
                  !!linkedProjectId &&
                  !!bucket.mappedId &&
                  bucket.delta > 0 &&
                  busyKey !== bucket.key
                return (
                  <tr key={bucket.key} className="border-t border-cp-border-muted align-top">
                    <td className="px-3 py-1.5">
                      <div className="font-medium text-cp-text">{bucket.type}</div>
                      <div className="text-[10px] text-cp-text-muted">
                        {bucket.length} m
                        {bucket.sample ? ` · ${bucket.sample.name}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{bucket.built}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{bucket.planned}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{bucket.syncedQty}</td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono ${
                        bucket.delta > 0
                          ? 'text-amber-300'
                          : bucket.delta < 0
                            ? 'text-red-400'
                            : 'text-emerald-400'
                      }`}
                      title={
                        bucket.delta > 0
                          ? t('rentman.cableExport.deltaPositiveTitle', 'So viele Kabel werden zusätzlich an Rentman gesendet.')
                          : bucket.delta < 0
                            ? t('rentman.cableExport.deltaNegativeTitle', 'Es sind weniger Kabel verbaut als zuletzt gesendet — manuell in Rentman korrigieren.')
                            : t('rentman.cableExport.deltaZeroTitle', 'Verbaut = bereits an Rentman gesendet.')
                      }
                    >
                      {bucket.delta > 0 ? `+${bucket.delta}` : bucket.delta}
                    </td>
                    <td className="px-3 py-1.5">
                      {bucket.mappedId ? (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-cp-text-bright">
                              {bucket.mappedName ?? format(t('rentman.cableExport.rentmanId', 'Rentman-ID {id}'), { id: bucket.mappedId })}
                            </div>
                            <div className="text-[10px] text-cp-text-muted">
                              ID {bucket.mappedId}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => clearMapping(bucket.key)}
                            className="rounded bg-cp-surface-4 px-1.5 py-0.5 text-[10px] hover:bg-cp-surface-5"
                            title={t('rentman.cableExport.removeMapping', 'Zuordnung entfernen')}
                            aria-label={t('rentman.cableExport.removeMapping', 'Zuordnung entfernen')}
                          >
                            <Icon icon={X} size="sm" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (!catalogLoaded && !catalogLoading) void fetchCatalog()
                            setPickerKey(bucket.key)
                            setPickerQuery(`${bucket.type}`)
                          }}
                          className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
                        >
                          {t('rentman.cableExport.pickEquipment', 'Rentman-Equipment wählen…')}
                        </button>
                      )}
                      {pickerKey === bucket.key && (
                        <div className="mt-1 rounded border border-cp-border bg-cp-surface-3 p-1.5">
                          <input
                            type="text"
                            value={pickerQuery}
                            onChange={(event) => setPickerQuery(event.target.value)}
                            placeholder={t('rentman.cableExport.searchPlaceholder', 'Suchen…')}
                            aria-label={t('rentman.cableExport.searchPlaceholder', 'Suchen…')}
                            className="mb-1 w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-0.5 text-[11px]"
                          />
                          <div className="max-h-40 space-y-0.5 overflow-auto">
                            {!catalogLoaded && !catalogLoading && (
                              <div className="px-1 py-0.5 text-[10px] italic text-cp-text-muted">
                                {t('rentman.cableExport.loadCatalogFirst', 'Bitte zuerst Katalog laden.')}
                              </div>
                            )}
                            {catalogLoading && (
                              <div className="px-1 py-0.5 text-[10px] italic text-cp-text-muted">
                                {t('rentman.cableExport.loading', 'Lädt…')}
                              </div>
                            )}
                            {filteredCatalog.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setMapping(bucket.key, item.id, { resetSync: true })
                                  setPickerKey(null)
                                }}
                                className="flex w-full items-start justify-between gap-2 rounded px-1 py-0.5 text-left text-[11px] hover:bg-cp-surface-2"
                              >
                                <span className="min-w-0 flex-1 truncate text-cp-text-bright">
                                  {item.name}
                                </span>
                                <span className="shrink-0 text-[10px] text-cp-text-muted">
                                  {item.category}
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="mt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => setPickerKey(null)}
                              className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] hover:bg-cp-surface-5"
                            >
                              {t('common.cancel', 'Abbrechen')}
                            </button>
                          </div>
                        </div>
                      )}
                      {status && (
                        <div
                          className={`mt-1 text-[10px] ${
                            status.startsWith('Fehler') ? 'text-red-400' : 'text-cp-text-muted'
                          }`}
                        >
                          {status}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => void sendBucket(bucket)}
                        disabled={!canSend}
                        className="rounded bg-orange-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          !linkedProjectId
                            ? t('rentman.cableExport.noLink', 'Kein Rentman-Projekt verknüpft.')
                            : !bucket.mappedId
                              ? t('rentman.cableExport.mapFirst', 'Bitte erst Rentman-Equipment zuordnen.')
                              : bucket.delta <= 0
                                ? t('rentman.cableExport.nothingShort', 'Nichts zu senden.')
                                : format(t('rentman.cableExport.sendNCables', '{count} an Rentman senden.'), { count: bucket.delta })
                        }
                      >
                        {busyKey === bucket.key ? <Spinner size="xs" /> : t('rentman.cableExport.send', 'Senden')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </ModalShell>
  )
}
