// v7.9.8 — Annotations-Overlay mit Drag + Klick-Toggle. Free-Annotations
// können auf dem Canvas verschoben werden (Pointer-Capture, Snap-to-Grid
// optional). Klick auf den Kreis togglet eine Detail-Karte, die direkt
// neben dem Kreis erscheint und Author + Status + Text zeigt. Klick auf
// den Kreis schliesst die Karte wieder. Device/Port-Anchors sind nicht
// verschiebbar (sie folgen ihrem Gerät) — aber Klick-Toggle gilt für
// alle Anchor-Typen.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow, useViewport } from 'reactflow'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import { format, useTranslation } from '../../lib/i18n'
import { getEquipmentById } from '../../lib/equipmentSelectors'
import { readableTextColor } from '../../lib/contrast'
import type { ProjectAnnotation } from '../../types/project'

const STATUS_COLOR: Record<ProjectAnnotation['status'], string> = {
  open: '#f59e0b',
  built: '#10b981',
  resolved: '#94a3b8',
}

const STATUS_LABEL: Record<ProjectAnnotation['status'], string> = {
  open: 'Offen',
  built: 'Gebaut',
  resolved: 'Erledigt',
}

const initialsOf = (author: string): string => {
  const parts = author.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Click-vs-Drag-Schwelle in Pixeln (Screen-Space). Unterhalb dieser
// Bewegung gilt PointerUp als Klick und togglet die Detail-Karte.
const DRAG_THRESHOLD = 4

const EMPTY: ProjectAnnotation[] = []

type DragState = {
  id: string
  startClientX: number
  startClientY: number
  /** v7.9.16 — Offset zwischen Cursor-Position und Annotation-Mitte
   *  beim Pointer-Down (in Flow-Koordinaten). Damit der Kreis beim
   *  Drag NICHT zur Cursor-Mitte springt sondern relativ zum ursprünglichen
   *  Grab-Punkt mitwandert. Vorher landete jedes Drag auf dem Cursor
   *  was sich für den User wie ein "random Sprung" anfühlte. */
  offsetFlowX: number
  offsetFlowY: number
  flow: { x: number; y: number }
  moved: boolean
}

export const AnnotationCanvasOverlay = () => {
  const t = useTranslation()
  const annotations = useProjectStore((s) => s.project.annotations) ?? EMPTY
  const equipment = useProjectStore((s) => s.project.equipment)
  const greengoConfig = useProjectStore((s) => s.project.greengoConfig)
  const updateAnnotation = useProjectStore((s) => s.updateAnnotation)
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const gridSize = useUiStore((s) => s.gridSize)
  const annotationsVisible = useUiStore((s) => s.annotationsVisible)
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow()
  const viewport = useViewport()
  void viewport

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  // Mirror the latest drag state into a ref for the window pointer handlers.
  // Done in an effect (not during render) so render stays pure — react-hooks/refs.
  useEffect(() => {
    dragRef.current = dragState
  })

  const positions = useMemo(() => {
    return annotations
      .map((a) => {
        const anchor = a.anchor
        if (anchor.type === 'free') {
          return { annotation: a, flow: { x: anchor.x, y: anchor.y } }
        }
        if (anchor.type === 'device') {
          const eq = getEquipmentById(equipment, anchor.deviceId)
          if (!eq) return null
          const layout = computeEquipmentLayout(eq, greengoConfig)
          return {
            annotation: a,
            flow: { x: eq.x + layout.width - 8, y: eq.y + 4 },
          }
        }
        if (anchor.type === 'port') {
          const eq = getEquipmentById(equipment, anchor.deviceId)
          if (!eq) return null
          const layout = computeEquipmentLayout(eq, greengoConfig)
          const pos =
            layout.portPos(anchor.portId, 'source') ?? layout.portPos(anchor.portId, 'target')
          if (!pos) return null
          return { annotation: a, flow: { x: pos.x, y: pos.y } }
        }
        return null
      })
      .filter(
        (x): x is { annotation: ProjectAnnotation; flow: { x: number; y: number } } => !!x,
      )
  }, [annotations, equipment, greengoConfig])

  if (positions.length === 0) return null
  if (!annotationsVisible) return null

  const snap = (n: number): number =>
    snapToGrid && gridSize > 0 ? Math.round(n / gridSize) * gridSize : n

  // v7.9.20 — Position: fixed statt absolute. flowToScreenPosition()
  // von ReactFlow gibt VIEWPORT-Koordinaten zurück (clientX/Y-Space).
  // Mit position: absolute war der Overlay auf den Canvas-Wrapper
  // bezogen, sodass style.left = viewport.x den Kreis um die
  // Library-Sidebar-Breite versetzt darstellte → Drop auf den Canvas
  // landete sichtbar daneben. position: fixed entspricht dem Pattern
  // von PendingCableOverlay und ist viewport-anchored — Drop-Position
  // und Render-Position stimmen jetzt zusammen unabhängig davon wo
  // die Sidebars stehen.
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        // v7.9.63 / #181 — z:1 statt z:11. Annotations sollen über dem
        // Canvas-BG liegen aber HINTER allen Sidebars/Panels/Dialogen
        // (Library z:auto+content, AnnotationsPanel z:40, Settings z:50).
        // Vorher überlagerten Pins die Library wenn sie geöffnet war.
        zIndex: 1,
      }}
    >
      {positions.map(({ annotation, flow }) => {
        const isDragging = dragState && dragState.id === annotation.id && dragState.moved
        const effectiveFlow = isDragging ? dragState!.flow : flow
        const screen = flowToScreenPosition(effectiveFlow)
        const isExpanded = expandedId === annotation.id
        const isFree = annotation.anchor.type === 'free'
        const cardOnRight =
          typeof window !== 'undefined' ? screen.x + 18 + 240 <= window.innerWidth : true
        return (
          <div key={annotation.id} style={{ position: 'absolute', left: 0, top: 0 }}>
            <div
              title={
                isFree
                  ? t('annotations.overlay.titleFree', 'Klick = Text anzeigen · Ziehen = Position')
                  : t('annotations.overlay.titleAnchored', 'Klick = Text anzeigen')
              }
              onPointerDown={(e) => {
                e.stopPropagation()
                if (!isFree) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                const anchor = annotation.anchor
                if (anchor.type !== 'free') return
                // v7.9.16 — Offset zwischen Cursor und Annotation-Mitte
                // in Flow-Koordinaten merken. Beim Drag behält die
                // Annotation diese Beziehung zum Cursor — kein Sprung.
                const cursorFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
                const next: DragState = {
                  id: annotation.id,
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  offsetFlowX: anchor.x - cursorFlow.x,
                  offsetFlowY: anchor.y - cursorFlow.y,
                  flow: { x: anchor.x, y: anchor.y },
                  moved: false,
                }
                setDragState(next)
              }}
              onPointerMove={(e) => {
                const ds = dragRef.current
                if (!ds || ds.id !== annotation.id) return
                const dx = e.clientX - ds.startClientX
                const dy = e.clientY - ds.startClientY
                if (!ds.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
                const cursorFlow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
                // Cursor-Position + Grab-Offset = neuer Annotation-Center.
                const targetX = cursorFlow.x + ds.offsetFlowX
                const targetY = cursorFlow.y + ds.offsetFlowY
                setDragState({
                  ...ds,
                  moved: true,
                  flow: { x: snap(targetX), y: snap(targetY) },
                })
              }}
              onPointerUp={(e) => {
                const ds = dragRef.current
                if (ds && ds.id === annotation.id) {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  } catch {
                    /* ignore */
                  }
                  if (ds.moved) {
                    updateAnnotation(annotation.id, {
                      anchor: { type: 'free', x: ds.flow.x, y: ds.flow.y },
                    })
                  } else {
                    setExpandedId((cur) => (cur === annotation.id ? null : annotation.id))
                  }
                  setDragState(null)
                  return
                }
                // Non-free anchors: simple click-toggle.
                setExpandedId((cur) => (cur === annotation.id ? null : annotation.id))
              }}
              style={{
                position: 'absolute',
                left: screen.x - 11,
                top: screen.y - 11,
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: STATUS_COLOR[annotation.status],
                // #451 — luminanzbasiert: heller Text auf dem grauen
                // "erledigt"-Badge, dunkler auf Amber/Emerald.
                color: readableTextColor(STATUS_COLOR[annotation.status]),
                border: isExpanded ? '2px solid #e2e8f0' : '2px solid #0f172a',
                boxShadow: isExpanded
                  ? '0 0 0 2px rgba(56,189,248,0.4), 0 2px 4px rgba(0,0,0,0.4)'
                  : '0 2px 4px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                pointerEvents: 'auto',
                cursor: isFree ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              {initialsOf(annotation.author)}
            </div>

            {isExpanded && (
              <div
                role="dialog"
                aria-label={format(t('annotations.overlay.cardAria', 'Anmerkung von {name}'), { name: annotation.author })}
                style={{
                  position: 'absolute',
                  left: cardOnRight ? screen.x + 18 : screen.x - 258,
                  top: screen.y - 12,
                  width: 240,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  border: `2px solid ${STATUS_COLOR[annotation.status]}`,
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 11,
                  lineHeight: 1.35,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  pointerEvents: 'auto',
                  zIndex: 2,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      background: STATUS_COLOR[annotation.status],
                      color: readableTextColor(STATUS_COLOR[annotation.status]),
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                    }}
                  >
                    {t(`annotations.statusFull.${annotation.status}`, STATUS_LABEL[annotation.status])}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 11 }}>
                    {annotation.author}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    title={t('common.close', 'Schließen')}
                    style={{
                      background: '#334155',
                      color: '#e2e8f0',
                      border: 'none',
                      borderRadius: 3,
                      padding: '1px 6px',
                      fontSize: 11,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {annotation.text || <em style={{ color: '#64748b' }}>{t('annotations.overlay.empty', '(leer)')}</em>}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 9,
                    color: '#64748b',
                  }}
                >
                  {new Date(annotation.createdAt).toLocaleString()}
                  {annotation.anchor.type !== 'free' && (
                    <span> · {t('annotations.pinnedTo', 'gepinnt an')} {annotation.anchor.type === 'device' ? t('annotations.anchor.device', 'Gerät') : t('annotations.anchor.port', 'Port')}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
