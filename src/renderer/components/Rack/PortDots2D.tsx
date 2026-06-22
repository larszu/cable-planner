/**
 * v7.9.78 / #170 — 2D-Port-Dot Overlay für den Rack-Builder.
 *
 * Zeigt pro Port ein kleines farbiges Kreis-Overlay auf der Front- bzw.
 * Rear-Seite des Geräts im 2D-Rack-Editor. Position ist normalisiert
 * 0..1 über die Block-Fläche (panelPosX/Y am Port). Wenn nicht gesetzt,
 * verteilt der Renderer die Dots gleichmäßig in einem Spalten-Grid.
 *
 * Drag: onPointerDown auf Dot startet Drag, onPointerMove updated
 * pos.x/y aus der Position relativ zum Parent-Block. Drop persistiert
 * via updatePlacement(panelPosX/Y) — entweder auf inputs (Front) oder
 * outputs (Rear).
 *
 * Synchronisiert sich mit den 3D-Dots: derselbe panelPosX/Y-Wert wird
 * dort genutzt, sodass ein 2D-Drag sofort die 3D-Position ändert.
 */
import { useRef, useState } from 'react'
import type { Port } from '../../types/equipment'
import { ConnectorSymbol } from '../shared/ConnectorSymbol'
import { findConnectorEntry, connectorGender } from '../../lib/connectorCatalog'
import { useTranslation } from '../../lib/i18n'

interface Props {
  /** Ports die auf dieser Face gerendert werden sollen (bereits gefiltert
   *  nach rackSide oder Patchblende-Konvention). Können aus inputs oder
   *  outputs des Placements stammen — das wird in der Drag-Persist-Logik
   *  jeweils richtig zurückgeschrieben. */
  ports: Port[]
  /** Vollständige Listen, damit wir beim Drag das Original updaten können
   *  egal aus welcher der beiden Listen der Port kommt. */
  allInputs: Port[]
  allOutputs: Port[]
  placementId: string
  placementWidth: number
  placementHeight: number
  updatePlacement: (id: string, patch: Partial<{ inputs: Port[]; outputs: Port[] }>) => void
  side: 'front' | 'rear'
  /** #472 — statt einfachem Farb-Dot das echte Steckverbinder-Symbol zeigen. */
  showSymbols?: boolean
}

const PORT_DOT_COLORS: Record<string, string> = {
  BNC: '#fbbf24',
  HDMI: '#a855f7',
  'Ethernet/RJ45': '#10b981',
  Fiber: '#3b82f6',
  SFP: '#06b6d4',
  'SFP+': '#06b6d4',
  XLR: '#ef4444',
  Custom: '#94a3b8',
}

const computeDefault = (idx: number, total: number): { x: number; y: number } => {
  if (total <= 1) return { x: 0.5, y: 0.5 }
  const cols = Math.ceil(Math.sqrt(total * 2.5))
  const rows = Math.ceil(total / cols)
  return { x: ((idx % cols) + 0.5) / cols, y: (Math.floor(idx / cols) + 0.5) / rows }
}

export const PortDots2D = ({
  ports,
  allInputs,
  allOutputs,
  placementId,
  placementWidth,
  placementHeight,
  updatePlacement,
  showSymbols,
}: Props) => {
  const t = useTranslation()
  const [dragOverride, setDragOverride] = useState<{ id: string; x: number; y: number } | null>(null)
  const draggingRef = useRef<{ id: string; pointerId: number } | null>(null)

  const dotPx = Math.min(14, Math.max(8, placementHeight * 0.15))
  const symPx = Math.min(30, Math.max(16, placementHeight * 0.32))

  return (
    <div className="pointer-events-none absolute inset-0">
      {ports.map((port, idx) => {
        const override = dragOverride?.id === port.id ? dragOverride : null
        const px = override?.x ?? port.panelPosX ?? computeDefault(idx, ports.length).x
        const py = override?.y ?? port.panelPosY ?? computeDefault(idx, ports.length).y
        const color = PORT_DOT_COLORS[port.connectorType] ?? '#94a3b8'
        // #472 — Steckverbinder-Symbol statt Dot, wenn aktiviert + bekannt.
        const symEntry = showSymbols ? findConnectorEntry(port.connectorType) : undefined
        return (
          <div
            key={port.id}
            // stopPropagation auf den Pointer-Events, sonst greift der
            // Placement-Drag-Handler (vertikales Verschieben des Blocks)
            // und der Dot wird nie selber bewegt.
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
              draggingRef.current = { id: port.id, pointerId: e.pointerId }
            }}
            onPointerMove={(e) => {
              const drag = draggingRef.current
              if (!drag || drag.id !== port.id || drag.pointerId !== e.pointerId) return
              e.stopPropagation()
              const host = (e.currentTarget as HTMLElement).parentElement
              if (!host) return
              const rect = host.getBoundingClientRect()
              const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
              const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
              setDragOverride({ id: port.id, x: nx, y: ny })
            }}
            onPointerUp={(e) => {
              const drag = draggingRef.current
              if (!drag || drag.id !== port.id) return
              e.stopPropagation()
              ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
              const override = dragOverride?.id === port.id ? dragOverride : null
              if (override) {
                // v7.9.81 / #170 — Port kann aus inputs ODER outputs kommen.
                // Wir suchen ihn in beiden Listen und updaten die richtige.
                const inInputs = allInputs.some((p) => p.id === port.id)
                if (inInputs) {
                  updatePlacement(placementId, {
                    inputs: allInputs.map((p) =>
                      p.id === port.id ? { ...p, panelPosX: override.x, panelPosY: override.y } : p,
                    ),
                  })
                } else {
                  updatePlacement(placementId, {
                    outputs: allOutputs.map((p) =>
                      p.id === port.id ? { ...p, panelPosX: override.x, panelPosY: override.y } : p,
                    ),
                  })
                }
              }
              draggingRef.current = null
              setDragOverride(null)
            }}
            onClick={(e) => e.stopPropagation()}
            title={`${port.name} · ${port.connectorType}\n${t('rack.portDots.dragHint', '(ziehen zum Verschieben auf das Panel-Foto)')}`}
            className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center active:cursor-grabbing ${
              symEntry ? '' : 'rounded-full border-2 border-white/80 shadow-md'
            }`}
            style={{
              left: `${px * placementWidth}px`,
              top: `${py * placementHeight}px`,
              width: symEntry ? symPx : dotPx,
              height: symEntry ? symPx : dotPx,
              background: symEntry ? undefined : color,
            }}
          >
            {symEntry && (
              <ConnectorSymbol
                symbol={symEntry.symbol}
                gender={connectorGender(port.connectorType)}
                size={symPx}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
