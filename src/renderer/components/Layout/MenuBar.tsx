interface MenuBarProps {
  onNewProject: () => void
  onOpenProject: () => void
  onSaveProject: () => void
  onSaveProjectAs: () => void
  onOpenSettings: () => void
  onOpenRentmanImport: () => void
  onExportPdf: () => void
  onEditProjectMeta?: () => void
  onOpenCableBom?: () => void
  videoFormat?: string
  onChangeVideoFormat?: (id: string) => void
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
  onEditProjectMeta,
  onOpenCableBom,
  videoFormat,
  onChangeVideoFormat,
}: MenuBarProps) => {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2">
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
        {onEditProjectMeta && (
          <button
            type="button"
            onClick={onEditProjectMeta}
            className={menuButtonClass}
            title="Projektdaten bearbeiten (Autor, Kunde, Logos...)"
          >
            Projektdaten
          </button>
        )}
        <span className="ml-2 font-semibold text-slate-400">Export</span>
        <button
          type="button"
          onClick={onExportPdf}
          className="rounded bg-amber-700 px-2 py-1 text-xs text-slate-100 hover:bg-amber-600"
        >
          PDF
        </button>
        {onOpenCableBom && (
          <button
            type="button"
            onClick={onOpenCableBom}
            className="rounded bg-teal-700 px-2 py-1 text-xs text-slate-100 hover:bg-teal-600"
            title="Kabelstückliste anzeigen und exportieren"
          >
            Kabel-BOM
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
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
