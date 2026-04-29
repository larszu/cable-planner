import { useEffect, useRef, useState } from 'react'
import { SharedSyncPanel } from '../Sync/SharedSyncPanel'

interface MenuBarProps {
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onOpenSettings: () => void
  onExportPdf: () => void
  onEditProjectMeta?: () => void
  onOpenCableBom?: () => void
  /** Attach the current plan as a PDF to the linked Rentman project. */
  onAttachPdfToRentman?: () => void
  /** Open the Rentman cable export dialog. */
  onOpenRentmanCableExport?: () => void
  /** Whether a Rentman project is currently linked (controls Rentman menu items). */
  hasRentmanLink?: boolean
  /** Open the onboarding tour (also reachable from a help icon). */
  onOpenTour?: () => void
  videoFormat?: string
  onChangeVideoFormat?: (id: string) => void
  projectName?: string
  rentmanProjectName?: string
  hasToken?: boolean
}

/**
 * Top application menu bar.
 *
 * Replaces the previous flat row of mini-buttons (Neu / Öffnen / Speichern /
 * Speichern unter / Projektdaten / PDF / Kabel-BOM / …) with two compact
 * dropdown menus ("Datei ▾", "Export ▾") plus inline project name + format
 * + a settings icon. This matches how desktop apps usually expose these
 * actions and gives plenty of room for new entries without crowding the bar.
 */
export const MenuBar = ({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onOpenSettings,
  onExportPdf,
  onEditProjectMeta,
  onOpenCableBom,
  onAttachPdfToRentman,
  onOpenRentmanCableExport,
  hasRentmanLink = false,
  onOpenTour,
  videoFormat,
  onChangeVideoFormat,
  projectName,
  rentmanProjectName,
  hasToken = false,
}: MenuBarProps) => {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-3 py-1.5 text-xs shadow-sm">
      <div className="flex items-center gap-2">
        <span className="select-none font-semibold tracking-wide text-slate-300">
          Cable Planner
        </span>
        <span className="text-slate-700">│</span>

        <Menu label="Datei">
          <MenuItem onClick={onNewProject} icon="📄" shortcut="Strg+N">
            Neues Projekt
          </MenuItem>
          <MenuItem onClick={onOpenProject} icon="📂" shortcut="Strg+O">
            Öffnen…
          </MenuItem>
          <MenuSep />
          <MenuItem onClick={onSaveProject} icon="💾" shortcut="Strg+S">
            Speichern
          </MenuItem>
          <MenuItem onClick={onSaveProjectAs} icon="💾" shortcut="Strg+Umsch+S">
            Speichern unter…
          </MenuItem>
        </Menu>

        <Menu label="Export">
          <MenuItem onClick={onExportPdf} icon="📑">
            Plan als PDF…
          </MenuItem>
          {onOpenCableBom && (
            <MenuItem onClick={onOpenCableBom} icon="🧮">
              Kabel-Stückliste (BOM)…
            </MenuItem>
          )}
          {(onAttachPdfToRentman || onOpenRentmanCableExport) && <MenuSep />}
          {onAttachPdfToRentman && (
            <MenuItem
              onClick={hasRentmanLink ? onAttachPdfToRentman : undefined}
              icon="📎"
            >
              {hasRentmanLink
                ? 'Plan an Rentman anhängen…'
                : 'Plan an Rentman anhängen (kein Projekt verknüpft)'}
            </MenuItem>
          )}
          {onOpenRentmanCableExport && (
            <MenuItem
              onClick={hasRentmanLink ? onOpenRentmanCableExport : undefined}
              icon="🔌"
            >
              {hasRentmanLink
                ? 'Kabel an Rentman senden…'
                : 'Kabel an Rentman senden (kein Projekt verknüpft)'}
            </MenuItem>
          )}
        </Menu>

        {onOpenTour && (
          <Menu label="Hilfe">
            <MenuItem onClick={onOpenTour} icon="💡">
              Erste-Schritte-Tour…
            </MenuItem>
          </Menu>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        {projectName && (
          <button
            type="button"
            onClick={onEditProjectMeta}
            disabled={!onEditProjectMeta}
            className="group flex max-w-[42ch] items-center gap-1 truncate rounded px-2 py-0.5 text-slate-200 hover:bg-slate-800 hover:text-white disabled:cursor-default disabled:hover:bg-transparent"
            title={onEditProjectMeta ? 'Projektdaten bearbeiten' : projectName}
          >
            <span className="truncate font-medium">{projectName}</span>
            {onEditProjectMeta && (
              <span className="text-[10px] text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                ✎
              </span>
            )}
          </button>
        )}

      </div>

      <div className="flex items-center gap-2">
        <SharedSyncPanel />
        {onChangeVideoFormat && (
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <span>Format:</span>
            <select
              value={videoFormat ?? '1080p50'}
              onChange={(event) => onChangeVideoFormat(event.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-slate-100"
              title="Projekt-Standard-Videoformat (SDI)"
            >
              <option value="1080i50">1080i50</option>
              <option value="1080p25">1080p25</option>
              <option value="1080p50">1080p50 (3G)</option>
              <option value="1080p60">1080p60 (3G)</option>
              <option value="2160p25">2160p25 (6G)</option>
              <option value="2160p30">2160p30 (6G)</option>
              <option value="2160p50">2160p50 (12G)</option>
              <option value="2160p60">2160p60 (12G)</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded bg-slate-800 px-2 py-1 text-slate-100 hover:bg-slate-700"
          title="Einstellungen"
        >
          ⚙ Einstellungen
        </button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*                            Tiny dropdown menu                              */
/* -------------------------------------------------------------------------- */

interface MenuProps {
  label: string
  children: React.ReactNode
}

const Menu = ({ label, children }: MenuProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded px-2 py-1 text-slate-200 hover:bg-slate-800 ${open ? 'bg-slate-800' : ''}`}
      >
        {label}
        <span className="ml-1 text-[9px] text-slate-500">▾</span>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] rounded border border-slate-700 bg-slate-900 py-1 shadow-2xl"
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}

interface MenuItemProps {
  onClick?: () => void
  icon?: string
  shortcut?: string
  children: React.ReactNode
}

const MenuItem = ({ onClick, icon, shortcut, children }: MenuItemProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700/70"
      role="menuitem"
    >
      <span className="w-4 shrink-0 text-center text-[12px]">{icon ?? ''}</span>
      <span className="flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="ml-3 shrink-0 text-[10px] tracking-wide text-slate-500">
          {shortcut}
        </span>
      )}
    </button>
  )
}

const MenuSep = () => <div className="my-1 border-t border-slate-700" />
