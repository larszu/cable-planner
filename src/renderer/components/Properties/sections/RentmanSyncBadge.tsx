import { AlertTriangle } from 'lucide-react'
import { useModule } from '../../../store/settingsStore'
import type { EquipmentItem } from '../../../types/equipment'
import { format, useTranslation } from '../../../lib/i18n'
import { Icon } from '../../shared/Icon'

/**
 * #306 — Rentman-Sync-Status-Badge aus EquipmentProperties.tsx
 * ausgelagert. Drei Zustaende:
 *  - rentmanRemoved: rot — in Rentman geloescht aber lokal noch da
 *  - rentmanId: orange — verknuepft
 *  - sonst: amber — nicht im Rentman-Plan
 *
 * Returns null wenn die Rentman-Integration global aus ist
 * (rentmanEnabled === false).
 */
export const RentmanSyncBadge = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const rentmanEnabled = useModule('rentman')
  if (!rentmanEnabled) return null

  if (equipment.rentmanRemoved) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-[11px] text-red-300">
        <Icon icon={AlertTriangle} size="sm" />
        <span>{t('props.rentmanBadge.removed', 'In Rentman nicht mehr vorhanden!')}</span>
      </div>
    )
  }
  if (equipment.rentmanId) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-orange-700/50 bg-orange-900/20 px-2 py-1 text-[11px] text-orange-300">
        <span className="rounded bg-orange-700 px-1 font-bold text-white">R</span>
        {format(t('props.rentmanBadge.id', 'Rentman-ID: {id}'), { id: equipment.rentmanId })}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 rounded border border-amber-700/40 bg-amber-900/10 px-2 py-1 text-[11px] text-amber-400">
      <Icon icon={AlertTriangle} size="sm" />
      <span>{t('props.rentmanBadge.notTracked', 'Nicht im Rentman-Plan erfasst')}</span>
    </div>
  )
}
