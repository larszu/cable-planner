/**
 * #170 / Patchblende — Schematische Steckersymbole.
 *
 * Zeichnet pro Connector-Familie ein einfaches Linien-Symbol (XLR-Pins,
 * BNC-Ring, Klinke, RJ45-Keystone, D-Sub, Glasfaser …) angelehnt an die
 * Symbolik von Patchbay-CAD-Tools. Vom ConnectorPicker / Patchblenden-Dialog
 * genutzt, damit der User den Stecker visuell erkennt.
 *
 * Stil: stroke = currentColor (Tile/Parent setzt die Farbe), fill none außer
 * für Kontakt-Pins. Männliche Pins sind gefüllt, weibliche hohl. Alle Symbole
 * leben im viewBox 0 0 40 40 (Zentrum 20,20), damit sie frei skalieren.
 */
import type { ReactElement } from 'react'
import type { ConnectorSymbolId } from '../../lib/connectorCatalog'

interface ConnectorSymbolProps {
  symbol: ConnectorSymbolId
  pins?: number
  poles?: number
  gender?: 'male' | 'female'
  flow?: 'in' | 'out'
  mini?: boolean
  /** Pixelgröße (quadratisch). Default 28. */
  size?: number
  className?: string
  title?: string
}

/** Pin-Positionen gleichmäßig auf einem Kreis (Start oben). */
const ringPins = (n: number, cx: number, cy: number, r: number) => {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    const a = (-90 + (360 / n) * i) * (Math.PI / 180)
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return pts
}

const xlrPins = (n: number) => {
  if (n <= 6) {
    const r = 3.5 + n * 0.8
    return ringPins(n, 20, 20, r)
  }
  // 7-pol: 6 außen + 1 Mitte.
  return [...ringPins(6, 20, 20, 8.5), { x: 20, y: 20 }]
}

const renderBody = (p: ConnectorSymbolProps): ReactElement => {
  const pinFill = p.gender === 'male' ? 'currentColor' : 'none'
  switch (p.symbol) {
    case 'xlr': {
      const pts = xlrPins(p.pins ?? 3)
      return (
        <g>
          <circle cx={20} cy={20} r={15} />
          {/* Key-Nase oben */}
          <line x1={20} y1={5} x2={20} y2={8} />
          {pts.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.9} fill={pinFill} />
          ))}
        </g>
      )
    }
    case 'jack': {
      const poles = p.poles ?? 3
      const outer = p.mini ? 12 : 15
      const rings = Math.max(0, poles - 1)
      return (
        <g>
          <circle cx={20} cy={20} r={outer} />
          {Array.from({ length: rings }, (_, i) => (
            <circle key={i} cx={20} cy={20} r={(p.mini ? 7 : 9) - i * (p.mini ? 3.5 : 4)} />
          ))}
          <circle cx={20} cy={20} r={2.4} fill="currentColor" />
        </g>
      )
    }
    case 'bantam':
      return (
        <g>
          {/* schlanker TT-Stecker im Profil */}
          <rect x={15} y={8} width={10} height={24} rx={4} />
          <circle cx={20} cy={11} r={2.6} fill="currentColor" />
          <line x1={15} y1={20} x2={25} y2={20} />
        </g>
      )
    case 'combo':
      return (
        <g>
          <circle cx={20} cy={20} r={15} />
          {ringPins(3, 20, 20, 10).map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.7} fill={pinFill} />
          ))}
          <circle cx={20} cy={20} r={6} />
          <circle cx={20} cy={20} r={2.2} fill="currentColor" />
        </g>
      )
    case 'speakon': {
      const poles = p.poles ?? 4
      return (
        <g>
          <circle cx={20} cy={20} r={15} />
          {/* Twist-Lock-Keyway als offener Innenring */}
          <path d="M 20 11 A 9 9 0 1 1 13 25" fill="none" />
          {ringPins(poles, 20, 20, 5).map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.5} fill="currentColor" />
          ))}
        </g>
      )
    }
    case 'phono':
      return (
        <g>
          <path d="M 31 17 A 13 13 0 1 1 31 23" fill="none" />
          <circle cx={20} cy={20} r={6} />
          <circle cx={20} cy={20} r={2.4} fill="currentColor" />
        </g>
      )
    case 'binding-post':
      return (
        <g>
          <circle cx={13} cy={20} r={6} />
          <circle cx={13} cy={20} r={2} fill="currentColor" />
          <circle cx={27} cy={20} r={6} />
          <circle cx={27} cy={20} r={2} fill="currentColor" />
        </g>
      )
    case 'midi':
      return (
        <g>
          <circle cx={20} cy={20} r={15} />
          {/* Key-Slot unten */}
          <rect x={17} y={31} width={6} height={4} rx={1} />
          {[
            { x: 14, y: 25 },
            { x: 26, y: 25 },
            { x: 12, y: 18 },
            { x: 28, y: 18 },
            { x: 20, y: 13 },
          ].map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.8} fill={pinFill} />
          ))}
        </g>
      )
    case 'bnc':
      return (
        <g>
          <circle cx={20} cy={20} r={13} />
          {/* Bajonett-Nasen */}
          <line x1={5} y1={20} x2={8} y2={20} />
          <line x1={32} y1={20} x2={35} y2={20} />
          <circle cx={20} cy={20} r={6} />
          <circle cx={20} cy={20} r={2.2} fill="currentColor" />
        </g>
      )
    case 'vga':
      return (
        <g>
          <path d="M 6 13 L 34 13 L 31 27 L 9 27 Z" />
          {[17, 20, 23].map((y, row) =>
            Array.from({ length: 5 }, (_, col) => (
              <circle
                key={`${row}-${col}`}
                cx={11 + col * 4.5 + (row === 1 ? 2.25 : 0)}
                cy={y}
                r={1.1}
                fill="currentColor"
              />
            )),
          )}
        </g>
      )
    case 'mini-din': {
      const n = p.pins ?? 4
      const layout =
        n === 6
          ? [
              { x: 14, y: 17 },
              { x: 26, y: 17 },
              { x: 12, y: 22 },
              { x: 28, y: 22 },
              { x: 17, y: 25 },
              { x: 23, y: 25 },
            ]
          : [
              { x: 15, y: 17 },
              { x: 25, y: 17 },
              { x: 15, y: 23 },
              { x: 25, y: 23 },
            ]
      return (
        <g>
          <circle cx={20} cy={20} r={13} />
          <rect x={16} y={29} width={8} height={4} rx={1} />
          {layout.map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.6} fill={pinFill} />
          ))}
        </g>
      )
    }
    case 'hdmi':
      return (
        <g>
          <path d="M 8 15 L 32 15 L 32 22 L 27 26 L 13 26 L 8 22 Z" />
          <line x1={12} y1={19} x2={28} y2={19} />
        </g>
      )
    case 'f-conn':
      return (
        <g>
          {ringPins(6, 20, 20, 12).reduce<ReactElement[]>((acc, _, i, arr) => {
            const a = arr[i]
            const b = arr[(i + 1) % arr.length]
            acc.push(<line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />)
            return acc
          }, [])}
          <circle cx={20} cy={20} r={6} />
          <circle cx={20} cy={20} r={2.2} fill="currentColor" />
        </g>
      )
    case 'displayport':
      return (
        <g>
          <path d="M 8 15 L 32 15 L 32 25 L 14 25 L 8 20 Z" />
          <line x1={13} y1={19} x2={29} y2={19} />
        </g>
      )
    case 'dvi':
      return (
        <g>
          <rect x={6} y={14} width={28} height={12} rx={1.5} />
          {[16.5, 20, 23.5].map((y, row) =>
            Array.from({ length: 6 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={9 + col * 3} cy={y} r={0.9} fill="currentColor" />
            )),
          )}
          <rect x={29} y={16} width={3} height={8} />
        </g>
      )
    case 'dsub': {
      const n = p.pins ?? 9
      const top = Math.ceil(n / 2)
      const bottom = n - top
      const r = n > 20 ? 0.7 : 1.1
      const row = (count: number, y: number, offset: number) =>
        Array.from({ length: count }, (_, i) => {
          const span = 24
          const step = span / Math.max(count - 1, 1)
          return (
            <circle key={`${y}-${i}`} cx={8 + offset + i * step} cy={y} r={r} fill="currentColor" />
          )
        })
      return (
        <g>
          <path d="M 5 13 L 35 13 L 32 27 L 8 27 Z" />
          {row(top, 18, 0)}
          {row(bottom, 23, 1.5)}
        </g>
      )
    }
    case 'rj45':
      return (
        <g>
          <path d="M 12 8 L 28 8 L 28 27 L 24 27 L 24 32 L 16 32 L 16 27 L 12 27 Z" />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={13.5 + i * 1.8} y1={10} x2={13.5 + i * 1.8} y2={15} />
          ))}
        </g>
      )
    case 'usb-a':
      return (
        <g>
          <rect x={7} y={15} width={26} height={11} rx={1} />
          <rect x={10} y={16.5} width={20} height={3.5} fill="currentColor" />
        </g>
      )
    case 'usb-b':
      return (
        <g>
          <path d="M 13 12 L 27 12 L 29 16 L 29 28 L 11 28 L 11 16 Z" />
          <rect x={15} y={15} width={10} height={3.5} fill="currentColor" />
        </g>
      )
    case 'firewire': {
      const fw800 = (p.pins ?? 6) >= 9
      return fw800 ? (
        <g>
          <path d="M 13 13 L 27 13 L 29 16 L 29 27 L 11 27 L 11 16 Z" />
          <rect x={15} y={17} width={10} height={4} fill="currentColor" />
        </g>
      ) : (
        <g>
          <path d="M 11 16 L 25 16 L 29 20 L 25 24 L 11 24 Z" />
          <rect x={13} y={18.5} width={9} height={3} fill="currentColor" />
        </g>
      )
    }
    case 'fiber-lc':
      return (
        <g>
          {[12, 23].map((x, i) => (
            <g key={i}>
              <rect x={x} y={13} width={7} height={14} rx={1} />
              <line x1={x + 1} y1={12} x2={x + 6} y2={12} />
            </g>
          ))}
        </g>
      )
    case 'fiber-sc':
      return (
        <g>
          <rect x={11} y={11} width={18} height={18} rx={1.5} />
          <rect x={15} y={15} width={10} height={10} rx={1} />
          <line x1={16} y1={11} x2={24} y2={11} />
        </g>
      )
    case 'fiber-st':
      return (
        <g>
          <circle cx={20} cy={20} r={12} />
          <line x1={20} y1={6} x2={20} y2={9} />
          <circle cx={20} cy={20} r={4.5} />
          <circle cx={20} cy={20} r={1.6} fill="currentColor" />
        </g>
      )
    case 'toslink':
      return (
        <g>
          <path d="M 11 13 L 17 13 L 20 16 L 23 13 L 29 13 L 29 27 L 11 27 Z" />
          <circle cx={20} cy={21} r={3} fill="currentColor" />
        </g>
      )
    case 'powercon': {
      const out = p.flow === 'out'
      return (
        <g>
          {/* runder Body mit Flachseite */}
          <path d="M 20 7 A 13 13 0 1 1 11 29 L 29 29 A 13 13 0 0 0 20 7 Z" fill="none" />
          {ringPins(3, 20, 19, 5).map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.7} fill="currentColor" />
          ))}
          {/* In/Out-Pfeil */}
          <line x1={20} y1={out ? 20 : 14} x2={20} y2={out ? 14 : 20} />
          <path
            d={out ? 'M 17 16 L 20 13 L 23 16' : 'M 17 17 L 20 20 L 23 17'}
            fill="none"
          />
        </g>
      )
    }
    case 'lemo':
      return (
        <g>
          <circle cx={20} cy={20} r={12} />
          <circle cx={20} cy={9} r={2} fill="currentColor" />
          {ringPins(3, 20, 21, 4.5).map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r={1.5} fill="currentColor" />
          ))}
        </g>
      )
    case 'generic':
      return (
        <g>
          <rect x={8} y={8} width={24} height={24} rx={6} />
          <circle cx={20} cy={20} r={4.5} />
        </g>
      )
    case 'blank':
      return (
        <g>
          <rect x={7} y={12} width={26} height={16} rx={2} />
          {[12, 18, 24, 30].map((x, i) => (
            <line key={i} x1={x} y1={28} x2={x + 6} y2={12} />
          ))}
        </g>
      )
    default:
      return (
        <g>
          <rect x={8} y={8} width={24} height={24} rx={6} />
        </g>
      )
  }
}

export const ConnectorSymbol = ({
  size = 28,
  className,
  title,
  ...rest
}: ConnectorSymbolProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    role="img"
    aria-label={title}
  >
    {title ? <title>{title}</title> : null}
    {renderBody(rest)}
  </svg>
)
