// v7.9.9 — Live-Preview-Pane für den 2D Rack Builder. Zeigt zwei
// Darstellungen synchron zum Draft:
//
//  1. Schwarz-Box-Card: Wie der Rack als EIN Equipment-Item auf dem
//     Hauptcanvas aussehen wird. Externe Ports (= alle Ports an
//     internen Geräten, die NICHT in internal cables verwendet sind)
//     werden links/rechts gezeigt. So sieht der User vor dem Speichern
//     wie viele Ports am Rack später anstehen.
//
//  2. Internal-Wiring-Overlay: Innerhalb des Rack-Bilds werden die
//     internal cables als gestrichelte Linien zwischen den
//     Slot-Positionen gezeichnet. So sieht der User welche internen
//     Verbindungen schon stehen ohne die Wire-Canvas zu öffnen.
//
// Beide Views aktualisieren sich live während der User den Draft
// bearbeitet.

import { useMemo } from 'react'

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

const HE_PX = 14
const HEADER_PX = 28
const SIDE_PORT_GAP = 14
const SIDE_DOT = 6

export const RackLivePreview = ({
  rackName,
  totalUnits,
  placements,
  cables,
}: RackLivePreviewProps) => {
  const internalsByDevice = useMemo(() => {
    const used = new Map<string, Set<string>>()
    for (const c of cables) {
      if (!used.has(c.fromPlacementId)) used.set(c.fromPlacementId, new Set())
      if (!used.has(c.toPlacementId)) used.set(c.toPlacementId, new Set())
      used.get(c.fromPlacementId)!.add(c.fromPortName)
      used.get(c.toPlacementId)!.add(c.toPortName)
    }
    return used
  }, [cables])

  // Externe Ports: alle die nicht in internal cables verwendet werden.
  const externalIns = useMemo(() => {
    const out: Array<{ device: string; port: string; connectorType: string }> = []
    for (const p of placements) {
      const used = internalsByDevice.get(p.id) ?? new Set()
      for (const port of p.inputs) {
        if (!used.has(port.name)) {
          out.push({ device: p.name, port: port.name, connectorType: port.connectorType })
        }
      }
    }
    return out
  }, [placements, internalsByDevice])

  const externalOuts = useMemo(() => {
    const out: Array<{ device: string; port: string; connectorType: string }> = []
    for (const p of placements) {
      const used = internalsByDevice.get(p.id) ?? new Set()
      for (const port of p.outputs) {
        if (!used.has(port.name)) {
          out.push({ device: p.name, port: port.name, connectorType: port.connectorType })
        }
      }
    }
    return out
  }, [placements, internalsByDevice])

  const placementById = useMemo(
    () => new Map(placements.map((p) => [p.id, p])),
    [placements],
  )

  if (placements.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-center text-[10px] text-slate-500">
        Keine Geräte im Rack — Preview erscheint sobald das erste Gerät zugewiesen ist.
      </div>
    )
  }

  // Schwarz-Box: Höhe wird durch grössere Port-Liste bestimmt
  const totalExtPorts = Math.max(externalIns.length, externalOuts.length, 1)
  const blackBoxHeight = Math.max(80, HEADER_PX + totalExtPorts * SIDE_PORT_GAP + 12)
  // v7.9.10 — Card wider damit "device:port"-Labels nicht abgeschnitten
  // werden. Bei vielen externen Ports + langen Geräte-Namen sind
  // 240px ein guter Default.
  const blackBoxWidth = 260

  // Internal Wiring SVG: Rack-Inneres als Slot-Stack
  const rackInnerHeight = totalUnits * HE_PX
  const rackInnerWidth = 80

  return (
    <div className="space-y-3">
      {/* --- View 1: Black-Box (so sieht es auf dem Canvas aus) --- */}
      <div>
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Black-Box auf Canvas
        </div>
        <div className="flex items-center justify-center rounded border border-slate-700 bg-slate-950/60 p-3">
          <div
            className="relative rounded border-2 border-slate-500 bg-slate-900 shadow-lg"
            style={{ width: blackBoxWidth, height: blackBoxHeight }}
          >
            <div
              className="border-b border-slate-700 bg-slate-800/90 px-2 text-[10px] font-semibold text-slate-100"
              style={{ lineHeight: `${HEADER_PX - 4}px`, paddingTop: 2 }}
              title={rackName}
            >
              {(rackName || '(unbenannt)').slice(0, 28)}
              {(rackName || '').length > 28 ? '…' : ''}
              <span className="ml-1 text-[8px] font-normal text-slate-500">
                ({placements.length} Geräte)
              </span>
            </div>
            {externalIns.map((port, idx) => (
              <div
                key={`in-${idx}`}
                className="absolute left-0 flex items-center gap-1"
                style={{ top: HEADER_PX + 4 + idx * SIDE_PORT_GAP, transform: 'translateX(-50%)' }}
                title={`${port.device}: ${port.port} (${port.connectorType})`}
              >
                <span
                  className="rounded-full border border-slate-700"
                  style={{ width: SIDE_DOT, height: SIDE_DOT, background: '#10b981' }}
                />
              </div>
            ))}
            {externalIns.map((port, idx) => (
              <div
                key={`in-lbl-${idx}`}
                className="absolute truncate text-[8px] text-slate-300"
                style={{
                  left: SIDE_DOT + 4,
                  top: HEADER_PX + idx * SIDE_PORT_GAP,
                  maxWidth: blackBoxWidth / 2 - 8,
                }}
                title={`${port.device}: ${port.port} (${port.connectorType})`}
              >
                <span className="text-slate-500">{port.device.slice(0, 8)}{port.device.length > 8 ? '…' : ''}:</span>
                <span className="font-semibold text-slate-200">{port.port}</span>
              </div>
            ))}
            {externalOuts.map((port, idx) => (
              <div
                key={`out-${idx}`}
                className="absolute right-0 flex items-center gap-1"
                style={{ top: HEADER_PX + 4 + idx * SIDE_PORT_GAP, transform: 'translateX(50%)' }}
                title={`${port.device}: ${port.port} (${port.connectorType})`}
              >
                <span
                  className="rounded-full border border-slate-700"
                  style={{ width: SIDE_DOT, height: SIDE_DOT, background: '#0ea5e9' }}
                />
              </div>
            ))}
            {externalOuts.map((port, idx) => (
              <div
                key={`out-lbl-${idx}`}
                className="absolute truncate text-right text-[8px] text-slate-300"
                style={{
                  right: SIDE_DOT + 4,
                  top: HEADER_PX + idx * SIDE_PORT_GAP,
                  maxWidth: blackBoxWidth / 2 - 8,
                }}
                title={`${port.device}: ${port.port} (${port.connectorType})`}
              >
                <span className="font-semibold text-slate-200">{port.port}</span>
                <span className="text-slate-500">:{port.device.slice(0, 8)}{port.device.length > 8 ? '…' : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div>
            <span className="text-emerald-400">●</span> {externalIns.length} ext. Inputs
          </div>
          <div className="text-right">
            <span className="text-sky-400">●</span> {externalOuts.length} ext. Outputs
          </div>
        </div>
      </div>

      {/* --- View 2: Internal Wiring Schema --- */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Interne Verkabelung
          </div>
          <div className="text-[10px] text-slate-500">{cables.length} Kabel</div>
        </div>
        <div className="rounded border border-slate-700 bg-slate-950/60 p-2">
          <svg
            width="100%"
            height={rackInnerHeight + 12}
            viewBox={`0 0 ${rackInnerWidth + 200} ${rackInnerHeight + 12}`}
            style={{ display: 'block' }}
          >
            {/* Rack-Slots */}
            {Array.from({ length: totalUnits }).map((_, i) => (
              <line
                key={`grid-${i}`}
                x1={0}
                y1={6 + i * HE_PX}
                x2={rackInnerWidth}
                y2={6 + i * HE_PX}
                stroke="#1e293b"
                strokeWidth={0.5}
              />
            ))}
            <rect
              x={0}
              y={6}
              width={rackInnerWidth}
              height={rackInnerHeight}
              fill="none"
              stroke="#475569"
              strokeWidth={1}
            />
            {placements.map((p) => {
              const top = 6 + (p.startUnit - 1) * HE_PX
              const h = p.rackUnits * HE_PX
              return (
                <g key={p.id}>
                  <rect
                    x={2}
                    y={top}
                    width={rackInnerWidth - 4}
                    height={h - 1}
                    fill="#334155"
                    stroke="#64748b"
                    strokeWidth={0.5}
                    rx={2}
                  />
                  <text
                    x={rackInnerWidth / 2}
                    y={top + h / 2 + 3}
                    fill="#e2e8f0"
                    fontSize={Math.min(9, h - 2)}
                    textAnchor="middle"
                  >
                    {p.name.slice(0, 14)}
                  </text>
                </g>
              )
            })}
            {/* v7.9.10 — Pro Gerät bekommt jeder beteiligte Port einen
                eigenen Slot entlang der Geräte-Höhe. Vorher landeten
                alle Kabel auf dem Geräte-Center → bei mehreren Kabeln
                stack-overlap. Jetzt distinct Port-Stub-Position pro
                Port-Name. */}
            {(() => {
              const portSlotsByDevice = new Map<string, string[]>()
              for (const c of cables) {
                if (!portSlotsByDevice.has(c.fromPlacementId))
                  portSlotsByDevice.set(c.fromPlacementId, [])
                if (!portSlotsByDevice.has(c.toPlacementId))
                  portSlotsByDevice.set(c.toPlacementId, [])
                const fromList = portSlotsByDevice.get(c.fromPlacementId)!
                if (!fromList.includes(c.fromPortName)) fromList.push(c.fromPortName)
                const toList = portSlotsByDevice.get(c.toPlacementId)!
                if (!toList.includes(c.toPortName)) toList.push(c.toPortName)
              }
              const portSlotY = (placementId: string, portName: string): number => {
                const p = placementById.get(placementId)
                if (!p) return 6
                const itemTop = 6 + (p.startUnit - 1) * HE_PX
                const itemH = p.rackUnits * HE_PX
                const slots = portSlotsByDevice.get(placementId) ?? [portName]
                const idx = Math.max(0, slots.indexOf(portName))
                const count = slots.length
                if (count <= 1) return itemTop + itemH / 2
                const usable = itemH * 0.8
                const startY = itemTop + itemH * 0.1
                return startY + (idx / (count - 1)) * usable
              }

              return (
                <>
                  {/* Port-Stub-Markers + Labels pro Gerät */}
                  {Array.from(portSlotsByDevice.entries()).flatMap(([pid, ports]) =>
                    ports.map((portName, idx) => {
                      const y = portSlotY(pid, portName)
                      return (
                        <g key={`stub-${pid}-${idx}`}>
                          <circle
                            cx={rackInnerWidth}
                            cy={y}
                            r={2}
                            fill="#94a3b8"
                          />
                          <text
                            x={rackInnerWidth + 5}
                            y={y + 2}
                            fill="#64748b"
                            fontSize={7}
                          >
                            {portName}
                          </text>
                        </g>
                      )
                    }),
                  )}
                  {/* Kabel zwischen Port-Stubs */}
                  {cables.map((c, i) => {
                    const from = placementById.get(c.fromPlacementId)
                    const to = placementById.get(c.toPlacementId)
                    if (!from || !to) return null
                    const y1 = portSlotY(c.fromPlacementId, c.fromPortName)
                    const y2 = portSlotY(c.toPlacementId, c.toPortName)
                    const x1 = rackInnerWidth
                    const bulge = 30 + Math.min(40, Math.abs(y2 - y1) * 0.25)
                    const midX = x1 + bulge
                    const color = c.color ?? '#0ea5e9'
                    return (
                      <path
                        key={`cable-${i}`}
                        d={`M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x1} ${y2}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={1.4}
                        strokeDasharray="3 2"
                        opacity={0.85}
                      />
                    )
                  })}
                </>
              )
            })()}
            {cables.length === 0 && (
              <text
                x={rackInnerWidth + 30}
                y={rackInnerHeight / 2}
                fill="#64748b"
                fontSize={9}
                textAnchor="middle"
              >
                Keine internen Kabel
              </text>
            )}
          </svg>
        </div>
        {cables.length > 0 && (
          <ul className="mt-1 max-h-32 space-y-0.5 overflow-auto text-[10px] text-slate-400">
            {cables.slice(0, 20).map((c, i) => {
              const from = placementById.get(c.fromPlacementId)
              const to = placementById.get(c.toPlacementId)
              if (!from || !to) return null
              return (
                <li key={`list-${i}`} className="truncate">
                  <span
                    className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: c.color ?? '#0ea5e9' }}
                  />
                  {from.name}:{c.fromPortName} → {to.name}:{c.toPortName}
                </li>
              )
            })}
            {cables.length > 20 && (
              <li className="text-[9px] italic text-slate-600">… und {cables.length - 20} weitere</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
