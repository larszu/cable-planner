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
  const project = useProjectStore((state) => state.project)
  const collapsed = useUiStore((state) => state.propertiesCollapsed)
  const toggle = useUiStore((state) => state.togglePropertiesCollapsed)
  const selectedEquipment = selectedEquipmentId
    ? project.equipment.find((item) => item.id === selectedEquipmentId)
    : undefined
  const selectedCable = selectedCableId
    ? project.cables.find((item) => item.id === selectedCableId)
    : undefined
  const selectedLocation = selectedLocationId
    ? project.locations?.find((item) => item.id === selectedLocationId)
    : undefined
  const title = selectedEquipment
    ? `Gerät: ${selectedEquipment.name}`
    : selectedCable
      ? `Kabel: ${selectedCable.name}`
      : selectedLocation
        ? `Rahmen: ${selectedLocation.name}`
        : selectedTemplateName
          ? `Vorlage: ${selectedTemplateName}`
          : 'Inspector'

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
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">
            Eigenschaften
          </div>
        </div>
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
          <div className="space-y-3 text-xs text-slate-400">
            <div className="rounded border border-slate-800 bg-slate-900/50 p-3">
              <div className="mb-1 font-semibold text-slate-200">Nichts ausgewählt</div>
              <div>Wähle ein Gerät, Kabel, Rahmen oder eine Library-Vorlage aus.</div>
            </div>
            <div className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Schnelle Orientierung
              </div>
              <div className="space-y-1">
                <div>• Geräte links aus der Library auf den Canvas setzen.</div>
                <div>• Ports verbinden, um Kabel zu erstellen.</div>
                <div>• Mehrere Geräte auswählen und im Canvas als Gruppe speichern.</div>
                <div>• Rentman-Aktionen findest du im Equipment-Tab unter Rentman.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
