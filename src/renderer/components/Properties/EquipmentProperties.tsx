import { useProjectStore } from '../../store/projectStore'

export const EquipmentProperties = () => {
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((item) => item.id === selectedEquipmentId),
  )
  const updateEquipment = useProjectStore((state) => state.updateEquipment)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }

  return (
    <div className="space-y-2 text-xs">
      <label className="block">
        <span className="mb-1 block text-slate-300">Name</span>
        <input
          value={equipment.name}
          onChange={(event) => updateEquipment(equipment.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Category</span>
        <input
          value={equipment.category}
          onChange={(event) => updateEquipment(equipment.id, { category: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
    </div>
  )
}
