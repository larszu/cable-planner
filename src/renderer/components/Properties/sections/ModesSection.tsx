import { SortableSection } from '../SortableSection'
import { DeviceModePicker } from './DeviceModePicker'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Betriebsmodi"-SortableSection. Subtitle zeigt den aktiven
 * Modusnamen, falls einer aktiv ist (Issue #113).
 */
export const ModesSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const modes = equipment.modes ?? []
  const activeName = modes.find((m) => m.id === equipment.activeModeId)?.name
  const subtitle =
    modes.length === 0
      ? 'keiner — anlegen unten'
      : (activeName ?? `${modes.length} definiert`)

  return (
    <SortableSection
      id="modes"
      title="Betriebsmodi"
      subtitle={subtitle}
    >
      <DeviceModePicker equipment={equipment} />
    </SortableSection>
  )
}
