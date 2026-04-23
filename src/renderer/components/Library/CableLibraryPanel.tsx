import { useMemo, useState } from 'react'
import { cableCatalog } from '../../types/cableSpec'
import { useProjectStore } from '../../store/projectStore'
import { videoFormatById, pickCableStandardForFormat } from '../../types/videoFormat'
import type { SignalStandard } from '../../types/cableSpec'

/**
 * Group cables by their primary connector family. SDI cables are highlighted
 * based on the project's current default video format so the best-matching
 * SDI cable is obvious at a glance.
 */
const groupOf = (specId: string, connectorType: string): string => {
  if (specId.startsWith('sdi') || connectorType === 'BNC' || connectorType === 'SDI') return 'SDI'
  if (connectorType === 'HDMI') return 'HDMI'
  if (connectorType === 'DisplayPort') return 'DisplayPort'
  if (connectorType === 'Ethernet/RJ45') return 'Ethernet'
  if (connectorType === 'Fiber') return 'Fiber'
  if (connectorType === 'XLR') return 'Audio / XLR'
  if (connectorType === 'USB') return 'USB'
  if (
    connectorType === 'IEC 230V' ||
    connectorType === 'PowerCON' ||
    connectorType === 'Schuko 230V'
  )
    return 'Power'
  return 'Andere'
}

export const CableLibraryPanel = () => {
  const defaultVideoFormat = useProjectStore(
    (s) => s.project.metadata.defaultVideoFormat,
  )
  const cables = useProjectStore((s) => s.project.cables)
  const rentmanCablePlan = useProjectStore((s) => s.project.metadata.rentmanCablePlan)

  const preferredSdi: SignalStandard | undefined = useMemo(() => {
    const f = videoFormatById(defaultVideoFormat)
    if (!f) return undefined
    return pickCableStandardForFormat(f)
  }, [defaultVideoFormat])

  /** Count canvas cables per cableSpecId */
  const builtBySpecId = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of cables) {
      if (!c.cableSpecId) continue
      map.set(c.cableSpecId, (map.get(c.cableSpecId) ?? 0) + 1)
    }
    return map
  }, [cables])

  /** Sum Rentman planned quantities per specId by matching connector type */
  const plannedBySpecId = useMemo(() => {
    if (!rentmanCablePlan) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const [key, qty] of Object.entries(rentmanCablePlan)) {
      const [type] = key.split('|')
      // Match against specs by connectorType
      for (const spec of cableCatalog) {
        if (spec.connectorType === type || spec.id.startsWith(type.toLowerCase())) {
          map.set(spec.id, (map.get(spec.id) ?? 0) + qty)
        }
      }
    }
    return map
  }, [rentmanCablePlan])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof cableCatalog>()
    for (const cable of cableCatalog) {
      const g = groupOf(cable.id, cable.connectorType)
      const list = map.get(g) ?? []
      list.push(cable)
      map.set(g, list)
    }
    return Array.from(map.entries())
  }, [])

  // Start with all groups collapsed - power users open what they need.
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (g: string) => setOpen((o) => ({ ...o, [g]: !o[g] }))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Kabel-Library</h2>
        <span className="text-[10px] text-slate-500">{cables.length} verbaut</span>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        Presets mit Stecker- und Signalinfos.
        {preferredSdi && (
          <>
            {' '}SDI-Empfehlung: <span className="font-semibold text-emerald-400">{preferredSdi}</span>.
          </>
        )}
      </p>
      <div className="flex-1 min-h-0 space-y-1 overflow-auto">
        {grouped.map(([group, specs]) => {
          const isOpen = open[group] ?? false
          const groupBuilt = specs.reduce((sum, s) => sum + (builtBySpecId.get(s.id) ?? 0), 0)
          const groupPlanned = specs.reduce((sum, s) => sum + (plannedBySpecId.get(s.id) ?? 0), 0)
          return (
            <div key={group} className="rounded border border-slate-700 bg-slate-900">
              <button
                type="button"
                onClick={() => toggle(group)}
                className="flex w-full items-center justify-between px-2 py-1.5 text-left text-xs font-semibold hover:bg-slate-800"
              >
                <span className="flex items-center gap-1.5">
                  {group}
                  <span className="text-[10px] font-normal text-slate-500">({specs.length})</span>
                  {groupBuilt > 0 && (
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      groupPlanned > 0
                        ? groupBuilt >= groupPlanned
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-red-900/60 text-red-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {groupBuilt}{groupPlanned > 0 ? `/${groupPlanned}` : ''}
                    </span>
                  )}
                </span>
                <span className="text-slate-500">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && (
                <div className="space-y-1 border-t border-slate-800 p-1.5">
                  {specs.map((cable) => {
                    const isRecommended =
                      preferredSdi !== undefined &&
                      group === 'SDI' &&
                      cable.standards.includes(preferredSdi) &&
                      cable.standards[cable.standards.length - 1] === preferredSdi
                    const built = builtBySpecId.get(cable.id) ?? 0
                    const planned = plannedBySpecId.get(cable.id) ?? 0
                    const hasCount = built > 0 || planned > 0
                    return (
                      <div
                        key={cable.id}
                        className={`rounded border px-2 py-1.5 text-xs ${
                          isRecommended
                            ? 'border-emerald-500 bg-emerald-950/40'
                            : 'border-slate-700 bg-slate-950'
                        }`}
                        title={cable.notes ?? ''}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: cable.color }}
                          />
                          <span className="font-medium flex-1">{cable.name}</span>
                          {isRecommended && (
                            <span className="rounded bg-emerald-600 px-1 text-[9px] font-semibold uppercase text-white">
                              ✓
                            </span>
                          )}
                          {hasCount && (
                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                              planned > 0
                                ? built >= planned
                                  ? 'bg-emerald-900/60 text-emerald-300'
                                  : 'bg-red-900/60 text-red-300'
                                : 'bg-slate-700/80 text-slate-300'
                            }`}
                              title={planned > 0 ? `${built} verbaut / ${planned} Rentman geplant` : `${built} verbaut`}
                            >
                              {built}{planned > 0 ? `/${planned}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {cable.connectorType}
                          {cable.compatibleConnectors?.length
                            ? ` (+ ${cable.compatibleConnectors.join(', ')})`
                            : ''}
                          {cable.maxLengthMeters ? ` · max ${cable.maxLengthMeters} m` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {cable.standards.join(' · ')}
                        </div>
                        {cable.notes && (
                          <div className="mt-1 rounded bg-slate-900 p-1 text-[10px] italic text-slate-300">
                            {cable.notes}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
