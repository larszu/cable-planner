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
 * v7.9.129 — Lesbarkeit-Fokus. User-Pain: "die input und output namen
 * kann ich nicht richtig lesen". Maßnahmen:
 *
 * 1) **Deutlich groessere Schrift** — Input-Header bei 14px (statt 11),
 *    Output-Labels bei 14px (statt 12), Index bei 12px.
 * 2) **Mehr vertikaler Raum** fuer rotierte Input-Labels (8-12rem
 *    Hoehe) — bis zu ~16 Zeichen pro Label gut lesbar bevor truncated.
 * 3) **Breitere Cells** fuer kleine/mittlere Hubs — 32px statt 28
 *    bei <=20er, damit auch der Active-Crosspoint groesseren Touch-
 *    Target hat.
 * 4) **VideoHubSim-Farbsprache** (Inspiration von
 *    github.com/videojedi/VideoHubSim):
 *    - Outputs in CORAL/ROT (#fca5a5) — visuell von Inputs getrennt
 *    - Inputs in EMERALD/GRUEN (#86efac) — folgt dem aktiven Signal
 *    - Active-Crosspoint: gleiches Emerald wie Inputs, mit Glow
 *    - Row-Hover (Output): coral-tint
 *    - Col-Hover (Input): emerald-tint
 *    Damit ist die Lese-Richtung "Output (rot) <- Input (gruen)"
 *    farblich kodiert und sofort intuitiv.
 *
 * Drag-to-Route + Crosshair + Group-Stripes alle 8 unveraendert.
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
            <div key={oi} className="flex items-center gap-2 text-sm">
              <span className="w-10 shrink-0 font-mono text-right text-slate-500">{oi + 1}</span>
              <span className="w-40 shrink-0 truncate text-right font-medium text-red-300">
                {outLabel}
              </span>
              <span className="text-slate-500">←</span>
              <select
                value={routing[oi] ?? 0}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 rounded border border-slate-700 bg-slate-900 p-1 text-sm text-emerald-200"
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

  // Dynamische Cell-Groesse. Bei kleinen Hubs DEUTLICH groesser fuer
  // Lesbarkeit. Schrift bleibt fix relativ gross — wir akzeptieren
  // hoehere Header-Reihen damit die rotierten Labels lesbar sind.
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

  const cellPx = tier === 'xl' ? 32 : tier === 'lg' ? 24 : tier === 'md' ? 16 : tier === 'sm' ? 11 : 8
  // Schrift-Groessen bewusst hoch — Lesbarkeit ist das User-Issue.
  const labelFontPx = tier === 'xl' ? 14 : tier === 'lg' ? 13 : tier === 'md' ? 11 : tier === 'sm' ? 9 : 8
  const indexFontPx = Math.max(labelFontPx - 1, 8)
  const labelColPx = tier === 'xl' ? 220 : tier === 'lg' ? 180 : tier === 'md' ? 140 : 110
  const indexColPx = tier === 'xl' ? 40 : tier === 'lg' ? 34 : 26
  // Hoehe der Input-Header-Row in rem — viel Platz fuer rotierte
  // Labels. Vorher 7rem, jetzt 11rem bei XL damit ~16-Zeichen-Labels
  // ohne Truncation Platz haben.
  const labelRowHeightRem =
    tier === 'xl' ? '11rem' : tier === 'lg' ? '10rem' : tier === 'md' ? '8rem' : '6rem'

  const colHighlight = hover?.col
  const rowHighlight = hover?.row

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

  const maxHeight = tier === 'xl' || tier === 'lg' ? '34rem' : '38rem'

  return (
    <div
      className="overflow-auto rounded-md border border-slate-700 bg-slate-950"
      style={{ maxHeight }}
      onMouseLeave={() => setHover(null)}
      onMouseUp={() => setDragging(false)}
    >
      <table className="border-collapse" style={{ minWidth: '100%' }}>
        <thead>
          {/* Reihe 1: Achsen-Beschriftungen ("Outputs ↓" + "Inputs →") */}
          <tr>
            <th
              className="sticky left-0 top-0 z-30 border-b border-r border-slate-700 bg-slate-900 px-3 py-2 text-left uppercase tracking-wide text-slate-400"
              style={{ width: labelColPx, minWidth: labelColPx, fontSize: 12, fontWeight: 600 }}
            >
              Outputs ↓
            </th>
            <th
              className="sticky top-0 z-20 border-b border-r border-slate-700 bg-slate-900 text-center font-mono text-slate-500"
              style={{ width: indexColPx, minWidth: indexColPx, fontSize: 11 }}
              title="Output-Nummer"
            >
              #
            </th>
            <th
              className="sticky top-0 z-20 border-b border-slate-700 bg-slate-800/80 px-3 py-2 text-left uppercase tracking-wide text-emerald-300"
              colSpan={totalInputs}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Inputs →
            </th>
          </tr>

          {/* Reihe 2: Input-Labels (rotiert, GRUEN) */}
          <tr>
            <th
              className="sticky left-0 top-[2.5rem] z-30 border-r border-slate-700 bg-slate-900"
              style={{ width: labelColPx, minWidth: labelColPx }}
            />
            <th
              className="sticky top-[2.5rem] z-20 border-r border-slate-700 bg-slate-900"
              style={{
                left: labelColPx,
                width: indexColPx,
                minWidth: indexColPx,
              }}
            />
            {inputLabels.map((label, i) => (
              <th
                key={`lbl-${i}`}
                className={`sticky top-[2.5rem] z-10 p-0 ${
                  isGroupStripe(i) ? 'bg-slate-900/80' : 'bg-slate-900'
                } ${isGroupBreak(i) ? 'border-l border-slate-700' : ''} ${
                  colHighlight === i ? 'bg-emerald-900/60' : ''
                }`}
                style={{ width: cellPx, minWidth: cellPx, height: labelRowHeightRem }}
              >
                <div
                  className={`overflow-hidden text-center ${
                    colHighlight === i ? 'text-emerald-100' : 'text-emerald-300'
                  }`}
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    height: '100%',
                    padding: '6px 0',
                    fontSize: labelFontPx,
                    fontWeight: 500,
                    letterSpacing: 0.2,
                    lineHeight: 1.2,
                  }}
                  title={inLabelTip[i]}
                >
                  {label}
                </div>
              </th>
            ))}
          </tr>

          {/* Reihe 3: Input-Index-Nummern (mono, schaerfer) */}
          <tr>
            <th
              className="sticky left-0 z-30 border-b border-r border-slate-700 bg-slate-900 px-3 py-1 text-left uppercase text-slate-500"
              style={{
                top: `calc(2.5rem + ${labelRowHeightRem})`,
                width: labelColPx,
                minWidth: labelColPx,
                fontSize: 11,
              }}
            >
              Label
            </th>
            <th
              className="sticky z-20 border-b border-r border-slate-700 bg-slate-900 text-center font-mono text-slate-500"
              style={{
                left: labelColPx,
                top: `calc(2.5rem + ${labelRowHeightRem})`,
                width: indexColPx,
                minWidth: indexColPx,
                fontSize: 11,
              }}
            >
              #
            </th>
            {inputLabels.map((_, i) => (
              <th
                key={`idx-${i}`}
                className={`sticky z-10 border-b border-slate-700 font-mono text-slate-400 ${
                  isGroupStripe(i) ? 'bg-slate-900/80' : 'bg-slate-900'
                } ${isGroupBreak(i) ? 'border-l border-slate-700' : ''} ${
                  colHighlight === i ? 'bg-emerald-900/60 text-emerald-200' : ''
                }`}
                style={{
                  top: `calc(2.5rem + ${labelRowHeightRem})`,
                  width: cellPx,
                  minWidth: cellPx,
                  textAlign: 'center',
                  fontSize: indexFontPx,
                  padding: '2px 0',
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
                    ? 'bg-red-950/40'
                    : rowStripe
                      ? 'bg-slate-900/60 hover:bg-slate-800/60'
                      : 'hover:bg-slate-800/40'
                } ${groupRowBreak ? 'border-t border-slate-700' : ''}`}
              >
                {/* Output-Label-Zelle: CORAL/ROT, deutlich groesser */}
                <td
                  className={`sticky left-0 z-10 truncate border-r border-slate-800 px-3 py-1.5 text-left ${
                    rowOn
                      ? 'bg-red-950/70 text-red-100'
                      : rowStripe
                        ? 'bg-slate-900/90 text-red-300'
                        : 'bg-slate-950 text-red-300'
                  }`}
                  style={{
                    maxWidth: labelColPx,
                    minWidth: labelColPx,
                    fontSize: labelFontPx,
                    fontWeight: 500,
                    letterSpacing: 0.2,
                  }}
                  title={outLabelTip[oi]}
                >
                  {outLabel}
                </td>
                <td
                  className={`sticky z-10 border-r border-slate-800 text-center font-mono ${
                    rowOn
                      ? 'bg-red-950/70 text-red-200'
                      : rowStripe
                        ? 'bg-slate-900/95 text-slate-400'
                        : 'bg-slate-900 text-slate-500'
                  }`}
                  style={{
                    left: labelColPx,
                    width: indexColPx,
                    minWidth: indexColPx,
                    fontSize: indexFontPx,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => focusRow(oi)}
                    className="block w-full py-1 hover:text-emerald-300"
                    title={`Output ${oi + 1} fokussieren`}
                  >
                    {oi + 1}
                  </button>
                </td>
                {inputLabels.map((inLabel, ii) => {
                  const active = routedIdx === ii
                  const inCol = colHighlight === ii
                  const colStripe = isGroupStripe(ii)
                  const groupBreak = isGroupBreak(ii)
                  // Hintergrund je nach Crosshair / Group-Stripe.
                  let tdBg = ''
                  if (rowOn && inCol) tdBg = 'bg-amber-900/30'
                  else if (rowOn) tdBg = '' // Row-Tint kommt vom <tr>
                  else if (inCol) tdBg = 'bg-emerald-900/30'
                  else if (colStripe) tdBg = 'bg-slate-900/40'
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
                            ? 'mx-auto my-1 block rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.85)] ring-1 ring-emerald-200/70'
                            : rowOn && inCol
                              ? 'mx-auto my-1 block rounded-sm bg-amber-400/70 hover:bg-amber-300'
                              : rowOn
                                ? 'mx-auto my-1 block rounded-sm bg-red-400/60 hover:bg-red-300'
                                : inCol
                                  ? 'mx-auto my-1 block rounded-sm bg-emerald-500/60 hover:bg-emerald-400'
                                  : 'mx-auto my-1 block rounded-sm bg-slate-700/80 hover:bg-slate-500'
                        }
                        style={{ width: cellPx - 6, height: cellPx - 6 }}
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
