interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
  equipmentCount: number
  cableCount: number
  locationCount: number
  packedCount?: number
  rentmanProjectName?: string
}

/** H2R-style coarse complexity badge so users get a feel for project
 *  size at a glance. Thresholds are heuristic; the badge is purely
 *  informational. */
const complexityFor = (
  devices: number,
  cables: number,
): { label: string; tone: string } => {
  const score = devices + cables
  if (score >= 200) return { label: 'XL', tone: 'bg-purple-700 text-purple-100' }
  if (score >= 80) return { label: 'Groß', tone: 'bg-amber-600 text-amber-50' }
  if (score >= 30) return { label: 'Mittel', tone: 'bg-sky-700 text-sky-50' }
  if (score >= 8) return { label: 'Klein', tone: 'bg-emerald-700 text-emerald-50' }
  return { label: 'Neu', tone: 'bg-slate-700 text-slate-200' }
}

export const StatusBar = ({
  projectName,
  zoom,
  hasToken,
  equipmentCount,
  cableCount,
  locationCount,
  packedCount,
  rentmanProjectName,
}: StatusBarProps) => {
  const complexity = complexityFor(equipmentCount, cableCount)
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate font-medium text-slate-200">{projectName}</span>
        <span className="text-slate-600">|</span>
        <span>{equipmentCount} Geräte</span>
        <span>{cableCount} Kabel</span>
        <span>{locationCount} Rahmen</span>
        {packedCount !== undefined && equipmentCount > 0 && (
          <span
            className={
              packedCount === equipmentCount
                ? 'text-emerald-300'
                : packedCount > 0
                  ? 'text-amber-300'
                  : 'text-slate-500'
            }
            title="Geräte, die in den Eigenschaften als 'gepackt' markiert sind"
          >
            ✓ {packedCount}/{equipmentCount} gepackt
          </span>
        )}
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${complexity.tone}`}
          title="Komplexität: heuristisch aus (Geräte + Kabel)-Anzahl. Hilft beim Einschätzen von Übersichtlichkeit + Performance."
        >
          {complexity.label}
        </span>
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
