import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { cablePlannerApi, type AtemInputSummary } from '../../lib/bridge'
import type {
  AtemMvConfig,
  AtemMvDefinition,
  AtemMvQuadrants,
} from '../../types/equipment'
import {
  MV_LAYOUT,
  closestAtemLayout,
  defaultMvCount,
  getMvCapabilities,
  getMvQuadrants,
  migrateMvToQuadrants,
  mvWindowIndex,
  roleForSource,
  type AtemMvCapabilities,
} from '../../lib/atemMvLayout'

/** v7.9.4 — Quadranten-basiertes Render-Helper. Wir rendern NICHT
 *  mehr basierend auf ATEM-Layout-IDs, sondern auf einem direkten
 *  4-Tupel (TL/TR/BL/BR). Jeder Quadrant wird einzeln umgeschaltet,
 *  PGM/PVW sind nur Sources (10011/10010), keine speziellen Slots. */
type QuadDef = {
  name: 'TL' | 'TR' | 'BL' | 'BR'
  idx: 0 | 1 | 2 | 3
  // 4×4-Grid-Position (colStart, rowStart). Big spans 2×2, small ist eine Zelle.
  col: number // 1 oder 3
  row: number // 1 oder 3
}
const QUADRANTS: ReadonlyArray<QuadDef> = [
  { name: 'TL', idx: 0, col: 1, row: 1 },
  { name: 'TR', idx: 1, col: 3, row: 1 },
  { name: 'BL', idx: 2, col: 1, row: 3 },
  { name: 'BR', idx: 3, col: 3, row: 3 },
]

/** Ein klickbarer Quadrant in der Mini-Vorschau (= "Layout-Picker"). */
const QuadrantBlock = ({
  quad,
  state,
  windows,
  inputs,
  cellSize,
  fontBig,
  fontIdBig,
  onToggle,
}: {
  quad: QuadDef
  state: 'big' | 'small'
  windows: { windowIndex: number; sourceId: number }[]
  inputs: { id: number; label: string }[]
  cellSize: number
  fontBig: number
  fontIdBig: number
  onToggle: () => void
}) => {
  const renderBig = () => {
    const wi = mvWindowIndex(quad.idx)
    const win = windows.find((w) => w.windowIndex === wi)
    const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
    const label = sourceLabel(sid, inputs)
    const bg = sourceColor(sid, label)
    const role = roleForSource(sid)
    const highlight = role === 'pgm' ? '#ef4444' : role === 'pvw' ? '#22c55e' : undefined
    return (
      <div
        className="flex flex-col items-center justify-center overflow-hidden text-center"
        style={{
          gridColumn: `${quad.col} / span 2`,
          gridRow: `${quad.row} / span 2`,
          background: bg,
          color: sid === 0 ? '#cbd5e1' : '#0f172a',
          boxShadow: highlight ? `inset 0 0 0 1px ${highlight}` : undefined,
          fontSize: fontBig,
          lineHeight: 1.1,
        }}
      >
        <span className="truncate px-1" style={{ maxWidth: '100%', fontWeight: 600 }}>
          {label}
        </span>
        <span style={{ fontSize: fontIdBig, opacity: 0.7 }}>ID {sid}</span>
      </div>
    )
  }
  const renderSmall = () => {
    // 4 kleine Cells in einem 2×2 Sub-Grid innerhalb des Quadranten
    return [0, 1, 2, 3].map((ci) => {
      const wi = mvWindowIndex(quad.idx, ci as 0 | 1 | 2 | 3)
      const win = windows.find((w) => w.windowIndex === wi)
      const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
      const label = sourceLabel(sid, inputs)
      const bg = sourceColor(sid, label)
      const subCol = quad.col + (ci % 2)
      const subRow = quad.row + Math.floor(ci / 2)
      return (
        <div
          key={`q-${quad.idx}-c-${ci}`}
          className="overflow-hidden"
          style={{
            gridColumn: `${subCol} / span 1`,
            gridRow: `${subRow} / span 1`,
            background: bg,
          }}
          title={`${label} (ID ${sid})`}
        />
      )
    })
  }
  // Optional: ein größerer Hint im großen Quadranten erklärt was beim
  // Klick passiert. Bei kleinen Quadranten reicht der Hover-Hint.
  void cellSize
  return state === 'big' ? renderBig() : <>{renderSmall()}</>
}

/** v7.9.4 — Mini-Vorschau ("Layout-Picker"). Jeder Quadrant einzeln
 *  togglebar — Klick auf big → der Quadrant wird zu 4 klein. Klick
 *  auf 4 klein → wird zu 1 big. PGM/PVW sind NICHT speziell — nur
 *  Sources die irgendwo zugewiesen werden. */
const MvLayoutPicker = ({
  quadrants,
  windows,
  inputs,
  onToggleQuadrant,
}: {
  quadrants: AtemMvQuadrants
  windows: { windowIndex: number; sourceId: number }[]
  inputs: { id: number; label: string }[]
  onToggleQuadrant: (quadIdx: 0 | 1 | 2 | 3) => void
}) => {
  return (
    <div className="relative" style={{ width: 240, aspectRatio: '16 / 9' }}>
      <div
        className="absolute inset-0 grid gap-[2px] rounded border border-slate-700 bg-slate-950 p-[2px]"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
      >
        {QUADRANTS.map((q) => (
          <QuadrantBlock
            key={q.name}
            quad={q}
            state={quadrants[q.idx]}
            windows={windows}
            inputs={inputs}
            cellSize={28}
            fontBig={9}
            fontIdBig={8}
            onToggle={() => onToggleQuadrant(q.idx)}
          />
        ))}
      </div>
      {/* Klickbare Quadranten-Overlays — flippen JEWEILS NUR diesen
          einen Quadranten in `quadrants`. Andere bleiben unverändert,
          PGM/PVW wandern nicht zwischen Slots herum (User-Anweisung). */}
      {QUADRANTS.map((q) => (
        <button
          key={q.name}
          type="button"
          onClick={() => onToggleQuadrant(q.idx)}
          title={
            quadrants[q.idx] === 'big'
              ? `${q.name}: aktuell 1 großes Fenster — Klick: in 4 kleine teilen`
              : `${q.name}: aktuell 4 kleine Fenster — Klick: zu 1 großem zusammenfassen`
          }
          aria-label={`Quadrant ${q.name} umschalten`}
          className="group absolute cursor-pointer outline-none transition-all hover:bg-sky-500/25 hover:ring-2 hover:ring-sky-400 focus-visible:bg-sky-500/30 focus-visible:ring-2 focus-visible:ring-sky-400"
          style={{
            width: '50%',
            height: '50%',
            top: q.row === 1 ? 0 : '50%',
            left: q.col === 1 ? 0 : '50%',
          }}
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold uppercase tracking-wider text-sky-100 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {quadrants[q.idx] === 'big' ? '1 → 4' : '4 → 1'}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * Catalog of commonly-used ATEM source IDs and their labels. These are offered
 * in the click-to-select popover so users can configure MVs without a live
 * connection. Extend as needed - the user can also type any numeric ID.
 */
const DEFAULT_SOURCES: { id: number; label: string; group: string }[] = [
  { id: 0, label: 'Black', group: 'Intern' },
  { id: 1000, label: 'Color Bars', group: 'Intern' },
  { id: 2001, label: 'Color 1', group: 'Intern' },
  { id: 2002, label: 'Color 2', group: 'Intern' },
  { id: 3010, label: 'Media Player 1', group: 'Media' },
  { id: 3020, label: 'Media Player 2', group: 'Media' },
  { id: 6000, label: 'Super Source', group: 'Misc' },
  { id: 10010, label: 'ME 1 Program', group: 'M/E' },
  { id: 10011, label: 'ME 1 Preview', group: 'M/E' },
  { id: 10020, label: 'ME 2 Program', group: 'M/E' },
  { id: 10021, label: 'ME 2 Preview', group: 'M/E' },
  { id: 10030, label: 'ME 3 Program', group: 'M/E' },
  { id: 10031, label: 'ME 3 Preview', group: 'M/E' },
  { id: 10040, label: 'ME 4 Program', group: 'M/E' },
  { id: 10041, label: 'ME 4 Preview', group: 'M/E' },
  { id: 8001, label: 'AUX 1', group: 'AUX' },
  { id: 8002, label: 'AUX 2', group: 'AUX' },
  { id: 8003, label: 'AUX 3', group: 'AUX' },
  { id: 8004, label: 'AUX 4', group: 'AUX' },
]

/** v7.9.4 — Frische MV-Definition mit dem neuen Quadranten-Indexing.
 *  Default: TL+TR big (PGM/PVW vorgestopft als bequemer Startpunkt),
 *  BL+BR sind 4 kleine schwarze Cells. PGM/PVW sind aber NICHT
 *  spezielle Slots — User kann die Sources beliebig umsetzen. */
const makeMv = (index: number): AtemMvDefinition => ({
  index,
  layout: 0,
  quadrants: ['big', 'big', 'small', 'small'],
  windows: [
    { windowIndex: mvWindowIndex(0), sourceId: 10011 }, // TL big — PGM-Vorbelegung
    { windowIndex: mvWindowIndex(1), sourceId: 10010 }, // TR big — PVW-Vorbelegung
    { windowIndex: mvWindowIndex(2, 0), sourceId: 0 },
    { windowIndex: mvWindowIndex(2, 1), sourceId: 0 },
    { windowIndex: mvWindowIndex(2, 2), sourceId: 0 },
    { windowIndex: mvWindowIndex(2, 3), sourceId: 0 },
    { windowIndex: mvWindowIndex(3, 0), sourceId: 0 },
    { windowIndex: mvWindowIndex(3, 1), sourceId: 0 },
    { windowIndex: mvWindowIndex(3, 2), sourceId: 0 },
    { windowIndex: mvWindowIndex(3, 3), sourceId: 0 },
  ],
})

const makeDefaultConfig = (name: string): AtemMvConfig => {
  const count = defaultMvCount(name)
  return { multiViewers: Array.from({ length: count }, (_, i) => makeMv(i)) }
}

const sourceLabel = (
  sourceId: number,
  inputs: { id: number; label: string }[],
): string => {
  const inp = inputs.find((i) => i.id === sourceId)
  if (inp) return inp.label
  const def = DEFAULT_SOURCES.find((s) => s.id === sourceId)
  if (def) return def.label
  if (sourceId === 0) return '—'
  return `ID ${sourceId}`
}

/** v7.9.124 — Gruppieren der Source-Liste im Picker. Bevorzugt portType
 *  (vom ATEM gemeldet), faellt auf ID-Range zurueck wenn portType
 *  nicht da ist. ATEM-portType-Enum:
 *   0 External, 1 Black, 2 Bars, 3 ColorGen, 4 MediaPlayer-Fill,
 *   5 MediaPlayer-Key, 6 SuperSource, 7 ME-Output, 8 Auxiliary,
 *   9 Mask, 10 MultiViewer, 11 KeyCut, 12 KeyMask, 13 StreamingOut. */
const groupForPortType = (portType: number | undefined, sourceId: number): string => {
  if (typeof portType === 'number') {
    switch (portType) {
      case 0:
        return 'Inputs'
      case 1:
      case 2:
      case 3:
        return 'Generators'
      case 4:
      case 5:
        return 'Media Player'
      case 6:
        return 'SuperSource'
      case 7:
        return 'ME Outputs'
      case 8:
        return 'AUX'
      case 9:
      case 11:
      case 12:
        return 'Key/Mask'
      case 10:
        return 'MultiViewer'
      case 13:
        return 'Streaming'
      default:
        return 'Other'
    }
  }
  // Fallback per ID-Range fuer offline / portType-leer.
  if (sourceId >= 1 && sourceId < 100) return 'Inputs'
  if (sourceId === 1000) return 'Generators'
  if (sourceId >= 2001 && sourceId < 3000) return 'Generators'
  if (sourceId >= 3010 && sourceId < 4000) return 'Media Player'
  if (sourceId === 10010 || sourceId === 10011) return 'ME Outputs'
  if (sourceId >= 8001 && sourceId < 9000) return 'AUX'
  return 'Other'
}

const sourceColor = (sourceId: number, label: string): string => {
  const l = label.toLowerCase()
  if (/cam|kamera/.test(l)) return '#d8ebc8'
  if (/gfx|ppt|logo|title|lyric/.test(l)) return '#cfdced'
  if (/pgm|program/.test(l)) return '#fde68a'
  if (/prv|preview/.test(l)) return '#fef3c7'
  if (/aux/.test(l) || (sourceId >= 8001 && sourceId <= 8099)) return '#e8c9cf'
  if (/stream|rec|super|clock|vt|tpg|audio|media/.test(l)) return '#f5dcc4'
  if (sourceId === 0) return '#1f2937'
  return '#e2e8f0'
}

interface SourcePickerProps {
  currentId: number
  /** v7.9.124 — Pro Eintrag jetzt optional `group` (z.B. 'Inputs',
   *  'AUX', 'ME Outputs'). Picker sortiert nach Gruppen. Wenn group
   *  fehlt landet alles in 'Inputs'. */
  inputs: { id: number; label: string; group?: string }[]
  onPick: (id: number) => void
  onClose: () => void
  anchor: { x: number; y: number }
  /** v7.9.124 — Wenn true, sind die uebergebenen `inputs` bereits die
   *  vollstaendige Source-Liste vom Live-ATEM (inkl. AUX/Color/MP/
   *  PGM/PVW). Picker mergt dann KEINE DEFAULT_SOURCES rein, sonst
   *  haetten wir Doppelte. */
  hasLiveState?: boolean
}

const SourcePicker = ({
  currentId,
  inputs,
  onPick,
  onClose,
  anchor,
  hasLiveState,
}: SourcePickerProps) => {
  const [filter, setFilter] = useState('')
  const [custom, setCustom] = useState<string>(String(currentId))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    document.addEventListener('keydown', key)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])

  const all = useMemo(() => {
    // v7.9.124 — Gruppe aus dem Input-Eintrag uebernehmen wenn da,
    // sonst 'Inputs'. DEFAULT_SOURCES nur mergen wenn der Caller KEINE
    // Live-State-Liste mitliefert (sonst doppeln sich PGM/PVW etc).
    const fromInputs = inputs.map((i) => ({
      id: i.id,
      label: i.label,
      group: i.group ?? 'Inputs',
    }))
    const combined = hasLiveState ? fromInputs : [...fromInputs, ...DEFAULT_SOURCES]
    if (!filter.trim()) return combined
    const q = filter.toLowerCase()
    return combined.filter(
      (s) => s.label.toLowerCase().includes(q) || String(s.id).includes(q),
    )
  }, [inputs, filter, hasLiveState])

  const grouped = useMemo(() => {
    const map = new Map<string, typeof all>()
    for (const item of all) {
      const g = map.get(item.group) ?? []
      g.push(item)
      map.set(item.group, g)
    }
    return Array.from(map.entries())
  }, [all])

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[60] max-h-[60vh] w-64 overflow-auto rounded border border-slate-600 bg-slate-900 shadow-2xl"
      style={{
        left: Math.min(anchor.x, window.innerWidth - 280),
        top: Math.min(anchor.y, window.innerHeight - 400),
      }}
    >
      <div className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900 p-2">
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Suche…"
          className="mb-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
        />
        <div className="flex gap-1">
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="ID"
            className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(custom)
              if (!Number.isNaN(n)) onPick(n)
            }}
            className="flex-1 rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
          >
            Übernehmen
          </button>
        </div>
      </div>
      <div className="p-1 text-xs">
        {grouped.map(([group, items]) => (
          <div key={group} className="mb-1">
            <div className="px-1 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
              {group}
            </div>
            {items.map((item) => (
              <button
                key={`${group}-${item.id}`}
                type="button"
                onClick={() => onPick(item.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-800 ${
                  item.id === currentId ? 'bg-slate-700 text-emerald-300' : 'text-slate-200'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-2 text-[10px] text-slate-500">{item.id}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** v7.9.4 — Klappbare Info-/Override-Zeile für die Modell-
 *  Capabilities. Zeigt was die Heuristik erkannt hat und lässt den
 *  User die unterstützten Layouts manuell anpassen. */
const CapabilitiesPanel = ({
  equipmentName,
  caps,
  hasOverride,
  onOverride,
}: {
  equipmentName: string
  caps: AtemMvCapabilities
  hasOverride: boolean
  onOverride: (next: AtemMvCapabilities | undefined) => void
}) => {
  const [open, setOpen] = useState(false)
  const allLayouts: { value: number; label: string }[] = [
    { value: 0, label: 'Default' },
    { value: 12, label: 'Program Top' },
    { value: 3, label: 'Program Bottom' },
    { value: 10, label: 'Program Left' },
    { value: 5, label: 'Program Right' },
    { value: 1, label: 'Top-Left Small' },
    { value: 2, label: 'Top-Right Small' },
    { value: 4, label: 'Bottom-Left Small' },
    { value: 8, label: 'Bottom-Right Small' },
    { value: MV_LAYOUT.Grid16Small, label: 'Grid (16 klein)' },
    { value: MV_LAYOUT.Quad4Big, label: 'Quad (4 groß)' },
  ]
  const toggleLayout = (val: number) => {
    const set = new Set(caps.supportedLayouts)
    if (set.has(val)) set.delete(val)
    else set.add(val)
    onOverride({ ...caps, supportedLayouts: Array.from(set).sort((a, b) => a - b) })
  }
  return (
    <div className="border-t border-slate-800 bg-slate-950/40 px-3 py-1.5 text-[10px] text-slate-400">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left hover:text-slate-200"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>
          Modell-Capabilities: <span className="text-slate-300">{equipmentName}</span> ·{' '}
          {caps.mvCount} MV{caps.mvCount === 1 ? '' : 's'} ·{' '}
          {caps.supportedLayouts.length} Layouts{' '}
          {hasOverride && (
            <span className="rounded bg-amber-900/60 px-1 text-amber-200">manuell</span>
          )}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 pl-4">
          <p className="text-slate-500">
            Heuristik basierend auf dem Geräte-Namen. Falls dein Modell ein Layout unterstützt
            das die Heuristik nicht erkennt (oder umgekehrt), Häkchen hier setzen — die
            Auswahl überschreibt das Default und bleibt beim Projekt.
          </p>
          <div className="flex flex-wrap gap-1">
            {allLayouts.map((l) => {
              const on = caps.supportedLayouts.includes(l.value)
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => toggleLayout(l.value)}
                  className={`rounded px-2 py-0.5 text-[10px] ${
                    on
                      ? 'bg-sky-900 text-sky-200'
                      : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                  }`}
                  title={`${l.label} (${l.value})`}
                >
                  {on ? '☑' : '☐'} {l.label}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <span>MV-Anzahl:</span>
              <input
                type="number"
                min={0}
                max={4}
                value={caps.mvCount}
                onChange={(e) =>
                  onOverride({
                    ...caps,
                    mvCount: Math.max(0, Math.min(4, Number(e.target.value) || 0)),
                  })
                }
                className="w-12 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>Max Fenster:</span>
              <input
                type="number"
                min={0}
                max={32}
                value={caps.maxWindowsPerMv}
                onChange={(e) =>
                  onOverride({
                    ...caps,
                    maxWindowsPerMv: Math.max(0, Math.min(32, Number(e.target.value) || 0)),
                  })
                }
                className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5"
              />
            </label>
            {hasOverride && (
              <button
                type="button"
                onClick={() => onOverride(undefined)}
                className="ml-auto rounded bg-amber-900/60 px-2 py-0.5 text-amber-200 hover:bg-amber-800/70"
                title="Override entfernen — wieder Auto-Erkennung verwenden"
              >
                Override zurücksetzen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const AtemMvConfigDialog = () => {
  const slot = useUiStore((s) => s.atemMvConfig)
  const close = useUiStore((s) => s.closeAtemMvConfig)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((e) => e.id === slot.deviceId),
  )
  const updateEquipment = useProjectStore((state) => state.updateEquipment)

  const [config, setConfig] = useState<AtemMvConfig>(() =>
    makeDefaultConfig(equipment?.name ?? ''),
  )
  const [status, setStatus] = useState<string>('')
  const [connected, setConnected] = useState(false)
  // v7.9.124 — Live-ATEM-Sources (echte IDs, inkl. AUX/Color/Media-
  // Player/PGM/PVW). null wenn ATEM nicht verbunden oder Fetch failed.
  const [liveInputs, setLiveInputs] = useState<AtemInputSummary[] | null>(null)
  const [activeMv, setActiveMv] = useState(0)
  const [picker, setPicker] = useState<
    | { mvIdx: number; windowIndex: number; x: number; y: number }
    | null
  >(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const mvGridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slot.open || !equipment) return
    setStatus('')
    setPicker(null)
    // v7.9.4 — Migration auf Quadranten-Modell. Falls ein MV noch das
    // legacy windowIndex-Schema (0..9 in ATEM-Reihenfolge) hat, wird
    // er per migrateMvToQuadrants in das neue Schema (0/1/2/3 + 10-13/
    // 20-23/30-33/40-43) konvertiert UND bekommt ein `quadrants`-Feld.
    const raw = equipment.atemMvConfig ?? makeDefaultConfig(equipment.name)
    const mvs =
      Array.isArray(raw.multiViewers) && raw.multiViewers.length > 0
        ? raw.multiViewers.map((mv) => migrateMvToQuadrants({ ...mv }))
        : makeDefaultConfig(equipment.name).multiViewers
    setConfig({ multiViewers: mvs })
    setActiveMv((prev) => Math.max(0, Math.min(prev, mvs.length - 1)))
    cablePlannerApi.atem
      .getStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false))
    // v7.9.124 / Bug-2 + Bug-3 — Live-ATEM-Sources holen. Wenn der ATEM
    // verbunden ist, hat state.inputs die ECHTEN Source-IDs (inkl.
    // AUX/Color/MediaPlayer/PGM/PVW). Damit ersetzen wir das fragile
    // 'idx + 1'-Mapping aus equipment.inputs.
    cablePlannerApi.atem
      .getState()
      .then((s) => setLiveInputs(s?.inputs ?? null))
      .catch(() => setLiveInputs(null))
  }, [slot.open, equipment?.id, equipment?.atemMvConfig, equipment?.name, equipment])

  // v7.9.124 — Live-Refresh wenn der ATEM-Status sich aendert
  // (z.B. User connectet/disconnectet aus einem anderen Dialog).
  useEffect(() => {
    if (!slot.open) return
    const unsub = cablePlannerApi.atem.onEvent(() => {
      cablePlannerApi.atem
        .getState()
        .then((s) => setLiveInputs(s?.inputs ?? null))
        .catch(() => null)
    })
    return unsub
  }, [slot.open])

  /** v7.9.124 — Source-Liste mit Hierarchie:
   *  1. Wenn ATEM live verbunden ist → echte Sources aus state.inputs
   *     (echte IDs, inkl. AUX/Color/MediaPlayer/PGM/PVW).
   *  2. Sonst aus equipment.inputs[] — pro Port wird die optionale
   *     `atemSourceId` genutzt wenn der User sie manuell gesetzt hat,
   *     sonst fallback idx+1 wie bisher.
   *  Gruppierung per portType (Live) oder ID-Range (Offline). */
  const inputs = useMemo(() => {
    if (liveInputs && liveInputs.length > 0) {
      // Live-State: echte Source-IDs mit Labels. Wir benutzen longName
      // bevorzugt, falls leer → shortName, sonst 'Src N'.
      return liveInputs.map((inp) => ({
        id: inp.inputId,
        label:
          (inp.longName && inp.longName.trim()) ||
          (inp.shortName && inp.shortName.trim()) ||
          `Src ${inp.inputId}`,
        group: groupForPortType(inp.portType, inp.inputId),
      }))
    }
    // Offline-Fallback: equipment.inputs durchgehen. atemSourceId
    // ueberschreibt idx+1 wenn vom User gesetzt.
    if (!equipment || !Array.isArray(equipment.inputs)) return []
    return equipment.inputs.map((p, idx) => ({
      id: typeof p?.atemSourceId === 'number' ? p.atemSourceId : idx + 1,
      label: (p && typeof p.name === 'string' && p.name.trim()) || `Input ${idx + 1}`,
      group: typeof p?.atemSourceId === 'number'
        ? groupForPortType(undefined, p.atemSourceId)
        : 'Inputs',
    }))
  }, [equipment, liveInputs])

  if (!slot.open || !equipment) return null

  // v7.9.4 — Modell-Capabilities (Auto-Erkennung oder User-Override).
  const caps: AtemMvCapabilities = getMvCapabilities(
    equipment.name,
    equipment.atemMvCapabilitiesOverride,
  )

  const updateMv = (mvIdx: number, patch: Partial<AtemMvDefinition>) => {
    setConfig((prev) => ({
      multiViewers: prev.multiViewers.map((mv, i) =>
        i === mvIdx ? { ...mv, ...patch } : mv,
      ),
    }))
  }

  const updateWindow = (mvIdx: number, winIdx: number, sourceId: number) => {
    setConfig((prev) => ({
      multiViewers: prev.multiViewers.map((mv, i) => {
        if (i !== mvIdx) return mv
        const windows = Array.isArray(mv.windows) ? mv.windows : []
        // Ensure a window with the requested index exists - older projects
        // may have saved fewer than 10 windows so picking a source for a
        // tile that doesn't exist yet would silently do nothing.
        const hasIdx = windows.some((w) => w.windowIndex === winIdx)
        const nextWindows = hasIdx
          ? windows.map((w) => (w.windowIndex === winIdx ? { ...w, sourceId } : w))
          : [...windows, { windowIndex: winIdx, sourceId }]
        return { ...mv, windows: nextWindows }
      }),
    }))
  }

  const addMv = () => {
    setConfig((prev) => ({
      multiViewers: [...prev.multiViewers, makeMv(prev.multiViewers.length)],
    }))
    setActiveMv(config.multiViewers.length)
  }

  const removeMv = () => {
    setConfig((prev) => ({
      multiViewers: prev.multiViewers.length > 1 ? prev.multiViewers.slice(0, -1) : prev.multiViewers,
    }))
    setActiveMv((i) => {
      const newLen = config.multiViewers.length - 1
      return Math.max(0, Math.min(i, newLen - 1))
    })
  }

  const handleSave = () => {
    updateEquipment(equipment.id, { atemMvConfig: config })
    setStatus('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2500)
  }

  const handleExportPng = async () => {
    if (!mvGridRef.current) return
    try {
      const dataUrl = await toPng(mvGridRef.current, { backgroundColor: '#0f172a' })
      const a = document.createElement('a')
      a.href = dataUrl
      const safeName = (equipment.name || 'MV').replace(/[^\w.-]+/g, '_')
      a.download = `mv-layout_${safeName}_mv${activeMv + 1}.png`
      a.click()
    } catch (err) {
      console.error('PNG export failed:', err)
    }
  }

  const handleApply = async () => {
    try {
      setStatus('Übertrage an ATEM…')
      const result = await cablePlannerApi.atem.applyMvConfig(config)
      setStatus(`An ATEM übertragen (${result.applied} Fenster).`)
      updateEquipment(equipment.id, { atemMvConfig: config })
    } catch (err) {
      setStatus(`Fehler: ${(err as Error).message}`)
    }
  }

  const mv = config.multiViewers[activeMv]
  const quadrants: AtemMvQuadrants = mv
    ? getMvQuadrants(mv)
    : ['big', 'big', 'small', 'small']

  // v7.9.4 — User-Anweisung: PGM und PVW sind nur Sources (10011 / 10010),
  // KEINE speziellen Slots. Highlighting passiert in roleForSource() pro
  // Source-ID, nicht über windowIndex 0/1 wie früher.

  const toggleQuadrant = (quadIdx: 0 | 1 | 2 | 3) => {
    if (!mv) return
    const newQuadrants: AtemMvQuadrants = [...quadrants]
    newQuadrants[quadIdx] = newQuadrants[quadIdx] === 'big' ? 'small' : 'big'
    // Layout-Feld für ATEM-Übertragung wird abgeleitet (nächstbestes Match).
    const newLayout = closestAtemLayout(newQuadrants, caps)
    updateMv(activeMv, { quadrants: newQuadrants, layout: newLayout })
  }

  /** Eine große Zelle (big-Quadrant) im Haupt-Big-Window. */
  const renderBigCell = (quad: QuadDef) => {
    if (!mv) return null
    const windowIndex = mvWindowIndex(quad.idx)
    const windows = Array.isArray(mv.windows) ? mv.windows : []
    const win = windows.find((w) => w.windowIndex === windowIndex)
    const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
    const label = sourceLabel(sid, inputs)
    const bg = sourceColor(sid, label)
    const role = roleForSource(sid)
    const highlight = role === 'pgm' ? '#ef4444' : role === 'pvw' ? '#22c55e' : undefined
    return (
      <button
        type="button"
        key={`big-${quad.idx}`}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPicker({ mvIdx: activeMv, windowIndex, x: rect.right + 6, y: rect.top })
        }}
        style={{
          gridColumn: `${quad.col} / span 2`,
          gridRow: `${quad.row} / span 2`,
          background: bg,
          boxShadow: highlight ? `inset 0 0 0 3px ${highlight}` : undefined,
          color: sid === 0 ? '#cbd5e1' : '#0f172a',
        }}
        className="group relative flex flex-col items-center justify-center overflow-hidden border border-slate-900/40 text-center hover:brightness-95"
        title={`${quad.name} groß: ${label} (ID ${sid}) — klicken zum Ändern`}
      >
        {role !== 'other' && (
          <div className="absolute left-1 top-0 text-[9px] font-semibold uppercase tracking-wider opacity-70">
            {role.toUpperCase()}
          </div>
        )}
        <div className="truncate px-1 text-[11px] font-medium leading-tight">{label}</div>
        <div className="truncate px-1 text-[9px] opacity-60">ID {sid}</div>
      </button>
    )
  }

  /** Eine kleine Zelle (small-Quadrant: 4 Cells) im Haupt-Big-Window. */
  const renderSmallCell = (quad: QuadDef, cellIdx: 0 | 1 | 2 | 3) => {
    if (!mv) return null
    const windowIndex = mvWindowIndex(quad.idx, cellIdx)
    const windows = Array.isArray(mv.windows) ? mv.windows : []
    const win = windows.find((w) => w.windowIndex === windowIndex)
    const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
    const label = sourceLabel(sid, inputs)
    const bg = sourceColor(sid, label)
    const role = roleForSource(sid)
    const highlight = role === 'pgm' ? '#ef4444' : role === 'pvw' ? '#22c55e' : undefined
    const subCol = quad.col + (cellIdx % 2)
    const subRow = quad.row + Math.floor(cellIdx / 2)
    return (
      <button
        type="button"
        key={`small-${quad.idx}-${cellIdx}`}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPicker({ mvIdx: activeMv, windowIndex, x: rect.right + 6, y: rect.top })
        }}
        style={{
          gridColumn: `${subCol} / span 1`,
          gridRow: `${subRow} / span 1`,
          background: bg,
          boxShadow: highlight ? `inset 0 0 0 2px ${highlight}` : undefined,
          color: sid === 0 ? '#cbd5e1' : '#0f172a',
        }}
        className="group relative flex flex-col items-center justify-center overflow-hidden border border-slate-900/40 text-center hover:brightness-95"
        title={`${quad.name} klein #${cellIdx + 1}: ${label} (ID ${sid}) — klicken zum Ändern`}
      >
        <div className="truncate px-1 text-[10px] font-medium leading-tight">{label}</div>
        <div className="truncate px-1 text-[8px] opacity-60">{sid}</div>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={close}
    >
      <div
        className="flex max-h-[95vh] w-[960px] flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Multiviewer-Layout · {equipment.name}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
          >
            Schließen
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-slate-800 px-3 py-2">
          {config.multiViewers.map((mvItem, i) => (
            <button
              key={mvItem.index}
              type="button"
              onClick={() => setActiveMv(i)}
              className={`rounded px-3 py-1 text-xs ${
                i === activeMv
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              MV {i + 1}
            </button>
          ))}
          <div className="ml-2 flex gap-1">
            <button
              type="button"
              onClick={addMv}
              disabled={config.multiViewers.length >= 4}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-40"
              title="Multiviewer hinzufügen"
            >
              +
            </button>
            <button
              type="button"
              onClick={removeMv}
              disabled={config.multiViewers.length <= 1}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600 disabled:opacity-40"
              title="Letzten Multiviewer entfernen"
            >
              −
            </button>
          </div>
          <span className="ml-auto text-[10px] text-slate-500">
            {config.multiViewers.length} MV — Klick auf ein Fenster ändert die Quelle.
          </span>
        </div>

        {/* v7.9.4 — Ein einziger Layout-Picker. User-Request:
            "Es soll von dem kleinen Layout-Picker oben nur einen
            geben. Wenn ich ein Feld mit 4 kleinen Feldern anklicke
            soll es ein großes Feld werden und wenn ich ein großes
            Feld anklicke sollen es 4 kleine Felder werden."

            Steht außerhalb von mvGridRef → PNG-Export bleibt clean. */}
        {mv && (
          <div className="flex flex-wrap items-center gap-4 border-b border-slate-800 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-300">Layout</span>
              <MvLayoutPicker
                quadrants={quadrants}
                windows={Array.isArray(mv.windows) ? mv.windows : []}
                inputs={inputs}
                onToggleQuadrant={toggleQuadrant}
              />
              <span className="text-[10px] text-slate-500">
                Klick auf einen Quadranten:<br />
                groß ↔ 4 kleine
              </span>
            </div>
          </div>
        )}

        {/* v7.9.4 — Big-Window: rendert je Quadrant entweder 1 großes
            Feld oder 4 kleine (entsprechend `quadrants`). Klick auf
            jede Zelle öffnet den Source-Picker. PGM/PVW sind keine
            Slots — nur Source-IDs 10011/10010 die im Picker gewählt
            werden und dann rot/grün umrandet werden. */}
        <div ref={mvGridRef} className="flex-1 overflow-auto p-4">
          {mv && (
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <div
                className="absolute inset-0 grid gap-[2px] rounded border border-slate-700 bg-slate-950 p-1"
                style={{
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(4, 1fr)',
                }}
              >
                {QUADRANTS.map((q) =>
                  quadrants[q.idx] === 'big'
                    ? renderBigCell(q)
                    : ([0, 1, 2, 3] as const).map((ci) => renderSmallCell(q, ci)),
                )}
              </div>
            </div>
          )}
        </div>

        {/* v7.9.4 — Modell-Capabilities anzeigen + Override. User-Request:
            "muss man händisch aber anpassen können". */}
        <CapabilitiesPanel
          equipmentName={equipment.name}
          caps={caps}
          hasOverride={!!equipment.atemMvCapabilitiesOverride}
          onOverride={(next) =>
            updateEquipment(equipment.id, { atemMvCapabilitiesOverride: next })
          }
        />

        <div className="flex items-center justify-between border-t border-slate-700 px-4 py-2">
          <span className="text-[11px] text-slate-400">
            {savedFlash ? (
              <span className="font-semibold text-emerald-400">✓ Gespeichert</span>
            ) : (
              status || (connected ? 'ATEM verbunden — direkt übertragbar.' : 'ATEM nicht verbunden.')
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleExportPng()}
              className="rounded bg-indigo-700 px-3 py-1 text-xs hover:bg-indigo-600"
              title="Aktuelles MV-Layout als PNG speichern"
            >
              Als PNG
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              Zwischenspeichern
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!connected}
              className="rounded bg-emerald-700 px-3 py-1 text-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                connected
                  ? 'Konfiguration an ATEM übertragen'
                  : 'ATEM nicht verbunden — erst im ATEM-Dialog verbinden.'
              }
            >
              An ATEM übertragen
            </button>
          </div>
        </div>
      </div>

      {picker && (
        <SourcePicker
          currentId={(() => {
            const mv = config.multiViewers[picker.mvIdx]
            const windows = Array.isArray(mv?.windows) ? mv!.windows : []
            const win = windows.find((w) => w.windowIndex === picker.windowIndex)
            return typeof win?.sourceId === 'number' ? win.sourceId : 0
          })()}
          inputs={inputs}
          hasLiveState={!!(liveInputs && liveInputs.length > 0)}
          anchor={{ x: picker.x, y: picker.y }}
          onPick={(id) => {
            updateWindow(picker.mvIdx, picker.windowIndex, id)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
