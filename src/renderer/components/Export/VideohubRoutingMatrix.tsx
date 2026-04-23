interface Props {
  totalInputs: number
  totalOutputs: number
  inputLabels: string[]
  outputLabels: string[]
  routing: Record<number, number>
  onRoute: (output: number, input: number) => void
}

/**
 * Interactive routing crosspoint matrix for Blackmagic Videohub.
 * For ≤40×40 routers renders an XY grid (click to route).
 * For larger routers falls back to per-output select dropdowns.
 */
export const VideohubRoutingMatrix = ({
  totalInputs,
  totalOutputs,
  inputLabels,
  outputLabels,
  routing,
  onRoute,
}: Props) => {
  const useGrid = totalInputs <= 40 && totalOutputs <= 40

  if (!useGrid) {
    return (
      <div className="overflow-auto max-h-64 rounded border border-slate-700 bg-slate-950 p-2">
        <div className="space-y-0.5">
          {outputLabels.map((outLabel, oi) => (
            <div key={oi} className="flex items-center gap-2 text-xs">
              <span className="w-32 shrink-0 truncate text-right text-slate-300">{outLabel}</span>
              <span className="text-slate-500">←</span>
              <select
                value={routing[oi] ?? 0}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 rounded border border-slate-700 bg-slate-900 p-0.5 text-xs text-slate-100"
              >
                {inputLabels.map((inLabel, ii) => (
                  <option key={ii} value={ii}>
                    {inLabel}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded border border-slate-700 bg-slate-950" style={{ maxHeight: '16rem' }}>
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            {/* corner cell — sticky both axes */}
            <th className="sticky left-0 top-0 z-20 min-w-[80px] bg-slate-900 p-0" />
            {inputLabels.map((label, i) => (
              <th
                key={i}
                className="sticky top-0 z-10 w-[18px] min-w-[18px] bg-slate-900 p-0"
              >
                <div
                  className="overflow-hidden text-center text-slate-400"
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    maxHeight: '5rem',
                    padding: '2px 0',
                  }}
                  title={label}
                >
                  {label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {outputLabels.map((outLabel, oi) => (
            <tr key={oi} className="hover:bg-slate-800/40">
              <td className="sticky left-0 z-10 max-w-[80px] truncate bg-slate-950 py-0.5 pl-2 pr-2 text-right text-[10px] text-slate-300">
                {outLabel}
              </td>
              {inputLabels.map((inLabel, ii) => {
                const active = (routing[oi] ?? 0) === ii
                return (
                  <td key={ii} className="p-0 text-center">
                    <button
                      type="button"
                      onClick={() => onRoute(oi, ii)}
                      title={`${outLabel} ← ${inLabel}`}
                      className={
                        active
                          ? 'mx-auto my-0.5 block h-[14px] w-[14px] rounded-sm bg-emerald-500'
                          : 'mx-auto my-0.5 block h-[14px] w-[14px] rounded-sm bg-slate-700 hover:bg-slate-500'
                      }
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
