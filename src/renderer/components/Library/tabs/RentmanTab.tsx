import { useState, type ReactNode } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useRentman } from '../../../hooks/useRentman'
import { confirmDialog } from '../../../lib/confirmDialog'
import { infoDialog } from '../../../lib/infoDialog'
import { format, useTranslation } from '../../../lib/i18n'
import { MIME_EQUIPMENT } from '../../../lib/dragDropMimes'
import { exportTemplateToFile } from '../../../lib/itemExport'
import { nextPlacementPosition } from '../../../lib/library'
import { stampDeviceLibraryRef } from '../../../lib/librarySync'
import { LibraryItem } from '../LibraryItem'

/**
 * #305 — RentmanTab aus LibraryPanel ausgelagert. Drei Sub-Views:
 *   - 'imported'  → Projekte/Kategorien-Baum der bereits importierten
 *                   Rentman-Items, mit Search + Link-Ports-Action.
 *   - 'catalog'   → Account-Katalog (Folder-Baum aus Rentman), per
 *                   on-demand-Load damit kein API-Budget verbrannt wird.
 *   - 'sync'      → Abgleich-Anzeige Canvas vs. Rentman (untracked +
 *                   removed Items).
 *
 * `useRentman()` lebt hier (nicht im Parent), damit die einzige Stelle
 * der Hook-Instanz bleibt. Sub-View-Toggle (rentmanView) und alle
 * Rentman-bezogenen Collapsed-Sets sind tab-internal.
 */
export const RentmanTab = () => {
  const t = useTranslation()
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const setCustomLibrary = useProjectStore((s) => s.setCustomLibrary)
  const addEquipment = useProjectStore((s) => s.addEquipment)
  const equipmentCount = useProjectStore((s) => s.project.equipment.length)
  const equipmentItems = useProjectStore((s) => s.project.equipment)
  const resyncRentmanLibraryFromCanvas = useProjectStore((s) => s.resyncRentmanLibraryFromCanvas)
  const linkedRentmanProjectId = useProjectStore((s) => s.project.metadata.rentmanProjectId)
  const linkedRentmanProjectName = useProjectStore((s) => s.project.metadata.rentmanProjectName)
  const openRentmanImport = useUiStore((s) => s.openRentmanImport)

  const {
    loadEquipment: loadRentmanEquipment,
    loadFolders: loadRentmanFolders,
    exportToCablePlannerGroup,
  } = useRentman()

  // Sub-View des Tabs (Importiert | Katalog | Sync). War vorher im Parent.
  const [rentmanView, setRentmanView] = useState<'imported' | 'catalog' | 'sync'>('imported')
  // Collapsed-Sets fuer die Tree-Views im 'imported' Sub-View.
  const [collapsedRentmanProjects, setCollapsedRentmanProjects] = useState<Set<string>>(new Set())
  const [collapsedRentmanCats, setCollapsedRentmanCats] = useState<Set<string>>(new Set())
  // Such-Filter fuer die Importiert-Liste.
  const [rentmanSearch, setRentmanSearch] = useState('')
  // Account-Katalog State (Lazy-Load on demand).
  const [rentmanCatalog, setRentmanCatalog] = useState<
    { id: string; name: string; category: string; folderId: string | null }[]
  >([])
  const [rentmanFolderTree, setRentmanFolderTree] = useState<
    Record<string, { id: string; name: string; parentId: string | null }>
  >({})
  const [collapsedCatalogFolders, setCollapsedCatalogFolders] = useState<Set<string>>(new Set())
  const [rentmanCatalogError, setRentmanCatalogError] = useState<string | null>(null)
  const [rentmanCatalogLoading, setRentmanCatalogLoading] = useState(false)
  const [rentmanCatalogLoaded, setRentmanCatalogLoaded] = useState(false)
  const [rentmanCatalogQuery, setRentmanCatalogQuery] = useState('')
  const [rentmanCatalogCollapsed, setRentmanCatalogCollapsed] = useState(true)
  const [rentmanCatalogAddBusy, setRentmanCatalogAddBusy] = useState<string | null>(null)

  const fetchRentmanCatalog = async () => {
    setRentmanCatalogLoading(true)
    setRentmanCatalogError(null)
    try {
      const [equipmentData, folderData] = await Promise.all([
        loadRentmanEquipment(),
        loadRentmanFolders(),
      ])
      const folderRecords = folderData as Record<string, unknown>[]
      const folderTree: Record<string, { id: string; name: string; parentId: string | null }> = {}
      const folders = folderRecords.reduce<Record<string, string>>((acc, folder) => {
        const key = String(folder.id ?? folder._id ?? '')
        if (!key) return acc
        const name = String(folder.name ?? folder.displayname ?? key)
        acc[key] = name
        const rawParent = (folder.parent ?? folder.equipmentfolder ?? folder.parent_id ?? null) as unknown
        let parentId: string | null = null
        if (rawParent !== null && rawParent !== undefined && rawParent !== '') {
          const s = String(rawParent)
          const match = s.match(/(\d+)\s*$/)
          parentId = match ? match[1] : null
        }
        folderTree[key] = { id: key, name, parentId }
        return acc
      }, {})
      setRentmanFolderTree(folderTree)
      const mapped = (equipmentData as Record<string, unknown>[])
        .map((rec) => {
          const id = String(rec.id ?? rec._id ?? '')
          if (!id) return null
          const name = String(rec.name ?? rec.displayname ?? `Equipment ${id}`)
          const rawFolder = (rec.equipmentfolder ?? rec.folder ?? rec.category ?? '') as unknown
          let folderId: string | null = null
          if (rawFolder !== null && rawFolder !== undefined && rawFolder !== '') {
            const s = String(rawFolder)
            const match = s.match(/(\d+)\s*$/)
            folderId = match ? match[1] : s || null
          }
          const category = folderId && folders[folderId] ? folders[folderId] : 'Uncategorized'
          return { id, name, category, folderId }
        })
        .filter((row): row is { id: string; name: string; category: string; folderId: string | null } => row !== null)
      mapped.sort((a, b) => a.name.localeCompare(b.name))
      setRentmanCatalog(mapped)
      setRentmanCatalogLoaded(true)
    } catch (err) {
      setRentmanCatalogError(err instanceof Error ? err.message : t('library.rentman.loadFailed', 'Laden fehlgeschlagen'))
    } finally {
      setRentmanCatalogLoading(false)
    }
  }

  const handleAddCatalogItemToProject = async (item: {
    id: string
    name: string
    category: string
  }) => {
    if (!linkedRentmanProjectId) return
    const projectName = linkedRentmanProjectName ?? t('library.rentman.activeProjectFallback', 'aktivem Rentman-Projekt')
    if (
      !(await confirmDialog(
        format(t('library.rentman.confirmAdd', '"{name}" zu Rentman hinzufügen?'), { name: item.name }),
        {
          body: format(
            t('library.rentman.confirmAddBody', 'Das ändert dein {project} und ist nicht automatisch reversibel.'),
            { project: projectName },
          ),
          okLabel: t('library.rentman.confirmAddOk', 'Hinzufügen'),
        },
      ))
    ) {
      return
    }
    setRentmanCatalogAddBusy(item.id)
    try {
      // v7.9.110 — Batch-Export-Action. Legt 'CablePlanner'-Group im
      // Subproject an (oder verwendet die bestehende) und packt das item rein.
      const result = await exportToCablePlannerGroup(linkedRentmanProjectId, [
        { equipmentId: item.id, quantity: 1 },
      ])
      if (result.failed.length > 0) {
        const msg = result.failed.map((f) => `- ${f.error}`).join('\n')
        await infoDialog(t('library.rentman.partialFailTitle', 'Hinzufügen teilweise fehlgeschlagen'), {
          body: format(t('library.rentman.partialFailBody', '{ok} OK, {fail} Fehler:\n{msg}'), {
            ok: result.added,
            fail: result.failed.length,
            msg,
          }),
          tone: 'warning',
        })
      } else {
        // v7.9.117 — Drei Faelle: groupCreated, groupId set, oder kein Group-Support.
        const groupNote = result.groupCreated
          ? ' ' + t('library.rentman.groupCreated', '(neue Gruppe "CablePlanner" angelegt)')
          : result.groupId
            ? ' ' + t('library.rentman.groupReused', '(zur bestehenden Gruppe "CablePlanner" hinzugefügt)')
            : ' ' + t('library.rentman.noGroups', '(ohne Gruppe — dein Rentman-Plan erlaubt keine API-Gruppen)')
        await infoDialog(format(t('library.rentman.addedTitle', '"{name}" hinzugefügt'), { name: item.name }), {
          body: format(t('library.rentman.addedBody', 'Wurde dem Rentman-Projekt "{project}" hinzugefügt{note}.'), {
            project: projectName,
            note: groupNote,
          }),
          tone: 'success',
        })
      }
    } catch (err) {
      await infoDialog(t('library.rentman.addError', 'Fehler beim Hinzufügen zu Rentman'), {
        body: err instanceof Error ? err.message : String(err),
        tone: 'error',
      })
    } finally {
      setRentmanCatalogAddBusy(null)
    }
  }

  const rentmanItems = customLibrary.filter((template) => template.rentmanSource)
  const projectMap = new Map<
    string,
    { id: string; name: string; items: typeof rentmanItems }
  >()
  for (const template of rentmanItems) {
    const id = template.rentmanSource ?? '__unknown__'
    const name = template.rentmanProjectName ?? format(t('library.rentman.projectFallback', 'Projekt #{id}'), { id })
    if (!projectMap.has(id)) projectMap.set(id, { id, name, items: [] })
    projectMap.get(id)!.items.push(template)
  }
  if (linkedRentmanProjectId && !projectMap.has(linkedRentmanProjectId)) {
    projectMap.set(linkedRentmanProjectId, {
      id: linkedRentmanProjectId,
      name: linkedRentmanProjectName ?? format(t('library.rentman.projectFallback', 'Projekt #{id}'), { id: linkedRentmanProjectId }),
      items: [],
    })
  }
  const projectGroups = Array.from(projectMap.values()).sort((a, b) => {
    if (a.id === linkedRentmanProjectId) return -1
    if (b.id === linkedRentmanProjectId) return 1
    return a.name.localeCompare(b.name)
  })
  const untracked = equipmentItems.filter((equipment) => !equipment.rentmanId)
  const removed = equipmentItems.filter((equipment) => equipment.rentmanRemoved)
  const linkedImportedCount = linkedRentmanProjectId
    ? projectGroups.find((group) => group.id === linkedRentmanProjectId)?.items.length ?? 0
    : 0

  const toggleProject = (id: string) =>
    setCollapsedRentmanProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleRentmanCat = (key: string) =>
    setCollapsedRentmanCats((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-auto">
      {linkedRentmanProjectId ? (
        <div className="rounded border border-orange-600/60 bg-orange-900/20 p-2">
          <div className="text-[10px] uppercase tracking-wider text-orange-300/80">
            {t('library.rentman.currentLinkedProject', 'Aktuell verknüpftes Rentman-Projekt')}
          </div>
          <div className="mt-0.5 truncate text-cp-base font-semibold text-orange-200">
            {linkedRentmanProjectName ?? format(t('library.rentman.projectFallback', 'Projekt #{id}'), { id: linkedRentmanProjectId })}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-orange-100/80">
            <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{format(t('library.rentman.statImported', '{n} importiert'), { n: linkedImportedCount })}</span>
            <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{format(t('library.rentman.statNoId', '{n} ohne Rentman-ID'), { n: untracked.length })}</span>
            {removed.length > 0 && (
              <span className="rounded bg-red-950/50 px-1.5 py-0.5 text-red-200">{format(t('library.rentman.statRemoved', '{n} entfernt'), { n: removed.length })}</span>
            )}
          </div>
          {/* v7.9.128 — Prominente "Aus Rentman aktualisieren"-Action. */}
          <button
            type="button"
            onClick={openRentmanImport}
            className="mt-2 w-full rounded bg-orange-600 px-2 py-1.5 text-cp-xs font-semibold text-white hover:bg-orange-500"
            title={t('library.rentman.refreshTitle', 'Aktuelle Equipment-Liste aus dem verknüpften Rentman-Projekt holen — neue oder geänderte Items werden im Dialog angezeigt.')}
          >
            🔄 {t('library.rentman.refreshAction', 'Aus Rentman aktualisieren / neue Items importieren')}
          </button>
          {(() => {
            // v7.9.70 / #171 — Re-Sync Button: zeigt nur wenn Canvas-Equipment
            // mit rentmanId hat, das keinen Library-Template-Eintrag findet.
            const rentmanTaggedOnCanvas = equipmentItems.filter(
              (e) => e.rentmanId && !e.rentmanRemoved,
            ).length
            const missing = Math.max(0, rentmanTaggedOnCanvas - linkedImportedCount)
            if (missing === 0) return null
            return (
              <button
                type="button"
                onClick={() => {
                  const n = resyncRentmanLibraryFromCanvas()
                  if (n > 0) {
                    void confirmDialog(
                      format(
                        n === 1
                          ? t('library.rentman.resyncDoneOne', '{n} Library-Eintrag aus Canvas wiederhergestellt.')
                          : t('library.rentman.resyncDoneMany', '{n} Library-Einträge aus Canvas wiederhergestellt.'),
                        { n },
                      ),
                      { okLabel: t('common.ok', 'OK') },
                    )
                  }
                }}
                className="mt-2 w-full rounded bg-orange-700/60 px-2 py-1 text-[11px] text-orange-100 hover:bg-orange-700"
                title={format(t('library.rentman.resyncTitle', '{n} Rentman-Geräte auf dem Canvas sind nicht mit Library-Templates verknüpft. Klick rekonstruiert die fehlenden Templates aus den Canvas-Daten.'), { n: missing })}
              >
                🔄 {format(t('library.rentman.resyncAction', '{n} fehlende Library-Einträge nachbauen'), { n: missing })}
              </button>
            )
          })()}
        </div>
      ) : (
        <div className="rounded border border-cp-border bg-cp-surface-1/50 p-2 text-cp-xs text-cp-text-muted">
          <div className="mb-2">{t('library.rentman.noProjectLinked', 'Kein Rentman-Projekt verknüpft.')}</div>
          <button
            type="button"
            onClick={openRentmanImport}
            className="w-full rounded bg-orange-700 px-2 py-1.5 text-cp-xs font-semibold text-white hover:bg-orange-600"
            title={t('library.rentman.linkTitle', 'Rentman-Projekt auswählen und mit dieser Plan-Datei verknüpfen')}
          >
            {t('library.rentman.linkProject', 'Rentman-Projekt verknüpfen…')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 rounded border border-cp-border-muted bg-cp-surface-1 p-0.5 text-[11px]">
        {([
          ['imported', t('library.rentman.view.imported', 'Importiert')],
          ['catalog', t('library.rentman.view.catalog', 'Katalog')],
          ['sync', t('library.rentman.view.sync', 'Abgleich')],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setRentmanView(id)}
            className={`rounded px-2 py-1 font-medium ${
              rentmanView === id
                ? 'bg-orange-700 text-white'
                : 'text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text-bright'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rentmanView === 'imported' && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
            <h2 className="text-cp-base font-semibold">{t('library.rentman.imported', 'Importierte Rentman-Geräte')}</h2>
            <div className="flex items-center gap-2 text-[10px] text-cp-text-muted">
              {(() => {
                const projectIds = new Set(projectGroups.map((group) => group.id))
                const categoryKeys = new Set<string>()
                for (const group of projectGroups) {
                  const categories = new Set(group.items.map((template) => template.category || 'Sonstiges'))
                  for (const category of categories) categoryKeys.add(`${group.id}::${category}`)
                }
                const allCollapsed =
                  Array.from(projectIds).every((id) => collapsedRentmanProjects.has(id)) &&
                  Array.from(categoryKeys).every((key) => collapsedRentmanCats.has(key))
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (allCollapsed) {
                        setCollapsedRentmanProjects(new Set())
                        setCollapsedRentmanCats(new Set())
                      } else {
                        setCollapsedRentmanProjects(projectIds)
                        setCollapsedRentmanCats(categoryKeys)
                      }
                    }}
                    className="underline hover:text-cp-text-secondary"
                  >
                    {allCollapsed
                      ? t('library.rentman.expandAll', 'Alle ausklappen')
                      : t('library.rentman.collapseAll', 'Alle einklappen')}
                  </button>
                )
              })()}
              <span>{format(t('library.rentman.devicesCount', '{n} Geräte'), { n: rentmanItems.length })}</span>
            </div>
          </div>
          {/* v7.9.106 / Issue #226 — Suchfeld fuer die Rentman-Liste. */}
          {projectGroups.length > 0 && (
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-cp-text-faint"
              >
                <circle cx="7" cy="7" r="4" />
                <line x1="10.3" y1="10.3" x2="13" y2="13" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={rentmanSearch}
                onChange={(e) => setRentmanSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRentmanSearch('')
                }}
                placeholder={t('library.rentmanSearchPlaceholder', 'In Rentman-Geraeten suchen…')}
                aria-label={t('library.rentmanSearchPlaceholder', 'In Rentman-Geraeten suchen…')}
                className="w-full rounded border border-cp-border bg-cp-surface-1 py-1 pl-7 pr-7 text-cp-xs text-cp-text placeholder-slate-500"
              />
              {rentmanSearch && (
                <button
                  type="button"
                  onClick={() => setRentmanSearch('')}
                  title={t('library.search.clear', 'Suche löschen')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-cp-xs text-cp-text-faint hover:bg-cp-surface-4 hover:text-cp-text-bright"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {(() => {
            const trimmed = rentmanSearch.trim().toLowerCase()
            const visibleProjectGroups =
              trimmed === ''
                ? projectGroups
                : projectGroups
                    .map((g) => ({
                      ...g,
                      items: g.items.filter(
                        (t) =>
                          (t.name || '').toLowerCase().includes(trimmed) ||
                          (t.category || '').toLowerCase().includes(trimmed),
                      ),
                    }))
                    .filter((g) => g.items.length > 0)
            if (projectGroups.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 p-3 text-center text-cp-xs text-cp-text-faint">
                  <span className="text-2xl">📦</span>
                  <span>{t('library.rentman.noneImported', 'Noch keine Rentman-Geräte importiert.')}</span>
                </div>
              )
            }
            if (visibleProjectGroups.length === 0) {
              return (
                <div className="flex flex-col items-center gap-2 p-3 text-center text-cp-xs text-cp-text-faint">
                  <span className="text-2xl">🔍</span>
                  <span>{format(t('library.rentman.noMatches', 'Keine Treffer für "{query}".'), { query: rentmanSearch })}</span>
                </div>
              )
            }
            return (
              <div className="space-y-2">
                {visibleProjectGroups.map((group) => {
                  const isLinked = group.id === linkedRentmanProjectId
                  const projectCollapsed = collapsedRentmanProjects.has(group.id)
                  const categories = Array.from(
                    new Set(group.items.map((template) => template.category || 'Sonstiges')),
                  ).sort()
                  return (
                    <section
                      key={group.id}
                      className={`rounded border ${
                        isLinked
                          ? 'border-orange-600/60 bg-orange-900/10'
                          : 'border-cp-border bg-cp-surface-1/40'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleProject(group.id)}
                        className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left ${
                          isLinked
                            ? 'text-orange-200 hover:bg-orange-900/20'
                            : 'text-cp-text-secondary hover:bg-cp-surface-2/40'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="text-cp-xs">{projectCollapsed ? '▶' : '▼'}</span>
                          {isLinked && (
                            <span className="rounded bg-orange-700 px-1 text-[11px] font-bold text-white">AKTIV</span>
                          )}
                          <span className="truncate text-cp-xs font-semibold">{group.name}</span>
                        </span>
                        <span className="text-[10px] text-cp-text-muted">{format(t('library.rentman.devicesCount', '{n} Geräte'), { n: group.items.length })}</span>
                      </button>
                      {!projectCollapsed && (
                        <div className="space-y-1 border-t border-cp-border-muted px-1 py-1">
                          {categories.length === 0 ? (
                            <div className="px-2 py-1 text-[11px] italic text-cp-text-muted">{t('library.rentman.noneInCategory', 'Keine Geräte importiert.')}</div>
                          ) : (
                            categories.map((category) => {
                              const categoryKey = `${group.id}::${category}`
                              const categoryCollapsed = collapsedRentmanCats.has(categoryKey)
                              const categoryItems = group.items.filter((template) => (template.category || 'Sonstiges') === category)
                              return (
                                <div key={categoryKey} className="rounded border border-cp-border-muted/80">
                                  <button
                                    type="button"
                                    onClick={() => toggleRentmanCat(categoryKey)}
                                    className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright"
                                  >
                                    <span className="flex items-center gap-1">
                                      <span>{categoryCollapsed ? '▶' : '▼'}</span>
                                      <span>{category}</span>
                                    </span>
                                    <span className="font-normal text-cp-text-dim">({categoryItems.length})</span>
                                  </button>
                                  {!categoryCollapsed && (
                                    <div className="space-y-1 px-1 pb-1">
                                      {categoryItems
                                        .slice()
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map((item) => {
                                          // v7.9.106 / Issue #227 — Link-Ports fuer port-leere
                                          // Rentman-Items, die einen lokalen Template-Match haben.
                                          const itemHasNoPorts =
                                            item.inputs.length === 0 && item.outputs.length === 0
                                          const localMatch = itemHasNoPorts
                                            ? customLibrary.find(
                                                (t) =>
                                                  !t.rentmanSource &&
                                                  t.name.toLowerCase() === item.name.toLowerCase() &&
                                                  (t.inputs.length > 0 || t.outputs.length > 0),
                                              )
                                            : undefined
                                          return (
                                            <LibraryItem
                                              key={item.name}
                                              item={item}
                                              onAdd={() => {
                                                addEquipment({
                                                  ...stampDeviceLibraryRef(item),
                                                  ...nextPlacementPosition(equipmentCount, equipmentItems),
                                                })
                                              }}
                                              onExport={() => exportTemplateToFile(item)}
                                              onLinkPorts={
                                                localMatch
                                                  ? () => {
                                                      const updated = customLibrary.map((t) =>
                                                        t.name === item.name &&
                                                        t.rentmanSource === item.rentmanSource
                                                          ? {
                                                              ...t,
                                                              inputs: localMatch.inputs.map((p) => ({ ...p })),
                                                              outputs: localMatch.outputs.map((p) => ({ ...p })),
                                                            }
                                                          : t,
                                                      )
                                                      setCustomLibrary(updated)
                                                    }
                                                  : undefined
                                              }
                                              linkTargetName={localMatch?.name}
                                            />
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {rentmanView === 'catalog' && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRentmanCatalogCollapsed((value) => !value)}
              className="flex flex-1 items-center gap-1 text-left text-cp-base font-semibold text-cp-text-bright hover:text-white"
              title={t('library.rentman.accountTitle', 'Alle in deinem Rentman-Account angelegten Equipments (Account-Katalog), gegliedert nach der Rentman-Ordnerstruktur')}
            >
              <span className="text-cp-xs">{rentmanCatalogCollapsed ? '▶' : '▼'}</span>
              <span>{t('library.rentman.accountAll', 'Alle Rentman-Equipments (Account-Katalog)')}</span>
              {rentmanCatalogLoaded && (
                <span className="ml-1 rounded-full bg-cp-surface-2 px-1.5 text-[10px] text-cp-text-muted">{rentmanCatalog.length}</span>
              )}
            </button>
            <button
              type="button"
              onClick={fetchRentmanCatalog}
              disabled={rentmanCatalogLoading}
              className="rounded bg-orange-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {rentmanCatalogLoading
                ? '…'
                : rentmanCatalogLoaded
                  ? t('library.rentman.catalogRefresh', 'Aktualisieren')
                  : t('library.rentman.catalogLoad', 'Katalog laden')}
            </button>
          </div>

          {!rentmanCatalogCollapsed && (
            <>
              {rentmanCatalogError && (
                <div className="mb-2 rounded border border-red-700/60 bg-red-900/30 px-2 py-1 text-[11px] text-red-200">{rentmanCatalogError}</div>
              )}
              {!rentmanCatalogLoaded && !rentmanCatalogLoading && !rentmanCatalogError && (
                <div className="rounded border border-cp-border/60 bg-cp-surface-1/40 p-2 text-center text-[11px] text-cp-text-muted">
                  {t(
                    'library.rentman.catalogNotLoaded',
                    'Noch nicht geladen. Klick „Katalog laden", um den gesamten Rentman-Katalog deines Accounts anzuzeigen.',
                  )}
                </div>
              )}
              {rentmanCatalogLoaded && (
                <>
                  <input
                    type="text"
                    value={rentmanCatalogQuery}
                    onChange={(event) => setRentmanCatalogQuery(event.target.value)}
                    placeholder={t('common.search', 'Suchen…')}
                    aria-label={t('common.search', 'Suchen…')}
                    className="mb-2 w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text placeholder-slate-500"
                  />
                  {(() => {
                    const importedIds = new Set(
                      customLibrary.filter((template) => !!template.rentmanId).map((template) => String(template.rentmanId)),
                    )
                    const query = rentmanCatalogQuery.trim().toLowerCase()
                    const filtered = rentmanCatalog
                      .filter((item) => !importedIds.has(item.id))
                      .filter((item) =>
                        !query
                          ? true
                          : item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query),
                      )
                    if (filtered.length === 0) {
                      return (
                        <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-[11px] text-emerald-300">
                          {t('library.rentman.allImported', '✓ Alle verfügbaren Rentman-Geräte sind bereits importiert.')}
                        </div>
                      )
                    }

                    const renderItem = (item: { id: string; name: string; category: string }) => {
                      const busy = rentmanCatalogAddBusy === item.id
                      const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
                        const template = {
                          name: item.name,
                          category: item.category || 'Sonstiges',
                          rentmanId: item.id,
                          inputs: [],
                          outputs: [],
                        }
                        event.dataTransfer.setData(MIME_EQUIPMENT, JSON.stringify(template))
                        event.dataTransfer.effectAllowed = 'copy'
                      }
                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={handleDragStart}
                          className="flex cursor-grab items-center justify-between gap-2 rounded border border-cp-border-muted bg-cp-surface-1/40 px-2 py-1.5 text-cp-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-cp-text-bright">{item.name}</div>
                            <div className="truncate text-[10px] text-cp-text-muted">{format(t('library.rentman.idLine', 'Rentman-ID {id}'), { id: item.id })}</div>
                          </div>
                          {linkedRentmanProjectId && (
                            <button
                              type="button"
                              onClick={() => handleAddCatalogItemToProject(item)}
                              disabled={busy}
                              className="rounded bg-orange-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                            >
                              {busy ? '…' : t('library.rentman.addToProject', '+ Projekt')}
                            </button>
                          )}
                        </div>
                      )
                    }

                    // While searching, show a flat result list (no tree noise).
                    if (query) {
                      return <div className="space-y-1">{filtered.map(renderItem)}</div>
                    }

                    // Build folder tree from the loaded folder records.
                    const folders = rentmanFolderTree
                    const folderIds = Object.keys(folders)
                    const childMap = new Map<string | null, string[]>()
                    for (const fid of folderIds) {
                      const parentId = folders[fid].parentId
                      const parentKey = parentId && folders[parentId] ? parentId : null
                      const list = childMap.get(parentKey) ?? []
                      list.push(fid)
                      childMap.set(parentKey, list)
                    }
                    for (const list of childMap.values()) {
                      list.sort((a, b) => folders[a].name.localeCompare(folders[b].name))
                    }

                    // Group catalog items by their folderId.
                    const itemsByFolder = new Map<string | null, typeof filtered>()
                    for (const item of filtered) {
                      const key = item.folderId && folders[item.folderId] ? item.folderId : null
                      const list = itemsByFolder.get(key) ?? []
                      list.push(item)
                      itemsByFolder.set(key, list)
                    }

                    // Count items recursively (folder + all descendants).
                    const countCache = new Map<string, number>()
                    const countItems = (folderId: string): number => {
                      const cached = countCache.get(folderId)
                      if (cached !== undefined) return cached
                      let total = itemsByFolder.get(folderId)?.length ?? 0
                      for (const child of childMap.get(folderId) ?? []) total += countItems(child)
                      countCache.set(folderId, total)
                      return total
                    }

                    const toggleFolder = (id: string) =>
                      setCollapsedCatalogFolders((prev) => {
                        const next = new Set(prev)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })

                    const renderFolder = (folderId: string, depth: number): ReactNode => {
                      const folder = folders[folderId]
                      const collapsed = collapsedCatalogFolders.has(folderId)
                      const total = countItems(folderId)
                      if (total === 0) return null
                      const folderItems = (itemsByFolder.get(folderId) ?? [])
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                      const childIds = childMap.get(folderId) ?? []
                      return (
                        <div key={folderId} className="rounded border border-cp-border-muted/80">
                          <button
                            type="button"
                            onClick={() => toggleFolder(folderId)}
                            className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-cp-text-secondary hover:text-cp-text"
                            style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                          >
                            <span className="flex items-center gap-1">
                              <span>{collapsed ? '▶' : '▼'}</span>
                              <span>📁</span>
                              <span>{folder.name}</span>
                            </span>
                            <span className="font-normal text-cp-text-faint">({total})</span>
                          </button>
                          {!collapsed && (
                            <div className="space-y-1 px-1 pb-1">
                              {folderItems.length > 0 && (
                                <div className="space-y-1" style={{ paddingLeft: `${(depth + 1) * 0.75}rem` }}>
                                  {folderItems.map(renderItem)}
                                </div>
                              )}
                              {childIds.map((child) => renderFolder(child, depth + 1))}
                            </div>
                          )}
                        </div>
                      )
                    }

                    const rootFolderIds = childMap.get(null) ?? []
                    const orphans = (itemsByFolder.get(null) ?? [])
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))

                    return (
                      <div className="space-y-2">
                        {rootFolderIds.map((id) => renderFolder(id, 0))}
                        {orphans.length > 0 && (
                          <div className="rounded border border-cp-border-muted/80">
                            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-cp-text-muted">
                              {t('library.rentman.noFolder', 'Ohne Ordner')} <span className="font-normal text-cp-text-dim">({orphans.length})</span>
                            </div>
                            <div className="space-y-1 px-2 pb-1">{orphans.map(renderItem)}</div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </>
          )}
        </div>
      )}

      {rentmanView === 'sync' && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-cp-base font-semibold text-amber-300">{t('library.rentman.reconcile', 'Abgleich Canvas ↔ Rentman')}</h2>
            <span className="text-[10px] text-cp-text-muted">{format(t('library.rentman.notTracked', '{n} nicht erfasst'), { n: untracked.length })}</span>
          </div>
          {/* v7.9.128 — Auch im Sync-View ein prominenter Fetch-Knopf. */}
          {linkedRentmanProjectId && (
            <button
              type="button"
              onClick={openRentmanImport}
              className="mb-3 w-full rounded bg-orange-600 px-2 py-1.5 text-cp-xs font-semibold text-white hover:bg-orange-500"
              title={t('library.rentman.loadProjectTitle', 'Equipment-Liste aus dem verknüpften Rentman-Projekt jetzt laden. Neue Items können direkt importiert werden.')}
            >
              🔄 {t('library.rentman.refreshAction', 'Aus Rentman aktualisieren / neue Items importieren')}
            </button>
          )}
          {removed.length > 0 && (
            <div className="mb-2 space-y-1">
              <div className="mb-1 text-[10px] text-red-400">{t('library.rentman.removed', 'Nicht mehr in Rentman vorhanden:')}</div>
              {removed.map((equipment) => (
                <div key={equipment.id} className="flex items-center justify-between rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-cp-xs">
                  <div>
                    <span className="font-medium text-cp-text">{equipment.name}</span>
                    <span className="ml-1 text-[10px] text-cp-text-muted">{equipment.category}</span>
                  </div>
                  <span className="text-[10px] text-red-400">{t('library.rentman.removedTag', 'entfernt')}</span>
                </div>
              ))}
            </div>
          )}
          {untracked.length === 0 ? (
            <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-cp-xs text-emerald-400">
              {t('library.rentman.allHaveId', '✓ Alle Canvas-Geräte haben eine Rentman-ID.')}
            </div>
          ) : (
            <div className="space-y-1">
              {untracked.map((equipment) => (
                <div key={equipment.id} className="flex items-center justify-between rounded border border-amber-700/30 bg-amber-900/10 px-2 py-1 text-cp-xs">
                  <div>
                    <span className="font-medium text-cp-text">{equipment.name}</span>
                    <span className="ml-1 text-[10px] text-cp-text-muted">{equipment.category}</span>
                  </div>
                  <span className="text-[10px] text-amber-500">{t('library.rentman.noIdTag', 'kein Rentman-ID')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
