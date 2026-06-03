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
import { Pencil, Pin, X, Plus, Minus, RotateCcw, Navigation, CornerDownRight, Check, Milestone } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useUiStore } from '../../store/uiStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { routeCable } from '../../lib/canvasViewport'
import { confirmDialog } from '../../lib/confirmDialog'
import { promptDialog } from '../../lib/promptDialog'
// v7.9.115: infoDialog wird nicht mehr genutzt seit der A*-Fail nicht
// mehr modal blockt — Fallback auf Standard-Routing ist still.
import type { Cable, CableRouting } from '../../types/cable'
import { format, useTranslation } from '../../lib/i18n'

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
  const t = useTranslation()
  const menu = useUiStore((s) => s.cableContextMenu)
  const close = useUiStore((s) => s.closeCableContextMenu)
  // v7.9.81 — Theme-Awareness: Menu folgt jetzt canvasTheme.
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = canvasTheme === 'light'
  const globalCableBumps = useUiStore((s) => s.cableBumps)
  const updateCable = useProjectStore((s) => s.updateCable)
  const deleteCable = useProjectStore((s) => s.deleteCable)
  const clearCableCheck = useProjectStore((s) => s.clearCableCheck)
  const cable = useProjectStore((s) =>
    menu.open ? s.project.cables.find((c) => c.id === menu.cableId) : undefined,
  )
  const cableIsChecked = useProjectStore(
    (s) => (cable ? !!s.project.checkState?.cables[cable.id] : false),
  )
  const [submenu, setSubmenu] = useState<'routing' | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click, Escape, or any window resize (the latter
  // because absolute positioning relative to viewport would otherwise
  // strand the menu at the old coordinates).
  useEffect(() => {
    if (!menu.open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Submenu beim Schließen zurücksetzen (neben Outside-Click/Escape-Listener)
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
  // #447 — auf niedrigen/Portrait-Viewports darf `top` nie negativ werden
  // (sonst öffnet das Menü oberhalb der Kante); ≥8 erzwingen. Die Höhe wird
  // unten via maxHeight gedeckelt, damit das Menü statt überzulaufen scrollt.
  const left = Math.max(8, Math.min(menu.screenX, window.innerWidth - MENU_WIDTH - 8))
  const top = Math.max(8, Math.min(menu.screenY, window.innerHeight - 380))

  const doUpdate = (patch: Partial<Cable>) => {
    updateCable(cable.id, patch)
    close()
  }

  const renameLabel = async () => {
    const next = await promptDialog(t('canvas.cableMenu.renameTitle', 'Kabel-Bezeichnung'), cable.name)
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
   *  immediately re-renders with the new path.
   *  v7.9.115 / Issue #223 — routeCable returns true auch wenn A*
   *  selbst keinen Pfad gefunden hat; in dem Fall werden die waypoints
   *  geleert und ReactFlow's Standard-Routing greift. Kein Error-Modal
   *  mehr, kein blockierter User-Workflow im dichten Rack. */
  const rerouteWithAStar = () => {
    routeCable(cable.id)
    close()
  }

  const setRouting = (r: CableRouting) => doUpdate({ routing: r })

  // v7.9.5 — Kabelbrücken pro Kabel: nur 'on' oder 'off'. undefined =
  // follow global (= kein Override). Toggle wechselt zwischen on/off
  // basierend auf dem aktuellen Effektiv-Zustand.
  const toggleBumpForThisCable = () => {
    const effective =
      cable.bumpStyle === 'on'
        ? true
        : cable.bumpStyle === 'off'
          ? false
          : globalCableBumps
    doUpdate({ bumpStyle: effective ? 'off' : 'on' })
  }

  const toggleArrowEnd = () =>
    doUpdate({ arrowEnd: cable.arrowEnd === false ? true : false })
  const toggleArrowStart = () => doUpdate({ arrowStart: !cable.arrowStart })
  const toggleBidirectional = () => doUpdate({ bidirectional: !cable.bidirectional })

  // #221 — Bestehende Verbindung in eine Off-Page-/Pfeil-Verbindung
  // umwandeln. Der User vergibt einen Netznamen (Default = Kabelname);
  // alle Off-Page-Kabel mit gleichem Namen bilden ein Netz. Danach wird
  // statt der Linie an jedem Ende ein Connector-Symbol gezeichnet.
  const makeOffPage = async () => {
    const next = await promptDialog(
      t('canvas.cableMenu.offPageNamePrompt', 'Netzname / Signalname für die Off-Page-Verbindung:'),
      cable.netName ?? cable.name,
    )
    if (next == null) return close()
    const netName = next.trim()
    doUpdate({ offPage: true, netName: netName || undefined })
  }

  const removeCable = async () => {
    if (
      await confirmDialog(
        format(t('canvas.cableMenu.confirmDelete', 'Kabel "{name}" löschen?'), { name: cable.name }),
        {
          okLabel: t('common.delete', 'Löschen'),
          destructive: true,
        },
      )
    ) {
      deleteCable(cable.id)
    }
    close()
  }

  const waypointCount = cable.waypoints?.length ?? 0
  const bumpStyle = cable.bumpStyle
  const effectiveBumps =
    bumpStyle === 'on' ? true : bumpStyle === 'off' ? false : globalCableBumps
  const routing = cable.routing ?? 'orthogonal'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left,
        top,
        width: MENU_WIDTH,
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
        zIndex: 9999,
      }}
      className={`rounded border shadow-2xl backdrop-blur-sm ${
        isLight
          ? 'border-slate-300 bg-white/98 text-slate-900'
          : 'border-slate-700 bg-slate-900/98 text-slate-100'
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`border-b px-3 py-1.5 text-[10px] uppercase tracking-wide ${
          isLight ? 'border-slate-200 text-slate-500' : 'border-slate-800 text-slate-400'
        }`}
      >
        {t('canvas.cableMenu.headerLabel', 'Kabel:')}{' '}
        <span className={`font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{cable.name}</span>
      </div>
      <Item onClick={renameLabel} icon={<Icon icon={Pencil} size="xs" />}>
        {t('canvas.cableMenu.rename', 'Bezeichnung ändern…')}
      </Item>
      {/* Issue #238 — Handy-Vorschlag-Kabel in Plan uebernehmen.
          Nur sichtbar bei Kabeln die aus dem Mobile-Viewer kamen
          (addedFromMobile=true). Klick raeumt den Flag, lila Border
          + 📱-Praefix verschwinden auf dem Canvas. */}
      {cable.addedFromMobile && (
        <Item
          onClick={() => doUpdate({ addedFromMobile: undefined })}
          icon={<Icon icon={Pin} size="xs" />}
        >
          {t('canvas.cableMenu.acceptMobile', 'In Plan übernehmen (Handy-Vorschlag akzeptieren)')}
        </Item>
      )}
      {/* Mobile-Haken am Kabel entfernen — User-Request: "im normalen
          canvas auch wieder loeschen koennen". Nur sichtbar wenn das
          Kabel im Mobile-Viewer als gesteckt markiert wurde. */}
      {cableIsChecked && (
        <Item
          onClick={() => {
            clearCableCheck(cable.id)
            close()
          }}
          icon={<Icon icon={X} size="xs" />}
        >
          {t('canvas.cableMenu.removeMobileCheck', 'Mobile-Haken entfernen')}
        </Item>
      )}
      <Separator />
      <Item onClick={addWaypointHere} icon={<Icon icon={Plus} size="xs" />}>
        {t('canvas.cableMenu.addWaypoint', 'Wegpunkt hier hinzufügen')}
      </Item>
      <Item
        onClick={removeNearestWaypoint}
        icon={<Icon icon={Minus} size="xs" />}
        disabled={waypointCount === 0}
      >
        {t('canvas.cableMenu.removeNearestWaypoint', 'Nächsten Wegpunkt entfernen')}
      </Item>
      <Item
        onClick={clearWaypoints}
        icon={<Icon icon={RotateCcw} size="xs" />}
        disabled={waypointCount === 0}
      >
        {format(t('canvas.cableMenu.clearWaypoints', 'Alle Wegpunkte löschen ({n})'), { n: waypointCount })}
      </Item>
      <Item onClick={rerouteWithAStar} icon={<Icon icon={Navigation} size="xs" />}>
        {t('canvas.cableMenu.reroute', 'Automatisch neu routen')}
      </Item>
      <Separator />
      {/* Routing submenu */}
      <Item
        onClick={() => setSubmenu(submenu === 'routing' ? null : 'routing')}
        icon={<Icon icon={CornerDownRight} size="xs" />}
      >
        {t('canvas.cableMenu.routing', 'Routing:')}{' '}
        <strong className="ml-1">{routingLabel(routing, t)}</strong>
        <span className="ml-auto text-slate-500">{submenu === 'routing' ? '▾' : '▸'}</span>
      </Item>
      {submenu === 'routing' && (
        <div className={`border-l-2 border-sky-700 ${isLight ? 'bg-slate-100' : 'bg-slate-950/50'}`}>
          {(['orthogonal', 'straight', 'curved'] as const).map((r) => (
            <Item
              key={r}
              onClick={() => setRouting(r)}
              icon={r === routing ? <Icon icon={Check} size="xs" /> : null}
            >
              {routingLabel(r, t)}
            </Item>
          ))}
        </div>
      )}
      {/* v7.9.5 — Kabelbrücken-Toggle pro Kabel — kein Submenu mehr.
          Aktueller Effektiv-Zustand (entweder per-cable override oder
          global) bestimmt was der Toggle-Klick macht. */}
      <Item onClick={toggleBumpForThisCable} icon={effectiveBumps ? <Icon icon={Check} size="xs" /> : null}>
        {t('canvas.cableMenu.bumps', 'Kabelbrücken für dieses Kabel')}
        {bumpStyle == null && (
          <span className="ml-auto text-[10px] text-slate-400">
            {t('canvas.cableMenu.global', 'global')}
          </span>
        )}
      </Item>
      {bumpStyle != null && (
        <Item
          onClick={() => doUpdate({ bumpStyle: undefined })}
          icon=" "
        >
          <span className="text-[11px] text-slate-400">
            {t('canvas.cableMenu.removeOverride', 'Override entfernen (global folgen)')}
          </span>
        </Item>
      )}
      <Separator />
      <Item onClick={toggleArrowEnd} icon={cable.arrowEnd === false ? ' ' : '→'}>
        {t('canvas.cableMenu.arrowEnd', 'Pfeil am Ende')}{' '}
        {cable.arrowEnd === false
          ? t('canvas.cableMenu.show', 'einblenden')
          : t('canvas.cableMenu.hide', 'ausblenden')}
      </Item>
      <Item onClick={toggleArrowStart} icon={cable.arrowStart ? '←' : ' '}>
        {t('canvas.cableMenu.arrowStart', 'Pfeil am Anfang')}{' '}
        {cable.arrowStart
          ? t('canvas.cableMenu.hide', 'ausblenden')
          : t('canvas.cableMenu.show', 'einblenden')}
      </Item>
      <Item
        onClick={toggleBidirectional}
        icon={cable.bidirectional ? '↔' : ' '}
      >
        {t('canvas.cableMenu.bidi', 'Bidirektional')}{' '}
        {cable.bidirectional
          ? t('canvas.cableMenu.off', 'ausschalten')
          : t('canvas.cableMenu.on', 'einschalten')}
      </Item>
      <Separator />
      {!cable.offPage && (
        <Item onClick={makeOffPage} icon={<Icon icon={Milestone} size="xs" />}>
          {t('canvas.cableMenu.makeOffPage', 'Off-Page-Verbindung erstellen…')}
        </Item>
      )}
      <Item onClick={removeCable} icon={<Icon icon={X} size="xs" />} destructive>
        {t('canvas.cableMenu.delete', 'Kabel löschen')}
      </Item>
    </div>
  )
}

const routingLabel = (r: CableRouting, t: (k: string, f?: string) => string): string =>
  r === 'orthogonal'
    ? t('canvas.cableMenu.routingOrth', 'Orthogonal')
    : r === 'straight'
      ? t('canvas.cableMenu.routingStraight', 'Direkt')
      : t('canvas.cableMenu.routingCurved', 'Geschwungen')


const Item = ({
  onClick,
  icon,
  children,
  disabled,
  destructive,
}: {
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
  disabled?: boolean
  destructive?: boolean
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-cp-xs ${
      disabled
        ? 'text-slate-600'
        : destructive
          ? 'text-red-300 hover:bg-red-900/40 hover:text-red-200'
          : 'text-slate-200 hover:bg-slate-800'
    }`}
  >
    <span className="inline-flex w-4 shrink-0 items-center justify-center text-slate-500">{icon}</span>
    <span className="flex-1">{children}</span>
  </button>
)

const Separator = () => <div className="my-0.5 h-px bg-slate-800" />
