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
 * v7.9.128 — UI-Lift inspiriert vom open-source VideoHubSim
 * (https://github.com/videojedi/VideoHubSim). Wesentliche
 * Aenderungen gegenueber dem alten Grid:
 *
 * 1. **Index-Spalten/-Zeilen**: links neben den Output-Labels und
 *    ueber den Input-Labels steht jetzt die laufende Port-Nummer
 *    (1-N), was bei grossen Matrizen das Auffinden eines konkreten
 *    Slots dramatisch vereinfacht.
 *
 * 2. **Crosshair-Hover**: beim Mouseover ueber einer Zelle werden
 *    die zugehoerige Output-Zeile UND die Input-Spalte komplett
 *    eingefaerbt (sky-blue Tint) — der User sieht direkt welcher
 *    Input zu welchem Output geroutet wuerde, ohne den Finger
 *    abzaehlen zu muessen. Header werden zusaetzlich hervorgehoben.
 *
 * 3. **Sichtbare Gruppierung alle 8**: subtile vertikale + horizontale
 *    Trennlinien jeden 8. Port (klassische Broadcast-Konvention) —
 *    erleichtert das Schaetzen "ist das jetzt Output 24 oder 25?".
 *
 * 4. **Groessere Klick-Targets bei kleinen Hubs**: 22 px bis 40er,
 *    16 px fuer 40-80er, 12 px fuer 80-200er, 9 px ab 200er. Active-
 *    Crosspoint mit Emerald-Highlight + leichten Schatten — leichter
 *    zu sehen.
 *
 * 5. **Klickbare Indizes** zur Schnell-Navigation: Klick auf eine
 *    Output-Zeilennummer fokussiert die Zeile (scrollt sie in den
 *    Sichtbereich), Klick auf eine Input-Spalten-Nummer analog.
 *    Nuetzlich bei 288×288 wo der scrollende Bereich riesig ist.
 *
 * 6. **List-Mode-Fallback** bleibt — bei extrem grossen Matrizen
 *    (>100k Crosspoints) wuerde der DOM den Browser blockieren.
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
  // v7.9.128 — Drag-to-route: User klickt + zieht ueber Cells, jede
  // ueberfahrene Cell wird geroutet. Diagonal-Drag (Out N -> In N,
  // N+1 -> N+1, ...) ergibt sequenzielles 1:1. Vertikaler Drag
  // (mehrere Outs auf denselben In) ergibt Multicast.
  const [dragging, setDragging] = useState(false)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  // List-Mode bei riesigen Matrizen — DOM wuerde sonst kollabieren.
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

  // Cell-Sizing nach Groesse — kleinere Cells fuer groessere Hubs,
  // damit 288×288 noch passabel scrollt.
  const big = totalInputs <= 40 && totalOutputs <= 40
  const medium = !big && totalInputs <= 80 && totalOutputs <= 80
  const small = !big && !medium && totalInputs <= 200 && totalOutputs <= 200
  const cellPx = big ? 22 : medium ? 16 : small ? 12 : 9
  const fontPx = big ? 11 : medium ? 9 : 8
  const labelMaxRem = big ? '7rem' : medium ? '6rem' : '5rem'
  const indexColPx = big ? 28 : 24
  const labelColPx = big ? 130 : medium ? 110 : 90

  // Stilkonstanten fuer Crosshair-Highlight (Cell-Hover faerbt
  // die gesamte Spalte + Zeile ein).
  const colHighlight = hover?.col
  const rowHighlight = hover?.row

  // groupBreak: true wenn die Linie zwischen index-1 und index eine
  // 8er-Gruppen-Grenze ist (z.B. nach Port 8, 16, 24 ...). Verwendet
  // fuer subtle border-Effects.
  const isGroupBreak = (index: number) => index > 0 && index % 8 === 0

  const focusRow = (oi: number) => {
    const el = rowRefs.current[oi]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // Pre-compute Labels mit Index-Suffix — verwendet als Title-Tooltip
  // an den Cells.
  const inLabelTip = useMemo(
    () => inputLabels.map((l, i) => `In ${i + 1} · ${l}`),
    [inputLabels],
  )
  const outLabelTip = useMemo(
    () => outputLabels.map((l, i) => `Out ${i + 1} · ${l}`),
    [outputLabels],
  )

  const maxHeight = big ? '22rem' : medium ? '24rem' : '28rem'

  return (
    <div
      className="overflow-auto rounded border border-slate-700 bg-slate-950"
      style={{ maxHeight }}
      onMouseLeave={() => setHover(null)}
      onMouseUp={() => setDragging(false)}
    >
      <table className="border-collapse" style={{ fontSize: fontPx }}>
        <thead>
          <tr>
            {/* corner: Out-Label-Col-Header */}
            <th
              className="sticky left-0 top-0 z-30 bg-slate-900 px-2 py-1 text-left text-[10px] font-medium text-slate-400"
              style={{ width: labelColPx, minWidth: labelColPx }}
            >
              Output ↓
            </th>
            {/* index-row-header */}
            <th
              className="sticky top-0 z-20 bg-slate-900 text-center text-[10px] font-mono text-slate-500"
              style={{ width: indexColPx, minWidth: indexColPx }}
              title="Output-Nummer (Klick zum Scrollen)"
            >
              #
            </th>
            {/* Input column index row */}
            {inputLabels.map((_, i) => (
              <th
                key={`idx-${i}`}
                className={`sticky top-0 z-10 bg-slate-900 p-0 font-mono text-slate-500 ${
                  isGroupBreak(i) ? 'border-l border-slate-700' : ''
                } ${colHighlight === i ? 'bg-sky-900/60 text-sky-200' : ''}`}
                style={{ width: cellPx, minWidth: cellPx, textAlign: 'center' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    // Klick auf Index = scroll-into-view fuer die
                    // VERTIKALE Achse koennen wir hier zwar nicht
                    // direkt machen (kein Element pro Spalte), aber
                    // wir setzen einen Hover-Highlight als Visual-Aid.
                    setHover((h) => (h?.col === i ? null : { row: 0, col: i }))
                  }}
                  className="block w-full text-center hover:text-sky-300"
                  style={{ fontSize: fontPx - 1, padding: 0 }}
                >
                  {i + 1}
                </button>
              </th>
            ))}
          </tr>
          <tr>
            {/* corner cell — sticky both axes */}
            <th
              className="sticky left-0 top-[1.5rem] z-30 bg-slate-900 px-2 py-1 text-left text-[10px] font-medium text-slate-400"
              style={{ minWidth: labelColPx }}
            >
              Input →
            </th>
            <th
              className="sticky top-[1.5rem] z-20 bg-slate-900"
              style={{ width: indexColPx, minWidth: indexColPx }}
            />
            {/* Input labels (rotated) */}
            {inputLabels.map((label, i) => (
              <th
                key={`lbl-${i}`}
                className={`sticky top-[1.5rem] z-10 bg-slate-900 p-0 ${
                  isGroupBreak(i) ? 'border-l border-slate-700' : ''
                } ${colHighlight === i ? 'bg-sky-900/60' : ''}`}
                style={{ width: cellPx, minWidth: cellPx }}
              >
                <div
                  className={`overflow-hidden text-center ${
                    colHighlight === i ? 'text-sky-100' : 'text-slate-400'
                  }`}
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    maxHeight: labelMaxRem,
                    padding: '2px 0',
                    fontSize: fontPx,
                  }}
                  title={inLabelTip[i]}
                >
                  {label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {outputLabels.map((outLabel, oi) => {
            const rowOn = rowHighlight === oi
            const routedIdx = routing[oi]
            const groupRowBreak = isGroupBreak(oi)
            return (
              <tr
                key={oi}
                ref={(el) => { rowRefs.current[oi] = el }}
                className={`${rowOn ? 'bg-sky-900/30' : 'hover:bg-slate-800/40'} ${
                  groupRowBreak ? 'border-t border-slate-700' : ''
                }`}
              >
                {/* Output label cell — sticky left */}
                <td
                  className={`sticky left-0 z-10 truncate px-2 py-0.5 text-right ${
                    rowOn
                      ? 'bg-sky-900/60 text-sky-100'
                      : 'bg-slate-950 text-slate-300'
                  }`}
                  style={{ maxWidth: labelColPx, fontSize: fontPx }}
                  title={outLabelTip[oi]}
                >
                  {outLabel}
                </td>
                {/* Output index cell */}
                <td
                  className={`sticky left-[${labelColPx}px] z-10 text-center font-mono ${
                    rowOn ? 'bg-sky-900/60 text-sky-200' : 'bg-slate-900 text-slate-500'
                  }`}
                  style={{
                    left: labelColPx,
                    width: indexColPx,
                    minWidth: indexColPx,
                    fontSize: fontPx - 1,
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
                {/* Crosspoint cells */}
                {inputLabels.map((inLabel, ii) => {
                  const active = routedIdx === ii
                  const inCol = colHighlight === ii
                  const inCross = rowOn || inCol
                  const groupBreak = isGroupBreak(ii)
                  return (
                    <td
                      key={ii}
                      className={`p-0 text-center ${groupBreak ? 'border-l border-slate-700' : ''} ${
                        inCol && !rowOn ? 'bg-sky-900/30' : ''
                      }`}
                      onMouseEnter={() => {
                        setHover({ row: oi, col: ii })
                        // Drag-Mode: jede ueberfahrene Cell routen.
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
                            ? 'mx-auto my-0.5 block rounded-sm bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.55)]'
                            : inCross
                              ? 'mx-auto my-0.5 block rounded-sm bg-sky-500/40 hover:bg-sky-400'
                              : 'mx-auto my-0.5 block rounded-sm bg-slate-700 hover:bg-slate-500'
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
