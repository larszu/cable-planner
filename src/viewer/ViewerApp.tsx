import { useEffect, useMemo, useRef, useState } from 'react'
import type { CablePlannerProject, ProjectAnnotation } from '../renderer/types/project'
import { styleForLayer } from '../renderer/lib/cableLayers'

// #143 — Zero-Install-Web-Viewer (Stage 1). Lädt eine .cpviewer/.json und
// rendert den Plan read-only als SVG plus die Anmerkungen. Der Reviewer kann
// Anmerkungen HINZUFÜGEN / BEARBEITEN / Status setzen (das ist der einzige
// Schreib-Pfad) und die annotierte Datei wieder herunterladen — das Haupt-
// programm liest sie über „Annotierte Viewer-Datei zurücklesen…" zurück.
//
// Bewusst self-contained — kein ReactFlow/Store/Electron, damit das Bundle
// klein bleibt und in jedem Browser ohne Backend offline läuft.

const REVIEWER_KEY = 'cable-planner.viewer.reviewer'
const annKey = (p: CablePlannerProject): string =>
  `cable-planner.viewer.ann::${p.metadata?.name ?? 'plan'}::${p.metadata?.createdAt ?? ''}`

const uid = (): string =>
  crypto.randomUUID?.() ?? `ann-${Date.now()}-${Math.random().toString(36).slice(2)}`

const STATUS_ORDER: ProjectAnnotation['status'][] = ['open', 'built', 'resolved']
const STATUS_LABEL: Record<string, string> = { open: 'Offen', built: 'Aufgebaut', resolved: 'Erledigt' }
const STATUS_COLOR: Record<string, string> = { open: '#f59e0b', built: '#3b82f6', resolved: '#22c55e' }

interface BBox { x: number; y: number; w: number; h: number }

const planBBox = (project: CablePlannerProject): BBox => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const add = (x: number, y: number, w: number, h: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
  }
  for (const e of project.equipment) add(e.x, e.y, e.width ?? 240, e.height ?? 80)
  for (const l of project.locations ?? []) add(l.x, l.y, l.width, l.height)
  for (const c of project.cables) for (const wp of c.waypoints ?? []) add(wp.x, wp.y, 0, 0)
  for (const a of project.annotations ?? []) if (a.anchor.type === 'free') add(a.anchor.x, a.anchor.y, 0, 0)
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1000, h: 700 }
  const pad = 60
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
}

/** Merge stored reviewer edits over the file's annotations (by id). */
const mergeAnn = (base: ProjectAnnotation[], stored: ProjectAnnotation[]): ProjectAnnotation[] => {
  const byId = new Map(base.map((a) => [a.id, a]))
  for (const s of stored) byId.set(s.id, s)
  return [...byId.values()]
}

const PlanSvg = ({
  project,
  annotations,
  centerById,
  addMode,
  onCanvasClick,
  onMarkerClick,
  selectedId,
  svgRef,
}: {
  project: CablePlannerProject
  annotations: ProjectAnnotation[]
  centerById: Map<string, { x: number; y: number }>
  addMode: boolean
  onCanvasClick: (x: number, y: number) => void
  onMarkerClick: (id: string) => void
  selectedId: string | null
  svgRef: React.RefObject<SVGSVGElement | null>
}) => {
  const bbox = useMemo(() => planBBox(project), [project])

  const anchorPos = (a: ProjectAnnotation): { x: number; y: number } | null => {
    const an = a.anchor
    if (an.type === 'free') return { x: an.x, y: an.y }
    if (an.type === 'device' || an.type === 'port') return centerById.get(an.deviceId) ?? null
    if (an.type === 'cable') {
      const c = project.cables.find((x) => x.id === an.cableId)
      if (!c) return null
      const from = centerById.get(c.fromEquipmentId); const to = centerById.get(c.toEquipmentId)
      if (!from || !to) return null
      return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
    }
    return null
  }

  const handleClick = (ev: React.MouseEvent<SVGSVGElement>): void => {
    if (!addMode || !svgRef.current) return
    const svg = svgRef.current
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const pt = svg.createSVGPoint()
    pt.x = ev.clientX; pt.y = ev.clientY
    const loc = pt.matrixTransform(ctm.inverse())
    onCanvasClick(Math.round(loc.x), Math.round(loc.y))
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
      className="h-full w-full"
      style={{ background: 'var(--cp-bg)', cursor: addMode ? 'crosshair' : 'default' }}
      preserveAspectRatio="xMidYMid meet"
      onClick={handleClick}
    >
      {(project.locations ?? []).map((l) => (
        <g key={l.id}>
          <rect x={l.x} y={l.y} width={l.width} height={l.height} rx={10} fill={l.color} fillOpacity={0.06} stroke={l.color} strokeWidth={2} />
          <text x={l.x + 10} y={l.y + 22} fill={l.color} fontSize={15} fontFamily="sans-serif">{l.name}</text>
        </g>
      ))}

      {project.cables.map((c) => {
        const a = centerById.get(c.fromEquipmentId); const b = centerById.get(c.toEquipmentId)
        if (!a || !b) return null
        const points = [a, ...(c.waypoints ?? []).map((wp) => ({ x: wp.x, y: wp.y })), b].map((p) => `${p.x},${p.y}`).join(' ')
        return <polyline key={c.id} points={points} fill="none" stroke={styleForLayer(c.layer).color} strokeWidth={2.5} opacity={0.85} />
      })}

      {project.equipment.map((e) => {
        const w = e.width ?? 240; const h = e.height ?? 80; const accent = e.nodeColor ?? '#334155'
        return (
          <g key={e.id}>
            <rect x={e.x} y={e.y} width={w} height={h} rx={6} fill="#1e293b" stroke={accent} strokeWidth={2} />
            <rect x={e.x} y={e.y} width={w} height={22} rx={6} fill={accent} />
            <rect x={e.x} y={e.y + 12} width={w} height={10} fill={accent} />
            <text x={e.x + 8} y={e.y + 16} fill="#ffffff" fontSize={12} fontFamily="sans-serif" fontWeight={600}>{e.name}</text>
            {e.subtitle && <text x={e.x + 8} y={e.y + 38} fill="#94a3b8" fontSize={11} fontFamily="sans-serif">{e.subtitle}</text>}
          </g>
        )
      })}

      {annotations.map((a, i) => {
        const pos = anchorPos(a)
        if (!pos) return null
        const color = STATUS_COLOR[a.status] ?? '#64748b'
        const sel = a.id === selectedId
        return (
          <g key={a.id} style={{ cursor: 'pointer' }} onClick={(ev) => { ev.stopPropagation(); onMarkerClick(a.id) }}>
            <circle cx={pos.x} cy={pos.y} r={sel ? 13 : 11} fill={color} stroke="#0f172a" strokeWidth={sel ? 3 : 2} />
            <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#0f172a" fontSize={11} fontWeight={700} fontFamily="sans-serif">{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

export const ViewerApp = () => {
  const [reviewer, setReviewer] = useState<string>(() => localStorage.getItem(REVIEWER_KEY) ?? '')
  const [project, setProject] = useState<CablePlannerProject | null>(null)
  const [annotations, setAnnotations] = useState<ProjectAnnotation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [addMode, setAddMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const setReviewerPersisted = (name: string): void => {
    setReviewer(name)
    try { localStorage.setItem(REVIEWER_KEY, name) } catch { /* ignore */ }
  }

  const centerById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    if (project) for (const e of project.equipment) m.set(e.id, { x: e.x + (e.width ?? 240) / 2, y: e.y + (e.height ?? 80) / 2 })
    return m
  }, [project])

  // Persist annotations per plan so the reviewer doesn't lose work on reload.
  useEffect(() => {
    if (!project) return
    try { localStorage.setItem(annKey(project), JSON.stringify(annotations)) } catch { /* ignore */ }
  }, [annotations, project])

  // Umschaltbar: statt einer Datei den Plan LIVE vom Desktop laden — lokal (LAN)
  // oder über Mobilfunk (eigener Tunnel/Relay auf den Desktop). Persistiert.
  const REMOTE_KEY = 'cable-planner-viewer:remote'
  const [remoteUrl, setRemoteUrl] = useState<string>(() => localStorage.getItem(REMOTE_KEY) ?? '')
  const [loadingRemote, setLoadingRemote] = useState(false)

  const loadRemote = async (): Promise<void> => {
    const raw = remoteUrl.trim()
    if (!raw) return
    setLoadingRemote(true)
    setError(null)
    try {
      let base = raw
      let token = ''
      try {
        const u = new URL(raw)
        token = u.searchParams.get('t') ?? ''
        u.search = ''
        u.hash = ''
        base = u.toString().replace(/\/$/, '')
      } catch {
        throw new Error('Ungültige URL.')
      }
      try { localStorage.setItem(REMOTE_KEY, raw) } catch { /* ignore */ }
      const sep = '?'
      const url = `${base}/project.json${token ? `${sep}t=${encodeURIComponent(token)}` : ''}`
      const res = await fetch(url, { cache: 'no-store', headers: token ? { 'X-CP-Token': token } : undefined })
      if (!res.ok) throw new Error(`Server antwortete ${res.status}.`)
      const parsed = (await res.json()) as CablePlannerProject
      if (!parsed || !Array.isArray(parsed.equipment) || !Array.isArray(parsed.cables)) {
        throw new Error('Keine gültigen Plandaten empfangen.')
      }
      let stored: ProjectAnnotation[] = []
      try {
        const rawAnn = localStorage.getItem(annKey(parsed))
        if (rawAnn) stored = JSON.parse(rawAnn) as ProjectAnnotation[]
      } catch { /* ignore */ }
      setProject(parsed)
      setAnnotations(mergeAnn(parsed.annotations ?? [], stored))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remote-Laden fehlgeschlagen.')
    } finally {
      setLoadingRemote(false)
    }
  }

  const loadFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as CablePlannerProject
      if (!parsed || !Array.isArray(parsed.equipment) || !Array.isArray(parsed.cables)) {
        throw new Error('Keine gültige Cable-Planner-Datei (.cpviewer / .json).')
      }
      let stored: ProjectAnnotation[] = []
      try {
        const raw = localStorage.getItem(annKey(parsed))
        if (raw) stored = JSON.parse(raw) as ProjectAnnotation[]
      } catch { /* ignore */ }
      setProject(parsed)
      setAnnotations(mergeAnn(parsed.annotations ?? [], stored))
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

  const addAnnotationAt = (x: number, y: number): void => {
    const a: ProjectAnnotation = {
      id: uid(),
      author: reviewer.trim() || 'Reviewer',
      createdAt: new Date().toISOString(),
      text: '',
      status: 'open',
      anchor: { type: 'free', x, y },
    }
    setAnnotations((prev) => [...prev, a])
    setSelectedId(a.id)
    setAddMode(false)
  }

  const patchAnnotation = (id: string, patch: Partial<ProjectAnnotation>): void =>
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  const removeAnnotation = (id: string): void =>
    setAnnotations((prev) => prev.filter((a) => a.id !== id))

  const downloadAnnotated = (): void => {
    if (!project) return
    const out: CablePlannerProject = { ...project, annotations }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const base = (project.metadata?.name ?? 'plan').replace(/[^\w.-]+/g, '_')
    a.download = `${base}.cpviewer`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cp-bg p-4 text-cp-text">
        <div className="w-full max-w-md rounded-lg border border-cp-border bg-cp-surface-1 p-6 shadow-2xl" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <h1 className="mb-1 text-lg font-semibold">Cable Planner — Viewer</h1>
          <p className="mb-4 text-sm text-cp-text-muted">Read-only-Ansicht eines Plans. Keine Installation nötig — Datei laden, prüfen und Anmerkungen setzen.</p>
          <label className="mb-1 block text-xs text-cp-text-muted">Dein Name (für Anmerkungen)</label>
          <input value={reviewer} onChange={(e) => setReviewerPersisted(e.target.value)} placeholder="z. B. Jan (Freelance-Cam)" className="mb-4 w-full rounded border border-cp-border bg-cp-surface-2 p-2 text-sm" />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-cp-border bg-cp-surface-2/40 p-6 text-center text-sm text-cp-text-muted hover:border-cp-accent hover:text-cp-text">
            <span className="font-medium">Plan-Datei hierher ziehen oder klicken</span>
            <span className="text-xs">.cpviewer oder .json</span>
            <input type="file" accept=".cpviewer,.json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f) }} />
          </label>

          {/* Umschaltbar: Live vom Desktop laden (lokal ODER über Mobilfunk) */}
          <div className="mt-4 border-t border-cp-border-muted pt-3">
            <div className="mb-1 text-xs font-medium text-cp-text-secondary">— oder live vom Desktop —</div>
            <input
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="http://192.168.1.10:PORT/?t=…  (LAN)  ·  https://…  (Mobilfunk-Tunnel)"
              className="w-full rounded border border-cp-border bg-cp-surface-2 p-2 text-xs"
            />
            <button
              type="button"
              disabled={loadingRemote || !remoteUrl.trim()}
              onClick={() => void loadRemote()}
              className="mt-2 w-full rounded bg-cp-accent px-3 py-1.5 text-xs font-medium text-white enabled:hover:opacity-90 disabled:opacity-50"
            >
              {loadingRemote ? 'Lade…' : 'Live laden'}
            </button>
            <p className="mt-1 text-[11px] text-cp-text-faint">
              LAN: die vom Desktop angezeigte Adresse. Mobilfunk: deine öffentliche Tunnel-/Relay-URL
              (siehe docs/self-hosted-relay.md). Nichts läuft über fremde Server.
            </p>
          </div>

          {error && <p className="mt-3 rounded border border-cp-danger/40 bg-cp-danger/10 p-2 text-xs text-cp-danger">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-cp-bg text-cp-text">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cp-border bg-cp-surface-1 px-4 py-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{project.metadata?.name ?? 'Plan'}</h1>
          {project.metadata?.description && <p className="truncate text-xs text-cp-text-muted">{project.metadata.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-cp-text-muted">
          <span className="rounded bg-cp-surface-3 px-2 py-1">Plan read-only</span>
          {reviewer && <span className="hidden sm:inline">👤 {reviewer}</span>}
          <button onClick={() => downloadAnnotated()} className="rounded bg-cp-accent px-2 py-1 font-medium text-white hover:opacity-90" title="Annotierte Datei (.cpviewer) herunterladen — im Hauptprogramm über „Annotierte Viewer-Datei zurücklesen…“ einlesen">
            Annotierte Datei ↓
          </button>
          <button onClick={() => setProject(null)} className="rounded border border-cp-border px-2 py-1 hover:bg-cp-surface-3">Andere Datei…</button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <PlanSvg project={project} annotations={annotations} centerById={centerById} addMode={addMode} onCanvasClick={addAnnotationAt} onMarkerClick={(id) => setSelectedId(id)} selectedId={selectedId} svgRef={svgRef} />
          <button
            onClick={() => setAddMode((v) => !v)}
            className={`absolute left-3 top-3 rounded px-3 py-1.5 text-xs font-medium shadow-lg ${addMode ? 'bg-cp-accent text-white ring-2 ring-cp-accent/50' : 'bg-cp-surface-3 text-cp-text hover:bg-cp-surface-4'}`}
          >
            {addMode ? 'Klicke in den Plan…' : '+ Anmerkung'}
          </button>
        </div>
        <aside className="flex w-80 shrink-0 flex-col border-l border-cp-border bg-cp-surface-1">
          <div className="flex items-center justify-between border-b border-cp-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cp-text-muted">
            <span>Anmerkungen ({annotations.length})</span>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {annotations.length === 0 ? (
              <p className="p-2 text-xs text-cp-text-faint">Noch keine Anmerkungen. Klicke „+ Anmerkung" und dann in den Plan.</p>
            ) : (
              <ul className="space-y-2">
                {annotations.map((a, i) => {
                  const mine = a.author === (reviewer.trim() || 'Reviewer')
                  const sel = a.id === selectedId
                  return (
                    <li key={a.id} className={`rounded border p-2 text-xs ${sel ? 'border-cp-accent bg-cp-surface-2' : 'border-cp-border-muted bg-cp-surface-2/40'}`} onClick={() => setSelectedId(a.id)}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-medium text-cp-text-secondary">
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-slate-900" style={{ backgroundColor: STATUS_COLOR[a.status] ?? '#64748b' }}>{i + 1}</span>
                          {a.author || '—'}
                        </span>
                        <select
                          value={a.status}
                          onChange={(e) => patchAnnotation(a.id, { status: e.target.value as ProjectAnnotation['status'] })}
                          className="rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                        </select>
                      </div>
                      <textarea
                        value={a.text}
                        onChange={(e) => patchAnnotation(a.id, { text: e.target.value })}
                        placeholder="Anmerkung…"
                        rows={2}
                        className="w-full resize-y rounded border border-cp-border-muted bg-cp-surface-1 p-1.5 text-xs text-cp-text"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {mine && (
                        <div className="mt-1 flex justify-end">
                          <button onClick={(e) => { e.stopPropagation(); removeAnnotation(a.id) }} className="rounded px-1.5 py-0.5 text-[10px] text-cp-danger hover:bg-cp-danger/20">Löschen</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-cp-border p-2 text-[10px] text-cp-text-faint">
            {project.equipment.length} Geräte · {project.cables.length} Kabel · {(project.locations ?? []).length} Standorte
          </div>
        </aside>
      </div>
    </div>
  )
}
