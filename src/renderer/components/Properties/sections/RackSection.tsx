import { useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { SortableSection } from '../SortableSection'
import { RackImageCropDialog } from '../../Rack/RackImageCropDialog'
import { RackFacePreview } from './RackFacePreview'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Rack-Section: 19"-Settings + Front/Rear-Panel-Foto-Import
 * mit Crop-Dialog. Lokaler State `rackViewMode` (Front/Rear/Both) und
 * `cropDialog` (Quelldatei + Side) leben hier, weil sie nur fuer
 * diese Section relevant sind.
 *
 * Hinweis #170: Der "Front-/Rear-Foto vertauschen"-Button tauscht
 * auch die Crop-Meta mit, damit der Zuschnitt beim Swap erhalten
 * bleibt.
 */
export const RackSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [rackViewMode, setRackViewMode] = useState<'front' | 'rear' | 'both'>('front')
  const [cropDialog, setCropDialog] = useState<
    { side: 'front' | 'rear'; src: string } | null
  >(null)

  return (
    <>
      <SortableSection
        id="rack"
        title={`Rack / 19" Einstellungen`}
        subtitle={equipment.isRackDevice ? `${equipment.rackUnits ?? 1} HE` : 'nicht aktiv'}
        defaultOpen={!!equipment.isRackDevice}
      >
        <fieldset className="border-0 p-0">
          <label className="mb-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!!equipment.isRackDevice}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  isRackDevice: event.target.checked,
                  rackUnits: event.target.checked ? equipment.rackUnits ?? 1 : undefined,
                })
              }
            />
            <span>Ist ein 19" Rack-Gerät</span>
          </label>

          {!equipment.isRackDevice && (
            <div className="rounded border border-slate-800 bg-slate-900/50 p-2 text-[11px] text-slate-400">
              Rack-Felder erscheinen nur, wenn das Gerät als 19" Rack-Gerät markiert ist.
            </div>
          )}

          {equipment.isRackDevice && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-slate-300">Hohe (HE)</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={equipment.rackUnits ?? 1}
                    onChange={(event) =>
                      updateEquipment(equipment.id, {
                        rackUnits: Math.max(1, Number(event.target.value) || 1),
                      })
                    }
                    className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-slate-300">Ansicht</span>
                  <select
                    value={rackViewMode}
                    onChange={(event) => setRackViewMode(event.target.value as 'front' | 'rear' | 'both')}
                    className="w-full rounded border border-slate-700 bg-slate-900 p-2"
                  >
                    <option value="front">Nur vorne</option>
                    <option value="rear">Nur hinten</option>
                    <option value="both">Vorne + hinten</option>
                  </select>
                </label>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                    if (dataUri) setCropDialog({ side: 'front', src: dataUri })
                  }}
                  className="rounded bg-sky-700 px-2 py-1 text-xs hover:bg-sky-600"
                >
                  Frontgrafik importieren + zuschneiden
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                    if (dataUri) setCropDialog({ side: 'rear', src: dataUri })
                  }}
                  className="rounded bg-purple-700 px-2 py-1 text-xs hover:bg-purple-600"
                >
                  Reargrafik importieren + zuschneiden
                </button>
              </div>
              {/* v7.9.76 / #170 — Swap-Button: tauscht Front/Rear-Foto-
                  Zuordnung am Gerät. Hilft wenn man versehentlich das
                  falsche Foto als Front hochgeladen hat. Tauscht auch
                  die Crop-Meta-Daten mit, damit der Zuschnitt erhalten
                  bleibt. */}
              {(equipment.frontPanelImageUrl || equipment.rearPanelImageUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    updateEquipment(equipment.id, {
                      frontPanelImageUrl: equipment.rearPanelImageUrl,
                      rearPanelImageUrl: equipment.frontPanelImageUrl,
                      frontPanelCrop: equipment.rearPanelCrop,
                      rearPanelCrop: equipment.frontPanelCrop,
                    })
                  }
                  className="mt-2 w-full rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                  title="Front- und Rear-Foto vertauschen (samt Crop-Meta)"
                >
                  ↔ Front-/Rear-Foto vertauschen
                </button>
              )}

              {equipment.netboxPath && (
                <div className="mt-2 text-[10px] text-slate-500">
                  Quelle: NetBox device-type-library · {equipment.netboxPath}
                </div>
              )}

              <RackFacePreview equipment={equipment} viewMode={rackViewMode} />
            </>
          )}
        </fieldset>
      </SortableSection>

      <RackImageCropDialog
        open={!!cropDialog}
        imageSrc={cropDialog?.src ?? null}
        rackUnits={equipment.rackUnits ?? 1}
        side={cropDialog?.side ?? 'front'}
        onCancel={() => setCropDialog(null)}
        onConfirm={({ dataUrl, crop }) => {
          if (!cropDialog) return
          if (cropDialog.side === 'front') {
            updateEquipment(equipment.id, { frontPanelImageUrl: dataUrl, frontPanelCrop: crop })
          } else {
            updateEquipment(equipment.id, { rearPanelImageUrl: dataUrl, rearPanelCrop: crop })
          }
          setCropDialog(null)
        }}
      />
    </>
  )
}
