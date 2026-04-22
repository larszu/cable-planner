import { useProjectStore } from '../../store/projectStore'
import type { CableRouting } from '../../types/cable'

const routings: { value: CableRouting; label: string }[] = [
  { value: 'orthogonal', label: 'Ortho' },
  { value: 'straight', label: 'Line' },
  { value: 'curved', label: 'Curve' },
]

export const CableProperties = () => {
  const selectedCableId = useProjectStore((state) => state.selectedCableId)
  const cable = useProjectStore((state) => state.project.cables.find((item) => item.id === selectedCableId))
  const updateCable = useProjectStore((state) => state.updateCable)
  const deleteCable = useProjectStore((state) => state.deleteCable)

  if (!cable) {
    return <div className="text-xs text-slate-400">Select a cable edge.</div>
  }

  const routing = cable.routing ?? 'orthogonal'

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

      <div>
        <span className="mb-1 block text-slate-300">Routing</span>
        <div className="flex gap-1">
          {routings.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateCable(cable.id, { routing: opt.value, waypoints: undefined })}
              className={`flex-1 rounded border px-2 py-1 ${
                routing === opt.value
                  ? 'border-sky-500 bg-sky-800 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">Stroke width ({cable.strokeWidth ?? 2.5}px)</span>
        <input
          type="range"
          min={1}
          max={8}
          step={0.5}
          value={cable.strokeWidth ?? 2.5}
          onChange={(event) => updateCable(cable.id, { strokeWidth: Number(event.target.value) })}
          className="w-full"
        />
      </label>

      <div className="grid grid-cols-3 gap-1">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.dashed ?? false}
            onChange={(event) => updateCable(cable.id, { dashed: event.target.checked })}
          />
          Dashed
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.arrowStart ?? false}
            onChange={(event) => updateCable(cable.id, { arrowStart: event.target.checked })}
          />
          Arrow ◄
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={cable.arrowEnd ?? true}
            onChange={(event) => updateCable(cable.id, { arrowEnd: event.target.checked })}
          />
          Arrow ►
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">Notes</span>
        <textarea
          value={cable.notes}
          onChange={(event) => updateCable(cable.id, { notes: event.target.value })}
          rows={2}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <button
        type="button"
        onClick={() => deleteCable(cable.id)}
        className="w-full rounded bg-red-700 px-2 py-1 text-white hover:bg-red-600"
      >
        Delete Cable
      </button>
    </div>
  )
}
