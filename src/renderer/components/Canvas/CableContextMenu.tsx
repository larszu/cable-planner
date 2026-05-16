// v7.8.7 / Issues #106 + #117 — Right-click context menu for cables.
//
// Opened by `onEdgeContextMenu` in CanvasArea. State lives in uiStore so
// the menu position survives store mutations (it's a single global menu,
// not per-edge component state).
//
// Inspired by EasySchematic's EdgeContextMenu pattern but adapted to the
// cable-planner data model: actions write to projectStore via the
// existing `updateCable` / `deleteCable` mutations so undo/redo and
// autosave just work.
//
// Action set:
//   • Label umbenennen — inline prompt
//   • Wegpunkt hier hinzufügen — at the right-click point
//   • Nächsten Wegpunkt entfernen — removes the closest existing waypoint
//   • Alle Wegpunkte löschen — resets the cable to auto-routing (#117)
//   • Routing umschalten — orthogonal / straight / curved submenu
//   • Kabelbrücken — auto / immer / nie (#106 per-cable override)
//   • Farbe — color picker
//   • Pfeil-Markierungen — umschalten Anfang / Ende
//   • Bidirektional umschalten
//   • Kabel löschen

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { routeCable } from '../../lib/canvasViewport'
import type { Cable, CableRouting } from '../../types/cable'

/** Distance from a point to the nearest existing waypoint. Returns the
 *  index of that waypoint along with the distance. */
const nearestWaypoint = (
  cable: Cable,
  px: number,
  py: number,
): { index: number; distance: number } | null => {
  const wps = cable.waypoints ?? []
  if (wps.length === 0) return null
  let best = { index: 0, distance: Infinity }
  for (let i = 0; i < wps.length; i++) {
    const dx = wps[i].x - px
    const dy = wps[i].y - py
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < best.distance) best = { index: i, distance: d }
  }
  return best
}

/** Insert a new waypoint at the position closest to the click. We pick
 *  the insertion index by finding the segment whose perpendicular
 *  projection of (px, py) is closest, so the new bend lands on the
 *  cable's current path. */
const insertWaypointAt = (cable: Cable, px: number, py: number): Cable['waypoints'] => {
  const wps = cable.waypoints ?? []
  // No existing waypoints → just append the click point.
  if (wps.length === 0) return [{ x: px, y: py }]
  // Try to project onto each segment between consecutive waypoints.
  // For each segment find the t in [0,1] that minimises distance; the
  // segment with the smallest such distance wins, and we insert at
  // index = segment+1.
  let bestSeg = 0
  let bestDist = Infinity
  for (let i = 0; i < wps.length - 1; i++) {
    const ax = wps[i].x
    const ay = wps[i].y
    const bx = wps[i + 1].x
    const by = wps[i + 1].y
    const dx = bx - ax
    const dy = by - ay
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) continue
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
    const cx = ax + t * dx
    const cy = ay + t * dy
    const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
    if (d < bestDist) {
      bestDist = d
      bestSeg = i + 1
    }
  }
  const next = wps.slice()
  next.splice(bestSeg, 0, { x: px, y: py })
  return next
}

const MENU_WIDTH = 240

export const CableContextMenu = () => {
  const menu = useUiStore((s) => s.cableContextMenu)
  const close = useUiStore((s) => s.closeCableContextMenu)
  const updateCable = useProjectStore((s) => s.updateCable)
  const deleteCable = useProjectStore((s) => s.deleteCable)
  const cable = useProjectStore((s) =>
    menu.open ? s.project.cables.find((c) => c.id === menu.cableId) : undefined,
  )
  const [submenu, setSubmenu] = useState<'routing' | 'bump' | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click, Escape, or any window resize (the latter
  // because absolute positioning relative to viewport would otherwise
  // strand the menu at the old coordinates).
  useEffect(() => {
    if (!menu.open) {
      setSubmenu(null)
      return
    }
    const onDocDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close()
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onResize = () => close()
    // setTimeout so the SAME right-click that opened the menu doesn't
    // immediately close it via the outside-click listener.
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('keydown', onKey)
      window.addEventListener('resize', onResize)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [menu.open, close])

  if (!menu.open || !cable) return null

  // Clamp to viewport so the menu never opens partially off-screen.
  const left = Math.min(menu.screenX, window.innerWidth - MENU_WIDTH - 8)
  const top = Math.min(menu.screenY, window.innerHeight - 380)

  const doUpdate = (patch: Partial<Cable>) => {
    updateCable(cable.id, patch)
    close()
  }

  const renameLabel = () => {
    const next = window.prompt('Kabel-Bezeichnung', cable.name)
    if (next != null && next.trim() !== cable.name) {
      doUpdate({ name: next.trim() })
    } else {
      close()
    }
  }

  const addWaypointHere = () => {
    const next = insertWaypointAt(cable, menu.flowX, menu.flowY)
    doUpdate({ waypoints: next })
  }

  const removeNearestWaypoint = () => {
    const nearest = nearestWaypoint(cable, menu.flowX, menu.flowY)
    if (!nearest) return close()
    const wps = (cable.waypoints ?? []).slice()
    wps.splice(nearest.index, 1)
    doUpdate({ waypoints: wps.length > 0 ? wps : undefined })
  }

  const clearWaypoints = () => doUpdate({ waypoints: undefined })

  /** v7.8.8 — Run A*-based pathfinding for this single cable. The
   *  router writes its result into cable.waypoints, so the cable
   *  immediately re-renders with the new path. */
  const rerouteWithAStar = () => {
    const ok = routeCable(cable.id)
    if (!ok) {
      window.alert('A*-Routing fehlgeschlagen — kein Pfad gefunden (Geräte blockieren?).')
    }
    close()
  }

  const setRouting = (r: CableRouting) => doUpdate({ routing: r })

  const setBumpStyle = (s: 'auto' | 'on' | 'off') => doUpdate({ bumpStyle: s })

  const changeColor = () => {
    // The simplest cross-platform color picker is a hidden <input
    // type="color"> we trigger here. Native dialog blocks until the
    // user closes it; result is committed on change.
    const input = document.createElement('input')
    input.type = 'color'
    input.value = cable.color || '#64748b'
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)
    input.addEventListener('change', () => {
      doUpdate({ color: input.value })
      input.remove()
    })
    input.addEventListener('cancel', () => {
      input.remove()
      close()
    })
    input.click()
  }

  const toggleArrowEnd = () =>
    doUpdate({ arrowEnd: cable.arrowEnd === false ? true : false })
  const toggleArrowStart = () => doUpdate({ arrowStart: !cable.arrowStart })
  const toggleBidirectional = () => doUpdate({ bidirectional: !cable.bidirectional })

  const removeCable = () => {
    if (window.confirm(`Kabel "${cable.name}" löschen?`)) {
      deleteCable(cable.id)
    }
    close()
  }

  const waypointCount = cable.waypoints?.length ?? 0
  const bumpStyle = cable.bumpStyle ?? 'auto'
  const routing = cable.routing ?? 'orthogonal'

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', left, top, width: MENU_WIDTH, zIndex: 9999 }}
      className="rounded border border-slate-700 bg-slate-900/98 text-slate-100 shadow-2xl backdrop-blur-sm"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="border-b border-slate-800 px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400">
        Kabel: <span className="font-semibold text-slate-200">{cable.name}</span>
      </div>
      <Item onClick={renameLabel} icon="✎">Bezeichnung ändern…</Item>
      <Item onClick={changeColor} icon="🎨">Farbe wählen…</Item>
      <Separator />
      <Item onClick={addWaypointHere} icon="＋">Wegpunkt hier hinzufügen</Item>
      <Item
        onClick={removeNearestWaypoint}
        icon="−"
        disabled={waypointCount === 0}
      >
        Nächsten Wegpunkt entfernen
      </Item>
      <Item
        onClick={clearWaypoints}
        icon="↺"
        disabled={waypointCount === 0}
      >
        Alle Wegpunkte löschen ({waypointCount})
      </Item>
      <Item onClick={rerouteWithAStar} icon="🧭">
        Mit A* neu routen
      </Item>
      <Separator />
      {/* Routing submenu */}
      <Item
        onClick={() => setSubmenu(submenu === 'routing' ? null : 'routing')}
        icon="↳"
      >
        Routing: <strong className="ml-1">{routingLabel(routing)}</strong>
        <span className="ml-auto text-slate-500">{submenu === 'routing' ? '▾' : '▸'}</span>
      </Item>
      {submenu === 'routing' && (
        <div className="border-l-2 border-sky-700 bg-slate-950/50">
          {(['orthogonal', 'straight', 'curved'] as const).map((r) => (
            <Item
              key={r}
              onClick={() => setRouting(r)}
              icon={r === routing ? '✓' : ' '}
            >
              {routingLabel(r)}
            </Item>
          ))}
        </div>
      )}
      {/* Bump style submenu (#106) */}
      <Item
        onClick={() => setSubmenu(submenu === 'bump' ? null : 'bump')}
        icon="〰"
      >
        Kabelbrücken: <strong className="ml-1">{bumpLabel(bumpStyle)}</strong>
        <span className="ml-auto text-slate-500">{submenu === 'bump' ? '▾' : '▸'}</span>
      </Item>
      {submenu === 'bump' && (
        <div className="border-l-2 border-sky-700 bg-slate-950/50">
          {(['auto', 'on', 'off'] as const).map((s) => (
            <Item
              key={s}
              onClick={() => setBumpStyle(s)}
              icon={s === bumpStyle ? '✓' : ' '}
            >
              {bumpLabel(s)}
            </Item>
          ))}
        </div>
      )}
      <Separator />
      <Item onClick={toggleArrowEnd} icon={cable.arrowEnd === false ? ' ' : '→'}>
        Pfeil am Ende {cable.arrowEnd === false ? 'einblenden' : 'ausblenden'}
      </Item>
      <Item onClick={toggleArrowStart} icon={cable.arrowStart ? '←' : ' '}>
        Pfeil am Anfang {cable.arrowStart ? 'ausblenden' : 'einblenden'}
      </Item>
      <Item
        onClick={toggleBidirectional}
        icon={cable.bidirectional ? '↔' : ' '}
      >
        Bidirektional {cable.bidirectional ? 'ausschalten' : 'einschalten'}
      </Item>
      <Separator />
      <Item onClick={removeCable} icon="✕" destructive>
        Kabel löschen
      </Item>
    </div>
  )
}

const routingLabel = (r: CableRouting): string =>
  r === 'orthogonal' ? 'Orthogonal' : r === 'straight' ? 'Direkt' : 'Geschwungen'

const bumpLabel = (s: 'auto' | 'on' | 'off'): string =>
  s === 'auto' ? 'Auto (global)' : s === 'on' ? 'Immer an' : 'Immer aus'

const Item = ({
  onClick,
  icon,
  children,
  disabled,
  destructive,
}: {
  onClick: () => void
  icon?: string
  children: React.ReactNode
  disabled?: boolean
  destructive?: boolean
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
      disabled
        ? 'text-slate-600'
        : destructive
          ? 'text-red-300 hover:bg-red-900/40 hover:text-red-200'
          : 'text-slate-200 hover:bg-slate-800'
    }`}
  >
    <span className="inline-block w-4 shrink-0 text-center text-slate-500">{icon}</span>
    <span className="flex-1">{children}</span>
  </button>
)

const Separator = () => <div className="my-0.5 h-px bg-slate-800" />
