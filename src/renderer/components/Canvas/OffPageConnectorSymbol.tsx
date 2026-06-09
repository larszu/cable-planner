// #221 — Off-Page-/Pfeil-Connector-Symbol.
//
// Ersetzt ein Kabelende durch ein kompaktes Symbol statt einer langen
// Linie quer über den Plan. Standard: einzeilig die Verbindung (Gegenstück
// Gerät · Port, woher/wohin); bei Hover bzw. Druck-Toggle zusätzlich der
// Netzname (fett). Ein Richtungs-Chevron
// zeigt die Signalflussrichtung und ist klickbar → springt zum
// nächstgelegenen Gegenstück. Rechtsklick öffnet eine kleine Netz-Info
// (Anzahl Endpunkte + Sprungliste + „Off-Page auflösen").
//
// Wird zweimal pro Off-Page-Kabel gerendert (Quell- und Ziel-Ende),
// jeweils per EdgeLabelRenderer am echten Port-Handle verankert.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Position } from 'reactflow'
import { useTranslation, format } from '../../lib/i18n'

export interface NetInfoRow {
  label: string
  x: number
  y: number
  isSelf: boolean
}

interface Props {
  /** Port-Handle-Position in Flow-Koordinaten. */
  x: number
  y: number
  /** Geräteseite des Ports (Symbol hängt nach außen weg). */
  position?: Position
  /** Signalfluss an diesem Ende: 'out' = verlässt das Gerät (Quelle),
   *  'in' = läuft ins Gerät (Ziel). */
  direction: 'out' | 'in'
  netName: string
  /** „Gerät · Port" des Gegenstücks (wohin die Leitung weiterläuft). */
  counterpart: string
  color: string
  highlighted: boolean
  selected: boolean
  isLight: boolean
  /** #507 — Netzname-Zeile dauerhaft zeigen (Druckansicht). Die Verbindungs-
   *  zeile (Gegenstück) ist immer sichtbar; ohne showName erscheint der
   *  Netzname zusätzlich beim Hover. */
  showName: boolean
  /** #507 — Verschiebe-Offset (Flow-Koordinaten) gegenüber dem Port-Handle. */
  offset: { x: number; y: number }
  /** Aktueller Canvas-Zoom — Screen-Delta → Flow-Delta beim Draggen. */
  zoom: number
  /** Live-Update während des Ziehens (für flüssige Linie + Symbol). */
  onDragMove: (offset: { x: number; y: number }) => void
  /** Drag-Ende → Offset persistieren. */
  onDragEnd: (offset: { x: number; y: number }) => void
  /** Body-Klick → Kabel selektieren + Netz hervorheben. */
  onSelect: () => void
  /** Chevron-Klick → zum nächstgelegenen Gegenstück springen. */
  onNavigate: () => void
  /** Lazy: Netz-Endpunkte (mit Positionen) erst bei Rechtsklick berechnen. */
  getNetInfo: () => { key: string; rows: NetInfoRow[] }
  /** Sprung zu einer konkreten Position (Netz-Info-Zeile). */
  onNavigateTo: (x: number, y: number) => void
  /** „Off-Page auflösen" → wieder als Linie zeichnen. */
  onResolve: () => void
}

const GAP = 10

/** Chevron-Glyph je nach Geräteseite + Flussrichtung. 'out' zeigt vom
 *  Gerät weg, 'in' zeigt ins Gerät hinein. */
const chevronChar = (position: Position | undefined, direction: 'out' | 'in'): string => {
  const outward =
    position === Position.Left
      ? '◀'
      : position === Position.Top
        ? '▲'
        : position === Position.Bottom
          ? '▼'
          : '▶' // Right + default
  const inward =
    position === Position.Left
      ? '▶'
      : position === Position.Top
        ? '▼'
        : position === Position.Bottom
          ? '▲'
          : '◀' // Right + default
  return direction === 'out' ? outward : inward
}

/** Box-Anker: hängt das Symbol außen am Gerät, nicht über den Port. */
const transformFor = (x: number, y: number, position: Position | undefined): string => {
  switch (position) {
    case Position.Right:
      return `translate(${x + GAP}px, ${y}px) translate(0, -50%)`
    case Position.Left:
      return `translate(${x - GAP}px, ${y}px) translate(-100%, -50%)`
    case Position.Top:
      return `translate(${x}px, ${y - GAP}px) translate(-50%, -100%)`
    case Position.Bottom:
      return `translate(${x}px, ${y + GAP}px) translate(-50%, 0)`
    default:
      return `translate(${x}px, ${y}px) translate(-50%, -130%)`
  }
}

export const OffPageConnectorSymbol = ({
  x,
  y,
  position,
  direction,
  netName,
  counterpart,
  color,
  highlighted,
  selected,
  isLight,
  showName,
  offset,
  zoom,
  onDragMove,
  onDragEnd,
  onSelect,
  onNavigate,
  getNetInfo,
  onNavigateTo,
  onResolve,
}: Props) => {
  const t = useTranslation()
  // #507 — Verbindungszeile (Gegenstück) ist immer sichtbar (auch im Ausdruck);
  // die Netzname-Zeile zusätzlich bei Hover oder dauerhaft via showName.
  const [hovered, setHovered] = useState(false)
  const showNet = showName || hovered
  // #507 — Drag-State: Start-Screen-Position + Start-Offset; `moved` trennt
  // Klick (auswählen) von Ziehen (verschieben).
  const dragRef = useRef<{
    sx: number
    sy: number
    ox: number
    oy: number
    moved: boolean
    onChevron: boolean
  } | null>(null)
  const [popover, setPopover] = useState<{
    screenX: number
    screenY: number
    rows: NetInfoRow[]
  } | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!popover) return
    const onDown = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setPopover(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null)
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popover])

  const ring = selected
    ? 'rgba(56,189,248,0.95)'
    : highlighted
      ? 'rgba(251,191,36,0.9)'
      : 'transparent'

  const openNetInfo = (clientX: number, clientY: number) => {
    const info = getNetInfo()
    setPopover({ screenX: clientX, screenY: clientY, rows: info.rows })
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="nodrag nopan"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          openNetInfo(e.clientX, e.clientY)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          // Merkt sich, ob der Druck auf dem Pfeil begann: ohne Bewegung =
          // „springen", sonst (egal wo) = verschieben.
          const onChevron = !!(e.target as HTMLElement).closest('[data-chevron]')
          dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y, moved: false, onChevron }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          const d = dragRef.current
          if (!d) return
          const sdx = e.clientX - d.sx
          const sdy = e.clientY - d.sy
          if (!d.moved && Math.hypot(sdx, sdy) < 3) return
          d.moved = true
          const z = zoom || 1
          onDragMove({ x: d.ox + sdx / z, y: d.oy + sdy / z })
        }}
        onPointerUp={(e) => {
          const d = dragRef.current
          dragRef.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          if (!d) return
          if (d.moved) {
            const z = zoom || 1
            onDragEnd({ x: d.ox + (e.clientX - d.sx) / z, y: d.oy + (e.clientY - d.sy) / z })
          } else if (d.onChevron) {
            onNavigate()
          } else {
            onSelect()
          }
        }}
        title={format(
          t(
            'offPage.symbolTitle',
            'Netz „{net}" → {to} · Klick: auswählen · Pfeil: zum Gegenstück springen · Ziehen: verschieben · Rechtsklick: Netz-Info',
          ),
          { net: netName, to: counterpart },
        )}
        style={{
          position: 'absolute',
          transform: transformFor(x + offset.x, y + offset.y, position),
          display: 'flex',
          alignItems: 'stretch',
          gap: 0,
          maxWidth: 190,
          background: isLight ? 'rgba(248,250,252,0.97)' : 'rgba(15,23,42,0.95)',
          color: isLight ? '#1e293b' : '#e2e8f0',
          border: `1px solid ${isLight ? '#cbd5e1' : '#475569'}`,
          borderLeft: `4px solid ${color}`,
          borderRadius: 5,
          boxShadow: ring !== 'transparent' ? `0 0 0 2px ${ring}` : '0 1px 3px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          pointerEvents: 'all',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <span
          data-chevron
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            fontSize: 13,
            lineHeight: 1,
            color,
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.05)',
            borderRight: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`,
          }}
        >
          {chevronChar(position, direction)}
        </span>
        <div style={{ minWidth: 0, padding: '2px 6px' }}>
          {showNet && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {netName}
            </div>
          )}
          <div
            style={{
              fontSize: 10,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {direction === 'out' ? '→' : '←'} {counterpart}
          </div>
        </div>
      </div>

      {popover &&
        createPortal(
          <div
            ref={popRef}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              position: 'fixed',
              left: Math.min(popover.screenX, window.innerWidth - 240),
              top: Math.min(popover.screenY, window.innerHeight - 260),
              width: 230,
              maxHeight: 252,
              overflowY: 'auto',
              zIndex: 10000,
              borderRadius: 6,
              border: `1px solid ${isLight ? '#cbd5e1' : '#334155'}`,
              background: isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.99)',
              color: isLight ? '#0f172a' : '#e2e8f0',
              boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              fontSize: 12,
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                borderBottom: `1px solid ${isLight ? '#e2e8f0' : '#1e293b'}`,
              }}
            >
              <div style={{ fontWeight: 700 }}>{netName}</div>
              <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8' }}>
                {format(t('offPage.endpointCount', '{n} Endpunkte im Netz'), {
                  n: popover.rows.length,
                })}
              </div>
            </div>
            {popover.rows.map((r, i) => (
              <button
                key={`${r.label}-${i}`}
                type="button"
                onClick={() => {
                  onNavigateTo(r.x, r.y)
                  setPopover(null)
                }}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontWeight: r.isSelf ? 700 : 400,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isLight ? '#f1f5f9' : '#1e293b'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{ color }}>{r.isSelf ? '◉' : '○'}</span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.label}
                </span>
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${isLight ? '#e2e8f0' : '#1e293b'}` }}>
              <button
                type="button"
                onClick={() => {
                  onResolve()
                  setPopover(null)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '6px 10px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: isLight ? '#0369a1' : '#7dd3fc',
                  cursor: 'pointer',
                }}
              >
                {t('offPage.resolve', 'Off-Page auflösen (Linie anzeigen)')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
