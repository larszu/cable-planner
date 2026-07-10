/**
 * Issue #73 — Cable-Planner Mobile Companion.
 *
 * A touch-friendly field-tech companion. Connects to the desktop app
 * via LAN (mobileShareServer) or loads a project file directly. Two
 * core flows:
 *
 *  1. CHECK-OFF — Tap a cable or port "gesteckt"; the check syncs live
 *     to the desktop canvas (POST /checks) AND persists locally so the
 *     phone keeps a working copy if the funk drops.
 *  2. ADD CABLE — User vor Ort merkt dass ein Patch fehlt; AddCableModal
 *     mit Von-Gerät / Von-Port / Zu-Gerät / Zu-Port-Dropdowns; POST
 *     /cables → Desktop fügt das Kabel ins Projekt ein, markiert mit
 *     addedFromMobile=true → 📱-Badge im Canvas.
 *
 * Offline-Survival: erfolgreiche /project.json-Pulls werden in
 * localStorage gecached. Bei Connection-Loss läuft die App weiter mit
 * dem Cache (Amber-Banner zeigt das an). Beim Re-Connect wird der
 * lokale CheckState einmal an /checks gepushed damit alles synct.
 *
 * Visual style mirrors the desktop app's dark theme; Tailwind classes
 * carry over from the shared index.css.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, X, QrCode, Search } from 'lucide-react'
import { Icon } from '../renderer/components/shared/Icon'
import { styleForLayer } from '../renderer/lib/cableLayers'
import { parseQrPayload, lookupQrRef } from '../renderer/lib/qrPayload'
import { cableLabelId } from '../renderer/lib/docIds'
import type { CablePlannerProject } from '../renderer/types/project'

/** Deep-Link beim Laden: `?lookup=cable/C-0001` oder `#cable/C-0001` /
 *  `#C-0001`. Wird einmalig nach dem Projekt-Load aufgelöst und springt
 *  zum Element. Leerstring = kein Deep-Link. */
const INITIAL_LOOKUP =
  typeof window !== 'undefined'
    ? window.location.hash.replace(/^#/, '') ||
      new URLSearchParams(window.location.search).get('lookup') ||
      ''
    : ''

// The desktop share server gates every data/write route behind a
// per-session token handed to the phone via the QR/URL (`?t=…`). Read it
// once and replay it on every request (query param + header) so the
// desktop accepts us. Without it the server returns 401.
const SHARE_TOKEN =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('t') ?? ''
    : ''

// ── Verbindungs-Modus: Lokal (LAN, same-origin) ODER Remote (Mobilfunk) ──────
// „Umschaltbar": Lokal fetcht relativ zur ausliefernden LAN-Adresse; Remote
// gegen eine vom User hinterlegte öffentliche URL (der eigene Tunnel/Relay auf
// den Desktop — siehe docs/self-hosted-relay.md). Token kommt aus der URL (?t=)
// oder aus der Remote-URL. Persistiert, sofort per Reload wirksam.
const CONN_KEY = 'cable-planner-mobile:conn'
type ConnMode = 'local' | 'remote'
interface ConnConfig {
  mode: ConnMode
  remoteUrl: string
}

const loadConn = (): ConnConfig => {
  try {
    const raw = localStorage.getItem(CONN_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<ConnConfig>
      if (p.mode === 'local' || p.mode === 'remote') {
        return { mode: p.mode, remoteUrl: typeof p.remoteUrl === 'string' ? p.remoteUrl : '' }
      }
    }
  } catch {
    /* ignore */
  }
  return { mode: 'local', remoteUrl: '' }
}

const saveConn = (c: ConnConfig): void => {
  try {
    localStorage.setItem(CONN_KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

// Aktive Basis + Token — modulweit, aus der gespeicherten Config abgeleitet.
let activeBase = ''
let activeToken = SHARE_TOKEN

const applyConn = (c: ConnConfig): void => {
  if (c.mode === 'remote' && c.remoteUrl.trim()) {
    try {
      const u = new URL(c.remoteUrl.trim())
      const t = u.searchParams.get('t')
      if (t) activeToken = t
      u.search = ''
      u.hash = ''
      activeBase = u.toString().replace(/\/$/, '')
      return
    } catch {
      /* ungültige URL → lokal */
    }
  }
  activeBase = ''
  activeToken = SHARE_TOKEN
}
applyConn(loadConn())

/** fetch() wrapper: hängt den Session-Token an und leitet je nach Verbindungs-
 *  Modus auf die lokale (same-origin) oder die Remote-Basis. Absolute URLs
 *  bleiben unangetastet. */
const apiFetch = (path: string, init?: RequestInit): Promise<Response> => {
  if (/^https?:\/\//i.test(path)) return fetch(path, init)
  const url = activeBase ? `${activeBase}${path.startsWith('/') ? '' : '/'}${path}` : path
  if (!activeToken) return fetch(url, init)
  const sep = url.includes('?') ? '&' : '?'
  const headers = new Headers(init?.headers)
  headers.set('X-CP-Token', activeToken)
  return fetch(`${url}${sep}t=${encodeURIComponent(activeToken)}`, { ...init, headers })
}

const CHECK_KEY = (projectName: string) => `cable-planner-mobile:checks:${projectName}`
// v7.9.54 — Offline-Cache des kompletten Projekts. Ein Eintrag pro
// Hostname/Port-Origin, damit verschiedene Geräte-Sessions sich nicht
// gegenseitig überschreiben. So überlebt eine Session den
// Funkverbindungs-Verlust und der Techniker kann lokal weiter haken
// setzen, die beim nächsten Re-Connect automatisch synchronisiert werden.
const PROJECT_CACHE_KEY = `cable-planner-mobile:project-cache:${
  typeof window !== 'undefined' ? window.location.host : 'unknown'
}`
interface ProjectCacheEnvelope {
  cachedAt: string
  project: unknown
}

interface CheckState {
  cables: Record<string, boolean>
  ports: Record<string, boolean>
}

const loadChecks = (projectName: string): CheckState => {
  try {
    const raw = localStorage.getItem(CHECK_KEY(projectName))
    if (!raw) return { cables: {}, ports: {} }
    return JSON.parse(raw) as CheckState
  } catch {
    return { cables: {}, ports: {} }
  }
}

const saveChecks = (projectName: string, state: CheckState) => {
  try {
    localStorage.setItem(CHECK_KEY(projectName), JSON.stringify(state))
  } catch {
    /* ignore quota */
  }
}

// v7.9.54 — Cache-Helpers für das Offline-Survival des Projekts.
const cacheProject = (project: unknown): void => {
  try {
    const env: ProjectCacheEnvelope = { cachedAt: new Date().toISOString(), project }
    localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(env))
  } catch {
    /* quota / private-mode → einfach skippen, ist nur ein Cache */
  }
}

const loadCachedProject = (): { cachedAt: string; project: unknown } | null => {
  try {
    const raw = localStorage.getItem(PROJECT_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProjectCacheEnvelope>
    if (parsed && typeof parsed.cachedAt === 'string' && parsed.project) {
      return { cachedAt: parsed.cachedAt, project: parsed.project }
    }
  } catch {
    /* corrupted cache → ignore */
  }
  return null
}

const portKey = (deviceId: string, portId: string) => `${deviceId}|${portId}`

const ProjectPicker = ({
  onLoad,
}: {
  onLoad: (project: CablePlannerProject) => void
}) => {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  // v7.9.56 — Letzten Cache-Stand aus localStorage anbieten falls vorhanden
  // (z.B. nach App-Reload ohne aktiven Host-Server). Reload-Button am Ende
  // der Startseite versucht den Host erneut zu erreichen, sonst Cache.
  const cached = loadCachedProject()
  const [reloading, setReloading] = useState(false)
  const [reloadError, setReloadError] = useState<string | null>(null)
  const reloadFromHost = async () => {
    setReloading(true)
    setReloadError(null)
    try {
      const info = await apiFetch('/share-info.json', { cache: 'no-store' })
      if (!info.ok) throw new Error(`share-info ${info.status}`)
      const meta = (await info.json()) as { ok: boolean; hasProject: boolean }
      if (!meta.ok || !meta.hasProject) {
        throw new Error('Desktop teilt aktuell kein Projekt.')
      }
      const res = await apiFetch('/project.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`project ${res.status}`)
      const data = (await res.json()) as CablePlannerProject
      if (!data || !Array.isArray(data.equipment)) {
        throw new Error('Antwort hat falsches Format.')
      }
      cacheProject(data)
      onLoad(data)
    } catch (e) {
      // Host nicht erreichbar → wenn ein Cache da ist, ihn laden.
      if (cached) {
        onLoad(cached.project as CablePlannerProject)
      } else {
        setReloadError(
          e instanceof Error
            ? `Host nicht erreichbar (${e.message}). Datei wählen oder JSON einfügen.`
            : 'Host nicht erreichbar.',
        )
      }
    } finally {
      setReloading(false)
    }
  }

  const tryParse = (text: string) => {
    try {
      const data = JSON.parse(text) as CablePlannerProject
      if (!data || !Array.isArray(data.equipment) || !Array.isArray(data.cables)) {
        setError('Datei sieht nicht wie ein Cable-Planner-Projekt aus (fehlende equipment/cables).')
        return
      }
      onLoad(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => tryParse(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => setError('Datei konnte nicht gelesen werden.')
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <header className="text-center">
        <div className="text-2xl">🔌</div>
        <h1 className="mt-1 text-lg font-semibold text-cp-text">
          Cable Planner — Mobile
        </h1>
        <p className="mt-1 text-xs text-cp-text-muted">
          Hak Ports und Kabel ab während du sie steckst, oder trage fehlende
          Patches direkt vor Ort nach. Alles syncht live zum Desktop. Offline
          funktioniert auch — Häkchen werden beim Re-Connect übertragen.
        </p>
      </header>
      <button
        type="button"
        onClick={reloadFromHost}
        disabled={reloading}
        className="w-full rounded bg-emerald-700 px-3 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        title={
          cached
            ? `Letztes Projekt vom Host laden — fallback auf Cache vom ${new Date(cached.cachedAt).toLocaleString()}`
            : 'Aktuell auf dem Desktop geöffnetes Projekt laden'
        }
      >
        {reloading
          ? '⏳ Lade…'
          : cached
            ? `↻ Projekt erneut laden (Cache: ${new Date(cached.cachedAt).toLocaleString()})`
            : '↻ Projekt vom Desktop laden'}
      </button>
      {reloadError && (
        <div className="flex items-center gap-1.5 rounded border border-amber-700 bg-amber-900/30 p-2 text-[11px] text-amber-200">
          <Icon icon={AlertTriangle} size="xs" />
          {reloadError}
        </div>
      )}
      <div className="text-center text-[10px] uppercase tracking-wider text-cp-text-faint">
        oder
      </div>
      <label className="block rounded border border-dashed border-cp-border bg-cp-surface-1 p-4 text-center text-sm text-cp-text-secondary">
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFile}
        />
        <span className="cursor-pointer">📂 Cable-Planner-Datei (.json) wählen…</span>
      </label>
      <div className="text-center">
        <button
          type="button"
          onClick={() => setPasteOpen((v) => !v)}
          className="text-xs text-cp-text-muted underline hover:text-cp-text"
        >
          {pasteOpen ? 'Einfügen abbrechen' : 'Oder JSON einfügen…'}
        </button>
      </div>
      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={8}
            className="w-full rounded border border-cp-border bg-cp-bg p-2 font-mono text-xs text-cp-text"
            placeholder="{ ... cable-planner project json ... }"
          />
          <button
            type="button"
            onClick={() => tryParse(pasted)}
            className="w-full rounded bg-cp-accent px-3 py-2 text-sm text-white hover:opacity-90"
          >
            Projekt laden
          </button>
        </div>
      )}
      {error && (
        <div className="rounded border border-red-700 bg-red-950 p-3 text-xs text-red-200">
          {error}
        </div>
      )}
    </div>
  )
}

/** Inputs/Outputs-Detail eines Geräts — wiederverwendet von der Karten-Liste
 *  (DeviceCard) UND von der Planansicht (#180, getipptes Gerät). */
const DevicePortDetail = ({
  device,
  cables,
  checks,
  onTogglePort,
  allEquipment,
  highlightPortId,
}: {
  device: CablePlannerProject['equipment'][number]
  cables: CablePlannerProject['cables']
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  allEquipment: CablePlannerProject['equipment']
  /** QR-Lookup: hervorzuhebender Port (Treffer eines Kabel-Scans). */
  highlightPortId?: string
}) => {
  const inputCables = useMemo(
    () => cables.filter((c) => c.toEquipmentId === device.id),
    [cables, device.id],
  )
  const outputCables = useMemo(
    () => cables.filter((c) => c.fromEquipmentId === device.id),
    [cables, device.id],
  )
  return (
    <div className="p-2 text-xs">
      <PortList
        label="Inputs"
        deviceId={device.id}
        ports={device.inputs ?? []}
        cables={inputCables}
        mode="in"
        checks={checks}
        onTogglePort={onTogglePort}
        allEquipment={allEquipment}
        highlightPortId={highlightPortId}
      />
      <PortList
        label="Outputs"
        deviceId={device.id}
        ports={device.outputs ?? []}
        cables={outputCables}
        mode="out"
        checks={checks}
        onTogglePort={onTogglePort}
        allEquipment={allEquipment}
        highlightPortId={highlightPortId}
      />
    </div>
  )
}

const DeviceCard = ({
  device,
  cables,
  checks,
  onTogglePort,
  onOpenChange,
  allEquipment,
  autoOpenKey,
  highlightPortId,
}: {
  device: CablePlannerProject['equipment'][number]
  cables: CablePlannerProject['cables']
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  /** User-Request: AddCableModal soll das gerade aufgeklappte Geraet
   *  als "Von Geraet" vorbelegen — der Parent merkt sich die letzte
   *  Open-Aktion via diesem Callback. */
  onOpenChange?: (deviceId: string, open: boolean) => void
  allEquipment: CablePlannerProject['equipment']
  /** QR-Lookup: wenn gesetzt (Nonce), Karte aufklappen, hinscrollen und
   *  kurz hervorheben. Nonce-Wechsel triggert das erneut. */
  autoOpenKey?: number
  /** QR-Lookup: Port, der beim Treffer hervorgehoben werden soll. */
  highlightPortId?: string
}) => {
  const totalPorts = (device.inputs?.length ?? 0) + (device.outputs?.length ?? 0)
  const checkedPorts = [...(device.inputs ?? []), ...(device.outputs ?? [])].filter(
    (p) => checks.ports[portKey(device.id, p.id)],
  ).length

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (autoOpenKey == null) return
    const el = detailsRef.current
    if (el) {
      el.open = true
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2400)
    return () => clearTimeout(t)
  }, [autoOpenKey])

  return (
    <details
      ref={detailsRef}
      className={`rounded border bg-cp-surface-1 open:bg-cp-surface-1/80 ${
        flash ? 'border-cp-accent ring-2 ring-cp-accent/70' : 'border-cp-border-muted'
      }`}
      onToggle={(e) => onOpenChange?.(device.id, (e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        <span className="flex-1 truncate font-medium text-cp-text">{device.name}</span>
        <span className="text-[10px] text-cp-text-muted">
          {device.category}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            checkedPorts === totalPorts && totalPorts > 0
              ? 'bg-emerald-700 text-emerald-50'
              : 'bg-cp-surface-4 text-cp-text'
          }`}
        >
          {checkedPorts}/{totalPorts}
        </span>
      </summary>
      <div className="border-t border-cp-border-muted">
        <DevicePortDetail
          device={device}
          cables={cables}
          checks={checks}
          onTogglePort={onTogglePort}
          allEquipment={allEquipment}
          highlightPortId={highlightPortId}
        />
      </div>
    </details>
  )
}

/** #180 — Selbst-enthaltene Plan-SVG für die Mobile-Planansicht. Tippbare
 *  Geräte (Highlight des gewählten); kein ReactFlow/Store. */
const MobilePlanSvg = ({
  project,
  selectedId,
  onTapDevice,
}: {
  project: CablePlannerProject
  selectedId: string | null
  onTapDevice: (id: string) => void
}) => {
  const bbox = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const add = (x: number, y: number, w: number, h: number): void => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h)
    }
    for (const e of project.equipment) add(e.x, e.y, e.width ?? 240, e.height ?? 80)
    for (const l of project.locations ?? []) add(l.x, l.y, l.width, l.height)
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1000, h: 700 }
    const pad = 50
    return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad }
  }, [project])
  const centerById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const e of project.equipment) m.set(e.id, { x: e.x + (e.width ?? 240) / 2, y: e.y + (e.height ?? 80) / 2 })
    return m
  }, [project])

  // #504 — Pinch-/Wheel-Zoom + Pan NUR für den Plan, ohne dass die ganze
  // Seite (Browser) zoomt. Umsetzung als CSS-Transform auf dem (fit-)SVG;
  // Gesten laufen in Screen-Pixeln im Container. `touch-action: none` +
  // Safari-gesture*-preventDefault verhindern den Seiten-Zoom.
  const containerRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  type Gesture =
    | { mode: 'pan'; startX: number; startY: number; baseX: number; baseY: number }
    | { mode: 'pinch'; d0: number; mx: number; my: number; s0: number; bx: number; by: number }
  const gestureRef = useRef<Gesture | null>(null)
  const movedRef = useRef(false)
  const lastTapRef = useRef(0)
  const MIN_S = 1
  const MAX_S = 8
  const clampS = (s: number): number => Math.min(MAX_S, Math.max(MIN_S, s))
  const rel = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = containerRef.current?.getBoundingClientRect()
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) }
  }
  // Zoom auf einen Container-Punkt (px,py): der darunterliegende Plan-Punkt
  // bleibt fix.
  const zoomAt = (px: number, py: number, nextS: number): void => {
    const v = viewRef.current
    const ns = clampS(nextS)
    const wx = (px - v.x) / v.s
    const wy = (py - v.y) / v.s
    setView({ s: ns, x: px - ns * wx, y: py - ns * wy })
  }
  const dist2 = (a: React.Touch, b: React.Touch): number => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

  // Native, nicht-passive Listener: Wheel (Desktop) + Safari-Gesten
  // unterdrücken den Seiten-Zoom zuverlässig (touch-action allein reicht in
  // Safari nicht).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const p = rel(e.clientX, e.clientY)
      const v = viewRef.current
      const ns = clampS(v.s * Math.exp(-e.deltaY * 0.0015))
      const wx = (p.x - v.x) / v.s
      const wy = (p.y - v.y) / v.s
      setView({ s: ns, x: p.x - ns * wx, y: p.y - ns * wy })
    }
    const prevent = (e: Event): void => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', prevent)
    el.addEventListener('gesturechange', prevent)
    el.addEventListener('gestureend', prevent)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', prevent)
      el.removeEventListener('gesturechange', prevent)
      el.removeEventListener('gestureend', prevent)
    }
  }, [])

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>): void => {
    movedRef.current = false
    if (e.touches.length >= 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      const m = rel((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      const v = viewRef.current
      gestureRef.current = { mode: 'pinch', d0: dist2(a, b), mx: m.x, my: m.y, s0: v.s, bx: v.x, by: v.y }
    } else if (e.touches.length === 1) {
      const p = rel(e.touches[0].clientX, e.touches[0].clientY)
      const v = viewRef.current
      gestureRef.current = { mode: 'pan', startX: p.x, startY: p.y, baseX: v.x, baseY: v.y }
    }
  }
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
    const g = gestureRef.current
    if (!g) return
    if (g.mode === 'pinch' && e.touches.length >= 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      if (g.d0 <= 0) return
      const ns = clampS(g.s0 * (dist2(a, b) / g.d0))
      const m = rel((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2)
      const wx = (g.mx - g.bx) / g.s0
      const wy = (g.my - g.by) / g.s0
      setView({ s: ns, x: m.x - ns * wx, y: m.y - ns * wy })
      movedRef.current = true
    } else if (g.mode === 'pan' && e.touches.length === 1) {
      const p = rel(e.touches[0].clientX, e.touches[0].clientY)
      const dx = p.x - g.startX
      const dy = p.y - g.startY
      if (Math.hypot(dx, dy) > 6) movedRef.current = true
      setView({ s: viewRef.current.s, x: g.baseX + dx, y: g.baseY + dy })
    }
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
    if (e.touches.length === 0) {
      if (!movedRef.current) {
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          setView({ s: 1, x: 0, y: 0 }) // Doppeltipp = zurück auf Fit
          movedRef.current = true // den folgenden Geräte-Klick schlucken
        }
        lastTapRef.current = now
      }
      gestureRef.current = null
    } else if (e.touches.length === 1 && gestureRef.current?.mode === 'pinch') {
      const p = rel(e.touches[0].clientX, e.touches[0].clientY)
      const v = viewRef.current
      gestureRef.current = { mode: 'pan', startX: p.x, startY: p.y, baseX: v.x, baseY: v.y }
    }
  }
  const handleTap = (id: string): void => {
    // Nach Pan/Pinch keinen Geräte-Tap auslösen.
    if (movedRef.current) {
      movedRef.current = false
      return
    }
    onTapDevice(id)
  }
  const zoomButton = (factor: number | 'fit'): void => {
    const r = containerRef.current?.getBoundingClientRect()
    if (factor === 'fit') {
      setView({ s: 1, x: 0, y: 0 })
      return
    }
    zoomAt((r?.width ?? 0) / 2, (r?.height ?? 0) / 2, viewRef.current.s * factor)
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: 'none', background: '#0f172a' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <svg
        viewBox={`${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: '#0f172a', transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transformOrigin: '0 0' }}
      >
      {(project.locations ?? []).map((l) => (
        <rect key={l.id} x={l.x} y={l.y} width={l.width} height={l.height} rx={10} fill={l.color} fillOpacity={0.06} stroke={l.color} strokeWidth={2} />
      ))}
      {project.cables.map((c) => {
        const a = centerById.get(c.fromEquipmentId); const b = centerById.get(c.toEquipmentId)
        if (!a || !b) return null
        const pts = [a, ...(c.waypoints ?? []).map((wp) => ({ x: wp.x, y: wp.y })), b].map((p) => `${p.x},${p.y}`).join(' ')
        return <polyline key={c.id} points={pts} fill="none" stroke={styleForLayer(c.layer).color} strokeWidth={2.5} opacity={0.8} />
      })}
      {project.equipment.map((e) => {
        const w = e.width ?? 240; const h = e.height ?? 80
        const sel = e.id === selectedId
        const accent = sel ? '#38bdf8' : (e.nodeColor ?? '#334155')
        return (
          <g key={e.id} style={{ cursor: 'pointer' }} onClick={() => handleTap(e.id)}>
            <rect x={e.x} y={e.y} width={w} height={h} rx={6} fill="#1e293b" stroke={accent} strokeWidth={sel ? 4 : 2} />
            <rect x={e.x} y={e.y} width={w} height={22} rx={6} fill={accent} />
            <text x={e.x + 8} y={e.y + 16} fill="#ffffff" fontSize={12} fontFamily="sans-serif" fontWeight={600}>{e.name}</text>
            {e.subtitle && <text x={e.x + 8} y={e.y + 40} fill="#94a3b8" fontSize={11} fontFamily="sans-serif">{e.subtitle}</text>}
          </g>
        )
      })}
      </svg>
      {/* #504 — Zoom-Buttons (für Geräte ohne Pinch und als sichtbarer Hinweis). */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button type="button" aria-label="Vergrößern" onClick={() => zoomButton(1.4)} className="h-9 w-9 rounded-full bg-cp-surface-3/90 text-lg font-bold text-cp-text shadow ring-1 ring-cp-border active:bg-cp-surface-4">+</button>
        <button type="button" aria-label="Verkleinern" onClick={() => zoomButton(1 / 1.4)} className="h-9 w-9 rounded-full bg-cp-surface-3/90 text-lg font-bold text-cp-text shadow ring-1 ring-cp-border active:bg-cp-surface-4">−</button>
        <button type="button" aria-label="Einpassen" onClick={() => zoomButton('fit')} className="h-9 w-9 rounded-full bg-cp-surface-3/90 text-base text-cp-text shadow ring-1 ring-cp-border active:bg-cp-surface-4">⤢</button>
      </div>
    </div>
  )
}

const PortList = ({
  label,
  deviceId,
  ports,
  cables,
  mode,
  checks,
  onTogglePort,
  allEquipment,
  highlightPortId,
}: {
  label: string
  deviceId: string
  ports: CablePlannerProject['equipment'][number]['inputs']
  cables: CablePlannerProject['cables']
  mode: 'in' | 'out'
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  allEquipment: CablePlannerProject['equipment']
  /** QR-Lookup: dieser Port wird mit einem Ring hervorgehoben. */
  highlightPortId?: string
}) => {
  if (ports.length === 0) return null
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-faint">{label}</div>
      <ul className="space-y-1">
        {ports.map((p) => {
          const cable = cables.find(
            (c) =>
              (mode === 'in' ? c.toPortId : c.fromPortId) === p.id,
          )
          // Resolve the OTHER endpoint of the cable so the field tech
          // sees "what plugs in here", not just the cable type — the
          // user's main mobile-app feedback was that just "BNC 1m"
          // wasn't useful when racking the gear.
          let otherDevice: CablePlannerProject['equipment'][number] | undefined
          let otherPort: CablePlannerProject['equipment'][number]['inputs'][number] | undefined
          // #285 — Wandler-Verfolgung: wenn das direkte Other-Geraet als
          // Konverter markiert ist, folgen wir der Kette weiter bis ein
          // nicht-Wandler-Geraet erreicht ist. Sammelt die durchlaufenen
          // Wandler-Namen fuer ein "via X"-Suffix.
          const bridgeNames: string[] = []
          if (cable) {
            const isFromMe = cable.fromEquipmentId === deviceId
            let otherEqId = isFromMe ? cable.toEquipmentId : cable.fromEquipmentId
            let otherPortId = isFromMe ? cable.toPortId : cable.fromPortId
            otherDevice = allEquipment.find((e) => e.id === otherEqId)
            otherPort =
              otherDevice?.inputs?.find((q) => q.id === otherPortId) ??
              otherDevice?.outputs?.find((q) => q.id === otherPortId)
            // Pass-Through fuer Wandler. Heuristik: genau 1 Folge-Kabel
            // (vorwaerts wenn wir mode='out' sind, rueckwaerts bei 'in').
            const visited = new Set<string>()
            for (let depth = 0; depth < 10; depth++) {
              if (!otherDevice || !otherDevice.isConverter) break
              if (visited.has(otherDevice.id)) break
              visited.add(otherDevice.id)
              const followCables = cables.filter((c2) =>
                mode === 'out'
                  ? c2.fromEquipmentId === otherDevice!.id
                  : c2.toEquipmentId === otherDevice!.id,
              )
              if (followCables.length !== 1) break
              const fc = followCables[0]
              bridgeNames.push(otherDevice.name)
              otherEqId = mode === 'out' ? fc.toEquipmentId : fc.fromEquipmentId
              otherPortId = mode === 'out' ? fc.toPortId : fc.fromPortId
              otherDevice = allEquipment.find((e) => e.id === otherEqId)
              otherPort =
                otherDevice?.inputs?.find((q) => q.id === otherPortId) ??
                otherDevice?.outputs?.find((q) => q.id === otherPortId)
            }
          }
          const checked = !!checks.ports[portKey(deviceId, p.id)]
          const highlighted = highlightPortId === p.id
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onTogglePort(deviceId, p.id)}
                className={`flex w-full items-start gap-2 rounded border px-2 py-2 text-left ${
                  checked
                    ? 'border-emerald-700 bg-emerald-900/30 text-emerald-100'
                    : 'border-cp-border-muted bg-cp-bg text-cp-text hover:border-cp-border'
                } ${highlighted ? 'ring-2 ring-cp-accent' : ''}`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    checked ? 'bg-emerald-600 text-white' : 'border border-cp-border bg-cp-surface-1'
                  }`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span className="flex-1 min-w-0 break-words">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-[10px] text-cp-text-faint">
                      {p.connectorType}
                    </span>
                    {cable && (
                      <span className="text-[10px] text-cp-text-muted">
                        {cable.type} · {cable.length} m
                      </span>
                    )}
                  </span>
                  {/* v7.7.3 — Destination call-out: prominent line that
                      shows the field tech which device + port the other
                      end of THIS cable goes to. Was previously truncated
                      and too small to be useful on a phone. */}
                  {cable && otherDevice && (
                    <span className="mt-1 block rounded bg-cp-accent/60 px-2 py-1 text-xs text-cp-accent">
                      <span className="text-[10px] uppercase tracking-wide text-cp-accent/80">
                        → geht zu
                      </span>
                      <span className="ml-1 font-semibold text-white">
                        {otherDevice.name}
                      </span>
                      {otherPort && (
                        <>
                          <span className="mx-1 text-cp-accent">·</span>
                          <span>{otherPort.name}</span>
                          {otherPort.connectorType && (
                            <span className="ml-1 text-[10px] text-cp-accent/80">
                              ({otherPort.connectorType})
                            </span>
                          )}
                        </>
                      )}
                      {bridgeNames.length > 0 && (
                        <span className="mt-0.5 block text-[10px] text-cp-accent/80">
                          via {bridgeNames.join(' → ')}
                        </span>
                      )}
                    </span>
                  )}
                  {cable && !otherDevice && (
                    <span className="mt-1 block text-[11px] italic text-cp-text-faint">
                      Offenes Ende
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// QR-Scan-Lookup — die Companion läuft im Studio-LAN typisch über http://,
// wo Browser getUserMedia (Kamera) sperren (kein Secure-Context). Wir bieten
// daher IMMER eine Texteingabe (gescannten Code einfügen / ID tippen) und
// blenden den Live-Kamera-Scan nur ein, wenn der Context ihn erlaubt
// (HTTPS/localhost/file:// + BarcodeDetector vorhanden).
type BarcodeDetectorLike = {
  detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike
const getBarcodeDetector = (): BarcodeDetectorCtor | undefined =>
  (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector

const cameraScanSupported = (): boolean =>
  typeof window !== 'undefined' &&
  window.isSecureContext === true &&
  !!navigator.mediaDevices?.getUserMedia &&
  !!getBarcodeDetector()

/** Vollbild-Overlay: Live-Kamera-Scan (wo möglich) + manuelle Eingabe. */
const QrFindOverlay = ({
  onSubmit,
  onClose,
}: {
  onSubmit: (raw: string) => void
  onClose: () => void
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [text, setText] = useState('')
  const [camError, setCamError] = useState<string | null>(null)
  const canScan = cameraScanSupported()

  useEffect(() => {
    if (!canScan) return
    let stream: MediaStream | null = null
    let raf = 0
    let cancelled = false
    const Detector = getBarcodeDetector()
    if (!Detector) return
    const detector = new Detector({ formats: ['qr_code'] })
    const tick = async () => {
      if (cancelled || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        const hit = codes.find((c) => c.rawValue)?.rawValue
        if (hit) {
          onSubmit(hit)
          return
        }
      } catch {
        /* transienter Decode-Fehler — weiter pollen */
      }
      raf = requestAnimationFrame(() => void tick())
    }
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) return
        const v = videoRef.current
        if (!v) return
        v.srcObject = stream
        await v.play()
        raf = requestAnimationFrame(() => void tick())
      } catch (e) {
        setCamError((e as Error).message || 'Kamera nicht verfügbar')
      }
    }
    void start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // onSubmit ist stabil (Parent-Closure pro Render); bewusst nur canScan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canScan])

  const submitText = () => {
    const v = text.trim()
    if (v) onSubmit(v)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-cp-bg/95 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-cp-text">
          <Icon icon={QrCode} size="sm" /> QR / ID finden
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-cp-surface-3 p-1.5 text-cp-text-secondary hover:bg-cp-surface-4"
          aria-label="Schließen"
        >
          <Icon icon={X} size="sm" />
        </button>
      </div>

      {canScan ? (
        <div className="relative mb-3 overflow-hidden rounded-lg border border-cp-border bg-black">
          <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 m-auto h-40 w-40 rounded-lg border-2 border-cp-accent/80" />
          {camError && (
            <div className="absolute inset-x-0 bottom-0 bg-amber-900/80 px-2 py-1 text-[11px] text-amber-100">
              {camError}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-3 rounded border border-cp-border bg-cp-surface-1 px-3 py-2 text-[11px] text-cp-text-muted">
          Kamera-Scan hier nicht verfügbar (kein HTTPS/Secure-Context). Scanne das
          Etikett mit der Kamera-App deines Geräts und füge den Code unten ein —
          oder tippe die Kabel-/Asset-ID.
        </div>
      )}

      <label className="mb-1 block text-[11px] text-cp-text-muted">Code / ID</label>
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitText()
          }}
          autoFocus={!canScan}
          placeholder="z.B. C-0001, A-0007 oder cableplanner://…"
          className="flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-2 text-sm text-cp-text"
        />
        <button
          type="button"
          onClick={submitText}
          className="flex items-center gap-1 rounded bg-cp-accent px-3 py-2 text-xs text-white hover:opacity-90"
        >
          <Icon icon={Search} size="sm" /> Finden
        </button>
      </div>
    </div>
  )
}

const ProjectView = ({
  project,
  online,
  cachedAt,
  onUnload,
}: {
  project: CablePlannerProject
  online?: boolean
  cachedAt?: string | null
  onUnload: () => void
}) => {
  const projectName = project.metadata?.name || 'cable-planner'
  // v7.9.3 — Initial-State kommt jetzt PRIMÄR aus project.checkState
  // (Desktop ist Source-of-Truth) und nur als Fallback aus localStorage
  // (für Offline-Sessions). Nach jedem Toggle wird der State zusätzlich
  // an /checks gepostet, damit das Canvas das Häkchen live rendert.
  const [checks, setChecks] = useState<CheckState>(() => {
    const fromProject = (project as unknown as { checkState?: CheckState }).checkState
    if (fromProject && (fromProject.ports || fromProject.cables)) {
      return {
        ports: fromProject.ports ?? {},
        cables: fromProject.cables ?? {},
      }
    }
    return loadChecks(projectName)
  })
  const [filter, setFilter] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)

  useEffect(() => {
    saveChecks(projectName, checks)
    // POST to the desktop server so the Cable Planner Canvas shows
    // the green tick at this port immediately. Fire-and-forget; offline
    // Mobile-Sessions fallen auf localStorage zurück (siehe oben).
    void apiFetch('/checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checks),
    }).catch(() => {})
  }, [projectName, checks])

  // v7.9.54 — Reconnect-Resync. Wenn der Online-Status von false → true
  // wechselt (= Funkverbindung wieder da), schicken wir EINMAL den
  // gesamten lokalen Check-State an /checks damit alle offline
  // gesetzten Häkchen ans Desktop syncen. Ohne diesen explizten Push
  // wären Offline-Toggles nur in localStorage; das Canvas am Desktop
  // würde sie erst beim nächsten regulären Toggle sehen.
  const wasOnlineRef = useRef(online ?? true)
  useEffect(() => {
    const wasOnline = wasOnlineRef.current
    wasOnlineRef.current = online ?? true
    if (online && !wasOnline) {
      void apiFetch('/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checks),
      }).catch(() => {})
    }
  }, [online, checks])

  // #180 — Zwei Betriebsmodi: Patchliste (Default) + Planansicht.
  const [viewMode, setViewMode] = useState<'list' | 'plan'>('list')
  const [planSelectedId, setPlanSelectedId] = useState<string | null>(null)
  const [showAddCable, setShowAddCable] = useState(false)
  // User-Request: wenn schon eine Geraete-Karte aufgeklappt ist, soll
  // "+Von Geraet" beim Oeffnen von "+Kabel" auf das offene Geraet
  // vorausgewaehlt sein. Wir merken uns die zuletzt aufgeklappte
  // Karte (Last-Open-Wins) — beim Toggle einer Karte wird die ID hier
  // gesetzt (oder geloescht wenn die selbe wieder geschlossen wird).
  const [lastOpenedDeviceId, setLastOpenedDeviceId] = useState<string | null>(null)

  // QR-Scan-Lookup — Overlay-Sichtbarkeit, Treffer-Fokus (Gerät + optional
  // Port, mit Nonce damit erneutes Scannen desselben Geräts neu „blitzt") und
  // eine kurze Status-Meldung.
  const [findOpen, setFindOpen] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [focus, setFocus] = useState<{ deviceId: string; portId?: string; nonce: number } | null>(
    null,
  )
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleLookup = (raw: string) => {
    setFindOpen(false)
    const ref = parseQrPayload(raw)
    const match = ref ? lookupQrRef(ref, project.cables, project.equipment) : null
    if (!match) {
      setFocus(null)
      setLookupMsg({ ok: false, text: `Kein Treffer für „${raw.slice(0, 40)}"` })
      return
    }
    setViewMode('list')
    setFilter('')
    if (match.kind === 'equipment') {
      setFocus({ deviceId: match.item.id, nonce: Date.now() })
      setLookupMsg({ ok: true, text: `Gerät: ${match.item.name}` })
    } else {
      const c = match.item
      setFocus({ deviceId: c.fromEquipmentId, portId: c.fromPortId, nonce: Date.now() })
      setLookupMsg({ ok: true, text: `Kabel ${cableLabelId(c)}: ${c.name || c.type}` })
    }
  }

  // Deep-Link beim ersten Render auflösen (einmalig).
  const initialRan = useRef(false)
  useEffect(() => {
    if (initialRan.current || !INITIAL_LOOKUP) return
    initialRan.current = true
    handleLookup(INITIAL_LOOKUP)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Treffer-Meldung nach ein paar Sekunden ausblenden.
  useEffect(() => {
    if (!lookupMsg) return
    const t = setTimeout(() => setLookupMsg(null), 4000)
    return () => clearTimeout(t)
  }, [lookupMsg])

  // v7.7.3 — Toggling a port toggles BOTH endpoints of the cable that's
  // plugged into it (and the cable itself), because physically plugging
  // in one connector ALWAYS plugs in the other end too. Open-end ports
  // (no cable attached) still toggle individually. Without this the
  // field tech had to remember to find and tick the other device by
  // hand, which defeats the point of the checklist.
  const togglePort = (deviceId: string, portId: string) => {
    setChecks((prev) => {
      const key = portKey(deviceId, portId)
      const newState = !prev.ports[key]
      const cable = project.cables.find(
        (c) =>
          (c.fromEquipmentId === deviceId && c.fromPortId === portId) ||
          (c.toEquipmentId === deviceId && c.toPortId === portId),
      )
      const nextPorts: Record<string, boolean> = { ...prev.ports, [key]: newState }
      const nextCables: Record<string, boolean> = { ...prev.cables }
      if (cable) {
        const isFromMe = cable.fromEquipmentId === deviceId
        const otherKey = portKey(
          isFromMe ? cable.toEquipmentId : cable.fromEquipmentId,
          isFromMe ? cable.toPortId : cable.fromPortId,
        )
        nextPorts[otherKey] = newState
        nextCables[cable.id] = newState
      }
      return { ...prev, ports: nextPorts, cables: nextCables }
    })
  }

  const filteredDevices = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return project.equipment.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q)) {
        return false
      }
      if (onlyOpen) {
        const total = (d.inputs?.length ?? 0) + (d.outputs?.length ?? 0)
        const done = [...(d.inputs ?? []), ...(d.outputs ?? [])].filter(
          (p) => checks.ports[portKey(d.id, p.id)],
        ).length
        if (total === 0 || done === total) return false
      }
      return true
    })
  }, [project.equipment, filter, onlyOpen, checks])

  const totalPorts = useMemo(
    () =>
      project.equipment.reduce(
        (sum, d) => sum + (d.inputs?.length ?? 0) + (d.outputs?.length ?? 0),
        0,
      ),
    [project.equipment],
  )
  const checkedPorts = useMemo(
    () => Object.values(checks.ports).filter(Boolean).length,
    [checks],
  )

  return (
    <div className="mx-auto max-w-md p-3">
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-cp-border-muted bg-cp-bg/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUnload}
            className="rounded bg-cp-surface-3 px-2 py-1 text-[11px] text-cp-text-secondary hover:bg-cp-surface-4"
            title="Anderes Projekt laden"
          >
            ◀
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-cp-text">{projectName}</h1>
            <div className="text-[10px] text-cp-text-muted">
              {project.equipment.length} Geräte · {project.cables.length} Kabel ·{' '}
              <span
                className={
                  checkedPorts === totalPorts
                    ? 'text-emerald-300'
                    : checkedPorts > 0
                      ? 'text-amber-300'
                      : 'text-cp-text-faint'
                }
              >
                {checkedPorts}/{totalPorts} Ports gesteckt
              </span>
            </div>
          </div>
        </div>
        {/* #180 — Modus-Umschalter: Patchliste ↔ Plan */}
        <div className="mt-2 grid grid-cols-2 gap-1 rounded bg-cp-surface-1 p-0.5">
          {(['list', 'plan'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`rounded px-2 py-1 text-[11px] font-medium ${
                viewMode === m ? 'bg-cp-accent text-white' : 'text-cp-text-secondary hover:bg-cp-surface-3'
              }`}
            >
              {m === 'list' ? 'Patchliste' : 'Plan'}
            </button>
          ))}
        </div>
        {viewMode === 'list' && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Suchen…"
            className="flex-1 rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-xs text-cp-text"
          />
          <label className="flex items-center gap-1 text-[11px] text-cp-text-secondary">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            offen
          </label>
          <button
            type="button"
            onClick={() => setFindOpen(true)}
            className="flex items-center rounded bg-cp-surface-3 px-2 py-1 text-[11px] text-cp-text hover:bg-cp-surface-4"
            title="Per QR-Scan oder ID zu Kabel/Gerät springen"
          >
            <Icon icon={QrCode} size="xs" />
          </button>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="rounded bg-cp-surface-3 px-2 py-1 text-[11px] text-amber-300 hover:bg-cp-surface-4"
            title="Korrektur/Problem melden (Feld-Rückkanal)"
          >
            Meldung
          </button>
          <button
            type="button"
            onClick={() => setShowAddCable(true)}
            className="rounded bg-cp-accent px-2 py-1 text-[11px] text-white hover:opacity-90"
            title="Kabel vor Ort hinzufügen (Dropdowns)"
          >
            + Kabel
          </button>
        </div>
        )}
        {lookupMsg && (
          <div
            className={`mt-2 rounded px-2 py-1 text-[11px] ${
              lookupMsg.ok
                ? 'border border-cp-accent/60 bg-cp-accent/30 text-cp-accent'
                : 'border border-amber-700/60 bg-amber-900/30 text-amber-200'
            }`}
          >
            {lookupMsg.ok ? '📍 ' : ''}
            {lookupMsg.text}
          </div>
        )}
        {/* v7.9.54 — Offline-Banner. Erscheint sobald der Poll fehlschlägt
            oder der initiale Load aus dem Cache kam. Klar erkennbar in
            Amber, damit der User weiß dass seine Checks gerade nur
            lokal sind und beim Re-Connect automatisch syncen. */}
        {online === false && (
          <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1 text-[10px] text-amber-200">
            <Icon icon={AlertTriangle} size="xs" className="mt-0.5 shrink-0" />
            <span>
              Offline · Cache vom {cachedAt ? new Date(cachedAt).toLocaleString() : '?'} · Checks
              werden bei Re-Connect synchronisiert
            </span>
          </div>
        )}
      </header>
      {showAddCable && (
        <AddCableModal
          project={project}
          initialFromEquipmentId={lastOpenedDeviceId ?? undefined}
          onClose={() => setShowAddCable(false)}
        />
      )}
      {findOpen && (
        <QrFindOverlay onSubmit={handleLookup} onClose={() => setFindOpen(false)} />
      )}
      {showReport && (
        <MobileReportModal project={project} onClose={() => setShowReport(false)} />
      )}
      {viewMode === 'list' ? (
        <div className="space-y-2 pb-8">
          {filteredDevices.length === 0 ? (
            <div className="rounded border border-dashed border-cp-border bg-cp-surface-1 p-6 text-center text-xs text-cp-text-faint">
              Keine Geräte passen zum Filter.
            </div>
          ) : (
            filteredDevices.map((d) => (
              <DeviceCard
                key={d.id}
                device={d}
                cables={project.cables}
                checks={checks}
                onTogglePort={togglePort}
                autoOpenKey={focus?.deviceId === d.id ? focus.nonce : undefined}
                highlightPortId={focus?.deviceId === d.id ? focus.portId : undefined}
                onOpenChange={(deviceId, open) => {
                  setLastOpenedDeviceId((prev) => {
                    if (open) return deviceId
                    // Beim Schliessen nur die ID raeumen wenn es genau die
                    // war die als letzte offen markiert wurde — sonst koennte
                    // ein gerade-geschlossenes Geraet das gerade-geoeffnete
                    // ueberschreiben (Reihenfolge der onToggle-Events).
                    return prev === deviceId ? null : prev
                  })
                }}
                allEquipment={project.equipment}
              />
            ))
          )}
        </div>
      ) : (
        // #180 — Planansicht: Plan oben (bleibt stehen), getipptes Gerät
        // öffnet darunter seine Patchliste (scrollbar) ohne den Plan
        // wegzuscrollen.
        <PlanModeView
          project={project}
          checks={checks}
          onTogglePort={togglePort}
          selectedId={planSelectedId}
          onSelect={(id) => setPlanSelectedId((prev) => (prev === id ? null : id))}
        />
      )}
    </div>
  )
}

/** #180 — Planansicht-Layout: fixierter Plan oben + scrollbares Geräte-Detail
 *  darunter. */
const PlanModeView = ({
  project,
  checks,
  onTogglePort,
  selectedId,
  onSelect,
}: {
  project: CablePlannerProject
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) => {
  const selected = project.equipment.find((e) => e.id === selectedId) ?? null
  return (
    <div className="-mx-3 flex flex-col" style={{ height: 'calc(100vh - 132px)' }}>
      <div className="h-[42vh] shrink-0 border-y border-cp-border-muted bg-cp-bg">
        <MobilePlanSvg project={project} selectedId={selectedId} onTapDevice={onSelect} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-8 pt-2">
        {!selected ? (
          <div className="rounded border border-dashed border-cp-border bg-cp-surface-1 p-5 text-center text-xs text-cp-text-faint">
            Tippe ein Gerät im Plan an, um seine Patchliste zu sehen.
          </div>
        ) : (
          <div className="rounded border border-cp-border bg-cp-surface-1">
            <div className="flex items-center justify-between gap-2 border-b border-cp-border-muted px-3 py-2">
              <span className="truncate text-sm font-medium text-cp-text">{selected.name}</span>
              <span className="shrink-0 text-[10px] text-cp-text-muted">{selected.category}</span>
            </div>
            <DevicePortDetail
              device={selected}
              cables={project.cables}
              checks={checks}
              onTogglePort={onTogglePort}
              allEquipment={project.equipment}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Verbindungs-Umschalter: Lokal (LAN) ↔ Remote (Mobilfunk, eigener Tunnel/Relay).
// Persistiert; „Übernehmen" lädt die App mit der neuen Verbindung neu.
const ConnectionSettings = () => {
  const [open, setOpen] = useState(false)
  const [cfg, setCfg] = useState<ConnConfig>(() => loadConn())

  const apply = () => {
    const next: ConnConfig = { mode: cfg.mode, remoteUrl: cfg.remoteUrl.trim() }
    saveConn(next)
    applyConn(next)
    window.location.reload()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-3 z-[300] flex items-center gap-1 rounded-full border border-cp-border bg-cp-surface-3/90 px-2.5 py-1 text-[11px] text-cp-text shadow-lg backdrop-blur"
        title="Verbindung"
      >
        {cfg.mode === 'remote' ? '📶 Remote' : '🏠 Lokal'}
      </button>
      {open && (
        <div className="fixed inset-0 z-[301] flex items-end justify-center bg-black/60 p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg border border-cp-border bg-cp-surface-1 p-3 text-cp-text shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-semibold">Verbindung</div>
            <div className="mb-3 grid grid-cols-2 gap-1 rounded bg-cp-bg p-0.5">
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, mode: 'local' })}
                className={`rounded px-2 py-1.5 text-xs font-medium ${cfg.mode === 'local' ? 'bg-cp-accent text-white' : 'text-cp-text-secondary hover:bg-cp-surface-3'}`}
              >
                🏠 Lokal (LAN)
              </button>
              <button
                type="button"
                onClick={() => setCfg({ ...cfg, mode: 'remote' })}
                className={`rounded px-2 py-1.5 text-xs font-medium ${cfg.mode === 'remote' ? 'bg-cp-accent text-white' : 'text-cp-text-secondary hover:bg-cp-surface-3'}`}
              >
                📶 Remote (Mobilfunk)
              </button>
            </div>
            {cfg.mode === 'remote' && (
              <label className="block text-xs text-cp-text-secondary">
                Server-URL (dein Tunnel/Relay auf den Desktop, inkl. ?t=Token)
                <input
                  value={cfg.remoteUrl}
                  onChange={(e) => setCfg({ ...cfg, remoteUrl: e.target.value })}
                  placeholder="https://mein-desktop.example.com/?t=…"
                  className="mt-1 w-full rounded border border-cp-border bg-cp-bg p-2 text-xs"
                />
              </label>
            )}
            <p className="mt-2 text-[11px] text-cp-text-faint">
              Lokal: nur im selben WLAN. Remote: über mobile Daten via eigenem Tunnel/Relay
              (siehe docs/self-hosted-relay.md). Nichts läuft über fremde Server.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded bg-cp-surface-3 px-3 py-1 text-xs hover:bg-cp-surface-4">
                Abbrechen
              </button>
              <button type="button" onClick={apply} className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600">
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export const MobileApp = () => {
  const [project, setProject] = useState<CablePlannerProject | null>(null)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null)
  // v7.9.54 — Online/Cache-Status. `online === false` zeigt das Banner
  // "Offline — letzter Cache vom DATE" über der UI. Erste-Load-Versuch
  // setzt online basierend auf dem Ergebnis. Spätere Polls toggeln es.
  const [online, setOnline] = useState(true)
  const [cachedAt, setCachedAt] = useState<string | null>(null)

  // When loaded via the desktop app's LAN share server, a sibling
  // /project.json endpoint serves the live project. Auto-fetch on
  // mount; bei Fehlschlag fallback auf den lokalen Offline-Cache damit
  // der Techniker auch ohne Funkverbindung weiter haken setzen kann.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch('/share-info.json', { cache: 'no-store' })
        if (!res.ok) throw new Error(`share-info ${res.status}`)
        const info = (await res.json()) as { ok: boolean; hasProject: boolean }
        if (!info.ok || !info.hasProject) {
          setAutoLoadAttempted(true)
          return
        }
        const projectRes = await apiFetch('/project.json', { cache: 'no-store' })
        if (!projectRes.ok) throw new Error(`project ${projectRes.status}`)
        const data = (await projectRes.json()) as CablePlannerProject
        if (!cancelled && data && Array.isArray(data.equipment)) {
          setProject(data)
          setOnline(true)
          cacheProject(data)
          setCachedAt(new Date().toISOString())
        }
      } catch {
        // Live-Server nicht erreichbar — Offline-Cache versuchen damit
        // die App nicht komplett tot ist.
        const cached = loadCachedProject()
        if (!cancelled && cached) {
          const data = cached.project as CablePlannerProject
          if (data && Array.isArray(data.equipment)) {
            setProject(data)
            setOnline(false)
            setCachedAt(cached.cachedAt)
          }
        } else if (!cancelled) {
          // Kein Cache → manueller File-Picker. autoLoadError nur setzen
          // wenn wir zumindest weiter versucht haben (kein hard error).
          setAutoLoadError(null)
        }
      } finally {
        if (!cancelled) setAutoLoadAttempted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Refresh every 5 s. Erfolgreiche Pulls aktualisieren den Cache UND
  // den Online-Status; Fehler markieren als offline (UI zeigt Banner).
  useEffect(() => {
    if (!project) return
    const id = window.setInterval(async () => {
      try {
        const r = await apiFetch('/project.json', { cache: 'no-store' })
        if (!r.ok) throw new Error(`project ${r.status}`)
        const next = (await r.json()) as CablePlannerProject
        if (next && Array.isArray(next.equipment)) {
          setProject(next)
          setOnline(true)
          cacheProject(next)
          setCachedAt(new Date().toISOString())
        }
      } catch {
        setOnline(false)
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [project !== null])

  return (
    <div className="min-h-screen bg-cp-bg text-cp-text">
      <ConnectionSettings />
      {!autoLoadAttempted ? (
        <div className="grid min-h-screen place-items-center p-4 text-xs text-cp-text-muted">
          <div className="animate-pulse">Lade Projekt vom Desktop…</div>
        </div>
      ) : project ? (
        <ProjectView
          project={project}
          online={online}
          cachedAt={cachedAt}
          onUnload={() => setProject(null)}
        />
      ) : (
        <>
          <ProjectPicker onLoad={setProject} />
          {autoLoadError && (
            <div className="mx-auto mt-2 max-w-md rounded border border-amber-700 bg-amber-950 p-2 text-[11px] text-amber-200">
              Hinweis: Es lief offenbar ein Desktop-Share-Server, aber das Laden ist
              fehlgeschlagen ({autoLoadError}).
            </div>
          )}
        </>
      )}
    </div>
  )
}

// v7.9.54 — Add-Cable-Modal für den Mobile-Viewer.
//
// Use-Case: Techniker steht vor Ort am Gerät, sieht dass das Patch im
// Plan fehlt, will es schnell nachpflegen ohne zum Planer-Laptop zu
// rennen. UI ist bewusst kein Canvas (= 2D-Drag würde am Phone tap-
// freundlich nicht funktionieren) sondern 4 sequentielle Dropdowns:
// Von Gerät → Von Port → Zu Gerät → Zu Port. Optional Name + Typ +
// Länge. POST /cables → Renderer fügt es mit addedFromMobile=true ein.
const AddCableModal = ({
  project,
  initialFromEquipmentId,
  onClose,
}: {
  project: CablePlannerProject
  /** Vorbelegung fuer "Von Geraet". Wird gesetzt wenn beim Oeffnen des
   *  Dialogs bereits eine Geraete-Karte aufgeklappt war (User-Request). */
  initialFromEquipmentId?: string
  onClose: () => void
}) => {
  const [fromEqId, setFromEqId] = useState(initialFromEquipmentId ?? '')
  const [fromPortId, setFromPortId] = useState('')
  const [toEqId, setToEqId] = useState('')
  const [toPortId, setToPortId] = useState('')
  const [name, setName] = useState('')
  const [nameDirty, setNameDirty] = useState(false)
  const [cableType, setCableType] = useState('')
  const [length, setLength] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const sortedEquipment = useMemo(
    () => [...project.equipment].sort((a, b) => a.name.localeCompare(b.name)),
    [project.equipment],
  )
  const fromEq = sortedEquipment.find((e) => e.id === fromEqId)
  const toEq = sortedEquipment.find((e) => e.id === toEqId)
  const fromPorts = fromEq ? [...fromEq.outputs, ...fromEq.inputs] : []
  const toPorts = toEq ? [...toEq.inputs, ...toEq.outputs] : []

  // v7.9.88 / #210 — Set aller Port-IDs die schon irgendwo verkabelt
  // sind. Wird in den Port-Dropdowns benutzt um belegte Ports als
  // "(belegt)" zu markieren, damit der Techniker nicht versehentlich
  // einen schon gepatchten Port auswählt.
  const occupiedPortIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of project.cables) {
      if (c.fromPortId) set.add(c.fromPortId)
      if (c.toPortId) set.add(c.toPortId)
    }
    return set
  }, [project.cables])

  // v7.9.55 — Kabel-Typen aus dem aktuellen Projekt extrahieren
  // (deduped + sortiert), plus immer-vorhandene Defaults. So sieht der
  // User vor Ort dieselben Optionen die im Plan schon verwendet werden,
  // ohne dass wir hier die komplette CableType-Enum hardcoden müssen.
  const cableTypeOptions = useMemo(() => {
    const used = new Set<string>()
    for (const c of project.cables) {
      if (c.type) used.add(String(c.type))
    }
    // Standard-Typen die der Techniker fast immer braucht — wenn das
    // Projekt noch nichts davon hat, kriegt er sie trotzdem im Dropdown.
    const defaults = ['SDI', 'BNC', 'HDMI', 'XLR', 'Ethernet/RJ45', 'Fiber', 'Wireless/RF', 'PowerCON', 'IEC 230V', 'Custom']
    for (const d of defaults) used.add(d)
    return [...used].sort((a, b) => a.localeCompare(b))
  }, [project.cables])

  // Längen aus dem Projekt + Standard-Patches damit auch ein leeres
  // Projekt sofort sinnvolle Auswahl bietet.
  const lengthOptions = useMemo(() => {
    const used = new Set<number>()
    for (const c of project.cables) {
      if (typeof c.length === 'number' && c.length > 0) used.add(c.length)
    }
    for (const d of [0.5, 1, 2, 3, 5, 10, 15, 20, 30, 50, 100]) used.add(d)
    return [...used].sort((a, b) => a - b)
  }, [project.cables])

  // Auto-Suggest für Name: "<Type> <FromDevice> → <ToDevice>". Aktiv
  // solange der User nicht selbst was getippt hat (nameDirty=false).
  // Sobald er manuell editiert, ist die Auto-Logik aus damit wir seine
  // Eingabe nicht überschreiben.
  useEffect(() => {
    if (nameDirty) return
    const parts: string[] = []
    if (cableType) parts.push(cableType)
    if (fromEq && toEq) parts.push(`${fromEq.name} → ${toEq.name}`)
    setName(parts.join(' ').trim())
  }, [cableType, fromEqId, toEqId, nameDirty])

  const canSubmit =
    !!fromEqId && !!fromPortId && !!toEqId && !!toPortId && !busy

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setErr(null)
    try {
      const res = await apiFetch('/cables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEquipmentId: fromEqId,
          fromPortId,
          toEquipmentId: toEqId,
          toPortId,
          name: name.trim() || undefined,
          type: cableType.trim() || undefined,
          length: length ? Number(length) : undefined,
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error(`Server ${res.status}`)
      setDone(true)
      window.setTimeout(onClose, 1200)
    } catch (e) {
      setErr(
        e instanceof Error
          ? `Konnte Kabel nicht senden: ${e.message}. Verbindung zum Desktop prüfen.`
          : 'Konnte Kabel nicht senden.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-t-lg border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl">
        <header className="flex items-center justify-between border-b border-cp-border px-3 py-2">
          <h2 className="text-sm font-semibold">📱 Kabel hinzufügen</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-cp-text-muted hover:bg-cp-surface-3"
          >
            <Icon icon={X} size="sm" />
          </button>
        </header>
        <div className="space-y-3 p-3 text-xs">
          {done ? (
            <div className="rounded border border-emerald-700 bg-emerald-900/30 p-3 text-center text-emerald-200">
              ✓ Kabel gesendet — wird am Desktop mit 📱-Marker eingefügt
            </div>
          ) : (
            <>
              <p className="text-[10px] italic text-cp-text-muted">
                Wird im Plan mit 📱-Badge markiert, damit der Planer sieht dass das
                Kabel vor Ort nachgepflegt wurde.
              </p>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Von Gerät</span>
                <select
                  value={fromEqId}
                  onChange={(e) => {
                    setFromEqId(e.target.value)
                    setFromPortId('')
                  }}
                  className="w-full rounded border border-cp-border bg-cp-bg p-2"
                >
                  <option value="">— wählen —</option>
                  {sortedEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Von Port</span>
                <select
                  value={fromPortId}
                  onChange={(e) => setFromPortId(e.target.value)}
                  disabled={!fromEq}
                  className="w-full rounded border border-cp-border bg-cp-bg p-2 disabled:opacity-40"
                >
                  <option value="">— wählen —</option>
                  {fromPorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.connectorType}){occupiedPortIds.has(p.id) ? ' • belegt' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Zu Gerät</span>
                <select
                  value={toEqId}
                  onChange={(e) => {
                    setToEqId(e.target.value)
                    setToPortId('')
                  }}
                  className="w-full rounded border border-cp-border bg-cp-bg p-2"
                >
                  <option value="">— wählen —</option>
                  {sortedEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Zu Port</span>
                <select
                  value={toPortId}
                  onChange={(e) => setToPortId(e.target.value)}
                  disabled={!toEq}
                  className="w-full rounded border border-cp-border bg-cp-bg p-2 disabled:opacity-40"
                >
                  <option value="">— wählen —</option>
                  {toPorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.connectorType}){occupiedPortIds.has(p.id) ? ' • belegt' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-cp-text-secondary">Typ</span>
                  <select
                    value={cableType}
                    onChange={(e) => setCableType(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-bg p-2"
                  >
                    <option value="">— wählen —</option>
                    {cableTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-cp-text-secondary">Länge (m)</span>
                  <select
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    className="w-full rounded border border-cp-border bg-cp-bg p-2"
                  >
                    <option value="">— wählen —</option>
                    {lengthOptions.map((l) => (
                      <option key={l} value={l}>
                        {l} m
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Name</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setNameDirty(true)
                  }}
                  placeholder="Auto: '<Typ> Gerät A → Gerät B'"
                  className="w-full rounded border border-cp-border bg-cp-bg p-2"
                />
                {nameDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDirty(false)
                    }}
                    className="mt-1 text-[10px] text-cp-accent hover:underline"
                    title="Wieder automatisch aus Typ + Geräten generieren"
                  >
                    ↺ Auto-Name zurücksetzen
                  </button>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Notizen (opt.)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Z.B. 'Notfall-Patch — bitte später ordentlich verlegen'"
                  className="w-full resize-none rounded border border-cp-border bg-cp-bg p-2"
                />
              </label>
              {err && (
                <div className="flex items-center gap-1.5 rounded border border-red-700/60 bg-red-900/30 p-2 text-[11px] text-red-200">
                  <Icon icon={AlertTriangle} size="xs" />
                  {err}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded bg-cp-surface-4 px-3 py-1.5 text-xs text-cp-text hover:bg-cp-surface-5"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="rounded bg-cp-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'Sende…' : '📤 An Desktop senden'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Feld-Rückkanal — Light-Editor für Korrekturen/Problem-Meldungen.
//
// Use-Case: Techniker bemerkt vor Ort eine Abweichung (z.B. Kabel ist
// kürzer/länger als geplant) oder einen Defekt. Statt direkt den Plan zu
// ändern (das darf nur der Planer), meldet er es: POST /pending-changes →
// Review-Queue am Desktop. Beim Übernehmen mergt der Planer den Patch und
// es wird ins Änderungsprotokoll geschrieben.
type ReportKind = 'cable-edit' | 'issue' | 'note'
const REPORTER_KEY = 'cable-planner-mobile:reporter'

const MobileReportModal = ({
  project,
  onClose,
}: {
  project: CablePlannerProject
  onClose: () => void
}) => {
  const [kind, setKind] = useState<ReportKind>('cable-edit')
  const [deviceId, setDeviceId] = useState('')
  const [cableId, setCableId] = useState('')
  const [lengthVal, setLengthVal] = useState('')
  const [note, setNote] = useState('')
  const [reporter, setReporter] = useState(() => {
    try {
      return localStorage.getItem(REPORTER_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const cablesForDevice = useMemo(
    () =>
      deviceId
        ? project.cables.filter(
            (c) => c.fromEquipmentId === deviceId || c.toEquipmentId === deviceId,
          )
        : project.cables,
    [project.cables, deviceId],
  )
  const selCable = project.cables.find((c) => c.id === cableId)

  const canSubmit =
    !busy &&
    (kind === 'cable-edit' ? !!cableId && (!!lengthVal || !!note.trim()) : !!note.trim())

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    setErr(null)
    try {
      let target: { type: 'cable' | 'equipment'; id?: string; name?: string } | undefined
      let patch: Record<string, unknown> | undefined
      let summary = note.trim()

      if (kind === 'cable-edit' && selCable) {
        target = { type: 'cable', id: selCable.id, name: cableLabelId(selCable) }
        const parts: string[] = []
        if (lengthVal) {
          patch = { length: Number(lengthVal) }
          parts.push(`Länge → ${Number(lengthVal)} m`)
        }
        if (note.trim()) parts.push(note.trim())
        summary = parts.join(' · ') || 'Kabel-Korrektur'
      } else {
        const dev = project.equipment.find((e) => e.id === deviceId)
        if (dev) target = { type: 'equipment', id: dev.id, name: dev.name }
      }

      const res = await apiFetch('/pending-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: reporter.trim() || undefined,
          kind,
          summary,
          target,
          patch,
        }),
      })
      if (!res.ok) throw new Error(`Server ${res.status}`)
      try {
        if (reporter.trim()) localStorage.setItem(REPORTER_KEY, reporter.trim())
      } catch {
        /* localStorage evtl. gesperrt — egal */
      }
      setDone(true)
      window.setTimeout(onClose, 1300)
    } catch (e) {
      setErr(
        e instanceof Error
          ? `Konnte Meldung nicht senden: ${e.message}. Verbindung zum Desktop prüfen.`
          : 'Konnte Meldung nicht senden.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-t-lg border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl">
        <header className="flex items-center justify-between border-b border-cp-border px-3 py-2">
          <h2 className="text-sm font-semibold">⚠ Meldung an Planer</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-cp-text-muted hover:bg-cp-surface-3"
          >
            <Icon icon={X} size="sm" />
          </button>
        </header>
        <div className="space-y-3 p-3 text-xs">
          {done ? (
            <div className="rounded border border-emerald-700 bg-emerald-900/30 p-3 text-center text-emerald-200">
              ✓ Meldung gesendet — erscheint am Desktop unter „Feld-Rückmeldungen"
            </div>
          ) : (
            <>
              <p className="text-[10px] italic text-cp-text-muted">
                Wird NICHT direkt geändert — der Planer übernimmt oder verwirft deine
                Meldung am Desktop (landet dann im Änderungsprotokoll).
              </p>

              <div className="grid grid-cols-3 gap-1 rounded bg-cp-bg p-0.5">
                {(
                  [
                    ['cable-edit', 'Kabel-Korrektur'],
                    ['issue', 'Problem'],
                    ['note', 'Notiz'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded px-2 py-1 text-[11px] font-medium ${
                      kind === k ? 'bg-cp-accent text-white' : 'text-cp-text-secondary hover:bg-cp-surface-3'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Gerät (Kontext)</span>
                <select
                  value={deviceId}
                  onChange={(e) => {
                    setDeviceId(e.target.value)
                    setCableId('')
                  }}
                  className="w-full rounded border border-cp-border bg-cp-bg px-2 py-2 text-cp-text"
                >
                  <option value="">— wählen —</option>
                  {project.equipment.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              {kind === 'cable-edit' && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-cp-text-secondary">Kabel</span>
                    <select
                      value={cableId}
                      onChange={(e) => setCableId(e.target.value)}
                      className="w-full rounded border border-cp-border bg-cp-bg px-2 py-2 text-cp-text"
                    >
                      <option value="">— wählen —</option>
                      {cablesForDevice.map((c) => (
                        <option key={c.id} value={c.id}>
                          {cableLabelId(c)} · {c.name || c.type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-cp-text-secondary">
                      Korrigierte Länge (m){selCable ? ` · aktuell ${selCable.length} m` : ''}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={lengthVal}
                      onChange={(e) => setLengthVal(e.target.value)}
                      placeholder="z.B. 7.5"
                      className="w-full rounded border border-cp-border bg-cp-bg px-2 py-2 text-cp-text"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">
                  {kind === 'cable-edit' ? 'Bemerkung (optional)' : 'Beschreibung'}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={
                    kind === 'issue'
                      ? 'Was ist das Problem?'
                      : kind === 'note'
                        ? 'Notiz für den Planer…'
                        : 'optional…'
                  }
                  className="w-full rounded border border-cp-border bg-cp-bg px-2 py-2 text-cp-text"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-cp-text-secondary">Dein Name (optional)</span>
                <input
                  value={reporter}
                  onChange={(e) => setReporter(e.target.value)}
                  placeholder="für die Protokoll-Zuordnung"
                  className="w-full rounded border border-cp-border bg-cp-bg px-2 py-2 text-cp-text"
                />
              </label>

              {err && (
                <div className="rounded border border-rose-700 bg-rose-900/30 p-2 text-rose-200">
                  {err}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded bg-cp-surface-4 px-3 py-1.5 text-xs text-cp-text hover:bg-cp-surface-5"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSubmit}
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'Sende…' : '📤 Meldung senden'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
