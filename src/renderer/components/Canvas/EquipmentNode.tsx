import { Handle, Position, type NodeProps } from 'reactflow'
import type { EquipmentItem } from '../../types/equipment'

export const EquipmentNode = ({ data }: NodeProps<EquipmentItem>) => {
  return (
    <div className="min-w-56 rounded-md border border-slate-600 bg-slate-900 p-2 text-xs text-slate-100">
      <div className="mb-1 font-semibold">{data.name}</div>
      <div className="mb-2 text-[11px] text-slate-400">{data.category}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          {data.inputs.map((port, index) => (
            <div key={port.id} className="relative py-1 pl-3">
              <Handle
                type="target"
                id={port.id}
                position={Position.Left}
                style={{ top: 40 + index * 24, width: 8, height: 8, background: '#0ea5e9' }}
              />
              {port.name}
            </div>
          ))}
        </div>
        <div className="text-right">
          {data.outputs.map((port, index) => (
            <div key={port.id} className="relative py-1 pr-3">
              <Handle
                type="source"
                id={port.id}
                position={Position.Right}
                style={{ top: 40 + index * 24, width: 8, height: 8, background: '#22c55e' }}
              />
              {port.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
