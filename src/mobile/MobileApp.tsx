/**
 * Issue #73 — Cable-Planner Mobile Viewer.
 *
 * A read-only field-tech companion. Loads a `.cable-planner.json` (the
 * same project format the desktop app writes) and renders a touch-
 * friendly checklist: every cable can be marked "verkabelt" and every
 * port "gesteckt". The check state is stored in localStorage keyed by
 * (projectName, deviceId, portId / cableId) so the same file can be
 * worked on across sessions without losing progress.
 *
 * Importing the project happens entirely client-side — pick a file via
 * the standard file picker or paste JSON. No sync to a server.
 *
 * Out-of-scope (defer to v0.12+):
 *   - 2D canvas viewer (orientations, ReactFlow inside mobile)
 *   - Photo upload to attach to a port
 *   - Conflict resolution with concurrent edits
 *
 * The visual style mirrors the desktop app's dark theme so it feels
 * familiar; Tailwind classes carry over from the shared index.css.
 */

import { useEffect, useMemo, useState } from 'react'
import type { CablePlannerProject } from '../renderer/types/project'

const CHECK_KEY = (projectName: string) => `cable-planner-mobile:checks:${projectName}`

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

const portKey = (deviceId: string, portId: string) => `${deviceId}|${portId}`

const ProjectPicker = ({
  onLoad,
}: {
  onLoad: (project: CablePlannerProject) => void
}) => {
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)

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
        <h1 className="mt-1 text-lg font-semibold text-slate-100">
          Cable Planner — Mobile Viewer
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Lade die exportierte Projekt-Datei oder füge den JSON-Inhalt ein. Die App ist
          read-only und merkt sich pro Projekt welche Ports + Kabel du schon gesteckt hast.
        </p>
      </header>
      <label className="block rounded border border-dashed border-slate-700 bg-slate-900 p-4 text-center text-sm text-slate-300">
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
          className="text-xs text-slate-400 underline hover:text-slate-200"
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
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs text-slate-100"
            placeholder="{ ... cable-planner project json ... }"
          />
          <button
            type="button"
            onClick={() => tryParse(pasted)}
            className="w-full rounded bg-sky-700 px-3 py-2 text-sm text-white hover:bg-sky-600"
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

const DeviceCard = ({
  device,
  cables,
  checks,
  onTogglePort,
  allEquipment,
}: {
  device: CablePlannerProject['equipment'][number]
  cables: CablePlannerProject['cables']
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  allEquipment: CablePlannerProject['equipment']
}) => {
  const inputCables = useMemo(
    () => cables.filter((c) => c.toEquipmentId === device.id),
    [cables, device.id],
  )
  const outputCables = useMemo(
    () => cables.filter((c) => c.fromEquipmentId === device.id),
    [cables, device.id],
  )
  const totalPorts = (device.inputs?.length ?? 0) + (device.outputs?.length ?? 0)
  const checkedPorts = [...(device.inputs ?? []), ...(device.outputs ?? [])].filter(
    (p) => checks.ports[portKey(device.id, p.id)],
  ).length

  return (
    <details className="rounded border border-slate-800 bg-slate-900 open:bg-slate-900/80">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        <span className="flex-1 truncate font-medium text-slate-100">{device.name}</span>
        <span className="text-[10px] text-slate-400">
          {device.category}
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            checkedPorts === totalPorts && totalPorts > 0
              ? 'bg-emerald-700 text-emerald-50'
              : 'bg-slate-700 text-slate-200'
          }`}
        >
          {checkedPorts}/{totalPorts}
        </span>
      </summary>
      <div className="border-t border-slate-800 p-2 text-xs">
        <PortList
          label="Inputs"
          deviceId={device.id}
          ports={device.inputs ?? []}
          cables={inputCables}
          mode="in"
          checks={checks}
          onTogglePort={onTogglePort}
          allEquipment={allEquipment}
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
        />
      </div>
    </details>
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
}: {
  label: string
  deviceId: string
  ports: CablePlannerProject['equipment'][number]['inputs']
  cables: CablePlannerProject['cables']
  mode: 'in' | 'out'
  checks: CheckState
  onTogglePort: (deviceId: string, portId: string) => void
  allEquipment: CablePlannerProject['equipment']
}) => {
  if (ports.length === 0) return null
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
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
          if (cable) {
            const isFromMe = cable.fromEquipmentId === deviceId
            const otherEqId = isFromMe ? cable.toEquipmentId : cable.fromEquipmentId
            const otherPortId = isFromMe ? cable.toPortId : cable.fromPortId
            otherDevice = allEquipment.find((e) => e.id === otherEqId)
            otherPort =
              otherDevice?.inputs?.find((q) => q.id === otherPortId) ??
              otherDevice?.outputs?.find((q) => q.id === otherPortId)
          }
          const checked = !!checks.ports[portKey(deviceId, p.id)]
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onTogglePort(deviceId, p.id)}
                className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left ${
                  checked
                    ? 'border-emerald-700 bg-emerald-900/30 text-emerald-100'
                    : 'border-slate-800 bg-slate-950 text-slate-200 hover:border-slate-700'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    checked ? 'bg-emerald-600 text-white' : 'border border-slate-600 bg-slate-900'
                  }`}
                >
                  {checked ? '✓' : ''}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block">
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-[10px] text-slate-500">
                      {p.connectorType}
                    </span>
                  </span>
                  {cable && otherDevice && (
                    <span className="mt-0.5 block truncate text-[11px] text-sky-300">
                      → {otherDevice.name}
                      {otherPort && (
                        <>
                          <span className="mx-1 text-slate-500">·</span>
                          <span>{otherPort.name}</span>
                          {otherPort.connectorType && (
                            <span className="ml-1 text-[10px] text-slate-500">
                              ({otherPort.connectorType})
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  )}
                </span>
                {cable && (
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {cable.type} · {cable.length} m
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const ProjectView = ({
  project,
  onUnload,
}: {
  project: CablePlannerProject
  onUnload: () => void
}) => {
  const projectName = project.metadata?.name || 'cable-planner'
  const [checks, setChecks] = useState<CheckState>(() => loadChecks(projectName))
  const [filter, setFilter] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)

  useEffect(() => saveChecks(projectName, checks), [projectName, checks])

  const togglePort = (deviceId: string, portId: string) => {
    setChecks((prev) => ({
      ...prev,
      ports: { ...prev.ports, [portKey(deviceId, portId)]: !prev.ports[portKey(deviceId, portId)] },
    }))
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
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUnload}
            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
            title="Anderes Projekt laden"
          >
            ◀
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-100">{projectName}</h1>
            <div className="text-[10px] text-slate-400">
              {project.equipment.length} Geräte · {project.cables.length} Kabel ·{' '}
              <span
                className={
                  checkedPorts === totalPorts
                    ? 'text-emerald-300'
                    : checkedPorts > 0
                      ? 'text-amber-300'
                      : 'text-slate-500'
                }
              >
                {checkedPorts}/{totalPorts} Ports gesteckt
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Suchen…"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          />
          <label className="flex items-center gap-1 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
            />
            offen
          </label>
        </div>
      </header>
      <div className="space-y-2 pb-8">
        {filteredDevices.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 bg-slate-900 p-6 text-center text-xs text-slate-500">
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
              allEquipment={project.equipment}
            />
          ))
        )}
      </div>
    </div>
  )
}

export const MobileApp = () => {
  const [project, setProject] = useState<CablePlannerProject | null>(null)
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false)
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null)

  // When loaded via the desktop app's LAN share server, a sibling
  // /project.json endpoint serves the live project. Auto-fetch on
  // mount and (separately) poll every 5 s so the phone stays in sync
  // while it's the active window.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/share-info.json', { cache: 'no-store' })
        if (!res.ok) {
          setAutoLoadAttempted(true)
          return
        }
        const info = (await res.json()) as { ok: boolean; hasProject: boolean }
        if (!info.ok || !info.hasProject) {
          setAutoLoadAttempted(true)
          return
        }
        const projectRes = await fetch('/project.json', { cache: 'no-store' })
        if (!projectRes.ok) {
          setAutoLoadError(`Server antwortete mit ${projectRes.status}.`)
          setAutoLoadAttempted(true)
          return
        }
        const data = (await projectRes.json()) as CablePlannerProject
        if (!cancelled && data && Array.isArray(data.equipment)) {
          setProject(data)
        }
      } catch {
        // Not running from the share server — show the manual picker.
      } finally {
        if (!cancelled) setAutoLoadAttempted(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Refresh every 5 s once we've successfully auto-loaded so the
  // phone reflects edits made on the desktop.
  useEffect(() => {
    if (!project) return
    const id = window.setInterval(async () => {
      try {
        const r = await fetch('/project.json', { cache: 'no-store' })
        if (!r.ok) return
        const next = (await r.json()) as CablePlannerProject
        if (next && Array.isArray(next.equipment)) setProject(next)
      } catch {
        /* server stopped or network blip — keep last good state */
      }
    }, 5000)
    return () => window.clearInterval(id)
  }, [project !== null])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {!autoLoadAttempted ? (
        <div className="grid min-h-screen place-items-center p-4 text-xs text-slate-400">
          <div className="animate-pulse">Lade Projekt vom Desktop…</div>
        </div>
      ) : project ? (
        <ProjectView project={project} onUnload={() => setProject(null)} />
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
