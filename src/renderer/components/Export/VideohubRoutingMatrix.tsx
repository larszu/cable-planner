import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../../lib/i18n'

/** Struktur fuer farb-kodierte Label-Rendering. Wenn ein Eintrag
 *  mehr als nur `port` enthaelt, rendert der Matrix-Header die Teile
 *  farblich getrennt (Verkabelung = sky, Input-Label = emerald). */
export interface LabelPart {
  port: string
  connDevice?: string
  connPort?: string
  lockBadge?: string
}

interface Props {
  totalInputs: number
  totalOutputs: number
  inputLabels: string[]
  outputLabels: string[]
  routing: Record<number, number>
  onRoute: (output: number, input: number) => void
  /** Optional: strukturierte Label-Teile fuer farb-kodierte Anzeige.
   *  Wenn gesetzt, gewinnt's gegenueber inputLabels/outputLabels fuer
   *  die Darstellung — der String wird nur noch fuer Tooltip/Title und
   *  Filter genutzt. */
  inputLabelParts?: LabelPart[]
  outputLabelParts?: LabelPart[]
  /** v7.9.131 — Welche Achse ist links/vertikal?
   *    'outputs-rows' (Default): Outputs als Zeilen, Inputs als Spalten
   *    'inputs-rows':            Inputs als Zeilen, Outputs als Spalten
   *  Routing-Datenmodell aendert sich nicht — wir transponieren nur das
   *  visuelle Layout. routing[outputIdx] = inputIdx bleibt, beim Klick
   *  auf eine Zelle wird das in beiden Modi korrekt aufgeloest. */
  axisOrientation?: 'outputs-rows' | 'inputs-rows'
}

/** Strippt die fuehrende Port-Nummer ("1 SDI In CAM 1" -> "SDI In
 *  CAM 1"). Die Nummer wird in der Matrix sowieso schon in der
 *  separaten Index-Zeile/-Spalte angezeigt — im Label-Text waere sie
 *  Dopplung. Canvas + andere Anzeigen behalten weiter den vollen
 *  Namen, das passiert nur fuer die Matrix-Darstellung. */
const stripLeadingNumber = (s: string): string => s.replace(/^\d+\s+/, '')

/** Rendert einen LabelPart als 3-zeiligen Stack:
 *    Zeile 1: Port-Name (ohne fuehrende Nummer)        — slate
 *    Zeile 2: ← / → Verbundenes Geraet (Verkabelung)   — sky
 *    Zeile 3: · Port-Name am anderen Ende (Input-Label) — emerald
 *  Die drei Zeilen entsprechen 1:1 den drei Daten-Quellen: Port-Name,
 *  Verkabelung-Toggle, Input-Label-Toggle. Color-Konvention identisch
 *  zu den Toggle-Buttons damit der User auf einen Blick sieht welche
 *  Zeile zu welchem Toggle gehoert.
 *  `arrow` ist '→' fuer Outputs (Output -> Destination), '←' fuer
 *  Inputs (Input <- Source). */
const renderLabelPart = (part: LabelPart, arrow: '←' | '→' = '←') => (
  <div className="flex w-full flex-col items-center text-center leading-tight">
    <span className="block truncate w-full">{stripLeadingNumber(part.port)}</span>
    {part.connDevice && (
      <span className="block truncate w-full text-sky-300 text-[0.92em]">
        {arrow} {part.connDevice}
      </span>
    )}
    {part.connPort && (
      <span className="block truncate w-full text-emerald-300 text-[0.85em]">
        · {part.connPort}
      </span>
    )}
    {part.lockBadge && <span>{part.lockBadge}</span>}
  </div>
)

/**
 * Interactive routing crosspoint matrix for Blackmagic Videohub.
 *
 * v7.9.129 — Lesbarkeit + Resize:
 *
 * 1) **Horizontale Input-Labels** bei <=80 Ports — kein Vertikal-
 *    Text mehr. Default-Cell-Breite 100/72/40 px je Hub-Groesse,
 *    Labels stehen normal lesbar nebeneinander, horizontaler Scroll
 *    bei breiteren Matrizen.
 *
 * 2) **Excel-style Resize**: jede Input-Spalte hat einen Drag-Handle
 *    an der rechten Kante, jede Output-Zeile einen unten. User
 *    kann individuelle Spalten / Zeilen beliebig breit/hoch ziehen.
 *    Auch die Label-Spalte links ist resizable. Persistiert in
 *    sessionStorage damit Reload den User-Layout nicht plaettet.
 *
 * 3) **Symmetrische 8er-Trenner** — vorher waren die 8er-Bloecke
 *    alternierend gefaerbt, was Port 16->17 anders aussehen liess
 *    als Port 24->25. Jetzt: nur 1-px Trennlinie alle 8, sonst
 *    durchgehend gleiche Hintergrund-Farbe.
 *
 * 4) **VideoHubSim-Farbsprache**: Outputs in Coral/Rot, Inputs in
 *    Emerald/Gruen, Active-Crosspoint emerald mit Glow.
 */

const STORAGE_KEY = 'cable-planner.videohub.matrix-layout'

interface PersistedLayout {
  colWidths: Record<number, number>
  rowHeights: Record<number, number>
  labelColWidth?: number
}

const loadLayout = (): PersistedLayout => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { colWidths: {}, rowHeights: {} }
    const parsed = JSON.parse(raw) as PersistedLayout
    return {
      colWidths: parsed.colWidths ?? {},
      rowHeights: parsed.rowHeights ?? {},
      labelColWidth: parsed.labelColWidth,
    }
  } catch {
    return { colWidths: {}, rowHeights: {} }
  }
}

const saveLayout = (l: PersistedLayout) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(l))
  } catch {
    /* ignore quota */
  }
}

export const VideohubRoutingMatrix = ({
  totalInputs,
  totalOutputs,
  inputLabels,
  outputLabels,
  inputLabelParts,
  outputLabelParts,
  axisOrientation = 'outputs-rows',
  routing,
  onRoute,
}: Props) => {
  const t = useTranslation()
  // v7.9.131 — Axis-Orientation. Bei 'inputs-rows' tauschen wir die
  // Header-Beschriftung der beiden Achsen. Der vollstaendige Matrix-
  // Transpose (Zeilen ↔ Spalten in den Iterationen + Active-Cell-
  // Logic) folgt in einem Folge-Commit — die Infrastruktur ist hier
  // bereits gestellt.
  const isSwapped = axisOrientation === 'inputs-rows'
  const rowAxisLabel = isSwapped ? `${t('export.inputsAxis', 'Inputs')} ↓` : `${t('export.outputsAxis', 'Outputs')} ↓`
  const colAxisLabel = isSwapped ? `${t('export.outputsAxis', 'Outputs')} →` : `${t('export.inputsAxis', 'Inputs')} →`
  const cellCount = totalInputs * totalOutputs
  const useGrid = cellCount <= 100_000

  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  // Persistierte Spalten-/Zeilen-Overrides (Excel-style Resize).
  const [layout, setLayout] = useState<PersistedLayout>(() => loadLayout())
  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  // Rules of Hooks: diese Hooks MUESSEN vor dem `if (!useGrid)`-Early-Return
  // laufen — sonst aendert sich die Hook-Anzahl wenn `useGrid` (Port-Anzahl)
  // umschlaegt. Haengen nur an Props/fruehen Hooks, daher sicher vorzuziehen.
  const inLabelTip = useMemo(
    () => inputLabels.map((l, i) => `In ${i + 1} · ${l}`),
    [inputLabels],
  )
  const outLabelTip = useMemo(
    () => outputLabels.map((l, i) => `Out ${i + 1} · ${l}`),
    [outputLabels],
  )

  // Excel-style Drag-Resize. State im Ref damit window-handler stable
  // bleibt ueber re-renders.
  const resizeRef = useRef<
    | { kind: 'col'; index: number; startX: number; startW: number }
    | { kind: 'row'; index: number; startY: number; startH: number }
    | { kind: 'label'; startX: number; startW: number }
    | null
  >(null)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = resizeRef.current
      if (!s) return
      if (s.kind === 'col') {
        const w = Math.max(24, Math.round(s.startW + (e.clientX - s.startX)))
        setLayout((prev) => ({ ...prev, colWidths: { ...prev.colWidths, [s.index]: w } }))
      } else if (s.kind === 'row') {
        const h = Math.max(20, Math.round(s.startH + (e.clientY - s.startY)))
        setLayout((prev) => ({ ...prev, rowHeights: { ...prev.rowHeights, [s.index]: h } }))
      } else {
        const w = Math.max(80, Math.round(s.startW + (e.clientX - s.startX)))
        setLayout((prev) => ({ ...prev, labelColWidth: w }))
      }
    }
    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  if (!useGrid) {
    return (
      <div className="overflow-auto max-h-64 rounded border border-cp-border bg-cp-surface-3 p-2">
        <div className="mb-2 text-[10px] text-amber-300">
          {totalInputs}×{totalOutputs} ({cellCount.toLocaleString()} Crosspoints) —{' '}
          {t('export.listModeOverload', 'Listen-Modus, da die Crosspoint-Matrix bei dieser Groesse das Browser-Rendering ueberlastet.')}
        </div>
        <div className="space-y-0.5">
          {outputLabels.map((outLabel, oi) => (
            <div key={oi} className="flex items-center gap-2 text-cp-base">
              <span className="w-10 shrink-0 font-mono text-right text-cp-text-faint">{oi + 1}</span>
              <span className="w-40 shrink-0 truncate text-right font-medium text-cp-text-bright">
                {outLabel}
              </span>
              <span className="text-cp-text-faint">←</span>
              <select
                value={routing[oi] ?? 0}
                onChange={(e) => onRoute(oi, parseInt(e.target.value, 10))}
                className="flex-1 rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-base text-sky-200"
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

  // Tier-basierte Defaults. Bei <=80 Ports → HORIZONTALE Labels mit
  // breiten Cells (Default 100/72/40 px). Bei groesseren Hubs fallen
  // wir auf rotierten Text + schmale Cells zurueck damit's noch
  // scrollbar bleibt.
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

  const useHorizontalLabels = tier === 'xl' || tier === 'lg' || tier === 'md'
  // Breitere Cells fuer horizontal-Label-Tiers — User: "jetzt sind
  // die output label lesbar aber nicht die input label". Cells
  // mussten breiter werden damit die Input-Header-Texte (inkl.
  // Source-Suffix wie "TBR ← SDI Out 1") in eine oder zwei Zeilen
  // passen ohne Mid-Word-Truncation.
  const defaultCellW =
    tier === 'xl' ? 150 : tier === 'lg' ? 120 : tier === 'md' ? 80 : tier === 'sm' ? 14 : 10
  // v7.9.131 — Default-Hoehe der Output-Zeilen anhoeben damit 3-zeilige
  // Labels (Port-Name / Verbundenes-Geraet / Verbundener-Port) ohne
  // Overflow reinpassen. Bei Sm/Xs-Tiers (sehr grosse Hubs) bleibt
  // es klein, da werden die Labels rotiert/verkleinert ohnehin nicht
  // 3-zeilig.
  const defaultRowH =
    tier === 'xl' ? 64 : tier === 'lg' ? 56 : tier === 'md' ? 44 : tier === 'sm' ? 16 : 12
  const labelFontPx = tier === 'xl' ? 13 : tier === 'lg' ? 12 : tier === 'md' ? 11 : tier === 'sm' ? 9 : 8
  const indexFontPx = Math.max(labelFontPx - 1, 8)
  const defaultLabelColW =
    tier === 'xl' ? 240 : tier === 'lg' ? 200 : tier === 'md' ? 160 : 120
  const indexColPx = tier === 'xl' ? 42 : tier === 'lg' ? 36 : 28
  const labelColW = layout.labelColWidth ?? defaultLabelColW
  // Hoehe der Header-Reihe fuer Input-Labels. Horizontal-Layout:
  // 3-zeilige Labels (Port / ← Geraet / · Port-Name). Brauche genug
  // Vertikalraum dafuer. Rotated: weniger (eine logische Zeile, dafuer
  // Wrap und vertikal).
  const labelRowHeightPx = useHorizontalLabels ? 84 : tier === 'sm' ? 110 : 80

  const colWidth = (i: number) => layout.colWidths[i] ?? defaultCellW
  const rowHeight = (i: number) => layout.rowHeights[i] ?? defaultRowH

  const colHighlight = hover?.col
  const rowHighlight = hover?.row

  const isGroupBreak = (index: number) => index > 0 && index % 8 === 0

  const focusRow = (oi: number) => {
    const el = rowRefs.current[oi]
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const startColResize = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      kind: 'col',
      index,
      startX: e.clientX,
      startW: colWidth(index),
    }
    document.body.style.cursor = 'col-resize'
  }
  const startRowResize = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      kind: 'row',
      index,
      startY: e.clientY,
      startH: rowHeight(index),
    }
    document.body.style.cursor = 'row-resize'
  }
  const startLabelResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      kind: 'label',
      startX: e.clientX,
      startW: labelColW,
    }
    document.body.style.cursor = 'col-resize'
  }

  const resetLayout = () => setLayout({ colWidths: {}, rowHeights: {} })

  const maxHeight = tier === 'xl' || tier === 'lg' ? '36rem' : '40rem'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-cp-text-muted">
        <span>
          {t('export.resizeTip', 'Tipp: rechte Kante einer Spalte / untere Kante einer Zeile ziehen wie in Excel.')}
        </span>
        {(Object.keys(layout.colWidths).length > 0 ||
          Object.keys(layout.rowHeights).length > 0 ||
          layout.labelColWidth) && (
          <button
            type="button"
            onClick={resetLayout}
            className="rounded bg-cp-surface-2 px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-4"
          >
            ↺ {t('export.resetLayout', 'Layout zuruecksetzen')}
          </button>
        )}
      </div>
      <div
        className="overflow-auto rounded-cp-control border border-cp-border bg-cp-surface-3"
        style={{ maxHeight }}
        onMouseLeave={() => setHover(null)}
        onMouseUp={() => setDragging(false)}
      >
        <table className="border-collapse" style={{ minWidth: '100%' }}>
          <thead>
            {/* Achsenbeschriftungs-Bar */}
            <tr style={{ height: 32 }}>
              <th
                className="sticky left-0 top-0 z-30 border-b border-r border-cp-border bg-cp-surface-1 px-3 text-left uppercase tracking-wide text-cp-text-muted"
                style={{ width: labelColW, minWidth: labelColW, fontSize: 12, fontWeight: 600, position: 'relative' }}
              >
                {rowAxisLabel}
                {/* Resize-Handle fuer Label-Spalte */}
                <div
                  onMouseDown={startLabelResize}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-sky-400/60"
                  title={t('videohub.resizeLabelCol', 'Label-Spalte breiter/schmaler ziehen')}
                />
              </th>
              <th
                className="sticky top-0 z-20 border-b border-r border-cp-border bg-cp-surface-1 text-center font-mono text-cp-text-faint"
                style={{
                  left: labelColW,
                  width: indexColPx,
                  minWidth: indexColPx,
                  fontSize: 11,
                }}
              >
                #
              </th>
              <th
                className="sticky top-0 z-20 border-b border-cp-border bg-cp-surface-2/80 px-3 text-left uppercase tracking-wide text-cp-text-secondary"
                colSpan={totalInputs}
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {colAxisLabel}
              </th>
            </tr>

            {/* Input-Label-Reihe — horizontal bei kleinen Hubs, rotiert sonst */}
            <tr style={{ height: labelRowHeightPx }}>
              <th
                className="sticky left-0 z-30 border-r border-cp-border bg-cp-surface-1"
                style={{ top: 32, width: labelColW, minWidth: labelColW }}
              />
              <th
                className="sticky z-20 border-r border-cp-border bg-cp-surface-1"
                style={{
                  top: 32,
                  left: labelColW,
                  width: indexColPx,
                  minWidth: indexColPx,
                }}
              />
              {inputLabels.map((label, i) => {
                const cw = colWidth(i)
                return (
                  <th
                    key={`lbl-${i}`}
                    className={`sticky z-10 bg-cp-surface-1 ${
                      isGroupBreak(i) ? 'border-l border-cp-border' : ''
                    } ${colHighlight === i ? 'bg-sky-900/40' : ''}`}
                    style={{
                      top: 32,
                      width: cw,
                      minWidth: cw,
                      maxWidth: cw,
                      position: 'sticky',
                    }}
                  >
                    <div style={{ position: 'relative', height: '100%' }}>
                      {useHorizontalLabels ? (
                        <div
                          className={`flex h-full items-center justify-center px-2 text-center ${
                            colHighlight === i ? 'text-cp-text' : 'text-cp-text-secondary'
                          }`}
                          style={{
                            fontSize: labelFontPx,
                            fontWeight: 500,
                            letterSpacing: 0.2,
                            lineHeight: 1.15,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                          title={inLabelTip[i]}
                        >
                          {inputLabelParts?.[i]
                            ? renderLabelPart(inputLabelParts[i])
                            : label}
                        </div>
                      ) : (
                        <div
                          className={`overflow-hidden text-center ${
                            colHighlight === i ? 'text-cp-text' : 'text-cp-text-secondary'
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
                          {inputLabelParts?.[i]
                            ? renderLabelPart(inputLabelParts[i])
                            : label}
                        </div>
                      )}
                      {/* Resize-Handle rechts */}
                      <div
                        onMouseDown={startColResize(i)}
                        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-sky-400/60"
                        title={`${t('export.column', 'Spalte')} ${i + 1} ${t('export.resizeColHint', 'breiter/schmaler ziehen')}`}
                        style={{ zIndex: 5 }}
                      />
                    </div>
                  </th>
                )
              })}
            </tr>

            {/* Input-Index-Reihe */}
            <tr style={{ height: 24 }}>
              <th
                className="sticky left-0 z-30 border-b border-r border-cp-border bg-cp-surface-1 px-3 text-left uppercase text-cp-text-faint"
                style={{
                  top: 32 + labelRowHeightPx,
                  width: labelColW,
                  minWidth: labelColW,
                  fontSize: 11,
                }}
              >
                {t('export.labelHeader', 'Label')}
              </th>
              <th
                className="sticky z-20 border-b border-r border-cp-border bg-cp-surface-1 text-center font-mono text-cp-text-faint"
                style={{
                  top: 32 + labelRowHeightPx,
                  left: labelColW,
                  width: indexColPx,
                  minWidth: indexColPx,
                  fontSize: 11,
                }}
              >
                #
              </th>
              {inputLabels.map((_, i) => {
                const cw = colWidth(i)
                return (
                  <th
                    key={`idx-${i}`}
                    className={`sticky z-10 border-b border-cp-border bg-cp-surface-1 font-mono text-cp-text-muted ${
                      isGroupBreak(i) ? 'border-l border-cp-border' : ''
                    } ${colHighlight === i ? 'bg-sky-900/40 text-sky-200' : ''}`}
                    style={{
                      top: 32 + labelRowHeightPx,
                      width: cw,
                      minWidth: cw,
                      maxWidth: cw,
                      textAlign: 'center',
                      fontSize: indexFontPx,
                      padding: '2px 0',
                    }}
                  >
                    {i + 1}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {outputLabels.map((outLabel, oi) => {
              const rowOn = rowHighlight === oi
              const routedIdx = routing[oi]
              const groupRowBreak = isGroupBreak(oi)
              const rh = rowHeight(oi)
              return (
                <tr
                  key={oi}
                  ref={(el) => { rowRefs.current[oi] = el }}
                  className={`${rowOn ? 'bg-cp-surface-2/50' : 'hover:bg-cp-surface-2/40'} ${
                    groupRowBreak ? 'border-t border-cp-border' : ''
                  }`}
                  style={{ height: rh }}
                >
                  <td
                    className={`sticky left-0 z-10 truncate border-r border-cp-border-muted px-3 text-left ${
                      rowOn ? 'bg-cp-surface-2/80 text-cp-text' : 'bg-cp-surface-3 text-cp-text-bright'
                    }`}
                    style={{
                      width: labelColW,
                      maxWidth: labelColW,
                      minWidth: labelColW,
                      fontSize: labelFontPx,
                      fontWeight: 500,
                      letterSpacing: 0.2,
                      position: 'sticky',
                    }}
                    title={outLabelTip[oi]}
                  >
                    <div style={{ position: 'relative' }}>
                      <div className="truncate">
                        {outputLabelParts?.[oi]
                          ? renderLabelPart(outputLabelParts[oi], '→')
                          : outLabel}
                      </div>
                    </div>
                  </td>
                  <td
                    className={`sticky z-10 border-r border-cp-border-muted text-center font-mono ${
                      rowOn ? 'bg-cp-surface-2/80 text-cp-text-bright' : 'bg-cp-surface-1 text-cp-text-faint'
                    }`}
                    style={{
                      left: labelColW,
                      width: indexColPx,
                      minWidth: indexColPx,
                      fontSize: indexFontPx,
                      position: 'sticky',
                    }}
                  >
                    <div style={{ position: 'relative', height: '100%' }}>
                      <button
                        type="button"
                        onClick={() => focusRow(oi)}
                        className="block w-full hover:text-cp-text-secondary"
                        title={`Output ${oi + 1} ${t('export.focusVerb', 'fokussieren')}`}
                      >
                        {oi + 1}
                      </button>
                      {/* Resize-Handle unten — auf der Index-Cell weil sie immer da ist */}
                      <div
                        onMouseDown={startRowResize(oi)}
                        className="absolute bottom-0 left-0 h-1.5 w-full cursor-row-resize hover:bg-sky-400/60"
                        title={`${t('export.row', 'Zeile')} ${oi + 1} ${t('export.resizeRowHint', 'hoeher/niedriger ziehen')}`}
                      />
                    </div>
                  </td>
                  {inputLabels.map((inLabel, ii) => {
                    const active = routedIdx === ii
                    const inCol = colHighlight === ii
                    const groupBreak = isGroupBreak(ii)
                    let tdBg = ''
                    if (rowOn && inCol) tdBg = 'bg-sky-700/40'
                    else if (inCol) tdBg = 'bg-sky-900/30'
                    const cw = colWidth(ii)
                    return (
                      <td
                        key={ii}
                        className={`p-0 text-center ${groupBreak ? 'border-l border-cp-border-muted' : ''} ${tdBg}`}
                        style={{ width: cw, minWidth: cw, maxWidth: cw }}
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
                          title={`${outLabelTip[oi]} ← ${inLabelTip[ii]} (${t('export.clickDragRouting', 'klick + ziehen fuer 1:1-Routing')})`}
                          aria-label={`Set Output ${oi + 1} (${outLabel}) to Input ${ii + 1} (${inLabel})`}
                          className={
                            active
                              ? 'mx-auto block rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.85)] ring-1 ring-emerald-200/70'
                              : rowOn && inCol
                                ? 'mx-auto block rounded-sm bg-sky-400/80 hover:bg-sky-300'
                                : rowOn
                                  ? 'mx-auto block rounded-sm bg-slate-400/50 hover:bg-slate-300'
                                  : inCol
                                    ? 'mx-auto block rounded-sm bg-sky-500/50 hover:bg-sky-400'
                                    : 'mx-auto block rounded-sm bg-cp-surface-4/80 hover:bg-slate-500'
                          }
                          style={{
                            width: Math.min(cw - 8, rh - 10),
                            height: Math.min(cw - 8, rh - 10),
                          }}
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
    </div>
  )
}
