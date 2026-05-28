import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { detectDeviceKind } from '../../../lib/deviceKind'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { PortList } from '../PortList'
import { PortAiSuggestButton } from './PortAiSuggestButton'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Inputs & Outputs"-SortableSection. Enthaelt PortAiSuggestButton
 * plus zwei <details>-Listen (Inputs / Outputs), die unabhaengig kollabieren
 * koennen (#185). showAtemSourceId triggert die ATEM-spezifische
 * Source-ID-Spalte in PortList.
 */
export const PortsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const deviceKind = detectDeviceKind(equipment)
  const isAtem = deviceKind === 'atem'

  return (
    <SortableSection
      id="ports"
      title={t('portsSection.title', 'Inputs & Outputs')}
      subtitle={`${equipment.inputs.length} ${t('portsSection.in', 'In')} · ${equipment.outputs.length} ${t('portsSection.out', 'Out')}`}
      defaultOpen
    >
      <div className="space-y-2">
        <PortAiSuggestButton equipment={equipment} />
        <details open className="rounded border border-slate-800 bg-slate-950/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
            {t('ports.title.inputs', 'Inputs')}{' '}
            <span className="text-slate-500">({equipment.inputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title={t('ports.title.inputs', 'Inputs')}
              ports={equipment.inputs}
              onChange={(inputs) => updateEquipment(equipment.id, { inputs })}
              hideTitle
              showAtemSourceId={isAtem}
            />
          </div>
        </details>
        <details open className="rounded border border-slate-800 bg-slate-950/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
            {t('ports.title.outputs', 'Outputs')}{' '}
            <span className="text-slate-500">({equipment.outputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title={t('ports.title.outputs', 'Outputs')}
              ports={equipment.outputs}
              onChange={(outputs) => updateEquipment(equipment.id, { outputs })}
              hideTitle
              showAtemSourceId={isAtem}
            />
          </div>
        </details>
      </div>
    </SortableSection>
  )
}
