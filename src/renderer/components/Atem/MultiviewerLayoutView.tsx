import { useEffect, useState } from 'react'
import { cablePlannerApi, type AtemStateSummary, type AtemMultiviewer } from '../../lib/bridge'
import { useTranslation } from '../../lib/i18n'

interface MultiviewerLayoutViewProps {
  onClose: () => void
}

/**
 * ATEM `MultiViewerLayout` enum values (mirrored from atem-connection).
 * The layout describes which quadrant the big PRV+PGM tiles occupy; the
 * remaining tiles fill the other three quadrants in a 4x4 grid (10 small
 * tiles total) — or in a 2x2 grid for 4-window multiviewers.
 */
const LAYOUT = {
  Default: 0,
  TopLeftSmall: 1,
  TopRightSmall: 2,
  ProgramBottom: 3,
  BottomLeftSmall: 4,
  ProgramRight: 5,
  BottomRightSmall: 8,
  ProgramLeft: 10,
  ProgramTop: 12,
} as const

/**
 * For each layout, define which window indices are the two "big" tiles
 * (PRV/PGM) and the CSS grid positions they occupy in a 4x4 multiviewer.
 * Window 0 = PRV, window 1 = PGM (swapped if programPreviewSwapped). Small
 * windows follow in raster order around the big pair.
 */
interface GridSpec {
  big: { window: number; colStart: number; rowStart: number; colSpan: number; rowSpan: number }[]
  /** Ordered list of small-window grid cells: window index drives cell. */
  small: { colStart: number; rowStart: number }[]
}

/**
 * 4x4 grid (columns/rows 1-indexed). Big tiles span 2x2; small tiles fill the
 * remaining cells. `small` array is indexed by (windowIndex - 2), matching the
 * order the ATEM reports windows in for each layout.
 */
const GRID_4X4: Record<number, GridSpec> = {
  [LAYOUT.Default]: {
    // Big PRV+PGM across the top, small tiles across the bottom two rows.
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 },
      { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 },
      { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 },
      { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 },
      { colStart: 4, rowStart: 4 },
    ],
  },
  [LAYOUT.ProgramTop]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [LAYOUT.ProgramBottom]: {
    big: [
      { window: 0, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 },
      { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 },
      { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
    ],
  },
  [LAYOUT.ProgramLeft]: {
    big: [
      { window: 0, colStart: 1, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 1, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 3, rowStart: 1 }, { colStart: 4, rowStart: 1 },
      { colStart: 3, rowStart: 2 }, { colStart: 4, rowStart: 2 },
      { colStart: 3, rowStart: 3 }, { colStart: 4, rowStart: 3 },
      { colStart: 3, rowStart: 4 }, { colStart: 4, rowStart: 4 },
    ],
  },
  [LAYOUT.ProgramRight]: {
    big: [
      { window: 0, colStart: 3, rowStart: 1, colSpan: 2, rowSpan: 2 },
      { window: 1, colStart: 3, rowStart: 3, colSpan: 2, rowSpan: 2 },
    ],
    small: [
      { colStart: 1, rowStart: 1 }, { colStart: 2, rowStart: 1 },
      { colStart: 1, rowStart: 2 }, { colStart: 2, rowStart: 2 },
      { colStart: 1, rowStart: 3 }, { colStart: 2, rowStart: 3 },
      { colStart: 1, rowStart: 4 }, { colStart: 2, rowStart: 4 },
    ],
  },
}

const getGridSpec = (layout: number): GridSpec =>
  GRID_4X4[layout] ?? GRID_4X4[LAYOUT.Default]

/**
 * Heuristic source categorization for the legend colors. Uses the ATEM's
 * `internalPortType` when available, otherwise falls back to name prefixes.
 * Port type values (from atem-connection InternalPortType enum):
 *   0 External, 1 Black, 2 ColorBars, 3 ColorGenerator, 4 MediaPlayerFill,
 *   5 MediaPlayerKey, 6 SuperSource, 128 MEOutput, 129 Auxiliary,
 *   130 Mask, 131 MultiViewer
 */
const categorize = (portType: number | undefined, name: string): 'camera' | 'gfx' | 'support' | 'aux' | 'pgm' | 'other' => {
  const n = name.toLowerCase()
  if (portType === 128) return 'pgm'
  if (portType === 129) return 'aux'
  if (/^cam|kamera/.test(n)) return 'camera'
  if (/gfx|ppt|logo|titel|title|lyrics|lower/.test(n)) return 'gfx'
  if (/stream|recorder|rec|super|clock|vt|tpg|audio/.test(n)) return 'support'
  if (/pgm|prv|preview|program/.test(n)) return 'pgm'
  return 'other'
}

const CATEGORY_STYLE: Record<
  ReturnType<typeof categorize>,
  { bg: string; border: string; text: string }
> = {
  camera: { bg: '#d8ebc8', border: '#8ca972', text: '#1f2f15' },
  gfx: { bg: '#cfdced', border: '#8ba0bb', text: '#0f1b2c' },
  support: { bg: '#f5dcc4', border: '#c79b6f', text: '#3a2514' },
  aux: { bg: '#e8c9cf', border: '#b4818d', text: '#34141a' },
  pgm: { bg: '#fde68a', border: '#b08a2b', text: '#2a1e00' },
  other: { bg: '#1f2937', border: '#475569', text: '#e2e8f0' },
}

interface TileProps {
  long: string
  short: string
  category: ReturnType<typeof categorize>
  highlight?: 'pgm' | 'prv'
}

const SourceTile = ({ long, short, category, highlight }: TileProps) => {
  const style = CATEGORY_STYLE[category]
  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        boxShadow:
          highlight === 'pgm'
            ? 'inset 0 0 0 2px #ef4444'
            : highlight === 'prv'
              ? 'inset 0 0 0 2px #22c55e'
              : undefined,
      }}
      className="flex h-full w-full flex-col items-center justify-center overflow-hidden px-1 text-center"
    >
      {highlight && (
        <div className="text-[11px] font-semibold uppercase tracking-widest opacity-70">
          {highlight === 'pgm' ? 'PGM' : 'PRV'}
        </div>
      )}
      <div className="truncate text-[11px] font-medium leading-tight">{long}</div>
      {short && long !== short && (
        <div className="truncate text-[11px] opacity-60">{short}</div>
      )}
    </div>
  )
}

const MultiviewerPanel = ({ mv }: { mv: AtemMultiviewer }) => {
  const spec = getGridSpec(mv.layout)
  const pgmIndex = mv.programPreviewSwapped ? 0 : 1
  const prvIndex = mv.programPreviewSwapped ? 1 : 0
  return (
    <div className="rounded border border-cp-surface-5 bg-cp-surface-3 p-2">
      <div className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-cp-text-secondary">
        MV {mv.index + 1}
      </div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(4, 1fr)',
          aspectRatio: '16 / 9',
        }}
      >
        {spec.big.map((big) => {
          const window = mv.windows[big.window]
          if (!window) return null
          const highlight = big.window === pgmIndex ? 'pgm' : big.window === prvIndex ? 'prv' : undefined
          return (
            <div
              key={`big-${big.window}`}
              style={{
                gridColumn: `${big.colStart} / span ${big.colSpan}`,
                gridRow: `${big.rowStart} / span ${big.rowSpan}`,
              }}
            >
              <SourceTile
                long={window.longName}
                short={window.shortName}
                category={categorize(window.portType, window.longName)}
                highlight={highlight}
              />
            </div>
          )
        })}
        {spec.small.map((cell, smallIndex) => {
          const windowIndex = smallIndex + 2
          const window = mv.windows[windowIndex]
          if (!window) return null
          return (
            <div
              key={`small-${windowIndex}`}
              style={{
                gridColumn: `${cell.colStart} / span 1`,
                gridRow: `${cell.rowStart} / span 1`,
              }}
            >
              <SourceTile
                long={window.longName}
                short={window.shortName}
                category={categorize(window.portType, window.longName)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const MultiviewerLayoutView = ({ onClose }: MultiviewerLayoutViewProps) => {
  const t = useTranslation()
  const [state, setState] = useState<AtemStateSummary | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const status = await cablePlannerApi.atem.getStatus()
      setConnected(status.connected)
      if (!status.connected) {
        setState(null)
        return
      }
      const fresh = await cablePlannerApi.atem.getState()
      setState(fresh)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial-Refresh + ATEM-Event-Subscription (externer Store)
    void refresh()
    // Live updates: the main process pushes ATEM state events; refresh on each.
    const unsubscribe = cablePlannerApi.atem.onEvent(() => {
      void refresh()
    })
    return () => unsubscribe()
  }, [])

  const mvs = (state?.multiViewers ?? []).filter(
    (mv): mv is AtemMultiviewer => mv !== null && mv !== undefined,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col rounded border border-cp-surface-5 bg-cp-surface-1 text-cp-text">
        <header className="flex items-center justify-between border-b border-cp-border px-4 py-2">
          <div>
            <h2 className="text-cp-xl font-semibold text-sky-300">
              {t('atem.mvLayout.title', 'Multiviewer Layout (Live)')}
            </h2>
            {state && (
              <p className="text-[11px] text-cp-text-muted">
                {state.productIdentifier} · {mvs.length} MV
                {mvs.length === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('atem.mvLayout.refresh', '↻ Aktualisieren')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('atem.mvLayout.close', '✕ Schließen')}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {!connected && (
            <div className="rounded border border-amber-700 bg-amber-900/30 p-3 text-cp-xs text-amber-200">
              {t(
                'atem.mvLayout.notConnected',
                'Keine Verbindung zu einem ATEM. Zuerst im ATEM-Dialog verbinden, dann diese Ansicht öffnen.',
              )}
            </div>
          )}
          {error && (
            <div className="mt-2 rounded bg-red-900/50 p-2 text-cp-xs text-red-100">{error}</div>
          )}

          {connected && mvs.length === 0 && (
            <div className="text-cp-xs text-cp-text-muted">
              {t('atem.mvLayout.noMv', 'Der verbundene ATEM meldet keine Multiviewer.')}
            </div>
          )}

          {mvs.length > 0 && (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.min(mvs.length, 2)}, minmax(0, 1fr))`,
              }}
            >
              {mvs.map((mv) => (
                <MultiviewerPanel key={mv.index} mv={mv} />
              ))}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-4 border-t border-cp-border px-4 py-2 text-[11px] text-cp-text-secondary">
          <span className="font-semibold uppercase tracking-wider text-cp-text-muted">
            {t('atem.mvLayout.legend', 'Legende')}
          </span>
          <LegendSwatch label={t('atem.mvLayout.camera', 'Kamera')} category="camera" />
          <LegendSwatch label={t('atem.mvLayout.gfx', 'GFX')} category="gfx" />
          <LegendSwatch label={t('atem.mvLayout.support', 'Support')} category="support" />
          <LegendSwatch label={t('atem.mvLayout.aux', 'AUX')} category="aux" />
          <LegendSwatch label={t('atem.mvLayout.pgmPrv', 'PGM/PRV')} category="pgm" />
        </footer>
      </div>
    </div>
  )
}

const LegendSwatch = ({
  label,
  category,
}: {
  label: string
  category: ReturnType<typeof categorize>
}) => {
  const style = CATEGORY_STYLE[category]
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-3 w-5 rounded-sm"
        style={{ background: style.bg, border: `1px solid ${style.border}` }}
      />
      {label}
    </span>
  )
}
