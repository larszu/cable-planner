import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  internalsSymbol,
  useReactFlow,
  type EdgeProps,
} from 'reactflow'
import type { Cable } from '../../types/cable'
import {
  useCanvasProjectStore as useProjectStore,
  useCanvasProjectStoreInstance,
} from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { CableWaypoints } from './CableWaypoints'
import { computeObstacleAwareWaypoints, pathIsBlocked, type Rect } from '../../lib/cableRouting'
import { legeAnfahrt, type Anschlussseite } from '../../lib/cableApproach'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { isCableVisibleByLayer } from '../../lib/cableLayers'
import { netKeyOf, netEndpoints } from '../../lib/offPageNet'
import { OffPageConnectorSymbol } from './OffPageConnectorSymbol'
import { OffPageLeaderHandles } from './OffPageLeaderHandles'
import { effectiveShortName } from '../../lib/shortName'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { useTranslation } from '../../lib/i18n'
import { useEdgeFlow } from '../../hooks/useCanvasFlow'
import { useEdgeEnergised } from '../../hooks/useCircuit'

interface CableEdgeData {
  cable: Cable
  exportThemeOverride?: 'dark' | 'light'
}

/**
 * Issue #65: Replace each crossing point with a small jump-bump arc so
 * the user can see which cable is "on top" when two cables cross.
 *
 * Input: a polyline (list of points forming straight segments).
 * Output: an SVG-path `d` string with the original moves/lines plus an
 *         arc of `bumpRadius` over each crossing point.
 *
 * We only consider perpendicular crossings; near-parallel overlaps fall
 * through as regular line segments because a bump there would look
 * weird. The crossings are computed against `otherSegments`, which
 * should be the segments of all OTHER cables on the canvas.
 */
const buildPathWithBumps = (
  points: { x: number; y: number }[],
  otherSegments: Array<{
    a: { x: number; y: number }
    b: { x: number; y: number }
  }>,
  bumpRadius = 5,
): string => {
  if (points.length < 2 || otherSegments.length === 0) {
    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ')
  }
  const segments: string[] = []
  segments.push(`M ${points[0].x} ${points[0].y}`)
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i]
    const q = points[i + 1]
    const horizontal = Math.abs(q.y - p.y) < 1
    const vertical = Math.abs(q.x - p.x) < 1
    if (!horizontal && !vertical) {
      segments.push(`L ${q.x} ${q.y}`)
      continue
    }
    // Find perpendicular crossings on this segment, sorted by distance
    // from p so we draw them in order.
    const hits: number[] = []
    for (const other of otherSegments) {
      const oHoriz = Math.abs(other.a.y - other.b.y) < 1
      const oVert = Math.abs(other.a.x - other.b.x) < 1
      if (horizontal && oVert) {
        const ox = other.a.x
        const oyMin = Math.min(other.a.y, other.b.y)
        const oyMax = Math.max(other.a.y, other.b.y)
        const xMin = Math.min(p.x, q.x)
        const xMax = Math.max(p.x, q.x)
        if (
          ox > xMin + bumpRadius &&
          ox < xMax - bumpRadius &&
          p.y > oyMin + 1 &&
          p.y < oyMax - 1
        ) {
          hits.push(ox)
        }
      } else if (vertical && oHoriz) {
        const oy = other.a.y
        const oxMin = Math.min(other.a.x, other.b.x)
        const oxMax = Math.max(other.a.x, other.b.x)
        const yMin = Math.min(p.y, q.y)
        const yMax = Math.max(p.y, q.y)
        if (
          oy > yMin + bumpRadius &&
          oy < yMax - bumpRadius &&
          p.x > oxMin + 1 &&
          p.x < oxMax - 1
        ) {
          hits.push(oy)
        }
      }
    }
    if (hits.length === 0) {
      segments.push(`L ${q.x} ${q.y}`)
      continue
    }
    // Sort by distance from p along the segment direction.
    const ascending = horizontal ? q.x > p.x : q.y > p.y
    hits.sort((a, b) => (ascending ? a - b : b - a))
    let curX = p.x
    let curY = p.y
    for (const hit of hits) {
      if (horizontal) {
        const arcStartX = ascending ? hit - bumpRadius : hit + bumpRadius
        const arcEndX = ascending ? hit + bumpRadius : hit - bumpRadius
        segments.push(`L ${arcStartX} ${curY}`)
        // sweep flag 0 keeps the arc on the "top" side (negative y) of
        // a horizontal segment regardless of travel direction
        segments.push(`A ${bumpRadius} ${bumpRadius} 0 0 ${ascending ? 1 : 0} ${arcEndX} ${curY}`)
        curX = arcEndX
      } else {
        const arcStartY = ascending ? hit - bumpRadius : hit + bumpRadius
        const arcEndY = ascending ? hit + bumpRadius : hit - bumpRadius
        segments.push(`L ${curX} ${arcStartY}`)
        segments.push(`A ${bumpRadius} ${bumpRadius} 0 0 ${ascending ? 0 : 1} ${curX} ${arcEndY}`)
        curY = arcEndY
      }
    }
    segments.push(`L ${q.x} ${q.y}`)
  }
  return segments.join(' ')
}

/**
 * Auf welche Seite des Geraets zeigt dieser Anschluss?
 *
 * ReactFlow spricht von `Position`, die Wegfindung von der Anschlussseite.
 * Ist die Seite unbekannt, wird `rechts` angenommen — dieselbe Annahme wie in
 * der alten Fassung, damit sich an dieser Stelle nichts still aendert.
 */
const anschlussseite = (
  pos: EdgeProps['sourcePosition'] | EdgeProps['targetPosition'] | undefined,
): Anschlussseite => {
  switch (pos) {
    case Position.Left:
      return 'links'
    case Position.Top:
      return 'oben'
    case Position.Bottom:
      return 'unten'
    default:
      return 'rechts'
  }
}

const resolveOrthogonalWaypoints = (
  cable: Cable,
  args: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
  },
  obstacles: Rect[],
  obstacleIds: string[],
): { x: number; y: number }[] => {
  const manualWaypoints = cable.waypoints ?? []
  if (manualWaypoints.length > 0) return manualWaypoints
  return computeObstacleAwareWaypoints(
    { x: args.sourceX, y: args.sourceY },
    { x: args.targetX, y: args.targetY },
    obstacles,
    new Set([cable.fromEquipmentId, cable.toEquipmentId]),
    obstacleIds,
  )
}

/** Issue #53: deterministic small offset for the midline of a cable
 *  so two cables that would compute the same midX/midY don't perfectly
 *  overlap. Hash the cable id to a stable jitter in -10..+10 px. */
const midlineJitter = (cableId: string): number => {
  let hash = 0
  for (let i = 0; i < cableId.length; i++) {
    hash = (hash * 31 + cableId.charCodeAt(i)) | 0
  }
  // Map to -10, -6, -2, +2, +6, +10 — six discrete lanes so even
  // many overlapping cables space out predictably.
  const lanes = [-10, -6, -2, 2, 6, 10]
  return lanes[Math.abs(hash) % lanes.length]
}

/** #221 — Mindest-Abstand (Flow-Einheiten) zwischen den beiden Enden, ab
 *  dem ein Off-Page-Kabel wirklich als zwei Symbole gezeichnet wird. Liegen
 *  die Ports näher zusammen, würden sich die ~190px breiten Symbole
 *  überlappen → Fallback auf die normale durchgehende Linie. */
const OFF_PAGE_MIN_SPAN = 220

/**
 * Aus einem Streckenzug den SVG-Pfad und die Beschriftungsstelle machen.
 *
 * EINE Fassung, nicht zwei. Vorher rechneten der Zweig mit und der Zweig ohne
 * Stuetzpunkte dasselbe zweimal — die Defektform `zwei-rechnungen`, und sie
 * war schon auseinandergelaufen: nur eine der beiden setzte einen Stummel an
 * die Geraete.
 */
const ausPunkten = (punkte: { x: number; y: number }[]): [string, number, number] => {
  const d = punkte
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')
  // Die Beschriftung sitzt in der Mitte des laengsten Abschnitts, damit sie
  // auf freier Strecke liegt und nicht in einer Ecke klemmt.
  let bestLen = -1
  let labelX = punkte[0].x
  let labelY = punkte[0].y
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const len =
      Math.abs(punkte[i + 1].x - punkte[i].x) + Math.abs(punkte[i + 1].y - punkte[i].y)
    if (len > bestLen) {
      bestLen = len
      labelX = (punkte[i].x + punkte[i + 1].x) / 2
      labelY = (punkte[i].y + punkte[i + 1].y) / 2
    }
  }
  return [d, labelX, labelY]
}

const buildPath = (
  cable: Cable,
  args: {
    sourceX: number
    sourceY: number
    targetX: number
    targetY: number
    sourcePosition: EdgeProps['sourcePosition']
    targetPosition: EdgeProps['targetPosition']
  },
  gezeichneterWeg: { x: number; y: number }[],
): [string, number, number] => {
  const routing = cable.routing ?? 'orthogonal'

  if (routing === 'straight') {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: args.sourceX,
      sourceY: args.sourceY,
      targetX: args.targetX,
      targetY: args.targetY,
    })
    return [path, labelX, labelY]
  }
  if (routing === 'curved') {
    const [path, labelX, labelY] = getBezierPath(args)
    return [path, labelX, labelY]
  }
  return ausPunkten(gezeichneterWeg)
}

export const CableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  selected,
  label,
}: EdgeProps<CableEdgeData>) => {
  const t = useTranslation()
  const cable = data?.cable
  // Signalfluss dieser Kante. Der Hook laeuft VOR jedem fruehen Ausstieg
  // (Off-Page, Layer-Filter) — React-Hook-Regeln.
  const flow = useEdgeFlow(cable)
  // Schaltbild: liegt auf dieser Leitung Spannung? Der Hook laeuft ebenfalls
  // vor jedem fruehen Ausstieg (React-Hook-Regeln) und ist `false`, solange
  // die Anzeige aus ist.
  const unterSpannung = useEdgeEnergised(cable?.id)
  const deleteCable = useProjectStore((state) => state.deleteCable)
  const equipment = useProjectStore((state) => state.project.equipment)
  const greengoConfig = useProjectStore((state) => state.project.greengoConfig)
  // #221 — Off-Page-Connector: Selektion, Netz-Highlight & RF-Navigation.
  const setSelection = useProjectStore((state) => state.setSelection)
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const highlightedNetKey = useUiStore((s) => s.highlightedNetKey)
  const rf = useReactFlow()
  const storeApi = useCanvasProjectStoreInstance()
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  // Issue #68: when hovered, draw the cable thicker + with a sky glow.
  // EquipmentNode reads the same store value to highlight the matching
  // port handles, so the entire connection visually pops at once.
  const hoveredCableId = useUiStore((s) => s.hoveredCableId)
  // v7.9.112 / Issue #234 — Globaler Toggle blendet ALLE Kabel-Labels
  // aus. Wirkt zusammen mit dem per-Kabel labelPosition='none' / legacy
  // labelHidden=true (zwei Wege zum gleichen Ziel waehrend der Migration).
  const hideAllCableLabels = useUiStore((s) => s.hideAllCableLabels)
  const offPageShowNames = useUiStore((s) => s.offPageShowNames)
  const showCableEndpointLabels = useUiStore((s) => s.showCableEndpointLabels)
  const collisionShiftOn = useUiStore((s) => s.orthogonalCollisionShift)
  // v7.9.85 / #123 — Layer-Filter. Wenn das Kabel einen Layer hat
  // (z.B. 'network') und der Layer-Toggle in der Toolbar AUS ist,
  // wird das Kabel komplett ausgeblendet. v7.9.95: Kabel ohne layer-Feld
  // werden wie 'other' behandelt — folgen also dem 'other'-Chip-Toggle.
  // Geräte werden NICHT gefiltert — Option A aus #123.
  const layerVisibility = useUiStore((s) => s.layerVisibility)
  // v7.8.7 / Issue #106 — Global cable-bumps toggle from Settings; can
  // be overridden per-cable via the right-click context menu's
  // bumpStyle field.
  const globalCableBumps = useUiStore((s) => s.cableBumps)
  const routing = cable?.routing ?? 'orthogonal'
  const hovered = hoveredCableId === id
  const isLight = (data?.exportThemeOverride ?? canvasTheme) === 'light'

  const { obstacles, obstacleIds } = (() => {
    const rects: Rect[] = []
    const ids: string[] = []
    for (const item of equipment) {
      // #501-Folgefix — gleiche Geometrie-Quelle wie der Renderer, damit die
      // Obstacle-Boxen fürs Kabel-Umfahren exakt den gerenderten Geräten
      // entsprechen (vorher veraltete 62/48/8-Kopie ohne snapUp-Breite).
      const { width, height } = computeEquipmentLayout(item, greengoConfig)
      rects.push({ x: item.x, y: item.y, width, height })
      ids.push(item.id)
    }
    return { obstacles: rects, obstacleIds: ids }
  })()

  const routingArgs = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  }
  const orthogonalWaypoints = cable
    ? resolveOrthogonalWaypoints(cable, routingArgs, obstacles, obstacleIds)
    : []
  // Die beiden beteiligten Geraete — um sie wird eine Bahn herumgelegt, wenn
  // das Kabel rueckwaerts laeuft (Ziel hinter der Quelle, Anschluss vom
  // Partner weg). Ohne sie legte die Bahn sich auf die Hoehe der Buchsen und
  // damit quer durch die Geraetekaesten.
  const meideRechtecke = cable
    ? obstacles.filter(
        (_, i) =>
          obstacleIds[i] === cable.fromEquipmentId || obstacleIds[i] === cable.toEquipmentId,
      )
    : []
  // Nutzer-Meldung 2026-09-08: Striche, die hin und wieder zurueckgehen, und
  // Pfeile, die schraeg in das Geraet stechen. Beides kam daher, dass der
  // gezeichnete Weg an dieser Stelle zusammengesetzt wurde, ohne die
  // Anschlussseite zu beachten. Jetzt liefert `legeAnfahrt` den ganzen
  // Streckenzug — Stummel an beiden Enden, Form gewaehlt statt angenommen.
  // Siehe `src/renderer/lib/cableApproach.ts` fuer die Messung dahinter.
  const gezeichneterWeg =
    cable && (cable.routing ?? 'orthogonal') === 'orthogonal'
      ? legeAnfahrt({
          quelle: { x: sourceX, y: sourceY },
          quelleSeite: anschlussseite(sourcePosition),
          ziel: { x: targetX, y: targetY },
          zielSeite: anschlussseite(targetPosition),
          zwischen: orthogonalWaypoints,
          jitter: collisionShiftOn ? midlineJitter(cable.id) : 0,
          meide: meideRechtecke,
        })
      : []
  // Nutzer-Meldung 2026-09-07: „das Kabel automatisch Routen funktioniert
  // nicht sauber." Der Rechenfehler steckte in `cableRouting.ts` und ist dort
  // behoben. Was blieb, ist der Fall, in dem es GAR KEINEN freien Weg gibt:
  // dann wird der kuerzeste gezeichnet, und der laeuft durch ein Geraet.
  // Bisher sah das aus wie eine gelungene Fuehrung.
  //
  // Geprueft wird der Weg, der WIRKLICH GEZEICHNET WIRD — nicht das Ergebnis
  // des Routers. Zwei Gruende: die automatische Fuehrung wird nach dem ersten
  // Rechnen in `cable.waypoints` gespeichert (#206), danach gibt es kein
  // Router-Ergebnis mehr; und ein von Hand gezogener Stuetzpunkt mitten durch
  // ein Geraet ist derselbe Fehler und war ebenso stumm.
  const wegBlockiert =
    !!cable &&
    !cable.offPage &&
    (cable.routing ?? 'orthogonal') === 'orthogonal' &&
    pathIsBlocked(
      gezeichneterWeg,
      obstacles,
      new Set([cable.fromEquipmentId, cable.toEquipmentId]),
      obstacleIds,
    )
  // v7.9.84 / #206 — Persist auto-computed Waypoints einmalig nach dem
  // ersten erfolgreichen Compute. Vorher hat resolveOrthogonalWaypoints
  // bei JEDEM Render mit dem CURRENT-obstacle-Set neu berechnet — d.h.
  // wenn ein UNBETEILIGTES Gerät verschoben wurde und sich dadurch eine
  // andere Variante als "freier Pfad" qualifiziert hat, ist das Kabel
  // sichtbar umgesprungen ("Kabelsprünge ohne Hindernisse"). Mit dem
  // Persist wandert das auto-Routing nach EINMAL aktiv in die manuellen
  // Waypoints — danach bleibt der Pfad stabil bis der User explizit
  // "automatisch neu routen" wählt.
  const updateCable = useProjectStore((s) => s.updateCable)
  // #507 — Aktive Drag-Overrides der Off-Page-Symbol-Offsets (während des
  // Ziehens). Außerhalb eines Drags wird der persistierte Wert vom Kabel
  // verwendet, damit Undo/Redo greift.
  const [dragOff, setDragOff] = useState<{
    from?: { x: number; y: number }
    to?: { x: number; y: number }
  }>({})
  const persistTriedRef = useRef(false)
  const hadWaypointsRef = useRef(false)
  useEffect(() => {
    if (!cable) return
    // #221 — Off-Page-Kabel zeichnen keinen Pfad → keine Auto-Waypoints
    // persistieren (sonst sinnlose Undo-Einträge beim Umschalten).
    if (cable.offPage) return
    const hasWaypoints = !!(cable.waypoints && cable.waypoints.length > 0)
    // v7.9.90 — Wenn cable.waypoints von gesetzt → undefined wechselt
    // (typisch nach einem Undo das einen früheren waypoint-losen Zustand
    // wiederherstellt, oder nach explizitem User-Clear), den persist-
    // Trigger zurücksetzen damit der nächste Render wieder auto-routed
    // und das Ergebnis frisch persistiert. Ohne den Reset blieb das
    // Kabel ohne gespeicherte Waypoints in Live-Recompute-Modus —
    // genau das Verhalten das v7.9.84 fixen sollte.
    if (hadWaypointsRef.current && !hasWaypoints) {
      persistTriedRef.current = false
    }
    hadWaypointsRef.current = hasWaypoints
    if (hasWaypoints) {
      persistTriedRef.current = true
      return
    }
    if (persistTriedRef.current) return
    if (orthogonalWaypoints.length === 0) return
    persistTriedRef.current = true
    updateCable(cable.id, { waypoints: orthogonalWaypoints })
  }, [cable, orthogonalWaypoints, updateCable])
  const [path, centerX, centerY] = cable
    ? buildPath(cable, routingArgs, gezeichneterWeg)
    : getSmoothStepPath(routingArgs)

  // v7.8.7 / Issue #106 — Apply cable bumps (line jumps) where THIS
  // cable's horizontal segments cross OTHER cables' vertical segments.
  // Implementation strategy: after this edge has been rendered by
  // ReactFlow, query sibling .react-flow__edge-path elements in the DOM,
  // parse their `d` attributes into orthogonal segments, and rewrite our
  // own `d` with arc hops via `buildPathWithBumps`.
  //
  // Why DOM post-process: ReactFlow renders each edge independently and
  // doesn't expose a "all-edge-segments" hook. Computing geometry at
  // CanvasArea level would require duplicating ReactFlow's handle-
  // position logic for every cable. The DOM has the answer already —
  // we just have to read it after layout commits.
  //
  // Trade-off: when a NON-connected neighbour cable moves, our effect
  // doesn't re-run automatically (ReactFlow only re-renders edges whose
  // endpoints changed). We re-bump on every render of THIS edge, which
  // catches the common cases (endpoint moves, waypoint edits).
  const pathRef = useRef<SVGPathElement | null>(null)
  // v7.9.5 — Bumps-Logik vereinfacht: per-cable Override (on/off) hat
  // Priorität, sonst folgt das Kabel dem globalen Setting. 'auto'
  // existiert nicht mehr; legacy-Werte 'auto' werden als undefined
  // (== global folgen) interpretiert.
  const wantsBumps =
    cable && routing === 'orthogonal' &&
    (cable.bumpStyle === 'on' ||
      (cable.bumpStyle !== 'off' && globalCableBumps))
  useLayoutEffect(() => {
    if (!cable) return
    // v7.8.9 — ReactFlow v11 marks edge groups with `data-testid="rf__edge-<id>"`
    // (not `data-id`); the path INSIDE the group carries `id="<cableId>"`.
    // The earlier selector used `[data-id]` which never matched, so the
    // bump rendering was silently broken since v7.8.7. Querying by the
    // path's own id is robust regardless of the wrapping group.
    const myPath = document.getElementById(id) as SVGPathElement | null
    if (!myPath || !myPath.classList.contains('react-flow__edge-path')) return
    pathRef.current = myPath
    // If bumps are not requested, make sure we restore the plain path
    // (in case bumps were applied on a previous render and the user
    // just toggled them off).
    if (!wantsBumps) {
      myPath.setAttribute('d', path)
      return
    }
    // Collect orthogonal segments from every OTHER cable's path in the
    // DOM. Parse only M and L commands — anything else (arcs, curves)
    // means the path is already bumped or non-orthogonal.
    //
    // #223 — Bug: vorher hat das ein document-weites querySelectorAll
    // gemacht. Im Sub-Canvas (RackInternalCanvas, RackEditorDialog) hat
    // das auch Pfade vom Haupt-Canvas dahinter aufgesammelt und das
    // Bridge-Rendering hat Kabel über "nicht existierende" Kabel
    // springen lassen. Jetzt scopen wir auf die naechste
    // .react-flow__container vom myPath aus, damit nur Kabel im
    // gleichen ReactFlow-Viewport beruecksichtigt werden.
    const otherSegments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = []
    const scope =
      myPath.closest<HTMLElement>('.react-flow') ??
      myPath.closest<HTMLElement>('.react-flow__container') ??
      document
    const allPaths = scope.querySelectorAll<SVGPathElement>('path.react-flow__edge-path')
    allPaths.forEach((p) => {
      if (p === myPath) return
      const d = p.getAttribute('d')
      if (!d) return
      // Quick reject: any non-M/L command means we'd misinterpret arcs.
      if (/[CcQqAaSsTtZz]/.test(d)) return
      const matches = d.match(/[ML]\s*-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?/g)
      if (!matches || matches.length < 2) return
      const pts: { x: number; y: number }[] = []
      for (const tok of matches) {
        const nums = tok.replace(/[ML]/, '').match(/-?\d+(?:\.\d+)?/g)
        if (!nums || nums.length < 2) continue
        pts.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) })
      }
      for (let i = 0; i < pts.length - 1; i++) {
        otherSegments.push({ a: pts[i], b: pts[i + 1] })
      }
    })
    if (otherSegments.length === 0) {
      myPath.setAttribute('d', path)
      return
    }
    // Parse OUR path into points for the bumps builder. We use the
    // already-built `path` string above so we know it's plain M/L.
    const myMatches = path.match(/[ML]\s*-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?/g)
    if (!myMatches || myMatches.length < 2) return
    const myPts: { x: number; y: number }[] = []
    for (const tok of myMatches) {
      const nums = tok.replace(/[ML]/, '').match(/-?\d+(?:\.\d+)?/g)
      if (!nums || nums.length < 2) continue
      myPts.push({ x: parseFloat(nums[0]), y: parseFloat(nums[1]) })
    }
    if (myPts.length < 2) return
    const bumped = buildPathWithBumps(myPts, otherSegments)
    myPath.setAttribute('d', bumped)
  })

  // Resolve label position. v7.9.93: optional numerischer Slider
  // (cable.labelT, 0..1) hat Vorrang vor dem Preset-Enum. Vereinfachte
  // Linear-Interpolation entlang Source→Target — exakte Path-Position
  // (entlang aller waypoints) wäre genauer, aber für ein Label-Anker-
  // Point ist die Linear-Approximation visuell gut genug.
  const labelPos = cable?.labelPosition ?? 'center'
  const labelT = typeof cable?.labelT === 'number'
    ? Math.max(0, Math.min(1, cable.labelT))
    : labelPos === 'source'
      ? 0.15
      : labelPos === 'target'
        ? 0.85
        : 0.5
  // Bei labelT=0.5 nutzen wir den geometric centerX/Y (mid-of-longest-
  // segment) damit Label da landet wo es sich am wenigsten überlappt.
  // Sonst Lerp Source→Target.
  let labelX: number
  let labelY: number
  if (Math.abs(labelT - 0.5) < 0.02) {
    labelX = centerX
    labelY = centerY
  } else {
    labelX = sourceX + (targetX - sourceX) * labelT
    labelY = sourceY + (targetY - sourceY) * labelT
  }

  const strokeWidth = cable?.strokeWidth ?? 2.5
  // Wireless cables are always dashed (unless the user has explicitly set dashed=false)
  const isWireless = cable?.wireless === true
  const dashArray = (cable?.dashed || isWireless) ? '6 4' : undefined

  // Bidirectional cables (USB, Ethernet, Fibre, …) get arrow markers on
  // BOTH ends to communicate two-way signal flow. The user can still
  // override per-end with the arrowStart / arrowEnd toggles, but the
  // bidirectional flag is the easier single switch (issue #67).
  const bidi = cable?.bidirectional === true
  const markerEnd =
    bidi || cable?.arrowEnd !== false ? 'url(#cable-planner-arrow-end)' : undefined
  const markerStart =
    bidi || cable?.arrowStart ? 'url(#cable-planner-arrow-start)' : undefined

  const mergedStyle: React.CSSProperties = {
    ...style,
    // Bump stroke a bit on hover so the connection visually pops out
    // even when surrounded by dense routing (issue #68).
    strokeWidth: hovered ? strokeWidth + 1.5 : strokeWidth,
    strokeDasharray: dashArray,
    filter: selected
      ? 'drop-shadow(0 0 3px rgba(56,189,248,0.9))'
      : hovered
        ? 'drop-shadow(0 0 4px rgba(56,189,248,0.65))'
        : undefined,
  }

  // Build label text: for wireless cables, prefix with signal icon + frequency/channel info
  // v7.9.68 / #182 — Zusätzlich Max-Reichweite (m) anhängen, wenn gepflegt.
  const wirelessSuffix = isWireless
    ? ` 〜${cable?.frequency ? ` ${cable.frequency}` : ''}${cable?.wifiChannel ? ` CH${cable.wifiChannel}` : ''}${
        typeof cable?.maxRange === 'number' && cable.maxRange > 0
          ? ` ≤${cable.maxRange} m`
          : ''
      }`
    : ''
  // v7.9.54 — Kabel die vom Mobile-Viewer hinzugefügt wurden (Techniker
  // vor Ort) kriegen ein 📱-Prefix damit der Planer sie auf einen Blick
  // erkennt.
  const mobilePrefix = cable?.addedFromMobile ? '📱 ' : ''
  const displayLabel = label
    ? `${mobilePrefix}${label}${wirelessSuffix}`
    : wirelessSuffix.trim()
      ? `${mobilePrefix}${wirelessSuffix.trim()}`
      : mobilePrefix
        ? mobilePrefix.trim()
        : undefined

  // v7.9.85 / #123 — Layer-Visibility-Filter: wenn das Kabel auf einem
  // Layer liegt der via Toolbar-Chip ausgeschaltet wurde, gar nichts
  // rendern. Hooks oben (useState/useEffect/useUiStore) liefen schon
  // → React Rules of Hooks bleiben gewahrt. Cable ohne Layer = immer
  // sichtbar.
  if (cable && !isCableVisibleByLayer(cable, layerVisibility)) {
    return null
  }

  // #221 — OFF-PAGE-MODUS: keine durchgehende Linie quer über den Plan,
  // stattdessen an jedem echten Port ein kompaktes benanntes Connector-
  // Symbol (Pfeil + Netzname + Gegenstück). Die Verbindung bleibt logisch
  // dieselbe; nur die Darstellung ändert sich. Selektion/Netz-Highlight/
  // Navigation laufen über die Symbole (kein klickbarer Pfad nötig).
  // Overlap-Fallback: bei zu kurzer Distanz wird unten die normale Linie
  // gezeichnet (die zwei Symbole würden sonst übereinander liegen).
  const offPageSpan = Math.hypot(targetX - sourceX, targetY - sourceY)
  if (cable && cable.offPage && offPageSpan >= OFF_PAGE_MIN_SPAN) {
    const key = netKeyOf(cable)
    const netLabel = key ?? cable.name
    const netHighlighted = key != null && key === highlightedNetKey
    const stroke = (style?.stroke as string) || cable.color || '#64748b'
    const isSelected = selectedCableId === id

    const fromEq = getEquipmentById(equipment, cable.fromEquipmentId)
    const toEq = getEquipmentById(equipment, cable.toEquipmentId)
    const fromPort =
      fromEq?.outputs.find((p) => p.id === cable.fromPortId) ??
      fromEq?.inputs.find((p) => p.id === cable.fromPortId)
    const toPort =
      toEq?.outputs.find((p) => p.id === cable.toPortId) ??
      toEq?.inputs.find((p) => p.id === cable.toPortId)
    // Jedes Symbol nennt das GEGENSTÜCK (wohin die Leitung weiterläuft).
    const fromCounterpart = `${toEq ? effectiveShortName(toEq) : '?'} · ${toPort?.name ?? ''}`
    const toCounterpart = `${fromEq ? effectiveShortName(fromEq) : '?'} · ${fromPort?.name ?? ''}`

    const selectNet = () => setSelection(undefined, id, undefined)
    const resolve = () => updateCable(id, { offPage: false })

    // Zentrums-Position eines Netz-Endpunkts (Flow-Koordinaten) — Node-
    // Position bevorzugt (aktuell beim Draggen), sonst Equipment-Fallback.
    const endpointCenter = (equipmentId: string): { x: number; y: number } => {
      const node = rf.getNode(equipmentId)
      const eq = getEquipmentById(storeApi.getState().project.equipment, equipmentId)
      const px = node?.position.x ?? eq?.x ?? 0
      const py = node?.position.y ?? eq?.y ?? 0
      return { x: px + (node?.width ?? 90) / 2, y: py + (node?.height ?? 30) / 2 }
    }
    // #507 — Position des GEGENSTÜCK-Connectors (= Port-Handle) in Flow-
    // Koordinaten, damit der Pfeil-Sprung auf dem anderen Off-Page-Verbinder
    // landet statt nur im Geräte-Zentrum. Fallback auf das Zentrum, falls die
    // Handle-Bounds (noch) nicht gemessen sind (z.B. Node außerhalb Viewport).
    const endpointConnectorCenter = (
      equipmentId: string,
      portId: string,
    ): { x: number; y: number } => {
      const node = rf.getNode(equipmentId)
      const bounds = node?.[internalsSymbol]?.handleBounds
      const handle =
        bounds?.source?.find((h) => h.id === portId) ??
        bounds?.target?.find((h) => h.id === portId)
      if (node && handle) {
        const base = node.positionAbsolute ?? node.position
        return {
          x: base.x + handle.x + handle.width / 2,
          y: base.y + handle.y + handle.height / 2,
        }
      }
      return endpointCenter(equipmentId)
    }
    const jumpTo = (tx: number, ty: number) =>
      rf.setCenter(tx, ty, { zoom: rf.getZoom(), duration: 450 })

    // Lazy bei Rechtsklick: alle Endpunkte des Netzes mit Position + Label.
    const buildNetInfo = (selfEnd: 'from' | 'to') => () => {
      const cables = storeApi.getState().project.cables
      const rows = netEndpoints(cables, key).map((ep) => {
        const eq = getEquipmentById(storeApi.getState().project.equipment, ep.equipmentId)
        const port =
          eq?.outputs.find((p) => p.id === ep.portId) ??
          eq?.inputs.find((p) => p.id === ep.portId)
        const c = endpointConnectorCenter(ep.equipmentId, ep.portId)
        return {
          label: `${eq ? effectiveShortName(eq) : '?'} · ${port?.name ?? ep.portId}`,
          x: c.x,
          y: c.y,
          isSelf: ep.cableId === id && ep.end === selfEnd,
        }
      })
      return { key: netLabel, rows }
    }

    // Sprung zum nächstgelegenen ANDEREN Endpunkt im Netz. Der eigene
    // Endpunkt wird per Identität (cableId + end) übersprungen, nicht per
    // Distanz — das geklickte Handle liegt nicht im eigenen Node-Zentrum.
    const navigateNearest =
      (selfX: number, selfY: number, selfEnd: 'from' | 'to') => () => {
        const cables = storeApi.getState().project.cables
        let best: { x: number; y: number; d: number } | null = null
        for (const ep of netEndpoints(cables, key)) {
          if (ep.cableId === id && ep.end === selfEnd) continue
          const c = endpointConnectorCenter(ep.equipmentId, ep.portId)
          const d = (c.x - selfX) ** 2 + (c.y - selfY) ** 2
          if (!best || d < best.d) best = { ...c, d }
        }
        if (best) jumpTo(best.x, best.y)
      }

    // #507 — Verschiebe-Offsets: aktiver Drag hat Vorrang, sonst persistiert.
    const ZERO = { x: 0, y: 0 }
    const fromOffset = dragOff.from ?? cable.offPageFromOffset ?? ZERO
    const toOffset = dragOff.to ?? cable.offPageToOffset ?? ZERO
    const zoom = rf.getZoom()
    const hasFromOff = fromOffset.x !== 0 || fromOffset.y !== 0
    const hasToOff = toOffset.x !== 0 || toOffset.y !== 0
    // #507 — Wegpunkte (relativ zum Port) der Tether-Linie, je Ende.
    const fromWaypoints = cable.offPageFromWaypoints ?? []
    const toWaypoints = cable.offPageToWaypoints ?? []
    const hasFromLeader = hasFromOff || fromWaypoints.length > 0
    const hasToLeader = hasToOff || toWaypoints.length > 0
    // Dünne Hilfslinie Port → (Wegpunkte) → verschobenes Symbol, damit der
    // Bezug sichtbar bleibt. Als Pfad, weil die Linie über Wegpunkte knicken
    // kann (wie ein Standardkabel).
    const leaderPath = (
      px: number,
      py: number,
      wps: { x: number; y: number }[],
      off: { x: number; y: number },
    ): string => {
      const pts = [
        { x: px, y: py },
        ...wps.map((w) => ({ x: px + w.x, y: py + w.y })),
        { x: px + off.x, y: py + off.y },
      ]
      return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`
    }
    const leaderStyle = {
      stroke,
      strokeWidth: 1.5,
      strokeDasharray: '4 3',
      fill: 'none' as const,
      opacity: 0.7,
      style: { pointerEvents: 'none' as const },
    }

    return (
      <>
        {hasFromLeader && (
          <path d={leaderPath(sourceX, sourceY, fromWaypoints, fromOffset)} {...leaderStyle} />
        )}
        {hasToLeader && (
          <path d={leaderPath(targetX, targetY, toWaypoints, toOffset)} {...leaderStyle} />
        )}
        <EdgeLabelRenderer>
          <OffPageConnectorSymbol
            x={sourceX}
            y={sourceY}
            position={sourcePosition}
            direction="out"
            netName={netLabel}
            counterpart={fromCounterpart}
            color={stroke}
            highlighted={netHighlighted}
            selected={isSelected}
            isLight={isLight}
            showName={offPageShowNames}
            offset={fromOffset}
            zoom={zoom}
            onDragMove={(o) => setDragOff((s) => ({ ...s, from: o }))}
            onDragEnd={(o) => {
              updateCable(id, { offPageFromOffset: o })
              setDragOff((s) => ({ ...s, from: undefined }))
            }}
            onSelect={selectNet}
            onNavigate={navigateNearest(sourceX, sourceY, 'from')}
            getNetInfo={buildNetInfo('from')}
            onNavigateTo={jumpTo}
            onResolve={resolve}
          />
          <OffPageConnectorSymbol
            x={targetX}
            y={targetY}
            position={targetPosition}
            direction="in"
            netName={netLabel}
            counterpart={toCounterpart}
            color={stroke}
            highlighted={netHighlighted}
            selected={isSelected}
            isLight={isLight}
            showName={offPageShowNames}
            offset={toOffset}
            zoom={zoom}
            onDragMove={(o) => setDragOff((s) => ({ ...s, to: o }))}
            onDragEnd={(o) => {
              updateCable(id, { offPageToOffset: o })
              setDragOff((s) => ({ ...s, to: undefined }))
            }}
            onSelect={selectNet}
            onNavigate={navigateNearest(targetX, targetY, 'to')}
            getNetInfo={buildNetInfo('to')}
            onNavigateTo={jumpTo}
            onResolve={resolve}
          />
          {/* #507 — Wegpunkt-Editor je Tether, nur bei selektiertem Kabel. */}
          {isSelected && (
            <>
              <OffPageLeaderHandles
                port={{ x: sourceX, y: sourceY }}
                offset={fromOffset}
                waypoints={fromWaypoints}
                color={stroke}
                isLight={isLight}
                zoom={zoom}
                onChange={(wps) =>
                  updateCable(id, { offPageFromWaypoints: wps.length ? wps : undefined })
                }
              />
              <OffPageLeaderHandles
                port={{ x: targetX, y: targetY }}
                offset={toOffset}
                waypoints={toWaypoints}
                color={stroke}
                isLight={isLight}
                zoom={zoom}
                onChange={(wps) =>
                  updateCable(id, { offPageToWaypoints: wps.length ? wps : undefined })
                }
              />
            </>
          )}
        </EdgeLabelRenderer>
      </>
    )
  }

  return (
    <>
      {/* Spannung auf der Leitung (Schaltbild) — ein zweiter, DURCHGEHENDER
          Pfad unter der Kante, kein laufender Strich.

          BEWUSST NICHT DIE FLIESS-ANIMATION. Sie sagt „hier bewegt sich
          etwas"; bei Wechselstrom bewegt sich nichts, was man zeichnen
          koennte, und die laufenden Striche wuerden eine Richtung behaupten,
          die es nicht gibt. „Unter Spannung" ist ein ZUSTAND, also ein
          ruhiger, breiterer Schein.

          Die Kante selbst bleibt unangetastet — sie traegt die Layer-Farbe
          und die Beschriftung. */}
      {unterSpannung && (
        <path
          d={path}
          fill="none"
          stroke="#facc15"
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          opacity={0.3}
          pointerEvents="none"
        />
      )}
      <BaseEdge
        id={id}
        path={path}
        style={mergedStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {/* Signalfluss (Eigentümer-Entscheidung 2026-09-08) — ein zweiter,
          gestrichelter Pfad ÜBER der Kante, dessen Strichversatz läuft.
          Die Kante selbst bleibt unangetastet: sie trägt die Layer-Farbe,
          die Beschriftung und `cable.dashed` für Funkstrecken.

          Was die Bewegung BEDEUTET, entscheidet `useEdgeFlow` und nicht
          diese Stelle — im Schema „hier ist ein Weg vorgesehen", im
          Live-Betrieb „hier liegt Signal an". Welche der beiden gilt,
          steht am Canvas und nicht an der Kante; an dreihundert Kanten
          wäre es dreihundertmal dasselbe zu lesen. */}
      {flow?.animate && (
        <path
          d={path}
          className={`cp-flow${flow.direction === -1 ? ' cp-flow--reverse' : ''}`}
          stroke={(mergedStyle.stroke as string) ?? '#94a3b8'}
          strokeWidth={strokeWidth + 1}
          opacity={0.85}
        />
      )}
      {cable && (
        <CableWaypoints
          cable={cable}
          edgeId={id}
          selected={!!selected}
          source={{ x: sourceX, y: sourceY }}
          target={{ x: targetX, y: targetY }}
          renderWaypoints={orthogonalWaypoints}
          exportThemeOverride={data?.exportThemeOverride}
        />
      )}
      {/* Der Weg laeuft durch ein Geraet. Das Zeichen haengt NICHT am
          Kabel-Label: das laesst sich global und je Kabel abschalten, und
          eine Warnung, die mit der Beschriftung verschwindet, waere in
          genau den Plaenen unsichtbar, in denen es eng zugeht. */}
      {wegBlockiert && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px) translate(0, -15px)`,
              background: '#b91c1c',
              color: '#fff',
              border: '1px solid #fca5a5',
              borderRadius: 9,
              width: 15,
              height: 15,
              lineHeight: '13px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: 'all',
            }}
            title={t(
              'canvas.cableEdge.blockedPath',
              'Dieser Kabelweg läuft durch ein Gerät — es gibt hier keine freie Führung. Gerät verschieben oder den Weg von Hand legen.',
            )}
          >
            !
          </div>
        </EdgeLabelRenderer>
      )}
      {/* v7.9.112 / Issue #234 — Label nur rendern wenn:
          - globaler Toggle nicht aktiv
          - per-Kabel labelPosition nicht 'none'
          - legacy labelHidden nicht true (wird beim Project-Heal in
            'none' migriert; bleibt hier als Doppelsicherung) */}
      {displayLabel &&
        !hideAllCableLabels &&
        cable?.labelPosition !== 'none' &&
        !cable?.labelHidden && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: isLight ? 'rgba(241,245,249,0.92)' : 'rgba(15,23,42,0.85)',
              color: isLight ? '#1e293b' : '#e2e8f0',
              // v7.9.56 — Mobil-hinzugefügte Kabel kriegen einen lila
              // Border statt slate, damit der Planer sie schon ohne das
              // 📱-Symbol im Text auf den ersten Blick erkennt.
              border: `1px solid ${
                cable?.addedFromMobile
                  ? '#a855f7'
                  : isLight
                    ? '#94a3b8'
                    : '#475569'
              }`,
              boxShadow: cable?.addedFromMobile
                ? '0 0 0 1px rgba(168,85,247,0.25)'
                : undefined,
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {displayLabel}
            {selected && cable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteCable(cable.id)
                }}
                style={{
                  marginLeft: 6,
                  background: '#b91c1c',
                  border: 'none',
                  color: 'white',
                  borderRadius: 3,
                  padding: '0 4px',
                  cursor: 'pointer',
                }}
                title={t('canvas.cableEdge.deleteTitle', 'Delete cable')}
              >
                ×
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
      {/* v7.9.127 — Endpoint-Labels: an jedem Kabelende ein kleines
          Mini-Label das anzeigt zu welchem Geraet/Port das ANDERE
          Ende geht. Greift wenn:
          - cable.endpointLabels === 'show' (explizites Per-Kabel-An)
          - ODER global an UND per-Kabel nicht 'hide'
          Plus respektiert die globalen Hide-Bedingungen (alle Labels
          aus, labelPosition='none', layerHidden). Pfeile (→ ←)
          markieren die Lese-Richtung "fuehrt zu". */}
      {(() => {
        if (!cable) return false
        if (cable.endpointLabels === 'hide') return false
        if (cable.endpointLabels !== 'show' && !showCableEndpointLabels) return false
        if (hideAllCableLabels) return false
        if (cable.labelPosition === 'none') return false
        if (cable.labelHidden) return false
        return true
      })() &&
        cable && (() => {
          const fromEq = getEquipmentById(equipment, cable.fromEquipmentId)
          const toEq = getEquipmentById(equipment, cable.toEquipmentId)
          const fromPort =
            fromEq?.outputs.find((p) => p.id === cable.fromPortId) ??
            fromEq?.inputs.find((p) => p.id === cable.fromPortId)
          const toPort =
            toEq?.outputs.find((p) => p.id === cable.toPortId) ??
            toEq?.inputs.find((p) => p.id === cable.toPortId)
          if (!fromEq || !toEq || !fromPort || !toPort) return null
          // v7.9.127 — Statt eq.name den Short-Form-Namen verwenden
          // (User-Override oder auto-generiert). So heisst's nicht
          // "→ ATEM Constellation 8K · In 8" sondern "→ ATEM8K · In 8".
          const sourceEndLabel = `→ ${effectiveShortName(toEq)} · ${toPort.name}`
          const targetEndLabel = `← ${effectiveShortName(fromEq)} · ${fromPort.name}`
          const endpointStyle = {
            position: 'absolute' as const,
            background: isLight ? 'rgba(241,245,249,0.85)' : 'rgba(15,23,42,0.78)',
            color: isLight ? '#475569' : '#94a3b8',
            border: `1px dashed ${isLight ? '#cbd5e1' : '#475569'}`,
            padding: '1px 4px',
            borderRadius: 3,
            fontSize: 9,
            lineHeight: 1.2,
            pointerEvents: 'none' as const,
            whiteSpace: 'nowrap' as const,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }
          // v7.9.128 — Label-Position relativ zur Port-Seite des
          // Geraets: Label haengt AUSSEN am Geraet, nicht uebers
          // Geraet drueber. Beispiel:
          //   - Port auf rechter Geraete-Seite (Position.Right):
          //     Label-LINKE-Kante startet am Port + Gap, erstreckt
          //     sich nach rechts vom Geraet weg.
          //   - Port auf linker Geraete-Seite (Position.Left):
          //     Label-RECHTE-Kante endet am Port - Gap, erstreckt
          //     sich nach links vom Geraet weg.
          //   - Top/Bottom analog vertikal.
          const GAP = 6
          const transformFor = (
            x: number,
            y: number,
            pos: EdgeProps['sourcePosition'] | EdgeProps['targetPosition'] | undefined,
          ): string => {
            switch (pos) {
              case Position.Right:
                // Label-Origin am Port+Gap; horizontal: linke Kante hier
                // (= 0), vertikal zentriert (-50%).
                return `translate(${x + GAP}px, ${y}px) translate(0, -50%)`
              case Position.Left:
                // Label-Origin am Port-Gap; horizontal: rechte Kante hier
                // (-100%), vertikal zentriert.
                return `translate(${x - GAP}px, ${y}px) translate(-100%, -50%)`
              case Position.Top:
                // Label oberhalb; horizontal zentriert, untere Kante hier.
                return `translate(${x}px, ${y - GAP}px) translate(-50%, -100%)`
              case Position.Bottom:
                // Label unterhalb; horizontal zentriert, obere Kante hier.
                return `translate(${x}px, ${y + GAP}px) translate(-50%, 0)`
              default:
                // Fallback: ueber dem Endpunkt schweben (alte Variante).
                return `translate(${x}px, ${y}px) translate(-50%, -130%)`
            }
          }
          return (
            <EdgeLabelRenderer>
              <div
                style={{
                  ...endpointStyle,
                  transform: transformFor(sourceX, sourceY, sourcePosition),
                }}
                className="nodrag nopan"
                title={sourceEndLabel}
              >
                {sourceEndLabel}
              </div>
              <div
                style={{
                  ...endpointStyle,
                  transform: transformFor(targetX, targetY, targetPosition),
                }}
                className="nodrag nopan"
                title={targetEndLabel}
              >
                {targetEndLabel}
              </div>
            </EdgeLabelRenderer>
          )
        })()}
    </>
  )
}
