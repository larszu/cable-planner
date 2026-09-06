import { Plus, Trash2 } from 'lucide-react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'
import { detectNetworkDevice } from '../../../lib/deviceKind'
import {
  NETWORK_INTERFACE_ROLES,
  type NetworkInterface,
  type NetworkInterfaceRole,
  type PtpProfile,
  type PtpRole,
} from '../../../types/network'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * Bedarf 19 — die WEITEREN Netzwerk-Schnittstellen eines Geraets.
 *
 * Steht bewusst unter den Basis-Feldern und nicht daneben: die vier Felder
 * darueber SIND Schnittstelle 0 (siehe `types/network.ts`). Wer hier etwas
 * anlegt, legt die zweite an — Dante sekundaer, ST 2110 blau, getrennte
 * Steuerung. Genau die Faelle, fuer die eine Excel-Mappe eine zweite Zeile
 * oder eine zusaetzliche Spalte bekommt und danach auseinanderlaeuft.
 *
 * Der Switch-Bezug (`switchEquipmentId` + `switchPort`) haengt hier und nicht
 * am Switch: eine Schnittstelle weiss, wo sie steckt; ein Switch mit 48
 * Feldern waere ein Formular, das niemand ausfuellt.
 */
export const ExtraInterfacesPanel = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const allEquipment = useProjectStore((state) => state.project.equipment)
  const switches = allEquipment.filter((e) => detectNetworkDevice(e) === 'switch')

  const nics = equipment.networkInterfaces ?? []
  const commit = (next: NetworkInterface[]) =>
    updateEquipment(equipment.id, { networkInterfaces: next.length > 0 ? next : undefined })

  const patch = (id: string, p: Partial<NetworkInterface>) =>
    commit(nics.map((n) => (n.id === id ? { ...n, ...p } : n)))

  const add = () =>
    commit([
      ...nics,
      {
        id: `${equipment.id}#nic${nics.length + 1}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'unspecified',
        label: '',
      },
    ])

  const roleLabel = (r: NetworkInterfaceRole): string => {
    switch (r) {
      case 'media-primary':
        return t('nic.role.mediaPrimary', 'Medien primär')
      case 'media-secondary':
        return t('nic.role.mediaSecondary', 'Medien sekundär')
      case 'control':
        return t('nic.role.control', 'Steuerung')
      case 'management':
        return t('nic.role.management', 'Management')
      case 'unspecified':
        return t('nic.role.unspecified', 'nicht angegeben')
    }
  }

  const inputCls = 'w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono'

  return (
    <div className="mt-3 border-t border-cp-border-muted pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-cp-text-secondary">
          {t('nic.title', 'Weitere Netzwerk-Schnittstellen')}
        </span>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:text-cp-text"
        >
          <Icon icon={Plus} size="xs" /> {t('nic.add', 'Hinzufügen')}
        </button>
      </div>
      <p className="mb-2 text-cp-xs text-cp-text-muted">
        {t(
          'nic.hint',
          'Die Felder oben sind die erste Schnittstelle. Hier stehen die weiteren — Dante sekundär, ST 2110 blau, getrennte Steuerung.',
        )}
      </p>

      <label className="mb-2 block">
        <span className="mb-1 block text-cp-text-secondary">{t('nic.primaryRole', 'Rolle der ersten Schnittstelle')}</span>
        <select
          value={equipment.primaryInterfaceRole ?? 'unspecified'}
          onChange={(e) =>
            updateEquipment(equipment.id, {
              primaryInterfaceRole:
                e.target.value === 'unspecified' ? undefined : (e.target.value as NetworkInterfaceRole),
            })
          }
          className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
        >
          {NETWORK_INTERFACE_ROLES.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
      </label>

      {nics.length === 0 ? (
        <p className="text-cp-xs text-cp-text-faint">{t('nic.none', 'Keine weiteren Schnittstellen.')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nics.map((n) => (
            <li key={n.id} className="rounded border border-cp-border-muted bg-cp-surface-2 p-2">
              <div className="mb-1 flex items-center gap-2">
                <input
                  value={n.label ?? ''}
                  onChange={(e) => patch(n.id, { label: e.target.value })}
                  placeholder={t('nic.label', 'Beschriftung, z. B. „Dante Sec"')}
                  aria-label={t('nic.label', 'Beschriftung, z. B. „Dante Sec"')}
                  className="flex-1 rounded border border-cp-border bg-cp-surface-1 p-1.5"
                />
                <select
                  value={n.role}
                  onChange={(e) => patch(n.id, { role: e.target.value as NetworkInterfaceRole })}
                  aria-label={t('nic.role', 'Rolle')}
                  className="rounded border border-cp-border bg-cp-surface-1 p-1.5"
                >
                  {NETWORK_INTERFACE_ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel(r)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => commit(nics.filter((x) => x.id !== n.id))}
                  aria-label={t('nic.remove', 'Schnittstelle entfernen')}
                  className="text-cp-text-faint hover:text-cp-danger"
                >
                  <Icon icon={Trash2} size="sm" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={n.ipAddress ?? ''}
                  onChange={(e) => patch(n.id, { ipAddress: e.target.value || undefined })}
                  placeholder="10.0.1.10"
                  aria-label={t('eq.field.ipAddress', 'IP Address')}
                  className={inputCls}
                />
                <input
                  value={n.subnetMask ?? ''}
                  onChange={(e) => patch(n.id, { subnetMask: e.target.value || undefined })}
                  placeholder="255.255.255.0"
                  aria-label={t('eq.field.subnet', 'Subnet Mask')}
                  className={inputCls}
                />
                <input
                  value={n.gateway ?? ''}
                  onChange={(e) => patch(n.id, { gateway: e.target.value || undefined })}
                  placeholder="Gateway"
                  aria-label={t('nic.gateway', 'Gateway')}
                  className={inputCls}
                />
                <input
                  value={n.macAddress ?? ''}
                  onChange={(e) => patch(n.id, { macAddress: e.target.value || undefined })}
                  placeholder="MAC"
                  aria-label={t('nic.mac', 'MAC-Adresse')}
                  className={inputCls}
                />
                <input
                  type="number"
                  min={0}
                  max={4094}
                  value={n.vlanId ?? ''}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    patch(n.id, { vlanId: e.target.value === '' || !Number.isInteger(v) ? undefined : v })
                  }}
                  placeholder="VLAN"
                  aria-label={t('nic.vlan', 'VLAN')}
                  className={inputCls}
                />
                <div className="flex gap-1">
                  <select
                    value={n.switchEquipmentId ?? ''}
                    onChange={(e) => patch(n.id, { switchEquipmentId: e.target.value || undefined })}
                    aria-label={t('nic.switch', 'Switch')}
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 p-2"
                  >
                    <option value="">{t('nic.noSwitch', '— kein Switch —')}</option>
                    {switches.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <input
                    value={n.switchPort ?? ''}
                    onChange={(e) => patch(n.id, { switchPort: e.target.value || undefined })}
                    placeholder={t('nic.switchPort', 'Port')}
                    aria-label={t('nic.switchPort', 'Port')}
                    className="w-20 rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
                  />
                </div>
                {/* BEDARF 73 — die Zeit. Drei Felder, weil der Bedarf drei
                    nennt (Domaene, Profil, Rolle im Zeit-Baum). Kein Feld
                    wird vorbelegt: die beiden Profile setzen VERSCHIEDENE
                    Vorgabe-Domaenen (127 gegen 0), und eine geratene waere
                    genau der Widerspruch, den die Pruefung suchen soll. */}
                <div className="flex gap-1">
                  <input
                    type="number"
                    min={0}
                    max={127}
                    value={n.ptpDomain ?? ''}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      patch(n.id, {
                        ptpDomain:
                          e.target.value === '' || !Number.isInteger(v) ? undefined : v,
                      })
                    }}
                    placeholder={t('nic.ptpDomain', 'PTP-Domäne')}
                    aria-label={t('nic.ptpDomain', 'PTP-Domäne')}
                    className="w-24 rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
                  />
                  <select
                    value={n.ptpProfile ?? 'unspecified'}
                    onChange={(e) =>
                      patch(n.id, {
                        ptpProfile:
                          e.target.value === 'unspecified'
                            ? undefined
                            : (e.target.value as PtpProfile),
                      })
                    }
                    aria-label={t('nic.ptpProfile', 'PTP-Profil')}
                    className="min-w-0 flex-1 rounded border border-cp-border bg-cp-surface-1 p-2"
                  >
                    <option value="unspecified">{t('nic.ptpProfile.unspecified', '— PTP-Profil —')}</option>
                    <option value="st2059-2">{t('nic.ptpProfile.st2059', 'ST 2059-2 (Vorgabe 127)')}</option>
                    <option value="aes67">{t('nic.ptpProfile.aes67', 'AES67 (üblich 0)')}</option>
                    <option value="default">{t('nic.ptpProfile.default', 'IEEE 1588 Default')}</option>
                  </select>
                  <select
                    value={n.ptpRole ?? 'unspecified'}
                    onChange={(e) =>
                      patch(n.id, {
                        ptpRole:
                          e.target.value === 'unspecified'
                            ? undefined
                            : (e.target.value as PtpRole),
                      })
                    }
                    aria-label={t('nic.ptpRole', 'PTP-Rolle')}
                    className="w-28 rounded border border-cp-border bg-cp-surface-1 p-2"
                  >
                    <option value="unspecified">{t('nic.ptpRole.unspecified', '— Rolle —')}</option>
                    <option value="grandmaster">{t('nic.ptpRole.grandmaster', 'Grandmaster')}</option>
                    <option value="boundary">{t('nic.ptpRole.boundary', 'Boundary Clock')}</option>
                    <option value="slave">{t('nic.ptpRole.slave', 'Slave')}</option>
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
