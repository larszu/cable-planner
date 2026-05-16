import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { cablePlannerApi } from '../../lib/bridge'
import type { AtemMvConfig, AtemMvDefinition } from '../../types/equipment'
import {
  MV_LAYOUT_OPTIONS,
  defaultMvCount,
  getMvGridSpec,
} from '../../lib/atemMvLayout'

/** v7.9.4 — Ersetzt den alten abstrakten MvLayoutThumb. Statt
 *  einfacher farbiger Rechtecke rendert dieses Preview die echte
 *  Layout-Struktur mit den aktuellen Quellen-Labels und IDs — sieht
 *  aus wie eine Mini-Version des Big-Windows, damit der User die
 *  Layouts an ihren tatsächlichen Inhalten erkennt (User-Request:
 *  "ersetze diese durch eine die so funktioniert wie das große
 *  fenster. Das wo die IDs bei stehen").
 *
 *  Wichtig: der Preview SOLL klein bleiben (kein Source-Picker, kein
 *  Anklicken einzelner Zellen) — er ist nur ein Layout-Button. Die
 *  Klick-Action ist immer "dieses Layout aktivieren". Die
 *  Quellenauswahl passiert ausschließlich im Big-Window. */
const MvLayoutPreview = ({
  layoutId,
  active,
  windows,
  pgmIndex,
  prvIndex,
  inputs,
}: {
  layoutId: number
  active: boolean
  windows: { windowIndex: number; sourceId: number }[]
  pgmIndex: number
  prvIndex: number
  inputs: { id: number; label: string }[]
}) => {
  const spec = getMvGridSpec(layoutId)
  // 16:9 mini preview — 96x54 ist klein genug für die Picker-Zeile,
  // groß genug damit ID-Text in den Big-Cells lesbar bleibt.
  const W = 112
  const H = 63
  return (
    <div
      className="relative shrink-0"
      style={{ width: W, height: H, background: '#0f172a' }}
    >
      <div
        className="absolute inset-0 grid gap-[1px] p-[1px]"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)' }}
      >
        {spec.big.map((big) => {
          const win = windows.find((w) => w.windowIndex === big.window)
          const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
          const label = sourceLabel(sid, inputs)
          const bg = sourceColor(sid, label)
          const role = big.window === pgmIndex ? 'pgm' : big.window === prvIndex ? 'prv' : 'small'
          const highlight = role === 'pgm' ? '#ef4444' : role === 'prv' ? '#22c55e' : undefined
          return (
            <div
              key={`big-${big.window}`}
              className="flex flex-col items-center justify-center overflow-hidden text-center"
              style={{
                gridColumn: `${big.colStart} / span ${big.colSpan}`,
                gridRow: `${big.rowStart} / span ${big.rowSpan}`,
                background: bg,
                color: sid === 0 ? '#cbd5e1' : '#0f172a',
                boxShadow: highlight ? `inset 0 0 0 1px ${highlight}` : undefined,
                fontSize: 6,
                lineHeight: 1.1,
              }}
            >
              <span className="truncate px-0.5" style={{ maxWidth: '100%', fontWeight: 600 }}>
                {label}
              </span>
              <span className="opacity-70">{sid}</span>
            </div>
          )
        })}
        {spec.small.map((cell, smallIdx) => {
          const wi = smallIdx + 2
          const win = windows.find((w) => w.windowIndex === wi)
          const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
          const label = sourceLabel(sid, inputs)
          const bg = sourceColor(sid, label)
          return (
            <div
              key={`small-${wi}`}
              className="overflow-hidden"
              style={{
                gridColumn: `${cell.colStart} / span 1`,
                gridRow: `${cell.rowStart} / span 1`,
                background: bg,
                fontSize: 5,
                lineHeight: 1,
                color: sid === 0 ? '#94a3b8' : '#0f172a',
              }}
              title={`${label} (ID ${sid})`}
            />
          )
        })}
      </div>
      {/* Aktiv-Rahmen */}
      <div
        className="pointer-events-none absolute inset-0 rounded transition-colors"
        style={{
          boxShadow: active
            ? 'inset 0 0 0 2px #0ea5e9'
            : 'inset 0 0 0 1px #334155',
        }}
      />
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

const makeMv = (index: number): AtemMvDefinition => ({
  index,
  layout: 0,
  programPreviewSwapped: false,
  windows: Array.from({ length: 10 }, (_, i) => ({
    windowIndex: i,
    sourceId: i === 0 ? 10011 : i === 1 ? 10010 : 0,
  })),
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
  inputs: { id: number; label: string }[]
  onPick: (id: number) => void
  onClose: () => void
  anchor: { x: number; y: number }
}

const SourcePicker = ({ currentId, inputs, onPick, onClose, anchor }: SourcePickerProps) => {
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
    const combined = [
      ...inputs.map((i) => ({ id: i.id, label: i.label, group: 'Inputs' })),
      ...DEFAULT_SOURCES,
    ]
    if (!filter.trim()) return combined
    const q = filter.toLowerCase()
    return combined.filter(
      (s) => s.label.toLowerCase().includes(q) || String(s.id).includes(q),
    )
  }, [inputs, filter])

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
    // Load config or build default; normalise each MV so windows always has
    // exactly 10 entries (older saves may have fewer).
    const raw = equipment.atemMvConfig ?? makeDefaultConfig(equipment.name)
    const mvs = Array.isArray(raw.multiViewers) && raw.multiViewers.length > 0
      ? raw.multiViewers.map((mv) => {
          const existingWindows = Array.isArray(mv.windows) ? mv.windows : []
          const windows = Array.from({ length: 10 }, (_, i) => {
            const found = existingWindows.find((w) => w.windowIndex === i)
            return found ?? { windowIndex: i, sourceId: i === 0 ? 10011 : i === 1 ? 10010 : 0 }
          })
          return { ...mv, windows }
        })
      : makeDefaultConfig(equipment.name).multiViewers
    setConfig({ multiViewers: mvs })
    setActiveMv((prev) => Math.max(0, Math.min(prev, mvs.length - 1)))
    cablePlannerApi.atem
      .getStatus()
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false))
  }, [slot.open, equipment?.id, equipment?.atemMvConfig, equipment?.name, equipment])

  const inputs = useMemo(() => {
    if (!equipment || !Array.isArray(equipment.inputs)) return []
    return equipment.inputs.map((p, idx) => ({
      id: idx + 1,
      label: (p && typeof p.name === 'string' && p.name.trim()) || `Input ${idx + 1}`,
    }))
  }, [equipment])

  if (!slot.open || !equipment) return null

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
  const spec = mv ? getMvGridSpec(mv.layout) : null
  const pgmIndex = mv?.programPreviewSwapped ? 0 : 1
  const prvIndex = mv?.programPreviewSwapped ? 1 : 0

  const renderCell = (
    windowIndex: number,
    cellStyle: React.CSSProperties,
    role: 'pgm' | 'prv' | 'small',
  ) => {
    if (!mv) return null
    const windows = Array.isArray(mv.windows) ? mv.windows : []
    const win = windows.find((w) => w.windowIndex === windowIndex) ?? windows[windowIndex]
    const sid = typeof win?.sourceId === 'number' ? win.sourceId : 0
    const label = sourceLabel(sid, inputs)
    const bg = sourceColor(sid, label)
    const highlight =
      role === 'pgm' ? '#ef4444' : role === 'prv' ? '#22c55e' : undefined
    return (
      <button
        type="button"
        key={`w-${windowIndex}`}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          setPicker({
            mvIdx: activeMv,
            windowIndex,
            x: rect.right + 6,
            y: rect.top,
          })
        }}
        style={{
          ...cellStyle,
          background: bg,
          boxShadow: highlight ? `inset 0 0 0 3px ${highlight}` : undefined,
          color: sid === 0 ? '#cbd5e1' : '#0f172a',
        }}
        className="group relative flex flex-col items-center justify-center overflow-hidden border border-slate-900/40 text-center hover:brightness-95"
        title={`Source ${windowIndex + 1}: ${label} (ID ${sid}) — klicken zum Ändern`}
      >
        {role !== 'small' && (
          <div className="absolute left-1 top-0 text-[9px] font-semibold uppercase tracking-wider opacity-70">
            {role.toUpperCase()}
          </div>
        )}
        <div className="truncate px-1 text-[11px] font-medium leading-tight">
          {label}
        </div>
        <div className="truncate px-1 text-[9px] opacity-60">ID {sid}</div>
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

        {/* v7.9.4 — Layout-Picker LIVE PREVIEW. Steht außerhalb von
            mvGridRef damit der PNG-Export nur das Big-Window zeigt
            (User-Issue: "das ist jetzt verdeckt von der ansichts
            auswahl funktion auf dem png exportierbarem layout").
            Jedes Layout wird als Mini-Variante des echten Big-Windows
            gerendert mit den aktuellen Quellen-Labels + IDs — der
            User erkennt das gewünschte Layout an seiner tatsächlichen
            Belegung, nicht an einer abstrakten Box-Silhouette. */}
        {mv && (
          <div className="flex flex-wrap items-start gap-3 border-b border-slate-800 px-3 py-2">
            <span className="mt-1 text-[11px] text-slate-300">Layout</span>
            <div className="flex flex-wrap gap-1.5">
              {MV_LAYOUT_OPTIONS.map((l) => {
                const active = mv.layout === l.value
                return (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => updateMv(activeMv, { layout: l.value })}
                    className="group flex flex-col items-center gap-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    title={`Layout: ${l.label}`}
                    aria-label={`Layout ${l.label}${active ? ' (aktiv)' : ''}`}
                  >
                    <MvLayoutPreview
                      layoutId={l.value}
                      active={active}
                      windows={Array.isArray(mv.windows) ? mv.windows : []}
                      pgmIndex={pgmIndex}
                      prvIndex={prvIndex}
                      inputs={inputs}
                    />
                    <span
                      className={`max-w-[112px] truncate text-[9px] ${
                        active ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    >
                      {l.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="ml-auto flex shrink-0 items-center gap-2 self-start text-xs">
              <input
                type="checkbox"
                checked={!!mv.programPreviewSwapped}
                onChange={(e) => updateMv(activeMv, { programPreviewSwapped: e.target.checked })}
              />
              <span className="text-slate-300">PGM/PRV getauscht</span>
            </label>
          </div>
        )}

        {/* v7.9.4 — Big-Window: NUR Source-Picker. Die ehemaligen
            Quadrant-Overlays die das Layout zyklisch durchschalteten
            sind entfernt; sie haben die Cell-Klicks abgefangen und
            erschienen als "1 ↔ 4 · TL"-Geister im PNG-Export. */}
        <div ref={mvGridRef} className="flex-1 overflow-auto p-4">
          {mv && spec && (
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <div
                className="absolute inset-0 grid gap-[2px] rounded border border-slate-700 bg-slate-950 p-1"
                style={{
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(4, 1fr)',
                }}
              >
                {spec.big.map((big) => {
                  const role =
                    big.window === pgmIndex
                      ? 'pgm'
                      : big.window === prvIndex
                        ? 'prv'
                        : 'small'
                  return renderCell(
                    big.window,
                    {
                      gridColumn: `${big.colStart} / span ${big.colSpan}`,
                      gridRow: `${big.rowStart} / span ${big.rowSpan}`,
                    },
                    role as 'pgm' | 'prv' | 'small',
                  )
                })}
                {spec.small.map((cell, smallIdx) => {
                  const windowIndex = smallIdx + 2
                  return renderCell(
                    windowIndex,
                    {
                      gridColumn: `${cell.colStart} / span 1`,
                      gridRow: `${cell.rowStart} / span 1`,
                    },
                    'small',
                  )
                })}
              </div>
            </div>
          )}
        </div>

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
