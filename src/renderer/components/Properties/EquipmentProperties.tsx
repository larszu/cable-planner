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
import { useGreenGoBeltpack } from '../../lib/greengoSync'
import { exportDevicePatchSheet } from '../../lib/exportDevicePdf'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, EquipmentItem, Port, VlanDef, PortVlanAssignment } from '../../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../../types/cableSpec'
import type { SignalStandard } from '../../types/cableSpec'
import { QUAD_LINK_LABEL, type QuadLinkMode } from '../../types/videoFormat'
import { RackImageCropDialog } from '../Rack/RackImageCropDialog'
import { CategorySelect } from '../shared/CategorySelect'
import { pickImageAsDataUri, readImageAsDataUri } from '../../lib/readImageAsDataUri'
import { useTranslation } from '../../lib/i18n'

/** Module-level sensor options so re-renders don't churn the sensor
 *  instances. Stable references are critical for DnDContext's
 *  internal subscriptions — fresh sensor objects on every render
 *  was a known #185 contributor before. */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } } as const
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
} as const

/**
 * v7.4.0 / v7.6.0 — drag-reorderable accordion section. Each section
 * lives in its own `<details>` for independent collapse, and uses
 * dnd-kit's `useSortable` to participate in the parent's drag
 * context. We rely on `useSortable`'s `index` (the position in the
 * SortableContext items array) for CSS `order` so that ALL sections
 * don't need to subscribe to the uiStore order array — that was
 * causing every section to re-render on every reorder and possibly
 * trigping React #185 during heavy drag activity.
 *
 * The `⋮⋮` handle on the summary triggers drag via spread attributes
 * + listeners (dnd-kit's contract); the rest of the summary keeps
 * the click-to-toggle behaviour for the accordion.
 */
const SortableSection = ({
  id,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index } =
    useSortable({ id })
  return (
    <details
      ref={setNodeRef}
      open={defaultOpen}
      className={`rounded border border-slate-700 bg-slate-900/40 [&_summary]:cursor-pointer ${
        isDragging ? 'opacity-60 shadow-xl shadow-slate-950/50' : ''
      }`}
      style={{
        order: index < 0 ? 999 : index,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <summary className="flex items-center gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200">
        <span
          {...attributes}
          {...listeners}
          title="Sektion ziehen, um Reihenfolge zu ändern"
          className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
          aria-label="Sektion verschieben"
          role="button"
        >
          ⋮⋮
        </span>
        <span className="flex-1">{title}</span>
        {subtitle && (
          <span className="normal-case text-[10px] text-slate-500">{subtitle}</span>
        )}
      </summary>
      <div className="border-t border-slate-800 p-2">{children}</div>
    </details>
  )
}

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
            {port.connectorType === 'BNC' && (
              <div className="mt-1 rounded border border-amber-900/60 bg-amber-950/20 p-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  SDI-Fähigkeiten (port-spezifisch)
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!port.sdiCaps?.levelA}
                      onChange={(e) =>
                        updatePort(port.id, {
                          sdiCaps: {
                            ...(port.sdiCaps ?? {}),
                            levelA: e.target.checked || undefined,
                          },
                        })
                      }
                    />
                    3G Level A
                  </label>
                  <label className="flex items-center gap-1 text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!port.sdiCaps?.levelB}
                      onChange={(e) =>
                        updatePort(port.id, {
                          sdiCaps: {
                            ...(port.sdiCaps ?? {}),
                            levelB: e.target.checked || undefined,
                          },
                        })
                      }
                    />
                    3G Level B
                  </label>
                  <label className="col-span-2 block">
                    <span className="text-slate-400">Max Single-Link</span>
                    <select
                      value={port.sdiCaps?.maxSingleLink ?? ''}
                      onChange={(e) =>
                        updatePort(port.id, {
                          sdiCaps: {
                            ...(port.sdiCaps ?? {}),
                            maxSingleLink: (e.target.value || undefined) as NonNullable<
                              NonNullable<typeof port.sdiCaps>['maxSingleLink']
                            >,
                          },
                        })
                      }
                      className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 p-1 text-xs"
                    >
                      <option value="">(Geräte-Default)</option>
                      <option value="SDI-HD">SDI-HD (1.5G)</option>
                      <option value="SDI-3G">SDI-3G</option>
                      <option value="SDI-6G">SDI-6G</option>
                      <option value="SDI-12G">SDI-12G</option>
                    </select>
                  </label>
                </div>
                <div className="mt-1 text-[9px] text-slate-500">
                  Überschreibt die Geräte-SDI-Fähigkeiten für diesen Port.
                  Leer = Default vom Gerät.
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
                      style={{ width: panelWidth, height: Math.max(1, equipment.rackUnits ?? 1) * unitHeight }}
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

/**
 * GreenGo beltpack section embedded in EquipmentProperties for any
 * device whose deviceKind === 'greengo'. The data flows from
 * `project.greengoConfig.users` — same source the GreenGo Intercom
 * dialog uses — so renaming the beltpack here updates it everywhere
 * (canvas label, the GreenGo dialog, the .gg5 export). Issue #56.
 */
const GreenGoBeltpackSection = ({ equipmentId }: { equipmentId: string }) => {
  const { config, info, rename, assignUser } = useGreenGoBeltpack(equipmentId)
  if (!config || config.users.length === 0) {
    return (
      <div className="mb-2 text-[10px] text-emerald-300/60">
        Keine GreenGo-Konfiguration im Projekt. Öffne den Intercom-Planer oder lade ein
        Preset, um Beltpacks zu definieren.
      </div>
    )
  }
  // List of all users for the assignment dropdown. We label them by name
  // and decorate with the linked equipment id if any (so the user can
  // see at a glance which slots are already taken).
  return (
    <div className="mb-2 rounded bg-emerald-950/40 p-2">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide text-emerald-300">
        <span>Beltpack</span>
        {info?.groupNames && info.groupNames.length > 0 && (
          <span
            className="font-normal normal-case text-emerald-400/80"
            title={`Gruppen: ${info.groupNames.join(', ')}`}
          >
            {info.groupNames.length} Gruppe{info.groupNames.length === 1 ? '' : 'n'}
          </span>
        )}
      </div>
      <label className="block">
        <span className="mb-1 block text-emerald-200/70">Name</span>
        <input
          type="text"
          value={info?.user.name ?? ''}
          disabled={!info}
          placeholder={info ? '' : 'Erst zuordnen ↓'}
          onChange={(event) => rename(event.target.value)}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-xs text-emerald-50 disabled:opacity-50"
          title="Änderungen werden sofort in den Intercom-Plan und das .gg5-Export geschrieben"
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-emerald-200/70">Zugewiesener User-Slot</span>
        <select
          value={info?.user.id ?? ''}
          onChange={(event) => {
            const v = event.target.value
            assignUser(v === '' ? null : Number(v))
          }}
          className="w-full rounded border border-emerald-700 bg-emerald-950 p-1 text-xs text-emerald-50"
        >
          <option value="">(kein Slot zugewiesen)</option>
          {config.users.map((u) => {
            const takenBy = u.equipmentId && u.equipmentId !== equipmentId
            return (
              <option key={u.id} value={u.id}>
                {u.id}. {u.name}
                {takenBy ? ' (anderem Gerät zugewiesen)' : ''}
              </option>
            )
          })}
        </select>
      </label>
      {info?.groupNames && info.groupNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {info.groupNames.map((g) => (
            <span
              key={g}
              className="rounded bg-emerald-700/40 px-1.5 py-0.5 text-emerald-100"
              title="Gruppen werden im Intercom-Planer bearbeitet"
            >
              {g}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Issue #80: Per-device view of the global device-config library
 * (uiStore.deviceConfigLibrary). Lists configs already assigned to
 * this equipment, plus a dropdown to assign an existing unassigned
 * config to it. Upload/management of the library itself lives in
 * Settings → Konfigurationen.
 */
const DeviceConfigsBlock = ({ equipmentId }: { equipmentId: string }) => {
  const library = useUiStore((s) => s.deviceConfigLibrary)
  const updateDeviceConfig = useUiStore((s) => s.updateDeviceConfig)
  const assigned = library.filter((e) => e.equipmentId === equipmentId)
  const unassigned = library.filter((e) => !e.equipmentId)
  if (library.length === 0) return null
  return (
    <div className="rounded border border-slate-700 bg-slate-900/40 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
        Konfigurationen
      </div>
      {assigned.length === 0 ? (
        <div className="text-[11px] text-slate-500">Keine Konfiguration zugeordnet.</div>
      ) : (
        <ul className="mb-2 space-y-1">
          {assigned.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded bg-slate-950 px-2 py-1 text-[11px]">
              <span className="flex-1 truncate" title={`${e.fileName} (${e.kind})`}>
                {e.name}
              </span>
              <span className="shrink-0 text-[10px] text-slate-500">{e.kind}</span>
              <button
                type="button"
                onClick={() => updateDeviceConfig(e.id, { equipmentId: undefined })}
                className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-red-700 hover:text-white"
                title="Zuordnung lösen (Datei bleibt in der Bibliothek)"
              >
                Lösen
              </button>
            </li>
          ))}
        </ul>
      )}
      {unassigned.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) updateDeviceConfig(e.target.value, { equipmentId })
          }}
          className="w-full rounded border border-slate-700 bg-slate-950 p-1 text-[11px]"
        >
          <option value="">+ Vorhandene Konfiguration zuordnen…</option>
          {unassigned.map((e) => (
            <option key={e.id} value={e.id}>
              {e.kind} · {e.name}
            </option>
          ))}
        </select>
      )}
      <div className="mt-1 text-[10px] text-slate-500">
        Neue Konfigurationen über Einstellungen → Konfigurationen hochladen.
      </div>
    </div>
  )
}

/**
 * v7.5.0 / v7.6.0 — Operating-mode picker + inline editor for multi-mode
 * devices (media servers, modular processors like Pixelhue P20, Parco
 * S3, Brompton Tessera).
 *
 * Workflow:
 *   1. Edit ports normally with the PortList accordion → layout A.
 *   2. Click "+ aus aktuellem Layout" → name it "Layout A". Now the
 *      current ports are captured as a mode, and that mode is active.
 *   3. Edit ports → layout B → "+ aus aktuellem Layout" → "Layout B".
 *   4. Switch modes via the cards. Each card has rename + delete.
 *
 * Switching activates the mode and copies its snapshot to the live
 * inputs/outputs (via setActiveDeviceMode in the store). Editing the
 * ports later doesn't automatically sync back to the mode — there's
 * an "Aktuelle Ports in Modus übernehmen" button per active mode for
 * that, so the user controls when a mode definition is updated.
 */
const DeviceModePicker = ({
  equipment,
}: {
  equipment: import('../../types/equipment').EquipmentItem
}) => {
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const setActiveDeviceMode = useProjectStore((s) => s.setActiveDeviceMode)
  const modes = equipment.modes ?? []
  const active = equipment.activeModeId

  const createModeFromPorts = () => {
    const name = window.prompt(
      'Name des neuen Modus (z. B. "12G Single-Link" / "HDMI Output Mode"):',
      `Modus ${modes.length + 1}`,
    )?.trim()
    if (!name) return
    const newMode = {
      id: `mode:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      name,
      inputs: equipment.inputs.map((p) => ({ ...p })),
      outputs: equipment.outputs.map((p) => ({ ...p })),
    }
    updateEquipment(equipment.id, {
      modes: [...modes, newMode],
      activeModeId: newMode.id,
    })
  }

  const renameMode = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    const name = window.prompt('Modus-Name:', mode.name)?.trim()
    if (!name) return
    updateEquipment(equipment.id, {
      modes: modes.map((m) => (m.id === modeId ? { ...m, name } : m)),
    })
  }

  const editDescription = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    const desc = window.prompt(
      'Kurze Beschreibung (z. B. "1× 12G IN, 4× HDMI OUT"):',
      mode.description ?? '',
    )
    if (desc === null) return
    updateEquipment(equipment.id, {
      modes: modes.map((m) => (m.id === modeId ? { ...m, description: desc || undefined } : m)),
    })
  }

  const deleteMode = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    if (!window.confirm(`Modus "${mode.name}" löschen? Die zugehörigen Ports bleiben am Gerät erhalten.`)) return
    updateEquipment(equipment.id, {
      modes: modes.filter((m) => m.id !== modeId),
      activeModeId: active === modeId ? undefined : active,
    })
  }

  const captureCurrentPortsToMode = (modeId: string) => {
    const mode = modes.find((m) => m.id === modeId)
    if (!mode) return
    if (
      !window.confirm(
        `Aktuelles Port-Layout (${equipment.inputs.length} In, ${equipment.outputs.length} Out) als neue Definition für "${mode.name}" speichern?`,
      )
    )
      return
    updateEquipment(equipment.id, {
      modes: modes.map((m) =>
        m.id === modeId
          ? {
              ...m,
              inputs: equipment.inputs.map((p) => ({ ...p })),
              outputs: equipment.outputs.map((p) => ({ ...p })),
            }
          : m,
      ),
    })
  }

  return (
    <div className="space-y-2 text-xs">
      <p className="text-[10px] text-slate-500">
        Wechselt das Port-Layout des Geräts. Bestehende Kabel an Ports, die im neuen
        Modus nicht existieren, bleiben im Projekt, müssen aber neu gesteckt werden.
      </p>
      <div className="grid grid-cols-1 gap-1">
        {modes.length === 0 && (
          <div className="rounded border border-dashed border-slate-700 p-3 text-center text-[11px] text-slate-500">
            Keine Modi definiert. Ports oben bearbeiten und anschließend mit
            <strong className="text-slate-300"> + aus aktuellem Layout </strong>
            als Modus speichern.
          </div>
        )}
        {modes.map((m) => (
          <div
            key={m.id}
            className={`rounded border ${
              active === m.id ? 'border-sky-500 bg-sky-900/40' : 'border-slate-700 bg-slate-900'
            }`}
          >
            <button
              type="button"
              onClick={() => setActiveDeviceMode(equipment.id, m.id)}
              className="flex w-full flex-col items-start px-2 py-1.5 text-left text-slate-100"
              title={active === m.id ? 'Aktiv' : 'Aktivieren'}
            >
              <span className="font-medium">
                {active === m.id && <span className="mr-1 text-sky-300">●</span>}
                {m.name}
              </span>
              {m.description && (
                <span className="text-[10px] text-slate-400">{m.description}</span>
              )}
              <span className="mt-1 text-[10px] text-slate-500">
                {m.inputs.length} In · {m.outputs.length} Out
              </span>
            </button>
            <div className="flex gap-1 border-t border-slate-800 bg-slate-950/40 px-1 py-1 text-[10px]">
              <button
                type="button"
                onClick={() => renameMode(m.id)}
                className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
                title="Namen ändern"
              >
                ✎ Name
              </button>
              <button
                type="button"
                onClick={() => editDescription(m.id)}
                className="rounded px-1.5 py-0.5 text-slate-300 hover:bg-slate-800"
                title="Beschreibung ändern"
              >
                ✎ Beschreibung
              </button>
              {active === m.id && (
                <button
                  type="button"
                  onClick={() => captureCurrentPortsToMode(m.id)}
                  className="rounded px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-900/30"
                  title="Aktuelles Port-Layout in diesen Modus übernehmen"
                >
                  ⬆ Ports übernehmen
                </button>
              )}
              <button
                type="button"
                onClick={() => deleteMode(m.id)}
                className="ml-auto rounded px-1.5 py-0.5 text-slate-400 hover:bg-red-700 hover:text-white"
                title="Modus löschen"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={createModeFromPorts}
        className="w-full rounded border border-dashed border-emerald-700 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        title="Speichert das aktuelle Port-Layout des Geräts als neuen Modus."
      >
        + aus aktuellem Layout speichern
      </button>
    </div>
  )
}

/**
 * v7.4.0 — Stromverbrauch accordion. Two entry paths:
 *   • Watts directly (datasheet)
 *   • Voltage × Ampere → auto-derive Watts
 * If V and A are both filled, the W field is computed live. The user
 * can still override W (which will then "win" over V×A until they
 * change V or A again). All three values persist on the equipment so
 * the field tech sees the original specification next time.
 */
const PowerConsumptionSection = ({
  equipment,
}: {
  equipment: import('../../types/equipment').EquipmentItem
}) => {
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const v = equipment.voltage
  const a = equipment.currentAmps
  const w = equipment.powerConsumptionWatts
  const computedW = typeof v === 'number' && typeof a === 'number' ? v * a : undefined
  const summary =
    typeof w === 'number'
      ? `${w} W`
      : typeof computedW === 'number'
        ? `~${Math.round(computedW)} W`
        : '–'
  return (
    <SortableSection id="power" title="Stromverbrauch" subtitle={summary}>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <label className="block">
          <span className="mb-1 block text-slate-400">Spannung (V)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={v ?? ''}
            placeholder="z. B. 230"
            onChange={(e) => {
              const nextV = e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              // Recompute W only when both V and A are present AND
              // the user hadn't manually overridden a W value that
              // diverges from the previous V×A. If W matches the
              // OLD V×A (or W is blank), update it; otherwise leave
              // the explicit override intact.
              const oldProduct =
                typeof v === 'number' && typeof a === 'number' ? v * a : undefined
              const wAutoMatched =
                w === undefined || (oldProduct !== undefined && Math.abs(w - oldProduct) < 0.5)
              const newProduct =
                typeof nextV === 'number' && typeof a === 'number' ? nextV * a : undefined
              updateEquipment(equipment.id, {
                voltage: nextV,
                powerConsumptionWatts: wAutoMatched ? newProduct : w,
              })
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-400">Stromstärke (A)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={a ?? ''}
            placeholder="z. B. 1.5"
            onChange={(e) => {
              const nextA = e.target.value ? Math.max(0, Number(e.target.value)) : undefined
              const oldProduct =
                typeof v === 'number' && typeof a === 'number' ? v * a : undefined
              const wAutoMatched =
                w === undefined || (oldProduct !== undefined && Math.abs(w - oldProduct) < 0.5)
              const newProduct =
                typeof v === 'number' && typeof nextA === 'number' ? v * nextA : undefined
              updateEquipment(equipment.id, {
                currentAmps: nextA,
                powerConsumptionWatts: wAutoMatched ? newProduct : w,
              })
            }}
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-400">
            Leistung (W)
            {computedW !== undefined && (
              <span className="ml-1 text-emerald-400/70" title="Aus V × A berechnet">
                ⚡
              </span>
            )}
          </span>
          <input
            type="number"
            min={0}
            step={1}
            value={w ?? ''}
            placeholder={
              computedW !== undefined ? `auto: ${Math.round(computedW)}` : 'optional'
            }
            onChange={(e) =>
              updateEquipment(equipment.id, {
                powerConsumptionWatts: e.target.value
                  ? Math.max(0, Number(e.target.value))
                  : undefined,
              })
            }
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
            title="Datenblatt-Wert. V × A wird vorgeschlagen, kann hier überschrieben werden."
          />
        </label>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">
        Wenn Spannung und Stromstärke gesetzt sind, wird die Leistung automatisch berechnet
        (P = U × I). Werkzeuge → Stromverbrauch summiert das Leistungs-Feld über alle Geräte.
      </p>
    </SortableSection>
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

  // v7.4.0 — sortable accordion sections. The parent is `flex flex-col`
  // so CSS `order` works. Non-movable elements (device-kind cards,
  // Name, Category, Rentman badge) have no `order` declared → they
  // default to 0 → render first in JSX order. Each SortableSection
  // sets its own `order` based on the uiStore-persisted user order.
  const sectionOrder = useUiStore((s) => s.equipmentSectionOrder)
  const setSectionOrder = useUiStore((s) => s.setEquipmentSectionOrder)
  const dragSensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  )
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id))
    const newIndex = sectionOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
    <div className="flex flex-col gap-3 text-xs">
      {deviceKind === 'greengo' && (
        <div className="rounded border border-emerald-700 bg-emerald-900/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-emerald-300">
            GreenGo Intercom erkannt
          </div>
          <GreenGoBeltpackSection equipmentId={equipment.id} />
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
              title="ATEM Audio-Router offline planen (Routing-Matrix oder klassischer Mixer)."
            >
              Audio-Router konfigurieren →
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

      <SortableSection id="optional" title="Optionale Felder" subtitle="Hersteller-Link, Referenzbild, Icon">
        <div className="space-y-3">
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
        </div>
      </SortableSection>

      <SortableSection id="flags" title="Darstellung & Flags" subtitle="kompakt · Farbe · Ports spiegeln · gepackt">
        <div className="space-y-2">
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
          <label
            className="flex items-center gap-2 text-[11px] text-slate-300"
            title="Markiert das Gerät als gepackt. Erscheint als ✓ auf dem Canvas und als eigene Spalte in der Geräte-BOM."
          >
            <input
              type="checkbox"
              checked={!!equipment.packed}
              onChange={(event) => updateEquipment(equipment.id, { packed: event.target.checked || undefined })}
            />
            Gepackt / Pack-Status
          </label>
        </div>
      </SortableSection>

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

      <SortableSection
        id="network"
        title="Network & Access"
        subtitle="IP · S/N · Login"
        defaultOpen
      >
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
      </SortableSection>

      <PowerConsumptionSection equipment={equipment} />

      {hasSdiPorts(equipment) && (
        <SortableSection
          id="sdi"
          title="SDI Fähigkeiten"
          subtitle="3G Level · Single-Link · Quad-Link"
        >
          <SdiCapabilitiesBlock equipmentId={equipment.id} caps={equipment.sdiCaps} />
        </SortableSection>
      )}

      {networkKind && (
        <SortableSection
          id="network-config"
          title={networkKind === 'router' ? 'Router Config' : 'Switch Config'}
          subtitle="VLAN · Port-Map · Gateway"
        >
          <NetworkConfig
            equipmentId={equipment.id}
            item={equipment}
            allPorts={[...equipment.inputs, ...equipment.outputs]}
            kind={networkKind}
          />
        </SortableSection>
      )}

      <SortableSection
        id="modes"
        title="Betriebsmodi"
        subtitle={
          (equipment.modes ?? []).length === 0
            ? 'keiner'
            : (equipment.modes?.find((m) => m.id === equipment.activeModeId)?.name ??
              `${equipment.modes?.length} definiert`)
        }
        defaultOpen={!!equipment.activeModeId}
      >
        <DeviceModePicker equipment={equipment} />
      </SortableSection>

      <SortableSection
        id="ports"
        title="Inputs & Outputs"
        subtitle={`${equipment.inputs.length} In · ${equipment.outputs.length} Out`}
        defaultOpen
      >
        <div className="space-y-2">
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
      </SortableSection>

      <SortableSection
        id="rack"
        title={`Rack / 19" Einstellungen`}
        subtitle={equipment.isRackDevice ? `${equipment.rackUnits ?? 1} HE` : 'nicht aktiv'}
        defaultOpen={!!equipment.isRackDevice}
      >
        <fieldset className="border-0 p-0">
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
      </SortableSection>

      <SortableSection
        id="library"
        title="Bibliothek"
        subtitle="als Vorlage speichern"
      >
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
      </SortableSection>

      {equipment.rackInstanceId && (
        <div className="rounded border border-cyan-700 bg-cyan-950/30 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-cyan-300">
            Rack-Instanz · {equipment.rackInstanceLabel ?? 'Rack'}
          </div>
          <p className="mb-2 text-[10px] text-slate-400">
            Dieses Gerät gehört zu einer Rack-Instanz. Der Rack-Editor zeigt eine
            gefilterte Sub-Canvas mit nur diesem Rack — Änderungen an der Position werden
            beim Loslassen auf ganze HU gerundet.
          </p>
          <button
            type="button"
            onClick={() => useUiStore.getState().openRackEditor(equipment.rackInstanceId!)}
            className="w-full rounded bg-cyan-700 px-2 py-1 text-xs text-white hover:bg-cyan-600"
          >
            🗄 Rack-Editor öffnen
          </button>
          {typeof equipment.rackInstanceStartUnit === 'number' && (
            <div className="mt-1 text-[10px] text-slate-500">
              Position: ab HU {equipment.rackInstanceStartUnit + 1}
              {equipment.rackUnits ? ` (${equipment.rackUnits} HE)` : ''}
            </div>
          )}
        </div>
      )}

      <DeviceConfigsBlock equipmentId={equipment.id} />

      <SortableSection
        id="print"
        title="Druck / Dokumentation"
        subtitle="Patch-Sheet A4/A3"
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() =>
              void exportDevicePatchSheet(
                equipment,
                useProjectStore.getState().project.equipment,
                useProjectStore.getState().project.cables,
                { format: 'a4' },
              )
            }
            className="w-full rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            title="Erzeugt eine einseitige A4-Patch-Liste mit allen Ports + verbundenen Kabeln — zum Aufkleben am Gerät."
          >
            🖨 Patch-Sheet (A4 PDF) drucken
          </button>
          <button
            type="button"
            onClick={() =>
              void exportDevicePatchSheet(
                equipment,
                useProjectStore.getState().project.equipment,
                useProjectStore.getState().project.cables,
                { format: 'a3' },
              )
            }
            className="w-full rounded bg-sky-800 px-2 py-1 text-xs text-white hover:bg-sky-700"
            title="A3-Variante für Geräte mit vielen Ports."
          >
            🖨 Patch-Sheet (A3 PDF) drucken
          </button>
        </div>
      </SortableSection>

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
    </SortableContext>
    </DndContext>
  )
}
