import { Handle, Position, type NodeProps } from 'reactflow'
import type { EquipmentItem } from '../../types/equipment'

const HEADER_HEIGHT = 48
const PORT_ROW = 22
const HANDLE_SIZE = 10
const PADDING = 8

export const EquipmentNode = ({ data, selected }: NodeProps<EquipmentItem>) => {
  const portRows = Math.max(data.inputs.length, data.outputs.length, 1)
  const width = Math.max(data.width ?? 220, 200)
  const computedHeight = HEADER_HEIGHT + portRows * PORT_ROW + PADDING
  const height = Math.max(data.height ?? computedHeight, computedHeight)

  // Y offset for the handle dot: aligns to vertical center of the row.
  const rowCenter = (index: number) => HEADER_HEIGHT + index * PORT_ROW + PORT_ROW / 2

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: '#0f172a',
        border: `1px solid ${selected ? '#38bdf8' : '#475569'}`,
        borderRadius: 6,
        color: '#e2e8f0',
        fontSize: 12,
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{ padding: `${PADDING}px ${PADDING}px 0 ${PADDING}px` }}>
        <div style={{ fontWeight: 600, lineHeight: '16px' }}>{data.name}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: '14px' }}>{data.category}</div>
      </div>

      {/* Inputs (left column) */}
      {data.inputs.map((port, index) => {
        const top = HEADER_HEIGHT + index * PORT_ROW
        return (
          <div
            key={port.id}
            style={{
              position: 'absolute',
              top,
              left: 0,
              width: '50%',
              height: PORT_ROW,
              paddingLeft: 14,
              paddingRight: 4,
              display: 'flex',
              alignItems: 'center',
              fontSize: 11,
              pointerEvents: 'none',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {port.name}
              <span style={{ color: '#64748b' }}> · {port.connectorType}</span>
            </span>
          </div>
        )
      })}
      {data.inputs.map((port, index) => (
        <Handle
          key={`h-in-${port.id}`}
          type="target"
          id={port.id}
          position={Position.Left}
          style={{
            top: rowCenter(index),
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#0ea5e9',
            border: '2px solid #0f172a',
          }}
        />
      ))}

      {/* Outputs (right column) */}
      {data.outputs.map((port, index) => {
        const top = HEADER_HEIGHT + index * PORT_ROW
        return (
          <div
            key={port.id}
            style={{
              position: 'absolute',
              top,
              right: 0,
              width: '50%',
              height: PORT_ROW,
              paddingRight: 14,
              paddingLeft: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              textAlign: 'right',
              fontSize: 11,
              pointerEvents: 'none',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#64748b' }}>{port.connectorType} · </span>
              {port.name}
            </span>
          </div>
        )
      })}
      {data.outputs.map((port, index) => (
        <Handle
          key={`h-out-${port.id}`}
          type="source"
          id={port.id}
          position={Position.Right}
          style={{
            top: rowCenter(index),
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: '#22c55e',
            border: '2px solid #0f172a',
          }}
        />
      ))}
    </div>
  )
}

