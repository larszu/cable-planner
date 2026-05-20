import { useMemo, useRef, useState } from 'react'

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
 * v7.9.128 — UI im Stil von VideoHubSim
 * (https://github.com/videojedi/VideoHubSim) — explizite Trennung von
 * Index-Spalte vs. Label-Spalte, klare Grid-Linien, broadcast-typische
 * 8er-Gruppierung, dezent abwechselnde Group-Backgrounds, grosse
 * Klick-Targets bei kleinen Hubs.
 *
 *   ┌─ Outputs ───────────────────────────────────────────────┐
 *   │  #   Label                ║  In  1  2  3  4  ┃  5  6  7  8 │
 *   │  ─── ──────────────────── ╫  ───────────────────────────── │
 *   │  1   Resolume IN 1        ║       ●                       │
 *   │  2   Resolume IN 2        ║          ●                    │
 *   │  …                                                        │
 *   └───────────────────────────────────────────────────────────┘
 *
 * Drei Visualisierungs-Hilfen:
 *  1) **Crosshair-Hover**: gesamte Zeile + Spalte werden eingefaerbt.
 *  2) **Drag-to-Route**: Klick + Ziehen ueber Cells routet jede.
 *  3) **Group-Stripes**: alle 8 Slots wechselt der Background-Tint,
 *     plus 1-px Trennlinie — typisch Broadcast-Layout, schnell
 *     "Out 24 oder 25?" auf einen Blick.
 *
 *  Cell-Sizing dynamisch je Hub-Groesse — 28 px bis 20er, 20 px bis
 *  40er, 14 px bis 80er, 10 px bis 200er, 7 px ab 200er.
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

  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  if (!useGrid) {
    return (
      <div className="overflow-auto max-h-64 rounded border border-slate-700 bg-slate-950 p-2">
        <div className="mb-2 text-[10px] text-amber-300">
          {totalInputs}×{totalOutputs} ({cellCount.toLocaleString()} Crosspoints) —
          Listen-Modus, da die Crosspoint-Matrix bei dieser Groesse das
          Browser-Rendering ueberlastet.
        </div>
        <div className="space-y-0.5">
          {outputLabels.map((outLabel, oi) => (
            <div key={oi} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 font-mono text-right text-slate-500">{oi + 1}</span>
              <span className="w-32 shrink-0 truncate text-right text-slate-300">{outLabel}</span>
              <span className="text-slate-500">←</span>
              <select
                value={routing[oi] ?? 0}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 rounded border border-slate-700 bg-slate-900 p-0.5 text-xs text-slate-100"
              >
                {inputLabels.map((inLabel, ii) => (
                  <option key={ii} value={ii}>
                    {ii + 1}. {inLabel}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Dynamische Cell-Groesse + Schrift.
  const tier =
    totalInputs <= 20 && totalOutputs <= 20
      ? 'xl'
      : totalInputs <= 40 && totalOutputs <= 40
        ? 'lg'
        : totalInputs <= 80 && totalOutputs <= 80
          ? 'md'
          : totalInputs <= 200 && totalOutputs <= 200
            ? 'sm'
            : 'xs'

  const cellPx = tier === 'xl' ? 28 : tier === 'lg' ? 20 : tier === 'md' ? 14 : tier === 'sm' ? 10 : 7
  const fontPx = tier === 'xl' ? 12 : tier === 'lg' ? 10 : tier === 'md' ? 9 : tier === 'sm' ? 8 : 7
  const labelColPx = tier === 'xl' ? 200 : tier === 'lg' ? 160 : tier === 'md' ? 130 : 100
  const indexColPx = tier === 'xl' ? 36 : tier === 'lg' ? 30 : 24
  const labelRowHeightRem = tier === 'xl' ? '9rem' : tier === 'lg' ? '8rem' : tier === 'md' ? '7rem' : '6rem'

  const colHighlight = hover?.col
  const rowHighlight = hover?.row

  // Alternierender Group-Stripe (8er) — wirkt subtil und macht das
  // Zaehlen im 40x40 viel einfacher.
  const isGroupStripe = (index: number) => Math.floor(index / 8) % 2 === 1
  const isGroupBreak = (index: number) => index > 0 && index % 8 === 0

  const focusRow = (oi: number) => {
    const el = rowRefs.current[oi]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const inLabelTip = useMemo(
    () => inputLabels.map((l, i) => `In ${i + 1} · ${l}`),
    [inputLabels],
  )
  const outLabelTip = useMemo(
    () => outputLabels.map((l, i) => `Out ${i + 1} · ${l}`),
    [outputLabels],
  )

  const maxHeight = tier === 'xl' || tier === 'lg' ? '28rem' : '32rem'

  return (
    <div
      className="overflow-auto rounded-md border border-slate-700 bg-slate-950"
      style={{ maxHeight }}
      onMouseLeave={() => setHover(null)}
      onMouseUp={() => setDragging(false)}
    >
      <table
        className="border-collapse"
        style={{ fontSize: fontPx, minWidth: '100%' }}
      >
        <thead>
          {/* Reihe 1: "Inputs ↓" + Output-Label-Spalte + Index + Input-Labels horizontal */}
          <tr>
            <th
              className="sticky left-0 top-0 z-30 border-b border-r border-slate-700 bg-slate-900 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              style={{ width: labelColPx, minWidth: labelColPx }}
            >
              Outputs ↓
            </th>
            <th
              className="sticky top-0 z-20 border-b border-r border-slate-700 bg-slate-900 text-center text-[10px] font-mono text-slate-500"
              style={{ width: indexColPx, minWidth: indexColPx }}
              title="Output-Nummer"
            >
              #
            </th>
            <th
              className="sticky top-0 z-20 border-b border-slate-700 bg-slate-800/80 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-300"
              colSpan={totalInputs}
              style={{
                position: 'sticky',
                top: 0,
                left: 0,
              }}
            >
              Inputs →
            </th>
          </tr>

          {/* Reihe 2: Input-Labels (rotiert) */}
          <tr>
            <th
              className="sticky left-0 top-[2.5rem] z-30 border-r border-slate-700 bg-slate-900"
              style={{ width: labelColPx, minWidth: labelColPx }}
            />
            <th
              className="sticky left-[var(--label-w)] top-[2.5rem] z-20 border-r border-slate-700 bg-slate-900"
              style={{ width: indexColPx, minWidth: indexColPx }}
            />
            {inputLabels.map((label, i) => (
              <th
                key={`lbl-${i}`}
                className={`sticky top-[2.5rem] z-10 p-0 ${
                  isGroupStripe(i) ? 'bg-slate-900/80' : 'bg-slate-900'
                } ${isGroupBreak(i) ? 'border-l border-slate-700' : ''} ${
                  colHighlight === i ? 'bg-sky-900/70' : ''
                }`}
                style={{ width: cellPx, minWidth: cellPx, height: labelRowHeightRem }}
              >
                <div
                  className={`overflow-hidden text-center ${
                    colHighlight === i ? 'text-sky-100' : 'text-slate-300'
                  }`}
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    height: '100%',
                    padding: '4px 0',
                    fontSize: fontPx + 1,
                    fontWeight: 500,
                  }}
                  title={inLabelTip[i]}
                >
                  {label}
                </div>
              </th>
            ))}
          </tr>

          {/* Reihe 3: Input-Index-Nummern */}
          <tr>
            <th
              className="sticky left-0 top-[calc(2.5rem+var(--lbl-h))] z-30 border-b border-r border-slate-700 bg-slate-900 px-3 py-1 text-left text-[10px] uppercase text-slate-500"
              style={{ width: labelColPx, minWidth: labelColPx, top: `calc(2.5rem + ${labelRowHeightRem})` }}
            >
              Label
            </th>
            <th
              className="sticky z-20 border-b border-r border-slate-700 bg-slate-900 text-center text-[10px] font-mono text-slate-500"
              style={{
                left: labelColPx,
                top: `calc(2.5rem + ${labelRowHeightRem})`,
                width: indexColPx,
                minWidth: indexColPx,
              }}
            >
              #
            </th>
            {inputLabels.map((_, i) => (
              <th
                key={`idx-${i}`}
                className={`sticky z-10 border-b border-slate-700 font-mono text-slate-500 ${
                  isGroupStripe(i) ? 'bg-slate-900/80' : 'bg-slate-900'
                } ${isGroupBreak(i) ? 'border-l border-slate-700' : ''} ${
                  colHighlight === i ? 'bg-sky-900/70 text-sky-200' : ''
                }`}
                style={{
                  top: `calc(2.5rem + ${labelRowHeightRem})`,
                  width: cellPx,
                  minWidth: cellPx,
                  textAlign: 'center',
                  fontSize: fontPx,
                }}
              >
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {outputLabels.map((outLabel, oi) => {
            const rowOn = rowHighlight === oi
            const rowStripe = isGroupStripe(oi)
            const routedIdx = routing[oi]
            const groupRowBreak = isGroupBreak(oi)
            return (
              <tr
                key={oi}
                ref={(el) => { rowRefs.current[oi] = el }}
                className={`${
                  rowOn
                    ? 'bg-sky-900/40'
                    : rowStripe
                      ? 'bg-slate-900/60 hover:bg-slate-800/60'
                      : 'hover:bg-slate-800/40'
                } ${groupRowBreak ? 'border-t border-slate-700' : ''}`}
              >
                <td
                  className={`sticky left-0 z-10 truncate border-r border-slate-800 px-3 py-1 text-left ${
                    rowOn
                      ? 'bg-sky-900/70 text-sky-100'
                      : rowStripe
                        ? 'bg-slate-900/90 text-slate-200'
                        : 'bg-slate-950 text-slate-200'
                  }`}
                  style={{
                    maxWidth: labelColPx,
                    minWidth: labelColPx,
                    fontSize: fontPx + 1,
                    fontWeight: 500,
                  }}
                  title={outLabelTip[oi]}
                >
                  {outLabel}
                </td>
                <td
                  className={`sticky z-10 border-r border-slate-800 text-center font-mono ${
                    rowOn
                      ? 'bg-sky-900/70 text-sky-200'
                      : rowStripe
                        ? 'bg-slate-900/95 text-slate-400'
                        : 'bg-slate-900 text-slate-500'
                  }`}
                  style={{
                    left: labelColPx,
                    width: indexColPx,
                    minWidth: indexColPx,
                    fontSize: fontPx,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => focusRow(oi)}
                    className="block w-full hover:text-sky-300"
                    title={`Output ${oi + 1} fokussieren`}
                  >
                    {oi + 1}
                  </button>
                </td>
                {inputLabels.map((inLabel, ii) => {
                  const active = routedIdx === ii
                  const inCol = colHighlight === ii
                  const colStripe = isGroupStripe(ii)
                  const inCross = rowOn || inCol
                  const groupBreak = isGroupBreak(ii)
                  // Hintergrund-Tint per Group-Stripe; overrides bei Hover.
                  const tdBg = inCross
                    ? inCol && !rowOn
                      ? 'bg-sky-900/40'
                      : ''
                    : colStripe
                      ? 'bg-slate-900/40'
                      : ''
                  return (
                    <td
                      key={ii}
                      className={`p-0 text-center ${groupBreak ? 'border-l border-slate-800' : ''} ${tdBg}`}
                      onMouseEnter={() => {
                        setHover({ row: oi, col: ii })
                        if (dragging) onRoute(oi, ii)
                      }}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setDragging(true)
                          onRoute(oi, ii)
                        }}
                        title={`${outLabelTip[oi]} ← ${inLabelTip[ii]} (klick + ziehen fuer 1:1-Routing)`}
                        aria-label={`Set Output ${oi + 1} (${outLabel}) to Input ${ii + 1} (${inLabel})`}
                        className={
                          active
                            ? 'mx-auto my-0.5 block rounded-sm bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.7)] ring-1 ring-emerald-300/50'
                            : inCross
                              ? 'mx-auto my-0.5 block rounded-sm bg-sky-500/50 hover:bg-sky-400'
                              : 'mx-auto my-0.5 block rounded-sm bg-slate-700/80 hover:bg-slate-500'
                        }
                        style={{ width: cellPx - 4, height: cellPx - 4 }}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
