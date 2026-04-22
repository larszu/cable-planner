interface MenuBarProps {
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onOpenSettings: () => void
  onOpenRentmanImport: () => void
  onExportPdf: () => void
  webMode?: boolean
}

const menuButtonClass = 'rounded bg-slate-800 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700'

export const MenuBar = ({
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onOpenSettings,
  onOpenRentmanImport,
  onExportPdf,
  webMode,
}: MenuBarProps) => {
  return (
    <header className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-slate-200">File</span>
        <button type="button" onClick={onNewProject} className={menuButtonClass}>
          New
        </button>
        <button type="button" onClick={onOpenProject} className={menuButtonClass}>
          Open
        </button>
        <button type="button" onClick={onSaveProject} className={menuButtonClass}>
          Save
        </button>
        <button type="button" onClick={onSaveProjectAs} className={menuButtonClass}>
          Save As
        </button>
        <button
          type="button"
          onClick={onExportPdf}
          className="rounded bg-amber-700 px-2 py-1 text-xs text-slate-100 hover:bg-amber-600"
        >
          Export PDF
        </button>
        {webMode && (
          <span className="ml-2 rounded bg-sky-900 px-2 py-1 text-[10px] uppercase tracking-wide text-sky-200">
            Web Mode
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <button type="button" onClick={onOpenRentmanImport} className={menuButtonClass}>
          Rentman Import
        </button>
        <button type="button" onClick={onOpenSettings} className={menuButtonClass}>
          Settings
        </button>
      </div>
    </header>
  )
}
