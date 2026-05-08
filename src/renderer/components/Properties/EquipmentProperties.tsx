import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { detectDeviceKind, detectNetworkDevice } from '../../lib/deviceKind'
import { promptDialog } from '../../lib/promptDialog'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, Port, VlanDef, PortVlanAssignment } from '../../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../../types/cableSpec'
import type { SignalStandard } from '../../types/cableSpec'
import { QUAD_LINK_LABEL, type QuadLinkMode } from '../../types/videoFormat'
import { RackImageCropDialog } from '../Rack/RackImageCropDialog'
import { CategorySelect } from '../shared/CategorySelect'
import { pickImageAsDataUri, readImageAsDataUri } from '../../lib/readImageAsDataUri'
import { useTranslation } from '../../lib/i18n'

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

interface SortablePortItemProps {
  port: Port
  children: React.ReactNode
}

const SortablePortItem = ({ port, children }: SortablePortItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: port.id })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded border border-slate-800 bg-slate-900 p-2 ${isDragging ? 'opacity-60 shadow-lg shadow-slate-950/50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-400 hover:bg-slate-900 active:cursor-grabbing"
          title="Port-Reihenfolge ändern"
          aria-label={`Reorder ${port.name}`}
          {...attributes}
          {...listeners}
        >
          ≡
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </li>
  )
}

const PortList = ({ title, ports, onChange }: PortListProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const updatePort = (portId: string, patch: Partial<Port>) => {
    onChange(ports.map((port) => (port.id === portId ? { ...port, ...patch } : port)))
  }
  const addPort = () => onChange([...ports, makePort(`${title.slice(0, -1)} ${ports.length + 1}`)])
  const removePort = (portId: string) => onChange(ports.filter((port) => port.id !== portId))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ports.findIndex((port) => port.id === active.id)
    const newIndex = ports.findIndex((port) => port.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(ports, oldIndex, newIndex))
  }

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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ports.map((port) => port.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
        {ports.map((port) => (
          <SortablePortItem key={port.id} port={port}>
            <div className="flex items-center gap-1">
              <input
                value={port.name}
                onChange={(event) => updatePort(port.id, { name: event.target.value })}
                placeholder="Port name"
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              />
              <button
                type="button"
                onClick={() => removePort(port.id)}
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
                  updatePort(port.id, {
                    connectorType: event.target.value as ConnectorType,
                    type: event.target.value,
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              >
                {ALL_CONNECTOR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                aria-label="Signal standard"
                value={port.standard ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    standard: event.target.value ? (event.target.value as SignalStandard) : undefined,
                  })
                }
                className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
              >
                <option value="">—</option>
                {ALL_SIGNAL_STANDARDS.map((std) => (
                  <option key={std} value={std}>
                    {std}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <select
                aria-label="Port direction"
                value={port.direction ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    direction: event.target.value
                      ? (event.target.value as 'in' | 'out' | 'bidirectional')
                      : undefined,
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                title="Richtung - bidirektional ist z.B. für Netzwerk-/RJ45-Ports sinnvoll"
              >
                <option value="">Richtung (auto)</option>
                <option value="in">Nur Input</option>
                <option value="out">Nur Output</option>
                <option value="bidirectional">Bidirektional (z.B. Netzwerk)</option>
              </select>
              <select
                aria-label="Port side"
                value={port.side ?? ''}
                onChange={(event) =>
                  updatePort(port.id, {
                    side: event.target.value ? (event.target.value as 'left' | 'right') : undefined,
                  })
                }
                className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                title="Port-Seite am Gerät: Auto nutzt Input/Output + globale Spiegelung"
              >
                <option value="">Seite (auto)</option>
                <option value="left">Links</option>
                <option value="right">Rechts</option>
              </select>
            </div>
            {(port.connectorType === 'Fiber' || port.connectorType === 'SFP' || port.connectorType === 'SFP+') && (
              <div className="mt-1 rounded border border-sky-900/60 bg-sky-950/30 p-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-400">SFP-Modul</div>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    value={port.sfpType ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpType: event.target.value || undefined })}
                    placeholder="Formfaktor (SFP+)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="SFP-Formfaktor: SFP, SFP+, SFP28, QSFP+"
                  />
                  <input
                    value={port.sfpStandard ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpStandard: event.target.value || undefined })}
                    placeholder="Standard (10G-LR)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Transceiver-Standard: 1G-SX, 1G-LX, 10G-SR, 10G-LR, 25G-SR …"
                  />
                  <input
                    value={port.sfpWavelength ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpWavelength: event.target.value || undefined })}
                    placeholder="Wellenlänge nm (1310)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Wellenlänge in nm: 850, 1310, 1550"
                  />
                  <input
                    value={port.sfpVendor ?? ''}
                    onChange={(event) => updatePort(port.id, { sfpVendor: event.target.value || undefined })}
                    placeholder="Hersteller (Cisco)"
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    title="Modulhersteller: Cisco, Aruba, Ubiquiti, FS.com …"
                  />
                </div>
              </div>
            )}
          </SortablePortItem>
        ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

const hasSdiPorts = (device: { inputs: Port[]; outputs: Port[] }): boolean =>
  [...device.inputs, ...device.outputs].some((p) => p.connectorType === 'BNC')

const RackFacePreview = ({
  equipment,
  viewMode,
}: {
  equipment: EquipmentItem
  viewMode: 'front' | 'rear' | 'both'
}) => {
  if (!equipment.isRackDevice || !equipment.rackUnits || equipment.rackUnits <= 0) return null

  const rows = Math.max(equipment.inputs.length, equipment.outputs.length, 1)
  const unitHeight = 22
  const panelWidth = Math.round(unitHeight * 10.86)

  return (
    <fieldset className="rounded border border-slate-700 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
        2D Rack-Vorschau
      </legend>
      <div className="mb-2 text-[11px] text-slate-400">19" Rack · {equipment.rackUnits} HE · Front/Rear mit Port-Marker</div>
      <div className="rounded border border-slate-700 bg-slate-950 p-3">
        <div className={`mx-auto grid w-full max-w-[760px] gap-2 ${viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {(viewMode === 'both' ? ['front', 'rear'] : [viewMode]).map((side) => {
            const imageUrl = side === 'front' ? equipment.frontPanelImageUrl : equipment.rearPanelImageUrl
            return (
              <div key={side} className="rounded border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-3 shadow-inner">
                <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <span>{side === 'front' ? 'Front' : 'Rear'}</span>
                  <span>{equipment.rackUnits} HE</span>
                </div>
                <div className="relative mb-3 rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${equipment.name} ${side}`}
                      className="mx-auto rounded object-contain"
                      style={{ width: panelWidth, height: Math.max(1, equipment.rackUnits) * unitHeight }}
                    />
                  ) : (
                    <>
                      <div className="truncate text-sm font-semibold text-slate-100">{equipment.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{equipment.category}</div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: rows }).map((_, index) => {
                    const input = equipment.inputs[index]
                    const output = equipment.outputs[index]
                    return (
                      <div key={`${equipment.id}-${side}-rack-row-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px]">
                        <div className="min-w-0 rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-right text-slate-200">
                          {input ? (
                            <span className="block truncate">
                              {input.name}
                              <span className="text-slate-500"> · {input.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                          <span className="h-px w-8 bg-slate-700" />
                          <span className="h-px w-8 bg-slate-700" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="min-w-0 rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-200">
                          {output ? (
                            <span className="block truncate">
                              {output.name}
                              <span className="text-slate-500"> · {output.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}

interface SdiCapabilitiesBlockProps {
  equipmentId: string
  caps?: import('../../types/videoFormat').SdiCapabilities
}

const SdiCapabilitiesBlock = ({ equipmentId, caps }: SdiCapabilitiesBlockProps) => {
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const current = caps ?? {}
  const patch = (next: Partial<typeof current>) => {
    const merged = { ...current, ...next }
    const isEmpty =
      !merged.levelA &&
      !merged.levelB &&
      !merged.maxSingleLink &&
      (!merged.quadLink3G || merged.quadLink3G === 'none')
    updateEquipment(equipmentId, { sdiCaps: isEmpty ? undefined : merged })
  }
  const quadModes: QuadLinkMode[] = ['none', '2SI', 'SquareDivision', 'both']

  return (
    <fieldset className="rounded border border-amber-700 bg-amber-950/20 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-amber-300">
        SDI Fähigkeiten
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!current.levelA}
            onChange={(event) => patch({ levelA: event.target.checked })}
          />
          <span>3G-SDI Level A</span>
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!current.levelB}
            onChange={(event) => patch({ levelB: event.target.checked })}
          />
          <span>3G-SDI Level B</span>
        </label>
      </div>
      <label className="mt-2 block">
        <span className="mb-1 block text-slate-300">Max Single-Link</span>
        <select
          value={current.maxSingleLink ?? ''}
          onChange={(event) =>
            patch({
              maxSingleLink: event.target.value
                ? (event.target.value as NonNullable<typeof current.maxSingleLink>)
                : undefined,
            })
          }
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        >
          <option value="">—</option>
          <option value="SDI-HD">SDI-HD (1.5G)</option>
          <option value="SDI-3G">SDI-3G</option>
          <option value="SDI-6G">SDI-6G</option>
          <option value="SDI-12G">SDI-12G</option>
        </select>
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-slate-300">Quad Link 3G-SDI</span>
        <select
          value={current.quadLink3G ?? 'none'}
          onChange={(event) => patch({ quadLink3G: event.target.value as QuadLinkMode })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        >
          {quadModes.map((m) => (
            <option key={m} value={m}>
              {QUAD_LINK_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}

interface NetworkConfigProps {
  equipmentId: string
  item: {
    vlans?: VlanDef[]
    managementVlanId?: number
    gateway?: string
    dnsServers?: string
    mgmtUrl?: string
    firmware?: string
    portVlans?: Record<string, PortVlanAssignment>
  }
  allPorts: Port[]
  kind: 'switch' | 'router'
}

const NetworkConfig = ({ equipmentId, item, allPorts, kind }: NetworkConfigProps) => {
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const vlans = item.vlans ?? []
  const portVlans = item.portVlans ?? {}

  const setVlans = (next: VlanDef[]) =>
    updateEquipment(equipmentId, { vlans: next.length ? next : undefined })

  const updateVlan = (index: number, patch: Partial<VlanDef>) =>
    setVlans(vlans.map((v, i) => (i === index ? { ...v, ...patch } : v)))
  const addVlan = () =>
    setVlans([
      ...vlans,
      { id: vlans.length ? Math.max(...vlans.map((v) => v.id)) + 1 : 10, name: '' },
    ])
  const removeVlan = (index: number) => setVlans(vlans.filter((_, i) => i !== index))

  const setPortVlan = (portId: string, patch: Partial<PortVlanAssignment>) => {
    const current = portVlans[portId] ?? {}
    const merged: PortVlanAssignment = { ...current, ...patch }
    const isEmpty =
      (merged.untagged === undefined || Number.isNaN(merged.untagged)) &&
      (!merged.tagged || merged.tagged.trim() === '')
    const next = { ...portVlans }
    if (isEmpty) delete next[portId]
    else next[portId] = merged
    updateEquipment(equipmentId, {
      portVlans: Object.keys(next).length ? next : undefined,
    })
  }

  return (
    <>
      <fieldset className="rounded border border-cyan-700 bg-cyan-950/30 p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-cyan-300">
          {kind === 'router' ? 'Router Config' : 'Switch Config'}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-slate-300">Management VLAN</span>
            <input
              type="number"
              value={item.managementVlanId ?? ''}
              onChange={(event) =>
                updateEquipment(equipmentId, {
                  managementVlanId: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              placeholder="1"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">Gateway</span>
            <input
              value={item.gateway ?? ''}
              onChange={(event) => updateEquipment(equipmentId, { gateway: event.target.value })}
              placeholder="192.168.1.1"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">DNS</span>
            <input
              value={item.dnsServers ?? ''}
              onChange={(event) =>
                updateEquipment(equipmentId, { dnsServers: event.target.value })
              }
              placeholder="1.1.1.1, 8.8.8.8"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">Firmware</span>
            <input
              value={item.firmware ?? ''}
              onChange={(event) => updateEquipment(equipmentId, { firmware: event.target.value })}
              placeholder="v2.8.4"
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-slate-300">Management URL</span>
          <input
            value={item.mgmtUrl ?? ''}
            onChange={(event) => updateEquipment(equipmentId, { mgmtUrl: event.target.value })}
            placeholder="https://192.168.1.1/"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
          />
        </label>
      </fieldset>

      <fieldset className="rounded border border-cyan-700 bg-cyan-950/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-cyan-300">VLANs</span>
          <button
            type="button"
            onClick={addVlan}
            className="rounded bg-cyan-700 px-2 py-0.5 text-[11px] hover:bg-cyan-600"
          >
            + VLAN
          </button>
        </div>
        {vlans.length === 0 && (
          <div className="text-[11px] text-slate-500">Keine VLANs definiert.</div>
        )}
        <ul className="space-y-1">
          {vlans.map((v, i) => (
            <li key={i} className="flex items-center gap-1">
              <input
                type="number"
                value={v.id}
                onChange={(event) => updateVlan(i, { id: Number(event.target.value) })}
                className="w-16 rounded border border-slate-700 bg-slate-950 p-1 text-xs font-mono"
                placeholder="ID"
              />
              <input
                value={v.name}
                onChange={(event) => updateVlan(i, { name: event.target.value })}
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                placeholder="Name (z.B. Production)"
              />
              <input
                value={v.notes ?? ''}
                onChange={(event) => updateVlan(i, { notes: event.target.value })}
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                placeholder="Notiz"
              />
              <button
                type="button"
                onClick={() => removeVlan(i)}
                className="rounded bg-red-900/60 px-2 py-0.5 text-[11px] hover:bg-red-800"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {kind === 'switch' && allPorts.length > 0 && (
        <fieldset className="rounded border border-cyan-700 bg-cyan-950/20 p-2">
          <legend className="px-1 text-[11px] uppercase tracking-wide text-cyan-300">
            Port → VLAN
          </legend>
          <div className="mb-1 grid grid-cols-[1fr_70px_120px] gap-1 text-[10px] text-slate-400">
            <span>Port</span>
            <span>Untagged</span>
            <span>Tagged</span>
          </div>
          <ul className="space-y-1">
            {allPorts.map((p) => {
              const assign = portVlans[p.id] ?? {}
              return (
                <li key={p.id} className="grid grid-cols-[1fr_70px_120px] items-center gap-1">
                  <span className="truncate text-[11px] text-slate-300" title={p.name}>
                    {p.name}
                  </span>
                  <input
                    type="number"
                    value={assign.untagged ?? ''}
                    onChange={(event) =>
                      setPortVlan(p.id, {
                        untagged: event.target.value ? Number(event.target.value) : undefined,
                      })
                    }
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs font-mono"
                    placeholder="—"
                  />
                  <input
                    value={assign.tagged ?? ''}
                    onChange={(event) => setPortVlan(p.id, { tagged: event.target.value })}
                    className="rounded border border-slate-700 bg-slate-950 p-1 text-xs font-mono"
                    placeholder="10,20,30"
                  />
                </li>
              )
            })}
          </ul>
        </fieldset>
      )}
    </>
  )
}

const RESOLUTION_PRESETS = [
  '1280x720',
  '1920x1080',
  '2560x1440',
  '3840x2160',
  '4096x2160',
  '5120x2880',
  '7680x4320',
]

/**
 * Monitor/display properties block (resolution + size).
 * Shown when the device looks like a display based on category, name, or
 * when the user has already set one of these fields.
 */
const DisplayPropertiesBlock = ({ equipment }: { equipment: import('../../types/equipment').EquipmentItem }) => {
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const category = equipment.category.toLowerCase()
  const name = equipment.name.toLowerCase()
  const looksLikeDisplay =
    /monitor|display|screen|tv|oled|lcd|led|multiviewer|projector|beamer/.test(category) ||
    /monitor|display|screen|tv|oled|lcd|led\b|projector|beamer/.test(name) ||
    equipment.resolution !== undefined ||
    equipment.displaySizeInch !== undefined
  if (!looksLikeDisplay) return null
  return (
    <fieldset className="rounded border border-slate-700 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
        Display
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-slate-300">Auflösung</span>
          <input
            list="display-resolution-options"
            value={equipment.resolution ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { resolution: event.target.value || undefined })
            }
            placeholder="1920x1080"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
          />
          <datalist id="display-resolution-options">
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-300">Diagonale (Zoll)</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={equipment.displaySizeInch ?? ''}
            onChange={(event) => {
              const value = event.target.value
              updateEquipment(equipment.id, {
                displaySizeInch: value === '' ? undefined : Number(value),
              })
            }}
            placeholder="27"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      </div>
    </fieldset>
  )
}

export const EquipmentProperties = () => {
  const t = useTranslation()
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((item) => item.id === selectedEquipmentId),
  )
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const openVideohubExport = useUiStore((state) => state.openVideohubExport)
  const openGreenGoExport = useUiStore((state) => state.openGreenGoExport)
  const openAtemDialog = useUiStore((state) => state.openAtemDialog)
  const openAtemMvConfig = useUiStore((state) => state.openAtemMvConfig)
  const openAtemAudioConfig = useUiStore((state) => state.openAtemAudioConfig)
  const saveEquipmentAsTemplate = useProjectStore((state) => state.saveEquipmentAsTemplate)
  const saveEquipmentAsNewTemplate = useProjectStore((state) => state.saveEquipmentAsNewTemplate)
  const [rackViewMode, setRackViewMode] = useState<'front' | 'rear' | 'both'>('front')
  const [showPassword, setShowPassword] = useState(false)
  const [cropDialog, setCropDialog] = useState<
    { side: 'front' | 'rear'; src: string } | null
  >(null)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }

  const deviceKind = detectDeviceKind(equipment)
  const networkKind = detectNetworkDevice(equipment)

  return (
    <div className="space-y-3 text-xs">
      {deviceKind === 'greengo' && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
            GreenGo Intercom erkannt
          </div>
          <button
            type="button"
            onClick={() => openGreenGoExport()}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
          >
            Intercom-Planung / .gg5 exportieren →
          </button>
        </div>
      )}
      {deviceKind === 'videohub' && (
        <div className="rounded border border-purple-700 bg-purple-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-purple-300">
            Blackmagic Videohub erkannt
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => openVideohubExport(equipment.id)}
              className="w-full rounded bg-purple-700 px-2 py-1 text-xs hover:bg-purple-600"
            >
              Labels / Routing exportieren →
            </button>
            <button
              type="button"
              onClick={() => openVideohubExport(equipment.id, true)}
              className="w-full rounded bg-purple-800 px-2 py-1 text-xs hover:bg-purple-700"
            >
              Routing-Matrix / An Videohub senden →
            </button>
          </div>
        </div>
      )}
      {deviceKind === 'atem' && (
        <div className="rounded border border-sky-700 bg-sky-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-sky-300">
            Blackmagic ATEM erkannt
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => openAtemDialog(equipment.id)}
              className="w-full rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              title="Verbindet per UDP mit dem ATEM und überträgt Input-Namen."
            >
              ATEM verbinden / Setup übertragen →
            </button>
            <button
              type="button"
              onClick={() => openAtemMvConfig(equipment.id)}
              className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
              title="Multiviewer-Layout offline konfigurieren. Wird beim nächsten Connect übertragen."
            >
              Multiviewer-Layout konfigurieren →
            </button>
            <button
              type="button"
              onClick={() => openAtemAudioConfig(equipment.id)}
              className="w-full rounded bg-fuchsia-700 px-2 py-1 text-xs hover:bg-fuchsia-600"
              title="Fairlight Audio-Router offline planen (Gain, Balance, AFV)."
            >
              Audio-Router (Fairlight) konfigurieren →
            </button>
          </div>
        </div>
      )}
      {deviceKind === 'multiviewer' && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
            Multiviewer erkannt
          </div>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded bg-slate-700 px-2 py-1 text-xs opacity-60"
            title="Multiviewer-Layout Export kommt in v0.4.0"
          >
            Multiviewer Layout Export (v0.4.0)
          </button>
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('eq.field.name', 'Name')}</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.subtitle', 'Untertitel')}{' '}
          <span className="text-slate-500">
            ({t('common.optional', 'optional')}, {t('eq.field.subtitleHint', 'z.B. "PGM Monitor"')})
          </span>
        </span>
        <input
          value={equipment.subtitle ?? ''}
          placeholder={t('eq.field.subtitlePlaceholder', 'Untertitel…')}
          onChange={(event) => updateEquipment(equipment.id, { subtitle: event.target.value || undefined })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.manufacturerUrl', 'Hersteller-Link')}{' '}
          <span className="text-slate-500">
            ({t('common.optional', 'optional')}, {t('eq.field.manufacturerUrlHint', 'für Datenblatt-Aufruf')})
          </span>
        </span>
        <div className="flex gap-1">
          <input
            type="url"
            value={equipment.manufacturerUrl ?? ''}
            placeholder="https://…"
            onChange={(event) =>
              updateEquipment(equipment.id, { manufacturerUrl: event.target.value || undefined })
            }
            className="flex-1 rounded border border-slate-700 bg-slate-900 p-2"
          />
          {equipment.manufacturerUrl && (
            <a
              href={equipment.manufacturerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              title={t('eq.field.manufacturerUrlOpenTitle', 'In externem Browser öffnen')}
            >
              {t('eq.field.manufacturerUrlOpen', 'Öffnen ↗')}
            </a>
          )}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          {t('eq.field.refImage', 'Referenzbild')}{' '}
          <span className="text-slate-500">({t('eq.field.refImageHint', 'z. B. Port-Belegung')})</span>
        </span>
        <div className="flex items-start gap-2">
          {equipment.imageUrl ? (
            <a
              href={equipment.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-h-24 max-w-[120px] overflow-hidden rounded border border-slate-700"
              title={t('eq.field.refImageFullsize', 'In voller Größe öffnen')}
            >
              <img src={equipment.imageUrl} alt="" className="max-h-24 max-w-[120px] object-contain" />
            </a>
          ) : (
            <div className="flex h-24 w-[120px] items-center justify-center rounded border border-dashed border-slate-700 text-[10px] text-slate-500">
              {t('eq.field.refImageNone', 'Kein Bild')}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={async () => {
                const dataUri = await pickImageAsDataUri()
                if (dataUri) updateEquipment(equipment.id, { imageUrl: dataUri })
              }}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {equipment.imageUrl
                ? t('eq.field.refImageReplace', 'Ersetzen…')
                : t('common.choose', 'Auswählen…')}
            </button>
            {equipment.imageUrl && (
              <button
                type="button"
                onClick={() => updateEquipment(equipment.id, { imageUrl: undefined })}
                className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
              >
                {t('common.remove', 'Entfernen')}
              </button>
            )}
          </div>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">
          Icon <span className="text-slate-500">(Glyph oder Emoji, max 2 Zeichen — leer = automatisch)</span>
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <input
            value={equipment.icon ?? ''}
            placeholder="auto"
            onChange={(event) => {
              const v = event.target.value
              updateEquipment(equipment.id, { icon: v.length === 0 ? undefined : v.slice(0, 2) })
            }}
            className="w-20 rounded border border-slate-700 bg-slate-900 p-2 text-center text-base"
            maxLength={2}
          />
          {(['📷', '🖥', '💻', '📺', '🎙', '💡', '🌐', '⚡', '🔌', '🔧', '⇄'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => updateEquipment(equipment.id, { icon: g })}
              className={`rounded border px-1.5 py-1 text-base ${
                equipment.icon === g
                  ? 'border-sky-500 bg-sky-700/30'
                  : 'border-slate-700 bg-slate-900 hover:bg-slate-800'
              }`}
              title={`Icon ${g}`}
            >
              {g}
            </button>
          ))}
          {equipment.icon && (
            <button
              type="button"
              onClick={() => updateEquipment(equipment.id, { icon: undefined })}
              className="rounded bg-slate-700 px-1.5 py-1 text-[10px] hover:bg-slate-600"
              title="Auf automatisch zurücksetzen"
            >
              auto
            </button>
          )}
        </div>
      </label>

      <label className="flex items-center gap-2 text-[12px] text-slate-300">
        <input
          type="checkbox"
          checked={!!equipment.collapsed}
          onChange={(event) =>
            updateEquipment(equipment.id, { collapsed: event.target.checked || undefined })
          }
        />
        {t('eq.field.compact', 'Kompakte Darstellung')}{' '}
        <span className="text-slate-500">({t('eq.field.compactHint', 'nur Icon + Name, Ports als Punkte')})</span>
      </label>

      <label className="flex items-center justify-between gap-2">
        <span className="text-slate-300">{t('eq.field.color', 'Gerätefarbe')}</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={equipment.nodeColor ?? '#475569'}
            onChange={(event) => updateEquipment(equipment.id, { nodeColor: event.target.value })}
            className="h-7 w-12 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
            title="Farbe des Geräte-Knotens"
          />
          {equipment.nodeColor && (
            <button
              type="button"
              onClick={() => updateEquipment(equipment.id, { nodeColor: undefined })}
              className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] hover:bg-slate-600"
              title="Farbe zurücksetzen"
            >
              ✕ Reset
            </button>
          )}
        </div>
      </label>

      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={!!equipment.portsFlipped}
          onChange={(event) => updateEquipment(equipment.id, { portsFlipped: event.target.checked || undefined })}
        />
        Ports spiegeln (Inputs rechts, Outputs links)
      </label>

      {/* Rentman sync status */}
      {equipment.rentmanRemoved ? (
        <div className="flex items-center gap-1.5 rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-[11px] text-red-300">
          <span>⚠</span>
          <span>In Rentman nicht mehr vorhanden!</span>
        </div>
      ) : equipment.rentmanId ? (
        <div className="flex items-center gap-1.5 rounded border border-orange-700/50 bg-orange-900/20 px-2 py-1 text-[11px] text-orange-300">
          <span className="rounded bg-orange-700 px-1 font-bold text-white">R</span>
          Rentman-ID: {equipment.rentmanId}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 rounded border border-amber-700/40 bg-amber-900/10 px-2 py-1 text-[11px] text-amber-400">
          <span>⚠</span>
          <span>Nicht im Rentman-Plan erfasst</span>
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('eq.field.category', 'Kategorie')}</span>
        <CategorySelect
          value={equipment.category}
          onChange={(category) => updateEquipment(equipment.id, { category })}
          extraOptions={[equipment.category]}
        />
      </label>

      <DisplayPropertiesBlock equipment={equipment} />

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
            <span className="mb-1 block text-slate-300">{t('eq.field.serial', 'Seriennummer')}</span>
            <input
              value={equipment.serialNumber ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { serialNumber: event.target.value || undefined })
              }
              placeholder={t('eq.field.serialPlaceholder', 'S/N')}
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.subnet', 'Subnet Mask')}</span>
            <input
              value={equipment.subnetMask ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, { subnetMask: event.target.value })
              }
              placeholder={t('eq.field.subnetPlaceholder', '255.255.255.0 oder /24')}
              className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-slate-300">{t('eq.field.username', 'Username')}</span>
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
            <span className="mb-1 block text-slate-300">{t('eq.field.password', 'Password')}</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={equipment.password ?? ''}
                onChange={(event) =>
                  updateEquipment(equipment.id, { password: event.target.value })
                }
                autoComplete="new-password"
                className="w-full rounded border border-slate-700 bg-slate-900 p-2 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={
                  showPassword
                    ? t('eq.field.passwordHide', 'Passwort verbergen')
                    : t('eq.field.passwordShow', 'Passwort anzeigen')
                }
                className="absolute inset-y-0 right-0 flex items-center px-2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
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

      {hasSdiPorts(equipment) && (
        <SdiCapabilitiesBlock equipmentId={equipment.id} caps={equipment.sdiCaps} />
      )}

      {networkKind && (
        <NetworkConfig equipmentId={equipment.id} item={equipment} allPorts={[...equipment.inputs, ...equipment.outputs]} kind={networkKind} />
      )}

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

      <fieldset className="rounded border border-slate-700 p-2">
        <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">Rack / 19" Einstellungen</legend>
        <label className="mb-2 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={!!equipment.isRackDevice}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                isRackDevice: event.target.checked,
                rackUnits: event.target.checked ? equipment.rackUnits ?? 1 : undefined,
              })
            }
          />
          <span>Ist ein 19" Rack-Gerät</span>
        </label>

        {!equipment.isRackDevice && (
          <div className="rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px] text-slate-400">
            Rack-Felder erscheinen nur, wenn das Gerät als 19" Rack-Gerät markiert ist.
          </div>
        )}

        {equipment.isRackDevice && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-slate-300">Hohe (HE)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={equipment.rackUnits ?? 1}
                  onChange={(event) =>
                    updateEquipment(equipment.id, {
                      rackUnits: Math.max(1, Number(event.target.value) || 1),
                    })
                  }
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-slate-300">Ansicht</span>
                <select
                  value={rackViewMode}
                  onChange={(event) => setRackViewMode(event.target.value as 'front' | 'rear' | 'both')}
                  className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                >
                  <option value="front">Nur vorne</option>
                  <option value="rear">Nur hinten</option>
                  <option value="both">Vorne + hinten</option>
                </select>
              </label>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                  if (dataUri) setCropDialog({ side: 'front', src: dataUri })
                }}
                className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
              >
                Frontgrafik importieren + zuschneiden
              </button>
              <button
                type="button"
                onClick={async () => {
                  const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                  if (dataUri) setCropDialog({ side: 'rear', src: dataUri })
                }}
                className="rounded bg-purple-700 px-2 py-1 text-xs hover:bg-purple-600"
              >
                Reargrafik importieren + zuschneiden
              </button>
            </div>

            {equipment.netboxPath && (
              <div className="mt-2 text-[10px] text-slate-500">
                Quelle: NetBox device-type-library · {equipment.netboxPath}
              </div>
            )}

            <RackFacePreview equipment={equipment} viewMode={rackViewMode} />
          </>
        )}
      </fieldset>

      <div className="rounded border border-slate-700 bg-slate-900/40 p-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
          Bibliothek
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              const existing = customLibrary.find((t) => t.name === equipment.name)
              const msg = existing
                ? `"${equipment.name}" existiert bereits in der Bibliothek. Mit den aktuellen Einstellungen dieses Geräts überschreiben?`
                : `"${equipment.name}" als neue Standard-Vorlage in der Bibliothek speichern?`
              if (window.confirm(msg)) {
                saveEquipmentAsTemplate(equipment.id)
              }
            }}
            className="w-full rounded bg-amber-700 px-2 py-1 text-xs hover:bg-amber-600"
            title="Speichert das aktuelle Gerät (Ports, Netzwerk, SDI-Caps, MV-Config …) als Vorlage in der Bibliothek."
          >
            {customLibrary.find((t) => t.name === equipment.name)
              ? 'Als Standard-Vorlage überschreiben ↺'
              : 'Als neue Standard-Vorlage speichern ✚'}
          </button>
          <button
            type="button"
            onClick={async () => {
              const suggestion = `${equipment.name} (Custom)`
              const input = await promptDialog(
                'Als neues Gerät in der Bibliothek speichern.\nName:',
                suggestion,
              )
              if (!input) return
              const trimmed = input.trim()
              if (!trimmed) return
              if (customLibrary.some((t) => t.name === trimmed)) {
                window.alert(
                  `"${trimmed}" existiert bereits. Bitte einen anderen Namen wählen oder die bestehende Vorlage überschreiben.`,
                )
                return
              }
              saveEquipmentAsNewTemplate(equipment.id, trimmed, equipment.category)
            }}
            className="w-full rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
            title="Erstellt eine neue Vorlage unter anderem Namen — bestehende bleibt unverändert."
          >
            Als neues Gerät in Library speichern ✚
          </button>
        </div>
      </div>

      <RackImageCropDialog
        open={!!cropDialog}
        imageSrc={cropDialog?.src ?? null}
        rackUnits={equipment.rackUnits ?? 1}
        side={cropDialog?.side ?? 'front'}
        onCancel={() => setCropDialog(null)}
        onConfirm={({ dataUrl, crop }) => {
          if (!cropDialog) return
          if (cropDialog.side === 'front') {
            updateEquipment(equipment.id, { frontPanelImageUrl: dataUrl, frontPanelCrop: crop })
          } else {
            updateEquipment(equipment.id, { rearPanelImageUrl: dataUrl, rearPanelCrop: crop })
          }
          setCropDialog(null)
        }}
      />
    </div>
  )
}
