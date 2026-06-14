// Visual preview of a parsed yEd / GraphML document. Draws every node
// rectangle and every edge polyline at the original coordinates so the
// user can compare side-by-side with what cable-planner will produce
// after import. Used inside GraphmlImportDialog as a fourth tab.
//
// Constraints driving the design:
//   - real files have 1000+ nodes; rendering each as an SVG element is
//     fine in modern browsers, but interactive panning needs to stay
//     responsive. We use a single <svg> with viewBox math instead of
//     ReactFlow so we avoid the per-node React overhead.
//   - the parsed coordinates can be huge (e.g. -1300 to +2500) and
//     scattered. We compute the data bounding box once, then add a
//     uniform 64-pixel margin so labels at the edges aren't clipped.
//   - the viewer is read-only — no node dragging, no selection state.
//     One simple wheel-to-zoom and drag-to-pan handler keep it usable
//     for "is this what I expect?" verification without bringing in a
//     full canvas library.

import { useMemo, useRef, useState } from 'react'
import type { GraphmlDocument, GraphmlEdge, GraphmlNode } from '../../lib/graphml/types'
import { format, useTranslation } from '../../lib/i18n'

export interface GraphmlViewerProps {
  document: GraphmlDocument
  /** Optional set of node IDs to highlight (e.g. devices the resolver
   *  classified as imports) — they get a slightly thicker outline. */
  highlightNodes?: Set<string>
  className?: string
}

interface Bbox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const computeBbox = (nodes: GraphmlNode[], edges: GraphmlEdge[]): Bbox => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    if (!n.geometry) continue
    if (n.geometry.x < minX) minX = n.geometry.x
    if (n.geometry.y < minY) minY = n.geometry.y
    if (n.geometry.x + n.geometry.width > maxX) maxX = n.geometry.x + n.geometry.width
    if (n.geometry.y + n.geometry.height > maxY) maxY = n.geometry.y + n.geometry.height
  }
  for (const e of edges) {
    for (const w of e.waypoints) {
      if (w.x < minX) minX = w.x
      if (w.y < minY) minY = w.y
      if (w.x > maxX) maxX = w.x
      if (w.y > maxY) maxY = w.y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return { minX, minY, maxX, maxY }
}

/** Resolve an edge's start/end points to actual coordinates: the centre
 *  of the source / target node (offset by y:Path sx/sy/tx/ty as yEd
 *  stores them). When either endpoint is missing we fall back to the
 *  first / last waypoint so the line still renders. */
const edgePoints = (
  edge: GraphmlEdge,
  nodeById: Map<string, GraphmlNode>,
): Array<{ x: number; y: number }> => {
  const src = nodeById.get(edge.sourceId)
  const tgt = nodeById.get(edge.targetId)
  const start = src?.geometry
    ? {
        x: src.geometry.x + src.geometry.width / 2 + edge.pathOffset.sx,
        y: src.geometry.y + src.geometry.height / 2 + edge.pathOffset.sy,
      }
    : edge.waypoints[0]
  const end = tgt?.geometry
    ? {
        x: tgt.geometry.x + tgt.geometry.width / 2 + edge.pathOffset.tx,
        y: tgt.geometry.y + tgt.geometry.height / 2 + edge.pathOffset.ty,
      }
    : edge.waypoints[edge.waypoints.length - 1]
  const pts: Array<{ x: number; y: number }> = []
  if (start) pts.push(start)
  for (const w of edge.waypoints) pts.push(w)
  if (end) pts.push(end)
  return pts
}

export const GraphmlViewer = ({ document, highlightNodes, className }: GraphmlViewerProps) => {
  const t = useTranslation()
  const nodeById = useMemo(
    () => new Map(document.nodes.map((n) => [n.id, n])),
    [document.nodes],
  )

  // Bounding box of the data; we reuse this on every render but it's a
  // single pass over the arrays so the cost is negligible compared to
  // rendering 1000+ shapes.
  const bbox = useMemo(
    () => computeBbox(document.nodes, document.edges),
    [document.nodes, document.edges],
  )

  // Static initial viewBox covers the whole data bounds with a margin.
  // The pan/zoom state lives on top — viewBox is recomputed from
  // baseViewBox + the current pan/zoom transform.
  const baseViewBox = useMemo(() => {
    const margin = 64
    return {
      x: bbox.minX - margin,
      y: bbox.minY - margin,
      w: Math.max(1, bbox.maxX - bbox.minX + margin * 2),
      h: Math.max(1, bbox.maxY - bbox.minY + margin * 2),
    }
  }, [bbox])

  // 0 = baseViewBox, positive = zoomed in. We store the centre of the
  // current view in graph coordinates plus a zoom scalar so panning
  // around a zoomed view feels natural.
  const [view, setView] = useState({
    cx: baseViewBox.x + baseViewBox.w / 2,
    cy: baseViewBox.y + baseViewBox.h / 2,
    zoom: 1,
  })

  const viewBox = `${view.cx - baseViewBox.w / (2 * view.zoom)} ${view.cy - baseViewBox.h / (2 * view.zoom)} ${baseViewBox.w / view.zoom} ${baseViewBox.h / view.zoom}`

  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; startCx: number; startCy: number } | null>(null)
  // Render-visible drag flag for the cursor (reading dragRef.current during
  // render would violate react-hooks/refs).
  const [isDragging, setIsDragging] = useState(false)

  const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 1 / 1.15 : 1.15
    setView((v) => ({
      ...v,
      zoom: Math.max(0.05, Math.min(20, v.zoom * factor)),
    }))
  }

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startCx: view.cx,
      startCy: view.cy,
    }
    setIsDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const dxClient = event.clientX - drag.startX
    const dyClient = event.clientY - drag.startY
    // Convert client pixel delta to graph units via the current viewBox scale.
    const scaleX = (baseViewBox.w / view.zoom) / rect.width
    const scaleY = (baseViewBox.h / view.zoom) / rect.height
    setView((v) => ({
      ...v,
      cx: drag.startCx - dxClient * scaleX,
      cy: drag.startCy - dyClient * scaleY,
    }))
  }

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null
    setIsDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* pointer may not be captured */
    }
  }

  const resetView = () => {
    setView({
      cx: baseViewBox.x + baseViewBox.w / 2,
      cy: baseViewBox.y + baseViewBox.h / 2,
      zoom: 1,
    })
  }

  return (
    <div className={className ?? 'relative h-full w-full'}>
      <svg
        ref={svgRef}
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="h-full w-full select-none bg-cp-surface-3"
        style={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Edges first so node rects render on top of them where they
            cross — matches the way yEd composites the layers. */}
        <g strokeLinejoin="round" strokeLinecap="round" fill="none">
          {document.edges.map((edge) => {
            const pts = edgePoints(edge, nodeById)
            if (pts.length < 2) return null
            const d = pts
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              .join(' ')
            const stroke = edge.lineColor || '#94a3b8'
            const dash = edge.lineType === 'dashed' ? '6 4' : edge.lineType === 'dotted' ? '2 3' : undefined
            return (
              <path
                key={edge.id}
                d={d}
                stroke={stroke}
                strokeWidth={1.5 / view.zoom}
                strokeDasharray={dash}
                opacity={0.85}
              />
            )
          })}
        </g>
        <g>
          {document.nodes.map((node) => {
            if (!node.geometry) return null
            const fill = node.fillColor ?? '#1e293b'
            const stroke = node.borderColor ?? '#64748b'
            const hi = highlightNodes?.has(node.id)
            const mainLabel = node.labels.find((l) => l.text.trim().length > 0)?.text ?? null
            return (
              <g key={node.id}>
                <rect
                  x={node.geometry.x}
                  y={node.geometry.y}
                  width={node.geometry.width}
                  height={node.geometry.height}
                  rx={node.shapePrimitive === 'roundrectangle' || node.shapePrimitive === 'ellipse' ? 8 : 0}
                  fill={fill}
                  stroke={hi ? '#38bdf8' : stroke}
                  strokeWidth={(hi ? 1.6 : 0.8) / view.zoom}
                  opacity={0.9}
                />
                {mainLabel && view.zoom * (node.geometry.width / baseViewBox.w) > 0.001 && (
                  <text
                    x={node.geometry.x + 4}
                    y={node.geometry.y + 12}
                    fontSize={11 / view.zoom}
                    fill="#e2e8f0"
                    style={{ pointerEvents: 'none' }}
                  >
                    {mainLabel.length > 32 ? `${mainLabel.slice(0, 30)}…` : mainLabel}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded bg-cp-surface-1/85 px-2 py-1 text-cp-xs text-cp-text-secondary backdrop-blur">
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, zoom: Math.min(20, v.zoom * 1.4) }))}
          className="rounded px-1.5 hover:bg-cp-surface-4"
          aria-label={t('graphmlViewer.zoomIn', 'Zoom in')}
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => setView((v) => ({ ...v, zoom: Math.max(0.05, v.zoom / 1.4) }))}
          className="rounded px-1.5 hover:bg-cp-surface-4"
          aria-label={t('graphmlViewer.zoomOut', 'Zoom out')}
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded px-1.5 text-[10px] hover:bg-cp-surface-4"
          aria-label={t('graphmlViewer.reset', 'Reset')}
        >
          {t('graphmlViewer.reset', 'Reset')}
        </button>
        <span className="ml-1 text-[10px] text-cp-text-muted">{Math.round(view.zoom * 100)}%</span>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-cp-text-muted">
        {format(
          t(
            'graphmlViewer.statusBar',
            'Mausrad zoomt · Ziehen verschiebt · {nodes} Nodes · {edges} Edges',
          ),
          { nodes: document.nodes.length, edges: document.edges.length },
        )}
      </div>
    </div>
  )
}
