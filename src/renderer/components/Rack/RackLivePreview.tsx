// v7.9.40 — Live-Preview im 2D Rack Builder rendert die echte Canvas-
// Black-Box, weil sie jetzt dieselbe Shared-Komponente nutzt wie
// EquipmentNode (RackBandsOverlay + RackInternalCablesOverlay). Damit:
//  - Identische Band-Farben, Position, Header-Style
//  - Identische Bezier-Geometry, Dash, Opacity, Dots
//  - Identische Cable-Tooltips (Hover am Pfad zeigt "Intern: A:p ↔ B:p")
//
// Pre-v7.9.40 hatte die Preview eine separate Implementierung der
// Cable-Curves OHNE Tooltips — der User hat das als "die Beschreibungen
// an den Kabeln vergessen" wahrgenommen. Fix: dasselbe Element rendern.
//
// Die separate "Interne Verkabelung Schema"-View ist weggefallen — sie
// duplizierte das was die Black-Box jetzt selbst zeigt.

import { useMemo } from 'react'
import { rackBandColor } from '../../lib/rackBandColors'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'
import {
  RackBandsOverlay,
  RackInternalCablesOverlay,
  type BlackBoxBand,
  type BlackBoxCable,
} from './blackBoxShared'
import { format, useTranslation } from '../../lib/i18n'

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

const PORT_ROW = EQUIPMENT_LAYOUT.PORT_ROW
const HEADER_HEIGHT = EQUIPMENT_LAYOUT.HEADER_HEIGHT
const PADDING = EQUIPMENT_LAYOUT.PADDING
const HANDLE_R = 4
const BAND_HEADER_ROW = 1
const GAP_BETWEEN_BANDS = 1
const BLACK_BOX_WIDTH = 260

interface BandComputed {
  placement: PreviewPlacement
  band: BlackBoxBand
  externalInputs: Array<{ name: string; connectorType: string }>
  externalOutputs: Array<{ name: string; connectorType: string }>
}

export const RackLivePreview = ({
  rackName,
  totalUnits: _totalUnits,
  placements,
  cables,
}: RackLivePreviewProps) => {
  const t = useTranslation()
  void _totalUnits

  // Ports die in internen Kabeln verwendet werden = "intern" und tauchen
  // nicht als externe Ports an der Black-Box auf (Canvas-Verhalten).
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

  // Bänder aufbauen — sortiert nach HE-Position wie auf dem Canvas.
  const bandsComputed = useMemo<BandComputed[]>(() => {
    const sorted = [...placements].sort((a, b) => a.startUnit - b.startUnit)
    let cursor = 0
    const result: BandComputed[] = []
    for (const p of sorted) {
      const used = usedPorts.get(p.id) ?? new Set<string>()
      const externalInputs = p.inputs.filter((port) => !used.has(port.name))
      const externalOutputs = p.outputs.filter((port) => !used.has(port.name))
      const ports = Math.max(externalInputs.length, externalOutputs.length, 1)
      const rowSpan = BAND_HEADER_ROW + ports
      const color = rackBandColor(p.name)
      result.push({
        placement: p,
        band: {
          key: p.id,
          topSlot: cursor,
          rowSpan,
          color,
          deviceName: p.name,
          inputCount: externalInputs.length,
          outputCount: externalOutputs.length,
        },
        externalInputs,
        externalOutputs,
      })
      cursor += rowSpan + GAP_BETWEEN_BANDS
    }
    return result
  }, [placements, usedPorts])

  // Port-Anker (x, y, side) für jeden Port — extern an der jeweiligen
  // Slot-Y-Position, intern in der Mitte des Bandes (gleich wie Canvas).
  const portAnchorByKey = useMemo(() => {
    type Anchor = { x: number; y: number; side: 'left' | 'right' }
    const m = new Map<string, Anchor>()
    for (const bc of bandsComputed) {
      const bandTopPx = HEADER_HEIGHT + bc.band.topSlot * PORT_ROW
      const portsTopPx = bandTopPx + BAND_HEADER_ROW * PORT_ROW
      const internalCenterY = bandTopPx + (bc.band.rowSpan * PORT_ROW) / 2
      const externalInputIdx = new Map(bc.externalInputs.map((p, i) => [p.name, i]))
      const externalOutputIdx = new Map(bc.externalOutputs.map((p, i) => [p.name, i]))
      for (const port of bc.placement.inputs) {
        const idx = externalInputIdx.get(port.name)
        const y =
          idx != null
            ? portsTopPx + idx * PORT_ROW + PORT_ROW / 2
            : internalCenterY
        m.set(`${bc.placement.id}:${port.name}`, { x: 0, y, side: 'left' })
      }
      for (const port of bc.placement.outputs) {
        const idx = externalOutputIdx.get(port.name)
        const y =
          idx != null
            ? portsTopPx + idx * PORT_ROW + PORT_ROW / 2
            : internalCenterY
        m.set(`${bc.placement.id}:${port.name}`, { x: BLACK_BOX_WIDTH, y, side: 'right' })
      }
    }
    return m
  }, [bandsComputed])

  const placementById = useMemo(
    () => new Map(placements.map((p) => [p.id, p])),
    [placements],
  )

  // Cables in das shared BlackBoxCable-Format umrechnen — identische
  // Anchor-Berechnung wie EquipmentNode, damit der gerenderte Pfad
  // exakt gleich aussieht.
  const blackBoxCables = useMemo<BlackBoxCable[]>(() => {
    const list: BlackBoxCable[] = []
    for (let i = 0; i < cables.length; i++) {
      const c = cables[i]
      const a = portAnchorByKey.get(`${c.fromPlacementId}:${c.fromPortName}`)
      const b = portAnchorByKey.get(`${c.toPlacementId}:${c.toPortName}`)
      if (!a || !b) continue
      const fromName = placementById.get(c.fromPlacementId)?.name ?? '?'
      const toName = placementById.get(c.toPlacementId)?.name ?? '?'
      list.push({
        key: String(i),
        ax: a.x,
        ay: a.y,
        aSide: a.side,
        bx: b.x,
        by: b.y,
        bSide: b.side,
        color: c.color ?? '#94a3b8',
        label: format(
          t('rackPreview.cableTooltip', 'Intern: {from}:{fromPort} ↔ {to}:{toPort}'),
          { from: fromName, fromPort: c.fromPortName, to: toName, toPort: c.toPortName },
        ),
      })
    }
    return list
  }, [cables, portAnchorByKey, placementById])

  if (placements.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 bg-slate-950/40 p-3 text-center text-[10px] text-slate-400">
        {t(
          'rackPreview.empty',
          'Keine Geräte im Rack — Preview erscheint sobald das erste Gerät zugewiesen ist.',
        )}
      </div>
    )
  }

  const totalSlots = bandsComputed.reduce(
    (acc, b) => Math.max(acc, b.band.topSlot + b.band.rowSpan),
    0,
  )
  const blackBoxHeight = HEADER_HEIGHT + totalSlots * PORT_ROW + PADDING
  const bands: ReadonlyArray<BlackBoxBand> = bandsComputed.map((bc) => bc.band)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {t('rackPreview.headerLabel', 'Black-Box auf Canvas')}
        </div>
        <div className="text-[10px] text-slate-400">
          {format(t('rackPreview.counts', '{devices} Geräte · {cables} interne Kabel'), {
            devices: placements.length,
            cables: cables.length,
          })}
        </div>
      </div>
      <div className="flex items-start justify-center rounded border border-slate-700 bg-slate-950/60 p-3">
        <div
          className="relative rounded border-2 border-slate-500 bg-slate-900 shadow-lg"
          style={{ width: BLACK_BOX_WIDTH, height: blackBoxHeight }}
        >
          {/* Header — gleicher Look wie EquipmentNode-Card-Header */}
          <div
            className="border-b border-slate-700 bg-slate-800/90 px-2 text-[11px] font-semibold text-slate-100"
            style={{
              lineHeight: `${HEADER_HEIGHT - 6}px`,
              height: HEADER_HEIGHT,
              paddingTop: 3,
              boxSizing: 'border-box',
            }}
            title={rackName}
          >
            {(rackName || t('rack.unnamed', '(unbenannt)')).slice(0, 32)}
            {(rackName || '').length > 32 ? '…' : ''}
          </div>

          {/* Bänder — geteilte Komponente, identisch zum Canvas. */}
          <RackBandsOverlay
            bands={bands}
            headerHeight={HEADER_HEIGHT}
            isLight={false}
          />

          {/* Externe Port-Dots (Preview-spezifisch — auf Canvas sind das
              echte ReactFlow-Handles, hier zeigen wir nur ihre Position). */}
          {bandsComputed.flatMap((bc) =>
            bc.externalInputs.map((port, idx) => {
              const y =
                HEADER_HEIGHT +
                (bc.band.topSlot + BAND_HEADER_ROW + idx) * PORT_ROW +
                PORT_ROW / 2
              return (
                <div
                  key={`pin-in-${bc.placement.id}-${port.name}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    width: HANDLE_R * 2,
                    height: HANDLE_R * 2,
                    borderRadius: '50%',
                    background: bc.band.color,
                    border: '1px solid #0f172a',
                    boxSizing: 'border-box',
                  }}
                  title={`${bc.placement.name}: ${port.name} (${port.connectorType})`}
                />
              )
            }),
          )}
          {bandsComputed.flatMap((bc) =>
            bc.externalOutputs.map((port, idx) => {
              const y =
                HEADER_HEIGHT +
                (bc.band.topSlot + BAND_HEADER_ROW + idx) * PORT_ROW +
                PORT_ROW / 2
              return (
                <div
                  key={`pin-out-${bc.placement.id}-${port.name}`}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: y,
                    transform: 'translate(50%, -50%)',
                    width: HANDLE_R * 2,
                    height: HANDLE_R * 2,
                    borderRadius: '50%',
                    background: bc.band.color,
                    border: '1px solid #0f172a',
                    boxSizing: 'border-box',
                  }}
                  title={`${bc.placement.name}: ${port.name} (${port.connectorType})`}
                />
              )
            }),
          )}

          {/* Interne Kabel-Curves — geteilte Komponente, exakt wie Canvas
              inkl. <title>-Tooltip ("Intern: A:p ↔ B:p"). */}
          <RackInternalCablesOverlay
            cables={blackBoxCables}
            width={BLACK_BOX_WIDTH}
            height={blackBoxHeight}
            isLight={false}
          />
        </div>
      </div>
    </div>
  )
}
