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
 *
 * Renders the same grid for every preset (12×12, 20×20, 40×40, 72×72,
 * 288×288). Earlier versions fell back to a per-output dropdown for
 * >40 in/out, which the user reported as "schlechte" because it
 * looked different from the smaller routers. The fall-back is now
 * gated only on extreme sizes (>320×320 = ~100k cells) where the
 * browser would refuse to scroll smoothly. For 72 and 288 the grid
 * scrolls horizontally inside an `overflow-auto` container.
 */
export const VideohubRoutingMatrix = ({
  totalInputs,
  totalOutputs,
  inputLabels,
  outputLabels,
  routing,
  onRoute,
}: Props) => {
  const cellCount = totalInputs * totalOutputs
  const useGrid = cellCount <= 100_000

  if (!useGrid) {
    return (
      <div className="overflow-auto max-h-64 rounded border border-slate-700 bg-slate-950 p-2">
        <div className="mb-2 text-[10px] text-amber-300">
          {totalInputs}×{totalOutputs} ({cellCount.toLocaleString()} Crosspoints) — Listen-
          Modus, da die Crosspoint-Matrix bei dieser Größe das Browser-Rendering
          überlastet.
        </div>
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

  // Cell size shrinks as the router grows so 72×72 fits in a 1024 wrap and
  // 288×288 stays under the 100k-cell threshold without becoming unscrollable.
  // 40-and-below routers keep the original 14 px squares.
  const dense = totalInputs > 80 || totalOutputs > 80
  const cell = dense ? 10 : totalInputs > 40 || totalOutputs > 40 ? 12 : 14
  const cellClass = dense ? 'h-[10px] w-[10px]' : totalInputs > 40 || totalOutputs > 40 ? 'h-[12px] w-[12px]' : 'h-[14px] w-[14px]'
  // 16rem max-height is fine for ≤40; bump for larger routers so users
  // see more rows at once. ≈ 18 rows of 10 px = 180 px = 11 rem.
  const maxHeight = dense ? '24rem' : totalInputs > 40 ? '20rem' : '16rem'

  return (
    <div
      className="overflow-auto rounded border border-slate-700 bg-slate-950"
      style={{ maxHeight }}
    >
      <table className="border-collapse text-[10px]">
        <thead>
          <tr>
            {/* corner cell — sticky both axes */}
            <th className="sticky left-0 top-0 z-20 min-w-[80px] bg-slate-900 p-0" />
            {inputLabels.map((label, i) => (
              <th
                key={i}
                className="sticky top-0 z-10 bg-slate-900 p-0"
                style={{ width: cell, minWidth: cell }}
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
                          ? `mx-auto my-0.5 block ${cellClass} rounded-sm bg-emerald-500`
                          : `mx-auto my-0.5 block ${cellClass} rounded-sm bg-slate-700 hover:bg-slate-500`
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
