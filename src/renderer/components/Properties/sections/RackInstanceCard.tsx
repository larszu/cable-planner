import { Server } from 'lucide-react'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation, format } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { Icon } from '../../shared/Icon'

/**
 * #306 — Karte fuer Geraete die zu einer Rack-Instanz gehoeren.
 * Oeffnet den Rack-Editor (Sub-Canvas auf das eine Rack gefiltert)
 * und zeigt die HU-Position. Rendert nichts wenn das Geraet kein
 * Rack-Member ist.
 */
export const RackInstanceCard = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const openRackEditor = useUiStore((state) => state.openRackEditor)
  if (!equipment.rackInstanceId) return null

  return (
    <div className="rounded border border-cyan-700 bg-cyan-950/30 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-cyan-300">
        {t('rackInstance.label', 'Rack-Instanz')} · {equipment.rackInstanceLabel ?? t('rackInstance.fallback', 'Rack')}
      </div>
      <p className="mb-2 text-[10px] text-cp-text-muted">
        {t(
          'rackInstance.intro',
          'Dieses Gerät gehört zu einer Rack-Instanz. Der Rack-Editor zeigt eine gefilterte Sub-Canvas mit nur diesem Rack — Änderungen an der Position werden beim Loslassen auf ganze HU gerundet.',
        )}
      </p>
      <button
        type="button"
        onClick={() => openRackEditor(equipment.rackInstanceId!)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded bg-cyan-700 px-2 py-1 text-cp-xs text-white hover:bg-cyan-600"
      >
        <Icon icon={Server} size="xs" /> {t('rackInstance.openEditor', 'Rack-Editor öffnen')}
      </button>
      {typeof equipment.rackInstanceStartUnit === 'number' && (
        <div className="mt-1 text-[10px] text-cp-text-muted">
          {format(t('rackInstance.position', 'Position: ab HU {start}'), {
            start: equipment.rackInstanceStartUnit + 1,
          })}
          {equipment.rackUnits ? ` (${equipment.rackUnits} ${t('rackInstance.heShort', 'HE')})` : ''}
        </div>
      )}
    </div>
  )
}
