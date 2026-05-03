import { Handle, Position, type NodeProps } from 'reactflow'
import { Fragment, useState } from 'react'
import type { EquipmentItem } from '../../types/equipment'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'

type EquipmentNodeData = EquipmentItem & {
  exportThemeOverride?: 'dark' | 'light'
}

const HEADER_HEIGHT = 48
const HEADER_HEIGHT_WITH_IP = 62
const PORT_ROW = 22
const HANDLE_SIZE = 16   // larger hit zone (was 10) — easier to click/drag
const PADDING = 8

const resolvePortSide = (
  port: EquipmentItem['inputs'][number] | EquipmentItem['outputs'][number],
  defaultSide: 'left' | 'right',
  mirrored: boolean,
): 'left' | 'right' => {
  if (port.side) return port.side
  if (!mirrored) return defaultSide
  return defaultSide === 'left' ? 'right' : 'left'
}

export const EquipmentNode = ({ id, data, selected }: NodeProps<EquipmentNodeData>) => {
  const pendingCable = useUiStore((s) => s.pendingCable)
  const startPendingCable = useUiStore((s) => s.startPendingCable)
  const clearPendingCable = useUiStore((s) => s.clearPendingCable)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const isLight = (data.exportThemeOverride ?? canvasTheme) === 'light'
  const queueConnection = useProjectStore((s) => s.queueConnection)

  /**
   * Port click handler: enables draw.io-style click-to-connect.
   * - First click on a port starts a pending cable.
   * - Next click on any other port finishes the cable (queues the cable
   *   dialog with the collected waypoints).
   * - Click on the same port cancels the pending draw.
   * Waypoints between the two clicks are added from pane clicks in
   * CanvasArea.
   */
  const handlePortClick = (
    portId: string,
    side: 'input' | 'output',
  ) => (event: React.MouseEvent) => {
    event.stopPropagation()
    const handleType: 'source' | 'target' = side === 'output' ? 'source' : 'target'
    if (!pendingCable) {
      startPendingCable({ nodeId: id, handleId: portId, handleType })
      return
    }
    // Cancel if clicked the same port again.
    if (
      pendingCable.nodeId === id &&
      pendingCable.handleId === portId &&
      pendingCable.handleType === handleType
    ) {
      clearPendingCable()
      return
    }
    // Build the Connection payload. We orient it so that source is an output
    // and target is an input, regardless of which end the user started from.
    const startIsSource = pendingCable.handleType === 'source'
    const endIsSource = handleType === 'source'
    let connection: {
      source: string
      sourceHandle: string
      target: string
      targetHandle: string
    }
    let waypoints = pendingCable.waypoints
    if (startIsSource && !endIsSource) {
      connection = {
        source: pendingCable.nodeId,
        sourceHandle: pendingCable.handleId,
        target: id,
        targetHandle: portId,
      }
    } else if (!startIsSource && endIsSource) {
      connection = {
        source: id,
        sourceHandle: portId,
        target: pendingCable.nodeId,
        targetHandle: pendingCable.handleId,
      }
      // Waypoints were recorded in the direction start -> end; reverse so they
      // run source -> target.
      waypoints = [...waypoints].reverse()
    } else {
      // Two outputs or two inputs clicked. With ConnectionMode.Loose we still
      // allow it; pick the first as source.
      connection = {
        source: pendingCable.nodeId,
        sourceHandle: pendingCable.handleId,
        target: id,
        targetHandle: portId,
      }
    }
    clearPendingCable()
    queueConnection(connection, waypoints)
  }

  const isPendingStart = (portId: string, side: 'input' | 'output'): boolean => {
    if (!pendingCable) return false
    const handleType: 'source' | 'target' = side === 'output' ? 'source' : 'target'
    return (
      pendingCable.nodeId === id &&
      pendingCable.handleId === portId &&
      pendingCable.handleType === handleType
    )
  }

  // Hover state for port rows — gives visual feedback before click
  const [hoveredPort, setHoveredPort] = useState<string | null>(null)

  const headerHeight = data.ipAddress
    ? (data.subtitle ? HEADER_HEIGHT_WITH_IP + 14 : HEADER_HEIGHT_WITH_IP)
    : (data.subtitle ? HEADER_HEIGHT + 14 : HEADER_HEIGHT)
  const inputPlacement = new Map<string, { side: 'left' | 'right'; slot: number }>()
  const outputPlacement = new Map<string, { side: 'left' | 'right'; slot: number }>()
  const sideCounts: Record<'left' | 'right', number> = { left: 0, right: 0 }

  for (const port of data.inputs) {
    const side = resolvePortSide(port, 'left', !!data.portsFlipped)
    const slot = sideCounts[side]
    sideCounts[side] += 1
    inputPlacement.set(port.id, { side, slot })
  }
  for (const port of data.outputs) {
    const side = resolvePortSide(port, 'right', !!data.portsFlipped)
    const slot = sideCounts[side]
    sideCounts[side] += 1
    outputPlacement.set(port.id, { side, slot })
  }

  const portRows = Math.max(sideCounts.left, sideCounts.right, 1)
  const width = Math.max(data.width ?? 220, 200)
  const computedHeight = headerHeight + portRows * PORT_ROW + PADDING
  const height = Math.max(data.height ?? computedHeight, computedHeight)

  // Y offset for the handle dot: aligns to vertical center of the row.
  const rowCenter = (index: number) => headerHeight + index * PORT_ROW + PORT_ROW / 2

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: data.nodeColor
          ? `${data.nodeColor}${isLight ? '18' : '22'}`
          : (isLight ? '#f8fafc' : '#0f172a'),
        border: `1px solid ${selected ? '#38bdf8' : (data.nodeColor ?? (isLight ? '#94a3b8' : '#475569'))}`,
        borderRadius: 6,
        color: isLight ? '#1e293b' : '#e2e8f0',
        fontSize: 12,
        boxShadow: isLight
          ? '0 2px 6px rgba(0,0,0,0.12)'
          : '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: `${PADDING}px ${PADDING}px 0 ${PADDING}px`,
        borderBottom: `1px solid ${data.nodeColor ?? (isLight ? '#cbd5e1' : '#1e293b')}`,
        background: data.nodeColor
          ? `${data.nodeColor}${isLight ? '18' : '33'}`
          : (isLight ? 'rgba(226,232,240,0.4)' : 'transparent'),
        borderRadius: '5px 5px 0 0',
      }}>
        <div style={{ fontWeight: 600, lineHeight: '16px', display: 'flex', alignItems: 'center', gap: 4 }}>
          {data.rentmanId && !data.rentmanRemoved ? (
            // R badge: device is tracked in Rentman
            <span
              style={{
                background: '#c2410c',
                color: '#fff',
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 3,
                padding: '0 3px',
                lineHeight: '13px',
                flexShrink: 0,
              }}
              title={`Rentman-ID: ${data.rentmanId}`}
            >
              R
            </span>
          ) : data.rentmanRemoved ? (
            // ⚠ badge: was in Rentman but no longer found in last re-fetch
            <span
              style={{
                background: '#92400e',
                color: '#fef3c7',
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 3,
                padding: '0 3px',
                lineHeight: '13px',
                flexShrink: 0,
              }}
              title="In Rentman nicht mehr vorhanden!"
            >
              ⚠
            </span>
          ) : (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#92400e',
                flexShrink: 0,
                opacity: 0.7,
              }}
              title="Kein Rentman-Eintrag"
            />
          )}
          <span>{data.name}</span>
        </div>
        <div style={{ fontSize: 11, color: isLight ? '#64748b' : '#94a3b8', lineHeight: '14px' }}>{data.category}</div>
        {data.subtitle && (
          <div style={{ fontSize: 11, color: isLight ? '#475569' : '#cbd5e1', lineHeight: '14px', fontStyle: 'italic' }}>{data.subtitle}</div>
        )}
        {data.ipAddress && (
          <div
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 10,
              color: isLight ? '#0369a1' : '#38bdf8',
              lineHeight: '12px',
              marginTop: 2,
            }}
            title={
              data.subnetMask
                ? `IP: ${data.ipAddress} / ${data.subnetMask}`
                : `IP: ${data.ipAddress}`
            }
          >
            {data.ipAddress}
            {data.subnetMask ? ` /${data.subnetMask}` : ''}
          </div>
        )}
      </div>

      {/* Inputs */}
      {data.inputs.map((port, index) => {
        const placement = inputPlacement.get(port.id) ?? { side: 'left' as const, slot: index }
        const top = headerHeight + placement.slot * PORT_ROW
        const side = placement.side
        const isLeft = side === 'left'
        const isHovered = hoveredPort === `in-${port.id}`
        const isActive = isPendingStart(port.id, 'input')
        return (
          <div
            key={port.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePortClick(port.id, 'input')}
            onMouseEnter={() => setHoveredPort(`in-${port.id}`)}
            onMouseLeave={() => setHoveredPort(null)}
            style={{
              position: 'absolute',
              top,
              ...(isLeft ? { left: 0 } : { right: 0 }),
              width: '50%',
              height: PORT_ROW,
              ...(isLeft
                ? { paddingLeft: 14, paddingRight: 4 }
                : { paddingRight: 14, paddingLeft: 4 }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeft ? 'flex-start' : 'flex-end',
              textAlign: isLeft ? 'left' : 'right',
              fontSize: 11,
              cursor: 'crosshair',
              borderRadius: 3,
              background: isActive
                ? 'rgba(251,191,36,0.15)'
                : isHovered
                  ? 'rgba(14,165,233,0.12)'
                  : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {isLeft ? (
                <>{port.name}<span style={{ color: isLight ? '#94a3b8' : '#64748b' }}> · {port.connectorType}</span></>
              ) : (
                <><span style={{ color: isLight ? '#94a3b8' : '#64748b' }}>{port.connectorType} · </span>{port.name}</>
              )}
            </span>
          </div>
        )
      })}
      {data.inputs.map((port, index) => {
        const bi = port.direction === 'bidirectional'
        const isStart = isPendingStart(port.id, 'input')
        const placement = inputPlacement.get(port.id) ?? { side: 'left' as const, slot: index }
        const side = placement.side
        const pos = side === 'left' ? Position.Left : Position.Right
        return (
          <Fragment key={`h-in-${port.id}`}>
            <Handle
              type="target"
              id={port.id}
              position={pos}
              onClick={handlePortClick(port.id, 'input')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: bi ? '#a855f7' : '#0ea5e9',
                border: isStart ? '2px solid #fbbf24' : `2px solid ${isLight ? '#e2e8f0' : '#0f172a'}`,
                boxShadow: isStart ? '0 0 0 3px rgba(251,191,36,0.45)' : undefined,
                cursor: 'crosshair',
              }}
            />
            <Handle
              type="source"
              id={port.id}
              position={pos}
              onClick={handlePortClick(port.id, 'input')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: 'transparent',
                border: 'none',
              }}
            />
          </Fragment>
        )
      })}

      {/* Outputs */}
      {data.outputs.map((port, index) => {
        const placement = outputPlacement.get(port.id) ?? { side: 'right' as const, slot: index }
        const top = headerHeight + placement.slot * PORT_ROW
        const side = placement.side
        const isLeft = side === 'left'
        const isHovered = hoveredPort === `out-${port.id}`
        const isActive = isPendingStart(port.id, 'output')
        return (
          <div
            key={port.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePortClick(port.id, 'output')}
            onMouseEnter={() => setHoveredPort(`out-${port.id}`)}
            onMouseLeave={() => setHoveredPort(null)}
            style={{
              position: 'absolute',
              top,
              ...(isLeft ? { left: 0 } : { right: 0 }),
              width: '50%',
              height: PORT_ROW,
              ...(isLeft
                ? { paddingLeft: 14, paddingRight: 4 }
                : { paddingRight: 14, paddingLeft: 4 }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeft ? 'flex-start' : 'flex-end',
              textAlign: isLeft ? 'left' : 'right',
              fontSize: 11,
              cursor: 'crosshair',
              borderRadius: 3,
              background: isActive
                ? 'rgba(251,191,36,0.15)'
                : isHovered
                  ? 'rgba(34,197,94,0.12)'
                  : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
              {isLeft ? (
                <>{port.name}<span style={{ color: isLight ? '#94a3b8' : '#64748b' }}> · {port.connectorType}</span></>
              ) : (
                <><span style={{ color: isLight ? '#94a3b8' : '#64748b' }}>{port.connectorType} · </span>{port.name}</>
              )}
            </span>
          </div>
        )
      })}
      {data.outputs.map((port, index) => {
        const bi = port.direction === 'bidirectional'
        const isStart = isPendingStart(port.id, 'output')
        const placement = outputPlacement.get(port.id) ?? { side: 'right' as const, slot: index }
        const side = placement.side
        const pos = side === 'left' ? Position.Left : Position.Right
        return (
          <Fragment key={`h-out-${port.id}`}>
            <Handle
              type="source"
              id={port.id}
              position={pos}
              onClick={handlePortClick(port.id, 'output')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: bi ? '#a855f7' : '#22c55e',
                border: isStart ? '2px solid #fbbf24' : `2px solid ${isLight ? '#e2e8f0' : '#0f172a'}`,
                boxShadow: isStart ? '0 0 0 3px rgba(251,191,36,0.45)' : undefined,
                cursor: 'crosshair',
              }}
            />
            <Handle
              type="target"
              id={port.id}
              position={pos}
              onClick={handlePortClick(port.id, 'output')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: 'transparent',
                border: 'none',
              }}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

