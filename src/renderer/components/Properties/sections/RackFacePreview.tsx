import type { EquipmentItem } from '../../../types/equipment'
import { format, useTranslation } from '../../../lib/i18n'

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
  const t = useTranslation()
  if (!equipment.isRackDevice || !equipment.rackUnits || equipment.rackUnits <= 0) return null

  const rows = Math.max(equipment.inputs.length, equipment.outputs.length, 1)
  const unitHeight = 22
  const panelWidth = Math.round(unitHeight * 10.86)

  return (
    <fieldset className="border border-cp-border p-2">
      <legend className="px-1 text-cp-xs uppercase tracking-wide text-cp-text-muted">
        {t('rackFace.title', '2D rack preview')}
      </legend>
      <div className="mb-2 text-cp-xs text-cp-text-muted">{format(t('rackFace.subtitle', '19" rack · {he} U · front/rear with port markers'), { he: equipment.rackUnits })}</div>
      <div className="border border-cp-border bg-cp-surface-3 p-3">
        <div className={`mx-auto grid w-full max-w-[760px] gap-2 ${viewMode === 'both' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {(viewMode === 'both' ? ['front', 'rear'] : [viewMode]).map((side) => {
            const imageUrl = side === 'front' ? equipment.frontPanelImageUrl : equipment.rearPanelImageUrl
            return (
              <div key={side} className="border border-cp-surface-5 bg-gradient-to-b from-cp-surface-2 to-cp-surface-1 px-4 py-3">
                <div className="mb-3 flex items-center justify-between text-cp-xs uppercase tracking-[0.2em] text-cp-text-muted">
                  <span>{side === 'front' ? t('rackFace.front', 'Front') : t('rackFace.rear', 'Rear')}</span>
                  <span>{equipment.rackUnits} HE</span>
                </div>
                <div className="relative mb-3 border border-cp-border bg-cp-surface-3/70 px-3 py-2 text-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={`${equipment.name} ${side}`}
                      className="mx-auto object-contain"
                      style={{ width: panelWidth, height: Math.max(1, equipment.rackUnits ?? 1) * unitHeight }}
                    />
                  ) : (
                    <>
                      <div className="truncate text-cp-base font-semibold text-cp-text">{equipment.name}</div>
                      <div className="truncate text-cp-xs text-cp-text-muted">{equipment.category}</div>
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: rows }).map((_, index) => {
                    const input = equipment.inputs[index]
                    const output = equipment.outputs[index]
                    return (
                      <div key={`${equipment.id}-${side}-rack-row-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-cp-xs">
                        <div className="min-w-0 border border-cp-border bg-cp-surface-1/70 px-2 py-1 text-right text-cp-text-bright">
                          {input ? (
                            <span className="block truncate">
                              {input.name}
                              <span className="text-cp-text-faint"> · {input.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-cp-text-dim">—</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 bg-sky-400" />
                          <span className="h-px w-8 bg-cp-surface-4" />
                          <span className="h-px w-8 bg-cp-surface-4" />
                          <span className="h-2.5 w-2.5 bg-emerald-400" />
                        </div>
                        <div className="min-w-0 border border-cp-border bg-cp-surface-1/70 px-2 py-1 text-cp-text-bright">
                          {output ? (
                            <span className="block truncate">
                              {output.name}
                              <span className="text-cp-text-faint"> · {output.connectorType}</span>
                            </span>
                          ) : (
                            <span className="text-cp-text-dim">—</span>
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
