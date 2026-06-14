import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { Port, VlanDef, PortVlanAssignment } from '../../../types/equipment'

/**
 * #306 — Network-Config (Switch/Router) aus EquipmentProperties
 * ausgelagert. Verwaltet Management-VLAN, Gateway, DNS, Firmware,
 * Mgmt-URL + VLAN-Tabelle + Port-VLAN-Zuordnung.
 */

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

export const NetworkConfig = ({ equipmentId, item, allPorts, kind }: NetworkConfigProps) => {
  const t = useTranslation()
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
          {kind === 'router' ? t('net.routerConfig', 'Router Config') : t('net.switchConfig', 'Switch Config')}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('net.mgmtVlan', 'Management VLAN')}</span>
            <input
              type="number"
              value={item.managementVlanId ?? ''}
              onChange={(event) =>
                updateEquipment(equipmentId, {
                  managementVlanId: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              placeholder="1"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('net.gateway', 'Gateway')}</span>
            <input
              value={item.gateway ?? ''}
              onChange={(event) => updateEquipment(equipmentId, { gateway: event.target.value })}
              placeholder="192.168.1.1"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">DNS</span>
            <input
              value={item.dnsServers ?? ''}
              onChange={(event) =>
                updateEquipment(equipmentId, { dnsServers: event.target.value })
              }
              placeholder="1.1.1.1, 8.8.8.8"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">{t('net.firmware', 'Firmware')}</span>
            <input
              value={item.firmware ?? ''}
              onChange={(event) => updateEquipment(equipmentId, { firmware: event.target.value })}
              placeholder="v2.8.4"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
            />
          </label>
        </div>
        <label className="mt-2 block">
          <span className="mb-1 block text-cp-text-secondary">{t('net.mgmtUrl', 'Management URL')}</span>
          <input
            value={item.mgmtUrl ?? ''}
            onChange={(event) => updateEquipment(equipmentId, { mgmtUrl: event.target.value })}
            placeholder="https://192.168.1.1/"
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
      </fieldset>

      <fieldset className="rounded border border-cyan-700 bg-cyan-950/20 p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-cyan-300">{t('net.vlans', 'VLANs')}</span>
          <button
            type="button"
            onClick={addVlan}
            className="rounded bg-cyan-700 px-2 py-0.5 text-[11px] hover:bg-cyan-600"
          >
            {t('net.addVlan', '+ VLAN')}
          </button>
        </div>
        {vlans.length === 0 && (
          <div className="text-[11px] text-cp-text-muted">{t('net.noVlans', 'Keine VLANs definiert.')}</div>
        )}
        <ul className="space-y-1">
          {vlans.map((v, i) => (
            <li key={i} className="flex items-center gap-1">
              <input
                type="number"
                value={v.id}
                onChange={(event) => updateVlan(i, { id: Number(event.target.value) })}
                className="w-16 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs font-mono"
                placeholder="ID"
              />
              <input
                value={v.name}
                onChange={(event) => updateVlan(i, { name: event.target.value })}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                placeholder={t('net.vlanNamePlaceholder', 'Name (z.B. Production)')}
              />
              <input
                value={v.notes ?? ''}
                onChange={(event) => updateVlan(i, { notes: event.target.value })}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs"
                placeholder={t('net.vlanNotePlaceholder', 'Notiz')}
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
            {t('net.portToVlan', 'Port → VLAN')}
          </legend>
          <div className="mb-1 grid grid-cols-[1fr_70px_120px] gap-1 text-[10px] text-cp-text-muted">
            <span>{t('net.col.port', 'Port')}</span>
            <span>{t('net.col.untagged', 'Untagged')}</span>
            <span>{t('net.col.tagged', 'Tagged')}</span>
          </div>
          <ul className="space-y-1">
            {allPorts.map((p) => {
              const assign = portVlans[p.id] ?? {}
              return (
                <li key={p.id} className="grid grid-cols-[1fr_70px_120px] items-center gap-1">
                  <span className="truncate text-[11px] text-cp-text-secondary" title={p.name}>
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
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs font-mono"
                    placeholder="—"
                  />
                  <input
                    value={assign.tagged ?? ''}
                    onChange={(event) => setPortVlan(p.id, { tagged: event.target.value })}
                    className="rounded border border-cp-border bg-cp-surface-3 p-1 text-cp-xs font-mono"
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
