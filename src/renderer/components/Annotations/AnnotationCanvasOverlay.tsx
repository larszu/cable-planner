// v7.9.5 — Annotations-Badges direkt aufs Canvas. Free-Annotations
// schweben an ihrer x/y-Position, device-anchored sitzen oben rechts
// am Geräte-Node. Hover öffnet den Volltext, Klick scrollt im
// Annotations-Panel zur passenden Karte (zukünftig).
//
// Sehr leichtgewichtig: ein einziges absolutes SVG/HTML-Layer auf
// dem Canvas, das pro Annotation einen kleinen farbigen Pin mit
// Author-Initialen rendert.

import { useMemo } from 'react'
import { useReactFlow, useViewport } from 'reactflow'
import { useProjectStore } from '../../store/projectStore'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
import type { ProjectAnnotation } from '../../types/project'

const STATUS_COLOR: Record<ProjectAnnotation['status'], string> = {
  open: '#f59e0b',
  built: '#10b981',
  resolved: '#94a3b8',
}

const initialsOf = (author: string): string => {
  const parts = author.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const EMPTY: ProjectAnnotation[] = []

export const AnnotationCanvasOverlay = () => {
  const annotations = useProjectStore((s) => s.project.annotations) ?? EMPTY
  const equipment = useProjectStore((s) => s.project.equipment)
  const greengoConfig = useProjectStore((s) => s.project.greengoConfig)
  const { flowToScreenPosition } = useReactFlow()
  const viewport = useViewport()
  // Reference viewport so badges follow pan/zoom
  void viewport

  const positions = useMemo(() => {
    return annotations
      .map((a) => {
        const anchor = a.anchor
        if (anchor.type === 'free') {
          return { annotation: a, flow: { x: anchor.x, y: anchor.y } }
        }
        if (anchor.type === 'device') {
          const eq = equipment.find((e) => e.id === anchor.deviceId)
          if (!eq) return null
          const layout = computeEquipmentLayout(eq, greengoConfig)
          // Position the badge at the device's top-right corner
          return {
            annotation: a,
            flow: { x: eq.x + layout.width - 8, y: eq.y + 4 },
          }
        }
        if (anchor.type === 'port') {
          const eq = equipment.find((e) => e.id === anchor.deviceId)
          if (!eq) return null
          const layout = computeEquipmentLayout(eq, greengoConfig)
          const pos = layout.portPos(anchor.portId, 'source') ?? layout.portPos(anchor.portId, 'target')
          if (!pos) return null
          return { annotation: a, flow: { x: pos.x, y: pos.y } }
        }
        return null
      })
      .filter((x): x is { annotation: ProjectAnnotation; flow: { x: number; y: number } } => !!x)
  }, [annotations, equipment, greengoConfig])

  if (positions.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 11,
      }}
    >
      {positions.map(({ annotation, flow }) => {
        const screen = flowToScreenPosition(flow)
        return (
          <div
            key={annotation.id}
            title={`${annotation.author}: ${annotation.text}`}
            style={{
              position: 'absolute',
              left: screen.x - 10,
              top: screen.y - 10,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: STATUS_COLOR[annotation.status],
              color: '#0f172a',
              border: '2px solid #0f172a',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              fontWeight: 700,
              pointerEvents: 'auto',
              cursor: 'help',
            }}
          >
            {initialsOf(annotation.author)}
          </div>
        )
      })}
    </div>
  )
}
