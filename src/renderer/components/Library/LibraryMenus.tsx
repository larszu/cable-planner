import { useEffect, useRef, useState } from 'react'

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
        className="flex h-7 items-center gap-0.5 rounded bg-emerald-700 px-2 text-xs hover:bg-emerald-600"
        title="Neues Gerät oder neue Kategorie anlegen"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">+</span>
        <span className="text-[9px] leading-none">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded border border-slate-700 bg-slate-900 py-1 text-xs shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNewDevice()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
          >
            Neues Gerät…
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onNewCategory()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
          >
            Neue Kategorie…
          </button>
          <div className="my-1 border-t border-slate-800" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onImportFile()
            }}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
            title=".cpdevice oder .cpgroup-Datei importieren"
          >
            Datei importieren…
          </button>
          {hasFolder && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onOpenFolder()
              }}
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
              title="Library-Ordner im Datei-Manager öffnen"
            >
              Bibliotheks-Ordner öffnen…
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
}) => {
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
        title="Filter und Ansichtsoptionen"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
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
          className="absolute right-0 top-full z-10 mt-1 min-w-[210px] rounded border border-slate-700 bg-slate-900 py-1 text-xs shadow-xl"
        >
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={!allCollapsed}
            onClick={() => onToggleAllCats(allCollapsed)}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
          >
            <span className="mr-2 inline-block w-4 text-center text-slate-400">
              {allCollapsed ? '▸' : '▾'}
            </span>
            {allCollapsed ? 'Alle Kategorien ausklappen' : 'Alle Kategorien einklappen'}
          </button>
          <div className="my-1 border-t border-slate-800" />
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500">
            Sortierung
          </div>
          {(
            [
              { value: 'manual' as const, label: 'Manuell (Drag&Drop)' },
              { value: 'asc' as const, label: 'Alphabetisch A → Z' },
              { value: 'desc' as const, label: 'Alphabetisch Z → A' },
            ]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={sortMode === opt.value}
              onClick={() => setSortMode(opt.value)}
              className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
            >
              <span className="mr-2 inline-block w-4 text-center">
                {sortMode === opt.value ? '●' : '○'}
              </span>
              {opt.label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-800" />
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showHidden}
            onClick={() => setShowHidden(!showHidden)}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
          >
            <span className="mr-2 inline-block w-4 text-center">
              {showHidden ? '☑' : '☐'}
            </span>
            Versteckte zeigen{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={showEmpty}
            onClick={() => setShowEmpty(!showEmpty)}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-800"
          >
            <span className="mr-2 inline-block w-4 text-center">
              {showEmpty ? '☑' : '☐'}
            </span>
            Leere Kategorien zeigen
          </button>
        </div>
      )}
    </div>
  )
}
