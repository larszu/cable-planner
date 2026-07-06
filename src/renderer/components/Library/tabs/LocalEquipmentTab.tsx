import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Pencil, X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useInventoryStore } from '../../../store/inventoryStore'
import { bilingualCategoryDialog } from '../../../lib/bilingualCategoryDialog'
import { categoryDisplay } from '../../../lib/categoryTranslations'
import { format, useTranslation } from '../../../lib/i18n'
import { openLibraryFolder, stampDeviceLibraryRef } from '../../../lib/librarySync'
import { hasDesktopBridge } from '../../../lib/bridge'
import { MIME_EQUIPMENT } from '../../../lib/dragDropMimes'
import { exportTemplateToFile } from '../../../lib/itemExport'
import { nextPlacementPosition } from '../../../lib/library'
import type { EquipmentTemplate } from '../../../types/equipment'
import { CategoryDndWrapper } from '../LibraryDndWrappers'
import { SortableCategorySection } from '../LibrarySortables'
import { PlusMenu, LibraryFiltersMenu } from '../LibraryMenus'
import { LibraryItem } from '../LibraryItem'

interface LocalEquipmentTabProps {
  /** Opens the "Eigenes Gerät anlegen" dialog in the parent. */
  onOpenCreateDialog: () => void
  /** Triggers the .cpdevice/.cpgroup file-picker import in the parent. */
  onImportLibraryFile: () => void | Promise<void>
}

/**
 * #305 — Lokale Equipment-Library als eigene Tab-Komponente.
 * Enthaelt: Such-Zeile (mit Strg+F), View-Mode-Toggle (Manual/Asc/Desc),
 * Kategorie-DnD, Kategorie-Rename mit bilingual-Dialog, Library-Liste
 * mit Favorite/Hidden-Toggles. Tab-internes State (collapsedCats,
 * librarySearch, showHidden, ...) lebt hier; das Auf-Canvas-Setzen
 * benutzt nextPlacementPosition direkt damit der Parent keinen
 * useMemo durchreichen muss.
 */
export const LocalEquipmentTab = ({
  onOpenCreateDialog,
  onImportLibraryFile,
}: LocalEquipmentTabProps) => {
  const t = useTranslation()
  const addEquipment = useProjectStore((s) => s.addEquipment)
  const equipmentCount = useProjectStore((s) => s.project.equipment.length)
  const equipmentItems = useProjectStore((s) => s.project.equipment)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const removeCustomTemplate = useProjectStore((s) => s.removeCustomTemplate)
  const toggleTemplateFavorite = useProjectStore((s) => s.toggleTemplateFavorite)
  const toggleTemplateHidden = useProjectStore((s) => s.toggleTemplateHidden)
  const setCustomTemplateCategory = useProjectStore((s) => s.setCustomTemplateCategory)
  const setSelectedTemplateName = useProjectStore((s) => s.setSelectedTemplateName)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const reorderCategories = useProjectStore((s) => s.reorderCategories)
  const renameCustomCategory = useProjectStore((s) => s.renameCustomCategory)
  const categoryTranslations = useProjectStore((s) => s.categoryTranslations)
  const setCategoryTranslation = useProjectStore((s) => s.setCategoryTranslation)
  const lang = useUiStore((s) => s.language)
  const librarySortMode = useUiStore((s) => s.librarySortMode)
  const setLibrarySortMode = useUiStore((s) => s.setLibrarySortMode)
  // Lager-Modul (#Task 13): „nur eigenes Material" — Menge der Modelle, die als
  // Eigentum (ownership=owned) im projektübergreifenden Lager stehen.
  const inventoryItems = useInventoryStore((s) => s.items)
  const ownedModels = useMemo(() => {
    const set = new Set<string>()
    for (const it of inventoryItems) {
      if (it.ownership === 'owned') set.add(it.model.trim().toLowerCase())
    }
    return set
  }, [inventoryItems])

  // Tab-interner State (war vorher im LibraryPanel).
  const [librarySearch, setLibrarySearch] = useState('')
  const [showEmpty, setShowEmpty] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [onlyOwned, setOnlyOwned] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  // v7.9.5 — Standard: ALLES eingeklappt. Initial-Set wird beim ersten
  // Mount mit den aktuellen Kategorien gefuellt; danach verwaltet der
  // User selber per Klick was offen oder zu ist (Component-State, kein
  // persist).
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const collapsedInitRef = useRef(false)
  const newGroupInputRef = useRef<HTMLInputElement>(null)
  const librarySearchRef = useRef<HTMLInputElement>(null)

  // Strg+F focussiert das Suchfeld. Listener auf window damit es
  // unabhaengig vom Fokus reagiert (TEXTAREA / contenteditable
  // werden uebersprungen damit normales Textbearbeiten nicht
  // hijacked wird).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'TEXTAREA' || target?.isContentEditable) return
        e.preventDefault()
        librarySearchRef.current?.focus()
        librarySearchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // v7.9.5 — Beim ersten Mount alle aktuell vorhandenen Kategorien
  // einklappen (Default-collapsed). Laueft nur einmal.
  useEffect(() => {
    if (collapsedInitRef.current) return
    const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
    const allCats = new Set([...knownCategories, ...usedCats])
    if (allCats.size === 0) return
    collapsedInitRef.current = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Einmalige Initialisierung der eingeklappten Kategorien
    setCollapsedCats(allCats)
  }, [customLibrary, knownCategories])

  return (
    <>
      {/* v7.9.5 — Such-Zeile mit "+"-Dropdown rechts und View-Mode-Toggle.
          Strg+F-Hint bleibt als grauer Suffix sichtbar auch nach Eingabe. */}
      <div className="mb-2 flex items-center gap-1">
        <div className="relative flex-1">
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-cp-text-faint"
          >
            <circle cx="7" cy="7" r="4.5" />
            <line x1="10.3" y1="10.3" x2="13" y2="13" strokeLinecap="round" />
          </svg>
          <input
            ref={librarySearchRef}
            type="text"
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setLibrarySearch('')
            }}
            placeholder={t('library.search.placeholder', 'Suchen…')}
            aria-label={t('library.search.placeholder', 'Suchen…')}
            className="w-full rounded border border-cp-border bg-cp-surface-1 py-1 pl-7 pr-12 text-cp-xs text-cp-text placeholder-slate-500"
          />
          {librarySearch ? (
            <button
              type="button"
              onClick={() => setLibrarySearch('')}
              title={t('library.search.clear', 'Suche löschen')}
              aria-label={t('library.search.clear', 'Suche löschen')}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-1 py-0.5 text-cp-xs text-cp-text-faint hover:bg-cp-surface-4 hover:text-cp-text-bright"
            >
              <Icon icon={X} size="sm" />
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-cp-text-muted">
              {t('library.search.shortcut', 'Strg+F')}
            </span>
          )}
        </div>
        {/* Einziger "+"-Button als Menu */}
        <PlusMenu
          onNewDevice={onOpenCreateDialog}
          onNewCategory={() => {
            setShowNewGroup((v) => !v)
            setTimeout(() => newGroupInputRef.current?.focus(), 50)
          }}
          onImportFile={() => void onImportLibraryFile()}
          onOpenFolder={() => void openLibraryFolder()}
          hasFolder={hasDesktopBridge}
        />
        {/* Overflow-Menü für selten genutzte Filter */}
        <LibraryFiltersMenu
          showHidden={showHidden}
          setShowHidden={setShowHidden}
          showEmpty={showEmpty}
          setShowEmpty={setShowEmpty}
          hiddenCount={customLibrary.filter((t) => t.hidden).length}
          sortMode={librarySortMode}
          setSortMode={setLibrarySortMode}
          onToggleAllCats={(allCollapsed) => {
            if (allCollapsed) {
              setCollapsedCats(new Set())
            } else {
              const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
              const allCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
              setCollapsedCats(new Set(allCats))
            }
          }}
          allCollapsed={(() => {
            const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
            const allCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
            return allCats.length > 0 && allCats.every((cat) => collapsedCats.has(cat))
          })()}
          onlyOwned={onlyOwned}
          setOnlyOwned={setOnlyOwned}
          ownedAvailable={ownedModels.size}
        />
      </div>

      {showNewGroup && (
        <form
          className="mb-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            const cat = newGroupName.trim()
            if (cat) {
              addKnownCategories([cat])
              setShowEmpty(true)
              setCollapsedCats((prev) => {
                if (!prev.has(cat)) return prev
                const next = new Set(prev)
                next.delete(cat)
                return next
              })
              setNewGroupName('')
              setShowNewGroup(false)
            }
          }}
        >
          <input
            ref={newGroupInputRef}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('library.newCategoryPlaceholder', 'Kategoriename…')}
            className="flex-1 rounded border border-cp-surface-5 bg-cp-surface-1 p-1.5 text-cp-xs"
          />
          <button
            type="submit"
            className="rounded bg-emerald-700 px-2 text-cp-xs hover:bg-emerald-600"
          >
            {t('common.ok', 'OK')}
          </button>
          <button
            type="button"
            onClick={() => setShowNewGroup(false)}
            className="rounded bg-cp-surface-4 px-2 text-cp-xs hover:bg-cp-surface-5"
            aria-label={t('common.close', 'Schließen')}
          >
            <Icon icon={X} size="sm" />
          </button>
        </form>
      )}

      <div className="flex-1 min-h-0 space-y-1 overflow-auto">
        {(() => {
          const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
          // v7.9.5 — Kategorien-Order respektiert den User-gewaehlten Sort-Modus.
          const baseCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
          const allCats =
            librarySortMode === 'asc'
              ? [...baseCats].sort((a, b) => a.localeCompare(b))
              : librarySortMode === 'desc'
                ? [...baseCats].sort((a, b) => b.localeCompare(a))
                : (() => {
                    const knownSet = new Set(knownCategories)
                    const head = knownCategories.filter((c) => baseCats.includes(c))
                    const tail = baseCats
                      .filter((c) => !knownSet.has(c))
                      .sort((a, b) => a.localeCompare(b))
                    return [...head, ...tail]
                  })()
          if (allCats.length === 0) allCats.push('Sonstiges')
          const searchQuery = librarySearch.trim().toLowerCase()
          // v7.9.5 — Globaler Empty-State wenn Suche projektweit nichts trifft.
          if (searchQuery) {
            const anyMatch = customLibrary.some((t) =>
              t.name.toLowerCase().includes(searchQuery),
            )
            if (!anyMatch) {
              return (
                <div className="mt-4 rounded border border-cp-border-muted bg-cp-surface-3/60 p-4 text-center text-cp-xs text-cp-text-muted">
                  <div className="mb-2 font-semibold text-cp-text-secondary">
                    {t('library.empty.title', 'Keine Geräte gefunden')}
                  </div>
                  <div className="mb-3 text-[11px] text-cp-text-muted">
                    {format(
                      t(
                        'library.empty.body',
                        'Kein Treffer für „{q}". Versuche einen anderen Suchbegriff oder lösche das Suchfeld.',
                      ),
                      { q: librarySearch },
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLibrarySearch('')}
                    className="rounded bg-cp-surface-4 px-3 py-1 text-[11px] text-cp-text hover:bg-cp-surface-5"
                  >
                    {t('library.empty.clearSearch', 'Suche zurücksetzen')}
                  </button>
                </div>
              )
            }
          }
          const sectionsList = allCats.map((cat) => {
            const items = customLibrary.filter(
              (t) => (t.category || 'Sonstiges') === cat,
            )
            const visibleItems = items
              .filter((t) => showHidden || !t.hidden)
              // Lager-Filter: nur Vorlagen, deren Modell im Eigentum steht.
              .filter((t) => !onlyOwned || ownedModels.has(t.name.trim().toLowerCase()))
              .filter((t) =>
                !searchQuery
                  ? true
                  : t.name.toLowerCase().includes(searchQuery) ||
                    (t.category ?? '').toLowerCase().includes(searchQuery),
              )
            if (!showEmpty && visibleItems.length === 0) return null
            // Force-expand categories during a search so matches are
            // visible immediately without manual category clicks.
            const collapsed = !searchQuery && collapsedCats.has(cat)
            return (
              <SortableCategorySection
                key={cat}
                cat={cat}
                manualSort={librarySortMode === 'manual'}
                onDragOverTemplate={(event) => {
                  if (event.dataTransfer.types.includes(MIME_EQUIPMENT)) {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDropTemplate={(event) => {
                  const raw = event.dataTransfer.getData(MIME_EQUIPMENT)
                  if (!raw) return
                  try {
                    const tpl = JSON.parse(raw) as EquipmentTemplate
                    if (tpl.name) { event.preventDefault(); setCustomTemplateCategory(tpl.name, cat) }
                  } catch { /* ignore */ }
                }}
              >
                <div className="group/cat flex items-center gap-1.5 rounded-t bg-cp-surface-1/60 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-cp-text-secondary hover:bg-cp-surface-2/80 hover:text-cp-text">
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedCats((prev) => {
                        const next = new Set(prev)
                        if (collapsed) next.delete(cat)
                        else next.add(cat)
                        return next
                      })
                    }
                    className="flex flex-1 min-w-0 items-center gap-1.5 text-left"
                  >
                    <span className="inline-block w-3 text-center text-cp-text-faint">
                      <Icon icon={collapsed ? ChevronRight : ChevronDown} size="xs" />
                    </span>
                    <span className="flex-1 truncate normal-case tracking-normal">
                      {categoryDisplay(cat, lang, categoryTranslations)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      // #309 — Bilinguale Bearbeitung
                      const existing = categoryTranslations[cat] ?? {}
                      const result = await bilingualCategoryDialog(
                        t('library.renameCategory', 'Kategorie umbenennen'),
                        {
                          de: existing.de ?? (lang === 'de' ? cat : undefined),
                          en: existing.en ?? (lang === 'en' ? cat : undefined),
                        },
                      )
                      if (!result || !result.canonical) return
                      if (result.canonical !== cat) {
                        renameCustomCategory(cat, result.canonical)
                        setCategoryTranslation(result.canonical, { de: result.de, en: result.en })
                      } else {
                        setCategoryTranslation(cat, { de: result.de, en: result.en })
                      }
                    }}
                    className="hidden rounded bg-cp-surface-4/80 px-1.5 py-0.5 text-[10px] font-normal normal-case text-cp-text-bright hover:bg-cp-surface-5 group-hover/cat:block"
                    title={t('library.renameCategory', 'Kategorie umbenennen')}
                    aria-label={t('library.renameCategory', 'Kategorie umbenennen')}
                  >
                    <Icon icon={Pencil} size="xs" />
                  </button>
                  <span className="rounded bg-cp-surface-2 px-1.5 py-0.5 text-[10px] font-normal text-cp-text-muted">
                    {items.length}
                  </span>
                </div>

                {/* Items */}
                {!collapsed && (
                  <div className="space-y-1 px-1 pb-1">
                    {visibleItems.length === 0 ? (
                      <div className="px-1 py-1 text-[11px] italic text-cp-text-muted">
                        {searchQuery
                          ? format(t('library.empty.search', 'Keine Treffer für "{query}"'), { query: librarySearch })
                          : t('library.empty.dragHere', 'Gerät hierher ziehen zum Verschieben')}
                      </div>
                    ) : (
                      visibleItems
                        .slice()
                        .sort((a, b) => {
                          const af = a.favorite ? 0 : 1
                          const bf = b.favorite ? 0 : 1
                          if (af !== bf) return af - bf
                          return a.name.localeCompare(b.name)
                        })
                        .map((item) => (
                        <div key={item.name} className="group/item relative">
                          <LibraryItem
                            item={item}
                            onAdd={() => addEquipment({ ...stampDeviceLibraryRef(item), ...nextPlacementPosition(equipmentCount, equipmentItems) })}
                            onRemove={() => removeCustomTemplate(item.name)}
                            onToggleFavorite={() => toggleTemplateFavorite(item.name)}
                            onToggleHidden={() => toggleTemplateHidden(item.name)}
                            onExport={() => exportTemplateToFile(item)}
                          />
                          {/* Edit button — appears on hover */}
                          <button
                            type="button"
                            onClick={() => setSelectedTemplateName(item.name)}
                            className="absolute right-7 top-1 hidden rounded bg-cp-surface-5 px-1 py-0.5 text-[10px] hover:bg-slate-500 group-hover/item:block"
                            title={t('library.template.editTitle', 'Vorlage bearbeiten (Name, Kategorie)')}
                            aria-label={t('library.template.editTitle', 'Vorlage bearbeiten (Name, Kategorie)')}
                          >
                            <Icon icon={Pencil} size="xs" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </SortableCategorySection>
            )
          }).filter(Boolean) as ReactNode[]
          // v7.9.5 — Manuelle Sortierung: DnD-Wrapper drumherum.
          if (librarySortMode === 'manual') {
            return (
              <CategoryDndWrapper
                cats={allCats}
                onReorder={(newOrder) => reorderCategories(newOrder)}
              >
                {sectionsList}
              </CategoryDndWrapper>
            )
          }
          return sectionsList
        })()}
      </div>
    </>
  )
}
