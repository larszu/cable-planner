import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import type { ConnectorType, Port } from '../../types/equipment'
import type { SignalStandard } from '../../types/cableSpec'

const CONNECTOR_TYPES: ConnectorType[] = [
  'XLR',
  'BNC',
  'HDMI',
  'SDI',
  'Ethernet/RJ45',
  'Fiber',
  'DIN',
  'DisplayPort',
  'USB',
  'IEC 230V',
  'PowerCON',
  'Schuko 230V',
  'Custom',
]

const STANDARDS: SignalStandard[] = [
  'SDI-SD',
  'SDI-HD',
  'SDI-3G',
  'SDI-6G',
  'SDI-12G',
  'HDMI-1.4',
  'HDMI-2.0',
  'HDMI-2.1',
  'DP-1.2',
  'DP-1.4',
  'DP-2.0',
  'Eth-100',
  'Eth-1G',
  'Eth-10G',
  'Analog-Audio',
  'AES3',
  'USB-2.0',
  'USB-3.x',
  'Power-230V',
  'Fiber-SM',
  'Fiber-MM',
  'Generic',
]

const makePort = (name: string): Port => ({
  id: uuidv4(),
  name,
  type: 'Custom',
  connectorType: 'Custom',
})

interface PortListProps {
  title: string
  ports: Port[]
  onChange: (ports: Port[]) => void
}

const PortList = ({ title, ports, onChange }: PortListProps) => {
  const updatePort = (index: number, patch: Partial<Port>) => {
    onChange(ports.map((port, i) => (i === index ? { ...port, ...patch } : port)))
  }
  const addPort = () => onChange([...ports, makePort(`${title.slice(0, -1)} ${ports.length + 1}`)])
  const removePort = (index: number) => onChange(ports.filter((_, i) => i !== index))

  return (
    <div className="rounded border border-slate-700 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">{title}</span>
        <button
          type="button"
          onClick={addPort}
          className="rounded bg-slate-700 px-2 py-0.5 text-[11px] hover:bg-slate-600"
        >
          + Add
        </button>
      </div>
      {ports.length === 0 && <div className="text-[11px] text-slate-500">None</div>}
      <ul className="space-y-2">
        {ports.map((port, index) => (
          <li key={port.id} className="rounded border border-slate-800 bg-slate-900 p-2">
            <div className="flex items-center gap-1">
              <input
                value={port.name}
                onChange={(event) => updatePort(index, { name: event.target.value })}
                placeholder="Port name"
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              />
              <button
                type="button"
                onClick={() => removePort(index)}
                title="Remove port"
                className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
              >
                ×
              </button>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <select
                aria-label="Connector type"
                value={port.connectorType}
                onChange={(event) =>
                  updatePort(index, {
                    connectorType: event.target.value as ConnectorType,
                    type: event.target.value,
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              >
                {CONNECTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                aria-label="Signal standard"
                value={port.standard ?? ''}
                onChange={(event) =>
                  updatePort(index, {
                    standard: event.target.value ? (event.target.value as SignalStandard) : undefined,
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              >
                <option value="">—</option>
                {STANDARDS.map((std) => (
                  <option key={std} value={std}>
                    {std}
                  </option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const EquipmentProperties = () => {
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((item) => item.id === selectedEquipmentId),
  )
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }

  return (
    <div className="space-y-3 text-xs">
      <label className="block">
        <span className="mb-1 block text-slate-300">Name</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Category</span>
        <input
          list="equipment-category-options"
          value={equipment.category}
          onChange={(event) => updateEquipment(equipment.id, { category: event.target.value })}
          onBlur={(event) => {
            const cat = event.target.value.trim()
            if (cat) addKnownCategories([cat])
          }}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
        <datalist id="equipment-category-options">
          {Array.from(
            new Set([
              ...knownCategories,
              ...customLibrary.map((t) => t.category).filter(Boolean),
            ]),
          )
            .sort((a, b) => a.localeCompare(b))
            .map((cat) => (
              <option key={cat} value={cat} />
            ))}
        </datalist>
      </label>

      <fieldset className="rounded border border-slate-700 p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
          Network &amp; Access
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-slate-300">IP Address</span>
            <input
              value={equipment.ipAddress ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { ipAddress: event.target.value })
              }
              placeholder="192.168.1.10"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">MAC</span>
            <input
              value={equipment.macAddress ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { macAddress: event.target.value })
              }
              placeholder="aa:bb:cc:dd:ee:ff"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">Username</span>
            <input
              value={equipment.username ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { username: event.target.value })
              }
              autoComplete="off"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">Password</span>
            <input
              type="password"
              value={equipment.password ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { password: event.target.value })
              }
              autoComplete="new-password"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-slate-300">Notes</span>
          <textarea
            value={equipment.notes ?? ''}
            onChange={(event) => updateEquipment(equipment.id, { notes: event.target.value })}
            rows={3}
            placeholder="Web UI URL, firmware version, wiring notes, …"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      </fieldset>

      <PortList
        title="Inputs"
        ports={equipment.inputs}
        onChange={(inputs) => updateEquipment(equipment.id, { inputs })}
      />
      <PortList
        title="Outputs"
        ports={equipment.outputs}
        onChange={(outputs) => updateEquipment(equipment.id, { outputs })}
      />
    </div>
  )
}
