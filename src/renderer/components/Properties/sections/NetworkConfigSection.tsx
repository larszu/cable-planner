import { detectNetworkDevice } from '../../../lib/deviceKind'
import { SortableSection } from '../SortableSection'
import { NetworkConfig } from './NetworkConfig'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Wrapper-Section um NetworkConfig (Switch/Router VLAN-Setup).
 * Macht detectNetworkDevice selber und rendert nur fuer Switch/Router
 * — sonst null.
 */
export const NetworkConfigSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const networkKind = detectNetworkDevice(equipment)
  if (!networkKind) return null

  return (
    <SortableSection
      id="network-config"
      title={networkKind === 'router' ? t('net.routerConfig', 'Router Config') : t('net.switchConfig', 'Switch Config')}
      subtitle={t('netCfg.subtitle', 'VLAN · Port-Map · Gateway')}
    >
      <NetworkConfig
        equipmentId={equipment.id}
        item={equipment}
        allPorts={[...equipment.inputs, ...equipment.outputs]}
        kind={networkKind}
      />
    </SortableSection>
  )
}
