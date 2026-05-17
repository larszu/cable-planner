// v7.9.39 — Live-Preview im 2D Rack Builder ist jetzt visuell IDENTISCH
// mit der Black-Box-Darstellung auf dem Canvas:
//
//  - Bänder pro Quell-Gerät, sortiert nach HE-Position
//  - Band-Farbe per rackBandColor() (gleicher Algorithmus wie Canvas)
//  - Translucent-Background + farbige Linke-Kante + Name-Label
//  - In/Out-Ports innerhalb des Bandes vertikal gestapelt
//  - SVG-Overlay mit den internen Bezier-Kabel-Curves
//
// Die separate "Interne Verkabelung Schema"-View ist weggefallen — sie
// duplizierte das was die Black-Box jetzt selbst zeigt und hat im
// Builder zu viel Höhe gefressen.
//
// Konstanten und Render-Logik sind 1:1 an EquipmentNode angelehnt
// (PORT_ROW, HEADER, padding, Bezier-Curve-Math) damit "exakt identisch"
// auch bei späteren Tweaks gilt.
//
// Datenfluss: der Builder gibt PreviewPlacement[]+PreviewCable[] rein,
// referenziert per Placement-ID + Port-Name. Wir mappen das auf einen
// Black-Box-View ohne dafür eine echte EquipmentNode rendern zu müssen
// (die wäre ohne ReactFlow-Context schwer einzubinden).
import { useMemo } from 'react'
import { rackBandColor } from '../../lib/rackBandColors'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'

interface PreviewPlacement {
  id: string
  name: string
  startUnit: number
  rackUnits: number
  inputs: Array<{ id: string; name: string; connectorType: string }>
  outputs: Array<{ id: string; name: string; connectorType: string }>
}

interface PreviewCable {
  fromPlacementId: string
  fromPortName: string
  toPlacementId: string
  toPortName: string
  color?: string
}

interface RackLivePreviewProps {
  rackName: string
  totalUnits: number
  placements: PreviewPlacement[]
  cables: PreviewCable[]
}

// Match EquipmentNode constants (gleiche Konstanten = gleiches Pixel-Raster).
const PORT_ROW = EQUIPMENT_LAYOUT.PORT_ROW
const HEADER_HEIGHT = EQUIPMENT_LAYOUT.HEADER_HEIGHT
const PADDING = EQUIPMENT_LAYOUT.PADDING
const HANDLE_R = 4
const BAND_HEADER_ROW = 1
const GAP_BETWEEN_BANDS = 1
const BLACK_BOX_WIDTH = 260

interface Band {
  placement: PreviewPlacement
  color: string
  topSlot: number
  rowSpan: number
  externalInputs: Array<{ id: string; name: string; connectorType: string }>
  externalOutputs: Array<{ id: string; name: string; connectorType: string }>
}

export const RackLivePreview = ({
  rackName,
  totalUnits: _totalUnits,
  placements,
  cables,
}: RackLivePreviewProps) => {
  void _totalUnits // height is derived from band stack, totalUnits only used in the rack-builder grid

  // Ports, die in internen Kabeln verwendet werden, gelten als "intern"
  // und tauchen NICHT als externe Ports an der Black-Box auf — exakt
  // wie der Canvas sie filtert.
  const usedPorts = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const c of cables) {
      if (!m.has(c.fromPlacementId)) m.set(c.fromPlacementId, new Set())
      if (!m.has(c.toPlacementId)) m.set(c.toPlacementId, new Set())
      m.get(c.fromPlacementId)!.add(c.fromPortName)
      m.get(c.toPlacementId)!.add(c.toPortName)
    }
    return m
  }, [cables])

  // Bänder aufbauen: ein Band pro Placement, sortiert nach HE-Position
  // (kleinster startUnit oben), exakt wie EquipmentNode es macht.
  const bands = useMemo<Band[]>(() => {
    const sorted = [...placements].sort((a, b) => a.startUnit - b.startUnit)
    let cursor = 0
    const result: Band[] = []
    for (const p of sorted) {
      const used = usedPorts.get(p.id) ?? new Set<string>()
      const externalInputs = p.inputs.filter((port) => !used.has(port.name))
      const externalOutputs = p.outputs.filter((port) => !used.has(port.name))
      const ports = Math.max(externalInputs.length, externalOutputs.length, 1)
      const rowSpan = BAND_HEADER_ROW + ports
      result.push({
        placement: p,
        color: rackBandColor(p.name),
        topSlot: cursor,
        rowSpan,
        externalInputs,
        externalOutputs,
      })
      cursor += rowSpan + GAP_BETWEEN_BANDS
    }
    return result
  }, [placements, usedPorts])

  // Berechne Anker-Punkte (x, y) für JEDEN Port (intern + extern),
  // damit das SVG-Overlay die internen Cable-Curves zwischen ihnen
  // ziehen kann. Wie auf dem Canvas: x=0 (left) / x=width (right),
  // y in der Mitte der jeweiligen Port-Zeile.
  type PortAnchor = { x: number; y: number; side: 'left' | 'right' }
  const portAnchorByKey = useMemo(() => {
    const m = new Map<string, PortAnchor>()
    for (const band of bands) {
      // Internal-only Ports (= used in cables) liegen visuell auf dem
      // Geräte-Center; sie haben keinen externen Pin aber Bezier-Curves
      // sollen trotzdem da starten/enden.
      const used = usedPorts.get(band.placement.id) ?? new Set<string>()
      const allInputs = band.placement.inputs
      const allOutputs = band.placement.outputs
      // External-Slot-Indizes (= Reihenfolge in band.externalInputs)
      const externalInputIdx = new Map(band.externalInputs.map((p, i) => [p.name, i]))
      const externalOutputIdx = new Map(band.externalOutputs.map((p, i) => [p.name, i]))
      const bandTopPx = HEADER_HEIGHT + band.topSlot * PORT_ROW
      const portsTopPx = bandTopPx + BAND_HEADER_ROW * PORT_ROW
      const internalCenterY = bandTopPx + (band.rowSpan * PORT_ROW) / 2
      for (const port of allInputs) {
        let y: number
        if (externalInputIdx.has(port.name)) {
          y = portsTopPx + (externalInputIdx.get(port.name) ?? 0) * PORT_ROW + PORT_ROW / 2
        } else {
          // Internal-only port → ankert in der Mitte des Bandes
          y = internalCenterY
        }
        m.set(`${band.placement.id}:${port.name}`, { x: 0, y, side: 'left' })
      }
      for (const port of allOutputs) {
        let y: number
        if (externalOutputIdx.has(port.name)) {
          y = portsTopPx + (externalOutputIdx.get(port.name) ?? 0) * PORT_ROW + PORT_ROW / 2
        } else {
          y = internalCenterY
        }
        m.set(`${band.placement.id}:${port.name}`, { x: BLACK_BOX_WIDTH, y, side: 'right' })
      }
      // Wenn ein Port-Name sowohl in inputs als auch outputs ist (selten),
      // gewinnt der zuletzt gesetzte. Vernachlässigbar für die Preview.
      void used
    }
    return m
  }, [bands, usedPorts])

  if (placements.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-center text-[10px] text-slate-500">
        Keine Geräte im Rack — Preview erscheint sobald das erste Gerät zugewiesen ist.
      </div>
    )
  }

  // Höhe der Black-Box = Header + alle Bänder + Padding unten
  const totalSlots = bands.reduce(
    (acc, b) => Math.max(acc, b.topSlot + b.rowSpan),
    0,
  )
  const blackBoxHeight = HEADER_HEIGHT + totalSlots * PORT_ROW + PADDING

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Black-Box auf Canvas
        </div>
        <div className="text-[10px] text-slate-500">
          {placements.length} Geräte · {cables.length} interne Kabel
        </div>
      </div>
      <div className="flex items-start justify-center rounded border border-slate-700 bg-slate-950/60 p-3">
        <div
          className="relative rounded border-2 border-slate-500 bg-slate-900 shadow-lg"
          style={{ width: BLACK_BOX_WIDTH, height: blackBoxHeight }}
        >
          {/* Header */}
          <div
            className="border-b border-slate-700 bg-slate-800/90 px-2 text-[11px] font-semibold text-slate-100"
            style={{ lineHeight: `${HEADER_HEIGHT - 6}px`, height: HEADER_HEIGHT, paddingTop: 3, boxSizing: 'border-box' }}
            title={rackName}
          >
            {(rackName || '(unbenannt)').slice(0, 32)}
            {(rackName || '').length > 32 ? '…' : ''}
          </div>

          {/* Bänder */}
          {bands.map((band) => {
            const top = HEADER_HEIGHT + band.topSlot * PORT_ROW
            const h = band.rowSpan * PORT_ROW
            return (
              <div
                key={`band-${band.placement.id}`}
                style={{
                  position: 'absolute',
                  top,
                  left: 6,
                  right: 6,
                  height: h,
                  borderRadius: 4,
                  background: `${band.color}1a`,
                  border: `1px solid ${band.color}55`,
                  borderLeft: `4px solid ${band.color}`,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              >
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
                    textShadow: '0 1px 1px rgba(0,0,0,0.5)',
                  }}
                  title={band.placement.name}
                >
                  {band.placement.name}
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      fontWeight: 500,
                      opacity: 0.7,
                    }}
                  >
                    · {band.externalInputs.length} In · {band.externalOutputs.length} Out
                  </span>
                </div>
              </div>
            )
          })}

          {/* Externe Port-Dots links (Inputs) */}
          {bands.flatMap((band) =>
            band.externalInputs.map((port, idx) => {
              const y =
                HEADER_HEIGHT +
                (band.topSlot + BAND_HEADER_ROW + idx) * PORT_ROW +
                PORT_ROW / 2
              return (
                <div
                  key={`pin-in-${band.placement.id}-${port.name}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    width: HANDLE_R * 2,
                    height: HANDLE_R * 2,
                    borderRadius: '50%',
                    background: band.color,
                    border: '1px solid #0f172a',
                    boxSizing: 'border-box',
                  }}
                  title={`${band.placement.name}: ${port.name} (${port.connectorType})`}
                />
              )
            }),
          )}
          {/* Externe Port-Dots rechts (Outputs) */}
          {bands.flatMap((band) =>
            band.externalOutputs.map((port, idx) => {
              const y =
                HEADER_HEIGHT +
                (band.topSlot + BAND_HEADER_ROW + idx) * PORT_ROW +
                PORT_ROW / 2
              return (
                <div
                  key={`pin-out-${band.placement.id}-${port.name}`}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: y,
                    transform: 'translate(50%, -50%)',
                    width: HANDLE_R * 2,
                    height: HANDLE_R * 2,
                    borderRadius: '50%',
                    background: band.color,
                    border: '1px solid #0f172a',
                    boxSizing: 'border-box',
                  }}
                  title={`${band.placement.name}: ${port.name} (${port.connectorType})`}
                />
              )
            }),
          )}

          {/* Interne Cable-Curves — gleicher Look wie Canvas:
              gestrichelt 4 2, opacity 0.9, color fallback #94a3b8,
              Bezier mit cp auf 32%/68% der Breite je nach Seite. */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
            viewBox={`0 0 ${BLACK_BOX_WIDTH} ${blackBoxHeight}`}
            preserveAspectRatio="none"
          >
            {cables.map((c, i) => {
              const a = portAnchorByKey.get(`${c.fromPlacementId}:${c.fromPortName}`)
              const b = portAnchorByKey.get(`${c.toPlacementId}:${c.toPortName}`)
              if (!a || !b) return null
              const cp1x = a.side === 'left' ? BLACK_BOX_WIDTH * 0.32 : BLACK_BOX_WIDTH * 0.68
              const cp2x = b.side === 'left' ? BLACK_BOX_WIDTH * 0.32 : BLACK_BOX_WIDTH * 0.68
              const color = c.color ?? '#94a3b8'
              return (
                <g key={`int-${i}`}>
                  <path
                    d={`M ${a.x} ${a.y} C ${cp1x} ${a.y} ${cp2x} ${b.y} ${b.x} ${b.y}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.8}
                    strokeDasharray="4 2"
                    opacity={0.9}
                  />
                  <circle
                    cx={a.x}
                    cy={a.y}
                    r={2.6}
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth={0.7}
                  />
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={2.6}
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth={0.7}
                  />
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}
