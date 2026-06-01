import { useMemo, useState } from 'react'
import type { CablePlannerProject } from '../renderer/types/project'
import { styleForLayer } from '../renderer/lib/cableLayers'

// #143 — Zero-Install-Web-Viewer (Stage 1). Lädt eine .cpviewer/.json und
// rendert den Plan read-only als SVG (Standort-Rahmen, Geräte, Kabel) plus
// die Anmerkungen. Bewusst self-contained — kein ReactFlow/Store/Electron,
// damit das Bundle klein bleibt und in jedem Browser ohne Backend läuft.
//
// Bewusst (noch) NICHT in Stage 1: Annotations editieren/zurückschreiben,
// Live-Sync, Auth. Reviewer sehen + prüfen den Plan; das Editieren von
// Anmerkungen ist der nächste Ausbauschritt.

const REVIEWER_KEY = 'cable-planner.viewer.reviewer'

interface BBox {
  x: number
  y: number
  w: number
  h: number
}

const planBBox = (project: CablePlannerProject): BBox => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const add = (x: number, y: number, w: number, h: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w)
    maxY = Math.max(maxY, y + h)
  }
  for (const e of project.equipment) add(e.x, e.y, e.width ?? 240, e.height ?? 80)
  for (const l of project.locations ?? []) add(l.x, l.y, l.width, l.height)
  for (const c of project.cables) for (const wp of c.waypoints ?? []) add(wp.x, wp.y, 0, 0)
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1000, h: 700 }
  const pad = 60
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
}

const PlanSvg = ({ project }: { project: CablePlannerProject }) => {
  const bbox = useMemo(() => planBBox(project), [project])
  const centerById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const e of project.equipment) {
      m.set(e.id, { x: e.x + (e.width ?? 240) / 2, y: e.y + (e.height ?? 80) / 2 })
    }
    return m
  }, [project])

  return (
    <svg
      viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
      className="h-full w-full"
      style={{ background: '#0f172a' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {(project.locations ?? []).map((l) => (
        <g key={l.id}>
          <rect
            x={l.x}
            y={l.y}
            width={l.width}
            height={l.height}
            rx={10}
            fill={l.color}
            fillOpacity={0.06}
            stroke={l.color}
            strokeWidth={2}
          />
          <text x={l.x + 10} y={l.y + 22} fill={l.color} fontSize={15} fontFamily="sans-serif">
            {l.name}
          </text>
        </g>
      ))}

      {project.cables.map((c) => {
        const a = centerById.get(c.fromEquipmentId)
        const b = centerById.get(c.toEquipmentId)
        if (!a || !b) return null
        const points = [a, ...(c.waypoints ?? []).map((wp) => ({ x: wp.x, y: wp.y })), b]
          .map((p) => `${p.x},${p.y}`)
          .join(' ')
        return (
          <polyline
            key={c.id}
            points={points}
            fill="none"
            stroke={styleForLayer(c.layer).color}
            strokeWidth={2.5}
            opacity={0.85}
          />
        )
      })}

      {project.equipment.map((e) => {
        const w = e.width ?? 240
        const h = e.height ?? 80
        const accent = e.nodeColor ?? '#334155'
        return (
          <g key={e.id}>
            <rect x={e.x} y={e.y} width={w} height={h} rx={6} fill="#1e293b" stroke={accent} strokeWidth={2} />
            <rect x={e.x} y={e.y} width={w} height={22} rx={6} fill={accent} />
            <rect x={e.x} y={e.y + 12} width={w} height={10} fill={accent} />
            <text x={e.x + 8} y={e.y + 16} fill="#ffffff" fontSize={12} fontFamily="sans-serif" fontWeight={600}>
              {e.name}
            </text>
            {e.subtitle && (
              <text x={e.x + 8} y={e.y + 38} fill="#94a3b8" fontSize={11} fontFamily="sans-serif">
                {e.subtitle}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Offen',
  built: 'Aufgebaut',
  resolved: 'Erledigt',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#f59e0b',
  built: '#3b82f6',
  resolved: '#22c55e',
}

export const ViewerApp = () => {
  const [reviewer, setReviewer] = useState<string>(() => localStorage.getItem(REVIEWER_KEY) ?? '')
  const [project, setProject] = useState<CablePlannerProject | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setReviewerPersisted = (name: string): void => {
    setReviewer(name)
    try {
      localStorage.setItem(REVIEWER_KEY, name)
    } catch {
      /* localStorage nicht verfügbar — egal */
    }
  }

  const loadFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as CablePlannerProject
      if (!parsed || !Array.isArray(parsed.equipment) || !Array.isArray(parsed.cables)) {
        throw new Error('Keine gültige Cable-Planner-Datei (.cpviewer / .json).')
      }
      setProject(parsed)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Datei konnte nicht gelesen werden.')
    }
  }

  const onDrop = (ev: React.DragEvent): void => {
    ev.preventDefault()
    const f = ev.dataTransfer.files?.[0]
    if (f) void loadFile(f)
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-200">
        <div
          className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <h1 className="mb-1 text-lg font-semibold">Cable Planner — Viewer</h1>
          <p className="mb-4 text-sm text-slate-400">
            Read-only-Ansicht eines Plans. Keine Installation nötig — Datei laden und prüfen.
          </p>
          <label className="mb-1 block text-xs text-slate-400">Dein Name (für Anmerkungen)</label>
          <input
            value={reviewer}
            onChange={(e) => setReviewerPersisted(e.target.value)}
            placeholder="z. B. Jan (Freelance-Cam)"
            className="mb-4 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-slate-600 bg-slate-950/50 p-6 text-center text-sm text-slate-400 hover:border-sky-600 hover:text-slate-200">
            <span className="font-medium">Plan-Datei hierher ziehen oder klicken</span>
            <span className="text-xs">.cpviewer oder .json</span>
            <input
              type="file"
              accept=".cpviewer,.json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void loadFile(f)
              }}
            />
          </label>
          {error && <p className="mt-3 rounded bg-red-900/40 p-2 text-xs text-red-200">{error}</p>}
        </div>
      </div>
    )
  }

  const annotations = project.annotations ?? []

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{project.metadata?.name ?? 'Plan'}</h1>
          {project.metadata?.description && (
            <p className="truncate text-xs text-slate-400">{project.metadata.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-slate-400">
          <span className="rounded bg-slate-800 px-2 py-1">Read-only</span>
          {reviewer && <span>👤 {reviewer}</span>}
          <button
            onClick={() => setProject(null)}
            className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800"
          >
            Andere Datei…
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PlanSvg project={project} />
        </div>
        <aside className="flex w-72 shrink-0 flex-col border-l border-slate-700 bg-slate-900">
          <div className="border-b border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Anmerkungen ({annotations.length})
          </div>
          <div className="flex-1 overflow-auto p-2">
            {annotations.length === 0 ? (
              <p className="p-2 text-xs text-slate-500">Keine Anmerkungen im Plan.</p>
            ) : (
              <ul className="space-y-2">
                {annotations.map((a) => (
                  <li key={a.id} className="rounded border border-slate-800 bg-slate-950/50 p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-300">{a.author || '—'}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: (STATUS_COLOR[a.status] ?? '#64748b') + '33', color: STATUS_COLOR[a.status] ?? '#94a3b8' }}
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="text-slate-200">{a.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-slate-700 p-2 text-[10px] text-slate-500">
            {project.equipment.length} Geräte · {project.cables.length} Kabel ·{' '}
            {(project.locations ?? []).length} Standorte
          </div>
        </aside>
      </div>
    </div>
  )
}
