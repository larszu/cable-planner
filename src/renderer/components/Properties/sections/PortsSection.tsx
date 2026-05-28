import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { detectDeviceKind } from '../../../lib/deviceKind'
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
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const deviceKind = detectDeviceKind(equipment)
  const isAtem = deviceKind === 'atem'

  return (
    <SortableSection
      id="ports"
      title="Inputs & Outputs"
      subtitle={`${equipment.inputs.length} In · ${equipment.outputs.length} Out`}
      defaultOpen
    >
      <div className="space-y-2">
        {/* v7.9.108 / Issue #225 — AI-Suggest-Button fuer Ports. Fragt
            Gemini (oder den im Settings konfigurierten Provider) was
            ein Geraet mit diesem Namen + Kategorie ueblicherweise
            fuer Ports hat. Mit Confirm-Step weil's existing Ports
            ersetzt — User koennte sonst aus Versehen alles ueberbuegeln. */}
        <PortAiSuggestButton equipment={equipment} />
        {/* v7.9.63 / #185 — Inputs und Outputs unabhängig collapsible.
            Vorher musste der User immer durch alle Inputs scrollen um
            die Outputs zu erreichen. Beide Defaults auf open damit
            alte UX nicht plötzlich anders aussieht. */}
        <details open className="rounded border border-slate-800 bg-slate-950/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
            Inputs <span className="text-slate-500">({equipment.inputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title="Inputs"
              ports={equipment.inputs}
              onChange={(inputs) => updateEquipment(equipment.id, { inputs })}
              hideTitle
              showAtemSourceId={isAtem}
            />
          </div>
        </details>
        <details open className="rounded border border-slate-800 bg-slate-950/30">
          <summary className="cursor-pointer select-none px-2 py-1 text-xs font-semibold text-slate-300 hover:text-slate-100">
            Outputs <span className="text-slate-500">({equipment.outputs.length})</span>
          </summary>
          <div className="px-2 pb-2">
            <PortList
              title="Outputs"
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
