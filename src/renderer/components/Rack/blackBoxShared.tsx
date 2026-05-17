// v7.9.40 — Geteilte Black-Box-Visual-Komponenten.
//
// Das Black-Box-Rendering wird an zwei Stellen gebraucht:
//  1. EquipmentNode.tsx — der echte Canvas-Node
//  2. RackLivePreview.tsx — die Live-Preview im 2D Rack Builder
//
// Damit beide IDENTISCH aussehen (inkl. Cable-Tooltips, Band-Farben,
// Bezier-Geometry, Dash-Pattern, Dot-Größe, etc.), liegt das
// Rendering hier zentral. Vorher hatte die Preview eine separate
// Implementierung, die zwangsläufig auseinandergedriftet ist.
//
// Bewusst nur PURE Visuals — keine ReactFlow-Handles, keine Store-
// Hooks. EquipmentNode rendert seine Handles separat darüber.

import type { CSSProperties } from 'react'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'

const PORT_ROW = EQUIPMENT_LAYOUT.PORT_ROW

export interface BlackBoxBand {
  /** Stabile Identität (DeviceIndex auf Canvas, Placement-ID in Preview). */
  key: string
  topSlot: number
  rowSpan: number
  color: string
  deviceName: string
  inputCount: number
  outputCount: number
}

export interface BlackBoxCable {
  key: string
  ax: number
  ay: number
  aSide: 'left' | 'right'
  bx: number
  by: number
  bSide: 'left' | 'right'
  color: string
  /** Tooltip-Text — wird als <title> ans Path angehängt. */
  label: string
}

interface RackBandsOverlayProps {
  bands: ReadonlyArray<BlackBoxBand>
  headerHeight: number
  isLight: boolean
}

/** Bänder-Stripes innerhalb der Black-Box-Card. Position absolut
 *  relativ zur Card. */
export const RackBandsOverlay = ({ bands, headerHeight, isLight }: RackBandsOverlayProps) => {
  return (
    <>
      {bands.map((band) => {
        const top = headerHeight + band.topSlot * PORT_ROW
        const h = band.rowSpan * PORT_ROW
        const bandStyle: CSSProperties = {
          position: 'absolute',
          top,
          left: 6,
          right: 6,
          height: h,
          borderRadius: 4,
          background: isLight ? `${band.color}10` : `${band.color}1a`,
          border: `1px solid ${band.color}55`,
          borderLeft: `4px solid ${band.color}`,
          pointerEvents: 'none',
          boxSizing: 'border-box',
        }
        return (
          <div key={`rack-band-${band.key}`} style={bandStyle}>
            <div
              style={{
                position: 'absolute',
                top: 2,
                left: 8,
                right: 8,
                height: PORT_ROW - 2,
                fontSize: 10,
                fontWeight: 700,
                color: band.color,
                letterSpacing: 0.2,
                lineHeight: `${PORT_ROW - 4}px`,
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textShadow: isLight ? 'none' : '0 1px 1px rgba(0,0,0,0.5)',
              }}
              title={band.deviceName}
            >
              {band.deviceName}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  fontWeight: 500,
                  opacity: 0.7,
                }}
              >
                · {band.inputCount} In · {band.outputCount} Out
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}

interface RackInternalCablesOverlayProps {
  cables: ReadonlyArray<BlackBoxCable>
  width: number
  height?: number
  isLight: boolean
  /** Default-Z-Index ist 2 (über Bändern, unter ReactFlow-Handles).
   *  Preview braucht 'auto' damit der ParentContainer scrollt. */
  zIndex?: number | 'auto'
}

/** SVG-Overlay mit Bezier-Cable-Curves zwischen Port-Ankern. Identische
 *  Geometrie zu EquipmentNode (cp1x/cp2x bei 32%/68% der Breite,
 *  Dash-Pattern 4 2, Opacity 0.9, Dot-r 2.6). Jeder Path hat ein
 *  <title>-Element für das native Browser-Tooltip — entspricht den
 *  "Kabel-Beschreibungen" die der User im Preview sehen will. */
export const RackInternalCablesOverlay = ({
  cables,
  width,
  height,
  isLight,
  zIndex = 2,
}: RackInternalCablesOverlayProps) => {
  // viewBox/preserveAspectRatio nur setzen wenn explizit gewünscht (Preview);
  // im Canvas-Modus rendert ReactFlow das SVG in Node-Pixel-Koordinaten,
  // d.h. 100%-Box reicht aus.
  const viewBox = height != null ? `0 0 ${width} ${height}` : undefined
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        zIndex,
      }}
      viewBox={viewBox}
      preserveAspectRatio={viewBox ? 'none' : undefined}
    >
      {cables.map((c) => {
        const cp1x = c.aSide === 'left' ? width * 0.32 : width * 0.68
        const cp2x = c.bSide === 'left' ? width * 0.32 : width * 0.68
        return (
          <g key={`int-cable-${c.key}`}>
            <path
              d={`M ${c.ax} ${c.ay} C ${cp1x} ${c.ay} ${cp2x} ${c.by} ${c.bx} ${c.by}`}
              fill="none"
              stroke={c.color}
              strokeWidth={1.8}
              strokeDasharray="4 2"
              opacity={0.9}
            >
              <title>{c.label}</title>
            </path>
            <circle
              cx={c.ax}
              cy={c.ay}
              r={2.6}
              fill={c.color}
              stroke={isLight ? '#fff' : '#0f172a'}
              strokeWidth={0.7}
            />
            <circle
              cx={c.bx}
              cy={c.by}
              r={2.6}
              fill={c.color}
              stroke={isLight ? '#fff' : '#0f172a'}
              strokeWidth={0.7}
            />
          </g>
        )
      })}
    </svg>
  )
}
