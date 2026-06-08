// #507 — Wegpunkt-Editor für die Off-Page-Tether-Linie (Port → Symbol).
//
// Macht die Off-Page-Verbindung wie ein Standardkabel routbar: wenn das Kabel
// selektiert ist, erscheinen ziehbare Griffe an jedem Wegpunkt und ein kleines
// „+" in der Mitte jedes Segments zum Einfügen. Doppelklick auf einen Griff
// löscht ihn. Die Punkte liegen — wie der Symbol-Offset — RELATIV zum Port,
// damit die ganze Linie beim Verschieben des Geräts mitwandert.
//
// Wird je Kabelende einmal gerendert (Quell- und Ziel-Tether), als HTML im
// EdgeLabelRenderer (gleiche Ebene wie das Connector-Symbol → bewährte Drag-
// Mechanik mit Pointer-Capture). Die sichtbare Linie selbst zeichnet CableEdge
// als SVG-Pfad; hier liegen nur die interaktiven Griffe.

import { useRef } from 'react'
import { useTranslation } from '../../lib/i18n'

interface Pt {
  x: number
  y: number
}

interface Props {
  /** Port-Handle in Flow-Koordinaten (Anker der Linie). */
  port: Pt
  /** Symbol-Endpunkt relativ zum Port (= Verschiebe-Offset des Symbols). */
  offset: Pt
  /** Interior-Wegpunkte relativ zum Port (Reihenfolge Port → … → Symbol). */
  waypoints: Pt[]
  color: string
  isLight: boolean
  /** Canvas-Zoom — Screen-Delta → Flow-Delta beim Ziehen. */
  zoom: number
  /** Live + persistiert: neue Wegpunkt-Liste (relativ zum Port). */
  onChange: (waypoints: Pt[]) => void
}

const HANDLE = 11

export const OffPageLeaderHandles = ({
  port,
  offset,
  waypoints,
  color,
  isLight,
  zoom,
  onChange,
}: Props) => {
  const t = useTranslation()
  const drag = useRef<{
    i: number
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
  } | null>(null)

  // Punktkette relativ zum Port: [Port(0,0), …Wegpunkte, Symbol(offset)].
  // Daraus ergeben sich die Segment-Mittelpunkte für die „+"-Knöpfe.
  const chain: Pt[] = [{ x: 0, y: 0 }, ...waypoints, offset]

  return (
    <>
      {/* Ziehbare Wegpunkt-Griffe (Doppelklick = löschen). */}
      {waypoints.map((wp, i) => (
        <div
          key={`wp-${i}`}
          className="nodrag nopan"
          title={t('offPage.waypoint.hint', 'Ziehen: verschieben · Doppelklick: löschen')}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation()
            drag.current = { i, sx: e.clientX, sy: e.clientY, ox: wp.x, oy: wp.y, moved: false }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || d.i !== i) return
            const sdx = e.clientX - d.sx
            const sdy = e.clientY - d.sy
            if (!d.moved && Math.hypot(sdx, sdy) < 3) return
            d.moved = true
            const z = zoom || 1
            const next = waypoints.slice()
            next[i] = { x: d.ox + sdx / z, y: d.oy + sdy / z }
            onChange(next)
          }}
          onPointerUp={(e) => {
            drag.current = null
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation()
            const next = waypoints.slice()
            next.splice(i, 1)
            onChange(next)
          }}
          style={{
            position: 'absolute',
            transform: `translate(${port.x + wp.x}px, ${port.y + wp.y}px) translate(-50%, -50%)`,
            width: HANDLE,
            height: HANDLE,
            borderRadius: '50%',
            background: color,
            border: `2px solid ${isLight ? '#ffffff' : '#0f172a'}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            cursor: 'grab',
            pointerEvents: 'all',
            touchAction: 'none',
            zIndex: 5,
          }}
        />
      ))}

      {/* „+" an jedem Segment-Mittelpunkt → Wegpunkt einfügen. */}
      {chain.slice(1).map((b, idx) => {
        const a = chain[idx]
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        return (
          <div
            key={`add-${idx}`}
            className="nodrag nopan"
            title={t('offPage.waypoint.add', 'Wegpunkt hinzufügen')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              // idx = Segment-Index (0 = Port→erster Punkt) = Einfügeposition
              // in `waypoints`; letztes Segment → ans Ende vor das Symbol.
              const next = waypoints.slice()
              next.splice(idx, 0, mid)
              onChange(next)
            }}
            style={{
              position: 'absolute',
              transform: `translate(${port.x + mid.x}px, ${port.y + mid.y}px) translate(-50%, -50%)`,
              width: HANDLE - 1,
              height: HANDLE - 1,
              borderRadius: '50%',
              background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)',
              border: `1px dashed ${color}`,
              color,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: `${HANDLE - 3}px`,
              textAlign: 'center',
              cursor: 'copy',
              pointerEvents: 'all',
              opacity: 0.75,
              zIndex: 4,
            }}
          >
            +
          </div>
        )
      })}
    </>
  )
}
