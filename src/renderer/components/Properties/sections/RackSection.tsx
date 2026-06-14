import { useState } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { SortableSection } from '../SortableSection'
import { RackImageCropDialog } from '../../Rack/RackImageCropDialog'
import { RackFacePreview } from './RackFacePreview'
import type { EquipmentItem } from '../../../types/equipment'
import { format, useTranslation } from '../../../lib/i18n'

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
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const [rackViewMode, setRackViewMode] = useState<'front' | 'rear' | 'both'>('front')
  const [cropDialog, setCropDialog] = useState<
    { side: 'front' | 'rear'; src: string } | null
  >(null)

  return (
    <>
      <SortableSection
        id="rack"
        title={t('props.rack.title', 'Rack / 19" Einstellungen')}
        subtitle={
          equipment.isRackDevice
            ? format(t('props.rack.units', '{n} HE'), { n: equipment.rackUnits ?? 1 })
            : t('props.rack.inactive', 'nicht aktiv')
        }
        defaultOpen={!!equipment.isRackDevice}
      >
        <fieldset className="border-0 p-0">
          <label className="mb-2 flex items-center gap-2 text-cp-xs">
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
            <span>{t('props.rack.isRack', 'Ist ein 19" Rack-Gerät')}</span>
          </label>

          {!equipment.isRackDevice && (
            <div className="rounded border border-cp-border-muted bg-cp-surface-1/50 p-2 text-[11px] text-cp-text-muted">
              {t(
                'props.rack.disabledHint',
                'Rack-Felder erscheinen nur, wenn das Gerät als 19" Rack-Gerät markiert ist.',
              )}
            </div>
          )}

          {equipment.isRackDevice && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-cp-text-secondary">{t('props.rack.height', 'Hohe (HE)')}</span>
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
                    className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-cp-text-secondary">{t('props.rack.view', 'Ansicht')}</span>
                  <select
                    value={rackViewMode}
                    onChange={(event) => setRackViewMode(event.target.value as 'front' | 'rear' | 'both')}
                    className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
                  >
                    <option value="front">{t('props.rack.frontOnly', 'Nur vorne')}</option>
                    <option value="rear">{t('props.rack.rearOnly', 'Nur hinten')}</option>
                    <option value="both">{t('props.rack.frontRear', 'Vorne + hinten')}</option>
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
                  className="rounded bg-sky-700 px-2 py-1 text-cp-xs hover:bg-sky-600"
                >
                  {t('props.rack.importFront', 'Frontgrafik importieren + zuschneiden')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                    if (dataUri) setCropDialog({ side: 'rear', src: dataUri })
                  }}
                  className="rounded bg-purple-700 px-2 py-1 text-cp-xs hover:bg-purple-600"
                >
                  {t('props.rack.importRear', 'Reargrafik importieren + zuschneiden')}
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
                  className="mt-2 w-full rounded border border-cp-surface-5 bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-bright hover:bg-cp-surface-4"
                  title={t('props.rack.swapTitle', 'Front- und Rear-Foto vertauschen (samt Crop-Meta)')}
                >
                  {t('props.rack.swap', '↔ Front-/Rear-Foto vertauschen')}
                </button>
              )}

              {equipment.netboxPath && (
                <div className="mt-2 text-[10px] text-cp-text-muted">
                  {format(t('props.rack.netboxSource', 'Quelle: NetBox device-type-library · {path}'), {
                    path: equipment.netboxPath,
                  })}
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
