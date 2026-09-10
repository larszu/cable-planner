import { useEffect, useRef, useState } from 'react'
import { Square, SquareCheck, ChevronDown, ChevronRight, CircleDot, Circle} from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'

/**
 * #305 — Library-Header-Menüs (Plus-Dropdown + Filter-Overflow). Beide
 * sind isolierte Pop-Up-Komponenten mit Klick-Außen-Close-Logik. Aus
 * LibraryPanel ausgelagert.
 */

// v7.9.5 — Plus-Dropdown: ein einziger "+"-Button statt zwei separater
// "+ Kategorie" / "+ Gerät" Knöpfe. Click toggles dropdown, Klick außen
// schließt es. Items: Neues Gerät / Neue Kategorie.
export const PlusMenu = ({
  onNewDevice,
  onNewCategory,
  onImportFile,
  onOpenFolder,
  hasFolder,
}: {
  onNewDevice: () => void
  onNewCategory: () => void
  onImportFile: () => void
  onOpenFolder: () => void
  hasFolder: boolean
}) => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 items-center gap-0.5 rounded bg-emerald-700 px-2 text-cp-xs hover:bg-emerald-600"
        title={t('library.menus.plusTitle', 'Create new device or category')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-cp-base leading-none">+</span>
        <Icon icon={ChevronDown} size={11} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded border border-cp-border bg-cp-surface-1 py-1 text-cp-xs shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNewDevice()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
          >
            {t('library.menus.newDevice', 'New device…')}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNewCategory()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
          >
            {t('library.menus.newCategory', 'New category…')}
          </button>
          <div className="my-1 border-t border-cp-border-muted" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onImportFile()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
            title={t('library.menus.importFileTitle', 'Import .cpdevice or .cpgroup file')}
          >
            {t('library.menus.importFile', 'Import file…')}
          </button>
          {hasFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenFolder()
              }}
              className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
              title={t('library.menus.openFolderTitle', 'Open library folder in file manager')}
            >
              {t('library.menus.openFolder', 'Open library folder…')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// v7.9.5 — Filter-Overflow-Menü. Ersetzt drei unterstrichene Text-Links
// (Alle ein/aus, Versteckte zeigen, Leere zeigen). Drei-Punkt-Icon als
// Trigger, Dropdown mit Checkmark-Toggles.
export const LibraryFiltersMenu = ({
  showHidden,
  setShowHidden,
  showEmpty,
  setShowEmpty,
  hiddenCount,
  allCollapsed,
  onToggleAllCats,
  sortMode,
  setSortMode,
  onlyOwned,
  setOnlyOwned,
  ownedAvailable,
}: {
  showHidden: boolean
  setShowHidden: (v: boolean) => void
  showEmpty: boolean
  setShowEmpty: (v: boolean) => void
  hiddenCount: number
  allCollapsed: boolean
  onToggleAllCats: (allCollapsed: boolean) => void
  sortMode: 'manual' | 'asc' | 'desc'
  setSortMode: (m: 'manual' | 'asc' | 'desc') => void
  /** Lager-Modul: nur Vorlagen zeigen, die eigenem Material entsprechen. */
  onlyOwned: boolean
  setOnlyOwned: (v: boolean) => void
  /** Anzahl eigener Lager-Artikel (ownership=owned) — 0 → Toggle disabled. */
  ownedAvailable: number
}) => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('library.menus.filterTitle', 'Filter and view options')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 items-center justify-center gap-0.5 rounded border border-cp-border bg-cp-surface-1 px-1.5 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text-bright"
      >
        {/* GEAENDERT 2026-09-07: hier standen drei Punkte. Drei Punkte heissen
            „hier ist noch etwas" und sonst nichts — und in einer 235 px
            breiten Zeile neben Suchfeld und Anlegen-Knopf ist fuer ein Wort
            kein Platz. Ein Trichter mit Pfeil sagt wenigstens die Richtung:
            hier wird gefiltert und die Ansicht eingestellt. */}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3h12l-4.5 5.5V13l-3-1.5V8.5L2 3z" strokeLinejoin="round" />
        </svg>
        <Icon icon={ChevronDown} size={9} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[210px] rounded border border-cp-border bg-cp-surface-1 py-1 text-cp-xs shadow-xl"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={!allCollapsed}
            onClick={() => onToggleAllCats(allCollapsed)}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
          >
            <span className="mr-2 inline-block w-4 text-center text-cp-text-muted">
              <Icon icon={allCollapsed ? ChevronRight : ChevronDown} size="xs" />
            </span>
            {allCollapsed
              ? t('library.menus.expandAll', 'Expand all categories')
              : t('library.menus.collapseAll', 'Collapse all categories')}
          </button>
          <div className="my-1 border-t border-cp-border-muted" />
          <div className="px-3 py-1 text-cp-xs uppercase tracking-wider text-cp-text-muted">
            {t('library.menus.sorting', 'Sorting')}
          </div>
          {(
            [
              { value: 'manual' as const, label: t('library.menus.sortManual', 'Manual (drag & drop)') },
              { value: 'asc' as const, label: t('library.menus.sortAsc', 'Alphabetical A → Z') },
              { value: 'desc' as const, label: t('library.menus.sortDesc', 'Alphabetical Z → A') },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={sortMode === opt.value}
              onClick={() => setSortMode(opt.value)}
              className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
            >
              <span className="mr-2 inline-block w-4 text-center">
                <Icon icon={sortMode === opt.value ? CircleDot : Circle} size="xs" />
              </span>
              {opt.label}
            </button>
          ))}
          <div className="my-1 border-t border-cp-border-muted" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showHidden}
            onClick={() => setShowHidden(!showHidden)}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
          >
            <span className="mr-2 inline-flex w-4 justify-center"><Icon icon={showHidden ? SquareCheck : Square} size="xs" /></span>
            {t('library.menus.showHidden', 'Show hidden')}
            {hiddenCount > 0 ? ` (${hiddenCount})` : ''}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showEmpty}
            onClick={() => setShowEmpty(!showEmpty)}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2"
          >
            <span className="mr-2 inline-flex w-4 justify-center"><Icon icon={showEmpty ? SquareCheck : Square} size="xs" /></span>
            {t('library.menus.showEmpty', 'Show empty categories')}
          </button>
          <div className="my-1 border-t border-cp-border-muted" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={onlyOwned}
            disabled={ownedAvailable === 0 && !onlyOwned}
            onClick={() => setOnlyOwned(!onlyOwned)}
            title={t('inventory.onlyOwnedHint', 'Show only equipment that matches owned inventory (by model)')}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mr-2 inline-flex w-4 justify-center"><Icon icon={onlyOwned ? SquareCheck : Square} size="xs" /></span>
            {t('inventory.onlyOwned', 'Only own material')}
            {ownedAvailable > 0 ? ` (${ownedAvailable})` : ''}
          </button>
        </div>
      )}
    </div>
  )
}
