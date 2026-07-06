import { useEffect, useRef, useState } from 'react'
import { Square, SquareCheck } from 'lucide-react'
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
        title={t('library.menus.plusTitle', 'Neues Gerät oder neue Kategorie anlegen')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-cp-base leading-none">+</span>
        <span className="text-[11px] leading-none">▾</span>
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
            {t('library.menus.newDevice', 'Neues Gerät…')}
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
            {t('library.menus.newCategory', 'Neue Kategorie…')}
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
            title={t('library.menus.importFileTitle', '.cpdevice oder .cpgroup-Datei importieren')}
          >
            {t('library.menus.importFile', 'Datei importieren…')}
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
              title={t('library.menus.openFolderTitle', 'Library-Ordner im Datei-Manager öffnen')}
            >
              {t('library.menus.openFolder', 'Bibliotheks-Ordner öffnen…')}
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
        title={t('library.menus.filterTitle', 'Filter und Ansichtsoptionen')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded border border-cp-border bg-cp-surface-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text-bright"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
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
              {allCollapsed ? '▸' : '▾'}
            </span>
            {allCollapsed
              ? t('library.menus.expandAll', 'Alle Kategorien ausklappen')
              : t('library.menus.collapseAll', 'Alle Kategorien einklappen')}
          </button>
          <div className="my-1 border-t border-cp-border-muted" />
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-cp-text-muted">
            {t('library.menus.sorting', 'Sortierung')}
          </div>
          {(
            [
              { value: 'manual' as const, label: t('library.menus.sortManual', 'Manuell (Drag&Drop)') },
              { value: 'asc' as const, label: t('library.menus.sortAsc', 'Alphabetisch A → Z') },
              { value: 'desc' as const, label: t('library.menus.sortDesc', 'Alphabetisch Z → A') },
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
                {sortMode === opt.value ? '●' : '○'}
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
            {t('library.menus.showHidden', 'Versteckte zeigen')}
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
            {t('library.menus.showEmpty', 'Leere Kategorien zeigen')}
          </button>
          <div className="my-1 border-t border-cp-border-muted" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={onlyOwned}
            disabled={ownedAvailable === 0 && !onlyOwned}
            onClick={() => setOnlyOwned(!onlyOwned)}
            title={t('inventory.onlyOwnedHint', 'Nur Geräte zeigen, die eigenem Lager-Material entsprechen (nach Modell)')}
            className="block w-full px-3 py-1.5 text-left hover:bg-cp-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="mr-2 inline-flex w-4 justify-center"><Icon icon={onlyOwned ? SquareCheck : Square} size="xs" /></span>
            {t('inventory.onlyOwned', 'Nur eigenes Material')}
            {ownedAvailable > 0 ? ` (${ownedAvailable})` : ''}
          </button>
        </div>
      )}
    </div>
  )
}
