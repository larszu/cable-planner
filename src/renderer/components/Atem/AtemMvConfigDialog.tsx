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

/** Issue #55 — visual ATEM-software-style "Ansichtsauswahl"
 *  thumbnail. Renders the 4×4 grid of an MV layout as a small SVG
 *  with the "big" windows shaded darker than the small cells, so
 *  the user can recognise each layout by its silhouette without
 *  reading the label. */
const MvLayoutThumb = ({
  layoutId,
  active,
}: {
  layoutId: number
  active: boolean
}) => {
  const spec = getMvGridSpec(layoutId)
  const cell = 8 // px per 4x4 cell
  const gap = 1
  const dim = cell * 4 + gap * 3
  // Build a "this cell is part of a big window" lookup by walking the
  // spec's `big` rectangles. Cells not covered by any big rect are
  // small.
  const bigCells = new Set<string>()
  for (const big of spec.big) {
    for (let r = big.rowStart; r < big.rowStart + big.rowSpan; r++) {
      for (let c = big.colStart; c < big.colStart + big.colSpan; c++) {
        bigCells.add(`${r},${c}`)
      }
    }
  }
  const fillBig = active ? '#0ea5e9' : '#334155'
  const fillSmall = active ? '#075985' : '#1e293b'
  const stroke = active ? '#0c4a6e' : '#0f172a'
  return (
    <svg
      width={dim}
      height={dim * (9 / 16)}
      viewBox={`0 0 ${dim} ${(dim * 9) / 16}`}
      role="presentation"
    >
      {Array.from({ length: 4 }).map((_, ri) =>
        Array.from({ length: 4 }).map((_, ci) => {
          const isBig = bigCells.has(`${ri + 1},${ci + 1}`)
          const x = ci * (cell + gap)
          const y = (ri * (cell + gap)) * (9 / 16) + 0.5
          return (
            <rect
              key={`${ri}-${ci}`}
              x={x}
              y={y}
              width={cell}
              height={cell * (9 / 16) - 0.5}
              fill={isBig ? fillBig : fillSmall}
              stroke={stroke}
              strokeWidth={0.5}
              rx={1}
            />
          )
        }),
      )}
    </svg>
  )
}

/** Issue #55 — per-quadrant layout cycle. Clicking on a quadrant
 *  steps through the layouts that affect that quadrant (between "1
 *  big window covering this quadrant" and "this quadrant split into
 *  4 small windows"), matching the real ATEM software. We use the
 *  9 layouts that the cable-planner already supports and group them
 *  per quadrant. The cycle wraps around so repeated clicks rotate. */
const QUADRANT_LAYOUT_CYCLES = {
  // Top-left: Default (TL big) → ProgramTop (top half = one big) →
  // Small-TL-corner (1 small in TL) → back
  TL: [0, 12, 1] as const,
  // Top-right: Default (TR big) → ProgramTop → Small-TR-corner
  TR: [0, 12, 2] as const,
  // Bottom-left: Default (BL = 4 small) → ProgramBottom (bottom half
  // = one big) → Small-BL-corner
  BL: [0, 3, 4] as const,
  // Bottom-right: Default (BR = 4 small) → ProgramBottom → Small-BR-corner
  BR: [0, 3, 8] as const,
} as const

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

        <div ref={mvGridRef} className="flex-1 overflow-auto p-4">
          {mv && spec && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
                {/* Issue #55: visual layout thumbnails like the
                    Blackmagic ATEM software's "Ansichtsauswahl"
                    picker. Each button renders a tiny 4x4 SVG preview
                    of that layout's grid (big windows + small cells)
                    so the user can pick by sight, not by reading. */}
                <span className="text-slate-300">Ansichtsauswahl</span>
                <div className="flex flex-wrap gap-1.5">
                  {MV_LAYOUT_OPTIONS.map((l) => {
                    const active = mv.layout === l.value
                    return (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => updateMv(activeMv, { layout: l.value })}
                        className={`flex flex-col items-center gap-0.5 rounded border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                          active
                            ? 'border-sky-500 bg-sky-950/50'
                            : 'border-slate-700 bg-slate-900 hover:border-sky-700'
                        }`}
                        title={`Layout: ${l.label}`}
                        aria-label={`Layout ${l.label}${active ? ' (aktiv)' : ''}`}
                      >
                        <MvLayoutThumb layoutId={l.value} active={active} />
                        <span
                          className={`max-w-[64px] truncate text-[9px] ${
                            active ? 'text-sky-200' : 'text-slate-400'
                          }`}
                        >
                          {l.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!mv.programPreviewSwapped}
                    onChange={(e) =>
                      updateMv(activeMv, { programPreviewSwapped: e.target.checked })
                    }
                  />
                  <span className="text-slate-300">PGM/PRV getauscht</span>
                </label>
              </div>

              {/* Issue #55 — ATEM-software-style quadrant click cycle.
                  Each invisible overlay corresponds to one MV quadrant
                  (TL / TR / BL / BR). Clicking advances through the
                  layouts that affect that quadrant. Combined with the
                  layout-button row above, this matches the real ATEM
                  software where you can also click a quadrant to flip
                  it between 1-big and 4-small. */}
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
                {/* Quadrant click overlay — half-transparent button per
                    quadrant. Hover surfaces a subtle outline + label
                    "1 ↔ 4". Click cycles through that quadrant's
                    relevant layouts (matching ATEM software's flip
                    between one big window and four small windows). */}
                {(['TL', 'TR', 'BL', 'BR'] as const).map((q) => {
                  const cycle = QUADRANT_LAYOUT_CYCLES[q] as readonly number[]
                  const idx = cycle.indexOf(mv.layout)
                  const next = cycle[(idx + 1) % cycle.length] ?? cycle[0]
                  const style: React.CSSProperties = {
                    position: 'absolute',
                    width: '50%',
                    height: '50%',
                    top: q.startsWith('T') ? 0 : '50%',
                    left: q.endsWith('L') ? 0 : '50%',
                  }
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => updateMv(activeMv, { layout: next })}
                      title={`Quadrant ${q} — Klick: nächstes ATEM-Layout (${next})`}
                      aria-label={`Layout-Quadrant ${q} umschalten`}
                      style={style}
                      className="group cursor-pointer rounded outline-none transition-all hover:bg-sky-500/10 hover:ring-2 hover:ring-sky-400/60 focus-visible:bg-sky-500/15 focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <span className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold uppercase tracking-wider text-sky-200 opacity-0 transition-opacity group-hover:opacity-90 group-focus-visible:opacity-90">
                        1 ↔ 4 · {q}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
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
