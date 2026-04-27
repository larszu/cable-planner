interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
  equipmentCount: number
  cableCount: number
  locationCount: number
  rentmanProjectName?: string
}

export const StatusBar = ({
  projectName,
  zoom,
  hasToken,
  equipmentCount,
  cableCount,
  locationCount,
  rentmanProjectName,
}: StatusBarProps) => {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate font-medium text-slate-200">{projectName}</span>
        <span className="text-slate-600">|</span>
        <span>{equipmentCount} Geräte</span>
        <span>{cableCount} Kabel</span>
        <span>{locationCount} Rahmen</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={rentmanProjectName ? 'text-orange-300' : hasToken ? 'text-slate-400' : 'text-slate-500'}>
          Rentman: {rentmanProjectName ?? (hasToken ? 'Token bereit' : 'Standalone')}
        </span>
        <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
      </div>
    </footer>
  )
}
