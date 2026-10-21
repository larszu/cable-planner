/**
 * #1063 — "Steuerung über": documented control interfaces, read-only.
 * Values come from `lib/steuerprotokolle.ts`; anything the manufacturer does
 * not publish is shown as unverified instead of being filled in.
 */
import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '../../../lib/i18n'
import { controlInterfacesFor, type ControlInterface } from '../../../lib/steuerprotokolle'
import { Icon } from '../../shared/Icon'
import type { EquipmentItem } from '../../../types/equipment'

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-cp-text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  ) : null

const InterfaceCard = ({ ci }: { ci: ControlInterface }) => {
  const t = useTranslation()
  const s = ci.serial
  const b = ci.bridge
  return (
    <div className="space-y-1 border border-cp-border p-2" data-testid="control-interface">
      <div className="font-semibold">
        {ci.protocol}{' '}
        <span className="font-normal text-cp-text-muted">
          ({ci.transport === 'serial' ? (s?.standard ?? t('control.serial', 'serial')) : 'IP'})
        </span>
      </div>
      <dl className="space-y-0.5">
        <Row label={t('control.connector', 'Connector')} value={ci.connector} />
        <Row label={t('control.baud', 'Baud')} value={s?.baud?.join(' / ')} />
        <Row label={t('control.format', 'Format')} value={s?.format} />
        <Row label={t('control.pinout', 'Pinout')} value={s?.pinout} />
        <Row label={t('control.flow', 'Flow control')} value={s?.flowControl} />
        <Row label={t('control.multidrop', 'Multidrop')} value={s?.multidrop} />
        <Row
          label={t('control.ip', 'Network')}
          value={ci.ip && `${ci.ip.layer}${ci.ip.port ? ` ${ci.ip.port}` : ''}`}
        />
      </dl>
      {b?.capable && (
        <div className="space-y-0.5 border-t border-cp-border pt-1">
          <div className="text-cp-text-muted">{t('control.bridge', 'Network bridge')}</div>
          <dl className="space-y-0.5">
            <Row label={t('control.bridgeMode', 'Mode')} value={b.tcpMode} />
            <Row label={t('control.bridgePort', 'Port')} value={b.port} />
            <Row label={t('control.packets', 'Packets')} value={b.packetization} />
          </dl>
        </div>
      )}
      {b?.unverified && b.unverified.length > 0 && (
        <div className="text-cp-warn">
          {t('control.unverified', 'Not in manufacturer documentation')}: {b.unverified.join(', ')}
        </div>
      )}
      <a
        href={ci.source}
        target="_blank"
        rel="noreferrer"
        className="block truncate text-cp-accent-text underline"
      >
        {t('control.source', 'Source')}
      </a>
    </div>
  )
}

export const ControlInterfacesSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const list = equipment.controlInterfaces ?? controlInterfacesFor(equipment.deviceTypeId)
  if (!list?.length) return null
  return (
    <details className="border border-cp-border bg-cp-surface-3/40">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 px-2 py-1.5 text-cp-xs font-semibold text-cp-text-muted hover:bg-cp-surface-2/40">
        <Icon icon={SlidersHorizontal} size="xs" />
        {t('control.section', 'Controlled via')}
      </summary>
      <div className="space-y-2 border-t border-cp-border p-2 text-cp-xs">
        {list.map((ci, i) => (
          <InterfaceCard key={i} ci={ci} />
        ))}
      </div>
    </details>
  )
}
