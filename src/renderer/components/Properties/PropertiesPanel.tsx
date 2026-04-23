import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { CableProperties } from './CableProperties'
import { EquipmentProperties } from './EquipmentProperties'
import { LocationProperties } from './LocationProperties'
import { TemplateProperties } from './TemplateProperties'

export const PropertiesPanel = () => {
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const selectedLocationId = useProjectStore((state) => state.selectedLocationId)
  const selectedTemplateName = useProjectStore((state) => state.selectedTemplateName)
  const collapsed = useUiStore((state) => state.propertiesCollapsed)
  const toggle = useUiStore((state) => state.togglePropertiesCollapsed)

  if (collapsed) {
    return (
      <aside className="flex h-full w-8 flex-col items-center border-l border-slate-700 bg-slate-950 py-2">
        <button
          type="button"
          onClick={toggle}
          title="Expand properties"
          className="rounded px-1 py-2 text-slate-300 hover:bg-slate-800"
        >
          ◄
        </button>
        <div
          className="mt-4 text-[10px] uppercase tracking-wider text-slate-500"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          Properties
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-slate-700 bg-slate-950 p-3 text-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Properties</h2>
        <button
          type="button"
          onClick={toggle}
          title="Collapse properties"
          className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          ►
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedEquipmentId && <EquipmentProperties />}
        {selectedCableId && <CableProperties />}
        {selectedLocationId && <LocationProperties />}
        {selectedTemplateName && <TemplateProperties />}
        {!selectedEquipmentId && !selectedCableId && !selectedLocationId && !selectedTemplateName && (
          <div className="text-xs text-slate-400">
            Gerät, Kabel oder Rahmen anklicken — oder Vorlage in der Library mit ✎ bearbeiten.
          </div>
        )}
      </div>
    </aside>
  )
}
