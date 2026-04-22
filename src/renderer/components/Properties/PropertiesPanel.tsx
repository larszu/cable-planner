import { useProjectStore } from '../../store/projectStore'
import { CableProperties } from './CableProperties'
import { EquipmentProperties } from './EquipmentProperties'

export const PropertiesPanel = () => {
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const selectedCableId = useProjectStore((state) => state.selectedCableId)

  return (
    <aside className="h-full border-l border-slate-700 bg-slate-950 p-3 text-slate-100">
      <h2 className="mb-3 text-sm font-semibold">Properties</h2>
      {selectedEquipmentId && <EquipmentProperties />}
      {selectedCableId && <CableProperties />}
      {!selectedEquipmentId && !selectedCableId && (
        <div className="text-xs text-slate-400">Select an equipment node or cable edge.</div>
      )}
    </aside>
  )
}
