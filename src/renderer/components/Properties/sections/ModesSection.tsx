import { SortableSection } from '../SortableSection'
import { DeviceModePicker } from './DeviceModePicker'
import type { EquipmentItem } from '../../../types/equipment'
import { format, useTranslation } from '../../../lib/i18n'

/**
 * #306 — "Betriebsmodi"-SortableSection. Subtitle zeigt den aktiven
 * Modusnamen, falls einer aktiv ist (Issue #113).
 */
export const ModesSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const modes = equipment.modes ?? []
  const activeName = modes.find((m) => m.id === equipment.activeModeId)?.name
  const subtitle =
    modes.length === 0
      ? t('props.modes.empty', 'keiner — anlegen unten')
      : (activeName ?? format(t('props.modes.defined', '{n} definiert'), { n: modes.length }))

  return (
    <SortableSection
      id="modes"
      title={t('props.modes.title', 'Betriebsmodi')}
      subtitle={subtitle}
    >
      <DeviceModePicker equipment={equipment} />
    </SortableSection>
  )
}
