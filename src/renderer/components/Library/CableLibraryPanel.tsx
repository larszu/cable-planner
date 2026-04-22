import { cableCatalog } from '../../types/cableSpec'

export const CableLibraryPanel = () => {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cable Library</h2>
      </div>
      <p className="mb-2 text-[11px] text-slate-400">
        Preset cables with connector and signal-standard info. Used when creating a connection
        between two devices.
      </p>
      <div className="flex-1 space-y-2 overflow-auto">
        {cableCatalog.map((cable) => (
          <div
            key={cable.id}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-xs"
            title={cable.notes ?? ''}
          >
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: cable.color }}
              />
              <span className="font-medium">{cable.name}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Connector: {cable.connectorType}
              {cable.compatibleConnectors?.length ? ` (+ ${cable.compatibleConnectors.join(', ')})` : ''}
            </div>
            <div className="text-[11px] text-slate-400">
              Standards: {cable.standards.join(', ')}
            </div>
            {cable.maxLengthMeters && (
              <div className="text-[11px] text-slate-400">Max length: {cable.maxLengthMeters} m</div>
            )}
            {cable.notes && (
              <div className="mt-1 rounded bg-slate-950 p-1 text-[10px] italic text-slate-300">
                {cable.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
