import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Download, Square, SquareCheck, Monitor } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { cablePlannerApi, type AtemInputSummary } from '../../lib/bridge'
import { confirmDialog } from '../../lib/confirmDialog'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { detectDeviceKind } from '../../lib/deviceKind'
import { useTranslation, format } from '../../lib/i18n'
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
  canvasPortNames,
}: {
  quad: QuadDef
  state: 'big' | 'small'
  windows: { windowIndex: number; sourceId: number }[]
  inputs: { id: number; label: string }[]
  cellSize: number
  fontBig: number
  fontIdBig: number
  canvasPortNames?: Map<number, string>
}) => {
  const renderBig = () => {
    const wi = mvWindowIndex(quad.idx)
    const win = windows.find((w) => w.windowIndex === wi)
    const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
    const label = resolveSourceLabel(sid, inputs, canvasPortNames)
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
      const label = resolveSourceLabel(sid, inputs, canvasPortNames)
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
  canvasPortNames,
}: {
  quadrants: AtemMvQuadrants
  windows: { windowIndex: number; sourceId: number }[]
  inputs: { id: number; label: string }[]
  onToggleQuadrant: (quadIdx: 0 | 1 | 2 | 3) => void
  canvasPortNames?: Map<number, string>
}) => {
  const t = useTranslation()
  // #448 — feste 240px waren bei 320px Viewport 75% der Breite; jetzt
  // flexibel (min aus 240px und 70vw), Seitenverhältnis bleibt 16:9.
  return (
    <div className="relative" style={{ width: 'min(240px, 70vw)', aspectRatio: '16 / 9' }}>
      <div
        className="absolute inset-0 grid gap-[2px] rounded border border-cp-border bg-cp-surface-3 p-[2px]"
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
            canvasPortNames={canvasPortNames}
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
              ? format(t('atem.mv.quadBigTitle', '{name}: aktuell 1 großes Fenster — Klick: in 4 kleine teilen'), { name: q.name })
              : format(t('atem.mv.quadSmallTitle', '{name}: aktuell 4 kleine Fenster — Klick: zu 1 großem zusammenfassen'), { name: q.name })
          }
          aria-label={format(t('atem.mv.quadToggleAria', 'Quadrant {name} umschalten'), { name: q.name })}
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
  // v7.9.126 — AUX 1–24 (Constellation 8K hat bis zu 24 AUXes).
  // Wenn der ATEM live verbunden ist gewinnt die echte liveInputs-
  // Liste, sonst dienen diese als Offline-Default.
  ...Array.from({ length: 24 }, (_, i) => ({
    id: 8001 + i,
    label: `AUX ${i + 1}`,
    group: 'AUX',
  })),
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

/**
 * v7.9.126 — Single Source of Truth fuer das Beschriften einer
 * ATEM-Source-ID. Wird ueberall benutzt: SourcePicker-Liste, MV-Cell-
 * Rendering, MvLayoutPicker-Vorschau. Drei Quellen werden zusammengefuehrt:
 *
 * 1. `DEFAULT_SOURCES` — die kanonische ATEM-Beschriftung
 *    ("AUX 5", "ME 1 Program", "Color 1", "Media Player 1", …).
 * 2. `inputs` — vom Caller gebuendelte Live-ATEM- oder
 *    equipment.inputs/outputs-Labels (Live-Mode: echte ATEM-Namen;
 *    Offline: User-Port-Namen).
 * 3. `canvasPortNames` — Map aus equipment.inputs/outputs.atemSourceId
 *    -> port.name. Greift fuer alle Ports im Canvas die der User mit
 *    eigenem Namen + atemSourceId versehen hat.
 *
 * Reihenfolge im finalen Label: DEFAULT_SOURCES · inputs · canvasPortNames
 * (nur einzigartige, case-insensitive-distinct Teile). Beispiele:
 * - Offline, AUX 8005 mit Canvas-Name "Stage Monitor"
 *     -> "AUX 5 · Stage Monitor"
 * - Online, ATEM meldet "AUX 5" (identisch zu Default)
 *     -> "AUX 5"
 * - Online, ATEM meldet "Live AUX 5"
 *     -> "AUX 5 · Live AUX 5"
 * - Input port id=1, name "Camera 1", kein AUX-Kontext
 *     -> "Camera 1"
 */
const resolveSourceLabel = (
  sourceId: number,
  inputs: { id: number; label: string }[],
  canvasPortNames?: Map<number, string>,
): string => {
  if (sourceId === 0) return '—'
  const fromDefault = DEFAULT_SOURCES.find((s) => s.id === sourceId)?.label
  const fromInputs = inputs.find((i) => i.id === sourceId)?.label
  const fromCanvas = canvasPortNames?.get(sourceId)
  const parts: string[] = []
  const pushIfNew = (s: string | undefined) => {
    if (!s) return
    const t = s.trim()
    if (!t) return
    if (parts.some((p) => p.toLowerCase() === t.toLowerCase())) return
    parts.push(t)
  }
  pushIfNew(fromDefault)
  pushIfNew(fromInputs)
  pushIfNew(fromCanvas)
  if (parts.length > 0) return parts.join(' · ')
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
  /** v7.9.126 — Map<Source-ID, Canvas-Port-Name>. Wenn ein Eintrag
   *  in der finalen Liste eine ID hat fuer die hier ein Name steht,
   *  wird das Label um " · <Name>" erweitert. So sieht der User
   *  z.B. "AUX 5 · Stage Monitor" statt nur "AUX 5". Wirkt sowohl
   *  online als auch offline. */
  canvasPortNames?: Map<number, string>
}

const SourcePicker = ({
  currentId,
  inputs,
  onPick,
  onClose,
  anchor,
  hasLiveState,
  canvasPortNames,
}: SourcePickerProps) => {
  const t = useTranslation()
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
    // v7.9.126 — Kandidaten-IDs sammeln (inputs + DEFAULT_SOURCES wenn
    // offline), Gruppen merken, und das finale Label fuer jede ID per
    // gemeinsamem resolveSourceLabel-Helper berechnen. Damit lebt die
    // Label-Logik genau an einer Stelle und macht's nicht doppelt:
    // Picker, MV-Cells und Mini-Vorschau zeigen dasselbe.
    const groupById = new Map<number, string>()
    for (const i of inputs) if (!groupById.has(i.id)) groupById.set(i.id, i.group ?? 'Inputs')
    if (!hasLiveState) {
      for (const d of DEFAULT_SOURCES) if (!groupById.has(d.id)) groupById.set(d.id, d.group)
    }
    const labeled = Array.from(groupById.entries()).map(([id, group]) => ({
      id,
      group,
      label: resolveSourceLabel(id, inputs, canvasPortNames),
    }))
    if (!filter.trim()) return labeled
    const q = filter.toLowerCase()
    return labeled.filter(
      (s) => s.label.toLowerCase().includes(q) || String(s.id).includes(q),
    )
  }, [inputs, filter, hasLiveState, canvasPortNames])

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
      className="fixed z-[60] max-h-[60vh] w-64 overflow-auto rounded border border-cp-surface-5 bg-cp-surface-1 shadow-2xl"
      style={{
        left: Math.min(anchor.x, window.innerWidth - 280),
        top: Math.min(anchor.y, window.innerHeight - 400),
      }}
    >
      <div className="sticky top-0 z-10 border-b border-cp-border bg-cp-surface-1 p-2">
        <input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('common.search', 'Suche…')}
          aria-label={t('common.search', 'Suche…')}
          className="mb-1 w-full rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs"
        />
        <div className="flex gap-1">
          <input
            type="number"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder={t('atem.mv.idPlaceholder', 'ID')}
            className="w-20 rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs"
          />
          <button
            type="button"
            onClick={() => {
              const n = Number(custom)
              if (!Number.isNaN(n)) onPick(n)
            }}
            className="flex-1 rounded bg-emerald-700 px-2 py-1 text-cp-xs hover:bg-emerald-600"
          >
            {t('common.apply', 'Übernehmen')}
          </button>
        </div>
      </div>
      <div className="p-1 text-cp-xs">
        {grouped.map(([group, items]) => (
          <div key={group} className="mb-1">
            <div className="px-1 py-0.5 text-[10px] uppercase tracking-wider text-cp-text-muted">
              {group}
            </div>
            {items.map((item) => (
              <button
                key={`${group}-${item.id}`}
                type="button"
                onClick={() => onPick(item.id)}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-cp-surface-2 ${
                  item.id === currentId ? 'bg-cp-surface-4 text-emerald-300' : 'text-cp-text-bright'
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="ml-2 text-[10px] text-cp-text-muted">{item.id}</span>
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
  const t = useTranslation()
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
    { value: MV_LAYOUT.Grid16Small, label: t('atem.mv.layout.grid16Small', 'Grid (16 klein)') },
    { value: MV_LAYOUT.Quad4Big, label: t('atem.mv.layout.quad4Big', 'Quad (4 groß)') },
  ]
  const toggleLayout = (val: number) => {
    const set = new Set(caps.supportedLayouts)
    if (set.has(val)) set.delete(val)
    else set.add(val)
    onOverride({ ...caps, supportedLayouts: Array.from(set).sort((a, b) => a - b) })
  }
  return (
    <div className="border-t border-cp-border-muted bg-cp-surface-3/40 px-3 py-1.5 text-[10px] text-cp-text-muted">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left hover:text-cp-text-bright"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>
          {t('atem.mv.capabilities', 'Modell-Capabilities:')} <span className="text-cp-text-secondary">{equipmentName}</span> ·{' '}
          {caps.mvCount} MV{caps.mvCount === 1 ? '' : 's'} ·{' '}
          {format(t('atem.mv.layoutsCount', '{n} Layouts'), { n: caps.supportedLayouts.length })}{' '}
          {hasOverride && (
            <span className="rounded bg-amber-900/60 px-1 text-amber-200">{t('atem.mv.manual', 'manuell')}</span>
          )}
        </span>
      </button>
      {open && (
        <div className="mt-1 space-y-1.5 pl-4">
          <p className="text-cp-text-faint">
            {t(
              'atem.mv.layoutsHint',
              'Heuristik basierend auf dem Geräte-Namen. Falls dein Modell ein Layout unterstützt das die Heuristik nicht erkennt (oder umgekehrt), Häkchen hier setzen — die Auswahl überschreibt das Default und bleibt beim Projekt.',
            )}
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
                      : 'bg-cp-surface-2 text-cp-text-faint hover:bg-cp-surface-4'
                  }`}
                  title={`${l.label} (${l.value})`}
                >
                  <span className="inline-flex items-center gap-1"><Icon icon={on ? SquareCheck : Square} size="xs" /> {l.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              <span>{t('atem.mv.mvCount', 'MV-Anzahl:')}</span>
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
                className="w-12 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <span>{t('atem.mv.maxWindows', 'Max Fenster:')}</span>
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
                className="w-14 rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5"
              />
            </label>
            {hasOverride && (
              <button
                type="button"
                onClick={() => onOverride(undefined)}
                className="ml-auto rounded bg-amber-900/60 px-2 py-0.5 text-amber-200 hover:bg-amber-800/70"
                title={t('atem.mv.removeOverride', 'Override entfernen — wieder Auto-Erkennung verwenden')}
              >
                {t('atem.mv.resetOverride', 'Override zurücksetzen')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * #402 — Geräte-Picker, wenn der MV-Editor ohne vorausgewähltes Gerät
 * geöffnet wird (Werkzeuge → ATEM Multiviewer). Listet alle ATEM-Mischer
 * des Plans; Auswahl öffnet den Editor mit diesem Gerät. So ist der
 * Multiviewer auch ohne Canvas-Selektion direkt erreichbar.
 */
const AtemMvDevicePicker = () => {
  const t = useTranslation()
  const close = useUiStore((s) => s.closeAtemMvConfig)
  const openAtemMvConfig = useUiStore((s) => s.openAtemMvConfig)
  const equipment = useProjectStore((s) => s.project.equipment)
  const atemDevices = useMemo(
    () => equipment.filter((e) => detectDeviceKind(e) === 'atem' || !!e.atemMvConfig),
    [equipment],
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div
        className="flex max-h-[80vh] w-[440px] max-w-[95vw] flex-col rounded-cp-card border border-cp-border bg-cp-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2">
          <h2 className="flex items-center gap-2 text-cp-base font-semibold text-cp-text-bright">
            <Icon icon={Monitor} size="sm" />
            {t('atemMv.picker.title', 'ATEM Multiviewer — Gerät wählen')}
          </h2>
          <button
            onClick={close}
            className="text-cp-text-muted hover:text-cp-text-bright"
            aria-label={t('common.close', 'Schließen')}
          >
            ×
          </button>
        </div>
        <div className="overflow-auto p-4 text-cp-base">
          {atemDevices.length === 0 ? (
            <p className="text-cp-text-muted">
              {t(
                'atemMv.picker.empty',
                'Kein ATEM-Mischer im Plan. Lege zuerst einen ATEM aus der Bibliothek an — danach ist hier seine Multiviewer-Konfiguration wählbar.',
              )}
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-cp-text-muted">
                {t('atemMv.picker.intro', 'Welchen ATEM-Mischer-Multiviewer möchtest du konfigurieren?')}
              </p>
              <ul className="space-y-1">
                {atemDevices.map((e) => (
                  <li key={e.id}>
                    <button
                      onClick={() => openAtemMvConfig(e.id)}
                      className="flex w-full items-center gap-2 rounded border border-cp-border bg-cp-surface-2 px-3 py-2 text-left text-cp-text hover:bg-cp-surface-4"
                    >
                      <Icon icon={Monitor} size="sm" />
                      {e.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export const AtemMvConfigDialog = () => {
  const t = useTranslation()
  const slot = useUiStore((s) => s.atemMvConfig)
  const close = useUiStore((s) => s.closeAtemMvConfig)
  const equipment = useProjectStore((state) =>
    getEquipmentById(state.project.equipment, slot.deviceId),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft beim Dialog-Öffnen seeden/zurücksetzen (keyed sync)
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
    // Offline-Fallback: equipment.inputs UND equipment.outputs durchgehen.
    // - Inputs: atemSourceId ueberschreibt idx+1 wenn vom User gesetzt.
    // - Outputs (v7.9.126 / Bug-3 offline): nur wenn atemSourceId
    //   explizit gesetzt — fuer AUX/PGM/PVW kann CP die Source-ID nicht
    //   raten. User muss sie in den Port-Eigenschaften eintragen
    //   (Properties-Panel → Outputs → "ATEM Source-ID").
    if (!equipment || !Array.isArray(equipment.inputs)) return []
    const fromInputs = equipment.inputs.map((p, idx) => ({
      id: typeof p?.atemSourceId === 'number' ? p.atemSourceId : idx + 1,
      label: (p && typeof p.name === 'string' && p.name.trim()) || `Input ${idx + 1}`,
      group: typeof p?.atemSourceId === 'number'
        ? groupForPortType(undefined, p.atemSourceId)
        : 'Inputs',
    }))
    const fromOutputs = (Array.isArray(equipment.outputs) ? equipment.outputs : [])
      .filter((p) => typeof p?.atemSourceId === 'number')
      .map((p) => ({
        id: p.atemSourceId as number,
        label: (p && typeof p.name === 'string' && p.name.trim()) || `Output (ID ${p.atemSourceId})`,
        group: groupForPortType(undefined, p.atemSourceId as number),
      }))
    return [...fromInputs, ...fromOutputs]
  }, [equipment, liveInputs])

  // v7.9.126 — Wenn der User in den Equipment-Properties einen AUX-
  // Output (atemSourceId=8001+) o.ae. mit einem eigenen Namen
  // versehen hat (z.B. "Stage Monitor"), kleben wir den hier
  // hinter das generische "AUX 5"-Label im SourcePicker dran.
  // Greift auch online — wenn der ATEM eine eigene Bezeichnung
  // meldet UND der Canvas eine, sieht der User beides als " · "-
  // Liste. Live-Label kommt aus liveInputs, Canvas-Name aus diesem
  // Map; SourcePicker macht den Merge.
  const canvasPortNames = useMemo(() => {
    const m = new Map<number, string>()
    if (!equipment) return m
    for (const p of [
      ...(Array.isArray(equipment.inputs) ? equipment.inputs : []),
      ...(Array.isArray(equipment.outputs) ? equipment.outputs : []),
    ]) {
      if (
        typeof p?.atemSourceId === 'number' &&
        typeof p?.name === 'string' &&
        p.name.trim()
      ) {
        m.set(p.atemSourceId, p.name.trim())
      }
    }
    return m
  }, [equipment])

  if (!slot.open) return null
  // #402 — Ohne vorausgewähltes Gerät (Werkzeuge-Menü) zuerst den Picker.
  if (!equipment) return <AtemMvDevicePicker />

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
    // #249 — html-to-image schlägt beim ERSTEN Aufruf gelegentlich fehl oder
    // liefert ein leeres/partielles Bild, weil Style-/Font-Embedding noch nicht
    // „warm" ist (v. a. unter Electron). Robust: bis zu 3 Versuche mit kurzer
    // Pause; Erfolg/Fehler sichtbar als Status statt nur in der Konsole.
    const opts = { backgroundColor: '#0f172a', cacheBust: true, pixelRatio: 2 } as const
    setStatus(t('atem.mv.status.pngBusy', 'Exportiere PNG …'))
    let dataUrl = ''
    let lastErr: unknown = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        dataUrl = await toPng(mvGridRef.current, opts)
        if (dataUrl && dataUrl.length > 1000) break
      } catch (e) {
        lastErr = e
      }
      await new Promise((r) => setTimeout(r, 150))
    }
    if (!dataUrl || dataUrl.length <= 1000) {
      console.error('PNG export failed:', lastErr)
      setStatus(t('atem.mv.status.pngFail', 'PNG-Export fehlgeschlagen — bitte erneut versuchen.'))
      return
    }
    const a = document.createElement('a')
    a.href = dataUrl
    const safeName = (equipment.name || 'MV').replace(/[^\w.-]+/g, '_')
    a.download = `mv-layout_${safeName}_mv${activeMv + 1}.png`
    a.click()
    setStatus(t('atem.mv.status.pngOk', 'MV-Layout als PNG exportiert.'))
  }

  const handleApply = async () => {
    try {
      setStatus(t('atem.mv.status.transmitting', 'Übertrage an ATEM…'))
      const result = await cablePlannerApi.atem.applyMvConfig(config)
      setStatus(
        format(t('atem.mv.status.transmitted', 'An ATEM übertragen ({n} Fenster).'), {
          n: result.applied,
        }),
      )
      updateEquipment(equipment.id, { atemMvConfig: config })
    } catch (err) {
      setStatus(
        format(t('atem.mv.status.error', 'Fehler: {msg}'), { msg: (err as Error).message }),
      )
    }
  }

  /**
   * #288 — MV-Setup vom verbundenen ATEM lesen und in die lokale Konfig
   * uebernehmen. Holt sich die Daten via atem:read-mv-config (Main-Process
   * macht das Window-Index-Mapping ATEM → CP fuer uns) und ueberschreibt
   * `config` nach Bestaetigung.
   */
  const handleReadFromAtem = async () => {
    try {
      setStatus(t('atem.mv.status.reading', 'Lese vom ATEM …'))
      const result = await cablePlannerApi.atem.readMvConfig()
      const incoming = result.multiViewers
      if (!incoming || incoming.length === 0) {
        setStatus(t('atem.mv.status.empty', 'ATEM hat keine MV-Konfiguration geliefert.'))
        return
      }
      const totalWindows = incoming.reduce((s, m) => s + m.windows.length, 0)
      // Confirm bei nicht-leerer Bestands-Config damit der User nicht
      // versehentlich seine offline geplante MV-Anordnung verliert.
      const hasLocalData = config.multiViewers.some((mv) => (mv.windows ?? []).some((w) => w.sourceId !== 0))
      if (hasLocalData) {
        const ok = await confirmDialog(
          format(
            t(
              'atem.mv.confirmOverwrite',
              'Aktuelle MV-Konfiguration ({local} MV) mit ATEM-Live-Stand überschreiben? Vom ATEM: {incoming} MV mit {windows} Fenster-Zuweisungen.',
            ),
            {
              local: config.multiViewers.length,
              incoming: incoming.length,
              windows: totalWindows,
            },
          ),
        )
        if (!ok) {
          setStatus(t('atem.mv.status.cancelled', 'Übernahme abgebrochen.'))
          return
        }
      }
      // Lokale Quadranten-Defaults sicherstellen wenn der ATEM nur Layout +
      // Windows liefert (kein quadrants-Field aus Hardware). `closestAtemLayout`
      // wird beim Senden zurueck berechnet — fuer die Anzeige reicht ein
      // Standard-Quadranten-Tupel das zum Layout passt; wir lassen das aktuell
      // weg und vertrauen dem getMvQuadrants()-Helper.
      setConfig({
        multiViewers: incoming.map((mv) => ({
          index: mv.index,
          layout: mv.layout,
          programPreviewSwapped: mv.programPreviewSwapped,
          windows: mv.windows,
        })),
      })
      setStatus(
        format(t('atem.mv.status.loaded', 'Vom ATEM geladen: {mv} MV, {windows} Fenster.'), {
          mv: incoming.length,
          windows: totalWindows,
        }),
      )
    } catch (err) {
      setStatus(
        format(t('atem.mv.status.error', 'Fehler: {msg}'), { msg: (err as Error).message }),
      )
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
    const label = resolveSourceLabel(sid, inputs, canvasPortNames)
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
        className="group relative flex flex-col items-center justify-center overflow-hidden border border-cp-surface-1/40 text-center hover:brightness-95"
        title={`${quad.name} groß: ${label} (ID ${sid}) — klicken zum Ändern`}
      >
        {role !== 'other' && (
          <div className="absolute left-1 top-0 text-[11px] font-semibold uppercase tracking-wider opacity-70">
            {role.toUpperCase()}
          </div>
        )}
        <div className="truncate px-1 text-[11px] font-medium leading-tight">{label}</div>
        <div className="truncate px-1 text-[11px] opacity-60">ID {sid}</div>
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
    const label = resolveSourceLabel(sid, inputs, canvasPortNames)
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
        className="group relative flex flex-col items-center justify-center overflow-hidden border border-cp-surface-1/40 text-center hover:brightness-95"
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
        className="flex max-h-[95vh] w-[960px] max-w-[95vw] flex-col rounded-cp-card border border-cp-border bg-cp-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cp-border px-4 py-2">
          <h2 className="text-cp-base font-semibold text-cp-text">
            {format(t('atem.mv.dialogTitle', 'Multiviewer-Layout · {name}'), { name: equipment.name })}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs hover:bg-cp-surface-4"
          >
            {t('common.close', 'Schließen')}
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-cp-border-muted px-3 py-2">
          {config.multiViewers.map((mvItem, i) => (
            <button
              key={mvItem.index}
              type="button"
              onClick={() => setActiveMv(i)}
              className={`rounded px-3 py-1 text-cp-xs ${
                i === activeMv
                  ? 'bg-sky-700 text-white'
                  : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
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
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
              title={t('atem.mv.addMv', 'Multiviewer hinzufügen')}
            >
              +
            </button>
            <button
              type="button"
              onClick={removeMv}
              disabled={config.multiViewers.length <= 1}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
              title={t('atem.mv.removeMv', 'Letzten Multiviewer entfernen')}
            >
              −
            </button>
          </div>
          <span className="ml-auto text-[10px] text-cp-text-muted">
            {format(t('atem.mv.windowHint', '{n} MV — Klick auf ein Fenster ändert die Quelle.'), { n: config.multiViewers.length })}
          </span>
        </div>

        {/* v7.9.4 — Ein einziger Layout-Picker. User-Request:
            "Es soll von dem kleinen Layout-Picker oben nur einen
            geben. Wenn ich ein Feld mit 4 kleinen Feldern anklicke
            soll es ein großes Feld werden und wenn ich ein großes
            Feld anklicke sollen es 4 kleine Felder werden."

            Steht außerhalb von mvGridRef → PNG-Export bleibt clean. */}
        {mv && (
          <div className="flex flex-wrap items-center gap-4 border-b border-cp-border-muted px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-cp-text-secondary">{t('atem.mv.layoutLabel', 'Layout')}</span>
              <MvLayoutPicker
                quadrants={quadrants}
                windows={Array.isArray(mv.windows) ? mv.windows : []}
                inputs={inputs}
                onToggleQuadrant={toggleQuadrant}
                canvasPortNames={canvasPortNames}
              />
              <span className="text-[10px] text-cp-text-muted">
                {t('atem.mv.quadrantHint1', 'Klick auf einen Quadranten:')}<br />
                {t('atem.mv.quadrantHint2', 'groß ↔ 4 kleine')}
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
                className="absolute inset-0 grid gap-[2px] rounded border border-cp-border bg-cp-surface-3 p-1"
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

        <div className="flex items-center justify-between border-t border-cp-border px-4 py-2">
          <span className="text-[11px] text-cp-text-muted">
            {savedFlash ? (
              <span className="font-semibold text-emerald-400">✓ {t('atem.mv.saved', 'Gespeichert')}</span>
            ) : (
              status ||
              (connected
                ? t('atem.mv.connectedReady', 'ATEM verbunden — direkt übertragbar.')
                : t('atem.mv.notConnected', 'ATEM nicht verbunden.'))
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleExportPng()}
              className="rounded bg-indigo-700 px-3 py-1 text-cp-xs hover:bg-indigo-600"
              title={t('atem.mv.savePng', 'Aktuelles MV-Layout als PNG speichern')}
            >
              {t('atem.mv.asPng', 'Als PNG')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('atem.mv.saveDraft', 'Zwischenspeichern')}
            </button>
            {/* #288 — Live-MV-Setup vom ATEM holen. */}
            <button
              type="button"
              onClick={() => void handleReadFromAtem()}
              disabled={!connected}
              className="rounded bg-sky-700 px-3 py-1 text-cp-xs enabled:hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                connected
                  ? t('atem.mv.readFromTitle', 'Multiviewer-Setup vom verbundenen ATEM auslesen und in die Anzeige uebernehmen.')
                  : t('atem.mv.notConnectedTitle', 'ATEM nicht verbunden — erst im ATEM-Dialog verbinden.')
              }
            >
              <Icon icon={Download} size="xs" className="mr-1 inline-block align-text-bottom" />{t('atem.mv.readFromBtn', 'Vom ATEM laden')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!connected}
              className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                connected
                  ? t('atem.mv.applyTitle', 'Konfiguration an ATEM übertragen')
                  : t('atem.mv.notConnectedTitle', 'ATEM nicht verbunden — erst im ATEM-Dialog verbinden.')
              }
            >
              {t('atem.mv.applyBtn', 'An ATEM übertragen')}
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
          canvasPortNames={canvasPortNames}
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
