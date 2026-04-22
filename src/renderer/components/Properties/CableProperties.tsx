import { useProjectStore } from '../../store/projectStore'

export const CableProperties = () => {
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const cable = useProjectStore((state) => state.project.cables.find((item) => item.id === selectedCableId))
  const updateCable = useProjectStore((state) => state.updateCable)

  if (!cable) {
    return <div className="text-xs text-slate-400">Select a cable edge.</div>
  }

  return (
    <div className="space-y-2 text-xs">
      <label className="block">
        <span className="mb-1 block text-slate-300">Name</span>
        <input
          value={cable.name}
          onChange={(event) => updateCable(cable.id, { name: event.target.value })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Length (m)</span>
        <input
          type="number"
          min={0}
          value={cable.length}
          onChange={(event) => updateCable(cable.id, { length: Number(event.target.value) })}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-slate-300">Color</span>
        <input
          type="color"
          value={cable.color}
          onChange={(event) => updateCable(cable.id, { color: event.target.value })}
          className="h-9 w-full rounded border border-slate-700 bg-slate-900 p-1"
        />
      </label>
    </div>
  )
}
