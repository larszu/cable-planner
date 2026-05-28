import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Rack-Face-Vorschau (2D-Front/Rear) aus EquipmentProperties
 * ausgelagert. Rendert null wenn das Gerät kein 19"-Rack-Item ist oder
 * keine HE definiert sind.
 */
export const RackFacePreview = ({
  equipment,
  viewMode,
}: {
  equipment: EquipmentItem
  viewMode: 'front' | 'rear' | 'both'
}) => {
  if (!equipment.isRackDevice || !equipment.rackUnits || equipment.rackUnits <= 0) return null

  const rows = Math.max(equipment.inputs.length, equipment.outputs.length, 1)
  const unitHeight = 22
  const panelWidth = Math.round(unitHeight * 10.86)

  return (
    <fieldset className="rounded border border-slate-700 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
        2D Rack-Vorschau
      </legend>
      <div className="mb-2 text-[11px] text-slate-400">19" Rack · {equipment.rackUnits} HE · Front/Rear mit Port-Marker</div>
      <div className="rounded border border-slate-700 bg-slate-950 p-3">
        <div className={`mx-auto grid w-full max-w-[760px] gap-2 ${viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {(viewMode === 'both' ? ['front', 'rear'] : [viewMode]).map((side) => {
            const imageUrl = side === 'front' ? equipment.frontPanelImageUrl : equipment.rearPanelImageUrl
            return (
              <div key={side} className="rounded border border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-3 shadow-inner">
                <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  <span>{side === 'front' ? 'Front' : 'Rear'}</span>
                  <span>{equipment.rackUnits} HE</span>
                </div>
                <div className="relative mb-3 rounded border border-slate-700 bg-slate-950/70 px-3 py-2 text-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${equipment.name} ${side}`}
                      className="mx-auto rounded object-contain"
                      style={{ width: panelWidth, height: Math.max(1, equipment.rackUnits ?? 1) * unitHeight }}
                    />
                  ) : (
                    <>
                      <div className="truncate text-sm font-semibold text-slate-100">{equipment.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{equipment.category}</div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: rows }).map((_, index) => {
                    const input = equipment.inputs[index]
                    const output = equipment.outputs[index]
                    return (
                      <div key={`${equipment.id}-${side}-rack-row-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[11px]">
                        <div className="min-w-0 rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-right text-slate-200">
                          {input ? (
                            <span className="block truncate">
                              {input.name}
                              <span className="text-slate-500"> · {input.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                          <span className="h-px w-8 bg-slate-700" />
                          <span className="h-px w-8 bg-slate-700" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="min-w-0 rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-slate-200">
                          {output ? (
                            <span className="block truncate">
                              {output.name}
                              <span className="text-slate-500"> · {output.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </fieldset>
  )
}
