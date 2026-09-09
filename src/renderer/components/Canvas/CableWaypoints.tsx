import { useState } from 'react'
import { useReactFlow } from 'reactflow'
import type { Cable, CableWaypoint } from '../../types/cable'
import { useCanvasProjectStore as useProjectStore, useCanvasProjectStoreInstance } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import {
  abschnittAchse,
  greifKette,
  schiebeAbschnitt,
  schiebeEcke,
  type Achse,
} from '../../lib/cableApproach'

interface Props {
  cable: Cable
  /** ReactFlow edge id — used to select the edge when dragging unselected. */
  edgeId: string
  selected: boolean
  source: { x: number; y: number }
  target: { x: number; y: number }
  /** Effective rendered orthogonal waypoints (manual or auto-routed). */
  renderWaypoints?: { x: number; y: number }[]
  /**
   * Der Streckenzug, der WIRKLICH GEZEICHNET WIRD — von `legeAnfahrt`, samt
   * Stummeln und eingeschobenen Ecken. Er ist die Greif-Geometrie: was der
   * Nutzer sieht, muss er auch anfassen koennen.
   */
  renderPath?: { x: number; y: number }[]
  /**
   * Die beiden Stummel-Punkte. Sie bleiben in der Greifkette stehen, auch wenn
   * sie gerade auf der Linie liegen — siehe `greifKette`.
   */
  stummelPunkte?: { x: number; y: number }[]
  exportThemeOverride?: 'dark' | 'light'
}

const HANDLE_SIZE = 8
const SEGMENT_HIT_WIDTH = 16
const AXIS_TOL = 3

function segmentCursor(axis: Achse): string {
  if (axis === 'waagerecht') return 'ns-resize'
  if (axis === 'senkrecht') return 'ew-resize'
  return 'grab'
}

/**
 * Remove redundant collinear waypoints.
 * A waypoint is redundant when the segment leading in and the segment
 * leading out share the same axis and the point lies on that line —
 * i.e. three consecutive points are all on the same horizontal or vertical.
 *
 * Example: source→wp0 is horizontal and wp0→wp1 is also horizontal
 * (same Y) → wp0 adds no bend and can be removed.
 *
 * Runs iteratively until stable so it handles cascading collinearities.
 */
function cleanCollinear(
  waypoints: CableWaypoint[],
  source: { x: number; y: number },
  target: { x: number; y: number },
  tol = AXIS_TOL,
): CableWaypoint[] {
  let pts: { x: number; y: number }[] = [source, ...waypoints, target]
  let changed = true
  while (changed) {
    changed = false
    const next: typeof pts = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const nextp = pts[i + 1]
      const horizontal = Math.abs(prev.y - curr.y) < tol && Math.abs(curr.y - nextp.y) < tol
      const vertical   = Math.abs(prev.x - curr.x) < tol && Math.abs(curr.x - nextp.x) < tol
      if (horizontal || vertical) {
        changed = true // skip this waypoint — it's collinear
      } else {
        next.push(curr)
      }
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  // strip source and target back off; return only interior waypoints
  return pts.slice(1, -1) as CableWaypoint[]
}

/**
 * Renders segment drag hit-areas (always active) and waypoint dot handles
 * (only when selected).
 *
 * yEd-style UX:
 * - Hover any segment → cursor changes to ↕ / ↔ showing which axis will move
 * - Drag directly on the segment (no prior selection required)
 * - Drag starts segment movement; unselected edge is auto-selected first
 * - Selected edge additionally shows blue dot handles for fine-tuning
 */
export const CableWaypoints = ({
  cable,
  edgeId,
  selected,
  source,
  target,
  renderWaypoints,
  renderPath,
  stummelPunkte,
  exportThemeOverride,
}: Props) => {
  const t = useTranslation()
  const updateCable = useProjectStore((state) => state.updateCable)
  const setSelection = useProjectStore((state) => state.setSelection)
  const projectStoreInstance = useCanvasProjectStoreInstance()
  const { screenToFlowPosition } = useReactFlow()
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (exportThemeOverride ?? canvasTheme) === 'light'
  // v7.9.67 / #177 — Globaler Toolbar-Lock für Kabel. Wenn aktiv werden die
  // Waypoint-Drag-Hit-Zonen und Drag-Handles gar nicht erst gerendert.
  const lockCables = useUiStore((s) => s.lockCables)
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null)

  const routing = cable.routing ?? 'orthogonal'
  if (routing === 'curved') return null
  if (lockCables) return null

  const waypoints = cable.waypoints ?? []
  // ── DIE GREIFKETTE ───────────────────────────────────────────────────────
  //
  // Nutzer-Meldung 2026-09-09: „Das manuelle Kabel verschieben im Cable
  // planner canvas ist schlechter geworden."
  //
  // Der Grund stand nicht im Zieh-Code, sondern eine Ebene darunter. Bis
  // B-48 (2026-09-08) war der gezeichnete Weg `[Quelle, ...waypoints, Ziel]`,
  // und genau darauf lagen die Greif-Zonen. Seit B-48 zeichnet `legeAnfahrt`
  // — mit Stummeln an beiden Enden und mit Ecken, die `rechtwinkligMachen`
  // dazwischenschiebt. Die Greif-Zonen blieben auf dem alten Streckenzug
  // liegen, und der wird seither nicht mehr gezeichnet.
  //
  // Gemessen ueber die Matrix aus 4x4 Anschlussseiten und 49 Ziellagen
  // (784 Faelle): 3292 von 3324 gezeichneten Abschnitten hatten KEINE
  // deckungsgleiche Greif-Zone, in allen 784 Faellen mindestens einer, und
  // 180 Greif-Zonen lagen dort, wo gar kein Strich war. Der Nutzer fasste
  // also fast immer ins Leere.
  //
  // Deshalb wird jetzt der GEZEICHNETE Weg angefasst. `greifKette` kuerzt
  // ihn auf seine sichtbaren Ecken ein (zwei Griffe auf einer geraden Linie
  // waeren die zweite Art, das Ziehen unberechenbar zu machen) und laesst die
  // beiden Stummel-Punkte stehen. Nach dem Zug geht die Kette ohne ihre
  // Enden zurueck in `cable.waypoints`; `legeAnfahrt` setzt Quelle, Stummel
  // und Ziel wieder davor und dahinter und `straffe` wirft die Doppel weg,
  // sodass derselbe Streckenzug herauskommt, den der Nutzer gerade gezogen
  // hat. Der Rundlauf ist ueber dieselbe Matrix gemessen: 0 Abweichungen.
  //
  // Fuer `straight`-Kabel gibt es keinen gezeichneten Streckenzug — dort
  // bleibt es bei `[Quelle, ...waypoints, Ziel]` wie bisher.
  const kette: { x: number; y: number }[] =
    renderPath && renderPath.length >= 2
      ? greifKette(renderPath, stummelPunkte ?? [])
      : [source, ...(renderWaypoints && renderWaypoints.length > 0 ? renderWaypoints : waypoints), target]
  const points = kette
  const totalPoints = points.length

  /**
   * Welche Abschnitte darf der Nutzer ziehen?
   *
   * Der erste und der letzte sind die Stummel. Sie sind nicht verhandelbar:
   * `legeAnfahrt` setzt sie bei jedem Zeichnen wieder, wer sie quer zoege,
   * bekaeme die Kehrtwende zurueck, die B-48 gerade beseitigt hat.
   *
   * Bleibt danach nichts uebrig, ist alles ziehbar. Das trifft 12 der 784
   * gemessenen Faelle, und alle zwoelf sind entartet: die beiden Buchsen
   * liegen keine 18 px auseinander, das ganze Kabel ist also kuerzer als ein
   * Stummel. Dort gar nichts anfassen zu koennen waere schlechter als eine
   * Ecke, die `legeAnfahrt` gleich wieder geradezieht — gemessen bleibt der
   * Weg auch im Rueckfall in allen Faellen rechtwinklig.
   */
  const ziehbar = (i: number): boolean =>
    totalPoints >= 4 ? i > 0 && i + 1 < totalPoints - 1 : true

  // ── helpers ────────────────────────────────────────────────────────────────

  const beginDrag = (
    event: React.PointerEvent<SVGElement>,
    update: (flow: { x: number; y: number }) => CableWaypoint[],
    extraPatch?: Partial<Cable>,
  ) => {
    event.stopPropagation()
    event.preventDefault()
    const el = event.currentTarget as SVGElement
    el.setPointerCapture(event.pointerId)

    const handleMove = (moveEvent: PointerEvent) => {
      // #377 — auf ganze Flow-Einheiten runden. screenToFlowPosition liefert
      // Sub-Pixel-Werte; durch die AXIS_TOL-Toleranz (3px) gelten knapp
      // verschobene Segmente als achsparallel, werden aber leicht diagonal
      // GERENDERT — über mehrere Drags akkumuliert das zu "unregelmäßigen"
      // Pfaden. Gerundete Koordinaten halten geteilte Achsenwerte exakt gleich.
      const raw = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const next = update({ x: Math.round(raw.x), y: Math.round(raw.y) }).map((w) => ({
        x: Math.round(w.x),
        y: Math.round(w.y),
      }))
      updateCable(cable.id, { waypoints: next.length ? next : undefined, ...extraPatch })
    }
    const handleUp = () => {
      el.removeEventListener('pointermove', handleMove as EventListener)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
      try { el.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
      // After drag ends, collapse any redundant collinear waypoints so that
      // segments that became straight lines don't leave orphan bend-points.
      const currentWPs = (projectStoreInstance.getState().project.cables.find(c => c.id === cable.id)?.waypoints) ?? []
      const cleaned = cleanCollinear(currentWPs, source, target)
      if (cleaned.length !== currentWPs.length) {
        updateCable(cable.id, { waypoints: cleaned.length ? cleaned : undefined })
      }
    }
    el.addEventListener('pointermove', handleMove as EventListener)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleUp)
  }

  // ── existing waypoint dot handles (selected-only) ─────────────────────────

  /**
   * Eine Ecke der Greifkette ziehen.
   *
   * Gezogen wird der Kettenpunkt, nicht der `waypoints`-Eintrag: die beiden
   * Listen sind seit B-48 nicht mehr dasselbe. Die Nachbar-Ecken gehen auf
   * ihrer geteilten Achse mit, damit die Abschnitte rechtwinklig bleiben —
   * das rechnet `schiebeEcke`, damit es ohne Canvas pruefbar ist.
   */
  const dragEcke = (index: number) => (event: React.PointerEvent<SVGElement>) => {
    const initKette = kette.map((p) => ({ ...p }))
    beginDrag(event, (cursor) => schiebeEcke(initKette, index, cursor).slice(1, -1))
  }

  /** Eine Ecke aus der Greifkette nehmen — der Rest wird zurueckgeschrieben. */
  const ohneEcke = (index: number): CableWaypoint[] =>
    kette.filter((_, i) => i !== index).slice(1, -1)

  const removeWaypoint = (index: number) => (event: React.MouseEvent<SVGElement>) => {
    if (event.button === 2 || event.altKey) {
      event.preventDefault()
      event.stopPropagation()
      const next = ohneEcke(index)
      updateCable(cable.id, { waypoints: next.length ? next : undefined })
    }
  }

  // ── Abschnitt ziehen (immer aktiv — yEd-Art) ─────────────────────────────
  //
  // Der Algorithmus ist unveraendert der aus mxEdgeSegmentHandler
  // (draw.io/mxGraph): waagerecht -> der Zeiger gibt beiden Endpunkten das
  // neue y, senkrecht das neue x. Was sich geaendert hat, ist die Kette,
  // auf der er laeuft: die GEZEICHNETE statt der gespeicherten. Gerechnet
  // wird in `schiebeAbschnitt`, damit es ohne Canvas pruefbar ist.

  const dragSegment = (segIdx: number) => (event: React.PointerEvent<SVGElement>) => {
    // Auto-select edge if not already selected.
    if (!selected) setSelection(undefined, edgeId, undefined)

    event.stopPropagation()
    event.preventDefault()
    const el = event.currentTarget as SVGElement
    el.setPointerCapture(event.pointerId)

    const initKette = kette.map((p) => ({ ...p }))
    const needsRoutingSwitch = routing === 'straight'

    // Nur fuer den schraegen Abschnitt (es gibt ihn nur bei `straight`).
    const rawStart = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const startFlow = { x: Math.round(rawStart.x), y: Math.round(rawStart.y) }

    const handleMove = (moveEvent: PointerEvent) => {
      // #377 — auf ganze Einheiten runden, damit geteilte Achsenwerte exakt
      // gleich bleiben und Segmente nicht sub-pixel-diagonal werden.
      const raw = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const cursor = { x: Math.round(raw.x), y: Math.round(raw.y) }
      const versatz = { x: cursor.x - startFlow.x, y: cursor.y - startFlow.y }
      const next = schiebeAbschnitt(initKette, segIdx, cursor, versatz)
        .slice(1, -1)
        .map((w) => ({ x: Math.round(w.x), y: Math.round(w.y) }))
      updateCable(cable.id, {
        waypoints: next.length ? next : undefined,
        ...(needsRoutingSwitch ? { routing: 'orthogonal' } : {}),
      })
    }

    const handleUp = () => {
      el.removeEventListener('pointermove', handleMove as EventListener)
      el.removeEventListener('pointerup', handleUp)
      el.removeEventListener('pointercancel', handleUp)
      try { el.releasePointerCapture(event.pointerId) } catch { /* ignore */ }
      // v7.9.4 — Gleiche Hygiene wie bei `dragEcke`: nach dem Zug alle
      // redundanten kollinearen Stuetzpunkte rauswerfen, sonst sammeln sie
      // sich mit jedem Zug an. Die Greifkette kuerzt beim Zeichnen ohnehin
      // ein — das hier haelt die GESPEICHERTE Liste knapp.
      const currentWPs =
        projectStoreInstance.getState().project.cables.find((c) => c.id === cable.id)?.waypoints ?? []
      const cleaned = cleanCollinear(currentWPs, source, target)
      if (cleaned.length !== currentWPs.length) {
        updateCable(cable.id, { waypoints: cleaned.length ? cleaned : undefined })
      }
    }
    el.addEventListener('pointermove', handleMove as EventListener)
    el.addEventListener('pointerup', handleUp)
    el.addEventListener('pointercancel', handleUp)
  }

  return (
    <g className="nodrag nopan" style={{ pointerEvents: 'all' }}>
      {/* ── Greif-Zonen der Abschnitte ──
          Sie liegen auf dem gezeichneten Weg (siehe `greifKette` oben). Der
          erste und der letzte Abschnitt sind die Stummel und bleiben frei;
          ein schraeger Abschnitt bekommt bei orthogonaler Fuehrung keine
          Zone, damit niemand versehentlich eine Diagonale knickt. */}
      {points.slice(0, -1).map((p, i) => {
        if (!ziehbar(i)) return null
        const q = points[i + 1]
        const axis = abschnittAchse(p, q)
        if (routing === 'orthogonal' && axis === 'schraeg') return null
        const cursor = segmentCursor(axis)
        const isHovered = hoveredSeg === i

        return (
          <g key={`seg-${i}`}>
            {/* Hover highlight (slightly visible) */}
            {isHovered && (
              <line
                x1={p.x} y1={p.y} x2={q.x} y2={q.y}
                stroke="rgba(56,189,248,0.25)"
                strokeWidth={SEGMENT_HIT_WIDTH}
                strokeLinecap="round"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Wide transparent hit area */}
            <line
              x1={p.x} y1={p.y} x2={q.x} y2={q.y}
              stroke="transparent"
              strokeWidth={SEGMENT_HIT_WIDTH}
              strokeLinecap="round"
              style={{ cursor }}
              onPointerEnter={() => setHoveredSeg(i)}
              onPointerLeave={() => setHoveredSeg(null)}
              onPointerDown={dragSegment(i)}
            >
              <title>
                {axis === 'waagerecht' ? t('cable.segment.moveVertical', 'Move segment vertically') :
                 axis === 'senkrecht'  ? t('cable.segment.moveHorizontal', 'Move segment horizontally') :
                 t('cable.segment.move', 'Move segment')}
              </title>
            </line>
          </g>
        )
      })}

      {/* ── Die Ecken der Greifkette — nur bei ausgewaehltem Kabel ──
          Frueher sassen die Punkte auf `cable.waypoints`. Seit B-48 ist das
          nicht mehr dieselbe Liste wie die gezeichneten Ecken, und ein
          Griff, der neben seiner Ecke liegt, ist schlimmer als keiner. */}
      {selected && points.slice(1, -1).map((wp, i) => {
        const index = i + 1
        return (
        <circle
          key={`wp-${index}`}
          cx={wp.x} cy={wp.y}
          r={HANDLE_SIZE / 2}
          fill="#38bdf8"
          stroke={isLight ? '#e2e8f0' : '#0f172a'}
          strokeWidth={1.5}
          style={{ cursor: 'move' }}
          onPointerDown={dragEcke(index)}
          onMouseDown={removeWaypoint(index)}
          onContextMenu={(e) => {
            e.preventDefault()
            const next = ohneEcke(index)
            updateCable(cable.id, { waypoints: next.length ? next : undefined })
          }}
        >
          <title>{t('cable.waypoint.tooltip', 'Drag to move · Alt-click or right-click to remove')}</title>
        </circle>
        )
      })}

      {/* ── B-44 Teil 3: der sichtbare Loeschgriff fuer grobe Zeiger ──
          Auf einem Tablet gibt es weder Alt+Klick noch Rechtsklick, und ein
          LANGER DRUCK waere hier der falsche Weg: auf demselben `pointerdown`
          sitzt das Ziehen, wer also den Punkt anfasst und einen Moment
          zoegert, haette ihn geloescht. Das ist ein zerstoerender Fehlgriff,
          und er waere haeufig.

          Deshalb ein eigener kleiner Griff daneben — sichtbar statt
          verborgen, und nur dort, wo es keinen Rechtsklick gibt
          (`.cp-coarse-only` in index.css). */}
      {selected && points.slice(1, -1).map((wp, i) => {
        const index = i + 1
        return (
        <g key={`wp-del-${index}`} className="cp-coarse-only">
          <circle
            cx={wp.x + HANDLE_SIZE}
            cy={wp.y - HANDLE_SIZE}
            r={HANDLE_SIZE * 0.7}
            fill="#b91c1c"
            stroke={isLight ? '#e2e8f0' : '#0f172a'}
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              // `stopPropagation`, sonst faengt der Ziehen-Griff darunter das
              // Ereignis und der Punkt wandert, statt zu verschwinden.
              e.stopPropagation()
              e.preventDefault()
              const next = ohneEcke(index)
              updateCable(cable.id, { waypoints: next.length ? next : undefined })
            }}
          >
            <title>{t('cable.waypoint.remove', 'Remove waypoint')}</title>
          </circle>
          <line
            x1={wp.x + HANDLE_SIZE - 3}
            y1={wp.y - HANDLE_SIZE - 3}
            x2={wp.x + HANDLE_SIZE + 3}
            y2={wp.y - HANDLE_SIZE + 3}
            stroke="#fff"
            strokeWidth={1.5}
            pointerEvents="none"
          />
          <line
            x1={wp.x + HANDLE_SIZE + 3}
            y1={wp.y - HANDLE_SIZE - 3}
            x2={wp.x + HANDLE_SIZE - 3}
            y2={wp.y - HANDLE_SIZE + 3}
            stroke="#fff"
            strokeWidth={1.5}
            pointerEvents="none"
          />
        </g>
        )
      })}
    </g>
  )
}
